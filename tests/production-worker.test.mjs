import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../server/production.mjs';
const policy="default-src 'self'; script-src 'self' https://www.googletagmanager.com; object-src 'none'";
test('HTML receives an unpredictable per-response nonce while policy and streamed content are preserved',async()=>{
 const env={ASSETS:{fetch:async()=>new Response('<h1>Public page</h1>',{status:404,headers:{'content-type':'text/html','content-security-policy':policy}})}};
 const request=new Request('https://example.com/missing');
 const a=await worker.fetch(request,env),b=await worker.fetch(request,env);
 const first=a.headers.get('content-security-policy'),second=b.headers.get('content-security-policy');
 assert.match(first,/'nonce-[A-Za-z0-9+/]{24}'/);assert.notEqual(first,second);
 assert.equal(first.replace(/ 'nonce-[^']+'/,'') ,policy);
 assert.equal(a.status,404);assert.equal(await a.text(),'<h1>Public page</h1>');
});
test('asset redirects and non-HTML files are passed through unchanged',async()=>{
 for(const response of [new Response('icon',{headers:{'content-type':'image/svg+xml'}}),new Response(null,{status:301,headers:{location:'/'}})]){
  const result=await worker.fetch(new Request('https://example.com/file'),{ASSETS:{fetch:async()=>response}});
  assert.equal(result,response);assert.equal(result.headers.get('content-security-policy'),null);
 }
});
