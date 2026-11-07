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
 runInNewContext(compiled,{exports,require:(name)=>name==='cloudflare:workers'?{env}:name==='./server'?server:createRequire(import.meta.url)(name),URL,URLSearchParams,AbortSignal,console:{error:(...args)=>logs.push(args)},fetch:async(url,options)=>{sent.push({url,options});if(status==='network')throw new Error('private-network-details');return {ok:status===201,status,headers:new Headers({'content-type':'application/json'}),text:async()=>JSON.stringify({code:'unauthorized',message:'Rejected recipient@example.test token-secret key-secret'})};}});
 return {api:exports,env,logs,sent,removed};
}
const req=new Request('https://app.example.test/api/auth/register');
const user={id:'user-id',email:'recipient@example.test'};
test('production refuses missing mail configuration',()=>{const h=harness();delete h.env.APP_ORIGIN;assert.throws(()=>h.api.requireMail(req),e=>e.status===503);});
test('provider request trims credentials and does not log successful tokens',async()=>{const h=harness();await h.api.sendAccountLink(req,user,'verify');assert.equal(h.sent[0].options.headers['api-key'],'key-secret');assert.equal(JSON.parse(h.sent[0].options.body).sender.email,'sender@example.test');assert.equal(h.logs.length,0);});
test('provider rejection revokes token and logs status/code only',async()=>{const h=harness(401);await assert.rejects(h.api.sendAccountLink(req,user,'verify'),e=>e.status===503);assert(h.removed.some(s=>s.includes('DELETE FROM auth_tokens')));const log=JSON.stringify(h.logs);assert(log.includes('401'));assert(log.includes('unauthorized'));for(const secret of ['key-secret','token-secret','recipient@example.test','private-provider-details'])assert(!log.includes(secret));});
test('network failure revokes token and returns retryable error',async()=>{const h=harness('network');await assert.rejects(h.api.sendAccountLink(req,user,'reset'),e=>e.status===503);assert.equal(h.removed.length,1);assert(!JSON.stringify(h.logs).includes('private-network-details'));});

for (const purpose of ['verify','reset']) {
 test(`${purpose} email includes HTML button, fallback and correct expiry`, async()=>{
  const h=harness(); await h.api.sendAccountLink(req,user,purpose);
  const mail=JSON.parse(h.sent[0].options.body);
  const expiry=purpose==='verify'?'24 hours':'30 minutes';
  assert(mail.htmlContent.includes('<html lang="en">'));
  assert(mail.htmlContent.includes('role="presentation"'));
  assert(mail.htmlContent.includes(expiry));
  assert(mail.textContent.includes(expiry));
  assert(mail.textContent.includes(`/account#purpose=${purpose}&token=token-secret`));
  assert.equal((mail.htmlContent.match(/href="https:\/\/app.example.test\/account#purpose=/g)||[]).length,2);
  assert(mail.htmlContent.includes('&amp;token=token-secret'));
  assert(!/<script|<img|<form|https:\/\/fonts/i.test(mail.htmlContent));
 });
}
test('email links escape HTML attribute and text delimiters',()=>{
 const mail=harness().api.accountEmail('verify','https://example.test/?x="<test>&y=1');
 assert(!mail.htmlContent.includes('"<test>'));
 assert(mail.htmlContent.includes('&quot;&lt;test&gt;&amp;y=1'));
});
