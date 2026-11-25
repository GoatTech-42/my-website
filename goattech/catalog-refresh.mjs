import {selectProjects,renderRows,arrow} from './catalog.mjs';
document.querySelectorAll('.plate h2 a').forEach(a=>a.insertAdjacentHTML('beforeend',arrow));
// Keep the generated list when GitHub is unavailable or rate limited.
try {
  const response=await fetch('https://api.github.com/users/GoatTech-42/repos?per_page=100&sort=pushed&type=owner');
  if(!response.ok)throw new Error(`GitHub ${response.status}`);
  if(response.headers.get('link')?.includes('rel="next"'))throw new Error('Inventory needs pagination');
  const projects=selectProjects(await response.json());
  if(!projects.length)throw new Error('Empty public inventory');
  document.querySelector('.mlist').innerHTML=renderRows(projects);
} catch(error) {
  console.info('Showing saved project list:',error.message);
}
