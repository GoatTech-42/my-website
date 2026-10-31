import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateSnapshot} from '../src/state.js';
const base={id:'demo-knight',name:'Ash of the Hollow',classStyle:'Oathkeeper',hp:72,maxHp:100,status:'Exploring',bonuses:[],gear:[],inventory:[],kills:0,wins:0,location:'The sunken gate',bio:'Fictional design sample.',pendingTraits:[]};
const snap=c=>({characters:[c],lore:[],rolls:[]});

test('characters without stats validate unchanged',()=>{
 const s=snap(base);assert.deepEqual(validateSnapshot(s),s);
});
test('nullable counters accept null (unknown) and real zeros, preserved exactly',()=>{
 const c={...base,stats:{deaths:0,damageDealt:120,damageTaken:null,healing:75}};
 const out=validateSnapshot(snap(c));
 assert.deepEqual(out.characters[0].stats,{deaths:0,damageDealt:120,damageTaken:null,healing:75});
});
test('stats reject bad types, ranges, unknown keys and non-objects',()=>{
 for(const stats of [
  'none',42,[1,2],
  {deaths:-1},{deaths:1.5},{deaths:'1'},{damageDealt:100001},
  {deaths:0,stealth:3},{},
 ])assert.throws(()=>validateSnapshot(snap({...base,stats})),/field|integer|object/i);
});
test('optional campaign title validates and is preserved; bad titles reject',()=>{
 const s={...snap(base),title:'PvP Lobby'};
 assert.deepEqual(validateSnapshot(s),s);
 assert.throws(()=>validateSnapshot({...snap(base),title:'x'.repeat(101)}));
 assert.throws(()=>validateSnapshot({...snap(base),title:42}));
});
