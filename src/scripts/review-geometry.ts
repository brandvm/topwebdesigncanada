export type Point={x:number;y:number};
export type Bounds=Point&{width:number;height:number};
export type Selection={x:number;y:number;width:number;height:number;selectionType:'point'|'area'};
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
export function dragBounds(start:Point,end:Point):Bounds{return {x:Math.min(start.x,end.x),y:Math.min(start.y,end.y),width:Math.abs(end.x-start.x),height:Math.abs(end.y-start.y)};}
export function isAreaDrag(start:Point,end:Point){const box=dragBounds(start,end);return box.width>=6&&box.height>=6;}
export function contains(outer:Bounds,inner:Bounds){return outer.width>0&&outer.height>0&&inner.x>=outer.x-.5&&inner.y>=outer.y-.5&&inner.x+inner.width<=outer.x+outer.width+.5&&inner.y+inner.height<=outer.y+outer.height+.5;}
export function normalizeSelection(start:Point,end:Point,bounds:Bounds):Selection{
 if(bounds.width<=0||bounds.height<=0)throw new Error('A visible anchor is required.');
 const area=isAreaDrag(start,end),box=area?dragBounds(start,end):{...start,width:0,height:0};
 const x=Math.round(clamp((box.x-bounds.x)/bounds.width,0,1)*10000),y=Math.round(clamp((box.y-bounds.y)/bounds.height,0,1)*10000);
 if(!area)return {x,y,width:0,height:0,selectionType:'point'};
 const right=Math.round(clamp((box.x+box.width-bounds.x)/bounds.width,0,1)*10000),bottom=Math.round(clamp((box.y+box.height-bounds.y)/bounds.height,0,1)*10000);
 if(right<=x||bottom<=y)throw new Error('Select a larger visible area.');
 return {x,y,width:right-x,height:bottom-y,selectionType:'area'};
}
export function projectSelection(selection:{x:number;y:number;width?:number;height?:number},bounds:Bounds):Bounds{return {x:bounds.x+bounds.width*selection.x/10000,y:bounds.y+bounds.height*selection.y/10000,width:bounds.width*(selection.width||0)/10000,height:bounds.height*(selection.height||0)/10000};}
export function edgeScrollSpeed(y:number,viewportHeight:number){const edge=40;return y<edge?-Math.ceil(clamp((edge-y)/edge,0,1)*16):y>viewportHeight-edge?Math.ceil(clamp((y-viewportHeight+edge)/edge,0,1)*16):0;}
export function attachedCard(pin:Point,card:{width:number;height:number},viewport:{width:number;height:number}){
 if(pin.x<0||pin.x>viewport.width||pin.y<0||pin.y>viewport.height)return null;
 let side='right',x=pin.x+24,y=pin.y-24;
 if(x+card.width>viewport.width-12){side='left';x=pin.x-card.width-24;}
 if(x<10){side='below';x=clamp(pin.x-card.width/2,10,viewport.width-card.width-10);y=pin.y+24;if(y+card.height>viewport.height-12){side='above';y=pin.y-card.height-24;}}
 else if(y+card.height>viewport.height-12)y=pin.y-card.height+24;
 y=Math.max(10,y);
 return {x,y,side,pinOffset:clamp(pin.y-y,12,card.height-12),pinX:clamp(pin.x-x,15,card.width-15)};
}
