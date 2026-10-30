import {test} from 'node:test';import assert from 'node:assert/strict';import sharp from 'sharp';import fs from 'node:fs/promises';import {cardSvg,eventCardSvg} from '../src/card.js';
// Test actual librsvg font ink, not browser font estimates or character counts.
async function check(svg){for(const text of svg.match(/<text\b[^>]*>[\s\S]*?<\/text>/g)||[]){const plain=text.replace(/fill="[^"]*"/g,'fill="#000000"');const source=`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350"><rect width="1080" height="1350" fill="#ffffff"/>${plain}</svg>`;const {data,info}=await sharp(Buffer.from(source)).removeAlpha().raw().toBuffer({resolveWithObject:true});let max=-1;for(let y=0;y<info.height;y++)for(let x=0;x<1080;x++){const i=(y*1080+x)*3;if(data[i]<128&&data[i+1]<128&&data[i+2]<128)max=Math.max(max,x)}assert.ok(max<=1032,`Ink crosses right margin at ${max}: ${text.slice(0,150)}`)}}
test('actual PNG text ink fits worst wide names, unicode, max dice math and largest HP',async()=>{
 const record={version:Number.MAX_SAFE_INTEGER,savedAt:'2026-10-30T15:00:00.000Z'};
 for(const name of ['W'.repeat(100),'Bartholomew'.repeat(9),'界'.repeat(100),'🧙'.repeat(50)])await check(cardSvg({name,classStyle:'M'.repeat(100),hp:100000,maxHp:100000,status:'W'.repeat(500),location:'界'.repeat(100)},record));
 const r={action:'W'.repeat(300),dice:Array(20).fill(1000),modifier:1000,total:21000,sides:1000,difficulty:100000,outcome:'界'.repeat(2000)};const svg=eventCardSvg(r,record);await check(svg);await fs.writeFile('/tmp/rpg-max-event.svg',svg);
});
