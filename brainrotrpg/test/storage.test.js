import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {Miniflare} from './runtime.mjs';

// Exercise actual Durable Object storage, not a hand-written transaction double.
test('real Durable Object preserves history through conflicts, retries and recovery',async()=>{
 const mf=new Miniflare({modules:true,modulesRules:[{type:'ESModule',include:['**/*.js']}],scriptPath:'src/worker.js',compatibilityDate:'2026-08-06',durableObjects:{CAMPAIGN:{className:'Campaign',useSQLite:true}},unsafeEphemeralDurableObjects:true});
 try{
 const ns=await mf.getDurableObjectNamespace('CAMPAIGN'),stub=ns.get(ns.idFromName('test'));
 const snapshot=JSON.parse(await fs.readFile('public/demo.json','utf8')).snapshot;
 const write=async u=>stub.fetch('https://internal/api/state',{method:'PUT',body:JSON.stringify(u)});
 const u={updateId:'storage-one',expectedVersion:0,snapshot};assert.equal((await write(u)).status,200);
 const first=await (await stub.fetch('https://internal/api/state')).json();assert.equal(first.version,1);
 assert.equal((await write(u)).status,200);assert.equal((await write({...u,updateId:'storage-stale'})).status,409);
 const changed=structuredClone(snapshot);changed.characters[0].hp=60;
 const results=await Promise.all([write({updateId:'race-one',expectedVersion:1,snapshot:changed}),write({updateId:'race-two',expectedVersion:1,snapshot:changed})]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
 const original=await (await stub.fetch('https://internal/api/history/1')).json();assert.equal(original.snapshot.characters[0].hp,72);
 assert.equal((await write({updateId:'recover-one',expectedVersion:2,snapshot:original.snapshot})).status,200);
 const recovered=await (await stub.fetch('https://internal/api/export')).json();assert.equal(recovered.version,3);assert.equal(recovered.snapshot.characters[0].hp,72);
 assert.equal((await stub.fetch('https://internal/api/history/2')).status,200);
 }finally{await mf.dispose()}
});
test('card API is bound to explicit saved revision and renders no absent character',async()=>{
 const mf=new Miniflare({modules:true,modulesRules:[{type:'ESModule',include:['**/*.js']}],scriptPath:'src/worker.js',compatibilityDate:'2026-08-06',durableObjects:{CAMPAIGN:{className:'Campaign',useSQLite:true}},unsafeEphemeralDurableObjects:true});
 try{const ns=await mf.getDurableObjectNamespace('CAMPAIGN'),stub=ns.get(ns.idFromName('card'));const snapshot=JSON.parse(await fs.readFile('public/demo.json','utf8')).snapshot;
 await stub.fetch('https://internal/api/state',{method:'PUT',body:JSON.stringify({updateId:'card-baseline',expectedVersion:0,snapshot})});
 assert.equal((await stub.fetch('https://internal/api/cards/demo-knight.svg?version=0')).status,409);
 const r=await stub.fetch('https://internal/api/cards/demo-knight.svg?version=1');assert.equal(r.status,200);assert.match(await r.text(),/Saved revision 1/);
 assert.equal((await stub.fetch('https://internal/api/cards/nope.svg?version=1')).status,404);
 }finally{await mf.dispose()}
});
test('old exact retry returns its own original revision receipt after later updates',async()=>{
 const mf=new Miniflare({modules:true,modulesRules:[{type:'ESModule',include:['**/*.js']}],scriptPath:'src/worker.js',compatibilityDate:'2026-08-06',durableObjects:{CAMPAIGN:{className:'Campaign',useSQLite:true}},unsafeEphemeralDurableObjects:true});
 try{const ns=await mf.getDurableObjectNamespace('CAMPAIGN'),stub=ns.get(ns.idFromName('retry'));const snapshot=JSON.parse(await fs.readFile('public/demo.json','utf8')).snapshot;const u={updateId:'first-one',expectedVersion:0,snapshot};const write=async x=>(await stub.fetch('https://internal/api/state',{method:'PUT',body:JSON.stringify(x)})).json();const original=await write(u);await write({...u,updateId:'second-one',expectedVersion:1});const retry=await write(u);assert.deepEqual(retry,original);assert.equal((await (await stub.fetch('https://internal/api/state')).json()).version,2);
 }finally{await mf.dispose()}
});
