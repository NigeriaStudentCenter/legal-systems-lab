import test from 'node:test';
import assert from 'node:assert/strict';
import {validateBaseUrl,inspectStaging} from './staging-readonly.mjs';

const url='https://lexflowstg-api.test-staging.westeurope.azurecontainerapps.io';
function fakeRequest(overrides={}){
  return async (resource,init)=>{
    const path=new URL(resource).pathname;
    assert.equal(init.method,'GET');
    assert.equal(init.redirect,'manual');
    assert.equal(init.headers.Accept,'application/json');
    let status=path==='/healthz'||path==='/readyz'||path==='/v1/meta'?200:503;
    status=overrides[path]?.status??status;
    const meta={jurisdictions:Array.from({length:37},(_,i)=>'jurisdiction'+i),
      live_services:{applications:false,verification:false,publication:false,directory:false,
        engagements:false,payments:false,legal_fee_custody:false,custody_dispatch:false,
        client_matter_storage:false}};
    const payload=overrides[path]?.payload??(path==='/healthz'
      ?{product:'lexflow-ng-api',status:'running'}:path==='/readyz'
      ?{status:'ready'}:path==='/v1/meta'?meta:{error:'Feature is not enabled'});
    return {status,json:async()=>payload};
  };
}
test('accepts only exact LexFlow staging HTTPS Container App hostname',()=>{
  assert.equal(validateBaseUrl(url),url);
  for(const invalid of [
    'http://lexflowstg-api.a.westeurope.azurecontainerapps.io',
    'https://lexflowstg-api.a.westeurope.azurecontainerapps.io.evil.example',
    'https://other-service.a.westeurope.azurecontainerapps.io',
    'https://user:pass@lexflowstg-api.a.westeurope.azurecontainerapps.io',
    'https://lexflowstg-api.a.westeurope.azurecontainerapps.io/healthz',
    'https://lexflowstg-api.a.westeurope.azurecontainerapps.io:4443/',
    'https://lexflowstg-api.a.westeurope.azurecontainerapps.io?q=1',
    'https://169.254.169.254/latest/meta-data'
  ])assert.throws(()=>validateBaseUrl(invalid),/Refusing|Invalid/);
});
test('read-only preflight accepts healthy, locked-down synthetic staging',async()=>{
  const results=await inspectStaging(url,{fetchImpl:fakeRequest()});
  assert.match(results.result,/PASS/);
  assert.equal(results.endpoints['/v1/engagements'],503);
  assert.equal(results.endpoints['/v1/meta'],200);
  assert.equal(results.feature_gates.jurisdiction_count,37);
  assert.equal(results.feature_gates.all_business_features_disabled,true);
});
test('refuses enabled engagement flag even if every endpoint otherwise matches',async()=>{
  const data={jurisdictions:Array.from({length:37},(_,i)=>''+i),
    live_services:{applications:false,verification:false,publication:false,directory:false,
      engagements:true,payments:false,legal_fee_custody:false,custody_dispatch:false,
      client_matter_storage:false}};
  await assert.rejects(inspectStaging(url,{fetchImpl:fakeRequest({'/v1/meta':{payload:data}})}),/Unexpectedly enabled live feature: engagements/);
});
test('fails closed if requests are no longer disabled',async()=>{
  await assert.rejects(inspectStaging(url,{fetchImpl:fakeRequest({'/v1/engagements':{status:401}})}),
    /expected HTTP 503 but received 401/);
});
test('fails closed when database or health is unavailable',async()=>{
  await assert.rejects(inspectStaging(url,{fetchImpl:fakeRequest({'/readyz':{status:500}})}),
    /expected HTTP 200 but received 500/);
});
test('fails if an unexpected redirect is returned',async()=>{
  await assert.rejects(inspectStaging(url,{fetchImpl:fakeRequest({'/healthz':{status:302}})}),
    /expected HTTP 200 but received 302/);
});
