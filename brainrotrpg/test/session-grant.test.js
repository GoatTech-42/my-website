import {test} from 'node:test';import assert from 'node:assert/strict';import {Miniflare} from './runtime.mjs';
import {Registry} from '../src/worker.js';
const config={modules:true,modulesRules:[{type:'ESModule',include:['**/*.js']}],scriptPath:'src/worker.js',compatibilityDate:'2026-08-06',durableObjects:{REGISTRY:{className:'Registry',useSQLite:true},CAMPAIGN:{className:'Campaign',useSQLite:true}},bindings:{MEMBERSHIP_GRANT_MAX_MS:86400000},unsafeEphemeralDurableObjects:true};

test('scoped browser extension outlives the member grant only for the requesting session, and departure still revokes all',async()=>{
 const mf=new Miniflare(config);try{const ns=await mf.getDurableObjectNamespace('REGISTRY'),stub=ns.get(ns.idFromName('scoped'));
 const call=async(path,body)=>stub.fetch('https://internal/'+path,{method:'POST',body:JSON.stringify({...body,sourceAt:Date.now()})});
 await call('member',{memberKey:'member-01',active:true,sourceMessageId:'roster',validUntil:Date.now()+1500});
 const a=await (await call('issue',{})).json(),b=await (await call('issue',{})).json();
 assert.equal((await call('approve',{challenge:a.challenge,memberKey:'member-01',sourceMessageId:'code-a'})).status,200);
 assert.equal((await call('approve',{challenge:b.challenge,memberKey:'member-01',sourceMessageId:'code-b'})).status,200);
 const sa=await (await call('claim',{secret:a.secret})).json(),sb=await (await call('claim',{secret:b.secret})).json();
 // claim retains the approval source chain on each session
 assert.equal((await call('extend',{secret:sa.secret})).status,403); // no intent yet
 assert.equal((await call('session-grant',{memberKey:'member-01',sourceMessageId:'grant-1',approveSourceMessageId:'code-a'})).status,200);
 assert.equal((await call('extend',{secret:sb.secret})).status,403); // other browser cannot take an intent bound to code-a
 const ext=await call('extend',{secret:sa.secret});assert.equal(ext.status,200);
 assert.equal((await ext.json()).expiresAt,sa.expiresAt);
 assert.equal((await call('session-grant',{memberKey:'member-01',sourceMessageId:'grant-1'})).status,409); // source replay refused
 await new Promise(r=>setTimeout(r,1600));
 assert.equal((await call('check',{secret:sa.secret})).status,200); // extended session past the 24h member grant
 assert.equal((await call('check',{secret:sb.secret})).status,401); // plain session ended at the grant boundary
 const c=await (await call('issue',{})).json();
 assert.equal((await call('approve',{challenge:c.challenge,memberKey:'member-01',sourceMessageId:'code-c'})).status,409); // stale proof cannot approve
 assert.equal((await call('claim',{secret:c.secret})).status,401);
 await call('member',{memberKey:'member-01',active:false,sourceMessageId:'left',validUntil:Date.now()+3600000});
 assert.equal((await call('check',{secret:sa.secret})).status,401); // known departure revokes the extended session too
 }finally{await mf.dispose()}
});

test('extension is capped at the original claim cookie expiry and can never be renewed',async()=>{
 const mf=new Miniflare(config);try{const ns=await mf.getDurableObjectNamespace('REGISTRY'),stub=ns.get(ns.idFromName('cap7'));
 const call=async(path,body)=>stub.fetch('https://internal/'+path,{method:'POST',body:JSON.stringify({...body,sourceAt:Date.now()})});
 await call('member',{memberKey:'member-01',active:true,sourceMessageId:'roster',validUntil:Date.now()+3600000});
 const a=await (await call('issue',{})).json();
 await call('approve',{challenge:a.challenge,memberKey:'member-01',sourceMessageId:'code-a'});
 const sa=await (await call('claim',{secret:a.secret})).json();
 const claimTime=Date.now();
 assert.ok(sa.expiresAt<=claimTime+7*86400000);
 await call('session-grant',{memberKey:'member-01',sourceMessageId:'grant-1'});
 assert.equal((await call('extend',{secret:sa.secret})).status,200);
 await new Promise(r=>setTimeout(r,20));
 assert.equal((await call('session-grant',{memberKey:'member-01',sourceMessageId:'grant-2'})).status,200); // fresher intent accepted
 const again=await (await call('extend',{secret:sa.secret})).json();
 assert.equal(again.expiresAt,sa.expiresAt); // never now+7d, always the original claim expiry
 }finally{await mf.dispose()}
});

test('legacy session without provenance: unpinned intent binds the sole live browser, and only that browser',async()=>{
 const mf=new Miniflare(config);try{const ns=await mf.getDurableObjectNamespace('REGISTRY'),stub=ns.get(ns.idFromName('legacy'));
 const call=async(path,body)=>stub.fetch('https://internal/'+path,{method:'POST',body:JSON.stringify({...body,sourceAt:Date.now()})});
 await call('member',{memberKey:'member-01',active:true,sourceMessageId:'roster',validUntil:Date.now()+3600000});
 const a=await (await call('issue',{})).json();
 await call('approve',{challenge:a.challenge,memberKey:'member-01',sourceMessageId:'code-a'});
 const sa=await (await call('claim',{secret:a.secret})).json();
 assert.equal((await call('session-grant',{memberKey:'member-01',sourceMessageId:'grant-1'})).status,200); // exactly one live session: unambiguous
 assert.equal((await call('extend',{secret:sa.secret})).status,200);
 assert.equal((await call('extend',{secret:'x'.repeat(43)})).status,401);
 }finally{await mf.dispose()}
});

test('unpinned intent is refused while more than one live session could consume it, at grant time and at extend time',async()=>{
 const mf=new Miniflare(config);try{const ns=await mf.getDurableObjectNamespace('REGISTRY'),stub=ns.get(ns.idFromName('ambig'));
 const call=async(path,body)=>stub.fetch('https://internal/'+path,{method:'POST',body:JSON.stringify({...body,sourceAt:Date.now()})});
 await call('member',{memberKey:'member-01',active:true,sourceMessageId:'roster',validUntil:Date.now()+3600000});
 const a=await (await call('issue',{})).json(),b=await (await call('issue',{})).json();
 await call('approve',{challenge:a.challenge,memberKey:'member-01',sourceMessageId:'code-a'});
 await call('approve',{challenge:b.challenge,memberKey:'member-01',sourceMessageId:'code-b'});
 const sa=await (await call('claim',{secret:a.secret})).json(),sb=await (await call('claim',{secret:b.secret})).json();
 const grant=await call('session-grant',{memberKey:'member-01',sourceMessageId:'grant-1'});
 assert.equal(grant.status,422);assert.match((await grant.json()).error,/Ambiguous/); // two live sessions: cannot target
 // race: intent recorded while one session live, second browser claims before the tap
 await call('member',{memberKey:'member-01',active:false,sourceMessageId:'reset',validUntil:Date.now()+3600000}); // revoke both
 await call('member',{memberKey:'member-01',active:true,sourceMessageId:'roster2',validUntil:Date.now()+3600000});
 const c=await (await call('issue',{})).json();
 await call('approve',{challenge:c.challenge,memberKey:'member-01',sourceMessageId:'code-c'});
 const sc=await (await call('claim',{secret:c.secret})).json();
 assert.equal((await call('session-grant',{memberKey:'member-01',sourceMessageId:'grant-2'})).status,200); // one live session at grant time
 const d=await (await call('issue',{})).json();
 await call('approve',{challenge:d.challenge,memberKey:'member-01',sourceMessageId:'code-d'});
 await call('claim',{secret:d.secret}); // second session appears before the tap
 assert.equal((await call('extend',{secret:sc.secret})).status,403); // extend re-checks atomically and refuses
 }finally{await mf.dispose()}
});

test('service status route reports live/extended counts and intent state without exposing secrets',async()=>{
 const mf=new Miniflare(config);try{const ns=await mf.getDurableObjectNamespace('REGISTRY'),stub=ns.get(ns.idFromName('status'));
 const call=async(path,body)=>stub.fetch('https://internal/'+path,{method:'POST',body:JSON.stringify({...body,sourceAt:Date.now()})});
 const before=await (await call('sessions',{memberKey:'member-01'})).json();
 assert.deepEqual(before,{memberActive:false,validUntil:null,liveSessions:0,extendedSessions:0,latestGrantUntil:null,intentPending:false});
 await call('member',{memberKey:'member-01',active:true,sourceMessageId:'roster',validUntil:Date.now()+3600000});
 const a=await (await call('issue',{})).json();
 await call('approve',{challenge:a.challenge,memberKey:'member-01',sourceMessageId:'code-a'});
 const sa=await (await call('claim',{secret:a.secret})).json();
 await call('session-grant',{memberKey:'member-01',sourceMessageId:'grant-1'});
 const mid=await (await call('sessions',{memberKey:'member-01'})).json();
 assert.equal(mid.liveSessions,1);assert.equal(mid.extendedSessions,0);assert.equal(mid.intentPending,true);
 await call('extend',{secret:sa.secret});
 const after=await (await call('sessions',{memberKey:'member-01'})).json();
 assert.equal(after.extendedSessions,1);assert.equal(after.latestGrantUntil,sa.expiresAt);assert.equal(after.intentPending,false);
 assert.equal(after.secret,undefined);assert.equal(after.digest,undefined);
 }finally{await mf.dispose()}
});

test('sweep keeps the member record active only while a live extended session exists',async()=>{
 const now=Date.now();
 const data=new Map([
  ['member:member-01',{active:true,validUntil:now-1,generation:0}],
  ['session:extended',{memberKey:'member-01',generation:0,expiresAt:now+10000,grantUntil:now+10000}],
  ['session:plain',{memberKey:'member-01',generation:0,expiresAt:now+10000}],
  ['member:member-02',{active:true,validUntil:now-1,generation:3}],
  ['session:other',{memberKey:'member-02',generation:3,expiresAt:now+10000}]
 ]);
 const tx={get:async k=>data.get(k),put:async(k,v)=>data.set(k,v),delete:async k=>data.delete(k),list:async({prefix})=>new Map([...data].filter(([k])=>k.startsWith(prefix)))};
 const registry=new Registry({storage:{transaction:fn=>fn(tx)}},{MEMBERSHIP_GRANT_MAX_MS:86400000});
 assert.equal((await registry.fetch(new Request('https://internal/issue',{method:'POST',body:'{}'}))).status,200);
 assert.equal(data.get('member:member-01').active,true);assert.equal(data.get('member:member-01').generation,0); // grace, no tombstone
 assert.equal(data.has('session:extended'),true);assert.equal(data.has('session:plain'),false); // plain session still dies at the grant boundary
 assert.equal(data.get('member:member-02').active,false);assert.equal(data.get('member:member-02').generation,4);assert.equal(data.has('session:other'),false);
 data.get('session:extended').grantUntil=now-1; // extension lapsed
 assert.equal((await registry.fetch(new Request('https://internal/issue',{method:'POST',body:'{}'}))).status,200);
 assert.equal(data.get('member:member-01').active,false);assert.equal(data.get('member:member-01').generation,1);assert.equal(data.has('session:extended'),false);
});

test('Worker boundary: session-grant is service-only, extend binds through the HttpOnly cookie, claim response keeps provenance server-side',async()=>{
 const mf=new Miniflare({...config,bindings:{AUTH_MODE:'registry',SITE_HOST:'rpg.invalid',MEMBERSHIP_GRANT_MAX_MS:86400000,WRITE_TOKEN:'local-test-only-token-for-integration-12345'}});
 try{
 const origin='https://rpg.invalid';const send=(path,options={})=>mf.dispatchFetch(origin+path,options);
 const service={authorization:'Bearer local-test-only-token-for-integration-12345','content-type':'application/json'};
 assert.equal((await send('/auth/session-grant',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({memberKey:'member-01',sourceMessageId:'x',sourceAt:Date.now()})})).status,403);
 assert.equal((await send('/auth/sessions',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({memberKey:'member-01'})})).status,403); // status is service-only too
 const issued=await send('/auth/issue',{method:'POST',headers:{origin}});const cookie=issued.headers.get('set-cookie').split(';')[0];const body=await issued.json();
 await send('/auth/member',{method:'POST',headers:service,body:JSON.stringify({sourceAt:Date.now(),memberKey:'member-01',active:true,sourceMessageId:'roster',validUntil:Date.now()+3600000})});
 await send('/auth/approve',{method:'POST',headers:service,body:JSON.stringify({sourceAt:Date.now(),memberKey:'member-01',challenge:body.challenge,sourceMessageId:'code'})});
 const claim=await send('/auth/claim',{method:'POST',headers:{origin,cookie}});assert.equal(claim.status,200);const fresh=claim.headers.get('set-cookie').split(';')[0];
 assert.equal((await claim.json()).challenge,undefined); // provenance is never exposed to the browser
 assert.equal((await send('/auth/extend',{method:'POST',headers:{origin,cookie:fresh}})).status,401); // no grant recorded yet
 await send('/auth/session-grant',{method:'POST',headers:service,body:JSON.stringify({sourceAt:Date.now(),memberKey:'member-01',sourceMessageId:'grant',approveSourceMessageId:'code'})});
 const ext=await send('/auth/extend',{method:'POST',headers:{origin,cookie:fresh}});assert.equal(ext.status,200);
 assert.ok((await ext.json()).expiresAt>Date.now());
 assert.equal((await send('/auth/extend',{method:'POST',headers:{origin:'https://evil.invalid',cookie:fresh}})).status,403); // cross-origin call blocked
 }finally{await mf.dispose()}
});


test('public browser proof binds the extension to exactly the proving session among several legacy sessions',async()=>{
 const mf=new Miniflare(config);try{const ns=await mf.getDurableObjectNamespace('REGISTRY'),stub=ns.get(ns.idFromName('proof'));
 const call=async(path,body)=>stub.fetch('https://internal/'+path,{method:'POST',body:JSON.stringify({...body,sourceAt:Date.now()})});
 await call('member',{memberKey:'member-01',active:true,sourceMessageId:'roster',validUntil:Date.now()+3600000});
 const a=await (await call('issue',{})).json(),b=await (await call('issue',{})).json();
 await call('approve',{challenge:a.challenge,memberKey:'member-01',sourceMessageId:'code-a'});
 await call('approve',{challenge:b.challenge,memberKey:'member-01',sourceMessageId:'code-b'});
 const sa=await (await call('claim',{secret:a.secret})).json(),sb=await (await call('claim',{secret:b.secret})).json();
 // only an admitted browser can mint a proof
 assert.equal((await call('proof',{secret:'x'.repeat(43)})).status,401);
 const pf=await call('proof',{secret:sb.secret});assert.equal(pf.status,200);
 const {nonce}=await pf.json();assert.equal(nonce.length,22);assert.notEqual(nonce,sb.secret);
 // the human posts the nonce in the group; the service attests that post and pins the intent to the proving session
 assert.equal((await call('session-grant',{memberKey:'member-01',sourceMessageId:'proof-post',proofNonce:nonce})).status,200);
 assert.equal((await call('extend',{secret:sa.secret})).status,403); // the other legacy browser is NOT the prover
 assert.equal((await call('extend',{secret:sb.secret})).status,200); // exact session binds at its original expiry
 const st=await (await call('sessions',{memberKey:'member-01'})).json();assert.equal(st.extendedSessions,1);
 assert.equal((await call('session-grant',{memberKey:'member-01',sourceMessageId:'proof-post',proofNonce:nonce})).status,409); // source replay
 assert.equal((await call('session-grant',{memberKey:'member-01',sourceMessageId:'proof-post-2',proofNonce:nonce})).status,422); // proof consumed
 assert.equal((await call('session-grant',{memberKey:'member-01',sourceMessageId:'proof-post-3',proofNonce:'A'.repeat(22)})).status,422); // unknown proof
 }finally{await mf.dispose()}
});

test('proof cannot be minted after revocation and is capped per member',async()=>{
 const mf=new Miniflare(config);try{const ns=await mf.getDurableObjectNamespace('REGISTRY'),stub=ns.get(ns.idFromName('proofcap'));
 const call=async(path,body)=>stub.fetch('https://internal/'+path,{method:'POST',body:JSON.stringify({...body,sourceAt:Date.now()})});
 await call('member',{memberKey:'member-01',active:true,sourceMessageId:'roster',validUntil:Date.now()+3600000});
 const a=await (await call('issue',{})).json();
 await call('approve',{challenge:a.challenge,memberKey:'member-01',sourceMessageId:'code-a'});
 const sa=await (await call('claim',{secret:a.secret})).json();
 for(let i=0;i<3;i++)assert.equal((await call('proof',{secret:sa.secret})).status,200);
 assert.equal((await call('proof',{secret:sa.secret})).status,429); // cap
 await call('member',{memberKey:'member-01',active:false,sourceMessageId:'left',validUntil:Date.now()+3600000});
 assert.equal((await call('proof',{secret:sa.secret})).status,401); // revoked member cannot mint
 }finally{await mf.dispose()}
});

test('Worker boundary: /auth/proof is cookie-bound, returns only the public nonce, and blocks cross-origin',async()=>{
 const mf=new Miniflare({...config,bindings:{AUTH_MODE:'registry',SITE_HOST:'rpg.invalid',MEMBERSHIP_GRANT_MAX_MS:86400000,WRITE_TOKEN:'local-test-only-token-for-integration-12345'}});
 try{
 const origin='https://rpg.invalid';const send=(path,options={})=>mf.dispatchFetch(origin+path,options);
 const service={authorization:'Bearer local-test-only-token-for-integration-12345','content-type':'application/json'};
 assert.equal((await send('/auth/proof',{method:'POST',headers:{origin}})).status,401); // signed-out browser
 const issued=await send('/auth/issue',{method:'POST',headers:{origin}});const cookie=issued.headers.get('set-cookie').split(';')[0];const body=await issued.json();
 await send('/auth/member',{method:'POST',headers:service,body:JSON.stringify({sourceAt:Date.now(),memberKey:'member-01',active:true,sourceMessageId:'roster',validUntil:Date.now()+3600000})});
 await send('/auth/approve',{method:'POST',headers:service,body:JSON.stringify({sourceAt:Date.now(),memberKey:'member-01',challenge:body.challenge,sourceMessageId:'code'})});
 const claim=await send('/auth/claim',{method:'POST',headers:{origin,cookie}});const fresh=claim.headers.get('set-cookie').split(';')[0];
 const pf=await send('/auth/proof',{method:'POST',headers:{origin,cookie:fresh}});assert.equal(pf.status,200);
 const pfBody=await pf.json();assert.equal(pfBody.nonce.length,22);assert.equal(pfBody.secret,undefined);assert.equal(pfBody.digest,undefined);
 assert.equal((await send('/auth/proof',{method:'POST',headers:{origin:'https://evil.invalid',cookie:fresh}})).status,403);
 // grant pinned by that proof, then the same browser extends
 await send('/auth/session-grant',{method:'POST',headers:service,body:JSON.stringify({sourceAt:Date.now(),memberKey:'member-01',sourceMessageId:'proof-post',proofNonce:pfBody.nonce})});
 assert.equal((await send('/auth/extend',{method:'POST',headers:{origin,cookie:fresh}})).status,200);
 }finally{await mf.dispose()}
});
