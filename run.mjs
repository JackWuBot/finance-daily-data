import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {collect} from './collector.mjs';
let previous={};try{previous=JSON.parse(await readFile('data/feed.json','utf8'));}catch{}
const feed=await collect(previous);await mkdir('data',{recursive:true});
await writeFile('data/feed.json.tmp',JSON.stringify(feed));await rename('data/feed.json.tmp','data/feed.json');
await mkdir('data/daily',{recursive:true});await writeFile('data/daily/'+feed.editions[0].date+'.json',JSON.stringify(feed));
console.log(JSON.stringify({generatedAt:feed.generatedAt,news:feed.news.length,markets:feed.markets.filter(m=>m.ok).length,sources:feed.sources.map(s=>({name:s.name,ok:s.ok,count:s.count,error:s.error}))},null,2));
