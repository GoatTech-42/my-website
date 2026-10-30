const fail=(message)=>{throw new Error(message)};
const obj=(v,keys)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!keys.includes(k))||keys.some(k=>!(k in v)))fail('invalid field');};
const text=(v,max=300)=>{if(typeof v!=='string'||v.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v))fail('invalid text');};
const id=v=>{if(typeof v!=='string'||!(/^[A-Za-z0-9][A-Za-z0-9-]{0,63}$/).test(v))fail('invalid id');};
const integer=(v,min,max)=>{if(!Number.isSafeInteger(v)||v<min||v>max)fail('invalid number');};
const list=(v,max,check)=>{if(!Array.isArray(v)||v.length>max)fail('invalid list');v.forEach(check);};
const unique=arr=>{if(new Set(arr.map(x=>x.id)).size!==arr.length)fail('duplicate id');};
export function validateSnapshot(s){
 obj(s,['characters','lore','rolls',...(s.world?['world']:[])]);
 if(s.world){obj(s.world,['zones_discovered','world_bosses_active','faction_territories_claimed','active_bounties','map']);['zones_discovered','world_bosses_active','faction_territories_claimed','active_bounties'].forEach(k=>integer(s.world[k],0,100000));text(s.world.map,10000);}
 list(s.characters,30,c=>{
  obj(c,['id','name','classStyle','hp','maxHp','status','bonuses','gear','inventory','kills','wins','location','bio','pendingTraits',...(c.race!==undefined?['race']:[])]);if(c.race!==undefined&&c.race!==null)text(c.race,100);
  id(c.id); ['name','classStyle','location'].forEach(k=>text(c[k],100));text(c.status,500);text(c.bio,2000);
  integer(c.maxHp,1,100000);integer(c.hp,0,c.maxHp);integer(c.kills,0,100000);integer(c.wins,0,100000);
  ['gear','inventory','pendingTraits'].forEach(k=>list(c[k],50,v=>text(v,1000)));
  list(c.bonuses,20,b=>{obj(b,['name','value']);text(b.name,40);integer(b.value,-100,100)});
 });unique(s.characters);
 list(s.lore,100,l=>{obj(l,['id','title','text']);id(l.id);text(l.title,100);text(l.text,5000)});unique(s.lore);
 let order=-1;
 list(s.rolls,100,r=>{
  obj(r,['id','order','characterId','dice','sides','modifier','total','action','outcome',...(r.difficulty!==undefined?['difficulty']:[])]);if(r.difficulty!==undefined)integer(r.difficulty,0,100000);id(r.id);id(r.characterId);
  if(!s.characters.some(c=>c.id===r.characterId))fail('unknown character');
  integer(r.order,0,100000000);if(r.order<=order)fail('roll ordering');order=r.order;
  integer(r.sides,2,1000);list(r.dice,20,v=>integer(v,1,r.sides));if(!r.dice.length)fail('empty roll');
  integer(r.modifier,-1000,1000);integer(r.total,-1000,21000);
  if(r.total!==r.dice.reduce((a,b)=>a+b,0)+r.modifier)fail('roll total');
  text(r.action,300);text(r.outcome,2000);
 });unique(s.rolls);return s;
}
const stable=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
export async function applyUpdate(current,update,now){
 obj(update,['updateId','expectedVersion','snapshot']);id(update.updateId);integer(update.expectedVersion,0,Number.MAX_SAFE_INTEGER);
 validateSnapshot(update.snapshot);
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(stable(update))))).map(x=>x.toString(16).padStart(2,'0')).join('');
 const prior=current?.receipts.find(r=>r.id===update.updateId);
 if(prior){if(prior.digest!==digest)fail('update id reused');return current;}
 if(update.expectedVersion!==(current?.version??0))fail('version conflict');
 return {version:(current?.version??0)+1,savedAt:now,snapshot:structuredClone(update.snapshot),receipts:[...(current?.receipts??[]),{id:update.updateId,digest,version:(current?.version??0)+1,savedAt:now}].slice(-1000)};
}
