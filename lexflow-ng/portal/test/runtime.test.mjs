import test from 'node:test';
import assert from 'node:assert/strict';
import {states,validatePortalConfig,validateApplication} from '../src/runtime.mjs';
const base = {enabled:true,clientId:'12345678-1234-4123-8234-123456789abc',
  authority:'https://test.ciamlogin.com/test-tenant/',
  apiScope:'api://12345678-1234-4123-8234-123456789abc/lexflow.read',
  apiBaseUrl:'https://api.test.example',
  redirectUri:'https://nigeriastudentcenter.github.io/legal-systems-lab/lexflow-ng/portal/register.html'};
test('disabled by default',()=>assert.deepEqual(validatePortalConfig({enabled:false},'https://nigeriastudentcenter.github.io'),{enabled:false}));
test('auth and API configuration must use HTTPS and trusted redirect',()=>{
 assert.equal(validatePortalConfig(base,'https://nigeriastudentcenter.github.io').enabled,true);
 assert.throws(()=>validatePortalConfig({...base,apiBaseUrl:'http://api.test.example'},'https://nigeriastudentcenter.github.io'));
 assert.throws(()=>validatePortalConfig({...base,authority:'https://adversary.example/'},'https://nigeriastudentcenter.github.io'));
 assert.throws(()=>validatePortalConfig({...base,redirectUri:'https://adversary.example/'},'https://nigeriastudentcenter.github.io'));
 assert.throws(()=>validatePortalConfig({...base,clientId:'abc'},'https://nigeriastudentcenter.github.io'));
});
test('36 states and FCT once each',()=>{assert.equal(states.length,37);assert.equal(new Set(states).size,37);});
const example={full_name:'Ada Nwosu',state:'Lagos',city:'Ikeja',year_of_call:2021,
 practice_areas:['Property & tenancy'],languages:['English'],
 summary:'A factual fictional summary for a practice onboarding demonstration.',
 privacy_acknowledged:true,verification_authorised:true};
test('application requires professional facts and explicit notices',()=>{
 assert.equal(validateApplication(example),example);
 assert.throws(()=>validateApplication({...example,state:'Not a state'}));
 assert.throws(()=>validateApplication({...example,privacy_acknowledged:false}));
 assert.throws(()=>validateApplication({...example,year_of_call:3000}));
});
