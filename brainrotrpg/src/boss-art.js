// Deterministic boss crests: same boss always renders the same image.
// Only the inert renderer's allowlisted elements and attributes are emitted.
import {esc,lines} from './card.js';
function seedFrom(id){let h=2166136261;for(const ch of String(id))h=Math.imul(h^ch.codePointAt(0),16777619)>>>0;return h;}
function prng(seed){let a=seed;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const palettes=[
 {body:'#536143',shade:'#3d4a32',eye:'#f5e8cd'},
 {body:'#805b19',shade:'#5f4312',eye:'#fff6dd'},
 {body:'#4a3f5a',shade:'#372e45',eye:'#f5e8cd'},
 {body:'#3f5a52',shade:'#2e453f',eye:'#fff6dd'},
];
function crest(id){
 const rand=prng(seedFrom(id)),pal=palettes[Math.floor(rand()*palettes.length)];
 const cx=540,cy=330,half=120+rand()*70,top=cy-110-rand()*40,bottom=cy+130+rand()*40;
 const waist=half*(0.55+rand()*0.25);
 const body=`M${cx} ${top} C ${cx+half} ${top} ${cx+half} ${cy-40} ${cx+waist} ${cy+40} C ${cx+waist*0.9} ${cy+90} ${cx+half*0.5} ${bottom} ${cx} ${bottom} C ${cx-half*0.5} ${bottom} ${cx-waist*0.9} ${cy+90} ${cx-waist} ${cy+40} C ${cx-half} ${cy-40} ${cx-half} ${top} ${cx} ${top} Z`;
 let spikes='';const n=2+Math.floor(rand()*4);
 for(let i=0;i<n;i++){const t=n===1?0.5:i/(n-1),sx=cx-half*0.8+t*half*1.6,sy=top+18,len=50+rand()*70,w=16+rand()*14;
  spikes+=`<path d="M${sx-w/2} ${sy} L${sx} ${sy-len} L${sx+w/2} ${sy} Z" fill="${pal.shade}"/>`;}
 const eyeY=cy-30+rand()*20,eyeDx=34+rand()*26,eyeR=10+rand()*8;
 const brow=`<path d="M${cx-eyeDx-eyeR*1.6} ${eyeY-eyeR*2.2} L${cx-eyeDx+eyeR*1.4} ${eyeY-eyeR*3.1}" fill="none" stroke="${pal.shade}" stroke-width="6"/><path d="M${cx+eyeDx-eyeR*1.4} ${eyeY-eyeR*3.1} L${cx+eyeDx+eyeR*1.6} ${eyeY-eyeR*2.2}" fill="none" stroke="${pal.shade}" stroke-width="6"/>`;
 const eyes=`<circle cx="${cx-eyeDx}" cy="${eyeY}" r="${eyeR}" fill="${pal.eye}"/><circle cx="${cx+eyeDx}" cy="${eyeY}" r="${eyeR}" fill="${pal.eye}"/><circle cx="${cx-eyeDx}" cy="${eyeY}" r="${eyeR*0.4}" fill="${pal.shade}"/><circle cx="${cx+eyeDx}" cy="${eyeY}" r="${eyeR*0.4}" fill="${pal.shade}"/>${brow}`;
 const mouthY=cy+60+rand()*20,teeth=3+Math.floor(rand()*3);
 let maw=`<path d="M${cx-50} ${mouthY} Q ${cx} ${mouthY+26} ${cx+50} ${mouthY}" fill="none" stroke="${pal.shade}" stroke-width="7"/>`;
 for(let i=0;i<teeth;i++){const tx2=cx-40+i*(80/Math.max(1,teeth-1));maw+=`<path d="M${tx2-5} ${mouthY+4} L${tx2} ${mouthY+18} L${tx2+5} ${mouthY+4} Z" fill="${pal.eye}"/>`}
 const plate=`<path d="M${cx-half*0.55} ${cy+95} Q ${cx} ${cy+130} ${cx+half*0.55} ${cy+95}" fill="none" stroke="${pal.shade}" stroke-width="5" fill-opacity="0"/><path d="M${cx-half*0.4} ${cy+118} Q ${cx} ${cy+148} ${cx+half*0.4} ${cy+118}" fill="none" stroke="${pal.shade}" stroke-width="4"/>`;
 const ring=`<circle cx="${cx}" cy="${cy+10}" r="${half+46}" fill="none" stroke="${pal.body}" stroke-width="3"/>`;
 return {svg:`${ring}${spikes}<path d="${body}" fill="${pal.body}"/>${plate}${eyes}${maw}`,pal};
}
export function bossCardSvg(b,record){
 const defeated=b.state==='defeated',{svg,pal}=crest(b.id);
 const stateLine=defeated?`Defeated${b.defeatedBy?.length?' by '+b.defeatedBy.join(', '):''}${b.defeatedAt?' / '+b.defeatedAt:''}`:'Active threat';
 const cracks=defeated?`<path d="M420 180 L480 300 L450 380 L510 470" fill="none" stroke="#f5e8cd" stroke-width="6"/><path d="M660 200 L620 320 L670 400 L640 500" fill="none" stroke="#f5e8cd" stroke-width="6"/>`:'';
 const veil=defeated?`<rect width="1080" height="720" fill="#f5e8cd" fill-opacity="0.45"/>`:'';
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="720" viewBox="0 0 1080 720" role="img" aria-label="${esc(b.name)} boss status"><rect width="1080" height="720" fill="#f5e8cd" fill-opacity="0.9"/><rect x="0" y="0" width="1080" height="112" fill="${pal.shade}" fill-opacity="0.85"/><text x="48" y="69" fill="#fff6dd" font-family="sans-serif" font-size="28">Brainrot RPG / Boss record</text><g>${svg}${cracks}</g>${veil}<rect x="0" y="560" width="1080" height="160" fill="#f5e8cd" fill-opacity="0.92"/><text x="48" y="612" fill="#342d21" font-family="Georgia,serif" font-size="44">${lines(b.name,38,1,44)}</text><text x="48" y="652" fill="${defeated?'#536143':'#805b19'}" font-family="sans-serif" font-size="26">${lines(stateLine,60,1,26)}</text><text x="48" y="692" fill="#585541" font-family="sans-serif" font-size="20">${lines(b.summary,64,1,20,26)} Saved revision ${record.version} / ${esc(record.savedAt)}</text></svg>`;
}
