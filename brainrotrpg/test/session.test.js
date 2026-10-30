import {test} from 'node:test';import assert from 'node:assert/strict';import {Miniflare} from './runtime.mjs';
import {Registry} from '../src/worker.js';
const config={modules:true,modulesRules:[{type:'ESModule',include:['**/*.js']}],scriptPath:'src/worker.js',compatibilityDate:'2026-08-06',durableObjects:{REGISTRY:{className:'Registry',useSQLite:true},CAMPAIGN:{className:'Campaign',useSQLite:true}},bindings:{MEMBERSHIP_GRANT_MAX_MS:86400000},unsafeEphemeralDurableObjects:true};
test('full enrollment consumes once, rotates cookies, revokes all member sessions, rejects stale roster',async()=>{
 const mf=new Miniflare(config);try{const ns=await mf.getDurableObjectNamespace('REGISTRY'),stub=ns.get(ns.idFromName('auth'));
 const call=async(path,body)=>stub.fetch('https://internal/'+path,{method:'POST',body:JSON.stringify({...body,sourceAt:Date.now()})});
 const issued=await (await call('issue',{})).json();assert.ok(issued.secret);assert.ok(issued.challenge);assert.notEqual(issued.secret,issued.challenge);
 assert.equal((await call('check',{secret:issued.secret})).status,401);
 assert.equal((await call('approve',{challenge:issued.challenge,memberKey:'member-01',sourceMessageId:'msg-one'})).status,409);
 assert.equal((await call('member',{memberKey:'member-01',active:true,sourceMessageId:'msg-roster',validUntil:Date.now()+3600000})).status,200);
 assert.equal((await call('approve',{challenge:issued.challenge,memberKey:'member-01',sourceMessageId:'msg-one'})).status,200);
 assert.equal((await call('claim',{secret:issued.challenge})).status,401);
 const claimed=await (await call('claim',{secret:issued.secret})).json();assert.ok(claimed.secret);assert.notEqual(claimed.secret,issued.secret);
 assert.equal((await call('claim',{secret:issued.secret})).status,401);assert.equal((await call('check',{secret:issued.secret})).status,401);
 assert.equal((await call('check',{secret:claimed.secret})).status,200);
 assert.equal((await call('member',{memberKey:'member-01',active:false,sourceMessageId:'msg-left',validUntil:Date.now()+3600000})).status,200);
 assert.equal((await call('check',{secret:claimed.secret})).status,401);
 assert.equal((await call('approve',{challenge:issued.challenge,memberKey:'member-01',sourceMessageId:'msg-replay'})).status,409);
 }finally{await mf.dispose()}
});
test('Worker browser boundary keeps secrets cookie-only and blocks viewer writes/export',async()=>{
 const mf=new Miniflare({...config,bindings:{AUTH_MODE:'registry',SITE_HOST:'rpg.invalid',MEMBERSHIP_GRANT_MAX_MS:86400000,WRITE_TOKEN:'local-test-only-token-for-integration-12345'}});
 try{
 const origin='https://rpg.invalid';const send=(path,options={})=>mf.dispatchFetch(origin+path,options);
 const issued=await send('/auth/issue',{method:'POST',headers:{origin}});assert.equal(issued.status,200);const cookie=issued.headers.get('set-cookie');assert.match(cookie,/^__Host-rpg=/);assert.match(cookie,/Secure; HttpOnly; SameSite=Strict; Path=\//);const body=await issued.json();assert.equal(body.secret,undefined);
 const publicCookie=cookie.split(';')[0],service={authorization:'Bearer local-test-only-token-for-integration-12345','content-type':'application/json'};
 await send('/auth/member',{method:'POST',headers:service,body:JSON.stringify({sourceAt:Date.now(),memberKey:'member-01',active:true,sourceMessageId:'original-roster',validUntil:Date.now()+86400000-1000})});
 await send('/auth/approve',{method:'POST',headers:service,body:JSON.stringify({sourceAt:Date.now(),memberKey:'member-01',challenge:body.challenge,sourceMessageId:'original-own-code'})});
 const claim=await send('/auth/claim',{method:'POST',headers:{origin,cookie:publicCookie}});assert.equal(claim.status,200);const fresh=claim.headers.get('set-cookie').split(';')[0];assert.notEqual(fresh,publicCookie);assert.equal((await claim.json()).secret,undefined);
 assert.equal((await send('/api/export',{headers:{cookie:fresh}})).status,403);assert.equal((await send('/api/state',{method:'PUT',headers:{cookie:fresh,'content-type':'application/json'},body:'{}'})).status,403);
 assert.equal((await send('/auth/approve',{method:'POST',headers:{origin,cookie:fresh},body:'{}'})).status,403);
 assert.equal((await send('/auth/claim',{method:'POST',headers:{origin,cookie:publicCookie}})).status,401);
 }finally{await mf.dispose()}
});
test('expired member grant fails closed and daily membership refresh does not restore revoked sessions',async()=>{
 const mf=new Miniflare(config);try{const ns=await mf.getDurableObjectNamespace('REGISTRY'),stub=ns.get(ns.idFromName('expiry'));
 const call=async(path,body)=>stub.fetch('https://internal/'+path,{method:'POST',body:JSON.stringify({...body,sourceAt:Date.now()})});const issue=await (await call('issue',{})).json();
 await call('member',{memberKey:'member-01',active:true,sourceMessageId:'m1',validUntil:Date.now()+100});await call('approve',{challenge:issue.challenge,memberKey:'member-01',sourceMessageId:'m2'});const session=await (await call('claim',{secret:issue.secret})).json();
 await new Promise(r=>setTimeout(r,120));assert.equal((await call('check',{secret:session.secret})).status,401);
 await call('member',{memberKey:'member-01',active:false,sourceMessageId:'left',validUntil:Date.now()+10000});await call('member',{memberKey:'member-01',active:true,sourceMessageId:'rejoined',validUntil:Date.now()+10000});assert.equal((await call('check',{secret:session.secret})).status,401);
 }finally{await mf.dispose()}
});
test('four approvals racing to claim can create only three sessions',async()=>{
 const mf=new Miniflare(config);try{const ns=await mf.getDurableObjectNamespace('REGISTRY'),id=ns.idFromName('cap'),stub=ns.get(id);
 const call=async(path,body)=>stub.fetch('https://internal/'+path,{method:'POST',body:JSON.stringify({...body,sourceAt:Date.now()})});
 await call('member',{memberKey:'member-01',active:true,sourceMessageId:'original',validUntil:Date.now()+3600000});const issues=[];
 for(let i=0;i<4;i++){const p=await (await call('issue',{})).json();issues.push(p);assert.equal((await call('approve',{challenge:p.challenge,memberKey:'member-01',sourceMessageId:'own-'+i})).status,200)}
 const results=await Promise.all(issues.map(p=>call('claim',{secret:p.secret})));assert.equal(results.filter(r=>r.status===200).length,3);
 }finally{await mf.dispose()}
});

test('cleanup removes expired pending indexes and sessions, and preserves revoked member generation',async()=>{
 const data=new Map([['pending:expired',{digest:'old',expiresAt:0}],['pending-digest:old','expired'],['session:old',{expiresAt:0,memberKey:'member-02'}],['member:member-02',{active:true,validUntil:0,generation:0}]]);
 const tx={get:async k=>data.get(k),put:async(k,v)=>data.set(k,v),delete:async k=>data.delete(k),list:async({prefix})=>new Map([...data].filter(([k])=>k.startsWith(prefix)))};
 const registry=new Registry({storage:{transaction:fn=>fn(tx)}},{MEMBERSHIP_GRANT_MAX_MS:86400000});
 assert.equal((await registry.fetch(new Request('https://internal/issue',{method:'POST',body:'{}'}))).status,200);
 assert.equal(data.has('pending:expired'),false);assert.equal(data.has('pending-digest:old'),false);assert.equal(data.has('session:old'),false);assert.equal(data.get('member:member-02').active,false);assert.equal(data.get('member:member-02').generation,1);
});

test('trusted attestation references cannot be replayed to extend a member grant',async()=>{
 const mf=new Miniflare(config);try{const ns=await mf.getDurableObjectNamespace('REGISTRY'),stub=ns.get(ns.idFromName('provenance'));const sourceAt=Date.now(),body={memberKey:'member-01',active:true,sourceMessageId:'original-own-message',sourceAt,validUntil:sourceAt+3600000};
 const send=b=>stub.fetch('https://internal/member',{method:'POST',body:JSON.stringify(b)});assert.equal((await send(body)).status,200);assert.equal((await send({...body,validUntil:sourceAt+7200000})).status,409);assert.equal((await send({...body,sourceMessageId:'other',sourceAt:sourceAt-1})).status,409);assert.equal((await send({...body,sourceMessageId:'ancient',sourceAt:sourceAt-3600000})).status,422);
 }finally{await mf.dispose()}
});
test('an authentic source timestamp before challenge creation cannot approve that new browser',async()=>{
 const mf=new Miniflare(config);try{const ns=await mf.getDurableObjectNamespace('REGISTRY'),stub=ns.get(ns.idFromName('predating')),before=Date.now()-1000;
 const call=(path,body)=>stub.fetch('https://internal/'+path,{method:'POST',body:JSON.stringify(body)});
 await call('member',{memberKey:'member-01',active:true,sourceMessageId:'membership',sourceAt:Date.now(),validUntil:Date.now()+3600000});const p=await (await call('issue',{})).json();
 assert.equal((await call('approve',{memberKey:'member-01',challenge:p.challenge,sourceMessageId:'old-own-code',sourceAt:before})).status,409);
 assert.equal((await call('claim',{secret:p.secret})).status,401);
 }finally{await mf.dispose()}
});
