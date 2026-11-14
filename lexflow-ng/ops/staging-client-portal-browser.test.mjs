import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyClosedPortalBrowser} from './staging-client-portal-readonly.mjs';

// Offline regression against the exact portal bundle and local HTTPS preview.
// No Azure resource, identity provider, payment service, or client record is used.
const staging='https://lexflowstg-api.test.westeurope.azurecontainerapps.io';
const closed=JSON.stringify({live_services:{
  applications:false,verification:false,publication:false,directory:false,
  engagements:false,payments:false,legal_fee_custody:false,
  custody_dispatch:false,client_matter_storage:false
}});
test('both real Chromium portals display closed staging before requesting Entra sign-in',
  {timeout:45000},async()=>{
    let count=0;
    const result=await verifyClosedPortalBrowser(staging,{
      fetchImpl:async(url,options)=>{
        assert.equal(url,staging+'/v1/meta');
        assert.equal(options.method,'GET');
        count++;
        return {status:200,arrayBuffer:async()=>{
          const bytes=new TextEncoder().encode(closed);
          return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
        }};
      }
    });
    assert.equal(result.screens.length,2);
    assert.ok(result.screens.every(item=>item.business_controls==='disabled'));
    assert.equal(result.user_login,'not performed');
    assert.equal(count,2);
  }
);
