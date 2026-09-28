import {createHash} from 'node:crypto';
import {ASSETS,COMPANIES,SOURCES} from './catalog.mjs';
const DAY=86400000;
export const beijingDate=(time=Date.now())=>new Date(new Date(time).getTime()+8*3600000).toISOString().slice(0,10);
export function plain(s=''){return String(s).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<[^>]+>/g,' ').replace(/&#(\d+);/g,(_,n)=>Number(n)<=0x10ffff?String.fromCodePoint(Number(n)):'').replace(/&(amp|lt|gt|quot|apos|nbsp);/g,(_,n)=>({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '})[n]).replace(/\s+/g,' ').trim();}
const tag=(s,k)=>plain(s.match(new RegExp('<'+k+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+k+'>','i'))?.[1]||'');
export function safeUrl(s,base){try{const u=new URL(s,base);return ['https:','http:'].includes(u.protocol)?u.href:'';}catch{return '';}}
export const isEarnings=t=>/财报|业绩|营收|净利润|每股收益|financial results|quarter.*results|earnings|revenue/i.test(t);
export function parseNews(xml,source,now=Date.now()){
 const blocks=xml.match(/<item\b[^>]*>[\s\S]*?<\/item>|<entry\b[^>]*>[\s\S]*?<\/entry>/gi)||[];
 if(!blocks.length&&!/<(?:rss|feed)\b/i.test(xml))throw new Error('来源未返回有效 RSS');
 return blocks.flatMap(b=>{
  const title=tag(b,'title');const published=tag(b,'pubDate')||tag(b,'published')||tag(b,'dc:date');const ts=Date.parse(published);
  const url=safeUrl(tag(b,'link')||b.match(/<link\b[^>]*href=["']([^"']+)["']/i)?.[1]||'',source.home);
  if(!title||!url||!Number.isFinite(ts)||ts>now+3600000||ts<now-90*DAY)return [];
  const publisher=tag(b,'source')||source.name;
  const cleanTitle=title.endsWith(' - '+publisher)?title.slice(0,-publisher.length-3):title;
  const companies=COMPANIES.filter(c=>new RegExp(c.id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'|'+c.name,'i').test(cleanTitle)).map(c=>c.id);
  let category=source.category;
  if(['company','earnings'].includes(category)){category=isEarnings(cleanTitle)?'earnings':'company';if(source.category==='earnings'&&category!=='earnings')return [];}
  else if(category==='market'&&/央行|美联储|利率|通胀|GDP|非农|货币|人民币|美元|日元|英镑|卢比|港元|降息|加息/.test(cleanTitle))category='macro';
  const matched=COMPANIES.filter(c=>companies.includes(c.id));const region=matched.length&&['company','earnings'].includes(category)?matched[0].region:source.region;
  const raw=tag(b,'description')||tag(b,'summary')||tag(b,'content');
  const isAggregate=source.url.includes('news.google.com');
  return [{id:createHash('sha256').update(cleanTitle.toLowerCase().replace(/\s/g,'')).digest('hex').slice(0,20),title:cleanTitle,summary:isAggregate?'':raw.slice(0,450),url,source:publisher,sourceId:source.id,official:source.official,via:isAggregate?'Google 新闻聚合':'直接来源',publishedAt:new Date(ts).toISOString(),collectedAt:new Date(now).toISOString(),category,region,companies}];
 });
}
export function mergeNews(items,now=Date.now()){
 const map=new Map();for(const a of items){if(!Number.isFinite(Date.parse(a.publishedAt))||Date.parse(a.publishedAt)<now-90*DAY)continue;const old=map.get(a.id);if(!old||a.official&&!old.official)map.set(a.id,a);}
 return [...map.values()].sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)).slice(0,1600);
}
export async function request(url,type='text'){
 let last;for(let i=0;i<2;i++){try{const r=await fetch(url,{headers:{'User-Agent':'FinanceDaily/1.0 (personal news reader)','Accept':'application/json, application/rss+xml, application/xml, text/xml, */*'},signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error('HTTP '+r.status);return type==='json'?await r.json():await r.text();}catch(e){last=e;}}
 throw last;
}
async function pool(list,fn,size=5){const out=new Array(list.length);let next=0;await Promise.all(Array.from({length:Math.min(size,list.length)},async()=>{while(next<list.length){const i=next++;out[i]=await fn(list[i]);}}));return out;}
export function parseChart(raw,asset,now=Date.now()){
 const r=raw.chart?.result?.[0];if(!r)throw new Error(raw.chart?.error?.description||'无行情');
 const tz=r.meta?.exchangeTimezoneName||'UTC';
 const date=t=>new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(t*1000));
 const close=r.indicators?.quote?.[0]?.close||[];
 const points=(r.timestamp||[]).flatMap((t,i)=>Number.isFinite(close[i])&&close[i]>0?[{date:date(t),value:close[i]}]:[]);
 const unique=[...new Map(points.map(p=>[p.date,p])).values()].sort((a,b)=>a.date.localeCompare(b.date));
 if(!unique.length)throw new Error('无有效日线');
 const latest=unique.at(-1),prior=unique.at(-2);
 return {...asset,points:unique,price:latest.value,changePct:prior?(latest.value/prior.value-1)*100:null,asOf:latest.date,quoteTime:r.meta.regularMarketTime?new Date(r.meta.regularMarketTime*1000).toISOString():null,timezone:tz,currency:r.meta.currency,source:'Yahoo Finance · 日线',sourceUrl:'https://finance.yahoo.com/quote/'+encodeURIComponent(asset.symbol)+'/',fetchedAt:new Date(now).toISOString(),ok:true,error:null,note:asset.id==='gold'||asset.id==='oil'?'连续近月期货，换月可能影响走势；非现货报价。':'日线可能包含当日未收盘数据；涨跌对比上一条有效日线。'};
}
export function parseECB(xml){
 return [...xml.matchAll(/<Cube time=['"]([^'"]+)['"]>([\s\S]*?)<\/Cube>/g)].map(m=>({date:m[1],rates:Object.fromEntries([...m[2].matchAll(/<Cube currency=['"]([^'"]+)['"] rate=['"]([^'"]+)['"]/g)].map(r=>[r[1],Number(r[2])]))})).sort((a,b)=>a.date.localeCompare(b.date));
}
export async function collectMarket(a,now=Date.now()){
 if(a.id==='csi300'){
  const raw=await request('https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=1.000300&klt=101&fqt=0&lmt=270&end=20500101&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61','json');
  const points=(raw.data?.klines||[]).map(line=>{const fields=line.split(',');return {date:fields[0],value:Number(fields[2])}}).filter(p=>p.date<=beijingDate(now)&&Number.isFinite(p.value)&&p.value>0);
  if(points.length<2)throw new Error('沪深300历史日线不足');
  const latest=points.at(-1),prior=points.at(-2);
  return {...a,points,price:latest.value,changePct:(latest.value/prior.value-1)*100,asOf:latest.date,timezone:'Asia/Shanghai',currency:'CNY',source:'东方财富 · 指数日线',sourceUrl:'https://quote.eastmoney.com/zs000300.html',fetchedAt:new Date(now).toISOString(),ok:true,error:null,note:'指数日线可能包含当日未收盘数据；涨跌对比上一条有效日线。'};
 }
 return parseChart(await request('https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(a.symbol)+'?range=1y&interval=1d','json'),a,now);
}
export async function collectSource(s,now=Date.now()){
 if(s.kind!=='hkma')return parseNews(await request(s.url),s,now);
 const raw=await request(s.url,'json');if(!raw.header?.success||!Array.isArray(raw.result?.records))throw new Error('金管局 API 格式异常');
 return raw.result.records.filter(n=>!(/骗案|伪冒|硬币收集/.test(n.title))).flatMap(n=>{
  const escaped=t=>String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;');
  const xml='<rss><item><title>'+escaped(n.title)+'</title><link>'+escaped(n.link)+'</link><pubDate>'+n.date+'T00:00:00+08:00</pubDate></item></rss>';
  return parseNews(xml,s,now).map(a=>({...a,dateOnly:true}));
 });
}
export async function collect(previous={},now=Date.now()){
 const stamp=new Date(now).toISOString();
 const newsResults=await pool(SOURCES,async s=>{try{const items=await collectSource(s,now);return {items,status:{id:s.id,name:s.name,url:s.home,ok:true,count:items.length,checkedAt:stamp,error:null}};}catch(e){return {items:[],status:{id:s.id,name:s.name,url:s.home,ok:false,count:0,checkedAt:stamp,error:String(e.message).slice(0,160)}};}});
 const markets=await pool(ASSETS,async a=>{try{return await collectMarket(a,now);}catch(e){const old=previous.markets?.find(m=>m.id===a.id);return {...a,...old,points:old?.points||[],ok:false,error:String(e.message).slice(0,160)};}});
 let fxReference=previous.fxReference||null;let fxStatus;
 try{const points=parseECB(await request('https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml'));if(!points.length)throw new Error('无有效参考汇率');fxReference={base:'EUR',source:'欧洲央行',url:'https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html',fetchedAt:stamp,points};fxStatus={id:'ecb-fx',name:'欧洲央行 · 参考汇率',url:fxReference.url,ok:true,count:points.length,checkedAt:stamp};}catch(e){fxStatus={id:'ecb-fx',name:'欧洲央行 · 参考汇率',url:'https://www.ecb.europa.eu/',ok:false,count:0,error:e.message,checkedAt:stamp};}
 const news=mergeNews([...newsResults.flatMap(r=>r.items),...(previous.news||[])],now);
 if(!newsResults.some(r=>r.status.ok&&r.items.length)&&!markets.some(m=>m.ok))throw new Error('本次全部来源失败，保留上一版日报');
 const sources=[...newsResults.map(r=>r.status),fxStatus];
 const date=beijingDate(now),today=news.filter(n=>Date.parse(n.publishedAt)>=now-DAY);
 const selected=[];const counts=new Map();for(const c of ['macro','market','earnings','company','gold','crypto']){const candidates=today.filter(n=>n.category===c);for(const n of candidates){if((counts.get(n.source)||0)>=2)continue;selected.push(n.id);counts.set(n.source,(counts.get(n.source)||0)+1);if(selected.filter(id=>news.find(x=>x.id===id)?.category===c).length>=2)break;}}
 const edition={date,generatedAt:stamp,newsCount:today.length,headlineIds:selected,coverage:newsResults.filter(r=>r.status.ok).length,totalSources:newsResults.length,markets:markets.map(({points,...m})=>m)};
 return {schemaVersion:1,generatedAt:stamp,producer:process.env.GITHUB_ACTIONS?'github-actions':'local',news,markets,fxReference,sources,editions:[edition,...(previous.editions||[]).filter(e=>e.date!==date)].slice(0,120)};
}
