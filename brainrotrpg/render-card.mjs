// Executor-only inert image adapter. No browser, scripts, credentials or network.
import {DOMParser} from '@xmldom/xmldom';import sharp from 'sharp';import fs from 'node:fs/promises';
export async function renderCard(input,output){
 const svg=await fs.readFile(input,'utf8');if(svg.length>200000||/<!DOCTYPE|<!ENTITY/i.test(svg))throw Error('Unsafe SVG input');
 let parseError=false;const doc=new DOMParser({onError:()=>{parseError=true}}).parseFromString(svg,'image/svg+xml');
 const allowed=new Set(['svg','rect','text','tspan','path','g','circle']);const attrs=new Set(['xmlns','width','height','viewBox','role','aria-label','x','y','dy','textLength','lengthAdjust','fill-opacity','fill','stroke','stroke-width','d','font-family','font-size','cx','cy','r']);
 if(parseError||doc.documentElement?.tagName!=='svg')throw Error('Unsafe SVG input');
 for(let n=doc.firstChild;n;n=n.nextSibling)if(n!==doc.documentElement&&!(n.nodeType===3&&!n.data.trim()))throw Error('Extra SVG content');
 function walk(n){if(n.nodeType===3)return;if(n.nodeType!==1||!allowed.has(n.tagName))throw Error('Unsafe SVG element');for(const a of Array.from(n.attributes))if(!attrs.has(a.name)||/url\s*\(|javascript:|data:/i.test(a.value))throw Error('Unsafe SVG attribute');for(let c=n.firstChild;c;c=c.nextSibling)walk(c)}walk(doc.documentElement);
 const width=Number(doc.documentElement.getAttribute('width')),height=Number(doc.documentElement.getAttribute('height'));if(width!==1080||![720,800,1350].includes(height))throw Error('Invalid card dimensions');
 // Art is a fixed local approved background, never an SVG-provided URL.
 const art=new URL('./public/assets/golden.webp',import.meta.url);
 const background=await sharp(await fs.readFile(art)).resize(width,height,{fit:'cover'}).toBuffer();
 await sharp(background).composite([{input:Buffer.from(svg)}]).png().toFile(output);
}
if(process.argv[1]&&new URL(import.meta.url).pathname===process.argv[1]){const [input,output]=process.argv.slice(2);if(!input||!output)throw Error('Usage: node render-card.mjs input.svg output.png');await renderCard(input,output)}
