import {readFileSync,readdirSync,existsSync,statSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {gzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const manifest=read('docs/content-manifest.json');
const info=read('dist/build-info.json'),staging=info.environment==='cloudflare-staging';
const base=(process.env.BASE_PATH||'/').replace(/\/$/,'');
const files=[];function walk(dir){for(const f of readdirSync(dir)){const p=join(dir,f);statSync(p).isDirectory()?walk(p):files.push(p)}}walk('dist');
const report=[];
for(const file of files.filter(f=>f.endsWith('.html'))){
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
 for(const a of doc.querySelectorAll('a[href]')){
 const value=a.getAttribute('href');if(/^(https?:|mailto:|tel:)/.test(value))continue;
 const u=new URL(value,'https://preview.test'+base+'/'+file.replace(/^dist\//,'').replace(/index.html$/,''));
 let route=decodeURIComponent(u.pathname);if(base&&route.startsWith(base+'/'))route=route.slice(base.length);
 const target=join('dist',route,route.endsWith('/')?'index.html':'');
 assert(existsSync(target),file+' broken link '+value);
 if(u.hash){const other=target===file?doc:parseHTML(readFileSync(target,'utf8')).document;assert(other.getElementById(decodeURIComponent(u.hash.slice(1))),file+' missing anchor '+value)}
 }
 let css=0,fonts=0;for(const link of doc.querySelectorAll('link[rel=stylesheet]')){let p=link.getAttribute('href');if(base)p=p.slice(base.length);const raw=readFileSync(join('dist',p));css+=gzipSync(raw).length;const matches=raw.toString().matchAll(/url\(([^)]+\.woff2)\)/g);for(const match of matches){let font=match[1].replaceAll('"','').replaceAll("'",'');if(base&&font.startsWith(base+'/'))font=font.slice(base.length);fonts+=statSync(join('dist',font)).size}}
 assert(css<=40000,file+' CSS budget');assert(fonts<=150000,file+' font budget');
 const prose=doc.querySelector('[data-source-article]');if(prose){assert.equal(doc.querySelectorAll('.agency-profile').length,10);assert.equal(doc.querySelectorAll('table').length,2);const slug=prose.getAttribute('data-source-article');const source=readFileSync(`src/content/articles/${slug}.mdx`,'utf8');for(const match of source.matchAll(/href="(https?:[^"<>]+)"/g))assert(html.includes(match[1]),file+' missing source link '+match[1]);const expected=manifest.articles.find(a=>a.slug===slug);for(const anchor of expected.anchors)assert(doc.getElementById(anchor.id),file+' missing source heading '+anchor.id)}
 report.push({page:file.replace('dist',''),cssGzipBytes:css,fontBytes:fonts,javascriptGzipBytes:staging?files.filter(f=>f.startsWith('dist/_review/')&&f.endsWith('.js')).reduce((n,f)=>n+gzipSync(readFileSync(f)).length,0):0,profiles:doc.querySelectorAll('.agency-profile').length});
}
const active=manifest.articles.filter(a=>!/draft: true/.test(readFileSync(`src/content/articles/${a.slug}.mdx`,'utf8')));
assert.equal(report.length,active.length+3,'home, listing, articles and 404');
for(const a of manifest.articles.filter(a=>!active.includes(a)))assert(!existsSync('dist/blog/'+a.slug+'/index.html'),'draft must not be emitted');
mkdirSync('reports',{recursive:true});writeFileSync('reports/structure.json',JSON.stringify({environment:info.environment,pages:report},null,2)+'\n');
writeFileSync(`reports/structure-${staging?'staging':'production'}.json`,JSON.stringify({environment:info.environment,pages:report},null,2)+'\n');
console.log(`Verified ${report.length} pages including 404: links, anchors, metadata, headings, indexing, source links and asset budgets.`);
