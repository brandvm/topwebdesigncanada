import lighthouse from 'lighthouse';
import {launch} from 'chrome-launcher';
import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {join,extname,resolve} from 'node:path';
const dist=process.env.AUDIT_DIST||'dist';
const info=JSON.parse(readFileSync(join(dist,'build-info.json'),'utf8'));
if(info.environment!=='production')throw new Error('Audit the production build; previews intentionally use noindex');
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.woff2':'font/woff2','.svg':'image/svg+xml','.png':'image/png','.txt':'text/plain','.json':'application/json','.xml':'application/xml'};
const server=createServer((req,res)=>{let p=join(dist,decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(existsSync(p)&&statSync(p).isDirectory())p=join(p,'index.html');if(!existsSync(p)){res.writeHead(404);res.end();return}res.setHeader('Content-Type',types[extname(p)]||'application/octet-stream');res.setHeader('Cache-Control','public, max-age=3600');res.end(readFileSync(p))});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const chrome=await launch({chromeFlags:['--headless','--no-sandbox','--disable-gpu'],logLevel:'silent'});
const report={site:info.site,build:info.commit,tool:'Lighthouse',runsPerPage:Number(process.env.AUDIT_RUNS||3),results:[]};
try{
 for(const route of (process.env.AUDIT_PATH?[process.env.AUDIT_PATH]:info.pages)){
  for(const mode of (process.env.AUDIT_MODE?[process.env.AUDIT_MODE]:['mobile','desktop'])){
   const runs=[];
   for(let run=1;run<=report.runsPerPage;run++){
    const result=await lighthouse(`http://127.0.0.1:${server.address().port}${route}`,{port:chrome.port,logLevel:'error',output:'json',onlyCategories:['performance','accessibility','best-practices','seo'],...(mode==='desktop'?{formFactor:'desktop',screenEmulation:{mobile:false,width:1350,height:940,deviceScaleFactor:1,disabled:false},throttling:{rttMs:40,throughputKbps:10240,cpuSlowdownMultiplier:1,requestLatencyMs:0,downloadThroughputKbps:0,uploadThroughputKbps:0}}:{})});
    const lhr=result.lhr;
    const scores=Object.fromEntries(Object.entries(lhr.categories).map(([k,v])=>[k,Math.round(v.score*100)]));
    const failures=Object.entries(lhr.audits).filter(([k,v])=>v.score!==null&&v.score<1&&lhr.categories.accessibility.auditRefs.concat(lhr.categories['best-practices'].auditRefs,lhr.categories.seo.auditRefs).some(a=>a.id===k&&a.weight>0)).map(([id,v])=>({id,title:v.title,details:v.details}));
    runs.push({scores,metrics:{lcp:lhr.audits['largest-contentful-paint'].numericValue,cls:lhr.audits['cumulative-layout-shift'].numericValue,tbt:lhr.audits['total-blocking-time'].numericValue},failures});
    console.log(JSON.stringify({route,mode,run,scores,failures:failures.map(f=>f.id)}));
   }
   const median=Object.fromEntries(Object.keys(runs[0].scores).map(k=>[k,runs.map(r=>r.scores[k]).sort((a,b)=>a-b)[Math.floor(runs.length/2)]]));
   report.results.push({route,mode,median,runs});
   mkdirSync('reports',{recursive:true});writeFileSync('reports/lighthouse.json',JSON.stringify(report,null,2)+'\n');
  }
 }
}finally{await chrome.kill();server.close()}
const failed=report.results.filter(r=>r.median.performance<95||r.median.accessibility<100||r.median['best-practices']<100||r.median.seo<100);
if(failed.length){console.error(`${failed.length} page/device combinations need attention`);process.exitCode=1}
