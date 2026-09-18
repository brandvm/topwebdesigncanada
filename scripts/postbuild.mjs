import {readFile,writeFile,mkdir,readdir,cp} from 'node:fs/promises';
import {join} from 'node:path';
import sharp from 'sharp';
const site=JSON.parse(await readFile('src/data/site.json','utf8'));
const staging=process.env.DEPLOY_ENV==='staging';
const manifest=JSON.parse(await readFile('docs/content-manifest.json','utf8'));
const routes=['/','/blog/',...manifest.articles.filter(a=>a.slug!==site.homeArticle).map(a=>'/blog/'+a.slug+'/')];
const aliases={['/blog/'+site.homeArticle+'/']:'/'};
await writeFile('dist/_redirects',Object.entries(aliases).map(([from,to])=>from+' '+to+' 301').join('\n')+'\n');
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
 await cp('design','dist/design',{recursive:true});
 const designRoutes=['/design/'];
 const {build}=await import('esbuild');
 const {parseHTML}=await import('linkedom');
 await mkdir('dist/_review',{recursive:true});
 await build({entryPoints:['src/scripts/site-mode.ts'],outdir:'dist/_review',entryNames:'mode',chunkNames:'[name]-[hash]',bundle:true,format:'esm',splitting:true,minify:true,target:'es2022',define:{'import.meta.env.BASE_URL':'"/"'},plugins:[{name:'inline-css',setup(b){b.onResolve({filter:/\.css\?inline$/},args=>({path:decodeURIComponent(new URL(args.path.replace('?inline',''),new URL('../src/scripts/',import.meta.url)).pathname),namespace:'text-css'}));b.onLoad({filter:/.*/,namespace:'text-css'},async args=>({contents:await readFile(args.path,'utf8'),loader:'text'}))}}]});
 await writeFile('dist/_review/mode.css',await readFile('src/styles/site-mode.css'));
 const reviewManifest={pages:{},aliases};
 for(const route of [...emitted,'/404.html',...designRoutes]){
  const file=route.endsWith('.html')?'dist'+route:join('dist',route,'index.html');
  const {document:doc}=parseHTML(await readFile(file,'utf8'));
  const config={site:site.repo,page:route,scope:process.env.REVIEW_SCOPE||'main',commit:process.env.BUILD_COMMIT||'local'};
  doc.body.setAttribute('data-review-config',JSON.stringify(config));
  reviewManifest.pages[route]=['page',...[...doc.querySelectorAll('[data-review-anchor]')].map(e=>e.getAttribute('data-review-anchor'))];
  doc.head.insertAdjacentHTML('beforeend','<link rel="stylesheet" href="/_review/mode.css">');
  doc.body.insertAdjacentHTML('beforeend',`<div id="site-mode" class="site-mode" role="region" aria-label="Staging review" hidden><div class="site-mode-group"><button type="button" data-site-mode="browse" aria-pressed="true"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M168,132.69,214.08,115l.33-.13A16,16,0,0,0,213,85.07L52.92,32.8A15.95,15.95,0,0,0,32.8,52.92L85.07,213a15.82,15.82,0,0,0,14.41,11l.78,0a15.84,15.84,0,0,0,14.61-9.59l.13-.33L132.69,168,184,219.31a16,16,0,0,0,22.63,0l12.68-12.68a16,16,0,0,0,0-22.63ZM195.31,208,144,156.69a16,16,0,0,0-26,4.93c0,.11-.09.22-.13.32l-17.65,46L48,48l159.85,52.2-45.95,17.64-.32.13a16,16,0,0,0-4.93,26h0L208,195.31Z"/></svg>Browse</button><button type="button" data-site-mode="review" aria-pressed="false"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M128,24A104,104,0,0,0,36.18,176.88L24.83,210.93a16,16,0,0,0,20.24,20.24l34.05-11.35A104,104,0,1,0,128,24Zm0,192a87.87,87.87,0,0,1-44.06-11.81,8,8,0,0,0-6.54-.67L40,216,52.47,178.6a8,8,0,0,0-.66-6.54A88,88,0,1,1,128,216Z"/></svg>Comment</button></div><div id="review-tools" hidden></div><span id="reviewer-name" class="reviewer-name"></span><form method="post" action="/__logout"><button class="logout" type="submit">Log out</button></form></div><div id="site-mode-status" class="site-mode-status" role="status" hidden></div><script type="module" src="/_review/mode.js"></script>`);
  await writeFile(file,doc.toString());
 }
 for(const [from,to] of Object.entries(aliases))reviewManifest.pages[from]=reviewManifest.pages[to];
 await writeFile('server/review-manifest.json',JSON.stringify(reviewManifest,null,2)+'\n');
}
