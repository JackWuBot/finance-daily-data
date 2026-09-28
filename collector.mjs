import {createHash} from 'node:crypto';
import {ASSETS,COMPANIES,COMPANY_ASSETS,SOURCES} from './catalog.mjs';
const CAL_DAY=86400000;
const calPlain=s=>String(s||'').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
const calMonth=s=>['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(s.toLowerCase().slice(0,3))+1;
const calDate=(y,m,d)=>`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
const calCells=row=>[...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m=>calPlain(m[1]));
const allAssets=['sp500','nasdaq','euro50','nikkei','csi300','shanghai','ftse','nifty','hsi','gold','btc','oil','eurusd','usdjpy','usdcny','gbpusd','usdinr','usdhkd'];
export const CALENDAR_SOURCES=[
 {id:'cal-fed',name:'美联储 · FOMC 日程',url:'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm',parser:'fed',region:'US',timezone:'America/New_York',assets:allAssets},
 {id:'cal-ecb',name:'欧洲央行 · 议息日程',url:'https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html',parser:'ecb',region:'EU',timezone:'Europe/Berlin',assets:['euro50','eurusd','gold']},
 {id:'cal-boj',name:'日本央行 · 议息日程',url:'https://www.boj.or.jp/en/mopo/mpmsche_minu/index.htm',parser:'boj',region:'JP',timezone:'Asia/Tokyo',assets:['nikkei','usdjpy','gold']},
 {id:'cal-boe',name:'英国央行 · 议息日程',url:'https://www.bankofengland.co.uk/monetary-policy/upcoming-mpc-dates',parser:'boe',region:'UK',timezone:'Europe/London',assets:['ftse','gbpusd']},
 {id:'cal-bls',name:'美国劳工统计局 · 数据日历',url:'https://www.bls.gov/schedule/news_release/bls.ics',parser:'ics',region:'US',timezone:'America/New_York',assets:allAssets},
 {id:'cal-bea',name:'美国经济分析局 · GDP / PCE 日历',url:'https://www.bea.gov/news/schedule/ics/online-calendar-subscription.ics',parser:'ics',region:'US',timezone:'America/New_York',assets:allAssets},
 {id:'cal-nbs',name:'国家统计局 · 发布日程',url:'https://www.stats.gov.cn/xxgk/sjfb/fbrcb/',parser:'nbs',region:'CN',timezone:'Asia/Shanghai',assets:['csi300','shanghai','hsi','usdcny','oil']}
];
export function zonedTimeToISO(date,time,zone){
 const [y,m,d]=date.split('-').map(Number),[h,min]=time.split(':').map(Number);const wall=Date.UTC(y,m-1,d,h,min);let guess=wall;
 for(let i=0;i<3;i++){const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(guess).map(x=>[x.type,x.value]));const seen=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second);guess+=wall-seen;}
 return new Date(guess).toISOString();
}
function calEvent(s,date,title,extra={}){return {id:`${s.id}-${date}-${title}`,sourceId:s.id,source:s.name,sourceUrl:s.url,region:s.region,timezone:s.timezone,assets:s.assets,date,title,kind:'policy',importance:'high',status:'scheduled',dateOnly:true,watch:'关注决议、政策措辞与后续指引；政策相对市场预期的变化可能影响利率、汇率和风险资产。',...extra};}
export function parseCalendar(html,s){
 const events=[];
 if(s.parser==='fed'){
  for(const y of html.matchAll(/(\d{4}) FOMC Meetings([\s\S]*?)(?=\d{4} FOMC Meetings|$)/g)){
   for(const r of y[2].matchAll(/fomc-meeting__month[^>]*>([\s\S]*?)<\/div>\s*<div[^>]*fomc-meeting__date[^>]*>([\s\S]*?)<\/div>/g)){
    const months=calPlain(r[1]).split('/'),ds=calPlain(r[2]).match(/^(\d{1,2})-(\d{1,2})(\*)?$/);if(!ds)continue;
    const startDate=calDate(y[1],calMonth(months[0]),ds[1]),date=calDate(y[1],calMonth(months.at(-1)),ds[2]);
    events.push(calEvent(s,date,'美联储 FOMC 议息会议'+(ds[3]?' · 经济预测':''),{startDate,watch:ds[3]?'关注利率决议、经济预测和点阵图；比较政策路径与之前指引。':'关注利率决议、声明和发布会；观察通胀与就业风险表述的变化。',note:'会议日期按美国当地时间；本来源未提供具体决议时刻，后续日期可能调整。'}));
   }
  }
 }else if(s.parser==='ecb'){
  let firstDate;
  for(const r of html.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/g)){
   const d=calPlain(r[1]).match(/(\d{2})\/(\d{2})\/(\d{4})/),label=calPlain(r[2]);if(!d||!/monetary policy meeting/.test(label)||/non-monetary/.test(label))continue;
   const date=calDate(d[3],d[2],d[1]);if(/Day 1/.test(label)){firstDate=date;continue;}
   if(/Day 2/.test(label))events.push(calEvent(s,date,'欧洲央行利率决议与发布会',{startDate:firstDate,watch:'关注利率路径、通胀预测与增长评估；欧元和欧股可能对意外措辞更敏感。'}));
  }
 }else if(s.parser==='boe'||s.parser==='boj'){
  for(const y of html.matchAll(/<h2[^>]*>\s*(\d{4})(?: confirmed dates)?\s*<\/h2>([\s\S]*?)(?=<h2|$)/gi)){
   const table=y[2].match(/<table\b[\s\S]*?<\/table>/i)?.[0]||'';
   for(const row of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
    const c=calCells(row[1]);if(!c.length)continue;
    if(s.parser==='boe'){const d=c[0].match(/Thursday\s+(\d+)\s+(\w+)/i);if(d)events.push(calEvent(s,calDate(y[1],calMonth(d[2]),d[1]),'英国央行利率决议'+(/Monetary Policy Report/.test(c[1])?' · 货币政策报告':''),{watch:'关注投票分歧、工资和服务通胀判断，以及英镑与英国股市的反应。'}));}
    else{const d=c[0].match(/^([A-Za-z]+)\.?\s+(\d+)\s*\([^)]*\),\s*(\d+)\s*\(/);if(d)events.push(calEvent(s,calDate(y[1],calMonth(d[1]),d[3]),'日本央行货币政策会议'+(c[1]!=='-'?' · 展望报告':''),{startDate:calDate(y[1],calMonth(d[1]),d[2]),watch:'关注政策利率、购债安排和物价判断；日元变化也会影响出口企业利润换算。',note:'日本当地会议日期；决议发布时间不固定。'}));}
   }
  }
 }else if(s.parser==='ics'){
  const specs=[[/^Employment Situation$/,'美国非农就业报告','关注新增就业、失业率、工资与前值修订；就业强弱可能改变利率预期。','high'],[/^Consumer Price Index$/,'美国 CPI 通胀','关注核心和整体 CPI 环比，以及住房与服务项；不能仅凭同比推断政策。','high'],[/^Producer Price Index$/,'美国 PPI','关注生产端价格压力及其向消费端传导的可能性。','medium'],[/^Job Openings and Labor Turnover/,'美国 JOLTS 职位空缺','关注职位空缺、离职率与就业需求变化。','medium'],[/^Personal Income and Outlays/,'美国个人收入与支出 · PCE','关注核心 PCE 环比、居民支出与收入；PCE 是美联储观察通胀的重要指标。','high'],[/^(?:Gross Domestic Product(?=,| \()|GDP \()/,'美国 GDP','区分初值与修订值，关注消费、投资和库存对增长的贡献。','high']];
  const unfolded=html.replace(/\r?\n[ \t]/g,'');
  for(const row of unfolded.matchAll(/BEGIN:VEVENT([\s\S]*?)END:VEVENT/g)){
   if(/^STATUS:CANCELLED\s*$/m.test(row[1]))continue;
   const title=row[1].match(/^SUMMARY:(.*)$/m)?.[1]?.trim().replace(/\\,/g,',');const spec=specs.find(([re])=>re.test(title||''));if(!spec)continue;
   const dt=row[1].match(/^DTSTART([^:\r\n]*):(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/m);if(!dt)continue;
   const date=calDate(dt[2],dt[3],dt[4]);const time=dt[5]?`${dt[5]}:${dt[6]}`:null;const tz=dt[1].match(/TZID=([^;]+)/)?.[1];const zone=tz==='US-Eastern'?'America/New_York':tz||s.timezone;
   const startsAt=time?(dt[8]?`${date}T${time}:${dt[7]||'00'}Z`:zonedTimeToISO(date,time,zone)):undefined;
   const displayTitle=spec[1]==='美国 GDP'?spec[1]+(/Advance Estimate|Initial Estimate/.test(title)?' · 初值':/Second Estimate/.test(title)?' · 第二次估算':/Third Estimate/.test(title)?' · 第三次估算':' · 修订'):spec[1];
   events.push(calEvent(s,date,displayTitle,{originalTitle:title,kind:'data',importance:spec[3],watch:spec[2],startsAt,dateOnly:!startsAt,timezone:zone,note:'时间来自官方订阅日历，已自动处理夏令时；日程可能修订。'}));
  }
 }else if(s.parser==='nbs'){
  const year=html.match(/(\d{4})年国家统计局主要统计信息发布日程表/)?.[1];if(!year)return [];
  const specs=[['国民经济运行情况','中国国民经济运行数据','关注增长、工业、消费和投资；季度月份同时关注 GDP。'],['采购经理指数月度报告','中国官方 PMI','关注制造业、非制造业与新订单；50 是扩张和收缩的分界。'],['居民消费价格指数月度报告','中国 CPI','关注消费价格及核心通胀，结合需求与货币政策判断。'],['工业生产者价格指数月度报告','中国 PPI','关注工业品价格与企业利润压力。']];
  const rows=[...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  for(let ri=0;ri<rows.length;ri++){
   const c=calCells(rows[ri][1]);const spec=specs.find(x=>c[1]===x[0]);if(!spec||c.length!==14)continue;
   const timeCells=calCells(rows[ri+1]?.[1]||'');let ti=0;
   c.slice(2).forEach((cell,i)=>{const days=[...cell.matchAll(/(\d{1,2})\s*\/\s*[一二三四五六日天]/g)];if(!days.length)return;const time=timeCells[ti++]?.match(/^(\d{1,2}):([0-5]\d)$/);for(const d of days){const date=calDate(year,i+1,d[1]);events.push(calEvent(s,date,spec[1],{kind:'data',watch:spec[2],...(time?{startsAt:zonedTimeToISO(date,`${time[1]}:${time[2]}`,s.timezone),dateOnly:false}:{}),note:'国家统计局初步计划；以官方临近发布安排为准。'}));}});
  }
 }
 return events;
}
export async function collectCalendar(previous={},now=Date.now(),fetchText=async url=>{const r=await fetch(url,{signal:AbortSignal.timeout(18000)});if(!r.ok)throw new Error('HTTP '+r.status);return r.text()}){
 const checkedAt=new Date(now).toISOString(),minDate=new Date(now-35*CAL_DAY).toISOString().slice(0,10),maxDate=new Date(now+550*CAL_DAY).toISOString().slice(0,10);
 const result=await Promise.all(CALENDAR_SOURCES.map(async s=>{
  try{
   let html=await fetchText(s.url),url=s.url,events;
   if(s.parser==='nbs'){
    const links=[...html.matchAll(/href=["']([^"']+)["'][^>]*>(\d{4})年国家统计局主要统计信息发布日程表/g)].filter(m=>Number(m[2])>=new Date(now).getUTCFullYear());
    if(!links.length)throw new Error('未发现当年官方发布日程');events=[];
    for(const link of links.slice(0,2)){url=new URL(link[1],s.url).href;const detail=await fetchText(url);events.push(...parseCalendar(detail,{...s,url}));}
   }else events=parseCalendar(html,s);
   if(!events.length)throw new Error('官方日程格式变化或未解析到事件');
   events=events.filter(e=>e.date>=minDate&&e.date<=maxDate).map(e=>({...e,verifiedAt:checkedAt,stale:false}));
   if(!events.some(e=>e.date>=new Date(now).toISOString().slice(0,10)))throw new Error('官方来源暂未提供后续日程');
   return {events,status:{id:s.id,name:s.name,url:s.url,ok:true,count:events.length,checkedAt,error:null}};
  }catch(e){return {events:(previous.events||[]).filter(e=>e.sourceId===s.id&&e.date>=minDate&&e.date<=maxDate).map(e=>({...e,stale:true})),status:{id:s.id,name:s.name,url:s.url,ok:false,count:0,checkedAt,error:String(e.message).slice(0,150)}};}
 }));
 const events=[...new Map(result.flatMap(r=>r.events).map(e=>[e.id,e])).values()].sort((a,b)=>(a.startsAt||a.date).localeCompare(b.startsAt||b.date));
 return {events,calendarSources:result.map(r=>r.status),calendarCheckedAt:checkedAt};
}

const BDAY=86400000;
export const BOND_GROUPS={US:'美国国债',CN:'中国国债',LGFV:'城投债'};
export const CHINA_CURVES=[
 {key:'cn',group:'CN',name:'中债国债收益率曲线',curveId:'2c9081e50a2f9606010a3068cae70001',tenors:[1,2,3,5,10,30]},
 {key:'lgfv-aaa',group:'LGFV',name:'中债城投债收益率曲线(AAA)',rating:'AAA',curveId:'2c9081e91b55cc84011be3c53b710598',tenors:[1,3,5]},
 {key:'lgfv-aap',group:'LGFV',name:'中债城投债收益率曲线(AA＋)',rating:'AA+',curveId:'2c9081e91b55cc84011bd98af3dc1533',tenors:[1,3,5]},
 {key:'lgfv-aa',group:'LGFV',name:'中债城投债收益率曲线(AA)',rating:'AA',curveId:'2c9081e91b55cc84011c07e9991e15c9',tenors:[1,3,5]}
];
const US_TENORS=[[.25,'BC_3MONTH'],[1,'BC_1YEAR'],[2,'BC_2YEAR'],[5,'BC_5YEAR'],[10,'BC_10YEAR'],[30,'BC_30YEAR']];
const BOND_HOME='https://yield.chinabond.com.cn/cbweb-mn/yield_main?locale=zh_CN';
const US_HOME='https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve';
const bondDate=(now,tz)=>new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
export function cleanYieldPoints(points,now=Date.now(),timezone='Asia/Shanghai'){
 const end=bondDate(now,timezone),start=bondDate(now-400*BDAY,timezone);
 return [...new Map(points.filter(p=>/^\d{4}-\d{2}-\d{2}$/.test(p.date)&&p.date>=start&&p.date<=end&&typeof p.value==='number'&&Number.isFinite(p.value)&&p.value>=-20&&p.value<=100).map(p=>[p.date,p])).values()].sort((a,b)=>a.date.localeCompare(b.date)).slice(-400);
}
function yieldSeries(meta,points,now){
 points=cleanYieldPoints(points,now,meta.timezone);const last=points.at(-1),prior=points.at(-2);
 if(!last)throw new Error('无有效收益率日线');
 return {...meta,kind:'yield',unit:'%',symbol:meta.id,points,price:last.value,asOf:last.date,changePct:null,changeBp:prior?(last.value-prior.value)*100:null,ok:true,error:null,fetchedAt:new Date(now).toISOString()};
}
export function parseTreasury(xml,now=Date.now()){
 const entries=xml.match(/<entry>[\s\S]*?<\/entry>/g)||[];
 return US_TENORS.map(([tenor,field])=>{
  const points=entries.flatMap(e=>{const date=e.match(/<d:NEW_DATE\b[^>]*>([^<]+)/)?.[1]?.slice(0,10),raw=e.match(new RegExp('<d:'+field+'\\b[^>]*>([^<]+)'))?.[1];return date&&raw?.trim()&&Number.isFinite(Number(raw))?[{date,value:Number(raw)}]:[];});
  return yieldSeries({id:'us-'+tenor,group:'US',region:'US',tenor,name:'美国国债 · '+(tenor===.25?'3 个月':tenor+' 年'),timezone:'America/New_York',source:'美国财政部 · 名义平价收益率',sourceUrl:US_HOME,note:'财政部每日名义平价收益率曲线（CMT）；为估计收益率，不是某只债券的成交价格。'},points,now);
 });
}
export function parseChinaYields(raw,curve,now=Date.now()){
 if(!Array.isArray(raw))throw new Error('中债曲线格式异常');
 return curve.tenors.map(tenor=>{
  const item=raw.find(r=>r.ycDefId===curve.curveId+Number(tenor).toFixed(1)&&r.ycDefName===curve.name+'(到期)('+tenor+'y)');
  if(!item||!Array.isArray(item.seriesData))throw new Error('曲线名称或期限不匹配：'+curve.name+' '+tenor+'年');
  const points=item.seriesData.flatMap(p=>Array.isArray(p)&&typeof p[0]==='number'&&Number.isFinite(p[0])?[{date:bondDate(p[0],'Asia/Shanghai'),value:p[1]}]:[]);
  return yieldSeries({id:curve.key+'-'+tenor,group:curve.group,rating:curve.rating,region:'CN',tenor,name:(curve.group==='CN'?'中国国债':'城投债 '+curve.rating)+' · '+tenor+' 年',timezone:'Asia/Shanghai',source:curve.name+' · 到期收益率',sourceUrl:BOND_HOME,note:'中债估值曲线的标准期限到期收益率；不是单券成交收益率。'+(curve.group==='LGFV'?'评级口径来自该曲线，不能替代具体发行人的信用评估。':'')},points,now);
 });
}
export function spreadSeries(a,b){
 const other=new Map((b?.points||[]).map(p=>[p.date,p.value]));
 return (a?.points||[]).flatMap(p=>other.has(p.date)?[{date:p.date,value:(p.value-other.get(p.date))*100}]:[]);
}
export function curveSnapshot(series){
 const usable=series.filter(s=>s.points?.length);if(!usable.length)return {date:null,rows:[],partial:series.length>0};
 const dates=usable[0].points.map(p=>p.date).filter(d=>usable.every(s=>s.points.some(p=>p.date===d))).sort();const date=dates.at(-1);
 if(!date)return {date:null,rows:[],partial:true};
 const rows=[...new Set(usable.map(s=>s.tenor))].sort((a,b)=>a-b).map(tenor=>({tenor,...Object.fromEntries(usable.filter(s=>s.tenor===tenor).map(s=>[s.rating||'yield',s.points.find(p=>p.date===date).value]))}));
 return {date,rows,partial:usable.length!==series.length||usable.some(s=>!s.ok)};
}
export async function collectBonds(previous={},now=Date.now(),fetchBond=async(url,method='GET')=>{const r=await fetch(url,{method,signal:AbortSignal.timeout(25000)});if(!r.ok)throw new Error('HTTP '+r.status);return r.text()}){
 const checkedAt=new Date(now).toISOString(),year=new Date(now).getUTCFullYear();
 const jobs=[{id:'bonds-us',name:'美国财政部 · 国债收益率',url:US_HOME,group:'US',run:async()=>parseTreasury((await Promise.all([year-1,year].map(y=>fetchBond('https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value='+y)))).join('\n'),now)},...CHINA_CURVES.map(curve=>({id:'bonds-'+curve.key,name:curve.name,url:BOND_HOME,group:curve.group,rating:curve.rating,run:async()=>{
  const params=new URLSearchParams({bjlx:'no',dcq:curve.tenors.map(t=>t+','+t+'y;').join(''),startTime:bondDate(now-370*BDAY,'Asia/Shanghai'),endTime:bondDate(now,'Asia/Shanghai'),qxlx:'0,',yqqxN:'N',yqqxK:'K',par:'day',ycDefIds:curve.curveId,locale:'zh_CN'});
  return parseChinaYields(JSON.parse(await fetchBond('https://yield.chinabond.com.cn/cbweb-mn/yc/queryYz?'+params,'POST')),curve,now);
 }}))];
 const results=await Promise.all(jobs.map(async j=>{try{const series=await j.run();return {series,status:{id:j.id,name:j.name,url:j.url,ok:true,count:series.length,checkedAt,error:null}}}catch(e){const error=String(e.message).slice(0,160);return {series:(previous.series||[]).filter(s=>s.group===j.group&&(j.group!=='LGFV'||s.rating===j.rating)).map(s=>({...s,ok:false,error})),status:{id:j.id,name:j.name,url:j.url,ok:false,count:0,checkedAt,error}}}}));
 return {checkedAt,series:results.flatMap(r=>r.series),sources:results.map(r=>r.status)};
}

// Query separate 30-day windows so a busy final week cannot displace the whole quarter.
export function quarterQueries(sources, now=Date.now()){
 const end=Date.parse(new Date(now+8*3600000).toISOString().slice(0,10)+'T00:00:00Z')+86400000;
 return sources.filter(s=>s.url.includes('news.google.com/rss/search')).flatMap(s=>Array.from({length:3},(_,i)=>{
  const before=new Date(end-i*30*86400000).toISOString().slice(0,10),after=new Date(end-(i+1)*30*86400000).toISOString().slice(0,10);
  const url=new URL(s.url);url.searchParams.set('q',url.searchParams.get('q').replace(/\s+when:\S+/g,'')+` after:${after} before:${before}`);
  return {...s,id:`quarter-${s.id}-${i}`,url:url.href,after,before,name:s.name+' · '+after+'—'+before};
 }));
}
export async function collectQuarterNews({sources,request,parseNews,pool,previous={},now=Date.now()}){
 const jobs=quarterQueries(sources,now),stamp=new Date(now).toISOString();
 const results=await pool(jobs,async s=>{
  try{
   const rows=parseNews(await request(s.url),s,now).filter(n=>n.publishedAt.slice(0,10)>=s.after&&n.publishedAt.slice(0,10)<s.before&&Date.parse(n.publishedAt)<=now).sort((a,b)=>a.publishedAt.localeCompare(b.publishedAt));
   // Evenly sample each window; retain both early and late observations.
   const items=rows.length<=18?rows:Array.from({length:18},(_,i)=>rows[Math.round(i*(rows.length-1)/17)]);
   return {items,status:{id:s.id,name:s.name,url:s.url,ok:true,count:items.length,checkedAt:stamp,error:null}};
  }catch(e){return {items:[],status:{id:s.id,name:s.name,url:s.url,ok:false,count:0,checkedAt:stamp,error:String(e.message).slice(0,160)}};}
 },5);
 const failed=new Set(results.filter(r=>!r.status.ok).map(r=>r.status.id));
 const rows=[...results.flatMap(r=>r.items),...(previous.quarterNews||[]).filter(n=>failed.has(n.sourceId))];
 const quarterNews=[...new Map(rows.filter(n=>Date.parse(n.publishedAt)>=now-90*86400000&&Date.parse(n.publishedAt)<=now).map(n=>[n.id,n])).values()].sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)).slice(0,2500);
 return {quarterNews,quarterSources:results.map(r=>r.status),quarterCheckedAt:stamp};
}

const DAY=86400000;
const TRUSTED_DOMAINS=['reuters.com','bloomberg.com','ft.com','ftchinese.com','wsj.com','cnbc.com','sina.com.cn','sina.cn','eastmoney.com','cls.cn','stcn.com','cnstock.com','yicai.com','21jingji.com','thepaper.cn','jiemian.com','stheadline.com','hk01.com','hket.com','aastocks.com','yahoo.com','investing.com','caixin.com','xinhua.com','news.cn','chinanews.com.cn','chinanews.com','cnr.cn','gov.cn','cctv.com','people.com.cn','chinadaily.com.cn','stnn.cc','dw.com','bbc.com','rfi.fr','rthk.hk','coindesk.com','cointelegraph.com','theblock.co','decrypt.co','zaobao.com.sg','zaobao.com','fxstreet.com','wallstreetcn.com','36kr.com','nbd.com.cn','mrjjxw.com','stockstar.com','10jqka.com.cn','hexun.com','financialnews.com.cn','hkej.com','etnet.com.hk','businesstimes.com.sg','scmp.com','nikkei.com','moneydj.com','cnyes.com','udn.com','reutersconnect.com','pbc.gov.cn','rbi.org.in','hkma.gov.hk','ecb.europa.eu','federalreserve.gov'];
export function trustedPublisher(url){try{const host=new URL(url).hostname.toLowerCase();return TRUSTED_DOMAINS.some(d=>host===d||host.endsWith('.'+d))}catch{return false}}
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
  const isAggregate=source.url.includes('news.google.com');
  const publisherUrl=safeUrl(b.match(/<source\b[^>]*url=["']([^"']+)["']/i)?.[1]||'');
  if(isAggregate&&!trustedPublisher(publisherUrl))return [];
  const cleanTitle=(title.endsWith(' - '+publisher)?title.slice(0,-publisher.length-3):title).split('|')[0].trim();
  const companies=COMPANIES.filter(c=>new RegExp(c.id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'|'+c.name,'i').test(cleanTitle)).map(c=>c.id);
  let category=source.category;
  if(['company','earnings'].includes(category)){category=isEarnings(cleanTitle)?'earnings':'company';if(source.category==='earnings'&&category!=='earnings')return [];}
  else if(category==='market'&&/央行|美联储|利率|通胀|GDP|非农|货币政策|降息|加息|汇率|外汇|人民银行|流动性|英国预算/.test(cleanTitle))category='macro';
  const matched=COMPANIES.filter(c=>companies.includes(c.id));const region=matched.length&&['company','earnings'].includes(category)?matched[0].region:source.region;
  const raw=tag(b,'description')||tag(b,'summary')||tag(b,'content');
  return [{id:createHash('sha256').update(cleanTitle.toLowerCase().replace(/\s/g,'')).digest('hex').slice(0,20),title:cleanTitle,summary:isAggregate?'':raw.slice(0,450),url,publisherUrl,source:publisher,sourceId:source.id,official:source.official,via:isAggregate?'Google 新闻聚合':'直接来源',publishedAt:new Date(ts).toISOString(),collectedAt:new Date(now).toISOString(),category,region,companies}];
 });
}
export function mergeNews(items,now=Date.now()){
 const map=new Map();for(const a of items){if(a.via==='Google 新闻聚合'&&!trustedPublisher(a.publisherUrl))continue;if(!Number.isFinite(Date.parse(a.publishedAt))||Date.parse(a.publishedAt)<now-90*DAY)continue;const old=map.get(a.id);if(!old||a.official&&!old.official)map.set(a.id,a);}
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
 const rawClose=r.indicators?.quote?.[0]?.close||[],adjusted=r.indicators?.adjclose?.[0]?.adjclose||[];
 const adjustedBasis=asset.kind==='equity'&&adjusted.filter(v=>Number.isFinite(v)&&v>0).length>=2;
 const close=adjustedBasis?adjusted:rawClose;
 const points=(r.timestamp||[]).flatMap((t,i)=>Number.isFinite(t)&&t*1000<=now&&Number.isFinite(close[i])&&close[i]>0?[{date:date(t),value:close[i]}]:[]);
 const unique=[...new Map(points.map(p=>[p.date,p])).values()].sort((a,b)=>a.date.localeCompare(b.date));
 if(!unique.length)throw new Error('无有效日线');
 const latest=unique.at(-1),prior=unique.at(-2);
 const currency=r.meta.currency,unit=asset.kind==='equity'?({USD:'美元/股',CNY:'人民币/股',HKD:'港元/股',JPY:'日元/股',EUR:'欧元/股',INR:'卢比/股',GBP:'英镑/股',GBp:'便士/股 (GBp)'}[currency]||currency+'/股'):asset.unit;
 return {...asset,unit,points:unique,price:latest.value,changePct:prior?(latest.value/prior.value-1)*100:null,asOf:latest.date,quoteTime:r.meta.regularMarketTime?new Date(r.meta.regularMarketTime*1000).toISOString():null,timezone:tz,currency,priceBasis:asset.kind==='equity'?(adjustedBasis?'adjusted':'close'):undefined,source:'Yahoo Finance · 日线',sourceUrl:'https://finance.yahoo.com/quote/'+encodeURIComponent(asset.symbol)+'/',fetchedAt:new Date(now).toISOString(),ok:true,error:null,note:asset.kind==='equity'?(adjustedBasis?'采用供应商调整后收盘价（拆股、分红调整），历史数据可能随公司行动修订。':'调整后数据不可用，整条曲线采用供应商收盘价，未另行作分红复权。')+(currency==='GBp'?'以便士计价，100 便士 = 1 英镑。':'')+'各市场交易日与收盘时间不同，日线可能包含当日未收盘数据；区间变化不等于已实现收益。':asset.id==='gold'||asset.id==='oil'?'连续近月期货，换月可能影响走势；非现货报价。':'日线可能包含当日未收盘数据；涨跌对比上一条有效日线。'};
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
 const calendarPromise=collectCalendar(previous,now);
 const bondsPromise=collectBonds(previous.bonds,now);
 const quarterPromise=collectQuarterNews({sources:SOURCES,request,parseNews,pool,previous,now});
 const stocksPromise=pool(COMPANY_ASSETS,async a=>{try{return await collectMarket(a,now)}catch(e){const old=previous.companyMarkets?.find(m=>m.id===a.id);return {...a,...old,points:old?.points||[],ok:false,error:String(e.message).slice(0,160)}}},4);
 const newsResults=await pool(SOURCES,async s=>{try{const items=await collectSource(s,now);return {items,status:{id:s.id,name:s.name,url:s.home,ok:true,count:items.length,checkedAt:stamp,error:null}};}catch(e){return {items:[],status:{id:s.id,name:s.name,url:s.home,ok:false,count:0,checkedAt:stamp,error:String(e.message).slice(0,160)}};}});
 const markets=await pool(ASSETS,async a=>{try{return await collectMarket(a,now);}catch(e){const old=previous.markets?.find(m=>m.id===a.id);return {...a,...old,points:old?.points||[],ok:false,error:String(e.message).slice(0,160)};}});
 let fxReference=previous.fxReference||null;let fxStatus;
 try{const points=parseECB(await request('https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml'));if(!points.length)throw new Error('无有效参考汇率');fxReference={base:'EUR',source:'欧洲央行',url:'https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html',fetchedAt:stamp,points};fxStatus={id:'ecb-fx',name:'欧洲央行 · 参考汇率',url:fxReference.url,ok:true,count:points.length,checkedAt:stamp};}catch(e){fxStatus={id:'ecb-fx',name:'欧洲央行 · 参考汇率',url:'https://www.ecb.europa.eu/',ok:false,count:0,error:e.message,checkedAt:stamp};}
 const news=mergeNews([...newsResults.flatMap(r=>r.items),...(previous.news||[])],now);
 if(!newsResults.some(r=>r.status.ok&&r.items.length)&&!markets.some(m=>m.ok))throw new Error('本次全部来源失败，保留上一版日报');
 const companyMarkets=await stocksPromise,bonds=await bondsPromise;
 const sources=[...newsResults.map(r=>r.status),fxStatus,...bonds.sources,{id:'company-prices',name:'主要公司 · 股票日线',url:'https://finance.yahoo.com/',ok:companyMarkets.every(m=>m.ok),count:companyMarkets.filter(m=>m.ok).length,checkedAt:stamp,error:companyMarkets.every(m=>m.ok)?null:companyMarkets.filter(m=>!m.ok).map(m=>m.name).join('、')+'未更新'}];
 const date=beijingDate(now),today=news.filter(n=>Date.parse(n.publishedAt)>=now-DAY);
 const selected=[];const counts=new Map();for(const c of ['macro','market','earnings','company','gold','crypto']){const candidates=today.filter(n=>n.category===c);for(const n of candidates){if((counts.get(n.source)||0)>=2)continue;selected.push(n.id);counts.set(n.source,(counts.get(n.source)||0)+1);if(selected.filter(id=>news.find(x=>x.id===id)?.category===c).length>=2)break;}}
 const edition={date,generatedAt:stamp,newsCount:today.length,headlineIds:selected,coverage:newsResults.filter(r=>r.status.ok).length,totalSources:newsResults.length,markets:markets.map(({points,...m})=>m)};
 return {schemaVersion:1,generatedAt:stamp,producer:process.env.GITHUB_ACTIONS?'github-actions':'local',news,markets,companyMarkets,bonds,fxReference,sources,...await calendarPromise,...await quarterPromise,editions:[edition,...(previous.editions||[]).filter(e=>e.date!==date)].slice(0,120)};
}


