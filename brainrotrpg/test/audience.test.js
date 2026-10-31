import {test} from 'node:test';import assert from 'node:assert/strict';import {Miniflare} from './runtime.mjs';
const config={modules:true,modulesRules:[{type:'ESModule',include:['**/*.js']}],scriptPath:'src/worker.js',compatibilityDate:'2026-08-06',durableObjects:{REGISTRY:{className:'Registry',useSQLite:true},CAMPAIGN:{className:'Campaign',useSQLite:true}},bindings:{MEMBERSHIP_GRANT_MAX_MS:86400000},unsafeEphemeralDurableObjects:true};
const setup=name=>new Miniflare(config);
const mk=async (mf,name)=>{const ns=await mf.getDurableObjectNamespace('REGISTRY'),stub=ns.get(ns.idFromName(name));return (path,body)=>stub.fetch('https://internal/'+path,{method:'POST',body:JSON.stringify({sourceAt:Date.now(),...body})})};

test('audience flip closes other-audience sessions and claims fail closed per audience',async()=>{
 const mf=setup();try{const call=await mk(mf,'aud-flip');
 await call('member',{memberKey:'member-01',active:true,sourceMessageId:'roster-a',validUntil:Date.now()+3600000});
 await call('member',{memberKey:'member-02',active:true,sourceMessageId:'roster-b',validUntil:Date.now()+3600000,audience:'lobby'});
 const a=await (await call('issue',{})).json(),b=await (await call('issue',{})).json();
 await call('approve',{challenge:a.challenge,memberKey:'member-01',sourceMessageId:'code-a'});
 await call('approve',{challenge:b.challenge,memberKey:'member-02',sourceMessageId:'code-b'});
 const sa=await (await call('claim',{secret:a.secret})).json();
 // lobby member cannot claim while the current audience is brainrot
 assert.equal((await call('claim',{secret:b.secret})).status,401);
 assert.equal((await call('check',{secret:sa.secret})).status,200);
 const flip=await (await call('audience',{audience:'lobby'})).json();
 assert.equal(flip.ok,true);assert.equal(flip.invalidatedSessions,1);
 // old brainrot session fails closed immediately after the flip
 assert.equal((await call('check',{secret:sa.secret})).status,401);
 // lobby member can now enroll
 const c=await (await call('issue',{})).json();
 await call('approve',{challenge:c.challenge,memberKey:'member-02',sourceMessageId:'code-c'});
 assert.equal((await call('claim',{secret:c.secret})).status,200);
 // flipping back invalidates the lobby session too
 const back=await (await call('audience',{audience:'brainrot'})).json();
 assert.equal(back.invalidatedSessions,1);
 assert.equal((await call('check',{secret:c.secret})).status,401);
 }finally{await mf.dispose()}
});

test('audience route validates its input',async()=>{
 const mf=setup();try{const call=await mk(mf,'aud-bad');
 for(const audience of ['', 'Brainrot', 'a'.repeat(33), 'two words', 7, null])
  assert.equal((await call('audience',{audience})).status,422);
 assert.equal((await call('audience',{audience:'brainrot'})).status,422); // no-op flip refused
 }finally{await mf.dispose()}
});

test('owner-side revoke tombstones the member and ends every session, no attestation',async()=>{
 const mf=setup();try{const call=await mk(mf,'aud-revoke');
 await call('member',{memberKey:'member-01',active:true,sourceMessageId:'roster',validUntil:Date.now()+3600000});
 const a=await (await call('issue',{})).json();
 await call('approve',{challenge:a.challenge,memberKey:'member-01',sourceMessageId:'code-a'});
 const sa=await (await call('claim',{secret:a.secret})).json();
 assert.equal((await call('check',{secret:sa.secret})).status,200);
 const r=await (await call('revoke',{memberKey:'member-01'})).json();
 assert.deepEqual(r,{ok:true,memberKey:'member-01',removedSessions:1});
 assert.equal((await call('check',{secret:sa.secret})).status,401);
 // a later roster attestation cannot silently resurrect the tombstoned generation
 const b=await (await call('issue',{})).json();
 await call('member',{memberKey:'member-01',active:true,sourceMessageId:'roster-2',validUntil:Date.now()+3600000});
 assert.equal((await call('check',{secret:sa.secret})).status,401); // old secret stays dead
 await call('approve',{challenge:b.challenge,memberKey:'member-01',sourceMessageId:'code-b'});
 assert.equal((await call('claim',{secret:b.secret})).status,200); // fresh enrollment still possible
 assert.equal((await call('revoke',{memberKey:'member-99'})).status,404);
 assert.equal((await call('revoke',{memberKey:'bogus'})).status,422);
 }finally{await mf.dispose()}
});

test('default behavior without any audience setup is unchanged',async()=>{
 const mf=setup();try{const call=await mk(mf,'aud-default');
 await call('member',{memberKey:'member-01',active:true,sourceMessageId:'roster',validUntil:Date.now()+3600000});
 const a=await (await call('issue',{})).json();
 await call('approve',{challenge:a.challenge,memberKey:'member-01',sourceMessageId:'code-a'});
 const sa=await (await call('claim',{secret:a.secret})).json();
 assert.equal((await call('check',{secret:sa.secret})).status,200);
 const s=await (await call('sessions',{memberKey:'member-01',sourceMessageId:'q'})).json();
 assert.equal(s.liveSessions,1);
 }finally{await mf.dispose()}
});
