import {spawnSync} from 'node:child_process';
const mode=process.argv[2]||'production';
const env={...process.env,DEPLOY_ENV:mode};
const build=spawnSync(process.execPath,['node_modules/astro/bin/astro.mjs','build'],{stdio:'inherit',env});
if(build.status)process.exit(build.status);
const post=spawnSync(process.execPath,['scripts/postbuild.mjs'],{stdio:'inherit',env});
process.exit(post.status||0);
