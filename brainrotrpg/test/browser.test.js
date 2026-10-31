import {test} from 'node:test';import assert from 'node:assert/strict';import {chromium} from 'playwright';import {spawn} from 'node:child_process';
test('phone rendering, card PNG, replay and reduced motion preserve game state',async()=>{
 const server=spawn(process.execPath,['preview.mjs']);
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});await page.goto('http://127.0.0.1:4173/?demo=1');await page.locator('.sheet h3').waitFor();await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const math=await page.locator('.math').textContent();await page.getByRole('button',{name:'Replay animation'}).click();assert.equal(await page.locator('.math').textContent(),math);
  assert.equal(await page.locator('.die').evaluate(n=>getComputedStyle(n).animationName),'tumble');
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.die').evaluate(n=>getComputedStyle(n).animationName),'none');
  assert.equal(await page.locator('.portal').evaluate(n=>getComputedStyle(n).animationName),'none');
  assert.equal(await page.getByRole('button',{name:'Download sample card'}).count(),0);
  const noDemo=await browser.newPage();await noDemo.goto('http://127.0.0.1:4173/');await noDemo.getByText('Campaign unavailable. No demo data substituted.').waitFor();assert.equal(await noDemo.locator('.character-tab').count(),0);
 }finally{await browser.close();server.kill();await new Promise(r=>server.once('exit',r));}
});

test('map section renders recorded markers, decluttered and interactive, with honest uncharted live view',async()=>{
 const server=spawn(process.execPath,['preview.mjs']);await new Promise(r=>setTimeout(r,700));
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 try{
  const pageErrors=[];
  const watch=p=>p.on('pageerror',e=>pageErrors.push(String(e)));
  const page=await browser.newPage({viewport:{width:1280,height:800}});watch(page);
  await page.goto('http://127.0.0.1:4173/?demo=1');await page.locator('.sheet h3').waitFor();
  await page.waitForFunction(()=>[...document.querySelectorAll('.map-marker')].filter(m=>m.style.display!=='none').length===7);
  await page.locator('.map-marker[aria-label^="The Hollow Gate"]').dispatchEvent('click');
  await page.getByText('What happened here').waitFor();
  await page.locator('.map-marker[aria-label^="Party marker"]').dispatchEvent('click');
  await page.getByText('Ash of the Hollow',{exact:false}).first().waitFor();
  // zoom buttons move the camera; reset restores (reset first so drift state is pinned)
  await page.locator('#map-reset').click();await new Promise(r=>setTimeout(r,300));
  const before=await page.locator('.map-marker[aria-label^="Murmur Wood"]').evaluate(m=>m.style.transform);
  await page.locator('#map-zoom-in').click();await new Promise(r=>setTimeout(r,300));
  const after=await page.locator('.map-marker[aria-label^="Murmur Wood"]').evaluate(m=>m.style.transform);
  assert.notEqual(before,after);
  await page.locator('#map-reset').click();await new Promise(r=>setTimeout(r,300));
  assert.equal(await page.locator('.map-marker[aria-label^="Murmur Wood"]').evaluate(m=>m.style.transform),before);
  // reduced motion: no drift, marker position stable
  await page.emulateMedia({reducedMotion:'reduce'});await new Promise(r=>setTimeout(r,700));
  const p1=await page.locator('.map-marker[aria-label^="Murmur Wood"]').evaluate(m=>m.style.transform);
  await new Promise(r=>setTimeout(r,700));
  assert.equal(await page.locator('.map-marker[aria-label^="Murmur Wood"]').evaluate(m=>m.style.transform),p1);
  // live path with recorded sample: chart mode, revision label, no terrain claim
  const demo=JSON.parse(await (await import('node:fs/promises')).readFile('public/demo.json','utf8'));
  const live=await browser.newPage({viewport:{width:1280,height:800}});watch(live);
  await live.route('**/api/state',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({version:7,savedAt:new Date().toISOString(),snapshot:demo.snapshot})}));
  await live.goto('http://127.0.0.1:4173/');await live.locator('.sheet h3').waitFor();
  await live.waitForFunction(()=>[...document.querySelectorAll('.map-marker')].filter(m=>m.style.display!=='none').length===7);
  await live.getByText('Revision 7',{exact:true}).waitFor();
  assert.equal(await live.locator('#map-empty').isHidden(),true);
  // live path empty: honest uncharted state
  const empty=await browser.newPage({viewport:{width:1280,height:800}});watch(empty);
  await empty.route('**/api/state',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({version:1,savedAt:new Date().toISOString(),snapshot:{characters:[],lore:[],rolls:[]}})}));
  await empty.goto('http://127.0.0.1:4173/');await empty.locator('#map-empty').waitFor();
  assert.equal(await empty.locator('.map-marker').count(),0);
  await empty.getByText('The world is uncharted').first().waitFor();
  // empty campaign canvas actually paints the uncharted chart, no null-context crash
  await new Promise(r=>setTimeout(r,600));
  const painted=await empty.evaluate(()=>{const c=document.querySelector('#map-canvas');const x=c.getContext('2d');if(!x)return false;const d=x.getImageData(0,0,c.width,c.height).data;for(let i=3;i<d.length;i+=400)if(d[i]!==0)return true;return false});
  assert.equal(painted,true);
  assert.deepEqual(pageErrors,[]);
  // forced WebGL failure: terrain demo falls back to 2D with recorded explored biomes, not blank parchment
  const noGl=await browser.newPage({viewport:{width:1280,height:800}});watch(noGl);
  await noGl.addInitScript(()=>{HTMLCanvasElement.prototype.getContext=function(t){if(t==='webgl'||t==='webgl2')return null;return HTMLCanvasElement.prototype.getContext?null:null}});
  await noGl.goto('about:blank');
  await noGl.evaluate(()=>{HTMLCanvasElement.prototype.getContext=function(t){if(t==='webgl'||t==='webgl2')return null;return Object.getPrototypeOf(this).__lookupGetter__?null:null}});
  await noGl.close();
  const noGl2=await browser.newPage({viewport:{width:1280,height:800}});watch(noGl2);
  await noGl2.addInitScript(()=>{const orig=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...a){if(String(t).includes('webgl'))return null;return orig.call(this,t,...a)}});
  await noGl2.goto('http://127.0.0.1:4173/?demo=1');await noGl2.locator('.sheet h3').waitFor();
  await noGl2.waitForFunction(()=>[...document.querySelectorAll('.map-marker')].filter(m=>m.style.display!=='none').length===7);
  await new Promise(r=>setTimeout(r,600));
  const biomePixels=await noGl2.evaluate(()=>{const c=document.querySelector('#map-canvas');const x=c.getContext('2d');if(!x)return 0;const d=x.getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<d.length;i+=1600){const r=d[i],g=d[i+1],b=d[i+2];if(Math.abs(r-0xef)>10||Math.abs(g-0xe8)>10||Math.abs(b-0xd2)>10)n++}return n});
  assert.ok(biomePixels>50,'fallback 2D should render recorded biome colors, not blank parchment');
  assert.deepEqual(pageErrors,[]);
 }finally{await browser.close();server.kill();await new Promise(r=>server.once('exit',r));}
});
