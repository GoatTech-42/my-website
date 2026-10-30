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
