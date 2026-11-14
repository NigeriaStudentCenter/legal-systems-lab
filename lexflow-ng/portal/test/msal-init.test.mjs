import test from 'node:test';
import assert from 'node:assert/strict';
import {PublicClientApplication} from '@azure/msal-browser';
import {createMsal} from '../src/msal-init.mjs';

test('the installed msal-browser exposes the API the portal relies on',()=>{
  assert.equal(typeof PublicClientApplication,'function');
  assert.equal(typeof PublicClientApplication.createPublicClientApplication,'undefined',
    'v5 removed the static factory; the portal must not call it');
  for(const method of ['initialize','handleRedirectPromise','loginRedirect','logoutRedirect','acquireTokenSilent','setActiveAccount','getActiveAccount'])
    assert.equal(typeof PublicClientApplication.prototype[method],'function',method);
});
test('createMsal constructs with the config and initializes before returning',async()=>{
  const calls=[];
  class Fake{constructor(c){calls.push(['new',c]);}async initialize(){calls.push(['init']);}}
  const client=await createMsal(Fake,{auth:{clientId:'x'}});
  assert.ok(client instanceof Fake);
  assert.deepEqual(calls,[['new',{auth:{clientId:'x'}}],['init']]);
});
