import {review} from './review-api.mjs';

const encoder=new TextEncoder();
const cookieName='__Host-review_session';
const ttl=12*60*60;
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8'}});
const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
const unhex=value=>new Uint8Array(value.match(/.{2}/g)?.map(v=>parseInt(v,16))||[]);
function secure(response){const headers=new Headers(response.headers);headers.set('X-Robots-Tag','noindex, nofollow, noarchive');headers.set('Cache-Control','private, no-store');headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','same-origin');headers.set('X-Frame-Options','DENY');headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; object-src 'none'");return new Response(response.body,{status:response.status,headers})}
async function signingKey(secret){return crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify'])}
const encode=value=>btoa(unescape(encodeURIComponent(JSON.stringify(value)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const decode=value=>JSON.parse(decodeURIComponent(escape(atob(value.replace(/-/g,'+').replace(/_/g,'/')))));
async function sign(payload,secret){return payload+'.'+hex(await crypto.subtle.sign('HMAC',await signingKey(secret),encoder.encode(payload)))}
async function verified(value,secret){try{if(!value||value.length>1024)return null;const [payload,signature,...extra]=value.split('.');if(extra.length||!/^[0-9a-f]{64}$/.test(signature||''))return null;if(!await crypto.subtle.verify('HMAC',await signingKey(secret),unhex(signature),encoder.encode(payload)))return null;return decode(payload)}catch{return null}}
const cookie=(request,name)=>request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1);
const validName=name=>typeof name==='string'&&name.trim().length>0&&name.trim().length<=50&&!/[\u0000-\u001f\u007f]/.test(name);
export async function session(secret,name,visitor,expires=Math.floor(Date.now()/1000)+ttl){return sign(encode({expires,name,visitor}),secret)}
export async function authenticated(request,secret){if(!secret)return null;const data=await verified(cookie(request,cookieName),secret);if(!data||!Number.isInteger(data.expires)||data.expires<=Date.now()/1000||data.expires>Date.now()/1000+ttl+60||!validName(data.name)||!/^[0-9a-f-]{36}$/.test(data.visitor||''))return null;return data}
export async function passwordHash(password,salt=hex(crypto.getRandomValues(new Uint8Array(16)))){const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:unhex(salt),iterations:100000,hash:'SHA-256'},key,256);return `${salt}:${hex(bits)}`}
async function passwordMatches(password,stored){if(!/^[0-9a-f]{32}:[0-9a-f]{64}$/.test(stored||''))return false;const candidate=await passwordHash(password,stored.split(':')[0]);let difference=candidate.length^stored.length;for(let i=0;i<stored.length;i++)difference|=candidate.charCodeAt(i)^stored.charCodeAt(i);return difference===0}
export async function rateLimit(db,request,scope,max,seconds){const digest=hex(await crypto.subtle.digest('SHA-256',encoder.encode(request.headers.get('cf-connecting-ip')||'local')));const window=Math.floor(Date.now()/1000/seconds)*seconds;const row=await db.prepare('INSERT INTO review_rate_limits (key,window,count) VALUES (?,?,1) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN window=excluded.window THEN count+1 ELSE 1 END,window=excluded.window RETURNING count').bind(scope+':'+digest,window).first();if(row.count>max)return false;return true}
function safeReturn(value,origin){try{const target=new URL(value||'/',origin);return target.origin===origin&&!target.pathname.startsWith('/__')?target.pathname+target.search:'/'}catch{return '/'}}
const escapeHTML=value=>value.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function loginPage(error='',returnTo='/',name=''){return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Sign in to review</title><style>*{box-sizing:border-box}body{margin:0;background:#f4f6fb;color:#182033;font:16px/1.55 system-ui;display:grid;min-height:100dvh;place-items:center;padding:24px}main{width:100%;max-width:440px;background:#fff;border:1px solid #dfe4ed;border-radius:24px;padding:40px;box-shadow:0 20px 60px #1d34560b}.symbol{width:48px;height:48px;border-radius:14px;background:#3158df;color:white;display:grid;place-items:center;margin-bottom:32px}h1{font-size:32px;line-height:1.15;letter-spacing:-1px;margin:12px 0 16px}p{color:#596579;font-size:14px}.eyebrow{font-size:11px;letter-spacing:1.4px;text-transform:uppercase;font-weight:700;color:#3158df}label{font-weight:600;font-size:13px;display:block;margin-top:20px}input,button{display:block;box-sizing:border-box;width:100%;font:inherit;padding:13px 14px;margin-top:8px;border-radius:10px;border:1px solid #ccd4e0}input{background:#fafbfe;color:#182033}button{background:#3158df;color:white;border:0;cursor:pointer;font-size:14px;font-weight:600;margin-top:26px;min-height:48px}button:hover{background:#2545b8}:focus-visible{outline:3px solid #3158df;outline-offset:3px}.error{background:#fff0f0;color:#9e2020;border-radius:8px;padding:12px}.note{font-size:12px;margin:22px 0 0}@media(max-width:400px){main{padding:26px}}</style></head><body><main><div class="symbol" aria-hidden="true"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H5l-3 3v-9.5A7.5 7.5 0 0 1 9.5 5H12"/><path d="m15 3 2 2 4-4M7 11h8M7 15h5"/></svg></div><p class="eyebrow">Website review</p><h1>A fresh perspective<br>starts here.</h1><p>Explore the site and leave feedback. Your name will appear on your comments.</p>${error?'<p class="error" role="alert">'+escapeHTML(error)+'</p>':''}<form method="post" action="/__login"><input type="hidden" name="returnTo" value="${escapeHTML(returnTo)}"><label for="name">Your name</label><input id="name" name="name" type="text" autocomplete="name" required maxlength="50" value="${escapeHTML(name)}" placeholder="e.g. Alex Morgan"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="256"><button type="submit">Enter review <span aria-hidden="true">↗</span></button></form><p class="note">Private staging · Your session lasts 12 hours.</p></main></body></html>`,{headers:{'Content-Type':'text/html; charset=utf-8'}})}
export default {async fetch(request,env){
 try{
  const url=new URL(request.url);
  if(!env.SESSION_SECRET||!env.STAGING_PASSWORD_HASH)return secure(json({error:'Staging access is not configured.'},503));
  if(!['GET','HEAD'].includes(request.method)&&request.headers.get('origin')!==url.origin)return secure(json({error:'Cross-origin requests are not allowed.'},403));
  if(url.pathname==='/__login'){
   if(request.method==='GET')return secure(loginPage('',safeReturn(url.searchParams.get('next'),url.origin)));
   if(request.method!=='POST')return secure(json({error:'Method not allowed'},405));
   if(!await rateLimit(env.DB,request,'login',10,600))return secure(new Response('Too many attempts. Please try again in ten minutes.',{status:429,headers:{'Retry-After':'600'}}));
   const text=await request.text();if(text.length>1024)return secure(json({error:'Request too large'},413));
   const form=new URLSearchParams(text),password=form.get('password')||'',name=(form.get('name')||'').trim(),returnTo=safeReturn(form.get('returnTo'),url.origin);
   if(!validName(name)){const result=loginPage('Enter your name (up to 50 characters).',returnTo);return secure(new Response(result.body,{status:400,headers:result.headers}))}
   if(!await passwordMatches(password,env.STAGING_PASSWORD_HASH)){const result=loginPage('That password was not accepted.',returnTo,name);return secure(new Response(result.body,{status:401,headers:result.headers}))}
   const device=await verified(cookie(request,'__Host-review_device'),env.SESSION_SECRET);
   const visitor=device&&device.expires>Date.now()/1000&&/^[0-9a-f-]{36}$/.test(device.visitor||'')?device.visitor:crypto.randomUUID();
   const headers=new Headers({Location:returnTo});
   headers.append('Set-Cookie',`${cookieName}=${await session(env.SESSION_SECRET,name,visitor)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${ttl}`);
   headers.append('Set-Cookie',`__Host-review_device=${await sign(encode({visitor,expires:Math.floor(Date.now()/1000)+31536000}),env.SESSION_SECRET)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=31536000`);
   return secure(new Response(null,{status:303,headers}));
  }
  const valid=await authenticated(request,env.SESSION_SECRET);
  if(!valid){if(url.pathname.startsWith('/api/'))return secure(json({error:'Your session expired. Sign in again; your saved draft will remain on this device.'},401));return secure(new Response(null,{status:303,headers:{Location:'/__login?next='+encodeURIComponent(url.pathname+url.search)}}))}
  if(url.pathname==='/__logout'){if(request.method!=='POST')return secure(json({error:'Method not allowed'},405));return secure(new Response(null,{status:303,headers:{Location:'/__login','Set-Cookie':`${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`}}))}
  if(url.pathname==='/api/session'&&request.method==='GET')return secure(json({name:valid.name}));
  if(url.pathname.startsWith('/api/review/'))return secure(await review(request,env,url,valid));
  if(!['GET','HEAD'].includes(request.method))return secure(json({error:'Method not allowed'},405));
  return secure(await env.ASSETS.fetch(request));
 }catch(error){console.error('Staging request failed',error?.message);return secure(json({error:'Staging is temporarily unavailable. Please retry.'},503))}
}};
