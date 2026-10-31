import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cardSvg} from '../src/card.js';
const rec={version:9,savedAt:'2026-10-31T18:00:00.000Z'};
const base={name:'Ash',classStyle:'Oathkeeper',hp:72,maxHp:100,status:'Exploring',location:'The sunken gate'};

test('card without stats keeps the 720px layout and no stats line',()=>{
 const svg=cardSvg(base,rec);
 assert.match(svg,/height="720" viewBox="0 0 1080 720"/);
 assert.ok(!svg.includes('Deaths'));
});
test('card with stats grows to 800px and shows counters, question mark for unknown',()=>{
 const svg=cardSvg({...base,stats:{deaths:0,damageDealt:120,damageTaken:null,healing:75}},rec);
 assert.match(svg,/height="800" viewBox="0 0 1080 800"/);
 assert.match(svg,/Deaths 0 \u00b7 Dmg 120 dealt \/ \? taken \u00b7 Healed 75/);
});
test('all-null stats still render as explicit unknowns',()=>{
 const svg=cardSvg({...base,stats:{deaths:null,damageDealt:null,damageTaken:null,healing:null}},rec);
 assert.match(svg,/Deaths \?/);
});
test('card header uses snapshot title when present, default branding otherwise',()=>{
 const withTitle=cardSvg(base,{...rec,snapshot:{title:'PvP Lobby'}});
 assert.match(withTitle,/>PvP Lobby \/ Character status</);
 assert.ok(!withTitle.includes('Brainrot RPG / Character status'));
 const plain=cardSvg(base,rec);
 assert.match(plain,/>Brainrot RPG \/ Character status</);
});
