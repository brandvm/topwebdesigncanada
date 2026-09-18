import manifest from './review-manifest.json';
import {rateLimit} from './worker.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const emojis=['👍','❤️','👀'];
const fail=(status,message)=>{throw Object.assign(new Error(message),{status})};
const clean=(v,min,max,label)=>{if(typeof v!=='string'||v.trim().length<min||v.trim().length>max)fail(400,`Invalid ${label}.`);return v.trim()};
const id=value=>{if(!/^\d{1,12}$/.test(String(value))||Number(value)<1)fail(400,'Invalid ID.');return Number(value)};
const uuid=value=>{if(!UUID.test(value||''))fail(400,'Invalid request identity.');return value};
async function readBody(request){if(!request.headers.get('content-type')?.startsWith('application/json'))fail(415,'JSON required.');const reader=request.body?.getReader();if(!reader)fail(400,'Missing request.');let text='',size=0;const decoder=new TextDecoder();while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>10000){await reader.cancel();fail(413,'Comment is too long.')}text+=decoder.decode(value,{stream:true})}try{return JSON.parse(text+decoder.decode())}catch{fail(400,'Invalid JSON.')}}
async function route(request,env,url,identity){
 const db=env.DB,page=request.headers.get('x-review-page'),scope=request.headers.get('x-review-scope');
 if(!page||!Object.hasOwn(manifest.pages,page)||scope!==(env.REVIEW_SCOPE||'main'))fail(400,'Invalid review page or branch. Reload the page.');
 const canonical=manifest.aliases?.[page]||page;
 const pages=[canonical,...Object.entries(manifest.aliases||{}).filter(([,to])=>to===canonical).map(([from])=>from)];
 const placeholders=pages.map(()=>'?').join(',');
 const visitor=uuid(identity.visitor);
 const parts=url.pathname.slice('/api/review/'.length).split('/').filter(Boolean),method=request.method;
 const threadRecord=async threadId=>{const t=await db.prepare(`SELECT * FROM review_threads WHERE id=? AND page IN (${placeholders}) AND scope=?`).bind(threadId,...pages,scope).first();if(!t)fail(404,'Thread not found on this page and branch.');return t};
 async function decorate(messages){if(!messages.length)return[];const rows=await db.prepare(`SELECT message_id,emoji,COUNT(*) AS count,MAX(CASE WHEN visitor_id=? THEN 1 ELSE 0 END) AS mine FROM review_reactions WHERE message_id IN (${messages.map(()=>'?').join(',')}) GROUP BY message_id,emoji`).bind(visitor,...messages.map(m=>m.id)).all();return messages.map(m=>({...m,reactions:emojis.map(emoji=>{const r=rows.results.find(r=>r.message_id===m.id&&r.emoji===emoji);return{emoji,count:r?.count||0,mine:Boolean(r?.mine)}})}))}
 if(method==='GET'&&parts[0]==='threads'&&parts.length===1){
  const status=url.searchParams.get('status')||'open';if(!['open','resolved','all'].includes(status))fail(400,'Invalid filter.');
  const before=url.searchParams.has('before')?id(url.searchParams.get('before')):Number.MAX_SAFE_INTEGER;
  const rows=await db.prepare(`SELECT t.*,m.name,m.body,m.id AS message_id,(SELECT COUNT(*)-1 FROM review_messages WHERE thread_id=t.id) AS reply_count FROM review_threads t JOIN review_messages m ON m.id=(SELECT MIN(id) FROM review_messages WHERE thread_id=t.id) WHERE t.page IN (${placeholders}) AND t.scope=? AND t.id<? ${status==='all'?'':'AND t.resolved=?'} ORDER BY t.id DESC LIMIT 51`).bind(...pages,scope,before,...(status==='all'?[]:[status==='resolved'?1:0])).all();
  const items=rows.results.slice(0,50),roots=await decorate(items.map(t=>({id:t.message_id})));
  const counts=await db.prepare(`SELECT COUNT(*) AS total,COALESCE(SUM(CASE WHEN resolved=0 THEN 1 ELSE 0 END),0) AS open,COALESCE(SUM(resolved),0) AS resolved FROM review_threads WHERE page IN (${placeholders}) AND scope=?`).bind(...pages,scope).first();
  return{threads:items.map((t,i)=>({...t,reactions:roots[i].reactions})),counts,next:rows.results.length>50?items.at(-1).id:null};
 }
 if(method==='GET'&&parts[0]==='threads'&&parts.length===2){const thread=await threadRecord(id(parts[1]));const root=await db.prepare('SELECT * FROM review_messages WHERE thread_id=? ORDER BY id LIMIT 1').bind(thread.id).first();const before=url.searchParams.has('before')?id(url.searchParams.get('before')):Number.MAX_SAFE_INTEGER;const rows=await db.prepare('SELECT * FROM review_messages WHERE thread_id=? AND id>? AND id<? ORDER BY id DESC LIMIT 51').bind(thread.id,root.id,before).all();const replies=rows.results.slice(0,50),decorated=await decorate([root,...replies]);return{thread,root:decorated[0],replies:decorated.slice(1).reverse(),next:rows.results.length>50?replies.at(-1).id:null}}
 if(!['POST','PUT','PATCH'].includes(method))fail(405,'Unsupported method.');
 const data=await readBody(request);if(!data||typeof data!=='object')fail(400,'Invalid request.');
 if(!await rateLimit(db,request,'writes',90,60))fail(429,'Please wait a minute before trying again.');
 if(method==='POST'&&parts[0]==='threads'&&parts.length===1){
  const requestId=uuid(data.requestId),name=identity.name,body=clean(data.body,1,3000,'comment');
  const anchor=clean(data.anchor,1,240,'anchor'),label=clean(data.anchorLabel,1,120,'anchor label');
  if(!manifest.pages[page].includes(anchor))fail(400,'This page section changed. Reload and select its current location; your draft is saved.');
  const commit=clean(data.commit,1,64,'revision');if(!/^[a-zA-Z0-9._-]+$/.test(commit))fail(400,'Invalid revision.');
  const vw=data.viewportWidth,vh=data.viewportHeight;if(!Number.isInteger(vw)||!Number.isInteger(vh)||vw<100||vw>20000||vh<100||vh>20000)fail(400,'Invalid viewport.');
  const x=data.x,y=data.y,w=data.width||0,h=data.height||0,type=data.selectionType||'point';
  if(![x,y,w,h].every(Number.isInteger)||[x,y,w,h].some(v=>v<0)||x+w>10000||y+h>10000||!['area','point'].includes(type)||(type==='area'&&(!w||!h))||(type==='point'&&(w||h)))fail(400,'Invalid selection.');
  const old=await db.prepare('SELECT t.*,m.visitor_id,m.name,m.body FROM review_threads t JOIN review_messages m ON m.request_id=t.request_id WHERE t.request_id=?').bind(requestId).first();
  if(old){if(!pages.includes(old.page)||old.scope!==scope||old.visitor_id!==visitor||old.body!==body||old.name!==name||old.anchor!==anchor||old.x!==x||old.y!==y||old.width!==w||old.height!==h||old.commit_id!==commit)fail(409,'Request already used.');return{id:old.id}}
  if(!await rateLimit(db,request,'threads',30,600))fail(429,'Please wait before adding more threads.');
  const now=Date.now();await db.batch([
   db.prepare('INSERT INTO review_threads (request_id,page,scope,commit_id,viewport_width,viewport_height,anchor,anchor_label,x,y,width,height,selection_type,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(request_id) DO NOTHING').bind(requestId,canonical,scope,commit,vw,vh,anchor,label,x,y,w,h,type,now),
   db.prepare('INSERT INTO review_messages (request_id,thread_id,visitor_id,name,body,created_at) SELECT ?,id,?,?,?,? FROM review_threads WHERE request_id=? ON CONFLICT(request_id) DO NOTHING').bind(requestId,visitor,name,body,now,requestId)
  ]);return await db.prepare('SELECT id FROM review_threads WHERE request_id=?').bind(requestId).first();
 }
 if(method==='POST'&&parts[0]==='threads'&&parts.length===3&&parts[2]==='replies'){
  const t=await threadRecord(id(parts[1])),requestId=uuid(data.requestId),name=identity.name,body=clean(data.body,1,3000,'reply');
  const old=await db.prepare('SELECT * FROM review_messages WHERE request_id=?').bind(requestId).first();if(old){if(old.thread_id!==t.id||old.visitor_id!==visitor||old.name!==name||old.body!==body)fail(409,'Request already used.');return{id:old.id}}
  await db.prepare('INSERT INTO review_messages (request_id,thread_id,visitor_id,name,body,created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(request_id) DO NOTHING').bind(requestId,t.id,visitor,name,body,Date.now()).run();return await db.prepare('SELECT id FROM review_messages WHERE request_id=?').bind(requestId).first();
 }
 if(method==='PATCH'&&parts[0]==='threads'&&parts.length===2){const t=await threadRecord(id(parts[1])),name=identity.name;if(typeof data.resolved!=='boolean')fail(400,'Invalid status.');await db.prepare('UPDATE review_threads SET resolved=?,resolved_by=?,resolved_at=? WHERE id=?').bind(data.resolved?1:0,data.resolved?name:null,data.resolved?Date.now():null,t.id).run();return{ok:true}}
 if(method==='PUT'&&parts[0]==='messages'&&parts.length===3&&parts[2]==='reactions'){
  const mid=id(parts[1]);if(!emojis.includes(data.emoji)||typeof data.active!=='boolean')fail(400,'Invalid reaction.');
  const message=await db.prepare(`SELECT m.id FROM review_messages m JOIN review_threads t ON t.id=m.thread_id WHERE m.id=? AND t.page IN (${placeholders}) AND t.scope=?`).bind(mid,...pages,scope).first();if(!message)fail(404,'Comment not found.');
  if(data.active)await db.prepare('INSERT INTO review_reactions (message_id,visitor_id,emoji) VALUES (?,?,?) ON CONFLICT DO NOTHING').bind(mid,visitor,data.emoji).run();else await db.prepare('DELETE FROM review_reactions WHERE message_id=? AND visitor_id=? AND emoji=?').bind(mid,visitor,data.emoji).run();return{ok:true}
 }
 fail(404,'Endpoint not found.');
}
export async function review(request,env,url,identity){try{return new Response(JSON.stringify(await route(request,env,url,identity)),{headers:{'Content-Type':'application/json; charset=utf-8'}})}catch(e){const status=e.status||503;if(status===503)console.error('Review storage error',e.message);return new Response(JSON.stringify({error:status===503?'Comments are temporarily unavailable. Your draft is saved; please retry.':e.message}),{status,headers:{'Content-Type':'application/json; charset=utf-8',...(status===429?{'Retry-After':'60'}:{})}})}}
