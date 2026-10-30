import {applyUpdate} from './state.js';
import {cardSvg,eventCardSvg} from './card.js';
import {createEnrollment,sessionDigest} from './enrollment.js';
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
function decode(value){return Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));}
export async function viewer(request,env){
 try{
  const issuer=new URL(env.ACCESS_ISSUER);if(issuer.protocol!=='https:'||!issuer.hostname.endsWith('.cloudflareaccess.com')||issuer.pathname!=='/')return false;
  const token=request.headers.get('cf-access-jwt-assertion');if(!token||token.length>16000)return false;
  const parts=token.split('.');if(parts.length!==3)return false;
  const header=JSON.parse(new TextDecoder().decode(decode(parts[0]))),claims=JSON.parse(new TextDecoder().decode(decode(parts[1])));
  const now=Date.now()/1000;
  if(header.alg!=='RS256'||typeof header.kid!=='string'||claims.iss!==issuer.origin||!Number.isFinite(claims.exp)||claims.exp<=now||!Number.isFinite(claims.iat)||claims.iat>now+30||(claims.nbf!==undefined&&(!Number.isFinite(claims.nbf)||claims.nbf>now))||!(Array.isArray(claims.aud)?claims.aud:[claims.aud]).includes(env.ACCESS_AUD))return false;
  const response=await fetch(new URL('/cdn-cgi/access/certs',issuer),{redirect:'error'});if(!response.ok)return false;
  const {keys}=await response.json();const jwk=keys.find(k=>k.kid===header.kid&&k.kty==='RSA');if(!jwk)return false;
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  return await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decode(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1]));
 }catch{return false;}
}
async function writer(request,env){
 if(typeof env.WRITE_TOKEN!=='string'||env.WRITE_TOKEN.length<32)return false;
 const supplied=request.headers.get('authorization');if(!supplied||supplied.length>512)return false;
 const hash=async s=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
 const a=await hash(supplied),b=await hash('Bearer '+env.WRITE_TOKEN);let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0;
}
const cookie=(request)=>request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith('__Host-rpg='))?.slice(11);
const setCookie=(secret,maxAge)=>`__Host-rpg=${secret}; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
const pageHeaders={'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"};
const enrollmentPage=`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Brainrot RPG sign in</title><style>body{font:18px/1.6 system-ui;max-width:44rem;margin:10vh auto;padding:24px;background:#f3eddc;color:#28291f}button{font:inherit;padding:12px 24px}code{font-size:22px;overflow-wrap:anywhere}</style><h1>Open your grimoire</h1><p>This private campaign is for the existing group. Create a code in YOUR OWN browser only. Never post a code someone else sent you. Posting the code asks to give this browser read-only campaign access.</p><button id="start">Create my browser code</button><p id="status"></p><code id="code"></code><p>Post your code in the original RPG group yourself. Once approved, return here and choose Check approval. Codes expire after 15 minutes. Viewer access lasts at most 24 hours after your fresh group approval. After it expires, create and post a new code from this browser. A seven-day browser cookie does not renew group access.</p><button id="claim">Check approval</button><script>const status=document.querySelector('#status');document.querySelector('#start').onclick=async()=>{const r=await fetch('/auth/issue',{method:'POST'});const d=await r.json();document.querySelector('#code').textContent=d.challenge||'';status.textContent=r.ok?'Post only this code, from your own group account.':'Try again later.'};document.querySelector('#claim').onclick=async()=>{const r=await fetch('/auth/claim',{method:'POST'});status.textContent=r.ok?'Approved. Opening campaign.':'Not approved or expired. Check your own group request.';if(r.ok)location.href='/'};</script>`;
export default {async fetch(request,env){
 const url=new URL(request.url);
 if(env.AUTH_MODE==='registry'&&env.SITE_HOST&&url.hostname!==env.SITE_HOST)return reply({error:'Not found'},404);
 if(env.AUTH_MODE!=='registry'&&(!env.ACCESS_ISSUER||!env.ACCESS_AUD))return reply({error:'Restricted access is not configured'},503);
 if(env.AUTH_MODE==='registry'&&(!env.SITE_HOST||!env.REGISTRY))return reply({error:'Restricted access is not configured'},503);
 const service=await writer(request,env);
 let admitted=false;
 if(env.AUTH_MODE==='registry'){
  const registry=env.REGISTRY.get(env.REGISTRY.idFromName('brainrot-identity'));
  const call=(path,body)=>registry.fetch('https://internal/'+path,{method:'POST',body:JSON.stringify(body)});
  if(url.pathname==='/auth/'&&request.method==='GET')return new Response(enrollmentPage,{headers:pageHeaders});
  if(url.pathname.startsWith('/auth/')){
   if(request.method!=='POST')return reply({error:'Method not allowed'},405);
   if(!service&&request.headers.get('origin')!==url.origin)return reply({error:'Not authorized'},403);
   if(url.pathname==='/auth/issue'){
    const r=await call('issue',{});if(!r.ok)return reply({error:'Try later'},429);const d=await r.json();const res=reply({challenge:d.challenge,expiresAt:d.expiresAt});res.headers.set('Set-Cookie',setCookie(d.secret,900));return res;
   }
   if(url.pathname==='/auth/claim'){
    const r=await call('claim',{secret:cookie(request)});if(!r.ok)return reply({error:'Not authorized'},401);const d=await r.json(),res=reply({ok:true});res.headers.set('Set-Cookie',setCookie(d.secret,7*86400));return res;
   }
   if(url.pathname==='/auth/logout'){await call('logout',{secret:cookie(request)});const res=reply({ok:true});res.headers.set('Set-Cookie',setCookie('',0));return res;}
   if(!service)return reply({error:'Not authorized'},403);
   if(!['/auth/approve','/auth/member'].includes(url.pathname))return reply({error:'Not found'},404);
   const raw=await request.text();if(raw.length>4096)return reply({error:'Too large'},413);let body;try{body=JSON.parse(raw)}catch{return reply({error:'Invalid JSON'},400)}return call(url.pathname.slice(6),body);
  }
  if(!service)admitted=(await call('check',{secret:cookie(request)})).ok;
 }else if(!service)admitted=await viewer(request,env);
 if(!service&&!admitted){if(request.method==='GET'&&!url.pathname.startsWith('/api/'))return new Response(null,{status:303,headers:{Location:'/auth/','Cache-Control':'no-store'}});return reply({error:'Sign in required'},401);}
 if(url.pathname.startsWith('/api/')){
  if(!env.CAMPAIGN)return reply({error:'Campaign storage is not configured'},503);
  if((request.method!=='GET'||url.pathname==='/api/export'||url.pathname.startsWith('/api/history/'))&&!service)return reply({error:'Read-only access'},403);
  if(request.method!=='GET'&&request.headers.get('content-type')!=='application/json')return reply({error:'JSON required'},415);
  if(Number(request.headers.get('content-length')||0)>262144)return reply({error:'Update too large'},413);
  const stub=env.CAMPAIGN.get(env.CAMPAIGN.idFromName('brainrot-main'));
  return stub.fetch(request);
 }
 if(request.method!=='GET'&&request.method!=='HEAD')return reply({error:'Method not allowed'},405);
 if(url.searchParams.has('demo')||url.pathname.endsWith('/demo.json'))return reply({error:'Not found'},404);
 const res=await env.ASSETS.fetch(request),headers=new Headers(res.headers);headers.set('Cache-Control','private, no-store');headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','no-referrer');headers.set('X-Frame-Options','DENY');
 headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' blob: data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");return new Response(res.body,{status:res.status,headers});
}};
export class Campaign {
 constructor(ctx){this.ctx=ctx;}
 async fetch(request){
  const url=new URL(request.url);
  if(request.method==='GET'){
   const event=url.pathname.match(/^\/api\/events\/([A-Za-z0-9-]+)\.svg$/);
   if(event){const current=await this.ctx.storage.get('current');if(!url.searchParams.has('version')||String(current?.version)!==url.searchParams.get('version'))return reply({error:'Card revision conflict'},409);const r=current?.snapshot.rolls.find(r=>r.id===event[1]);return r?new Response(eventCardSvg(r,current),{headers:{'Content-Type':'image/svg+xml','Cache-Control':'private, no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; sandbox",'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}}):reply({error:'Event not found'},404);}
   const card=url.pathname.match(/^\/api\/cards\/([A-Za-z0-9-]+)\.svg$/);
   if(card){const current=await this.ctx.storage.get('current');if(!url.searchParams.has('version')||String(current?.version)!==url.searchParams.get('version'))return reply({error:'Card revision conflict'},409);const c=current?.snapshot.characters.find(c=>c.id===card[1]);return c?new Response(cardSvg(c,current),{headers:{'Content-Type':'image/svg+xml','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; sandbox"}}):reply({error:'Character not found'},404);}
   if(url.pathname==='/api/state'||url.pathname==='/api/export'){
    const current=await this.ctx.storage.get('current');return current?reply(url.pathname==='/api/export'?current:{version:current.version,savedAt:current.savedAt,snapshot:current.snapshot}):reply({error:'Campaign not initialized'},404);
   }
   const match=url.pathname.match(/^\/api\/history\/(\d+)$/);if(match){const saved=await this.ctx.storage.get('v:'+match[1]);return saved?reply(saved):reply({error:'Revision not found'},404)}
   return reply({error:'Not found'},404);
  }
  if(request.method!=='PUT'||url.pathname!=='/api/state')return reply({error:'Method not allowed'},405);
  let update;try{const body=await request.text();if(new TextEncoder().encode(body).length>262144)return reply({error:'Update too large'},413);update=JSON.parse(body)}catch{return reply({error:'Invalid JSON'},400)}
  try{
   const saved=await this.ctx.storage.transaction(async tx=>{
    const current=await tx.get('current');const next=await applyUpdate(current,update,new Date().toISOString());
    if(next!==current){await tx.put('v:'+next.version,next);await tx.put('current',next)}return next;
   });const receipt=saved.receipts.find(r=>r.id===update.updateId);return reply({version:receipt.version,savedAt:receipt.savedAt,updateId:update.updateId});
  }catch(e){return reply({error:e.message},/conflict|reused/.test(e.message)?409:422)}
 }
}
export class Registry {
 constructor(ctx,env){this.ctx=ctx;this.maxGrantMs=Number(env?.MEMBERSHIP_GRANT_MAX_MS)||0;}
 async fetch(request){
  const route=new URL(request.url).pathname.slice(1);let body;try{const text=await request.text();if(text.length>4096)return reply({error:'Too large'},413);body=JSON.parse(text)}catch{return reply({error:'Invalid request'},400)}
  const now=Date.now();
  try{return await this.ctx.storage.transaction(async tx=>{
   // Every request sweeps bounded namespaces. Member tombstones retain generations
   // so an old browser cannot become valid again after a later attestation.
   const members=await tx.list({prefix:'member:'});
   for(const [key,m] of members)if(m.active&&m.validUntil<=now){const tombstone={...m,active:false,generation:m.generation+1};await tx.put(key,tombstone);members.set(key,tombstone)}
   const sessions=await tx.list({prefix:'session:'});
   for(const [key,s] of sessions){const m=members.get('member:'+s.memberKey);if(s.expiresAt<=now||!m?.active||m.generation!==s.generation){await tx.delete(key);sessions.delete(key)}}
   const pending=await tx.list({prefix:'pending:'});
   for(const [key,p] of pending)if(p.expiresAt<=now||p.consumed){await tx.delete(key);await tx.delete('pending-digest:'+p.digest);pending.delete(key)}
   const usedSources=await tx.list({prefix:'source:'});for(const [key,s] of usedSources)if(s.expiresAt<=now)await tx.delete(key);
   const memberKey=body.memberKey;
   if(route==='member'||route==='approve'){
    if(typeof body.sourceMessageId!=='string'||body.sourceMessageId.length>160||!Number.isFinite(body.sourceAt)||body.sourceAt>now+30000||body.sourceAt<now-15*60000)return reply({error:'Invalid attestation'},422);
    if(await tx.get('source:'+body.sourceMessageId))return reply({error:'Attestation already used'},409);
   }
   if(route==='member'){
    if(!/^member-[0-9]{2}$/.test(memberKey)||typeof body.active!=='boolean'||typeof body.sourceMessageId!=='string'||!body.sourceMessageId||!Number.isFinite(body.validUntil)||body.validUntil<=now||(!this.maxGrantMs||body.validUntil>now+this.maxGrantMs))return reply({error:'Invalid roster attestation'},422);
    const prior=await tx.get('member:'+memberKey);if(prior?.sourceAt>=body.sourceAt)return reply({error:'Stale attestation'},409);await tx.put('source:'+body.sourceMessageId,{expiresAt:now+16*60000});await tx.put('member:'+memberKey,{active:body.active,validUntil:body.validUntil,generation:(prior?.generation??0)+(body.active===false?1:0),sourceMessageId:body.sourceMessageId,sourceAt:body.sourceAt});return reply({ok:true});
   }
   if(route==='issue'){
    const rate=await tx.get('issue-rate')??{start:now,count:0};if(now-rate.start>3600000){rate.start=now;rate.count=0}if(rate.count>=30)return reply({error:'Try later'},429);rate.count++;await tx.put('issue-rate',rate);
    if([...pending.values()].filter(p=>p.expiresAt>now&&!p.consumed).length>=30)return reply({error:'Try later'},429);
    const e=await createEnrollment(now);const record={...e.record,group:'brainrot',nonce:crypto.randomUUID()};await tx.put('pending:'+e.publicChallenge,record);await tx.put('pending-digest:'+record.digest,e.publicChallenge);return reply({secret:e.browserSecret,challenge:e.publicChallenge,expiresAt:record.expiresAt});
   }
   if(route==='approve'){
    if(typeof body.challenge!=='string'||!/^member-[0-9]{2}$/.test(memberKey)||typeof body.sourceMessageId!=='string'||!body.sourceMessageId)return reply({error:'Invalid approval'},422);
    const p=await tx.get('pending:'+body.challenge),m=await tx.get('member:'+memberKey);
    if(!p||body.sourceAt<p.createdAt||p.expiresAt<=now||p.consumed||p.memberKey||!m?.active||m.validUntil<=now)return reply({error:'Approval conflict'},409);
    if([...sessions.values()].filter(s=>s.memberKey===memberKey&&s.expiresAt>now).length>=3)return reply({error:'Session limit'},409);
    await tx.put('source:'+body.sourceMessageId,{expiresAt:now+16*60000});await tx.put('pending:'+body.challenge,{...p,memberKey,generation:m.generation,sourceMessageId:body.sourceMessageId,sourceAt:body.sourceAt});return reply({ok:true});
   }
   if(route==='claim'){
    if(typeof body.secret!=='string'||body.secret.length!==43)return reply({error:'Not authorized'},401);
    const digest=await sessionDigest(body.secret),challenge=await tx.get('pending-digest:'+digest),p=challenge?await tx.get('pending:'+challenge):null;
    const m=p?.memberKey?await tx.get('member:'+p.memberKey):null;
    if(!p||p.consumed||p.expiresAt<=now||!p.memberKey||!m?.active||m.validUntil<=now||m.generation!==p.generation)return reply({error:'Not authorized'},401);
    if([...sessions.values()].filter(s=>s.memberKey===p.memberKey&&s.generation===m.generation).length>=3)return reply({error:'Not authorized'},401);
    const fresh=await createEnrollment(now),session={memberKey:p.memberKey,generation:m.generation,expiresAt:now+7*86400000};
    await tx.put('session:'+fresh.record.digest,session);await tx.delete('pending:'+challenge);await tx.delete('pending-digest:'+digest);return reply({secret:fresh.browserSecret,expiresAt:session.expiresAt});
   }
   if(route==='check'||route==='logout'){
    if(typeof body.secret!=='string'||body.secret.length!==43)return reply({error:'Not authorized'},401);
    const digest=await sessionDigest(body.secret),session=await tx.get('session:'+digest),m=session?await tx.get('member:'+session.memberKey):null;
    if(route==='logout'){await tx.delete('session:'+digest);return reply({ok:true})}
    if(!session||session.expiresAt<=now||!m?.active||m.validUntil<=now||m.generation!==session.generation)return reply({error:'Not authorized'},401);return reply({ok:true});
   }
   return reply({error:'Not found'},404);
  })}catch{return reply({error:'Not authorized'},401)}
 }
}
