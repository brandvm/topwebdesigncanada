import {getCollection} from 'astro:content';import {articlePath} from './routes.mjs';
export async function articles(){return (await getCollection('articles',({data})=>!data.draft)).sort((a,b)=>a.data.order-b.data.order)}
export const withBase=(path:string)=>import.meta.env.BASE_URL.replace(/\/$/,'')+'/'+path.replace(/^\//,'');
export const href=(slug:string)=>withBase(articlePath(slug));
