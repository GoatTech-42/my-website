import {renderMap} from './map.js';
const demo=new URLSearchParams(location.search).get('demo')==='1';
const $=s=>document.querySelector(s);
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n};
let state,selected;
const motion=$('#motion');motion.onclick=()=>{const paused=document.body.classList.toggle('paused');motion.setAttribute('aria-pressed',paused);motion.textContent=paused?'Resume motion':'Pause motion'};
document.addEventListener('visibilitychange',()=>document.body.classList.toggle('paused',document.hidden||motion.getAttribute('aria-pressed')==='true'));
// Ambient-motion orchestration: reveal-on-scroll fallback for engines without
// scroll-timeline support, and hero ambient pause while the hero is offscreen.
const revealIO='IntersectionObserver' in window?new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){e.target.classList.add('in-view');revealIO.unobserve(e.target)}},{rootMargin:'0px 0px -8% 0px'}):null;
if(revealIO)document.body.classList.add('motion-io');
function observeReveals(){if(!revealIO)return;document.querySelectorAll('.reveal:not(.in-view)').forEach(n=>revealIO.observe(n))}
// Bound ambient work to visible sections. No observer means the safe static fallback.
const ambientSections=document.querySelectorAll('.hero,#party,#rolls,#map');
for(const n of ambientSections)n.classList.add('ambient-offscreen');
if('IntersectionObserver' in window){const ambientIO=new IntersectionObserver(entries=>{for(const e of entries)e.target.classList.toggle('ambient-offscreen',!e.isIntersecting)});for(const n of ambientSections)ambientIO.observe(n)}
function renderCharacter(c){
 selected=c;const root=$('#character');root.replaceChildren();
 root.classList.remove('sheet-swap');void root.offsetWidth;root.classList.add('sheet-swap');
 const head=el('div',undefined,'sheet-head'),intro=el('div');intro.append(el('h3',c.name),el('p',c.classStyle,'subtitle'));
 const hp=el('p',`${c.hp}`, 'hp');hp.append(el('small',` / ${c.maxHp} HP`));head.append(intro,hp);root.append(head);
 const bar=el('div',undefined,'health-bar'),fill=el('div',undefined,'health-fill');fill.style.width=`${c.hp/c.maxHp*100}%`;if(c.maxHp>0&&c.hp/c.maxHp<=0.3)fill.classList.add('low');bar.append(fill);root.append(bar);
 const deaths=c.stats?c.stats.deaths:null;
 const rows=[['Status',c.status],['Location',c.location],['Equipped',c.gear.join(', ')||'None recorded'],['Inventory',c.inventory.join(', ')||'Empty'],['Assigned bonuses',c.bonuses.map(b=>`${b.name} ${b.value>=0?'+':''}${b.value}`).join(', ')||'None assigned'],['Record (current round)',`${c.kills} ${c.kills===1?'kill':'kills'} \u00b7 ${deaths===null?'?':deaths} ${deaths===1?'death':'deaths'} \u00b7 ${c.wins} ${c.wins===1?'win':'wins'}`]];
 for(const r of c.priorRounds??[])rows.push([r.round,`${r.kills} ${r.kills===1?'kill':'kills'} \u00b7 ${r.deaths} ${r.deaths===1?'death':'deaths'}`]);
 const dl=el('dl');for(const [name,value] of rows){const d=el('div');d.append(el('dt',name),el('dd',value));dl.append(d)}root.append(dl,el('p',c.bio,'bio'));
 if(c.pendingTraits.length)root.append(el('p',`Pending traits: ${c.pendingTraits.join(', ')}`,'bio'));
 document.querySelectorAll('.character-tab').forEach(b=>b.setAttribute('aria-pressed',b.dataset.id===c.id));
}
const loreHeadings=new Set(['Rules and Commands','Game Overview','Admin Authority','Command Basics','Player Commands','Admin-Only Commands','Combat Engine','Difficulty Classes','Turn-Based Play','Doc as Database','DM Message Format','Open World Map + Bounty Board','World Map','Discovered Zones','Player + Combat Stats','Registered Characters','Battle + Session Logs']);
function renderLoreText(text){
 const root=el('div',undefined,'lore-content'),lines=text.split('\n');
 for(let i=0;i<lines.length;i++){
  const line=lines[i];if(!line.trim())continue;
  if(line==='[TABLE]'){
   const table=el('table'),head=el('thead'),body=el('tbody');let first=true;
   while(++i<lines.length&&lines[i]!=='[/TABLE]'){
    const row=el('tr');for(const value of lines[i].split(' | '))row.append(el(first?'th':'td',value));
    (first?head:body).append(row);first=false;
   }table.append(head,body);const wrap=el('div',undefined,'lore-table');wrap.append(table);root.append(wrap);continue;
  }
  if(line.startsWith('+---')||line.startsWith('|')){
   const rows=[line];while(i+1<lines.length&&(/^[|+]/.test(lines[i+1])))rows.push(lines[++i]);root.append(el('pre',rows.join('\n'),'lore-map'));continue;
  }
  if(loreHeadings.has(line)){root.append(el('h4',line));continue;}
  if(line.startsWith('/')){
   const row=el('p',undefined,'lore-command'),space=line.indexOf(' ');row.append(el('code',space<0?line:line.slice(0,space)),document.createTextNode(space<0?'':line.slice(space)));root.append(row);continue;
  }
  root.append(el('p',line));
 }return root;
}
function render(s){
 state=s;renderMap(s);$('.demo-notice').hidden=!s.demo;document.querySelectorAll('.sample-label').forEach(n=>n.hidden=!s.demo);
 const freshness=s.demo?'Fictional preview. No game state saved.':`Saved revision ${s.version} at ${new Date(s.savedAt).toLocaleString()} (${age(s.savedAt)}).`;
 $('#freshness').textContent=freshness;const mf=document.querySelector('#map-freshness');if(mf)mf.textContent=freshness;
 const list=$('#character-list');list.replaceChildren();
 for(const c of s.snapshot.characters){const b=el('button',undefined,'character-tab');b.dataset.id=c.id;b.append(el('span',c.name),el('small',`${c.status} / ${c.hp} of ${c.maxHp} HP`));b.onclick=()=>renderCharacter(c);list.append(b)}
 if(s.snapshot.characters.length)renderCharacter(s.snapshot.characters[0]);else $('#character').textContent='No characters recorded yet.';
 const feed=$('#roll-feed');feed.replaceChildren();
 if(!s.snapshot.rolls.length)feed.append(el('p','No rolls recorded yet. The next resolved roll will appear here.'));
 for(const r of [...s.snapshot.rolls].reverse().slice(0,5)){
 const article=el('article',undefined,'roll-entry reveal'),die=el('div',undefined,'die');
 if(r.sides>1){if(r.dice.some(d=>d===r.sides))die.classList.add('crit');else if(r.dice.some(d=>d===1))die.classList.add('fumble')}
 die.innerHTML='<svg viewBox="0 0 120 138" aria-hidden="true"><path d="M60 3 115 36 115 102 60 135 5 102 5 36Z M60 3 29 92 115 36 5 36 91 92Z M5 102 29 92 60 135 91 92 115 102 M29 92 91 92 60 3"/></svg>';
 die.append(el('span',r.total));die.setAttribute('aria-label',`Recorded total ${r.total}`);
 const copy=el('div',undefined,'roll-copy');copy.append(el('h3',r.action),el('p',`${r.dice.join(' + ')} ${r.modifier<0?'-':'+'} ${Math.abs(r.modifier)} = ${r.total} (d${r.sides})`,'math'),el('p',r.outcome));
 const replay=el('button','Replay animation');replay.onclick=()=>{die.classList.remove('replaying');void die.offsetWidth;die.classList.add('replaying')};copy.append(replay,el('p','Replay only. This never rerolls or changes the result.','replay-note'));article.append(die,copy);feed.append(article);
 }
 const lore=$('#lore-feed');lore.replaceChildren();for(const l of s.snapshot.lore){const a=el('article',undefined,'lore-entry reveal');a.append(el('h3',l.title),renderLoreText(l.text));lore.append(a)}if(!s.snapshot.lore.length)lore.textContent='No lore has been recorded yet.';
 observeReveals();
}
function age(savedAt){if(!savedAt)return 'unsaved';const mins=Math.max(0,Math.round((Date.now()-new Date(savedAt).getTime())/60000));return mins<1?'just saved':mins===1?'1 minute ago':mins<60?`${mins} minutes ago`:`${Math.round(mins/60)} hours ago`}
const REFRESH=15*60*1000;let lastLoad=0;
async function load(){try{const r=await fetch(demo?'demo.json':'/api/state',{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);const s=await r.json();lastLoad=Date.now();render(s)}catch(e){if(state&&!state.demo){const note=`Offline - showing saved revision ${state.version} from ${new Date(state.savedAt).toLocaleString()} (${age(state.savedAt)}). Retrying.`;$('#freshness').textContent=note;const mf2=document.querySelector('#map-freshness');if(mf2)mf2.textContent=note;return}$('#freshness').textContent='Campaign unavailable. No demo data substituted.';const mf=document.querySelector('#map-freshness');if(mf)mf.textContent='Map unavailable. No demo data substituted.';$('#character').replaceChildren(el('p','The campaign could not be loaded. Sign in or try again.','error'));const retry=el('button','Try again');retry.onclick=load;$('#character').append(retry)}}
load();
setInterval(()=>{if(Date.now()-lastLoad>=REFRESH-5000)load()},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-lastLoad>=REFRESH)load()});
