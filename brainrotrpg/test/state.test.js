import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateSnapshot, applyUpdate} from '../src/state.js';
const profile={id:'demo-knight',name:'Ash of the Hollow',classStyle:'Oathkeeper',hp:72,maxHp:100,status:'Exploring',bonuses:[],gear:['Iron axe'],inventory:[],kills:0,wins:0,location:'The sunken gate',bio:'Fictional design sample.',pendingTraits:[]};
const snapshot={characters:[profile],lore:[],rolls:[]};
test('valid game-only snapshot is accepted without coercion',()=>assert.deepEqual(validateSnapshot(snapshot),snapshot));
test('private routing fields cannot enter record',()=>assert.throws(()=>validateSnapshot({...snapshot,characters:[{...profile,phone:'+123'}]}),/field/));
test('invalid HP, duplicate keys and fake roll totals reject',()=>{
 for(const hp of [-1,101,NaN]) assert.throws(()=>validateSnapshot({...snapshot,characters:[{...profile,hp}]}));
 assert.throws(()=>validateSnapshot({...snapshot,characters:[profile,profile]}));
 assert.throws(()=>validateSnapshot({...snapshot,rolls:[{id:'r1',order:1,characterId:profile.id,dice:[20],sides:20,modifier:0,total:19,action:'Test',outcome:'Sample'}]}));
});
test('CAS, exact idempotency and conflict never silently overwrite',async()=>{
 const update={updateId:'update-one',expectedVersion:0,snapshot};
 const first=await applyUpdate(null,update,'2026-10-30T15:00:00.000Z');
 assert.equal(first.version,1); assert.deepEqual(first.snapshot,snapshot);
 assert.deepEqual(await applyUpdate(first,update,'2026-10-30T16:00:00.000Z'),first);
 await assert.rejects(applyUpdate(first,{...update,snapshot:{...snapshot,lore:[{id:'l1',title:'Hollow',text:'Sample'}]}},'now'),/reused/);
 await assert.rejects(applyUpdate(first,{...update,updateId:'update-two'},'now'),/conflict/);
});
