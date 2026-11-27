import {test} from 'node:test';
import assert from 'node:assert/strict';
import {selectProjects, renderRows} from '../goattech/catalog.mjs';
const repo=(name,extra={})=>({name,full_name:`GoatTech-42/${name}`,html_url:`https://github.com/GoatTech-42/${name}`,private:false,archived:false,size:30,pushed_at:'2026-11-01T00:00:00Z',description:'a project',...extra});
test('public catalog excludes private, archived, unreleased and empty projects, and sorts newest first',()=>{
 const rows=selectProjects([repo('older'),repo('newer',{pushed_at:'2026-11-20T00:00:00Z'}),repo('meshac'),repo('unhinted'),repo('private',{private:true}),repo('ramjet',{archived:true}),repo('empty',{size:0})]);
 assert.deepEqual(rows.map(r=>r.name),['newer','older']);
});
test('catalog rejects a spoofed owner or destination',()=>{
 assert.deepEqual(selectProjects([repo('escape',{html_url:'https://evil.invalid/'}),repo('other',{full_name:'other/other'})]),[]);
});
test('project descriptions are escaped, dates are factual, forks labelled and SVG icons accessible',()=>{
 const html=renderRows([repo('lichii',{fork:true,description:'<img src=x onerror=alert(1)>'})]);
 assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;img'));assert.ok(html.includes('contribution fork'));assert.ok(html.includes('2026-11-01'));assert.ok(html.includes('<svg'));assert.ok(html.includes('aria-hidden="true"'));
});

test('more excludes every featured project to prevent duplication',()=>{
 assert.deepEqual(selectProjects([repo('aqua'),repo('goattech-forge'),repo('tally'),repo('goattech-launcher'),repo('lichii')]).map(r=>r.name),['lichii']);
});

test('approved small and archived projects appear without admitting other small or archived repos',()=>{
 const rows=selectProjects([repo('goated-world-gen',{size:1}),repo('NEBULA-V2',{archived:true}),repo('tiny',{size:1}),repo('retired',{archived:true}),repo('NEBULA-V2',{private:true,archived:true}),repo('goated-world-gen',{size:1,html_url:'https://evil.invalid/'})]);
 assert.deepEqual(rows.map(r=>r.name),['goated-world-gen','NEBULA-V2']);
 const html=renderRows(rows);
 assert.ok(html.includes('href="https://github.com/GoatTech-42/NEBULA-V2"'));
 assert.ok(html.includes('archived'));
});
