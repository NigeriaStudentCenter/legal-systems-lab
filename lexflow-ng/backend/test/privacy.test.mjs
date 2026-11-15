import test from 'node:test';
import assert from 'node:assert/strict';
import {buildApp} from '../src/app.mjs';
import {readConfig} from '../src/config.mjs';
import {parseKey,makeAccountCipher} from '../src/crypto.mjs';
import {parseApplication,parseEngagementRequest,parseDataRequest,InputError} from '../src/domain.mjs';

const key=Buffer.alloc(32,3);
test('account numbers encrypt to a different value each time and decrypt exactly',()=>{
  const c=makeAccountCipher(key);
  const a=c.encrypt('0123456789'),b=c.encrypt('0123456789');
  assert.notEqual(a,b);assert.ok(!a.includes('0123456789'));assert.match(a,/^v1\./);
  assert.equal(c.decrypt(a),'0123456789');assert.equal(c.decrypt(b),'0123456789');
});
test('tampered or foreign ciphertext is refused, and a wrong key cannot read it',()=>{
  const c=makeAccountCipher(key),other=makeAccountCipher(Buffer.alloc(32,4));
  const enc=c.encrypt('0123456789');
  const raw=Buffer.from(enc.slice(3),'base64');raw[raw.length-1]^=1;
  assert.throws(()=>c.decrypt('v1.'+raw.toString('base64')));
  assert.throws(()=>other.decrypt(enc));
  assert.throws(()=>c.decrypt('0123456789'),e=>e instanceof InputError);
});
test('the key must be exactly 32 bytes; no key means no cipher',()=>{
  assert.equal(parseKey(undefined),null);assert.equal(parseKey(''),null);assert.equal(makeAccountCipher(null),null);
  assert.throws(()=>parseKey(Buffer.alloc(16).toString('base64')),/32 bytes/);
  assert.equal(parseKey(key.toString('base64')).length,32);
});
const env={DATABASE_URL:'postgresql://x@localhost/x',OIDC_ISSUER:'https://id.example.test/',OIDC_AUDIENCE:'a',OIDC_JWKS_URI:'https://id.example.test/keys',ALLOWED_ORIGINS:'https://app.example.test'};
test('privacy settings have safe defaults and are validated',()=>{
  const c=readConfig(env);
  assert.equal(c.privacyNoticeVersion,'unapproved-draft-0.1');assert.equal(c.clientContactRetentionDays,90);assert.equal(c.paymentDetailsKey,null);
  assert.equal(readConfig({...env,PRIVACY_NOTICE_VERSION:'1.0',CLIENT_CONTACT_RETENTION_DAYS:'30'}).clientContactRetentionDays,30);
  assert.throws(()=>readConfig({...env,PRIVACY_NOTICE_VERSION:'has spaces'}));
  assert.throws(()=>readConfig({...env,CLIENT_CONTACT_RETENTION_DAYS:'0'}));
  assert.throws(()=>readConfig({...env,PAYMENT_DETAILS_KEY:'short'}));
});
test('requests may echo the notice version shown; data requests use fixed kinds',()=>{
  const app={full_name:'Ada Nwosu',state:'Lagos',city:'Ikeja',year_of_call:2020,practice_areas:['Employment'],languages:['English'],
    summary:'Fictional training practice profile with no actual solicitor.',privacy_acknowledged:true,verification_authorised:true};
  assert.equal(parseApplication(app).privacy_notice_version,undefined);
  assert.equal(parseApplication({...app,privacy_notice_version:'1.0'}).privacy_notice_version,'1.0');
  assert.throws(()=>parseApplication({...app,privacy_notice_version:'<script>'}));
  const req={application_id:'0b9d2f0e-3c1a-4f6e-9a57-2f1f6c1f4a11',service_category:'Employment',client_name:'Test Client',client_contact:'c@example.test',direct_payment_acknowledged:true};
  assert.equal(parseEngagementRequest({...req,privacy_notice_version:'1.0'}).privacy_notice_version,'1.0');
  assert.equal(parseDataRequest({kind:'erasure'}).kind,'erasure');
  assert.throws(()=>parseDataRequest({kind:'delete everything',note:'x'}));
  assert.throws(()=>parseDataRequest({kind:'access'}));
});

const auth=async req=>{if(req.headers.authorization!=='Bearer ok')throw new InputError('Authentication required',401);return {subject:'idp|u'};};
const calls=[];
const db={ready:async()=>true,apply:async(...a)=>{calls.push(['apply',...a]);return {id:'x',status:'pending'};},
  requestEngagement:async(...a)=>{calls.push(['requestEngagement',...a]);return {id:'e'};},
  exportMyData:async s=>{calls.push(['export',s]);return {account:null};},
  createDataRequest:async(s,k)=>{calls.push(['request',s,k]);return {id:'r',kind:k,status:'received'};},
  myDataRequests:async()=>[]};
const base={allowedOrigins:['https://legal.bsoedu.org'],privacyNoticeVersion:'1.0',clientContactRetentionDays:90,
  gates:{applications:false,verification:false,publication:false,directory:false,engagements:false}};
const h={authorization:'Bearer ok'};
test('own-data routes are closed with every gate off, and need sign-in when open',async()=>{
  let app=await buildApp({config:base,db,authenticate:auth});
  try{
    for(const [method,url] of [['GET','/v1/me/data'],['POST','/v1/me/requests'],['GET','/v1/me/requests']])
      assert.equal((await app.inject({method,url,headers:h,...(method==='POST'?{payload:{kind:'erasure'}}:{})})).statusCode,503,url);
    const meta=(await app.inject({url:'/v1/meta'})).json();
    assert.equal(meta.privacy_notice_version,'1.0');assert.equal(meta.client_contact_retention_days,90);
  }finally{await app.close();}
  app=await buildApp({config:{...base,gates:{...base.gates,applications:true,engagements:true}},db,authenticate:auth});
  try{
    assert.equal((await app.inject({url:'/v1/me/data'})).statusCode,401);
    assert.equal((await app.inject({url:'/v1/me/data',headers:h})).statusCode,200);
    assert.equal((await app.inject({method:'POST',url:'/v1/me/requests',headers:h,payload:{kind:'sell my data'}})).statusCode,400);
    const made=await app.inject({method:'POST',url:'/v1/me/requests',headers:h,payload:{kind:'erasure'}});
    assert.equal(made.statusCode,201);assert.deepEqual(calls.at(-1),['request','idp|u','erasure']);
    // An out-of-date notice version is refused; the current one and no echo are accepted.
    const a={full_name:'Ada Nwosu',state:'Lagos',city:'Ikeja',year_of_call:2020,practice_areas:['Employment'],languages:['English'],
      summary:'Fictional training practice profile with no actual solicitor.',privacy_acknowledged:true,verification_authorised:true};
    assert.equal((await app.inject({method:'POST',url:'/v1/applications',headers:h,payload:{...a,privacy_notice_version:'0.9'}})).statusCode,409);
    assert.equal((await app.inject({method:'POST',url:'/v1/applications',headers:h,payload:{...a,privacy_notice_version:'1.0'}})).statusCode,201);
    const e={application_id:'0b9d2f0e-3c1a-4f6e-9a57-2f1f6c1f4a11',service_category:'Employment',client_name:'Test Client',client_contact:'c@example.test',direct_payment_acknowledged:true};
    assert.equal((await app.inject({method:'POST',url:'/v1/engagements',headers:h,payload:{...e,privacy_notice_version:'0.9'}})).statusCode,409);
    assert.equal((await app.inject({method:'POST',url:'/v1/engagements',headers:h,payload:e})).statusCode,201);
  }finally{await app.close();}
});
