import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import sharp from 'sharp';
const site=JSON.parse(await readFile('src/data/site.json','utf8'));
const staging=process.env.DEPLOY_ENV==='staging';
const manifest=JSON.parse(await readFile('docs/content-manifest.json','utf8'));
const routes=['/','/blog/',...manifest.articles.map(a=>'/blog/'+a.slug+'/')];
const emitted=[];
for(const route of routes){try{await readFile(join('dist',route,'index.html'));emitted.push(route)}catch{}}
const sitemap='<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+emitted.map(r=>'<url><loc>https://'+site.domain+r+'</loc></url>').join('')+'</urlset>';
await writeFile('dist/sitemap.xml',sitemap);
await writeFile('dist/robots.txt',staging?'User-agent: *\nDisallow: /\n':'User-agent: *\nAllow: /\nSitemap: https://'+site.domain+'/sitemap.xml\n');
await writeFile('dist/.nojekyll','');
await writeFile('dist/build-info.json',JSON.stringify({site:site.repo,environment:staging?'cloudflare-staging':'production',commit:process.env.BUILD_COMMIT||'local',scope:process.env.REVIEW_SCOPE||'main',pages:emitted},null,2)+'\n');
await sharp('public/social.svg').png().toFile('dist/social.png');
console.log(`Prepared ${emitted.length} content pages (${staging?'noindex preview':'production'}).`);

if(staging){
 const {build}=await import('esbuild');
 const {parseHTML}=await import('linkedom');
 await mkdir('dist/_review',{recursive:true});
 await build({entryPoints:['src/scripts/site-mode.ts'],outdir:'dist/_review',entryNames:'mode',chunkNames:'[name]-[hash]',bundle:true,format:'esm',splitting:true,minify:true,target:'es2022',define:{'import.meta.env.BASE_URL':'"/"'},plugins:[{name:'inline-css',setup(b){b.onResolve({filter:/\.css\?inline$/},args=>({path:decodeURIComponent(new URL(args.path.replace('?inline',''),new URL('../src/scripts/',import.meta.url)).pathname),namespace:'text-css'}));b.onLoad({filter:/.*/,namespace:'text-css'},async args=>({contents:await readFile(args.path,'utf8'),loader:'text'}))}}]});
 await writeFile('dist/_review/mode.css',await readFile('src/styles/site-mode.css'));
 const reviewManifest={pages:{}};
 for(const route of [...emitted,'/404.html']){
  const file=route.endsWith('.html')?'dist'+route:join('dist',route,'index.html');
  const {document:doc}=parseHTML(await readFile(file,'utf8'));
  const config={site:site.repo,page:route,scope:process.env.REVIEW_SCOPE||'main',commit:process.env.BUILD_COMMIT||'local'};
  doc.body.setAttribute('data-review-config',JSON.stringify(config));
  reviewManifest.pages[route]=['page',...[...doc.querySelectorAll('[data-review-anchor]')].map(e=>e.getAttribute('data-review-anchor'))];
  doc.head.insertAdjacentHTML('beforeend','<link rel="stylesheet" href="/_review/mode.css">');
  doc.body.insertAdjacentHTML('beforeend',`<div id="site-mode" class="site-mode" role="region" aria-label="Staging review" hidden><div class="site-mode-group"><button type="button" data-site-mode="browse" aria-pressed="true">Browse</button><button type="button" data-site-mode="review" aria-pressed="false">Comment</button></div><div id="review-tools" hidden></div><form method="post" action="/__logout"><button class="logout" type="submit">Log out</button></form></div><div id="site-mode-status" class="site-mode-status" role="status" hidden></div><script type="module" src="/_review/mode.js"></script>`);
  await writeFile(file,doc.toString());
 }
 await writeFile('server/review-manifest.json',JSON.stringify(reviewManifest,null,2)+'\n');
}
