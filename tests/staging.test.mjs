import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {Miniflare} from 'miniflare';
import {build} from 'esbuild';
const origin='https://staging.test';
const manifest=JSON.parse(readFileSync('server/review-manifest.json','utf8'));
const article=Object.keys(manifest.pages).find(p=>p.startsWith('/blog/')&&p!=='/blog/');
const salt='0123456789abcdef0123456789abcdef',password='local-test-password-only';
const encoder=new TextEncoder();const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
const hash=await crypto.subtle.deriveBits({name:'PBKDF2',salt:Uint8Array.from(salt.match(/../g),s=>parseInt(s,16)),iterations:100000,hash:'SHA-256'},key,256);
const stored=salt+':'+Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join('');
mkdirSync('.wrangler',{recursive:true});
await build({entryPoints:['server/worker.mjs'],bundle:true,format:'esm',platform:'browser',outfile:'.wrangler/test-worker.mjs'});
const options={modules:true,scriptPath:'.wrangler/test-worker.mjs',compatibilityDate:'2026-07-30',d1Databases:['DB'],bindings:{STAGING_PASSWORD_HASH:stored,SESSION_SECRET:'only-for-local-tests-use-a-strong-secret-in-staging',REVIEW_SCOPE:'main'},serviceBindings:{ASSETS:()=>new Response('protected asset')}};
test('authentication, page/branch isolation, shared comments and persistence',async()=>{
 const mf=new Miniflare(options);
 try{
 const db=await mf.getD1Database('DB');await db.exec(readFileSync('migrations/0001_review.sql','utf8').replace(/\n/g,' '));
 const fetch=(path,opts={})=>mf.dispatchFetch(origin+path,opts);
 for(const path of ['/','/_astro/font.woff2','/_review/mode.js','/build-info.json']){const r=await fetch(path,{redirect:'manual'});assert.equal(r.status,303);assert.equal(r.headers.get('location'),'/__login');assert.match(r.headers.get('x-robots-tag'),/noindex/)}
 assert.equal((await fetch('/api/review/threads')).status,401);
 const payload='1.'+crypto.randomUUID(),signingKey=await crypto.subtle.importKey('raw',encoder.encode(options.bindings.SESSION_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',signingKey,encoder.encode(payload))),n=>n.toString(16).padStart(2,'0')).join('');
 assert.equal((await fetch('/api/review/threads',{headers:{Cookie:'__Host-review_session='+payload+'.'+signature}})).status,401);
 const login=()=>fetch('/__login',{method:'POST',redirect:'manual',headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({password}).toString()});
 const response=await login();assert.equal(response.status,303);const cookie=response.headers.get('set-cookie').split(';')[0];assert.match(response.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Strict/);
 assert.equal((await fetch('/_review/mode.js',{headers:{Cookie:cookie}})).status,200);
 assert.equal((await fetch('/__login',{method:'POST',headers:{Origin:'https://evil.test'},body:'password=x'})).status,403);
 assert.equal((await fetch('/api/review/threads',{headers:{Cookie:cookie.replace(/.$/,'z')}})).status,401);
 const visitor=crypto.randomUUID(),secondVisitor=crypto.randomUUID();
 const api=async(path,method='GET',body,extra={})=>{const r=await fetch('/api/review'+path,{method,headers:{Origin:origin,Cookie:cookie,'X-Review-Visitor':visitor,'X-Review-Page':'/','X-Review-Scope':'main','Content-Type':'application/json',...extra},...(body?{body:JSON.stringify(body)}:{})});return{status:r.status,data:await r.json()}};
 const data={requestId:crypto.randomUUID(),name:'QA',body:'Persistent point comment',anchor:'hero',anchorLabel:'Hero',x:2500,y:2000,width:0,height:0,selectionType:'point',commit:'abc1234',viewportWidth:1440,viewportHeight:900};
 const created=await api('/threads','POST',data);assert.equal(created.status,200);const tid=created.data.id;
 assert.equal((await api('/threads','POST',data)).data.id,tid);
 assert.equal((await api('/threads','POST',{...data,body:'changed'})).status,409);
 assert.equal((await api('/threads/'+tid,'GET',null,{'X-Review-Page':article})).status,404);
 assert.equal((await api('/threads/'+tid,'GET',null,{'X-Review-Scope':'other'})).status,400);
 assert.equal((await api('/threads','GET',null,{'X-Review-Page':'/__invalid'})).status,400);
 const other=await api('/threads','GET',null,{'X-Review-Visitor':secondVisitor});assert.equal(other.data.threads.length,1);
 const area=await api('/threads','POST',{...data,requestId:crypto.randomUUID(),body:'Area comment',width:2000,height:1500,selectionType:'area'});assert.equal(area.status,200);
 const reply=await api(`/threads/${tid}/replies`,'POST',{requestId:crypto.randomUUID(),name:'Second reviewer',body:'A reply'});assert.equal(reply.status,200);
 const detail=await api('/threads/'+tid);assert.equal(detail.data.replies.length,1);assert.equal(detail.data.thread.commit_id,'abc1234');assert.equal(detail.data.thread.viewport_width,1440);
 const mid=detail.data.root.id;
 assert.equal((await api(`/messages/${mid}/reactions`,'PUT',{emoji:'👍',active:true})).status,200);
 assert.equal((await api(`/messages/${mid}/reactions`,'PUT',{emoji:'👍',active:true},{'X-Review-Page':article})).status,404);
 assert.equal((await api('/threads/'+tid,'PATCH',{name:'QA',resolved:true})).status,200);
 assert.equal((await api('/threads?status=resolved')).data.threads.length,1);
 assert.equal((await api('/threads/'+tid,'PATCH',{name:'QA',resolved:false})).status,200);
 // A deployment/rollback reuses the same D1 binding and retains both conversations.
 await mf.setOptions({...options,bindings:{...options.bindings,REVIEW_SCOPE:'pr-9'}});
 assert.equal((await api('/threads?status=all','GET',null,{'X-Review-Scope':'pr-9'})).data.threads.length,0);
 await mf.setOptions(options);
 assert.equal((await api('/threads?status=all')).data.threads.length,2);
 const logout=await fetch('/__logout',{method:'POST',redirect:'manual',headers:{Origin:origin,Cookie:cookie}});assert.equal(logout.status,303);assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);
 for(let i=0;i<10;i++)await login();assert.equal((await login()).status,429);
 }finally{await mf.dispose()}
});
