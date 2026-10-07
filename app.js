import express from 'express';
import {fileURLToPath} from 'node:url';
import {defaultDatabase} from './lib/database.mjs';
import {hashPassword,verifyPassword,newToken,digest} from './lib/security.mjs';
const week=7*24*60*60*1000;
const fallback='scrypt$00000000000000000000000000000000$'+'0'.repeat(128);
export function createApp(providedDatabase){
 const app=express(); app.disable('x-powered-by');
 app.use((req,res,next)=>{
  res.set({'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"});
  if(req.path.startsWith('/api/')) res.set('Cache-Control','no-store');
  if(!['GET','HEAD','OPTIONS'].includes(req.method)){
   const origin=req.get('origin');
   if(origin && new URL(origin).host!==req.get('host')) return res.status(403).json({error:'Request origin is not allowed.'});
   if(!req.is('application/json')) return res.status(415).json({error:'Send JSON.'});
  }
  next();
 });
 app.use(express.json({limit:'8kb'}));
 app.use('/api',async(req,res,next)=>{try{req.db=providedDatabase||defaultDatabase();await req.db.init();next();}catch{res.status(503).json({error:'Database is unavailable. Please try again shortly.'});}});
 async function auth(req,res,next){
  const token=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('session='))?.slice(8);
  if(!token || !/^[a-f0-9]{64}$/.test(token)) return res.status(401).json({error:'Please log in.'});
  const found=await req.db.client.execute({sql:'SELECT users.id, users.username FROM sessions JOIN users ON users.id=sessions.user_id WHERE token_hash=? AND expires_at>?',args:[digest(token),Date.now()]});
  if(!found.rows.length) return res.status(401).json({error:'Please log in.'});
  req.user={id:Number(found.rows[0].id),username:found.rows[0].username};req.token=token;next();
 }
 const cookieOptions={httpOnly:true,sameSite:'lax',secure:!!process.env.VERCEL,path:'/',maxAge:week};
 async function session(req,res,user){
  const token=newToken();await req.db.client.execute({sql:'INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)',args:[digest(token),user.id,Date.now()+week]});
  res.cookie('session',token,cookieOptions);return {id:Number(user.id),username:user.username};
 }
 async function limit(req,res,next){
  const key=digest(`${req.ip}:${typeof req.body?.username==='string'?req.body.username.toLowerCase():''}`);
  const now=Date.now();
  const result=await req.db.client.execute({sql:'INSERT INTO auth_attempts(bucket,attempts,expires_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET attempts=CASE WHEN expires_at<? THEN 1 ELSE attempts+1 END, expires_at=CASE WHEN expires_at<? THEN excluded.expires_at ELSE expires_at END RETURNING attempts',args:[key,now+15*60*1000,now,now]});
  if(Number(result.rows[0].attempts)>20) return res.status(429).json({error:'Too many attempts. Try again in 15 minutes.'});next();
 }
 function credentials(body){
  if(typeof body?.username!=='string'||typeof body?.password!=='string')return null;
  const username=body.username.trim().toLowerCase(),password=body.password;
  if(!/^[a-z0-9_]{3,24}$/.test(username)||password.length<10||password.length>128)return null;
  return {username,password};
 }
 app.post('/api/register',limit,async(req,res)=>{
  const input=credentials(req.body);if(!input)return res.status(400).json({error:'Use a username of 3–24 letters, numbers or underscores and a password of 10–128 characters.'});
  const encoded=await hashPassword(input.password);
  try{
   const result=await req.db.client.execute({sql:'INSERT INTO users(username,password_hash) VALUES(?,?) RETURNING id, username',args:[input.username,encoded]});
   res.status(201).json({user:await session(req,res,result.rows[0])});
  }catch(e){if(String(e.code).includes('CONSTRAINT')||String(e.message).includes('UNIQUE'))return res.status(409).json({error:'This username is already taken.'});throw e;}
 });
 app.post('/api/login',limit,async(req,res)=>{
  const input=credentials(req.body);if(!input)return res.status(401).json({error:'Invalid username or password.'});
  const result=await req.db.client.execute({sql:'SELECT id,username,password_hash FROM users WHERE username=?',args:[input.username]});
  const user=result.rows[0];const valid=await verifyPassword(input.password,user?.password_hash||fallback);
  if(!user||!valid)return res.status(401).json({error:'Invalid username or password.'});
  res.json({user:await session(req,res,user)});
 });
 app.get('/api/me',auth,(req,res)=>res.json({user:req.user}));
 app.post('/api/logout',auth,async(req,res)=>{
  await req.db.client.execute({sql:'DELETE FROM sessions WHERE token_hash=?',args:[digest(req.token)]});
  res.clearCookie('session',{...cookieOptions,maxAge:undefined});res.status(204).end();
 });
 app.get('/api/tasks',auth,async(req,res)=>{
  const result=await req.db.client.execute({sql:'SELECT id,title,completed,created_at FROM tasks WHERE user_id=? ORDER BY id DESC',args:[req.user.id]});
  res.json({tasks:result.rows.map(row=>({...row,id:Number(row.id),completed:!!row.completed}))});
 });
 app.post('/api/tasks',auth,async(req,res)=>{
  const title=typeof req.body?.title==='string'?req.body.title.trim():'';
  if(!title||title.length>240)return res.status(400).json({error:'Write a task between 1 and 240 characters.'});
  const result=await req.db.client.execute({sql:'INSERT INTO tasks(user_id,title) VALUES(?,?) RETURNING id,title,completed,created_at',args:[req.user.id,title]});
  res.status(201).json({task:{...result.rows[0],id:Number(result.rows[0].id),completed:false}});
 });
 app.use('/api/tasks/:id',(req,res,next)=>{if(!/^[1-9][0-9]*$/.test(req.params.id)||!Number.isSafeInteger(Number(req.params.id)))return res.status(400).json({error:'Invalid task ID.'});next();});
 app.patch('/api/tasks/:id',auth,async(req,res)=>{
  if(typeof req.body?.completed!=='boolean')return res.status(400).json({error:'Completed must be true or false.'});
  const result=await req.db.client.execute({sql:'UPDATE tasks SET completed=? WHERE id=? AND user_id=? RETURNING id,title,completed,created_at',args:[Number(req.body.completed),Number(req.params.id),req.user.id]});
  if(!result.rows.length)return res.status(404).json({error:'Task not found.'});
  res.json({task:{...result.rows[0],id:Number(result.rows[0].id),completed:!!result.rows[0].completed}});
 });
 app.delete('/api/tasks/:id',auth,async(req,res)=>{
  const result=await req.db.client.execute({sql:'DELETE FROM tasks WHERE id=? AND user_id=?',args:[Number(req.params.id),req.user.id]});
  if(!result.rowsAffected)return res.status(404).json({error:'Task not found.'});res.status(204).end();
 });
 app.use('/api',(_req,res)=>res.status(404).json({error:'Endpoint not found.'}));
 app.use(express.static(fileURLToPath(new URL('./public',import.meta.url))));
 app.use((error,_req,res,_next)=>{res.status(error.type==='entity.parse.failed'?400:500).json({error:error.type==='entity.parse.failed'?'Invalid JSON.':'Something went wrong. Please try again.'});});
 return app;
}
export default createApp();
