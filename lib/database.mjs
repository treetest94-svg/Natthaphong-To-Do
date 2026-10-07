import {createClient} from '@libsql/client';
import {mkdirSync} from 'node:fs';
import {schema} from './schema.mjs';
export function database(url, authToken) {
 const client=createClient({url, ...(authToken ? {authToken}: {})});
 let ready;
 return {client, init(){return ready ??= client.batch(schema, 'write').catch(e=>{ready=undefined;throw e;});}};
}
let production;
export function defaultDatabase(){
 if(production) return production;
 const url=process.env.TURSO_DATABASE_URL;
 if(process.env.VERCEL && !url) throw new Error('Connect a hosted SQLite database before running on Vercel.');
 if(!url) mkdirSync('data',{recursive:true});
 return production=database(url || 'file:./data/tasks.db',process.env.TURSO_AUTH_TOKEN);
}
