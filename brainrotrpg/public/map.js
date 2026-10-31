// Deterministic local 3D map. No network, credentials or paid services.
// Terrain is illustrative only; recorded markers are the campaign facts.
const SEED=20261030;
function prng(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const rand=prng(SEED),PERM=[...Array(256)].map(()=>rand());
function noise(x,y){
 const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,h=(i,j)=>PERM[((xi+i)*73+(yi+j)*149)%256&255];
 const sx=xf*xf*(3-2*xf),sy=yf*yf*(3-2*yf);
 const a=h(0,0),b=h(1,0),c=h(0,1),d=h(1,1);
 return a+(b-a)*sx+(c-a)*sy+(a-b-c+d)*sx*sy;
}
export function heightAt(x,y){
 let h=0,amp=1,f=1/220,tot=0;
 for(let o=0;o<4;o++){h+=noise(x*f,y*f)*amp;tot+=amp;amp*=0.5;f*=2.1}
 return (h/tot)*150-30;
}
const KINDS={ruin:'Ruin',settlement:'Settlement',wilds:'Wilds',dungeon:'Dungeon',water:'Water',mystic:'Mystic site'};
function perspective(fov,asp,near,far){const t=1/Math.tan(fov/2),d=1/(near-far);return[t/asp,0,0,0,0,t,0,0,0,0,(far+near)*d,-1,0,0,2*far*near*d,0]}
function lookAt(ex,ey,ez,tx,ty,tz){
 let fx=tx-ex,fy=ty-ey,fz=tz-ez;const fl=Math.hypot(fx,fy,fz);fx/=fl;fy/=fl;fz/=fl;
 const up=[0,1,0];
 let rx=fy*up[2]-fz*up[1],ry=fz*up[0]-fx*up[2],rz=fx*up[1]-fy*up[0];
 const rl=Math.hypot(rx,ry,rz)||1;rx/=rl;ry/=rl;rz/=rl;
 const ux=ry*fz-rz*fy,uy=rz*fx-rx*fz,uz=rx*fy-ry*fx;
 return[rx,ux,-fx,0,ry,uy,-fy,0,rz,uz,-fz,0,-(rx*ex+ry*ey+rz*ez),-(ux*ex+uy*ey+uz*ez),fx*ex+fy*ey+fz*ez,1];
}
function multiply(a,b){const o=new Array(16).fill(0);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o}
function project(m,x,y,z){
 const cx=m[0]*x+m[4]*y+m[8]*z+m[12],cy=m[1]*x+m[5]*y+m[9]*z+m[13],cw=m[3]*x+m[7]*y+m[11]*z+m[15];
 if(cw<=0)return null;return[cx/cw,cy/cw];
}
const VERT=`attribute vec3 p;attribute vec3 c;uniform mat4 m;varying vec3 v;varying float d;void main(){vec4 o=m*vec4(p,1.0);v=c;d=o.w;gl_Position=o;}`;
const FRAG=`precision mediump float;varying vec3 v;varying float d;void main(){float f=clamp((d-700.0)/1400.0,0.0,0.85);gl_FragColor=vec4(mix(v,vec3(0.949,0.929,0.867),f),1.0);}`;
function hex(h){return[parseInt(h.slice(1,3),16)/255,parseInt(h.slice(3,5),16)/255,parseInt(h.slice(5,7),16)/255]}
const LOW=hex('#dccfa6'),MID=hex('#c3b384'),HIGH=hex('#9d8f63'),ROCK=hex('#71664c'),WATER=hex('#7fa38e'),SUN=(()=>{const l=Math.hypot(0.5,0.8,0.3);return[0.5/l,0.8/l,0.3/l]})();
// Explored-region rendering: only recorded regions get terrain and biome;
// everything else is honest blank fog. Biomes come from canonical records,
// never derived from noise or coordinates.
const PARCHMENT=hex('#efe8d2');
const BIOME={water:hex('#7fa38e'),marsh:hex('#a9b78a'),meadow:hex('#b9bd7d'),forest:hex('#87986a'),field:hex('#dcc98f'),rock:hex('#71664c')};
function regionAt(x,y,explored){
 for(const e of explored||[]){const d=Math.hypot(x-e.x,y-e.y);if(d<e.radius)return{biome:e.biome,edge:Math.max(0,Math.min(1,(e.radius-d)/(e.radius*0.25)))}}
 return null;
}
function heightFor(x,y,explored){
 const r=regionAt(x,y,explored);
 return r?heightAt(x,y)*Math.min(1,r.edge+0.35):0;
}
function terrainColor(x,y,explored){
 const r=regionAt(x,y,explored);
 if(!r)return PARCHMENT;
 const h=heightAt(x,y),base0=BIOME[r.biome]||BIOME.field;
 let base=r.biome!=='water'&&h<26?base0.map((c,i)=>c+(BIOME.water[i]-c)*Math.max(0,(12-h)/22)):base0;
 const e=2,hx=heightAt(x+e,y)-heightAt(x-e,y),hy=heightAt(x,y+e)-heightAt(x,y-e);
 let nx=-hx/(2*e),ny=1,nz=-hy/(2*e);const l=Math.hypot(nx,ny,nz);nx/=l;ny/=l;nz/=l;
 let shade=0.42+0.58*Math.max(0,nx*SUN[0]+ny*SUN[1]+nz*SUN[2]);
 if(h>=4&&(((h%18)+18)%18)<1.6)shade*=0.88; // contour lines
 const c=base.map(v=>Math.min(1,v*shade));
 return c.map((v,i)=>v+(PARCHMENT[i]-v)*(1-r.edge));
}
// Deterministic vegetation inside recorded explored regions only.
function buildVegetation(explored){
 const r=prng(SEED^0x5eed),pos=[],col=[];
 const tree=hex('#42563a'),treeDark=hex('#2f4028'),trunk=hex('#5f4a2e'),grass=hex('#a9ad6d'),reed=hex('#8a9460');
 const quad=(ax,ay,az,bx,by,bz,cx,cy,cz,dx,dy,dz,c1)=>{pos.push(ax,ay,az,bx,by,bz,cx,cy,cz,ax,ay,az,cx,cy,cz,dx,dy,dz);col.push(...c1,...c1,...c1,...c1,...c1,...c1)};
 for(let i=0;i<2600;i++){
  const x=r()*1000,y=r()*1000,reg=regionAt(x,y,explored);
  if(!reg||reg.edge<0.5)continue;
  const h=heightFor(x,y,explored),b=reg.biome,q=r();
  if(b==='forest'&&q<0.16){
   const rad=6+r()*5,th=5,hh=18+r()*14,ay=h+th+hh;
   quad(x-1.2,h,y,x+1.2,h,y,x+1.2,h+th,y,x-1.2,h+th,y,trunk);
   const cs=[[x-rad,h+th,y-rad],[x+rad,h+th,y-rad],[x+rad,h+th,y+rad],[x-rad,h+th,y+rad]];
   for(let f=0;f<4;f++){const a=cs[f],b2=cs[(f+1)%4],shade=f%2?treeDark:tree;
    pos.push(a[0],a[1],a[2],b2[0],b2[1],b2[2],x,ay,y);col.push(...shade,...shade,...treeDark)}
  }else if((b==='meadow'||b==='field')&&q<0.3){
   for(let k=0;k<3;k++){const ox=(r()-0.5)*12,oy=(r()-0.5)*12,bh=heightFor(x+ox,y+oy,explored),gh=3+r()*4;
    pos.push(x+ox-1.1,bh,y+oy,x+ox+1.1,bh,y+oy,x+ox,bh+gh,y+oy);col.push(...grass,...grass,...grass)}
  }else if(b==='marsh'&&q<0.35){
   pos.push(x-1,h,y,x+1,h,y,x,h+6+r()*4,y);col.push(...reed,...reed,...reed);
  }
 }
 return{pos:new Float32Array(pos),col:new Float32Array(col)};
}
function buildMesh(n,explored){
 const step=1000/n,pos=[],col=[],idx=[];
 for(let j=0;j<=n;j++)for(let i=0;i<=n;i++){const x=i*step,y=j*step;pos.push(x,heightFor(x,y,explored),y);col.push(...terrainColor(x,y,explored))}
 for(let j=0;j<n;j++)for(let i=0;i<n;i++){const a=j*(n+1)+i,b=a+1,c=a+n+1,d=c+1;idx.push(a,c,b,b,c,d)}
 return{pos:new Float32Array(pos),col:new Float32Array(col),idx:new Uint16Array(idx)};
}
let stage,canvas,detail,listEl,markersEl,gl,prog,count,matrix,dirty=true,fallback=false,current,resizeObs,vegBufs,meshBufs,mode='chart',meshKey=null,currentExplored=[],ctx2d=null,ctxKind=null;
const cam={az:0.42,tilt:0.46,dist:1250,tx:500,ty:500};
const CAM_HOME={...cam};let lastInteract=0,mapVisible=false;
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const paused=()=>document.body.classList.contains('paused')||document.hidden;
// A canvas element's context kind is immutable; swap the element to switch modes.
function freshCanvas(){
 const next=canvas.cloneNode(false);canvas.replaceWith(next);canvas=next;
 const r=stage.getBoundingClientRect();canvas.width=Math.max(2,Math.round(r.width*devicePixelRatio));canvas.height=Math.max(2,Math.round(r.height*devicePixelRatio));
}
function setCanvas2d(){if(ctxKind==='2d')return true;freshCanvas();ctx2d=canvas.getContext('2d');ctxKind='2d';gl=null;return!!ctx2d}
function initGl(){
 if(ctxKind==='webgl'&&gl)return true;
 freshCanvas();
 gl=canvas.getContext('webgl',{antialias:true});
 if(!gl){ctxKind=null;return false}
 ctxKind='webgl';
 const sh=(t,s2)=>{const o=gl.createShader(t);gl.shaderSource(o,s2);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(o));return o};
 prog=gl.createProgram();gl.attachShader(prog,sh(gl.VERTEX_SHADER,VERT));gl.attachShader(prog,sh(gl.FRAGMENT_SHADER,FRAG));gl.linkProgram(prog);
 if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw new Error('link');
 gl.useProgram(prog);gl.enable(gl.DEPTH_TEST);
 buildBuffers(currentExplored);
 return true;
}
function draw(){
 const w=canvas.width,h=canvas.height;
 if(mode==='chart'){if(setCanvas2d())drawChart(w,h);return}
 if(!gl){try{if(!initGl())fallback=true}catch{fallback=true}}
 if(fallback){if(setCanvas2d())draw2d(w,h);return}
 const ct=Math.cos(cam.tilt),eye=[cam.tx+cam.dist*Math.sin(cam.az)*ct,cam.dist*Math.sin(cam.tilt),cam.ty+cam.dist*Math.cos(cam.az)*ct];
 const asp=w/h;matrix=multiply(perspective(asp<0.8?1.02:asp<1.2?0.88:0.78,asp,10,6000),lookAt(eye[0],eye[1],eye[2],cam.tx,-10,cam.ty));
 gl.viewport(0,0,w,h);gl.clearColor(0.949,0.929,0.867,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
 gl.useProgram(prog);gl.uniformMatrix4fv(gl.getUniformLocation(prog,'m'),false,new Float32Array(matrix));
 const lp=gl.getAttribLocation(prog,'p'),lc=gl.getAttribLocation(prog,'c');
 gl.bindBuffer(gl.ARRAY_BUFFER,meshBufs.pos);gl.enableVertexAttribArray(lp);gl.vertexAttribPointer(lp,3,gl.FLOAT,false,0,0);
 gl.bindBuffer(gl.ARRAY_BUFFER,meshBufs.col);gl.enableVertexAttribArray(lc);gl.vertexAttribPointer(lc,3,gl.FLOAT,false,0,0);
 gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,meshBufs.idx);
 gl.drawElements(gl.TRIANGLES,count,gl.UNSIGNED_SHORT,0);
 if(vegBufs){gl.bindBuffer(gl.ARRAY_BUFFER,vegBufs.pos);gl.vertexAttribPointer(lp,3,gl.FLOAT,false,0,0);
  gl.bindBuffer(gl.ARRAY_BUFFER,vegBufs.col);gl.vertexAttribPointer(lc,3,gl.FLOAT,false,0,0);
  gl.drawArrays(gl.TRIANGLES,0,vegBufs.n)}
}

// Live campaign view: an uncharted chart. Only recorded markers exist; the fog
// is honest absence, never invented geography. Demo mode alone shows scenery.
function drawChart(w,h){
 const ctx=canvas.getContext('2d');
 ctx.fillStyle='#efe8d2';ctx.fillRect(0,0,w,h);
 const scale=w/cam.dist,ox=w/2-cam.tx*scale,oy=h/2-cam.ty*scale;
 ctx.strokeStyle='rgba(40,45,36,.10)';ctx.lineWidth=1;
 for(let g=0;g<=1000;g+=100){ctx.beginPath();ctx.moveTo(ox+g*scale,0);ctx.lineTo(ox+g*scale,h);ctx.stroke();ctx.beginPath();ctx.moveTo(0,oy+g*scale);ctx.lineTo(w,oy+g*scale);ctx.stroke()}
 // revealed discs around recorded points only
 const pts=[];
 if(current?.snapshot.worldMap){
  const wm=current.snapshot.worldMap;
  for(const l of wm.landmarks)pts.push([l.x,l.y]);
  if(wm.party.x!==undefined)pts.push([wm.party.x,wm.party.y]);
  for(const b of wm.bosses)pts.push([b.x,b.y]);
 }
 for(const [px,py] of pts){
  const sx=ox+px*scale,sy=oy+py*scale,r=Math.max(70,scale*70);
  const grad=ctx.createRadialGradient(sx,sy,4,sx,sy,r);
  grad.addColorStop(0,'rgba(220,201,143,.85)');grad.addColorStop(1,'rgba(220,201,143,0)');
  ctx.fillStyle=grad;ctx.beginPath();ctx.arc(sx,sy,r,0,7);ctx.fill();
 }
 ctx.save();ctx.translate(w/2,h/2);ctx.rotate(-0.08);
 ctx.font=`600 ${Math.min(w,h)/6}px Georgia,serif`;ctx.textAlign='center';
 ctx.fillStyle='rgba(40,45,36,.07)';ctx.fillText('UNCHARTED',0,0);
 ctx.restore();
}

function draw2d(w,h){
 const ctx=ctx2d,n=140,img=ctx.createImageData(n,n);
 for(let j=0;j<n;j++)for(let i=0;i<n;i++){const c=terrainColor(i/n*1000,j/n*1000,currentExplored),k=(j*n+i)*4;img.data[k]=c[0]*255;img.data[k+1]=c[1]*255;img.data[k+2]=c[2]*255;img.data[k+3]=255}
 const off=document.createElement('canvas');off.width=off.height=n;off.getContext('2d').putImageData(img,0,0);
 ctx.imageSmoothingEnabled=true;ctx.drawImage(off,0,0,w,h);
}
function screenPos(wx,wy,w,h){
 if(mode==='chart'){const scale=w/cam.dist;return{x:(wx-cam.tx)*scale+w/2,y:(wy-cam.ty)*scale+h/2,ok:true}}
 if(fallback)return{x:(wx-cam.tx+500)/1000*w,y:(wy-cam.ty+500)/1000*h,ok:true};
 const p=matrix&&project(matrix,wx,heightFor(wx,wy,currentExplored)+30,wy);
 return p?{x:(p[0]+1)/2*w,y:(1-p[1])/2*h,ok:true}:{ok:false};
}
function placeMarkers(){
 if(!current)return;
 const w=canvas.clientWidth,h=canvas.clientHeight,items=[];
 for(const m of markersEl.children){
  const s=screenPos(+m.dataset.x,+m.dataset.y,w,h);
  m._sx=s.x;m._sy=s.y;m._dx=0;m._dy=0;
  if(!s.ok){m.style.display='none';continue}
  m.style.display='';items.push(m);
 }
 // declutter: push overlapping markers apart, stems point back to the true position
 for(let pass=0;pass<6;pass++){
  for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){
   const a=items[i],b=items[j];let dx=(b._sx+b._dx)-(a._sx+a._dx),dy=(b._sy+b._dy)-(a._sy+a._dy);
   const d=Math.hypot(dx,dy),min=64;
   if(d<min){if(d<0.01){dx=0.1;dy=0.1}else{dx/=d;dy/=d}const push=(min-d)/2;a._dx-=dx*push;a._dy-=dy*push;b._dx+=dx*push;b._dy+=dy*push;}
  }
 }
 for(const m of items){
  const x=m._sx+m._dx,y=m._sy+m._dy;
  m.style.transform=`translate(-50%,-100%) translate(${x}px,${y}px)`;
  const stem=m.firstElementChild&&m.firstElementChild.classList?.contains('map-stem')?m.firstElementChild:null;
  const dist=Math.hypot(m._dx,m._dy);
  if(stem){if(dist>8){const ang=Math.atan2(-m._dx,m._dy);stem.style.display='';stem.style.height=`${dist+6}px`;stem.style.transform=`translate(-50%,2px) rotate(${ang}rad)`;stem.style.transformOrigin='top center'}else stem.style.display='none'}
 }
}
function frame(t){
 if(mapVisible&&mode==='terrain'&&!paused()&&!reduced()&&Date.now()-lastInteract>6000){cam.az=CAM_HOME.az+Math.sin(t*0.00006)*0.09;dirty=true}
 if(dirty){draw();placeMarkers();dirty=false}
 requestAnimationFrame(frame);
}
function interact(){lastInteract=Date.now();dirty=true}
function bindControls(){
 const pointers=new Map();let pinch=0;
 stage.addEventListener('pointerdown',e=>{if(e.target!==canvas)return;stage.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const[p,q]=[...pointers.values()];pinch=Math.hypot(p.x-q.x,p.y-q.y)}});
 stage.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;const prev=pointers.get(e.pointerId);const dx=e.clientX-prev.x,dy=e.clientY-prev.y;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});interact();
  if(pointers.size===1){
   if(mode==='chart'){const scale=canvas.clientWidth/cam.dist;cam.tx=Math.min(1200,Math.max(-200,cam.tx-dx/scale));cam.ty=Math.min(1200,Math.max(-200,cam.ty-dy/scale))}
   else{cam.az-=dx*0.005;cam.tilt=Math.min(1.1,Math.max(0.2,cam.tilt+dy*0.004))}
  }
  else if(pointers.size===2){const[p,q]=[...pointers.values()];const d=Math.hypot(p.x-q.x,p.y-q.y);if(pinch)cam.dist=Math.min(2200,Math.max(420,cam.dist*pinch/Math.max(1,d)));pinch=d}});
 const end=e=>{pointers.delete(e.pointerId);if(pointers.size<2)pinch=0};
 stage.addEventListener('pointerup',end);stage.addEventListener('pointercancel',end);
 stage.addEventListener('wheel',e=>{e.preventDefault();interact();cam.dist=Math.min(2200,Math.max(420,cam.dist*Math.exp(e.deltaY*0.0012)))},{passive:false});
 const zoom=f=>()=>{interact();cam.dist=Math.min(2200,Math.max(420,cam.dist*f))};
 document.querySelector('#map-zoom-in').onclick=zoom(0.8);document.querySelector('#map-zoom-out').onclick=zoom(1.25);
 document.querySelector('#map-reset').onclick=()=>{Object.assign(cam,CAM_HOME);interact()};
}
function showDetail(node,scroll=true){detail.replaceChildren(node);if(scroll)detail.scrollIntoView({behavior:reduced()||paused()?'auto':'smooth',block:'nearest'})}
function wrap(title,sub){const d=document.createElement('div');const h=document.createElement('h3');h.textContent=title;d.append(h);if(sub){const p=document.createElement('p');p.className='map-kind';p.textContent=sub;d.append(p)}return d}
function para(d,text,cls){const p=document.createElement('p');if(cls)p.className=cls;p.textContent=text;d.append(p);return d}
function landmarkDetail(l,snap){
 const d=wrap(l.name,KINDS[l.kind]??'Landmark');para(d,l.summary);
 if(l.loreId){const lore=snap.lore.find(x=>x.id===l.loreId);if(lore){para(d,'What happened here','map-kind');para(d,`${lore.title} - ${lore.text}`)}else para(d,'Its story is not recorded yet.')}
 else para(d,'Its story is not recorded yet.');
 return d;
}
function partyDetail(p,snap){
 const d=wrap('The party',p.status==='formed'?'Formed':'No party has formed yet');
 if(p.label)para(d,p.label);
 if(p.characterIds.length){const names=p.characterIds.map(id=>snap.characters.find(c=>c.id===id)).filter(Boolean).map(c=>`${c.name} (${c.hp} of ${c.maxHp} HP, ${c.status})`);para(d,names.length?names.join(' / '):'Members not recorded.')}
 else para(d,'No members recorded.');
 if(p.x===undefined)para(d,'Position unrecorded.');else if(!p.label)para(d,'Marker shows the recorded position.');
 return d;
}
function bossDetail(b,snap,meta){
 const d=wrap(b.name,b.state==='defeated'?'Defeated boss':'Active boss');para(d,b.summary);
 if(b.state==='defeated'){if(b.defeatedBy?.length){const names=b.defeatedBy.map(id=>snap.characters.find(c=>c.id===id)?.name??id);para(d,'Defeated by '+names.join(', '))}if(b.defeatedAt)para(d,b.defeatedAt,'map-kind')}
 if(b.loreId){const lore=snap.lore.find(x=>x.id===b.loreId);if(lore){para(d,'What happened','map-kind');para(d,`${lore.title} - ${lore.text}`)}}
 if(!meta.demo){const img=document.createElement('img');img.className='boss-card';img.alt=`${b.name} boss record image`;img.src=`/api/map/bosses/${encodeURIComponent(b.id)}.svg?version=${meta.version}`;d.append(img)}
 return d;
}

// Illustrated marker icons, drawn locally on canvas. Deterministic per marker id.
function seedStr(t){let h=2166136261;for(const ch of String(t))h=Math.imul(h^ch.codePointAt(0),16777619)>>>0;return h}
function iconURL(kind,key,defeated){
 const r=prng(seedStr(kind+':'+key)),c=document.createElement('canvas');c.width=c.height=96;const x=c.getContext('2d');
 const ink='#282d24';
 x.beginPath();x.arc(48,48,45,0,7);x.fillStyle=defeated?'#e3dcc6':'#f5e8cd';x.fill();
 x.lineWidth=5;x.strokeStyle=defeated?'#8f8672':kind==='boss'?'#7a2e1d':kind==='party'?ink:'#536143';x.stroke();
 x.save();x.beginPath();x.arc(48,48,40,0,7);x.clip();
 x.lineWidth=3;x.lineCap='round';
 if(kind==='ruin'){
  x.fillStyle='#8a8272';x.fillRect(32,32,22,42);x.fillRect(58,50,12,24);
  x.fillStyle='#6b6152';for(let i=0;i<3;i++)x.fillRect(32+i*8,26,5,8);
  x.fillStyle='#2e2a22';x.beginPath();x.arc(43,62,6,Math.PI,0);x.fill();x.fillRect(37,62,12,12);
  x.strokeStyle='#6b6152';x.beginPath();x.moveTo(58,50);x.lineTo(64,42+r()*6);x.lineTo(70,50);x.stroke();
 }else if(kind==='dungeon'){
  x.fillStyle='#3a3344';x.beginPath();x.arc(48,52,20,Math.PI,0);x.fill();x.fillRect(28,52,40,24);
  x.fillStyle='#f5e8cd';for(let i=0;i<3;i++)x.fillRect(38+i*4,58+i*6,20-i*4,3);
 }else if(kind==='wilds'){
  x.fillStyle='#3f5a52';
  for(const[tx,ty,ts] of [[30,52,16],[50,44,20],[66,54,14]]){
   x.beginPath();x.moveTo(tx,ty+ts);x.lineTo(tx+ts*0.55,ty+ts);x.lineTo(tx+ts*0.28,ty-ts*0.6);x.fill();
   x.fillStyle='#5f4a2e';x.fillRect(tx+ts*0.22,ty+ts,3,6);x.fillStyle='#3f5a52';
  }
 }else if(kind==='settlement'){
  x.fillStyle='#805b19';x.beginPath();x.moveTo(28,54);x.lineTo(48,32);x.lineTo(68,54);x.fill();
  x.fillStyle='#a5824a';x.fillRect(34,54,28,20);x.fillStyle='#2e2a22';x.fillRect(44,60,8,14);
 }else if(kind==='water'){
  x.strokeStyle='#4a6a78';for(let i=0;i<3;i++){x.beginPath();const y=44+i*12;x.moveTo(26,y);x.quadraticCurveTo(36,y-8,46,y);x.quadraticCurveTo(56,y+8,66,y);x.stroke()}
 }else if(kind==='mystic'){
  x.fillStyle='#775b24';x.beginPath();x.moveTo(48,24);x.lineTo(62,46);x.lineTo(48,74);x.lineTo(34,46);x.fill();
  x.fillStyle='rgba(245,232,205,.5)';x.beginPath();x.moveTo(48,24);x.lineTo(62,46);x.lineTo(48,50);x.fill();
 }else if(kind==='party'){
  x.strokeStyle=ink;x.beginPath();x.moveTo(36,24);x.lineTo(36,74);x.stroke();
  x.fillStyle='#775b24';x.beginPath();x.moveTo(36,26);x.quadraticCurveTo(56,28+r()*6,66,32);x.quadraticCurveTo(56,38,36,42);x.fill();
 }else if(kind==='boss'){
  const bone=defeated?'#c9c2ae':'#efe3c8';
  x.fillStyle='#71664c';
  x.beginPath();x.moveTo(32,36);x.lineTo(26,12+r()*8);x.lineTo(42,30);x.fill();
  x.beginPath();x.moveTo(64,36);x.lineTo(70,12+r()*8);x.lineTo(54,30);x.fill();
  x.fillStyle=bone;x.beginPath();x.arc(48,46,20,0,7);x.fill();
  x.fillRect(38,58,20,14);
  x.fillStyle=ink;x.beginPath();x.arc(41,44,4.6,0,7);x.fill();x.beginPath();x.arc(55,44,4.6,0,7);x.fill();
  x.beginPath();x.moveTo(48,50);x.lineTo(44.5,56);x.lineTo(51.5,56);x.fill();
  x.strokeStyle=ink;x.lineWidth=1.6;for(let i=0;i<4;i++){x.beginPath();x.moveTo(41+i*4,60);x.lineTo(41+i*4,70);x.stroke()}
  if(defeated){x.strokeStyle=ink;x.lineWidth=2;x.beginPath();x.moveTo(52,26);x.lineTo(46,40);x.lineTo(52,52);x.stroke()}
 }
 x.restore();
 if(defeated){x.strokeStyle='#8f8672';x.lineWidth=3;x.beginPath();x.moveTo(34,20);x.lineTo(46,44);x.lineTo(40,60);x.lineTo(52,80);x.stroke()}
 return c.toDataURL();
}
function markerButton(cls,short,label,x,y,onclick,kind,key,defeated){
 const b=document.createElement('button');b.className='map-marker '+cls;b.type='button';b.dataset.x=x;b.dataset.y=y;
 b.setAttribute('aria-label',label);b.onclick=onclick;b.style.backgroundImage=`url(${iconURL(kind,key,defeated)})`;
 const stem=document.createElement('span');stem.className='map-stem';stem.style.display='none';b.append(stem);
 const tag=document.createElement('span');tag.className='map-label';tag.textContent=short;b.append(tag);
 return b;
}
function exploredFromMeta(meta){return meta.snapshot.worldMap?.explored??[]}
function buildBuffers(explored){
 const mesh=buildMesh(96,explored);count=mesh.idx.length;
 const mk=data=>{const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);return b};
 meshBufs={pos:mk(mesh.pos),col:mk(mesh.col),idx:gl.createBuffer()};
 gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,meshBufs.idx);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,mesh.idx,gl.STATIC_DRAW);
 const veg=buildVegetation(explored);vegBufs={n:veg.pos.length/3,pos:mk(veg.pos),col:mk(veg.col)};
 meshKey=JSON.stringify(explored);
}
export function renderMap(meta){
 current=meta;const snap=meta.snapshot,wm=snap.worldMap;
 currentExplored=exploredFromMeta(meta);
 mode=(meta.demo||currentExplored.length)?'terrain':'chart';
 if(!stage){stage=document.querySelector('.map-stage');canvas=document.querySelector('#map-canvas');detail=document.querySelector('#map-detail');listEl=document.querySelector('#map-list');markersEl=document.createElement('div');markersEl.className='map-markers';stage.append(markersEl);
  // Contexts are created lazily per mode (chart 2D vs terrain WebGL).
  if(mode==='terrain'){try{if(!initGl())fallback=true}catch{fallback=true}}
  const size=()=>{const r=stage.getBoundingClientRect();canvas.width=Math.max(2,Math.round(r.width*devicePixelRatio));canvas.height=Math.max(2,Math.round(r.height*devicePixelRatio));dirty=true};
  resizeObs=new ResizeObserver(size);resizeObs.observe(stage);size();
  // Still paint dirty initial/updated state offscreen, but never idle-drift it there.
  if('IntersectionObserver' in window)new IntersectionObserver(([e])=>{mapVisible=e.isIntersecting;if(mapVisible)dirty=true}).observe(stage);
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',()=>{dirty=true});
  bindControls();
  requestAnimationFrame(frame);
 }
 if(ctxKind==='webgl'&&gl&&JSON.stringify(currentExplored)!==meshKey)buildBuffers(currentExplored);
 markersEl.replaceChildren();listEl.replaceChildren();
 const note=document.querySelector('.map-note');
 if(note)note.textContent=mode==='chart'?'Only recorded places appear. Everything else is uncharted.':meta.demo?'Terrain is illustrative, not recorded geography. Only named markers are campaign facts.':'Only recorded explored regions and their recorded biomes are drawn; relief and vegetation are illustrative. Unexplored areas stay blank.';
 const empty=document.querySelector('#map-empty');
 if(!wm||(!wm.landmarks.length&&!wm.bosses.length&&wm.party.status==='unformed'&&wm.party.x===undefined)){
  empty.hidden=false;
  showDetail(para(wrap('The world is uncharted','No recorded map yet'),'Landmarks, the party position and bosses will appear here as the group records them.'),false);
  dirty=true;return;
 }
 empty.hidden=true;
 const add=(btn)=>{markersEl.append(btn);const item=document.createElement('li');const b=document.createElement('button');b.type='button';b.textContent=btn.getAttribute('aria-label');b.onclick=btn.onclick;item.append(b);listEl.append(item)};
 for(const l of wm.landmarks)add(markerButton('marker-landmark marker-'+l.kind,l.name,l.name+' ('+(KINDS[l.kind]??'landmark')+')',l.x,l.y,()=>showDetail(landmarkDetail(l,snap)),l.kind,l.id,false));
 if(wm.party.x!==undefined)add(markerButton('marker-party','Party','Party marker - see what is going on',wm.party.x,wm.party.y,()=>showDetail(partyDetail(wm.party,snap)),'party','party',false));
 else{const item=document.createElement('li');item.textContent=wm.party.status==='formed'?'Party position unrecorded.':'No party has formed yet.';listEl.append(item)}
 for(const b of wm.bosses)add(markerButton('marker-boss '+(b.state==='defeated'?'marker-defeated':'marker-active'),b.name,b.name+' ('+(b.state==='defeated'?'defeated boss':'active boss')+')',b.x,b.y,()=>showDetail(bossDetail(b,snap,meta)),'boss',b.id,b.state==='defeated'));
 showDetail(para(wrap('The recorded world',meta.demo?'Fictional design preview':'Revision '+meta.version),'Select a marker to read its record. Drag to orbit, scroll or pinch to zoom.'),false);
 dirty=true;
}
