import {defineConfig} from 'astro/config';
import mdx from '@astrojs/mdx';
import site from './src/data/site.json' with {type:'json'};
export default defineConfig({site:process.env.SITE_URL||'https://topwebdesigncanada.ca',base:process.env.BASE_PATH||'/',output:'static',redirects:{['/blog/'+site.homeArticle+'/']:'/'},trailingSlash:'always',integrations:[mdx()],devToolbar:{enabled:false},vite:{build:{assetsInlineLimit:0}}});
