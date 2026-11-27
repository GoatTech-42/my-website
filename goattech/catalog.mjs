// Lucide arrow-up-right, ISC license: https://lucide.dev/license
export const arrow = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 7h10v10M7 17 17 7"/></svg>';
// These projects stay off the homepage until their release owner clears them.
const denied = new Set(['meshac', 'unhinted']);
// Luke approved these two listings, including an unstarted pack and an archived project.
const included = new Set(['goated-world-gen', 'nebula-v2']);
const housekeeping = new Set(['goattech-42', 'my-website', 'zkv-vibecode-27']);
const featured = new Set(['aqua','goattech-forge','tally','goattech-launcher']);
export function selectProjects(repos) {
  return repos.filter(r => {
    const name = String(r.name || '').toLowerCase();
    return r.private === false && ((r.archived === false && r.size > 1) || included.has(name)) && !denied.has(name) && !housekeeping.has(name) && !featured.has(name)
      && r.full_name === `GoatTech-42/${r.name}`
      && r.html_url === `https://github.com/GoatTech-42/${r.name}`
      && Number.isFinite(Date.parse(r.pushed_at));
  }).sort((a, b) => Date.parse(b.pushed_at) - Date.parse(a.pushed_at));
}
const escape = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderRows(repos) {
  return repos.map(r => `<li><a class="mrow" href="${escape(r.html_url)}" rel="noopener"><span class="mn">${escape(r.name.toLowerCase())}</span><span class="md">${escape(r.description || 'source code on github.')}${r.fork ? ' <span class="fork-note">contribution fork</span>' : ''}${r.archived ? ' <span class="fork-note">archived</span>' : ''}</span><span class="mt mono">${escape(r.language || 'source')}<br>pushed ${escape(r.pushed_at.slice(0,10))}</span><span class="ml">github ${arrow}</span></a></li>`).join('\n');
}
