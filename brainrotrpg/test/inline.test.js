import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
test('binary inline transport preserves fail-closed auth; exact module graph includes no campaign data',async()=>{
 const modules=['inline-worker.js','inline-assets.js','worker.js','card.js','boss-art.js','enrollment.js','state.js','import.js'].map(n=>({type:'ESModule',path:'src/'+n}));modules.push({type:'Data',path:'public/assets/golden.webp'});
 const mf=new Miniflare(convertV4MiniflareOptions({modules,compatibilityDate:'2026-08-06'}));try{for(const p of ['/','/app.js','/map.js','/assets/golden.webp','/api/state','/auth/','/demo.json'])assert.equal((await mf.dispatchFetch('https://dark.invalid'+p)).status,503)}finally{await mf.dispose()}
});
