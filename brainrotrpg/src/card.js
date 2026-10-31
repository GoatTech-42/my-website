export const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function wrapList(value,max=32,maxLines=3,fontSize=30){
 max=Math.min(max,Math.floor(880/(fontSize*1.1)));
 const tokens=String(value).split(/\s+/).flatMap(word=>word.match(new RegExp(`.{1,${max}}`,'gu'))??[]),out=[''];
 for(const word of tokens){if((out.at(-1)+' '+word).trim().length>max&&out.at(-1))out.push('');out[out.length-1]=(out.at(-1)+' '+word).trim()}
 if(out.length>maxLines){const shown=out.slice(0,maxLines);shown[shown.length-1]=Array.from(shown.at(-1)).slice(0,max-1).join('')+'…';return shown;}
 return out;
}
export function lines(value,max=32,maxLines=3,fontSize=30,lineGap=42){
 return wrapList(value,max,maxLines,fontSize).map((v,i)=>`<tspan x="48" dy="${i?lineGap:0}"${Array.from(v).length*fontSize>920?' textLength="920" lengthAdjust="spacingAndGlyphs"':''}>${esc(v)}</tspan>`).join('');
}
export function cardSvg(c,record){
 const stats=c.stats||null;
 const hasStats=!!stats; // a present stats object means the counters are tracked; null renders as unknown
 const h=hasStats?800:720;
 const show=v=>(v===null||v===undefined)?'?':v;
 const brand=esc(record?.snapshot?.title??'Brainrot RPG');
 const statY=578+(wrapList(c.location??'',58,2,26).length-1)*42;
 const statLine=hasStats?`<text x="48" y="${statY}" fill="#585541" font-family="sans-serif" font-size="24">Deaths ${show(stats.deaths)} \u00b7 Dmg ${show(stats.damageDealt)} dealt / ${show(stats.damageTaken)} taken \u00b7 Healed ${show(stats.healing)}</text>`:'';
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="${h}" viewBox="0 0 1080 ${h}" role="img" aria-label="${esc(c.name)} character status"><rect width="1080" height="${h}" fill="#f5e8cd" fill-opacity="0.9"/><rect x="0" y="0" width="1080" height="112" fill="#536143" fill-opacity="0.78"/><text x="48" y="69" fill="#fff6dd" font-family="sans-serif" font-size="28">${brand} / Character status</text><text x="48" y="182" fill="#342d21" font-family="Georgia,serif" font-size="46">${lines(c.name,36,2,46)}</text><text x="48" y="270" fill="#585541" font-family="sans-serif" font-size="26">${lines(c.classStyle??'',58,1,26)}</text><text x="48" y="342" fill="#805b19" font-family="Georgia,serif" font-size="72">${c.hp} / ${c.maxHp} HP</text><text x="48" y="410" fill="#342d21" font-family="sans-serif" font-size="28">${lines(c.status,58,2)}</text><text x="48" y="520" fill="#585541" font-family="sans-serif" font-size="26">${lines(c.location,58,2)}</text>${statLine}<text x="48" y="${h-112}" fill="#585541" font-family="sans-serif" font-size="20">Excerpt when shortened. Full details in the campaign record.</text><text x="48" y="${h-68}" fill="#585541" font-family="sans-serif" font-size="24">Saved revision ${record.version} / ${esc(record.savedAt)}</text></svg>`;
}

export function eventCardSvg(r,record){
 const math=`${r.dice.join(' + ')} ${r.modifier<0?'-':'+'} ${Math.abs(r.modifier)} = ${r.total}`;
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350"><rect width="1080" height="1350" fill="#f5e8cd" fill-opacity="0.9"/><rect width="1080" height="120" fill="#536143" fill-opacity="0.78"/><text x="48" y="75" font-family="sans-serif" font-size="32" fill="#fff6dd">${esc(record?.snapshot?.title??'Brainrot RPG')} / Resolved roll</text><text x="48" y="210" font-family="Georgia,serif" font-size="48" fill="#342d21">${lines(r.action,37,3,48)}</text><text x="48" y="510" font-family="Georgia,serif" font-size="120" fill="#805b19">${r.total}</text><text x="48" y="550" font-family="sans-serif" font-size="22" fill="#342d21">${lines(math+` (d${r.sides})`,45,10,22,28)}</text><text x="48" y="790" font-family="sans-serif" font-size="30" fill="#585541">${r.difficulty===undefined?'No DC recorded':`DC ${r.difficulty}`}</text><text x="48" y="850" font-family="sans-serif" font-size="30" fill="#342d21">${lines(r.outcome,50,8)}</text><text x="48" y="1220" fill="#585541" font-family="sans-serif" font-size="20">Excerpt when shortened. Full details in the campaign record.</text><text x="48" y="1270" font-family="sans-serif" font-size="25" fill="#585541">Saved revision ${record.version} / ${esc(record.savedAt)}</text></svg>`;
}
