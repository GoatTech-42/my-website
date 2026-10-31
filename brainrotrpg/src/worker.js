import {applyUpdate} from './state.js';
import {cardSvg,eventCardSvg} from './card.js';
import {bossCardSvg} from './boss-art.js';
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
const enrollmentPage=`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>PvP Lobby sign in</title><style>body{font:18px/1.6 system-ui;max-width:44rem;margin:10vh auto;padding:24px;background:#f3eddc;color:#28291f}button{font:inherit;padding:12px 24px}code{font-size:22px;overflow-wrap:anywhere}</style><h1>Open your grimoire</h1><p>This private campaign is for the existing group. Create a code in YOUR OWN browser only. Never post a code someone else sent you. Posting the code asks to give this browser read-only campaign access.</p><button id="start">Create my browser code</button><p id="status"></p><code id="code"></code><p>Post your code in the PvP Lobby group yourself. Once approved, return here and choose Check approval. Codes expire after 15 minutes. Viewer access lasts at most 24 hours after your fresh group approval. After it expires, create and post a new code from this browser. A seven-day browser cookie does not renew group access. If your group approves extending only this browser, return here and choose Extend this browser. If asked to prove this browser without signing in again, choose Prove this browser and post the shown proof in your group yourself.</p><button id="claim">Check approval</button><button id="extend">Extend this browser</button><button id="prove">Prove this browser</button><code id="proof"></code><script>const status=document.querySelector('#status');document.querySelector('#start').onclick=async()=>{const r=await fetch('/auth/issue',{method:'POST'});const d=await r.json();document.querySelector('#code').textContent=d.challenge||'';status.textContent=r.ok?'Post only this code, from your own group account.':'Try again later.'};document.querySelector('#claim').onclick=async()=>{const r=await fetch('/auth/claim',{method:'POST'});status.textContent=r.ok?'Approved. Opening campaign.':'Not approved or expired. Check your own group request.';if(r.ok)location.href='/'};document.querySelector('#extend').onclick=async()=>{const r=await fetch('/auth/extend',{method:'POST'});status.textContent=r.ok?'This browser now keeps access until its cookie expires.':'No approved extension for this browser.'};document.querySelector('#prove').onclick=async()=>{const r=await fetch('/auth/proof',{method:'POST'});const d=await r.json();document.querySelector('#proof').textContent=d.nonce||'';status.textContent=r.ok?'Post only this proof, from your own group account. It expires after 15 minutes.':'Not signed in on this browser.'};</script>`;
export default {async fetch(request,env){
 const url=new URL(request.url);
 if(env.RECORD_SET!==undefined&&env.RECORD_SET!=='qualification-20261030')return reply({error:'Invalid record configuration'},503);
 const qualification=env.RECORD_SET==='qualification-20261030';
 if(env.AUTH_MODE==='registry'&&env.SITE_HOST&&url.hostname!==env.SITE_HOST)return reply({error:'Not found'},404);
 if(env.AUTH_MODE!=='registry'&&(!env.ACCESS_ISSUER||!env.ACCESS_AUD))return reply({error:'Restricted access is not configured'},503);
 if(env.AUTH_MODE==='registry'&&(!env.SITE_HOST||!env.REGISTRY))return reply({error:'Restricted access is not configured'},503);
 const service=await writer(request,env);
 let admitted=false;
 if(env.AUTH_MODE==='registry'){
  const registry=env.REGISTRY.get(env.REGISTRY.idFromName(qualification?'brainrot-identity-qualification-20261030':'brainrot-identity'));
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
   if(url.pathname==='/auth/proof'){
    const r=await call('proof',{secret:cookie(request)});if(!r.ok)return reply({error:'Not authorized'},401);const d=await r.json();return reply({nonce:d.nonce,expiresAt:d.expiresAt});
   }
   if(url.pathname==='/auth/extend'){
    const r=await call('extend',{secret:cookie(request)});if(!r.ok)return reply({error:'Not authorized'},401);const d=await r.json();return reply({ok:true,expiresAt:d.expiresAt});
   }
   if(!service)return reply({error:'Not authorized'},403);
   if(!['/auth/approve','/auth/member','/auth/session-grant','/auth/sessions','/auth/audience','/auth/revoke'].includes(url.pathname))return reply({error:'Not found'},404);
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
  const stub=env.CAMPAIGN.get(env.CAMPAIGN.idFromName(qualification?'brainrot-qualification-20261030':'brainrot-main'));
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
   if(url.pathname==='/api/map'){
    const current=await this.ctx.storage.get('current');
    return current?reply({version:current.version,savedAt:current.savedAt,worldMap:current.snapshot.worldMap??null}):reply({error:'Campaign not initialized'},404);
   }
   const boss=url.pathname.match(/^\/api\/map\/bosses\/([A-Za-z0-9-]+)\.svg$/);
   if(boss){const current=await this.ctx.storage.get('current');if(!url.searchParams.has('version')||String(current?.version)!==url.searchParams.get('version'))return reply({error:'Card revision conflict'},409);const b=current?.snapshot.worldMap?.bosses.find(b=>b.id===boss[1]);return b?new Response(bossCardSvg(b,current),{headers:{'Content-Type':'image/svg+xml','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; sandbox",'Referrer-Policy':'no-referrer'}}):reply({error:'Boss not found'},404);}
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
   const sessions=await tx.list({prefix:'session:'});
   const members=await tx.list({prefix:'member:'});
   // Audience binding: each member belongs to one audience (default 'brainrot').
   // Only members of the current audience can hold or create sessions; sessions
   // of any other audience fail closed below and at every validity check.
   const currentAudience=(await tx.get('current:audience'))??'brainrot';
   for(const [key,m] of members)if(m.active&&m.validUntil<=now){
    // A session-scoped extension (browser-bound, capped at that session's own
    // cookie expiry) keeps the member record active only while it is live;
    // every other session still ends at the membership grant boundary below.
    const grace=[...sessions.values()].some(s=>s.memberKey===key.slice(7)&&s.generation===m.generation&&s.expiresAt>now&&(s.grantUntil??0)>now);
    if(!grace){const tombstone={...m,active:false,generation:m.generation+1};await tx.put(key,tombstone);members.set(key,tombstone)}
   }
   for(const [key,s] of sessions){const m=members.get('member:'+s.memberKey);if(s.expiresAt<=now||!m?.active||m.generation!==s.generation||(m.audience??'brainrot')!==currentAudience||(m.validUntil<=now&&(s.grantUntil??0)<=now)){await tx.delete(key);sessions.delete(key)}}
   const pending=await tx.list({prefix:'pending:'});
   for(const [key,p] of pending)if(p.expiresAt<=now||p.consumed){await tx.delete(key);await tx.delete('pending-digest:'+p.digest);pending.delete(key)}
   const usedSources=await tx.list({prefix:'source:'});for(const [key,s] of usedSources)if(s.expiresAt<=now)await tx.delete(key);
   const intents=await tx.list({prefix:'intent:'});for(const [key,i] of intents)if(i.expiresAt<=now)await tx.delete(key);
   const proofs=await tx.list({prefix:'proof:'});for(const [key,p] of proofs)if(p.expiresAt<=now)await tx.delete(key);
   const memberKey=body.memberKey;
   if(route==='member'||route==='approve'||route==='session-grant'){
    if(typeof body.sourceMessageId!=='string'||body.sourceMessageId.length>160||!Number.isFinite(body.sourceAt)||body.sourceAt>now+30000||body.sourceAt<now-15*60000)return reply({error:'Invalid attestation'},422);
    if(await tx.get('source:'+body.sourceMessageId))return reply({error:'Attestation already used'},409);
   }
   if(route==='member'){
    if(!/^member-[0-9]{2}$/.test(memberKey)||typeof body.active!=='boolean'||typeof body.sourceMessageId!=='string'||!body.sourceMessageId||!Number.isFinite(body.validUntil)||body.validUntil<=now||(!this.maxGrantMs||body.validUntil>now+this.maxGrantMs)||(body.audience!==undefined&&(typeof body.audience!=='string'||!/^[a-z0-9-]{1,32}$/.test(body.audience))))return reply({error:'Invalid roster attestation'},422);
    const prior=await tx.get('member:'+memberKey);if(prior?.sourceAt>=body.sourceAt)return reply({error:'Stale attestation'},409);await tx.put('source:'+body.sourceMessageId,{expiresAt:now+16*60000});await tx.put('member:'+memberKey,{active:body.active,validUntil:body.validUntil,generation:(prior?.generation??0)+(body.active===false?1:0),audience:body.audience??prior?.audience??'brainrot',sourceMessageId:body.sourceMessageId,sourceAt:body.sourceAt});return reply({ok:true});
   }
   if(route==='session-grant'){
    if(!/^member-[0-9]{2}$/.test(memberKey)||(body.approveSourceMessageId!==undefined&&(typeof body.approveSourceMessageId!=='string'||!body.approveSourceMessageId||body.approveSourceMessageId.length>160))||(body.proofNonce!==undefined&&(typeof body.proofNonce!=='string'||body.proofNonce.length!==22)))return reply({error:'Invalid extension grant'},422);
    const m=await tx.get('member:'+memberKey);if(!m?.active)return reply({error:'Invalid extension grant'},422);
    let proofDigest=null;
    if(body.proofNonce!==undefined){
     // Public proof posted in the group by the browser itself: binds the intent
     // to exactly that session, without any secret or digest crossing chat.
     const proof=await tx.get('proof:'+body.proofNonce);
     const target=proof?await tx.get('session:'+proof.sessionDigest):null;
     if(!proof||proof.expiresAt<=now||proof.memberKey!==memberKey||proof.generation!==m.generation||!target||target.expiresAt<=now)return reply({error:'Invalid extension grant'},422);
     proofDigest=proof.sessionDigest;await tx.delete('proof:'+body.proofNonce);
    }
    if(!body.approveSourceMessageId&&!proofDigest){
     // Unpinned intents may only exist when exactly one live session can consume
     // them, so the grant can never bind an arbitrary browser. Re-checked at extend.
     const live=[...sessions.values()].filter(s=>s.memberKey===memberKey&&s.expiresAt>now&&s.generation===m.generation);
     if(live.length!==1)return reply({error:live.length?'Ambiguous target browser: pin the approval source or re-enroll':'No live session to extend'},422);
    }
    const priorIntent=await tx.get('intent:'+memberKey);if(priorIntent&&priorIntent.sourceAt>=body.sourceAt)return reply({error:'Stale attestation'},409);
    await tx.put('source:'+body.sourceMessageId,{expiresAt:now+16*60000});
    await tx.put('intent:'+memberKey,{sourceMessageId:body.sourceMessageId,sourceAt:body.sourceAt,approveSourceMessageId:body.approveSourceMessageId??null,sessionDigest:proofDigest,expiresAt:now+15*60000});return reply({ok:true});
   }
   if(route==='sessions'){
    if(!/^member-[0-9]{2}$/.test(memberKey))return reply({error:'Invalid request'},422);
    const m=await tx.get('member:'+memberKey);
    const live=m?.active?[...sessions.values()].filter(s=>s.memberKey===memberKey&&s.expiresAt>now&&s.generation===m.generation):[];
    return reply({memberActive:!!m?.active,validUntil:m?.validUntil??null,liveSessions:live.length,extendedSessions:live.filter(s=>(s.grantUntil??0)>now).length,latestGrantUntil:live.reduce((a,s)=>Math.max(a,s.grantUntil??0),0)||null,intentPending:!!(await tx.get('intent:'+memberKey))});
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
    if(!p||p.consumed||p.expiresAt<=now||!p.memberKey||!m?.active||m.validUntil<=now||m.generation!==p.generation||(m.audience??'brainrot')!==currentAudience)return reply({error:'Not authorized'},401);
    if([...sessions.values()].filter(s=>s.memberKey===p.memberKey&&s.generation===m.generation).length>=3)return reply({error:'Not authorized'},401);
    const fresh=await createEnrollment(now),session={memberKey:p.memberKey,generation:m.generation,expiresAt:now+7*86400000,claimedAt:now,challenge,approvedSourceMessageId:p.sourceMessageId??null,approvedSourceAt:p.sourceAt??null};
    await tx.put('session:'+fresh.record.digest,session);await tx.delete('pending:'+challenge);await tx.delete('pending-digest:'+digest);return reply({secret:fresh.browserSecret,expiresAt:session.expiresAt});
   }
   if(route==='proof'){
    if(typeof body.secret!=='string'||body.secret.length!==43)return reply({error:'Not authorized'},401);
    const digest=await sessionDigest(body.secret),session=await tx.get('session:'+digest),m=session?await tx.get('member:'+session.memberKey):null;
    if(!session||session.expiresAt<=now||!m?.active||m.generation!==session.generation||(m.validUntil<=now&&(session.grantUntil??0)<=now))return reply({error:'Not authorized'},401);
    if([...proofs.values()].filter(p=>p.memberKey===session.memberKey&&p.expiresAt>now).length>=3)return reply({error:'Try later'},429);
    const nonce=(await createEnrollment(now)).publicChallenge;
    await tx.put('proof:'+nonce,{sessionDigest:digest,memberKey:session.memberKey,generation:m.generation,expiresAt:now+15*60000});
    return reply({nonce,expiresAt:now+15*60000});
   }
   if(route==='extend'){
    if(typeof body.secret!=='string'||body.secret.length!==43)return reply({error:'Not authorized'},401);
    const digest=await sessionDigest(body.secret),session=await tx.get('session:'+digest),m=session?await tx.get('member:'+session.memberKey):null;
    if(!session||session.expiresAt<=now||!m?.active||m.generation!==session.generation)return reply({error:'Not authorized'},401);
    if((session.grantUntil??0)>now)return reply({ok:true,expiresAt:session.expiresAt});
    const intent=await tx.get('intent:'+session.memberKey);
    if(!intent||intent.expiresAt<=now||(intent.approveSourceMessageId&&session.approvedSourceMessageId!==intent.approveSourceMessageId)||(intent.sessionDigest&&intent.sessionDigest!==digest))return reply({error:'No approved extension for this browser'},403);
    if(!intent.approveSourceMessageId&&!intent.sessionDigest){
     const live=[...sessions.values()].filter(s=>s.memberKey===session.memberKey&&s.expiresAt>now&&s.generation===m.generation);
     if(live.length!==1)return reply({error:'No approved extension for this browser'},403);
    }
    await tx.delete('intent:'+session.memberKey);
    // Hard cap: the session's own expiry, fixed at claim time as claim+7 days.
    // The extension never renews; a later grant cannot push it further out.
    await tx.put('session:'+digest,{...session,grantUntil:session.expiresAt,grantSourceMessageId:intent.sourceMessageId,grantSourceAt:intent.sourceAt});
    return reply({ok:true,expiresAt:session.expiresAt});
   }
   if(route==='audience'){
    if(typeof body.audience!=='string'||!/^[a-z0-9-]{1,32}$/.test(body.audience)||body.audience===currentAudience)return reply({error:'Invalid audience'},422);
    await tx.put('current:audience',body.audience);
    let invalidated=0;
    for(const [key,s] of sessions){const m=members.get('member:'+s.memberKey);if((m?.audience??'brainrot')!==body.audience){await tx.delete(key);invalidated++}}
    return reply({ok:true,audience:body.audience,invalidatedSessions:invalidated});
   }
   if(route==='revoke'){
    if(!/^member-[0-9]{2}$/.test(memberKey))return reply({error:'Invalid revocation'},422);
    const m=await tx.get('member:'+memberKey);if(!m)return reply({error:'Unknown member'},404);
    if(m.active){const tombstone={...m,active:false,generation:m.generation+1};await tx.put('member:'+memberKey,tombstone);members.set('member:'+memberKey,tombstone)}
    let removed=0;
    for(const [key,s] of sessions)if(s.memberKey===memberKey){await tx.delete(key);removed++}
    return reply({ok:true,memberKey,removedSessions:removed});
   }
   if(route==='check'||route==='logout'){
    if(typeof body.secret!=='string'||body.secret.length!==43)return reply({error:'Not authorized'},401);
    const digest=await sessionDigest(body.secret),session=await tx.get('session:'+digest),m=session?await tx.get('member:'+session.memberKey):null;
    if(route==='logout'){await tx.delete('session:'+digest);return reply({ok:true})}
    if(!session||session.expiresAt<=now||!m?.active||m.generation!==session.generation||(m.validUntil<=now&&(session.grantUntil??0)<=now))return reply({error:'Not authorized'},401);return reply({ok:true});
   }
   return reply({error:'Not found'},404);
  })}catch{return reply({error:'Not authorized'},401)}
 }
}
