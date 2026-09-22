import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync('src/scripts/analytics.js','utf8');
function run({choice,expires=Date.now()+100000,host='www.example.com',gpc=false,search=''}={}){
 const nodes=new Map();const node=key=>{if(!nodes.has(key))nodes.set(key,{hidden:true,textContent:'',handlers:{},addEventListener(event,fn){this.handlers[event]=fn},focus(){},querySelector:node});return nodes.get(key)};
 const panel=node('[data-analytics-consent]');panel.dataset={measurementId:'G-TEST123',analyticsHost:'www.example.com'};
 const storage=new Map(choice?[['analytics-consent-v1',JSON.stringify({choice,expires})]]:[]);const scripts=[];
 const document={querySelector:node,head:{append:e=>scripts.push(e)},createElement:()=>({dataset:{}}),cookie:'_ga=old',referrer:'https://chatgpt.com/?private=secret'};
 const location={hostname:host,origin:'https://'+host,pathname:'/blog/',search,reload(){this.reloaded=true}};
 const window={addEventListener(){}};
 vm.runInNewContext(source,{document,location,window,navigator:{globalPrivacyControl:gpc},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},URL,URLSearchParams,Date,JSON});
 return {nodes,panel,scripts,window,location,document,click:key=>node(key).handlers.click()};
}
test('no Google script or event before consent, including expired consent',()=>{for(const args of [{},{choice:'denied'},{choice:'granted',expires:0}]){const app=run(args);assert.equal(app.scripts.length,0);assert.equal(app.window.dataLayer,undefined)}});
test('production host and Global Privacy Control gates prevent tracking',()=>{for(const args of [{host:'localhost'},{host:'preview.workers.dev'},{gpc:true}]){const app=run({...args,choice:'granted'});assert.equal(app.scripts.length,0)}});
test('consent enables one tag, strips private URLs, preserves campaign and referrer',()=>{const app=run({search:'?email=secret@example.com&utm_source=chatgpt&utm_medium=referral#secret'});app.click('[data-consent-accept]');app.click('[data-consent-accept]');assert.equal(app.scripts.length,1);const events=app.window.dataLayer.map(x=>Array.from(x));const config=events.find(e=>e[0]==='config')[2];assert.equal(config.page_location,'https://www.example.com/blog/');assert.equal(config.page_referrer,'https://chatgpt.com/');assert.equal(config.campaign_source,'chatgpt');assert.equal(config.allow_google_signals,false);assert.equal(events[0][2].ad_storage,'denied');assert.equal(app.panel.hidden,true)});
test('a visitor may grant after declining and withdraw an active session',()=>{const app=run();app.click('[data-consent-reject]');assert.equal(app.scripts.length,0);app.click('[data-consent-accept]');assert.equal(app.window['ga-disable-G-TEST123'],false);app.click('[data-consent-reject]');assert.equal(app.window['ga-disable-G-TEST123'],true);assert.equal(app.location.reloaded,true)});
