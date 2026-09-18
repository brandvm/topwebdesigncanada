import {defineConfig} from 'astro/config';
import mdx from '@astrojs/mdx';
export default defineConfig({site:process.env.SITE_URL||'https://topwebdesigncanada.ca',base:process.env.BASE_PATH||'/',output:'static',trailingSlash:'always',integrations:[mdx()],devToolbar:{enabled:false},vite:{build:{assetsInlineLimit:0}}});
