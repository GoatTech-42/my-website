import {test} from 'node:test';import assert from 'node:assert/strict';import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
// Catches qualification requests reaching the production Campaign singleton.
test('qualification mode routes state to a distinct object without touching production history',async()=>{
 const mf=new Miniflare(convertV4MiniflareOptions({modules:['worker.js','state.js','card.js','boss-art.js','enrollment.js','import.js'].map(n=>({type:'ESModule',path:'src/'+n})),compatibilityDate:'2026-08-06',bindings:{RECORD_SET:'qualification-20261030',AUTH_MODE:'registry',SITE_HOST:'rpg.invalid',WRITE_TOKEN:'fixture-only-test-token-12345678901234567890'},durableObjects:{CAMPAIGN:{className:'Campaign',useSQLite:true},REGISTRY:{className:'Registry',useSQLite:true}},unsafeEphemeralDurableObjects:true}));try{
 const env=await mf.getBindings(),ns=env.CAMPAIGN;
 const snapshot={characters:[],lore:[],rolls:[]};const qa=ns.get(ns.idFromName('brainrot-qualification-20261030'));await qa.fetch('https://internal/api/state',{method:'PUT',body:JSON.stringify({updateId:'qa-only-001',expectedVersion:0,snapshot})});
 const r=await mf.dispatchFetch('https://rpg.invalid/api/state',{headers:{authorization:'Bearer fixture-only-test-token-12345678901234567890'}});assert.equal(r.status,200);assert.equal((await r.json()).version,1);
 assert.equal((await ns.get(ns.idFromName('brainrot-main')).fetch('https://internal/api/state')).status,404);assert.equal((await ns.get(ns.idFromName('brainrot-main')).fetch('https://internal/api/history/1')).status,404);
 }finally{await mf.dispose()}
});
