import assert from 'node:assert/strict';
import {existsSync,readFileSync,readdirSync,statSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {parseHTML} from 'linkedom';

const read = path => JSON.parse(readFileSync(path,'utf8'));
const site = read('src/data/site.json');
const info = read('dist/build-info.json');
assert.equal(info.environment,'production','Only a production build may be published');
const config = read('wrangler.production.jsonc');
assert.equal(config.name,site.repo);
assert.equal(config.preview_urls,false,'Production versions must not create additional preview URLs');
assert.deepEqual(Object.keys(config).sort(),['$schema','account_id','assets','compatibility_date','name','preview_urls','routes','workers_dev','main'].sort(),'Production only serves static content with CSP response headers; no review code, secrets or database bindings');
assert.deepEqual(config.assets,{directory:'./dist',not_found_handling:'404-page',html_handling:'auto-trailing-slash',binding:'ASSETS',run_worker_first:['/*','!/_astro/*','!/images/*','!/_analytics/*','!/brand/*']});
assert.equal(config.main,'server/production.mjs');
assert(site.domain.startsWith('www.'),'Production canonical host uses www');
assert.deepEqual(config.routes.map(route=>route.pattern).sort(),[site.domain,site.domain.slice(4)].sort(),'Only canonical www and its apex may route to production');
for(const route of config.routes){
  assert.deepEqual(Object.keys(route).sort(),['pattern','custom_domain','zone_id','previews_enabled'].sort());
  assert.equal(route.custom_domain,true);assert.equal(route.previews_enabled,false);
  assert(/^[a-f0-9]{32}$/.test(route.zone_id));
}


const files=[];
function walk(dir){for(const name of readdirSync(dir)){const path=join(dir,name);statSync(path).isDirectory()?walk(path):files.push(path)}}
walk('dist');
assert(!files.some(path=>/\.(?:[cm]?js|map)$/.test(path)&&path!=='dist/_analytics/consent.js'),'Only the analytics consent controller may ship as executable code');
for(const path of ['dist/_review','dist/api','dist/design','dist/__login','dist/__logout'])assert(!existsSync(path),`${path} is private to staging`);
const titles=new Set(),descriptions=new Set(),pages=[];
for(const route of info.pages){
  const path=join('dist',route,'index.html');
  const html=readFileSync(path,'utf8');
  const {document:doc}=parseHTML(html);
  const title=doc.querySelector('title')?.textContent.trim();
  const description=doc.querySelector('meta[name="description"]')?.getAttribute('content');
  assert.equal(doc.querySelectorAll('title').length,1,`${route}: exactly one title`);
  assert.equal(doc.querySelectorAll('meta[name="description"]').length,1,`${route}: exactly one description`);
  assert(title?.length>=10&&title.length<=70,`${route}: concise descriptive title (${title?.length})`);
  assert(description?.length>=80&&description.length<=170,`${route}: useful description (${description?.length})`);
  assert(!titles.has(title),`${route}: unique search title`);titles.add(title);
  assert(!descriptions.has(description),`${route}: unique description`);descriptions.add(description);
  assert.equal(doc.querySelectorAll('main').length,1,`${route}: one main landmark`);
  assert(doc.querySelector('body > .wrap > header'),`${route}: site header landmark`);
  assert(doc.querySelector('body > .wrap > footer'),`${route}: site footer landmark`);
  for(const nav of doc.querySelectorAll('nav'))assert(nav.getAttribute('aria-label'),`${route}: named navigation`);
  for(const table of doc.querySelectorAll('table')){
    assert(table.querySelector('caption'),`${route}: table has a caption`);
    assert(table.querySelector('thead th[scope="col"]'),`${route}: table has column headers`);
    for(const row of table.querySelectorAll('tbody tr'))assert.equal(row.querySelectorAll('th[scope="row"]').length,1,`${route}: table rows have an identifying header`);
  }
  assert.equal(doc.querySelector('link[rel="canonical"]')?.getAttribute('href'),`https://${site.domain}${route}`);
  assert.equal(doc.querySelector('meta[property="og:title"]')?.getAttribute('content'),title);
  assert.equal(doc.querySelector('meta[property="og:description"]')?.getAttribute('content'),description);
  const heading=doc.querySelector('h1');
  if(heading?.querySelector('.title-year'))assert(/\s2026 guide$/.test(heading.textContent),`${route}: title and year retain a word separator`);
  const headings=[...doc.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(h=>({level:Number(h.tagName[1]),text:h.textContent.trim()}));
  pages.push({route,title,description,canonical:`https://${site.domain}${route}`,headings});
}
for(const file of files.filter(file=>file.endsWith('.html'))){
  const html=readFileSync(file,'utf8');
  const {document:doc}=parseHTML(html);
  for(const meta of doc.querySelectorAll('meta')){
    const name=(meta.getAttribute('name')||meta.getAttribute('http-equiv')||'').toLowerCase();
    if(/robots|googlebot|bingbot/.test(name))assert(!/\b(noindex|nofollow|none)\b/i.test(meta.getAttribute('content')||''),`${file}: indexable content`);
  }
  assert(!/data-review-|\/api\/review|\/_review\/|id="site-mode"|action="\/__login"|action="\/__logout"/.test(html),`${file}: no review or login markup`);
  for(const script of doc.querySelectorAll('script:not([type="application/ld+json"])')){assert.equal(script.getAttribute('src'),'/_analytics/consent.js',`${file}: only consent controller`);assert(script.hasAttribute('defer'));}
  const analytics=doc.querySelector('[data-analytics-consent]');
  if(analytics){assert.equal(analytics.getAttribute('data-analytics-host'),site.domain);assert(/^G-[A-Z0-9]+$/.test(analytics.getAttribute('data-measurement-id')));assert(analytics.hasAttribute('hidden'));}
  for(const img of doc.querySelectorAll('.company-mark img'))assert(img.getAttribute('alt')?.endsWith(' logo'));
  for(const script of doc.querySelectorAll('script[type="application/ld+json"]'))for(const schema of JSON.parse(script.textContent)['@graph'])if(schema['@type']==='ItemList')for(const item of schema.itemListElement){assert.equal(item.item['@type'],'Organization');assert(item.item.url.startsWith('https://'));assert.equal(item.item.name,item.name);}
}
const robots=readFileSync('dist/robots.txt','utf8');
assert(!/^\s*Disallow:\s*\S/m.test(robots),'Production robots.txt must permit crawling');
assert(robots.includes(`Sitemap: https://${site.domain}/sitemap.xml`));
assert(!/noindex|nofollow|noarchive|no-store/i.test(readFileSync('dist/_headers','utf8')),'Production response headers must allow indexing and public caching');
assert(readFileSync('dist/.assetsignore','utf8').includes('build-info.json'),'Internal build metadata is excluded from upload');
assert(!readFileSync('dist/sitemap.xml','utf8').includes('workers.dev'),'The sitemap uses the canonical domain');
const llms=readFileSync('dist/llms.txt','utf8');
assert(llms.startsWith(`# ${site.name}\n\n> `),'llms.txt identifies the publication');
for(const route of info.pages)assert(llms.includes(`](https://${site.domain}${route})`),`${route}: llms.txt links to the canonical page`);
writeFileSync('reports/production-readiness.json',JSON.stringify({site:site.repo,domain:site.domain,build:info.commit,staticContent:true,responseHeaderWorker:true,reviewFeatures:false,crawlable:true,pages},null,2)+'\n');
console.log(`Production release checked: ${pages.length} indexable pages; unique metadata; semantic tables and landmarks; no login, review feature or database bindings.`);
