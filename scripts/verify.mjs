import {readFileSync,readdirSync,existsSync,statSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {gzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const manifest=read('docs/content-manifest.json');const site=read('src/data/site.json');
const legacy='dist/blog/'+site.homeArticle+'/index.html';
const info=read('dist/build-info.json'),staging=info.environment==='cloudflare-staging';
const base=(process.env.BASE_PATH||'/').replace(/\/$/,'');
const files=[];function walk(dir){for(const f of readdirSync(dir)){const p=join(dir,f);statSync(p).isDirectory()?walk(p):files.push(p)}}walk('dist');
const report=[];
for(const file of files.filter(f=>f.endsWith('.html')&&!f.startsWith('dist/design/')&&f!==legacy)){
 const html=readFileSync(file,'utf8'),{document:doc}=parseHTML(html);
 assert.equal(doc.querySelectorAll('h1').length,1,file+' single h1');
 assert(doc.querySelector('title')?.textContent);assert(doc.querySelector('meta[name=description]')?.content);
 assert.equal(doc.querySelector('html')?.lang,'en');
 assert.equal(Boolean(doc.querySelector('meta[name=robots][content*=noindex]')),staging,file+' indexing');
 if(!staging){assert(!doc.querySelector('script:not([type="application/ld+json"])'),file+' zero browser JavaScript');assert(!doc.querySelector('#site-mode'));assert(!existsSync('dist/_review'));}
 const anchors=[...doc.querySelectorAll('[data-review-anchor]')].map(e=>e.getAttribute('data-review-anchor'));assert.equal(new Set(anchors).size,anchors.length,file+' unique review anchors');
 const ids=[...doc.querySelectorAll('[id]')].map(e=>e.id);assert.equal(new Set(ids).size,ids.length,file+' unique ids');
 let level=0;for(const h of doc.querySelectorAll('h1,h2,h3,h4,h5,h6')){const n=Number(h.tagName[1]);assert(n<=level+1,file+' heading jump '+h.textContent);level=n}
 const schemas=[...doc.querySelectorAll('script[type="application/ld+json"]')].flatMap(s=>JSON.parse(s.textContent)['@graph']);
 assert(schemas.length>=2);assert(!JSON.stringify(schemas).includes('AggregateRating'));
 const canonical=doc.querySelector('link[rel=canonical]')?.getAttribute('href');assert.equal(canonical,'https://'+site.domain+(file==='dist/404.html'?'/404/':file.replace(/^dist/, '').replace(/index.html$/,'')));

 for(const a of doc.querySelectorAll('a[href]')){
 const value=a.getAttribute('href');if(/^(https?:|mailto:|tel:)/.test(value))continue;
 const u=new URL(value,'https://preview.test'+base+'/'+file.replace(/^dist\//,'').replace(/index.html$/,''));
 let route=decodeURIComponent(u.pathname);if(base&&route.startsWith(base+'/'))route=route.slice(base.length);
 const target=join('dist',route,route.endsWith('/')?'index.html':'');
 assert(existsSync(target),file+' broken link '+value);
 if(u.hash){const other=target===file?doc:parseHTML(readFileSync(target,'utf8')).document;assert(other.getElementById(decodeURIComponent(u.hash.slice(1))),file+' missing anchor '+value)}
 }
 let css=0,fonts=0;for(const link of doc.querySelectorAll('link[rel=stylesheet]')){let p=link.getAttribute('href');if(base)p=p.slice(base.length);const raw=readFileSync(join('dist',p));css+=gzipSync(raw).length;assert(!/newsreader|playfair|Georgia|Times New Roman/.test(raw.toString()),'No serif font stylesheet');const matches=raw.toString().matchAll(/url\(([^)]+\.woff2)\)/g);for(const match of matches){let font=match[1].replaceAll('"','').replaceAll("'",'');if(base&&font.startsWith(base+'/'))font=font.slice(base.length);fonts+=statSync(join('dist',font)).size}}
 assert(css<=40000,file+' CSS budget');assert(fonts<=150000,file+' font budget');
 const prose=doc.querySelector('[data-source-article]');if(prose){assert.equal(doc.querySelectorAll('.agency-profile').length,10);assert.equal(doc.querySelectorAll('.company-grid li').length,10);for(const profile of doc.querySelectorAll('.agency-profile'))assert(!/^\d/.test(profile.querySelector('h3').textContent),'Rank is only in its badge');assert.equal(doc.querySelectorAll('table').length,2);const slug=prose.getAttribute('data-source-article');const source=readFileSync(`src/content/articles/${slug}.mdx`,'utf8');for(const match of source.matchAll(/href="(https?:[^"<>]+)"/g))assert(html.includes(match[1]),file+' missing source link '+match[1]);const expected=manifest.articles.find(a=>a.slug===slug);for(const anchor of expected.anchors)assert(doc.getElementById(anchor.id),file+' missing source heading '+anchor.id)}
 report.push({page:file.replace('dist',''),cssGzipBytes:css,fontBytes:fonts,javascriptGzipBytes:staging?files.filter(f=>f.startsWith('dist/_review/')&&f.endsWith('.js')).reduce((n,f)=>n+gzipSync(readFileSync(f)).length,0):0,profiles:doc.querySelectorAll('.agency-profile').length});
}
const active=manifest.articles.filter(a=>!/draft: true/.test(readFileSync(`src/content/articles/${a.slug}.mdx`,'utf8')));
assert.equal(report.length,active.filter(a=>a.slug!==site.homeArticle).length+3,'home article, listing, additional articles and 404');
for(const a of manifest.articles.filter(a=>!active.includes(a))){if(a.slug!==site.homeArticle)assert(!existsSync('dist/blog/'+a.slug+'/index.html'),'draft must not be emitted');else assert(!readFileSync('dist/index.html','utf8').includes('data-source-article'),'draft homepage article must not be emitted');}
assert(existsSync(legacy),'Old article URL has a static redirect');
assert(readFileSync(legacy,'utf8').includes('http-equiv=\"refresh\"'),'Old URL redirects rather than duplicating the article');
mkdirSync('reports',{recursive:true});writeFileSync('reports/structure.json',JSON.stringify({environment:info.environment,pages:report},null,2)+'\n');
writeFileSync(`reports/structure-${staging?'staging':'production'}.json`,JSON.stringify({environment:info.environment,pages:report},null,2)+'\n');
console.log(`Verified ${report.length} pages including 404: links, anchors, metadata, headings, indexing, source links and asset budgets.`);

// Design research is staging-only and is validated independently of the editorial page count.
if(staging){
 const designPages=files.filter(f=>f.startsWith('dist/design/')&&f.endsWith('.html'));
 assert.equal(designPages.length,1);
 for(const file of designPages){
  const {document:doc}=parseHTML(readFileSync(file,'utf8'));
  assert.equal(doc.querySelectorAll('h1').length,1);
  assert(doc.querySelector('meta[name=robots][content*=noindex]'));
  assert(doc.querySelector('#site-mode'));
  const ids=[...doc.querySelectorAll('[id]')].map(e=>e.id);assert.equal(new Set(ids).size,ids.length);
  for(const e of doc.querySelectorAll('img[src],script[src],link[rel=stylesheet]')){const src=e.getAttribute('src')||e.getAttribute('href');assert(src.startsWith('/'));assert(existsSync(join('dist',src)),file+' missing design asset '+src);}
  for(const a of doc.querySelectorAll('a[href]')){const href=a.getAttribute('href');if(href.startsWith('#'))assert(doc.getElementById(href.slice(1)));else if(href.startsWith('/')){const route=href.split('#')[0];assert(existsSync(join('dist',route,route.endsWith('/')?'index.html':'')),file+' missing design link '+href);}}
 }
 console.log('Verified '+designPages.length+' staging design pages: assets, anchors, links, review controls and noindex.');
}else{assert(!existsSync('dist/design'),'Design research must never ship to production.');}
