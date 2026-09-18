import {defineConfig} from 'astro/config';
import mdx from '@astrojs/mdx';
import {routeAliases} from './src/lib/routes.mjs';
export default defineConfig({site:process.env.SITE_URL||'https://topwebdesigncanada.ca',base:process.env.BASE_PATH||'/',output:'static',redirects:routeAliases,trailingSlash:'always',integrations:[mdx()],devToolbar:{enabled:false},vite:{build:{assetsInlineLimit:0}}});
