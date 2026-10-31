import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {Miniflare} from './runtime.mjs';
import {renderCard} from '../render-card.mjs';
const config=()=>({modules:true,modulesRules:[{type:'ESModule',include:['**/*.js']}],scriptPath:'src/worker.js',compatibilityDate:'2026-08-06',durableObjects:{CAMPAIGN:{className:'Campaign',useSQLite:true}},unsafeEphemeralDurableObjects:true});
const demo=async()=>JSON.parse(await fs.readFile('public/demo.json','utf8')).snapshot;
test('map API returns recorded world map bound to saved revision',async()=>{
 const mf=new Miniflare(config());try{
  const ns=await mf.getDurableObjectNamespace('CAMPAIGN'),stub=ns.get(ns.idFromName('map-api'));
  assert.equal((await stub.fetch('https://internal/api/map')).status,404);
  const snapshot=await demo();
  assert.equal((await stub.fetch('https://internal/api/state',{method:'PUT',body:JSON.stringify({updateId:'map-base',expectedVersion:0,snapshot})})).status,200);
  const r=await stub.fetch('https://internal/api/map');assert.equal(r.status,200);
  const body=await r.json();assert.equal(body.version,1);assert.deepEqual(body.worldMap,snapshot.worldMap);
 }finally{await mf.dispose()}
});
test('boss image is revision-bound, deterministic and passes the inert PNG renderer',async()=>{
 const mf=new Miniflare(config());try{
  const ns=await mf.getDurableObjectNamespace('CAMPAIGN'),stub=ns.get(ns.idFromName('boss-art'));
  await stub.fetch('https://internal/api/state',{method:'PUT',body:JSON.stringify({updateId:'boss-base',expectedVersion:0,snapshot:await demo()})});
  assert.equal((await stub.fetch('https://internal/api/map/bosses/boss-bell-warden.svg?version=0')).status,409);
  assert.equal((await stub.fetch('https://internal/api/map/bosses/nope.svg?version=1')).status,404);
  const r=await stub.fetch('https://internal/api/map/bosses/boss-silt-serpent.svg?version=1');assert.equal(r.status,200);
  assert.equal(r.headers.get('content-type'),'image/svg+xml');
  const svg=await r.text();assert.match(svg,/Defeated/);assert.match(svg,/Saved revision 1/);assert.ok(svg.includes('Saved revision 1 /'),'executor revision-marker contract');assert.ok(!svg.includes('<script'));
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'rpg-boss-'));
  try{const inp=path.join(dir,'b.svg'),out=path.join(dir,'b.png');await fs.writeFile(inp,svg);await renderCard(inp,out);assert.ok((await fs.stat(out)).size>1000)}
  finally{await fs.rm(dir,{recursive:true,force:true})}
 }finally{await mf.dispose()}
});
test('old snapshots without a world map report an empty map, not an error',async()=>{
 const mf=new Miniflare(config());try{
  const ns=await mf.getDurableObjectNamespace('CAMPAIGN'),stub=ns.get(ns.idFromName('map-empty'));
  await stub.fetch('https://internal/api/state',{method:'PUT',body:JSON.stringify({updateId:'plain',expectedVersion:0,snapshot:{characters:[],lore:[],rolls:[]}})});
  const body=await (await stub.fetch('https://internal/api/map')).json();
  assert.equal(body.version,1);assert.equal(body.worldMap,null);
 }finally{await mf.dispose()}
});
