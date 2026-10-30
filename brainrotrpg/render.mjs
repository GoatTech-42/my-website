import {chromium} from 'playwright';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
for(const width of [1440,768,390]){const page=await browser.newPage({viewport:{width,height:1000},deviceScaleFactor:1});await page.goto('http://127.0.0.1:4173/?demo=1');await page.locator('.sheet h3').waitFor();await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:`/downloads/rpg-${width}.png`,fullPage:true});await page.close()}await browser.close();
