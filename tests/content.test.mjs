import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const manifest=read('docs/content-manifest.json');
test('every imported article has ten ranked profiles and ten FAQs',()=>{
 const slugs=new Set();
 for(const article of manifest.articles){
 assert(!slugs.has(article.slug));slugs.add(article.slug);
 const ranking=read(`src/data/rankings/${article.slug}.json`);
 const mdx=readFileSync(`src/content/articles/${article.slug}.mdx`,'utf8');
 assert.equal(ranking.agencies.length,10);
 assert.equal(new Set(ranking.agencies.map(a=>a.id)).size,10);
 assert.equal((mdx.match(/<AgencyProfile /g)||[]).length,10);
 assert.equal(article.faqs,10);assert.equal(article.criteria,6);
 ranking.agencies.forEach((a,i)=>{assert.equal(Number(a.cells[0]),i+1);assert(a.facts.length>0)});
 assert(/draft: (true|false)/.test(mdx));
 assert(!/slug:.*20[0-9]{2}/.test(mdx));
 }
});
test('dependencies use exact versions and no shared theme',()=>{
 const pkg=read('package.json');
 for(const v of Object.values({...pkg.dependencies,...pkg.devDependencies}))assert(/^\d+\.\d+\.\d+/.test(v));
 assert.equal(Object.keys(pkg.dependencies).sort().join(','),'@astrojs/mdx,astro');
});
