// Explicit existing-site allowlist. Campaign files can never enter this artifact.
import {cp,mkdir,rm,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.dirname(fileURLToPath(import.meta.url));
const assets=['index.html','goattech/index.html','favicon.ico','logo.png','script.js','style.css','particles/fallleaf.png','particles/springleaf.png','particles/summerleaf.png','particles/winterleaf.png'];
const destination=path.join(root,'.public-assets');
await rm(destination,{recursive:true,force:true});await mkdir(destination);
for(const file of assets){const source=path.join(root,file);if(!(await stat(source)).isFile())throw Error('Missing asset: '+file);await mkdir(path.dirname(path.join(destination,file)),{recursive:true});await cp(source,path.join(destination,file))}
console.log(`Prepared ${assets.length} explicitly allowed public assets. Campaign assets: 0.`);
