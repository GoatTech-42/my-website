import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateSnapshot, applyUpdate} from '../src/state.js';
const character={id:'char-one',name:'Example Knight',classStyle:'Oathkeeper',hp:10,maxHp:10,status:'Idle',bonuses:[],gear:[],inventory:[],kills:0,wins:0,location:'Unset',bio:'Sample.',pendingTraits:[]};
const loreEntry={id:'lore-gate',title:'The Gate',text:'Sample lore.'};
const fullMap={landmarks:[{id:'lm-gate',name:'The Hollow Gate',kind:'ruin',x:120.5,y:640,summary:'A black stone door.',loreId:'lore-gate'}],party:{status:'formed',characterIds:['char-one'],x:130,y:650,label:'At the gate'},bosses:[{id:'boss-warden',name:'The Bell Warden',state:'active',x:122,y:648,summary:'It rings twice.',loreId:'lore-gate'},{id:'boss-serpent',name:'Silt Serpent',state:'defeated',x:400,y:200,summary:'Defeated sample.',defeatedBy:['char-one'],defeatedAt:'2026-10-30T14:00:00Z'}]};
const snapshot={characters:[character],lore:[loreEntry],rolls:[],worldMap:fullMap};
test('a complete valid world map extension is accepted unchanged',()=>assert.deepEqual(validateSnapshot(structuredClone(snapshot)),snapshot));
test('snapshots without the optional world map stay valid (backward compatibility)',()=>{
 const old={characters:[character],lore:[],rolls:[],world:{zones_discovered:0,world_bosses_active:0,faction_territories_claimed:0,active_bounties:0,map:'UNEXPLORED'}};
 assert.deepEqual(validateSnapshot(old),old);
 assert.deepEqual(validateSnapshot({characters:[],lore:[],rolls:[]}),{characters:[],lore:[],rolls:[]});
});
test('unknown fields, bad enums, coordinates and references reject deliberately',()=>{
 const bad=fn=>assert.throws(fn);
 bad(()=>validateSnapshot({...structuredClone(snapshot),worldMap:{...fullMap,secret:1}}));
 bad(()=>validateSnapshot({characters:[],lore:[],rolls:[],worldMap:{landmarks:[],party:{status:'unformed',characterIds:[]},bosses:[],terrain:{}}}));
 for(const kind of ['castle','BOSS',''])bad(()=>validateSnapshot({characters:[],lore:[],rolls:[],worldMap:{landmarks:[{id:'a',name:'A',kind,x:1,y:1,summary:'s'}],party:{status:'unformed',characterIds:[]},bosses:[]}}));
 for(const x of [-1,1001,NaN,Infinity,'12'])bad(()=>validateSnapshot({characters:[],lore:[],rolls:[],worldMap:{landmarks:[{id:'a',name:'A',kind:'ruin',x,y:1,summary:'s'}],party:{status:'unformed',characterIds:[]},bosses:[]}}));
 bad(()=>validateSnapshot({characters:[],lore:[],rolls:[],worldMap:{landmarks:[{id:'a',name:'A',kind:'ruin',x:1,y:1,summary:'s',loreId:'missing'}],party:{status:'unformed',characterIds:[]},bosses:[]}}));
 bad(()=>validateSnapshot({characters:[],lore:[],rolls:[],worldMap:{landmarks:[],party:{status:'formed',characterIds:['ghost']},bosses:[]}}));
 bad(()=>validateSnapshot({characters:[],lore:[],rolls:[],worldMap:{landmarks:[],party:{status:'formed',characterIds:[],x:5},bosses:[]}}));
 bad(()=>validateSnapshot({characters:[],lore:[],rolls:[],worldMap:{landmarks:[],party:{status:'party',characterIds:[]},bosses:[]}}));
 bad(()=>validateSnapshot({characters:[character],lore:[],rolls:[],worldMap:{landmarks:[],party:{status:'unformed',characterIds:[]},bosses:[{id:'b',name:'B',state:'sleeping',x:1,y:1,summary:'s'}]}}));
 bad(()=>validateSnapshot({characters:[],lore:[],rolls:[],worldMap:{landmarks:[],party:{status:'unformed',characterIds:[]},bosses:[{id:'b',name:'B',state:'defeated',x:1,y:1,summary:'s',defeatedBy:['ghost']}]}}));
 bad(()=>validateSnapshot({characters:[],lore:[],rolls:[],worldMap:{landmarks:[{id:'same',name:'A',kind:'ruin',x:1,y:1,summary:'s'}],party:{status:'unformed',characterIds:[]},bosses:[{id:'same',name:'B',state:'active',x:2,y:2,summary:'s'}]}}));
});
test('world map flows through the same CAS, idempotency, conflict and history path',async()=>{
 const update={updateId:'map-one',expectedVersion:0,snapshot:structuredClone(snapshot)};
 const first=await applyUpdate(null,update,'2026-10-30T15:00:00.000Z');
 assert.equal(first.version,1);assert.deepEqual(first.snapshot.worldMap,fullMap);
 assert.deepEqual(await applyUpdate(first,update,'2026-10-30T16:00:00.000Z'),first);
 const moved=structuredClone(snapshot);moved.worldMap.party.x=140;
 const second=await applyUpdate(first,{updateId:'map-two',expectedVersion:1,snapshot:moved},'2026-10-30T17:00:00.000Z');
 assert.equal(second.version,2);assert.equal(second.snapshot.worldMap.party.x,140);
 await assert.rejects(applyUpdate(second,{updateId:'map-three',expectedVersion:1,snapshot:moved},'now'),/conflict/);
});

test('explored regions: strict validation, fog rendering inputs stay canonical',()=>{
 const base={characters:[],lore:[],rolls:[]};
 const region={id:'ex-gate',x:100,y:200,radius:150,biome:'meadow'};
 const ok={...base,worldMap:{landmarks:[],party:{status:'unformed',characterIds:[]},bosses:[],explored:[region]}};
 assert.deepEqual(validateSnapshot(structuredClone(ok)),ok);
 for(const biome of ['lava','grass',''])assert.throws(()=>validateSnapshot({...base,worldMap:{landmarks:[],party:{status:'unformed',characterIds:[]},bosses:[],explored:[{...region,biome}]}}),/biome|field/);
 assert.throws(()=>validateSnapshot({...base,worldMap:{landmarks:[],party:{status:'unformed',characterIds:[]},bosses:[],explored:[{...region,radius:0}]}}));
 assert.throws(()=>validateSnapshot({...base,worldMap:{landmarks:[],party:{status:'unformed',characterIds:[]},bosses:[],explored:[{...region,secret:1}]}}));
 assert.throws(()=>validateSnapshot({...base,worldMap:{landmarks:[],party:{status:'unformed',characterIds:[]},bosses:[],explored:[region,region]}}));
});
