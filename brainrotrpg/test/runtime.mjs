import {Miniflare as Current,convertV4MiniflareOptions} from 'miniflare';
import {readdirSync} from 'node:fs';
// Complete real Worker module graph, explicit because v5 no longer crawls rules.
export class Miniflare extends Current{
 constructor(options){const {modulesRules,scriptPath,modules,...rest}=options;super(convertV4MiniflareOptions({...rest,modules:['worker.js',...readdirSync('src').filter(n=>n.endsWith('.js')&&n!=='worker.js')].map(n=>({type:'ESModule',path:'src/'+n}))}))}
}
