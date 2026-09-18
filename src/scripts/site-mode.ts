import {resolveSiteMode,modeURL,modeSessionKey,type SiteMode} from './site-mode-state';

const bar=document.getElementById('site-mode')!;
const buttons=bar.querySelectorAll<HTMLButtonElement>('[data-site-mode]');
const extras=document.getElementById('review-tools')!;
const status=document.getElementById('site-mode-status')!;
const sessionKey=modeSessionKey(location.pathname);
let current:SiteMode='browse',revision=0;
let review:typeof import('./review')|undefined;
function savedMode(){try{return sessionStorage.getItem(sessionKey);}catch{return null;}}
async function switchMode(mode:SiteMode,historyAction:'push'|'replace'='push'){
 const request=++revision;
 current=mode;
 try{sessionStorage.setItem(sessionKey,mode);}catch{/* Explicit URLs still work when storage is unavailable. */}
 const url=modeURL(new URL(location.href),mode);
 if(url.href!==location.href)history[historyAction==='push'?'pushState':'replaceState'](null,'',url);
 document.documentElement.dataset.siteMode=mode;
 bar.hidden=false;extras.hidden=mode!=='review';status.textContent='';status.hidden=true;
 for(const button of buttons)button.setAttribute('aria-pressed',String(button.dataset.siteMode===mode));
 if(mode==='browse'){review?.deactivateReview();return;}
 try{
  if(!review){status.hidden=false;status.textContent='Opening comments…';}
  const loaded=await import('./review');
  review=loaded;
  if(request!==revision||current!=='review')return;
  status.textContent='';status.hidden=true;
  loaded.activateReview();
 }catch{
  if(request!==revision)return;
  status.hidden=false;status.textContent='Comments could not load. Select Comment to retry.';
 }
}
for(const button of buttons)button.addEventListener('click',()=>void switchMode(button.dataset.siteMode as SiteMode));
document.addEventListener('site:mode',event=>{
 const mode=(event as CustomEvent<SiteMode>).detail;
 if(mode==='browse'||mode==='review')void switchMode(mode);
});
document.addEventListener('keydown',event=>{
 if(event.ctrlKey||event.metaKey||event.altKey||event.repeat||event.target instanceof Element&&event.target.closest('input,textarea,select,[contenteditable="true"]'))return;
 const key=event.key.toLowerCase();
 if(key==='c'||key==='v'){event.preventDefault();void switchMode(key==='c'?'review':'browse');}
});
addEventListener('popstate',()=>void switchMode(resolveSiteMode(new URL(location.href),savedMode()),'replace'));
void switchMode(resolveSiteMode(new URL(location.href),savedMode()),'replace');
