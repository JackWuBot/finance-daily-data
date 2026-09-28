export const REGIONS = { US:'美国', EU:'欧盟', JP:'日本', CN:'中国', UK:'英国', IN:'印度', HK:'香港', GLOBAL:'全球' };
export const CATEGORIES = { macro:'货币与宏观', market:'股市动态', earnings:'公司财报', company:'公司要闻', gold:'黄金', crypto:'比特币', us_bonds:'美债',cn_bonds:'中国国债',lgfv:'城投债' };
export const ASSETS = [
 ['sp500','标普 500','^GSPC','US','index','点'],['nasdaq','纳斯达克','^IXIC','US','index','点'],
 ['euro50','欧洲斯托克 50','^STOXX50E','EU','index','点'],['nikkei','日经 225','^N225','JP','index','点'],
 ['csi300','沪深 300','000300.SS','CN','index','点'],['shanghai','上证指数','000001.SS','CN','index','点'],
 ['ftse','富时 100','^FTSE','UK','index','点'],['nifty','NIFTY 50','^NSEI','IN','index','点'],
 ['hsi','恒生指数','^HSI','HK','index','点'],['gold','COMEX 黄金期货','GC=F','GLOBAL','commodity','美元/盎司'],
 ['btc','比特币','BTC-USD','GLOBAL','crypto','美元'],['oil','WTI 原油期货','CL=F','GLOBAL','commodity','美元/桶'],
 ['eurusd','欧元 / 美元','EURUSD=X','EU','fx','USD / EUR'],['usdjpy','美元 / 日元','JPY=X','JP','fx','JPY / USD'],
 ['usdcny','美元 / 人民币','CNY=X','CN','fx','CNY / USD'],['gbpusd','英镑 / 美元','GBPUSD=X','UK','fx','USD / GBP'],
 ['usdinr','美元 / 印度卢比','INR=X','IN','fx','INR / USD'],['usdhkd','美元 / 港元','HKD=X','HK','fx','HKD / USD']
].map(([id,name,symbol,region,kind,unit])=>({id,name,symbol,region,kind,unit}));
export const COMPANIES = [
 ['Apple','苹果','AAPL','US','https://investor.apple.com/'],['Microsoft','微软','MSFT','US','https://www.microsoft.com/en-us/Investor/'],
 ['NVIDIA','英伟达','NVDA','US','https://investor.nvidia.com/'],['Alphabet','谷歌','GOOGL','US','https://abc.xyz/investor/'],
 ['Amazon','亚马逊','AMZN','US','https://ir.aboutamazon.com/'],['Meta','Meta','META','US','https://investor.atmeta.com/'],
 ['Tesla','特斯拉','TSLA','US','https://ir.tesla.com/'],['Berkshire','伯克希尔','BRK-B','US','https://www.berkshirehathaway.com/reports.html'],
 ['JPMorgan','摩根大通','JPM','US','https://www.jpmorganchase.com/ir'],['Eli Lilly','礼来','LLY','US','https://investor.lilly.com/'],
 ['ASML','阿斯麦','ASML','EU','https://www.asml.com/en/investors'],['SAP','思爱普','SAP','EU','https://www.sap.com/integrated-reports.html'],
 ['LVMH','路威酩轩','MC.PA','EU','https://www.lvmh.com/en/investors'],['Novo Nordisk','诺和诺德','NVO','EU','https://www.novonordisk.com/investors.html'],
 ['Toyota','丰田','7203.T','JP','https://global.toyota/en/ir/'],['Sony','索尼','6758.T','JP','https://www.sony.com/en/SonyInfo/IR/'],
 ['HSBC','汇丰','HSBA.L','UK','https://www.hsbc.com/investors'],['AstraZeneca','阿斯利康','AZN','UK','https://www.astrazeneca.com/investor-relations.html'],
 ['Reliance','信实工业','RELIANCE.NS','IN','https://www.ril.com/investors'],['TCS','塔塔咨询','TCS.NS','IN','https://www.tcs.com/who-we-are/investor-relations'],
 ['Tencent','腾讯','0700.HK','HK','https://www.tencent.com/zh-cn/investors.html'],['Alibaba','阿里巴巴','9988.HK','HK','https://www.alibabagroup.com/ir/'],
 ['Xiaomi','小米','1810.HK','HK','https://ir.mi.com/'],['BYD','比亚迪','002594.SZ','CN','https://www.bydglobal.com/'],
 ['CATL','宁德时代','300750.SZ','CN','https://www.catl.com/'],['TSMC','台积电','TSM','GLOBAL','https://investor.tsmc.com/']
].map(([id,name,ticker,region,ir])=>({id,name,ticker,region,ir}));
export const COMPANY_ASSETS=COMPANIES.map(c=>({id:'stock-'+c.id,companyId:c.id,name:c.name,symbol:c.ticker,region:c.region,kind:'equity',unit:'',listing:c.ticker.endsWith('.HK')?'香港上市':c.ticker.endsWith('.SZ')?'深圳 A 股':c.ticker.endsWith('.T')?'东京上市':c.ticker.endsWith('.NS')?'印度 NSE':c.ticker.endsWith('.L')?'伦敦上市':c.ticker.endsWith('.PA')?'巴黎上市':['SAP','NVO','AZN','TSM'].includes(c.ticker)?'美国 ADR':c.ticker==='ASML'?'美国 Nasdaq 上市':'美国上市'}));
const news=(id,name,query,region='GLOBAL',category='market')=>({id,name,region,category,official:false,url:'https://news.google.com/rss/search?'+new URLSearchParams({q:query+' when:7d',hl:'zh-CN',gl:'CN',ceid:'CN:zh-Hans'}),home:'https://news.google.com/'});
export const SOURCES = [
 {id:'fed',name:'美联储 · 货币政策',region:'US',category:'macro',official:true,url:'https://www.federalreserve.gov/feeds/press_monetary.xml',home:'https://www.federalreserve.gov/'},
 {id:'ecb',name:'欧洲央行 · 官方公告',region:'EU',category:'macro',official:true,url:'https://www.ecb.europa.eu/rss/press.html',home:'https://www.ecb.europa.eu/'},
 {id:'boj',name:'日本央行 · 官方公告',region:'JP',category:'macro',official:true,url:'https://www.boj.or.jp/en/rss/whatsnew.xml',home:'https://www.boj.or.jp/en/'},
 {id:'boe',name:'英格兰银行 · 官方公告',region:'UK',category:'macro',official:true,url:'https://www.bankofengland.co.uk/rss/news',home:'https://www.bankofengland.co.uk/'},
 {id:'hkma',name:'香港金管局 · 官方公告',region:'HK',category:'macro',official:true,kind:'hkma',url:'https://api.hkma.gov.hk/public/press-releases?lang=sc',home:'https://www.hkma.gov.hk/'},
 ...[['US','美国','美国 (美联储 OR 通胀 OR 非农 OR 美股 OR 美元)'],['EU','欧盟','(欧盟 OR 欧元区 OR 欧洲央行) (经济 OR 利率 OR 股市)'],['JP','日本','日本 (央行 OR 日元 OR 日经 OR 通胀)'],['CN','中国','(中国央行 OR 人民银行 OR A股 OR 人民币) (经济 OR 利率 OR 股市 OR 货币)'],['UK','英国','英国 (央行 OR 英镑 OR 股市 OR 通胀)'],['IN','印度','印度 (央行 OR 卢比 OR 股市 OR 经济)'],['HK','香港','(港股 OR 恒生指数 OR 香港金管局 OR 港元)']].map(([r,n,q])=>news('news-'+r,n+' · 财经报道',q,r)),
 news('gold-news','黄金 · 市场报道','(黄金 OR 金价) (央行 OR 美元 OR ETF OR 期货)','GLOBAL','gold'),
 news('bitcoin-news','比特币 · 市场报道','(比特币 OR Bitcoin) (ETF OR 价格 OR 监管 OR 市场)','GLOBAL','crypto'),
 news('us-bond-news','美债 · 收益率与发行','(美债 OR 美国国债) (收益率 OR 拍卖 OR 发行 OR 利差)','US','us_bonds'),
 news('cn-bond-news','中国国债 · 利率与发行','(中国国债 OR 国债收益率 OR 超长期特别国债) (利率 OR 发行 OR 招标 OR 央行)','CN','cn_bonds'),
 news('lgfv-news','城投债 · 信用与再融资','(城投债 OR 城投平台) (化债 OR 利差 OR 发行 OR 融资 OR 兑付 OR 评级)','CN','lgfv'),
 ...[['us-tech','US','(苹果 OR 微软 OR 英伟达 OR 谷歌 OR 亚马逊 OR Meta OR 特斯拉)'],['us-fin','US','(摩根大通 OR 伯克希尔 OR 礼来)'],['europe','EU','(阿斯麦 OR ASML OR SAP OR 路威酩轩 OR 诺和诺德)'],['asia','JP','(丰田 OR 索尼 OR 信实工业 OR 塔塔咨询 OR 台积电)'],['china','CN','(腾讯 OR 阿里巴巴 OR 小米 OR 比亚迪 OR 宁德时代)'],['uk','UK','(汇丰 OR 阿斯利康)']].flatMap(([id,r,q])=>[
 news('earn-'+id,'上市公司 · '+id+' 财报',q+' (财报 OR 营收 OR 净利润 OR earnings)',r,'earnings'),
 news('company-'+id,'上市公司 · '+id+' 要闻',q+' (收购 OR 监管 OR 投资 OR 发布 OR 重大)',r,'company')]),
 {id:'nvidia-ir',name:'NVIDIA · 投资者公告',region:'US',category:'company',official:true,url:'https://nvidianews.nvidia.com/releases.xml',home:'https://nvidianews.nvidia.com/'},
 {id:'apple',name:'Apple · 官方新闻',region:'US',category:'company',official:true,url:'https://www.apple.com/newsroom/rss-feed.rss',home:'https://www.apple.com/newsroom/'}
];
