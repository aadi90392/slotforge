import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';

const source=readFileSync(new URL('../lib/mail.ts',import.meta.url),'utf8').replaceAll('import.meta.env.DEV','false');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function harness(status=201){
 const logs=[],sent=[],removed=[];
 const env={BREVO_API_KEY:' key-secret ',EMAIL_FROM:' sender@example.test ',APP_ORIGIN:'https://app.example.test'};
 class ApiError extends Error{constructor(status,message){super(message);this.status=status;}}
 const server={ApiError,assert:(v,m,s=400)=>{if(!v)throw new ApiError(s,m);},randomToken:()=> 'token-secret',uid:()=> 'id',digest:async()=> 'hashed-token',db:()=>({batch:async()=>[],prepare:(sql)=>({bind:()=>({run:async()=>removed.push(sql)})})})};
 const exports={};
 runInNewContext(compiled,{exports,require:(name)=>name==='cloudflare:workers'?{env}:name==='./server'?server:createRequire(import.meta.url)(name),URL,URLSearchParams,AbortSignal,console:{error:(...args)=>logs.push(args)},fetch:async(url,options)=>{sent.push({url,options});if(status==='network')throw new Error('private-network-details');return {ok:status===201,status,json:async()=>({code:'unauthorized',message:'private-provider-details'})};}});
 return {api:exports,env,logs,sent,removed};
}
const req=new Request('https://app.example.test/api/auth/register');
const user={id:'user-id',email:'recipient@example.test'};
test('production refuses missing mail configuration',()=>{const h=harness();delete h.env.APP_ORIGIN;assert.throws(()=>h.api.requireMail(req),e=>e.status===503);});
test('provider request trims credentials and does not log successful tokens',async()=>{const h=harness();await h.api.sendAccountLink(req,user,'verify');assert.equal(h.sent[0].options.headers['api-key'],'key-secret');assert.equal(JSON.parse(h.sent[0].options.body).sender.email,'sender@example.test');assert.equal(h.logs.length,0);});
test('provider rejection revokes token and logs status/code only',async()=>{const h=harness(401);await assert.rejects(h.api.sendAccountLink(req,user,'verify'),e=>e.status===503);assert(h.removed.some(s=>s.includes('DELETE FROM auth_tokens')));const log=JSON.stringify(h.logs);assert(log.includes('401'));assert(log.includes('unauthorized'));for(const secret of ['key-secret','token-secret','recipient@example.test','private-provider-details'])assert(!log.includes(secret));});
test('network failure revokes token and returns retryable error',async()=>{const h=harness('network');await assert.rejects(h.api.sendAccountLink(req,user,'reset'),e=>e.status===503);assert.equal(h.removed.length,1);assert(!JSON.stringify(h.logs).includes('private-network-details'));});
