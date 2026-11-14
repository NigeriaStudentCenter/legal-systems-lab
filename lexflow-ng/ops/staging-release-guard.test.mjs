import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateExistingApp} from './staging-release-guard.mjs';
const id=JSON.parse(await readFile(new URL('./entra-staging-public-config.json',import.meta.url),'utf8'));
const image='ghcr.io/nigeriastudentcenter/lexflow-ng-api@sha256:'+'a'.repeat(64);
function fixture(){
  const values={
    NODE_ENV:'production',DATABASE_SSL:'true',
    OIDC_ISSUER:id.expectedIssuer,OIDC_AUDIENCE:id.apiAudience,
    OIDC_JWKS_URI:id.expectedJwksUri,ALLOWED_ORIGINS:id.callbackOrigin,
    ENABLE_APPLICATIONS:'false',ENABLE_VERIFICATION:'false',
    ENABLE_PUBLICATION:'false',ENABLE_DIRECTORY:'false',
    ENABLE_ENGAGEMENTS:'false',ENABLE_AUTH_DIAGNOSTIC:'false'
  };
  return {
    name:'lexflowstg-api',
    id:'/subscriptions/000/resourceGroups/lexflow-staging-rg/providers/Microsoft.App/containerApps/lexflowstg-api',
    properties:{
      configuration:{activeRevisionsMode:'Single',ingress:{external:true,allowInsecure:false}},
      template:{containers:[{name:'lexflow-api',image,
        env:[...Object.entries(values).map(([name,value])=>({name,value})),
          {name:'DATABASE_URL',secretRef:'database-url'}]
      }]}
    }
  };
}
test('inspects only the existing synthetic staging app and validates immutable image',()=>{
  assert.equal(validateExistingApp(fixture(),{expectedImage:image,requireAuthGate:true}).ok,true);
});
test('pre-deploy permits absent new diagnostic gate only',()=>{
  const data=fixture();data.properties.template.containers[0].env=data.properties.template.containers[0].env.filter(x=>x.name!=='ENABLE_AUTH_DIAGNOSTIC');
  assert.equal(validateExistingApp(data).ok,true);
  assert.throws(()=>validateExistingApp(data,{requireAuthGate:true}),/ENABLE_AUTH_DIAGNOSTIC/);
});
test('rejects any business feature mistakenly enabled',()=>{
  for(const flag of ['ENABLE_APPLICATIONS','ENABLE_DIRECTORY','ENABLE_ENGAGEMENTS','ENABLE_AUTH_DIAGNOSTIC']){
    const data=fixture();
    data.properties.template.containers[0].env.find(x=>x.name===flag).value='true';
    assert.throws(()=>validateExistingApp(data),/gate/);
  }
});
test('rejects secret leakage, cross-tenant identity drift and wrong resource',()=>{
  const fake=fixture();
  fake.properties.template.containers[0].env.find(x=>x.name==='DATABASE_URL').value='postgresql://secret';
  assert.throws(()=>validateExistingApp(fake),/database connection/);
  const bad=fixture();bad.properties.template.containers[0].env.find(x=>x.name==='OIDC_ISSUER').value='https://evil.example';
  assert.throws(()=>validateExistingApp(bad),/identity issuer/);
  const wrong=fixture();wrong.name='other-app';
  assert.throws(()=>validateExistingApp(wrong),/unexpected app/);
});
test('rejects mutable image and unapproved digest',()=>{
  const data=fixture();data.properties.template.containers[0].image='ghcr.io/nigeriastudentcenter/lexflow-ng-api:staging';
  assert.throws(()=>validateExistingApp(data),/immutable/);
  assert.throws(()=>validateExistingApp(fixture(),{expectedImage:image.replace(/a/g,'b')}),/digest/);
});
test('rejects insecure ingress, duplicate environment variables and extra containers',()=>{
  const data=fixture();data.properties.configuration.ingress.allowInsecure=true;
  assert.throws(()=>validateExistingApp(data),/HTTPS/);
  const dup=fixture();dup.properties.template.containers[0].env.push({name:'ENABLE_DIRECTORY',value:'true'});
  assert.throws(()=>validateExistingApp(dup),/duplicate/);
  const extra=fixture();extra.properties.template.containers.push({name:'malicious',image});
  assert.throws(()=>validateExistingApp(extra),/topology/);
});
