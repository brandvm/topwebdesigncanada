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
assert.deepEqual(Object.keys(config).sort(),['$schema','account_id','assets','compatibility_date','name','preview_urls','workers_dev'].sort(),'Production is an assets-only Worker without review code, secrets, routes or database bindings');
assert.deepEqual(config.assets,{directory:'./dist',not_found_handling:'404-page',html_handling:'auto-trailing-slash'});

const files=[];
function walk(dir){for(const name of readdirSync(dir)){const path=join(dir,name);statSync(path).isDirectory()?walk(path):files.push(path)}}
walk('dist');
assert(!files.some(path=>/\.(?:[cm]?js|map)$/.test(path)),'Public assets must not include browser scripts or source maps');
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
  assert.equal(doc.querySelectorAll('script:not([type="application/ld+json"])').length,0,`${file}: no executable browser JavaScript`);
}
const robots=readFileSync('dist/robots.txt','utf8');
assert(!/^\s*Disallow:\s*\S/m.test(robots),'Production robots.txt must permit crawling');
assert(robots.includes(`Sitemap: https://${site.domain}/sitemap.xml`));
assert(!/noindex|nofollow|noarchive|no-store/i.test(readFileSync('dist/_headers','utf8')),'Production response headers must allow indexing and public caching');
assert(readFileSync('dist/.assetsignore','utf8').includes('build-info.json'),'Internal build metadata is excluded from upload');
assert(!readFileSync('dist/sitemap.xml','utf8').includes('workers.dev'),'The sitemap uses the canonical domain');
writeFileSync('reports/production-readiness.json',JSON.stringify({site:site.repo,domain:site.domain,build:info.commit,assetsOnly:true,reviewFeatures:false,crawlable:true,pages},null,2)+'\n');
console.log(`Production release checked: ${pages.length} indexable pages; unique metadata; semantic tables and landmarks; no login, review feature or database bindings.`);
