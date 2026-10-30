const demo=new URLSearchParams(location.search).get('demo')==='1';
const $=s=>document.querySelector(s);
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n};
let state,selected;
const motion=$('#motion');motion.onclick=()=>{const paused=document.body.classList.toggle('paused');motion.setAttribute('aria-pressed',paused);motion.textContent=paused?'Resume motion':'Pause motion'};
document.addEventListener('visibilitychange',()=>document.body.classList.toggle('paused',document.hidden||motion.getAttribute('aria-pressed')==='true'));
function renderCharacter(c){
 selected=c;const root=$('#character');root.replaceChildren();
 const head=el('div',undefined,'sheet-head'),intro=el('div');intro.append(el('h3',c.name),el('p',c.classStyle,'subtitle'));
 const hp=el('p',`${c.hp}`, 'hp');hp.append(el('small',` / ${c.maxHp} HP`));head.append(intro,hp);root.append(head);
 const bar=el('div',undefined,'health-bar'),fill=el('div',undefined,'health-fill');fill.style.width=`${c.hp/c.maxHp*100}%`;bar.append(fill);root.append(bar);
 const dl=el('dl');for(const [name,value] of [['Status',c.status],['Location',c.location],['Equipped',c.gear.join(', ')||'None recorded'],['Inventory',c.inventory.join(', ')||'Empty'],['Assigned bonuses',c.bonuses.map(b=>`${b.name} ${b.value>=0?'+':''}${b.value}`).join(', ')||'None assigned'],['Record',`${c.kills} kills / ${c.wins} wins`]]){const d=el('div');d.append(el('dt',name),el('dd',value));dl.append(d)}root.append(dl,el('p',c.bio,'bio'));
 if(c.pendingTraits.length)root.append(el('p',`Pending traits: ${c.pendingTraits.join(', ')}`,'bio'));
 document.querySelectorAll('.character-tab').forEach(b=>b.setAttribute('aria-pressed',b.dataset.id===c.id));
}
function render(s){
 state=s;$('.demo-notice').hidden=!s.demo;document.querySelectorAll('.sample-label').forEach(n=>n.hidden=!s.demo);
 $('#freshness').textContent=s.demo?'Fictional preview. No game state saved.':`Saved revision ${s.version} at ${new Date(s.savedAt).toLocaleString()}.`;
 const list=$('#character-list');list.replaceChildren();
 for(const c of s.snapshot.characters){const b=el('button',undefined,'character-tab');b.dataset.id=c.id;b.append(el('span',c.name),el('small',`${c.status} / ${c.hp} of ${c.maxHp} HP`));b.onclick=()=>renderCharacter(c);list.append(b)}
 if(s.snapshot.characters.length)renderCharacter(s.snapshot.characters[0]);else $('#character').textContent='No characters recorded yet.';
 const feed=$('#roll-feed');feed.replaceChildren();
 if(!s.snapshot.rolls.length)feed.append(el('p','No rolls recorded yet. The next resolved roll will appear here.'));
 for(const r of [...s.snapshot.rolls].reverse().slice(0,5)){
 const article=el('article',undefined,'roll-entry'),die=el('div',undefined,'die');
 die.innerHTML='<svg viewBox="0 0 120 138" aria-hidden="true"><path d="M60 3 115 36 115 102 60 135 5 102 5 36Z M60 3 29 92 115 36 5 36 91 92Z M5 102 29 92 60 135 91 92 115 102 M29 92 91 92 60 3"/></svg>';
 die.append(el('span',r.total));die.setAttribute('aria-label',`Recorded total ${r.total}`);
 const copy=el('div',undefined,'roll-copy');copy.append(el('h3',r.action),el('p',`${r.dice.join(' + ')} ${r.modifier<0?'-':'+'} ${Math.abs(r.modifier)} = ${r.total} (d${r.sides})`,'math'),el('p',r.outcome));
 const replay=el('button','Replay animation');replay.onclick=()=>{die.classList.remove('replaying');void die.offsetWidth;die.classList.add('replaying')};copy.append(replay,el('p','Replay only. This never rerolls or changes the result.','replay-note'));article.append(die,copy);feed.append(article);
 }
 const lore=$('#lore-feed');lore.replaceChildren();for(const l of s.snapshot.lore){const a=el('article',undefined,'lore-entry');a.append(el('h3',l.title),el('p',l.text));lore.append(a)}if(!s.snapshot.lore.length)lore.textContent='No lore has been recorded yet.';
}
async function load(){try{const r=await fetch(demo?'demo.json':'/api/state',{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);render(await r.json())}catch(e){$('#freshness').textContent='Campaign unavailable. No demo data substituted.';$('#character').replaceChildren(el('p','The campaign could not be loaded. Sign in or try again.','error'));const retry=el('button','Try again');retry.onclick=load;$('#character').append(retry)}}
load();
