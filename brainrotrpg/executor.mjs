// Protected command-line route. Never sends credentials to any other origin.
import fs from 'node:fs/promises';import {DOMParser} from '@xmldom/xmldom';import {isDeepStrictEqual} from 'node:util';
const [command,...args]=process.argv.slice(2),origin='https://brainrotrpg.goattech.us';
const secretPath=process.env.RPG_SECRET_FILE;if(!secretPath)throw Error('RPG_SECRET_FILE must point to the approved vault-written credential file');
const secret=(await fs.readFile(secretPath,'utf8')).trim();if(secret.length<40)throw Error('Invalid executor credential');
let pathname,method='GET',body;
if(command==='state')pathname='/api/state';
else if(command==='export')pathname='/api/export';
else if(command==='write'){pathname='/api/state';method='PUT';body=await fs.readFile(args[0],'utf8')}
else if(command==='member'||command==='approve'){pathname='/auth/'+command;method='POST';body=await fs.readFile(args[0],'utf8')}
else if(command==='history'){if(!/^\d+$/.test(args[0]))throw Error('Revision required');pathname='/api/history/'+args[0]}
else if(command==='card'||command==='event'){if(!/^[A-Za-z0-9-]{1,80}$/.test(args[0])||!/^\d+$/.test(args[1]))throw Error('ID and explicit revision required');pathname=`/api/${command==='card'?'cards':'events'}/${args[0]}.svg?version=${args[1]}`}
else throw Error('Usage: state|export|write FILE|member FILE|approve FILE|history REV|card ID REV OUTPUT|event ID REV OUTPUT');
const r=await fetch(origin+pathname,{method,redirect:'error',headers:{authorization:'Bearer '+secret,...(body?{'content-type':'application/json'}:{})},body});
if(!r.ok){let error;try{error=(await r.json()).error}catch{error='Request rejected'}throw Error(`RPG HTTP ${r.status}: ${error}`)}
if(command==='card'||command==='event'){
 if(!args[2])throw Error('Output file required');
 if(r.headers.get('content-type')?.split(';')[0]!=='image/svg+xml')throw Error('Unexpected image response');
 const svg=await r.text();let bad=false;const doc=new DOMParser({onError:()=>{bad=true}}).parseFromString(svg,'image/svg+xml');
 if(bad||doc.documentElement?.tagName!=='svg'||!svg.includes(`Saved revision ${args[1]} /`))throw Error('Wrong or malformed revision-bound image');
 // A fresh output is mandatory: never overwrite an existing world-readable file.
 await fs.writeFile(args[2],svg,{mode:0o600,flag:'wx'});console.log('Saved revision-bound SVG to new private file; run inert PNG renderer before delivery');
}else{
 const receipt=await r.json();
 if(command==='write'){
  const check=await fetch(origin+'/api/state',{redirect:'error',headers:{authorization:'Bearer '+secret}});if(!check.ok)throw Error('Saved receipt received but readback failed');const actual=await check.json(),proposed=JSON.parse(body);
  if(actual.version!==receipt.version||!isDeepStrictEqual(actual.snapshot,proposed.snapshot))throw Error('Saved receipt received but canonical GET readback did not match');
  console.log(JSON.stringify({receipt,readbackVerified:true}));
 }else console.log(JSON.stringify(receipt));
}
