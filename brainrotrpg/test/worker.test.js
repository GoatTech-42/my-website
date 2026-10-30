import {test} from 'node:test';import assert from 'node:assert/strict';
import worker from '../src/worker.js';
test('missing access configuration fails closed even for assets',async()=>{const r=await worker.fetch(new Request('https://rpg.invalid/'),{ASSETS:{fetch:()=>new Response('private')}});assert.equal(r.status,503);assert.equal(r.headers.get('cache-control'),'no-store')});
test('spoofed Access header cannot read state',async()=>{const r=await worker.fetch(new Request('https://rpg.invalid/api/state',{headers:{'cf-access-authenticated-user-email':'allowed@example.invalid','cf-access-jwt-assertion':'fake'}}),{ACCESS_ISSUER:'https://example.cloudflareaccess.com',ACCESS_AUD:'test'});assert.equal(r.status,401)});
test('write credential cannot be absent or used as viewer access',async()=>{const r=await worker.fetch(new Request('https://rpg.invalid/api/state',{method:'PUT',body:'{}',headers:{authorization:'Bearer undefined'}}),{});assert.equal(r.status,503)});
import {viewer} from '../src/worker.js';
test('cryptographically signed assertions still reject malformed and expired claims',async()=>{
 const keys=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);const jwk=await crypto.subtle.exportKey('jwk',keys.publicKey);jwk.kid='test-key';
 const original=globalThis.fetch;globalThis.fetch=async()=>new Response(JSON.stringify({keys:[jwk]}));
 const b64=x=>Buffer.from(typeof x==='string'?x:JSON.stringify(x)).toString('base64url');const now=Math.floor(Date.now()/1000);
 try{for(const [extra,expected] of [[{},true],[{nbf:'not-a-timestamp'},false],[{nbf:now+100},false],[{exp:now-1},false],[{aud:'wrong'},false],[{iss:'https://wrong.cloudflareaccess.com'},false]]){
 const head=b64({alg:'RS256',kid:'test-key'}),body=b64({iss:'https://test.cloudflareaccess.com',aud:['aud'],iat:now,exp:now+300,...extra});const sig=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',keys.privateKey,new TextEncoder().encode(head+'.'+body));const req=new Request('https://rpg.invalid',{headers:{'cf-access-jwt-assertion':head+'.'+body+'.'+Buffer.from(sig).toString('base64url')}});assert.equal(await viewer(req,{ACCESS_ISSUER:'https://test.cloudflareaccess.com',ACCESS_AUD:'aud'}),expected);
 }}finally{globalThis.fetch=original}
});
test('registry mode denies alternate host, cross-origin issuance and viewer admin',async()=>{
 const registry={get:()=>({fetch:async()=>new Response('{}',{status:401})}),idFromName:()=>''};const env={AUTH_MODE:'registry',SITE_HOST:'rpg.invalid',REGISTRY:registry};
 assert.equal((await worker.fetch(new Request('https://other.invalid/'),env)).status,404);
 assert.equal((await worker.fetch(new Request('https://rpg.invalid/auth/issue',{method:'POST',headers:{origin:'https://evil.invalid'}}),env)).status,403);
 assert.equal((await worker.fetch(new Request('https://rpg.invalid/auth/approve',{method:'POST',headers:{origin:'https://rpg.invalid'}}),env)).status,403);
 assert.equal((await worker.fetch(new Request('https://rpg.invalid/api/state'),env)).status,401);
});
