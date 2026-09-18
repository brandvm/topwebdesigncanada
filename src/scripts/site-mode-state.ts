export type SiteMode='browse'|'review';
export function resolveSiteMode(url:URL,saved:string|null):SiteMode{
 const explicit=url.searchParams.get('mode');
 if(explicit==='browse'||explicit==='review')return explicit;
 if(url.searchParams.get('view')==='comment')return 'review';
 return saved==='review'?'review':'browse';
}
export function modeURL(current:URL,mode:SiteMode):URL{
 const url=new URL(current);
 url.searchParams.set('mode',mode);
 if(url.searchParams.get('view')==='comment')url.searchParams.delete('view');
 if(['area-comments','65840e4'].includes(url.searchParams.get('v')||''))url.searchParams.delete('v');
 if(mode==='browse')url.searchParams.delete('thread');
 return url;
}
export function modeSessionKey(path:string){return 'topwebdesigncanada:mode:'+path.replace(/\/index\.html$/,'/');}
