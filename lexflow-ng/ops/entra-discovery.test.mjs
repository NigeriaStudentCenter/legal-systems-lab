import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateConfiguration,validateDiscovery,checkIdentity} from './entra-discovery.mjs';
const conf=JSON.parse(await readFile(new URL('./entra-staging-public-config.json',import.meta.url),'utf8'));
const tenant=conf.tenantId;
const data={
  issuer:conf.expectedIssuer,
  authorization_endpoint:'https://lexflowngstaging.ciamlogin.com/'+tenant+'/oauth2/v2.0/authorize',
  token_endpoint:'https://lexflowngstaging.ciamlogin.com/'+tenant+'/oauth2/v2.0/token',
  jwks_uri:conf.expectedJwksUri
};
const keys={keys:[{kid:'staging-synthetic-public-key',kty:'RSA',use:'sig',n:'synthetic',e:'AQAB'}]};
test('exact staging config matches tenant, separate SPA/API and API delegated scope',()=>{
  const validated=validateConfiguration(conf);
  assert.match(validated.discoveryUrl,/\.well-known\/openid-configuration$/);
  assert.equal(validated.expectedIssuer,conf.expectedIssuer);
});
test('reject foreign tenant, path injection or unsafe issuer',()=>{
  assert.throws(()=>validateConfiguration({...conf,authority:'http://lexflowngstaging.ciamlogin.com/'}));
  assert.throws(()=>validateConfiguration({...conf,expectedIssuer:'https://other.ciamlogin.com/abc/v2.0'}));
  assert.throws(()=>validateConfiguration({...conf,portalClientId:conf.apiAudience}));
  assert.throws(()=>validateConfiguration({...conf,apiScope:'api://wrong/scope'}));
  assert.throws(()=>validateConfiguration({...conf,callbackOrigin:'https://evil.example'}));
});
test('matches trusted Entra discovery issuer and JWKS without account credentials',()=>{
  const o=validateDiscovery(data,keys,conf);
  assert.equal(o.issuerMatchesBackend,true);
  assert.equal(o.jwksMatchesBackend,true);
});
test('refuses metadata drift or malformed key sets',()=>{
  assert.throws(()=>validateDiscovery({...data,issuer:'https://other.ciamlogin.com/x'},keys,conf));
  assert.throws(()=>validateDiscovery({...data,jwks_uri:'https://evil.example/keys'},keys,conf));
  assert.throws(()=>validateDiscovery({...data,token_endpoint:'https://evil.example/oauth2/v2.0/token'},keys,conf));
  assert.throws(()=>validateDiscovery(data,{keys:[{...keys.keys[0],d:'private-secret'}]},conf));
  assert.throws(()=>validateDiscovery(data,{keys:[keys.keys[0],keys.keys[0]]},conf));
  assert.throws(()=>validateDiscovery(data,{keys:[]},conf));
});
test('read-only discovery sends GET only and rejects redirected requests',async()=>{
  const seen=[];
  const fake=async url=>{
    seen.push(url);
    return {status:200,headers:{get:()=> 'application/json'},
      text:async()=>JSON.stringify(url===conf.expectedJwksUri?keys:data)};
  };
  const result=await checkIdentity(conf,{fetchImpl:fake});
  assert.equal(seen.length,2);
  assert.equal(result.keysAvailable,1);
  await assert.rejects(checkIdentity(conf,{fetchImpl:async()=>({
    status:302,headers:{get:()=> 'application/json'},text:async()=>JSON.stringify(data)
  })}),/OIDC endpoint returned 302/);
});
