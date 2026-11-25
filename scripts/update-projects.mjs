import {readFile,writeFile} from 'node:fs/promises';
import {selectProjects,renderRows} from '../goattech/catalog.mjs';
const response=await fetch('https://api.github.com/users/GoatTech-42/repos?per_page=100&sort=pushed&type=owner',{headers:{'User-Agent':'GoatTech-homepage'}});
if(!response.ok)throw new Error(`GitHub inventory failed: ${response.status}`);
const repos=await response.json();
if(response.headers.get('link')?.includes('rel="next"'))throw new Error('Inventory needs pagination before refresh');
const projects=selectProjects(repos);
if(!projects.length)throw new Error('Refusing an empty project inventory');
const file=new URL('../goattech/index.html',import.meta.url);
const html=await readFile(file,'utf8');
if((html.match(/<!-- catalog:start -->/g)||[]).length!==1 || (html.match(/<!-- catalog:end -->/g)||[]).length!==1)throw new Error('Expected exactly one catalog marker pair');
const featured=repos.filter(r=>['aqua','goattech-forge','tally','goattech-launcher'].includes(r.name)&&!r.private);
if(featured.length!==4)throw new Error('Missing featured push timestamps');
let updated=html;
for(const repo of featured){
 if(!Number.isFinite(Date.parse(repo.pushed_at)))throw new Error('Invalid push timestamp');
 updated=updated.replace(new RegExp('(<span data-repo="'+repo.name+'" data-pushed=")[^"]+(">)[^<]*'), '$1'+repo.pushed_at+'$2pushed '+repo.pushed_at.slice(0,10));
}
const latest=featured.map(r=>r.pushed_at).sort().at(-1);
updated=updated.replace(/(<b id="latest" data-pushed=")[^"]+(">)[^<]*/, '$1'+latest+'$2'+latest.slice(0,10));
await writeFile(file,updated.replace(/<!-- catalog:start -->[\s\S]*?<!-- catalog:end -->/,'<!-- catalog:start -->\n'+renderRows(projects)+'\n<!-- catalog:end -->'));
await writeFile(new URL('../goattech/projects.json',import.meta.url),JSON.stringify({checked_at:new Date().toISOString(),projects:projects.map(({name,full_name,html_url,description,language,pushed_at,private:priv,archived,size,fork})=>({name,full_name,html_url,description,language,pushed_at,private:priv,archived,size,fork}))},null,2)+'\n');
console.log(`Generated ${projects.length} public projects`);
