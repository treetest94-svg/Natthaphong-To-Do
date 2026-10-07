import {randomBytes,scrypt,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
const derive=promisify(scrypt);
const options={N:65536,r:8,p:2,maxmem:96*1024*1024};
export const digest=token=>createHash('sha256').update(token).digest('hex');
export const newToken=()=>randomBytes(32).toString('hex');
export async function hashPassword(password){
 const salt=randomBytes(16).toString('hex');
 const hash=await derive(password,salt,64,options);
 return `scrypt$${salt}$${hash.toString('hex')}`;
}
export async function verifyPassword(password,encoded){
 const [algorithm,salt,hash]=encoded.split('$');
 if(algorithm!=='scrypt'||!salt||!hash) return false;
 const actual=await derive(password,salt,64,options);
 const expected=Buffer.from(hash,'hex');
 return actual.length===expected.length && timingSafeEqual(actual,expected);
}
