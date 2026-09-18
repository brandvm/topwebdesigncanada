import reviewStyles from '../styles/review.css?inline';
import {icons} from '../assets/icons';
import {dragBounds,isAreaDrag,contains,normalizeSelection,projectSelection,edgeScrollSpeed,attachedCard,type Point,type Bounds} from './review-geometry';
const reviewStyle=document.createElement('style');reviewStyle.textContent=reviewStyles;document.head.append(reviewStyle);

type Reaction={emoji:string;count:number;mine:boolean};
type Message={id:number;thread_id:number;name:string;body:string;created_at:number;reactions:Reaction[]};
type Thread={id:number;anchor:string;anchor_label:string;x:number;y:number;resolved:number;resolved_by:string|null;resolved_at:number|null;created_at:number;width:number;height:number;selection_type:'point'|'area';commit_id:string;viewport_width:number;viewport_height:number};
type Summary=Thread&{name:string;body:string;message_id:number;reply_count:number;reactions:Reaction[]};
type Detail={thread:Thread;root:Message;replies:Message[];next:number|null};
type Anchor={anchor:string;anchorLabel:string;x:number;y:number;width?:number;height?:number;selectionType?:'point'|'area'};
const API='/api/review';
const config=JSON.parse(document.body.dataset.reviewConfig!);
const prefix=config.site+':'+config.scope+':'+config.page+':';
const storage={get(key:string){try{return localStorage.getItem(key);}catch{return null;}},set(key:string,value:string){try{localStorage.setItem(key,value);}catch{/* Identity and drafts still work for this visit. */}}};
const reviewerName:string=document.body.dataset.reviewerName||'';
function el<K extends keyof HTMLElementTagNameMap>(tag:K,className='',text=''):HTMLElementTagNameMap[K]{const node=document.createElement(tag);if(className)node.className=className;if(text)node.textContent=text;return node;}
function button(text:string,fn:()=>void,className='rv-button'){const b=el('button',className,text);const iconName:Record<string,keyof typeof icons>={'⋯':'dots-three','✓':'check','×':'x','‹':'caret-left','›':'caret-right'};if(iconName[text])b.innerHTML=icons[iconName[text]];b.type='button';b.addEventListener('click',fn);return b;}
function time(value:number){return new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(value);}
let reviewActive=false;
const root=el('div','rv-root');root.id='review-root';root.hidden=true;document.body.append(root);
const anchors=new Map<string,HTMLElement>();
const locations:Array<[string,string]>=[['page','Entire page']];
anchors.set('page',document.body);
for(const node of document.querySelectorAll<HTMLElement>('[data-review-anchor]')){
 const key=node.dataset.reviewAnchor!;
 if(anchors.has(key))throw new Error('Duplicate review anchor '+key);
 anchors.set(key,node);
 if(node.matches('h1,h2,h3,header,footer,section,.hero,.feature'))locations.push([key,(node.getAttribute('aria-label')||node.querySelector('h1,h2,h3')?.textContent||node.textContent||key).trim().replace(/\s+/g,' ').slice(0,90)]);
}
let list:Summary[]=[],counts={total:0,open:0,resolved:0},filter='open';
let selected:number|null=null,detail:Detail|null=null,replyPages=1,panelOpen=true,picking=false,busy=false;
let draftAnchor:Anchor|null=null,listSequence=0,detailSequence=0,detailSignature='';
function storedEntries(key:string){try{return JSON.parse(storage.get(prefix+key)||'[]')}catch{return []}}
class SavedMap<T> extends Map<string,T>{key:string;constructor(key:string){super(storedEntries(key));this.key=key;}set(k:string,v:T){super.set(k,v);if(this.key)storage.set(prefix+this.key,JSON.stringify([...this]));return this}delete(k:string){const r=super.delete(k);storage.set(prefix+this.key,JSON.stringify([...this]));return r}}
const drafts=new SavedMap<string>('drafts'),requests=new SavedMap<{fingerprint:string;id:string}>('requests');
const canvas=el('div','rv-canvas');canvas.hidden=true;canvas.setAttribute('aria-hidden','true');root.append(canvas);
const regions=el('div','rv-regions');const pins=el('div','rv-pins');root.append(regions,pins);
const draftRegion=el('div','rv-region rv-region-draft');draftRegion.hidden=true;regions.append(draftRegion);
const draftPin=el('div','rv-pin rv-draft-pin','+');draftPin.setAttribute('aria-hidden','true');draftPin.hidden=true;pins.append(draftPin);
const panel=el('section','rv-card');panel.id='review-card';panel.hidden=true;panel.setAttribute('aria-label','Pinned comment');root.append(panel);
const top=el('div','rv-card-top'),cardTitle=el('h2','','Comment'),topActions=el('div','rv-card-actions');
const moreButton=button('⋯',()=>{moreMenu.hidden=!moreMenu.hidden;moreButton.setAttribute('aria-expanded',String(!moreMenu.hidden));},'rv-icon-button');moreButton.setAttribute('aria-label','Comment options');moreButton.setAttribute('aria-expanded','false');
const resolveButton=button('✓',()=>void resolveThread(),'rv-icon-button rv-resolve');resolveButton.setAttribute('aria-label','Resolve comment');
const closeButton=button('×',dismissPanel,'rv-icon-button');closeButton.setAttribute('aria-label','Close comment');
topActions.append(moreButton,resolveButton,closeButton);top.append(cardTitle,topActions);panel.append(top);
const moreMenu=el('div','rv-menu');moreMenu.hidden=true;
const copyButton=button('Copy comment link',()=>{moreMenu.hidden=true;void copyLink();},'rv-menu-item');
moreMenu.append(copyButton);panel.append(moreMenu);
const contextNote=el('p','rv-context');panel.append(contextNote);
const status=el('div','rv-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.hidden=true;
const noticeText=el('span');const retry=button('Retry',()=>void sync(),'rv-inline');const signIn=el('a','rv-inline','Sign in again');signIn.href='/__login?next='+encodeURIComponent(location.pathname+location.search);signIn.hidden=true;status.append(noticeText,retry,signIn);panel.append(status);
const composeView=el('div','rv-new-view');composeView.hidden=true;panel.append(composeView);
const pinLabel=el('p','rv-location');composeView.append(pinLabel);
const threadView=el('div','rv-thread-view');threadView.hidden=true;panel.append(threadView);
const messages=el('div','rv-messages');threadView.append(messages);
const resolvedNote=el('p','rv-resolved-note');resolvedNote.hidden=true;threadView.append(resolvedNote);
function updateAuthor(){for(const avatar of [newAvatar,replyAvatar]){avatar.textContent=initials(reviewerName)||'?';avatar.title=reviewerName;}}
function initials(name:string){return name.trim().split(/\s+/).filter(Boolean).map(part=>part[0]).slice(0,2).join('').toUpperCase();}
const newForm=el('form','rv-compose');const newAvatar=el('span','rv-avatar');newAvatar.setAttribute('aria-hidden','true');
const newInput=el('textarea');newInput.id='review-new-comment';newInput.setAttribute('aria-label','Your comment');newInput.rows=2;newInput.maxLength=3000;newInput.required=true;newInput.placeholder='Add a comment…';
const newSubmit=el('button','rv-send','↑');newSubmit.innerHTML=icons['arrow-up'];newSubmit.type='submit';newSubmit.setAttribute('aria-label','Post comment');
const newField=el('div','rv-input-box');newField.append(newInput,newSubmit);newForm.append(newAvatar,newField);newForm.hidden=true;panel.append(newForm);
newInput.addEventListener('input',()=>drafts.set('new',newInput.value));newForm.addEventListener('submit',e=>{e.preventDefault();void postThread();});
const replyForm=el('form','rv-compose');const replyAvatar=el('span','rv-avatar');replyAvatar.setAttribute('aria-hidden','true');
const replyInput=el('textarea');replyInput.id='review-reply';replyInput.setAttribute('aria-label','Reply to this comment');replyInput.rows=2;replyInput.maxLength=3000;replyInput.required=true;replyInput.placeholder='Reply…';
const replySubmit=el('button','rv-send','↑');replySubmit.innerHTML=icons['arrow-up'];replySubmit.type='submit';replySubmit.setAttribute('aria-label','Post reply');
const replyField=el('div','rv-input-box');replyField.append(replyInput,replySubmit);replyForm.append(replyAvatar,replyField);replyForm.hidden=true;panel.append(replyForm);
replyInput.addEventListener('input',()=>{if(selected)drafts.set('reply:'+selected,replyInput.value);});replyForm.addEventListener('submit',e=>{e.preventDefault();void postReply();});updateAuthor();
const toolbar=document.getElementById('review-tools')!;
const previous=button('‹',()=>navigateComment(-1),'rv-comment-nav');previous.setAttribute('aria-label','Previous comment');
const launcher=button('Comments',()=>navigateComment(1),'rv-launcher');launcher.setAttribute('aria-controls','review-card');launcher.setAttribute('aria-expanded','false');
const next=button('›',()=>navigateComment(1),'rv-comment-nav');next.setAttribute('aria-label','Next comment');
const filters=el('select','rv-comment-filter');filters.setAttribute('aria-label','Show comments');
for(const value of ['open','resolved','all']){const option=el('option','',value[0].toUpperCase()+value.slice(1));option.value=value;filters.append(option);}
filters.addEventListener('change',()=>{filter=filters.value;dismissPanel();void loadList();});toolbar.append(previous,launcher,next,filters);
const sections=el('select','rv-section-picker');sections.setAttribute('aria-label','Choose a section to comment on');
for(const [value,label] of locations){const option=el('option','',label);option.value=value;sections.append(option)}
const sectionComment=button('Add comment',()=>{const node=anchors.get(sections.value)!;node.scrollIntoView({block:'center',behavior:'instant'});compose({anchor:sections.value,anchorLabel:sections.selectedOptions[0].textContent||'Page',x:5000,y:Math.min(5000,Math.round(10000*Math.min(160,node.getBoundingClientRect().height/2)/node.getBoundingClientRect().height)),selectionType:'point',width:0,height:0})});
toolbar.append(sections,sectionComment);
const requestBrowse=()=>document.dispatchEvent(new CustomEvent('site:mode',{detail:'browse'}));
const pickingBanner=el('div','rv-picking-banner');pickingBanner.hidden=true;pickingBanner.append(el('span','','Click to pin · Drag to select an area'),button('Browse instead',requestBrowse,'rv-inline'));root.append(pickingBanner);
function notify(message='',error=false){noticeText.textContent=message;signIn.hidden=!message.includes('session expired');status.hidden=!message;status.classList.toggle('rv-error',error);retry.hidden=!error;const globalStatus=document.getElementById('site-mode-status')!;if(reviewActive){globalStatus.hidden=!(error&&!panelOpen);globalStatus.textContent=error&&!panelOpen?message+' Select Comment to retry.':'';}}
function displayName(){return reviewerName;}
function setPanel(open:boolean){panelOpen=open;panel.hidden=!open;launcher.setAttribute('aria-expanded',String(open));if(open)schedulePins();}
function prepareCard(thread:boolean){moreMenu.hidden=true;moreButton.setAttribute('aria-expanded','false');copyButton.hidden=!thread;resolveButton.hidden=!thread;updateAuthor();newForm.hidden=thread;replyForm.hidden=!thread;}
function threadURL(threadId:number|null){const url=new URL(location.href);url.searchParams.set('mode','review');url.searchParams.delete('view');if(threadId)url.searchParams.set('thread',String(threadId));else url.searchParams.delete('thread');return url;}
function setURL(threadId:number|null){if(reviewActive)history.replaceState(null,'',threadURL(threadId));}
function dismissPanel(){
 const restoreFocus=panel.contains(document.activeElement),returnPin=selected?pinElements.get(selected)?.button:null;
 cancelGesture();selected=null;detail=null;detailSequence++;draftAnchor=null;threadView.hidden=true;composeView.hidden=true;newForm.hidden=true;replyForm.hidden=true;setURL(null);setPanel(false);renderPins();
 if(restoreFocus){
  const target=reviewActive&&returnPin?.isConnected&&!returnPin.hidden?returnPin:document.querySelector<HTMLButtonElement>(`button[data-site-mode="${reviewActive?'review':'browse'}"]`);
  target?.focus({preventScroll:true});
 }
}
function compose(anchor:Anchor){cancelGesture();draftAnchor=anchor;selected=null;detail=null;detailSequence++;threadView.hidden=true;composeView.hidden=false;cardTitle.textContent='New comment';contextNote.textContent='Revision '+config.commit.slice(0,8)+' · '+innerWidth+' × '+innerHeight;pinLabel.textContent=(anchor.selectionType==='area'?'Selected area · ':'')+anchor.anchorLabel;newInput.value=drafts.get('new')||'';prepareCard(false);notify();setPanel(true);setURL(null);renderPins();newInput.focus({preventScroll:true});}
function startPicking(){cancelGesture();selected=null;detail=null;detailSequence++;draftAnchor=null;setURL(null);picking=true;setPanel(false);canvas.hidden=false;pickingBanner.hidden=false;document.documentElement.classList.add('rv-picking');renderPins();notify();}
function stopPicking(){cancelGesture();picking=false;canvas.hidden=true;pickingBanner.hidden=true;document.documentElement.classList.remove('rv-picking');}
function navigateComment(direction:number){if(!list.length)return;const index=list.findIndex(t=>t.id===selected);const nextIndex=index<0?(direction>0?0:list.length-1):(index+direction+list.length)%list.length;void openThread(list[nextIndex].id);}
type Gesture={pointerId:number;start:Point;end:Point;clientX:number;clientY:number;target:HTMLElement};
let gesture:Gesture|null=null,autoScrollFrame=0;
const docPoint=(e:PointerEvent):Point=>({x:e.clientX+scrollX,y:e.clientY+scrollY});
function boundsOf(node:HTMLElement,documentSpace=false):Bounds{const r=node.getBoundingClientRect();return {x:r.left+(documentSpace?scrollX:0),y:r.top+(documentSpace?scrollY:0),width:r.width,height:r.height};}
function hitAnchor(x:number,y:number){for(const element of document.elementsFromPoint(x,y)){if(root.contains(element))continue;const node=element.closest<HTMLElement>('[data-review-anchor]');if(node)return node;}return document.body;}
function anchorForArea(box:Bounds){let best={key:'page',node:document.body,size:Number.POSITIVE_INFINITY};for(const [key,node] of anchors){const r=boundsOf(node,true);if(contains(r,box)&&r.width*r.height<best.size)best={key,node,size:r.width*r.height};}return best;}
function cancelGesture(){const previous=gesture;gesture=null;if(autoScrollFrame){cancelAnimationFrame(autoScrollFrame);autoScrollFrame=0;}if(previous&&canvas.hasPointerCapture(previous.pointerId))canvas.releasePointerCapture(previous.pointerId);paintDraft();}
function autoScroll(){autoScrollFrame=0;if(!gesture||!isAreaDrag(gesture.start,gesture.end))return;const speed=edgeScrollSpeed(gesture.clientY,innerHeight);if(speed){window.scrollBy({top:speed,behavior:'instant'});gesture.end={x:gesture.clientX+scrollX,y:gesture.clientY+scrollY};paintDraft();autoScrollFrame=requestAnimationFrame(autoScroll);}}
canvas.addEventListener('pointerdown',e=>{if(!picking||busy||!e.isPrimary||e.button!==0||gesture)return;e.preventDefault();if(panelOpen){dismissPanel();return;}const target=hitAnchor(e.clientX,e.clientY);const start=docPoint(e);draftAnchor=null;selected=null;detail=null;detailSequence++;setURL(null);setPanel(false);gesture={pointerId:e.pointerId,start,end:start,clientX:e.clientX,clientY:e.clientY,target};canvas.setPointerCapture(e.pointerId);renderPins();});
canvas.addEventListener('pointermove',e=>{if(!gesture||gesture.pointerId!==e.pointerId)return;e.preventDefault();gesture.end=docPoint(e);gesture.clientX=e.clientX;gesture.clientY=e.clientY;paintDraft();if(!autoScrollFrame)autoScrollFrame=requestAnimationFrame(autoScroll);});
canvas.addEventListener('pointerup',e=>{if(!gesture||gesture.pointerId!==e.pointerId)return;e.preventDefault();gesture.end=docPoint(e);const finished=gesture;const area=isAreaDrag(finished.start,finished.end);const anchor=area?anchorForArea(dragBounds(finished.start,finished.end)):{key:finished.target.dataset.reviewAnchor||'page',node:finished.target};cancelGesture();try{const geometry=normalizeSelection(finished.start,finished.end,boundsOf(anchor.node,true));const section=anchor.key.split(':')[0];const sectionLabel=locations.find(v=>v[0]===section)?.[1]||'Page';const label=area?sectionLabel:anchor.node instanceof HTMLImageElement?anchor.node.alt:anchor.node.textContent||sectionLabel;compose({anchor:anchor.key,anchorLabel:label.trim().replace(/\s+/g,' ').slice(0,120)||sectionLabel,...geometry});}catch{notify('Please select a visible area on the page.');setPanel(true);}});
canvas.addEventListener('pointercancel',cancelGesture);canvas.addEventListener('lostpointercapture',()=>{if(gesture)cancelGesture();});canvas.addEventListener('click',e=>e.preventDefault());
addEventListener('blur',cancelGesture);
document.addEventListener('keydown',e=>{if(!reviewActive)return;if(e.key==='Escape'){e.preventDefault();if(!moreMenu.hidden){moreMenu.hidden=true;moreButton.setAttribute('aria-expanded','false');}else if(gesture)cancelGesture();else if(panelOpen||draftAnchor||selected)dismissPanel();else requestBrowse();}});
async function api(path:string,method='GET',data?:unknown){
 const controller=new AbortController();const timer=window.setTimeout(()=>controller.abort(),15000);
 try{const response=await fetch(API+path,{method,headers:{'X-Review-Page':config.page,'X-Review-Scope':config.scope,...(data!==undefined?{'Content-Type':'application/json'}:{})},body:data===undefined?undefined:JSON.stringify(data),signal:controller.signal,credentials:'same-origin',cache:'no-store'});const result=await response.json().catch(()=>null);if(!response.ok)throw new Error(result?.error||'Comments are temporarily unavailable. Please try again.');if(!result)throw new Error('Comments are temporarily unavailable. Please try again.');return result;}
 catch(e){if(e instanceof Error&&e.name!=='AbortError'&&e.message!=='Failed to fetch')throw e;throw new Error('Could not reach shared comments. Your draft is still here. Please try again.');}
 finally{clearTimeout(timer);}
}
function requestId(key:string,data:unknown){const fingerprint=JSON.stringify(data);const current=requests.get(key);if(current?.fingerprint===fingerprint)return current.id;const id=crypto.randomUUID();requests.set(key,{fingerprint,id});return id;}
async function action(fn:()=>Promise<void>){if(busy)return;busy=true;for(const b of [newSubmit,replySubmit,resolveButton])b.disabled=true;try{notify('Saving…');await fn();if(noticeText.textContent==='Saving…')notify();}catch(e){notify((e as Error).message,true);}finally{busy=false;for(const b of [newSubmit,replySubmit,resolveButton])b.disabled=false;}}
async function postThread(){const name=displayName();if(!name||!draftAnchor||!newInput.value.trim())return;const data={...draftAnchor,name,body:newInput.value.trim(),commit:config.commit,viewportWidth:innerWidth,viewportHeight:innerHeight};await action(async()=>{const result=await api('/threads','POST',{...data,requestId:requestId('new',data)});drafts.delete('new');newInput.value='';draftAnchor=null;await openThread(result.id,false);await loadList();});}
async function postReply(){const name=displayName();if(!name||!selected||!replyInput.value.trim())return;const threadId=selected,data={name,body:replyInput.value.trim()};await action(async()=>{await api(`/threads/${threadId}/replies`,'POST',{...data,requestId:requestId('reply:'+threadId,data)});drafts.delete('reply:'+threadId);replyInput.value='';await loadDetail();await loadList();messages.scrollTop=messages.scrollHeight;});}
async function resolveThread(){const name=displayName();if(!name||!detail)return;const target=detail.thread;await action(async()=>{await api(`/threads/${target.id}`,'PATCH',{name,resolved:!target.resolved});await loadDetail();await loadList();});}
async function copyLink(){if(!selected)return;try{await navigator.clipboard.writeText(threadURL(selected).href);notify('Thread link copied.');}catch{notify('Copy the page address to share this thread.');}}
async function openThread(threadId:number,scroll=true){
 if(!reviewActive)return;cancelGesture();selected=threadId;detail=null;detailSignature='';replyPages=1;draftAnchor=null;composeView.hidden=true;threadView.hidden=false;cardTitle.textContent='Comment';messages.replaceChildren(el('p','rv-empty','Loading comment…'));resolvedNote.hidden=true;replyInput.value=drafts.get('reply:'+threadId)||'';prepareCard(true);setPanel(true);setURL(threadId);await loadDetail();if(selected!==threadId)return;
 const loaded=detail as Detail|null;if(loaded){schedulePins();if(scroll){const box=geometryFor(loaded.thread);if(box)window.scrollTo({top:Math.max(0,scrollY+box.y+box.height-innerHeight*.35),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}}
}
async function loadList(){
 if(!reviewActive)return;
 const seq=++listSequence;try{let before:number|null=null;const rows:Summary[]=[];let pageCounts=counts;
 do {const result=await api(`/threads?status=${filter}${before?'&before='+before:''}`);rows.push(...result.threads);pageCounts=result.counts;before=result.next;if(seq!==listSequence||!reviewActive)return;}while(before);
 if(seq!==listSequence)return;list=rows;counts=pageCounts;renderList();renderPins();if(noticeText.textContent==='Loading shared comments…')notify();
 }catch(e){if(seq===listSequence)notify((e as Error).message,true);}
}
async function loadDetail(){
 if(!selected)return;const current=selected,seq=++detailSequence;try{let before:number|null=null,result:Detail|null=null;const replies:Message[]=[];
 for(let page=0;page<replyPages;page++){const next:Detail=await api(`/threads/${current}${before?'?before='+before:''}`);result=next;replies.unshift(...next.replies);before=next.next;if(!before)break;}
 if(seq!==detailSequence||selected!==current||!result)return;detail={...result,replies,next:before};renderDetail();renderPins();
 }catch(e){if(selected===current&&seq===detailSequence)notify((e as Error).message,true);}
}
function renderList(){
 launcher.textContent=list.length?`${list.length} ${list.length===1?'comment':'comments'}`:'No comments';
 launcher.disabled=!list.length;previous.disabled=!list.length;next.disabled=!list.length;
 for(const option of filters.options){const total=option.value==='all'?counts.total:option.value==='open'?counts.open:counts.resolved;option.textContent=option.value[0].toUpperCase()+option.value.slice(1)+` (${total})`;}
}
function reactionButtons(message:Message){const row=el('div','rv-reactions');const labels:Record<string,string>={'👍':'Thumbs up','❤️':'Heart','👀':'Eyes'};
 for(const reaction of message.reactions){const b=button(`${reaction.emoji} ${reaction.count||''}`,()=>void action(async()=>{await api(`/messages/${message.id}/reactions`,'PUT',{emoji:reaction.emoji,active:!reaction.mine});await loadDetail();await loadList();}),'rv-reaction');b.setAttribute('aria-label',`${labels[reaction.emoji]}, ${reaction.count} ${reaction.count===1?'reaction':'reactions'}`);b.setAttribute('aria-pressed',String(reaction.mine));b.dataset.focusKey=`reaction-${message.id}-${reaction.emoji}`;row.append(b);}return row;}
function messageCard(message:Message){const card=el('article','rv-message');const meta=el('div','rv-message-meta');const initials=message.name.trim().split(/\s+/).map(s=>s[0]).slice(0,2).join('').toUpperCase();const avatar=el('span','rv-avatar',initials);avatar.setAttribute('aria-hidden','true');const author=el('div');author.append(el('strong','',message.name),el('time','',time(message.created_at)));meta.append(avatar,author);card.append(meta,el('p','rv-message-body',message.body),reactionButtons(message));return card;}
function renderDetail(){if(!detail)return;const signature=JSON.stringify(detail);if(signature===detailSignature)return;detailSignature=signature;
 const active=document.activeElement instanceof HTMLElement?document.activeElement.dataset.focusKey:null;const scroll=messages.scrollTop;
 const t=detail.thread;contextNote.textContent=(anchors.has(t.anchor)?'':'Original location changed. ')+ 'Posted on '+t.commit_id.slice(0,8)+' · '+t.viewport_width+' × '+t.viewport_height;cardTitle.textContent='Comment';panel.setAttribute('aria-label',`Comment ${t.id}: ${t.anchor_label}`);
 resolvedNote.hidden=!t.resolved;resolvedNote.textContent=t.resolved?`Resolved by ${t.resolved_by||'a reviewer'}`:'';
 resolveButton.classList.toggle('rv-is-resolved',Boolean(t.resolved));resolveButton.setAttribute('aria-label',t.resolved?'Reopen comment':'Resolve comment');resolveButton.title=t.resolved?'Reopen comment':'Resolve comment';
 messages.replaceChildren(messageCard(detail.root));
 if(detail.next){const older=button('Load earlier replies',()=>{replyPages++;void loadDetail();},'rv-load-more');messages.append(older);}
 if(detail.replies.length)messages.append(el('div','rv-reply-divider','Replies'));
 for(const reply of detail.replies)messages.append(messageCard(reply));messages.scrollTop=scroll;
 if(active){for(const b of messages.querySelectorAll<HTMLButtonElement>('[data-focus-key]'))if(b.dataset.focusKey===active)b.focus({preventScroll:true});}
}
const pinElements=new Map<number,{button:HTMLButtonElement;region:HTMLDivElement;thread:Thread}>();
function renderPins(){const visible:Thread[]=[...list];if(detail&&!visible.some(t=>t.id===detail!.thread.id))visible.push(detail.thread);
 const ids=new Set(visible.map(t=>t.id));for(const [id,item] of pinElements)if(!ids.has(id)){item.button.remove();item.region.remove();pinElements.delete(id);}
 for(const thread of visible){let item=pinElements.get(thread.id);if(!item){const b=button(String(thread.id),()=>void openThread(thread.id,false),'rv-pin');b.setAttribute('aria-label',`Open ${thread.selection_type==='area'?'area ':''}comment ${thread.id}: ${thread.anchor_label}`);const region=el('div','rv-region');region.setAttribute('aria-hidden','true');for(const event of ['mouseenter','focus'])b.addEventListener(event,()=>region.classList.add('rv-region-hover'));for(const event of ['mouseleave','blur'])b.addEventListener(event,()=>region.classList.remove('rv-region-hover'));pins.append(b);regions.append(region);item={button:b,region,thread};pinElements.set(thread.id,item);}item.thread=thread;item.button.classList.toggle('rv-pin-resolved',Boolean(thread.resolved));item.button.classList.toggle('rv-pin-selected',selected===thread.id);item.region.classList.toggle('rv-region-selected',selected===thread.id);item.region.classList.toggle('rv-region-resolved',Boolean(thread.resolved));}
 positionPins();
}
function placeBox(node:HTMLElement,box:Bounds){node.style.left=box.x+'px';node.style.top=box.y+'px';node.style.width=box.width+'px';node.style.height=box.height+'px';}
function geometryFor(anchor:{anchor:string;x:number;y:number;width?:number;height?:number}){const target=anchors.get(anchor.anchor);if(!target)return null;const bounds=boundsOf(target);if(!bounds.width||!bounds.height)return null;return projectSelection(anchor,bounds);}
function paintDraft(){let box:Bounds|null=null,area=false;if(gesture){area=isAreaDrag(gesture.start,gesture.end);const doc=area?dragBounds(gesture.start,gesture.end):{...gesture.start,width:0,height:0};box={...doc,x:doc.x-scrollX,y:doc.y-scrollY};}else if(draftAnchor){box=geometryFor(draftAnchor);area=draftAnchor.selectionType==='area';}draftRegion.hidden=!box||!area;draftPin.hidden=!box;if(box){if(area)placeBox(draftRegion,box);draftPin.style.left=(box.x+box.width)+'px';draftPin.style.top=(box.y+box.height)+'px';}}
function positionPopover(){
 if(!panelOpen)return;const toolbarTop=document.getElementById('site-mode')!.getBoundingClientRect().top;const usableHeight=Math.max(240,Math.min(innerHeight,toolbarTop)-12);panel.style.maxHeight=Math.max(200,usableHeight-20)+'px';const anchor=draftAnchor||detail?.thread||list.find(t=>t.id===selected);if(!anchor){panel.hidden=true;return;}const box=geometryFor(anchor);if(!box){panel.hidden=false;panel.dataset.side='';panel.style.left=Math.max(12,(innerWidth-Math.min(390,innerWidth-24))/2)+'px';panel.style.top='70px';return;}
 const pinX=box.x+box.width,pinY=box.y+box.height;
 // A card belongs to its pin: it leaves the viewport with that pin.
 if(pinX<0||pinX>innerWidth||pinY<0||pinY>innerHeight){panel.hidden=true;return;}
 panel.hidden=false;const layout=attachedCard({x:pinX,y:pinY},panel.getBoundingClientRect(),{width:innerWidth,height:usableHeight});if(!layout){panel.hidden=true;return;}
 panel.dataset.side=layout.side;panel.style.left=layout.x+'px';panel.style.top=layout.y+'px';panel.style.setProperty('--pin-offset',layout.pinOffset+'px');panel.style.setProperty('--pin-x',layout.pinX+'px');
}
function positionPins(){for(const {button:b,region,thread:t} of pinElements.values()){const box=geometryFor(t);if(!box){b.hidden=true;region.hidden=true;continue;}const left=box.x+box.width,top=box.y+box.height;b.hidden=top<0||top>innerHeight||left<0||left>innerWidth;region.hidden=t.selection_type!=='area'||box.y+box.height<0||box.y>innerHeight||box.x+box.width<0||box.x>innerWidth;if(!b.hidden){b.style.left=`${Math.max(17,Math.min(innerWidth-17,left))}px`;b.style.top=`${Math.max(17,top)}px`;}if(!region.hidden)placeBox(region,box);}paintDraft();positionPopover();}
let frame=0;function schedulePins(){if(reviewActive&&!frame)frame=requestAnimationFrame(()=>{frame=0;positionPins();});}
addEventListener('scroll',()=>{if(gesture)gesture.end={x:gesture.clientX+scrollX,y:gesture.clientY+scrollY};schedulePins();},{passive:true});addEventListener('resize',schedulePins);new ResizeObserver(schedulePins).observe(document.body);document.fonts.ready.then(schedulePins);document.querySelectorAll('img').forEach(img=>img.addEventListener('load',schedulePins,{once:true}));
async function sync(){if(busy||!reviewActive)return;await loadList();if(selected&&panelOpen)await loadDetail();}
addEventListener('online',()=>void sync());addEventListener('offline',()=>notify('You are offline. Your draft is still here.',true));
document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelGesture();else void sync();});
window.setInterval(()=>{if(reviewActive&&!document.hidden&&!gesture)void sync();},15000);
export function activateReview(){
 const initialThread=new URLSearchParams(location.search).get('thread');
 reviewActive=true;root.hidden=false;startPicking();notify('Loading shared comments…');void loadList();
 if(initialThread&&/^\d{1,12}$/.test(initialThread))void openThread(Number(initialThread));
}
export function deactivateReview(){
 reviewActive=false;listSequence++;stopPicking();dismissPanel();root.hidden=true;
}
