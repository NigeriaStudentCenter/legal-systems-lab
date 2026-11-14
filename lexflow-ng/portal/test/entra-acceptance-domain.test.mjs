import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {validateAcceptanceConfig,checkAccessTokenClaims,verifyGenuineToken,
  fingerprintSubject,verifyDiagnosticResponse} from '../src/entra-acceptance-domain.mjs';

const hostname='lexflowstg-api.example.westeurope.azurecontainerapps.io';
const enabled={
  enabled:true,
  tenantId:'5ddfd479-a3cb-4ff7-bdd8-9d745c4309b7',
  authority:'https://lexflowngstaging.ciamlogin.com/',
  issuer:'https://5ddfd479-a3cb-4ff7-bdd8-9d745c4309b7.ciamlogin.com/5ddfd479-a3cb-4ff7-bdd8-9d745c4309b7/v2.0',
  jwksUri:'https://lexflowngstaging.ciamlogin.com/5ddfd479-a3cb-4ff7-bdd8-9d745c4309b7/discovery/v2.0/keys',
  clientId:'c0ec48d2-b103-4f62-950a-e3d6c65bb55d',
  apiAudience:'e0db88c1-c50d-48ff-985d-df0a01a222d4',
  apiScope:'api://e0db88c1-c50d-48ff-985d-df0a01a222d4/access_as_user',
  apiBaseUrl:'https://'+hostname,
  redirectUri:'https://legal.bsoedu.org/lexflow-ng/portal/identity-check.html',
  apiProbe:false
};
const cfg=validateAcceptanceConfig(enabled);
const claims={
  sub:'synthetic-subject-a',
  tid:cfg.tenantId,
  scp:'access_as_user',
  azp:cfg.clientId,
  iat:1763140000,
  exp:1763143600
};
test('public configuration stays disabled unless explicitly configured',()=>{
  assert.deepEqual(validateAcceptanceConfig({enabled:false}),{enabled:false});
  assert.equal(cfg.enabled,true);
  assert.equal(cfg.apiBaseUrl,'https://'+hostname);
  assert.equal(cfg.apiProbe,false);
});
test('strictly scopes sign-in to registered redirect, issuer, SPA and API audience',()=>{
  for(const [field,value] of [
    ['authority','https://evil.ciamlogin.com/'],
    ['clientId','00000000-0000-0000-0000-000000000000'],
    ['apiScope','api://something_else/access_as_user'],
    ['redirectUri','https://legal.bsoedu.org/lexflow-ng/portal/register.html'],
    ['apiBaseUrl','https://example.com'],
    ['apiBaseUrl','https://'+hostname+'.evil.example'],
    ['apiBaseUrl','http://'+hostname],
    ['apiProbe','false']
  ])assert.throws(()=>validateAcceptanceConfig({...enabled,[field]:value}));
  assert.throws(()=>validateAcceptanceConfig(enabled,'https://github.io'));
  assert.throws(()=>validateAcceptanceConfig(enabled,'https://legal.bsoedu.org','/index.html'));
});
test('requires signed delegated access-token claims rather than an ID token',()=>{
  assert.equal(checkAccessTokenClaims(claims,cfg),'synthetic-subject-a');
  for(const changes of [
    {sub:''},{tid:'different-tenant'},{scp:'User.Read'},
    {azp:'different-app'},{iat:'not-a-number'},{exp:null}
  ])assert.throws(()=>checkAccessTokenClaims({...claims,...changes},cfg));
});
test('signature, issuer and audience verifier is invoked for genuine Entra tokens',async()=>{
  let options;
  const out=await verifyGenuineToken('a.b.c',cfg,{
    verify:async(token,keys,args)=>{
      assert.equal(token,'a.b.c');
      assert.equal(keys,'expected-remote-keyset');
      options=args;
      return {payload:claims};
    },
    keyFactory:uri=>{
      assert.equal(uri.href,cfg.jwksUri);
      return 'expected-remote-keyset';
    }
  });
  assert.deepEqual(options.algorithms,['RS256','ES256']);
  assert.equal(options.issuer,cfg.issuer);
  assert.equal(options.audience,cfg.apiAudience);
  assert.equal(out.signatureConfirmed,true);
  assert.equal(out.subject,'synthetic-subject-a');
  await assert.rejects(verifyGenuineToken('not-a-jwt',cfg));
});
test('different real accounts get distinct session-scoped hash comparisons',async()=>{
  const salt='a'.repeat(32);
  const a=await fingerprintSubject('fictional-client',salt,webcrypto);
  const b=await fingerprintSubject('fictional-lawyer',salt,webcrypto);
  const again=await fingerprintSubject('fictional-client',salt,webcrypto);
  assert.match(a,/^[a-f0-9]{64}$/);
  assert.equal(a,again);
  assert.notEqual(a,b);
  assert.notEqual(a,await fingerprintSubject('fictional-client','b'.repeat(32),webcrypto));
  await assert.rejects(fingerprintSubject('person','weak',webcrypto));
});
test('API diagnostic cannot leak identifiers or authority',()=>{
  assert.equal(verifyDiagnosticResponse({authenticated:true,environment:'staging-acceptance',
    data_access:false,professional_verification:false}),true);
  assert.throws(()=>verifyDiagnosticResponse({authenticated:true,
    environment:'staging-acceptance',data_access:false,professional_verification:false,sub:'secret-id'}));
  assert.throws(()=>verifyDiagnosticResponse({authenticated:true,
    environment:'staging-acceptance',data_access:true,professional_verification:false}));
});
