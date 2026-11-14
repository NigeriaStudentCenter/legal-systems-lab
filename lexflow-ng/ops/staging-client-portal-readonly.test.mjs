import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyCors} from './staging-client-portal-readonly.mjs';
const base='https://lexflowstg-api.test.westeurope.azurecontainerapps.io';
function response(code,origin,headers={}){
  const values={'access-control-allow-origin':origin,...headers};
  return {status:code,headers:{get(name){return values[name.toLowerCase()]||null;}}};
}
test('checks trusted client origin and rejects a second origin',async()=>{
  const paths=[];
  const fake=async(url,options)=>{
    paths.push({url,method:options.method,origin:options.headers.Origin});
    if(options.headers.Origin==='https://malicious.invalid')return response(403,null);
    if(options.method==='OPTIONS')return response(204,'https://legal.bsoedu.org',
      {'access-control-allow-headers':'Content-Type,Authorization'});
    return response(200,'https://legal.bsoedu.org');
  };
  const result=await verifyCors(base,{fetchImpl:fake});
  assert.equal(result.untrusted_origin_rejected,true);
  assert.equal(paths.length,3);
  assert.ok(paths.every(x=>['GET','OPTIONS'].includes(x.method)));
  assert.ok(paths.every(x=>x.url.startsWith(base+'/v1/')));
});
test('staging rejects untrusted browser origins or missing CORS proof',async()=>{
  const fake=async(url,options)=>{
    if(options.headers.Origin==='https://malicious.invalid')return response(200,'https://malicious.invalid');
    return response(200,'https://legal.bsoedu.org');
  };
  await assert.rejects(verifyCors(base,{fetchImpl:fake}),/Untrusted browser origin/);
  await assert.rejects(verifyCors(base,{fetchImpl:async()=>response(200,null)}),
    /missing a matching CORS/);
});
test('refuses non-LexFlow or non-HTTPS addresses without making any request',async()=>{
  let count=0;
  const fake=async()=>{count++;return response(200,'https://legal.bsoedu.org');};
  await assert.rejects(verifyCors('https://example.com',{fetchImpl:fake}),/Refusing/);
  assert.equal(count,0);
});
