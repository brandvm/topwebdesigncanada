import {review} from './review-api.mjs';

const encoder=new TextEncoder();
const cookieName='__Host-review_session';
const ttl=12*60*60;
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8'}});
const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
const unhex=value=>new Uint8Array(value.match(/.{2}/g)?.map(v=>parseInt(v,16))||[]);
function secure(response){const headers=new Headers(response.headers);headers.set('X-Robots-Tag','noindex, nofollow, noarchive');headers.set('Cache-Control','private, no-store');headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','same-origin');headers.set('X-Frame-Options','DENY');headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; object-src 'none'");return new Response(response.body,{status:response.status,headers})}
async function signingKey(secret){return crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify'])}
export async function session(secret,expires=Math.floor(Date.now()/1000)+ttl){const payload=`${expires}.${crypto.randomUUID()}`;return payload+'.'+hex(await crypto.subtle.sign('HMAC',await signingKey(secret),encoder.encode(payload)))}
export async function authenticated(request,secret){if(!secret)return false;const value=request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1);if(!value)return false;const [expires,nonce,signature]=value.split('.');if(!/^\d+$/.test(expires)||!nonce||!/^[0-9a-f]{64}$/.test(signature||'')||Number(expires)<=Date.now()/1000||Number(expires)>Date.now()/1000+ttl+60)return false;return crypto.subtle.verify('HMAC',await signingKey(secret),unhex(signature),encoder.encode(`${expires}.${nonce}`))}
export async function passwordHash(password,salt=hex(crypto.getRandomValues(new Uint8Array(16)))){const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:unhex(salt),iterations:100000,hash:'SHA-256'},key,256);return `${salt}:${hex(bits)}`}
async function passwordMatches(password,stored){if(!/^[0-9a-f]{32}:[0-9a-f]{64}$/.test(stored||''))return false;const candidate=await passwordHash(password,stored.split(':')[0]);let difference=candidate.length^stored.length;for(let i=0;i<stored.length;i++)difference|=candidate.charCodeAt(i)^stored.charCodeAt(i);return difference===0}
export async function rateLimit(db,request,scope,max,seconds){const digest=hex(await crypto.subtle.digest('SHA-256',encoder.encode(request.headers.get('cf-connecting-ip')||'local')));const window=Math.floor(Date.now()/1000/seconds)*seconds;const row=await db.prepare('INSERT INTO review_rate_limits (key,window,count) VALUES (?,?,1) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN window=excluded.window THEN count+1 ELSE 1 END,window=excluded.window RETURNING count').bind(scope+':'+digest,window).first();if(row.count>max)return false;return true}
function loginPage(error=''){return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Staging access</title><style>body{margin:0;background:#f5f2ed;color:#202522;font:17px/1.6 system-ui;display:grid;min-height:100dvh;place-items:center}main{max-width:28rem;padding:2rem}h1{font-size:2.5rem;line-height:1.1}label,input,button{display:block}input,button{box-sizing:border-box;width:100%;font:inherit;padding:12px;margin:10px 0 20px}button{background:#202522;color:white;border:0;cursor:pointer}:focus-visible{outline:3px solid #9c3818;outline-offset:3px}.error{color:#8e2714}</style></head><body><main><p>PRIVATE STAGING</p><h1>Welcome to the review.</h1><p>Enter the shared site password to browse and leave feedback.</p>${error?'<p class="error" role="alert">'+error+'</p>':''}<form method="post" action="/__login"><label for="password">Staging password</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="256"><button type="submit">Continue to site</button></form></main></body></html>`,{headers:{'Content-Type':'text/html; charset=utf-8'}})}
export default {async fetch(request,env){
 try{
  const url=new URL(request.url);
  if(!env.SESSION_SECRET||!env.STAGING_PASSWORD_HASH)return secure(json({error:'Staging access is not configured.'},503));
  if(!['GET','HEAD'].includes(request.method)&&request.headers.get('origin')!==url.origin)return secure(json({error:'Cross-origin requests are not allowed.'},403));
  if(url.pathname==='/__login'){
   if(request.method==='GET')return secure(loginPage());
   if(request.method!=='POST')return secure(json({error:'Method not allowed'},405));
   if(!await rateLimit(env.DB,request,'login',10,600))return secure(new Response('Too many attempts. Please try again in ten minutes.',{status:429,headers:{'Retry-After':'600'}}));
   const text=await request.text();if(text.length>1024)return secure(json({error:'Request too large'},413));
   const password=new URLSearchParams(text).get('password')||'';
   if(!await passwordMatches(password,env.STAGING_PASSWORD_HASH)){const result=loginPage('That password was not accepted.');return secure(new Response(result.body,{status:401,headers:result.headers}))}
   return secure(new Response(null,{status:303,headers:{Location:'/', 'Set-Cookie':`${cookieName}=${await session(env.SESSION_SECRET)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${ttl}`}}));
  }
  const valid=await authenticated(request,env.SESSION_SECRET);
  if(!valid){if(url.pathname.startsWith('/api/'))return secure(json({error:'Your session expired. Sign in again; your saved draft will remain on this device.'},401));return secure(new Response(null,{status:303,headers:{Location:'/__login'}}))}
  if(url.pathname==='/__logout'){if(request.method!=='POST')return secure(json({error:'Method not allowed'},405));return secure(new Response(null,{status:303,headers:{Location:'/__login','Set-Cookie':`${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`}}))}
  if(url.pathname.startsWith('/api/review/'))return secure(await review(request,env,url));
  if(!['GET','HEAD'].includes(request.method))return secure(json({error:'Method not allowed'},405));
  return secure(await env.ASSETS.fetch(request));
 }catch(error){console.error('Staging request failed',error?.message);return secure(json({error:'Staging is temporarily unavailable. Please retry.'},503))}
}};
