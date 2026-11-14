import test from 'node:test';
import assert from 'node:assert/strict';
import {buildApp} from '../src/app.mjs';
import {parsePaymentDetails,parsePaymentDetailReview,parseEngagementRequest,parseEngagementResponse,parseInvoice,parsePaidReport,parseClientResponse,InputError} from '../src/domain.mjs';
import {readConfig} from '../src/config.mjs';

const bad=fn=>assert.throws(fn,e=>e instanceof InputError&&e.statusCode===400);
const id='0b9d2f0e-3c1a-4f6e-9a57-2f1f6c1f4a11';
test('payment details accept only a Nigerian account or a Paystack-hosted page',()=>{
  const bank=parsePaymentDetails({method:'bank_transfer',account_name:'Ada Nwosu & Co',bank_name:'Example Bank',account_number:'0123456789'});
  assert.equal(bank.payment_url,null);
  const link=parsePaymentDetails({method:'paystack_link',account_name:'Ada Nwosu & Co',payment_url:'https://paystack.shop/pay/ada-nwosu'});
  assert.equal(link.account_number,null);
  bad(()=>parsePaymentDetails({method:'bank_transfer',account_name:'Ada Nwosu',bank_name:'Example Bank',account_number:'12345'}));
  bad(()=>parsePaymentDetails({method:'paystack_link',account_name:'Ada Nwosu',payment_url:'https://paystack.shop.evil.example/pay/ada'}));
  bad(()=>parsePaymentDetails({method:'paystack_link',account_name:'Ada Nwosu',payment_url:'https://paystack.shop/pay/ada?next=https://evil.example'}));
  bad(()=>parsePaymentDetails({method:'paystack_link',account_name:'Ada Nwosu',payment_url:'http://paystack.shop/pay/ada'}));
  bad(()=>parsePaymentDetails({method:'crypto',account_name:'Ada Nwosu'}));
  bad(()=>parsePaymentDetails({method:'bank_transfer',account_name:'Ada Nwosu',bank_name:'Example Bank',account_number:'0123456789',payment_url:'https://paystack.shop/pay/ada'}));
});
test('approving payment details requires an explicit account-name match',()=>{
  bad(()=>parsePaymentDetailReview({decision:'approve'}));
  assert.equal(parsePaymentDetailReview({decision:'approve',name_match_confirmed:true}).decision,'approve');
  assert.equal(parsePaymentDetailReview({decision:'reject',reason:'Account name differs from roll name'}).name_match_confirmed,false);
});
test('engagement request carries no case facts and needs the direct-payment acknowledgement',()=>{
  const ok={application_id:id,service_category:'Employment',client_name:'Test Client',client_contact:'client@example.test',direct_payment_acknowledged:true};
  assert.equal(parseEngagementRequest(ok).service_category,'Employment');
  assert.equal(parseEngagementRequest({...ok,client_contact:'+234 801 234 5678'}).client_contact,'+234 801 234 5678');
  bad(()=>parseEngagementRequest({...ok,direct_payment_acknowledged:false}));
  bad(()=>parseEngagementRequest({...ok,description:'My employer dismissed me after...'}));
  bad(()=>parseEngagementRequest({...ok,service_category:'Anything else'}));
  bad(()=>parseEngagementRequest({...ok,client_contact:'call me'}));
  bad(()=>parseEngagementRequest({...ok,application_id:'1'}));
});
test('acceptance needs a conflict check; invoices are bounded naira amounts with fixed fee labels',()=>{
  bad(()=>parseEngagementResponse({decision:'accept'}));
  assert.equal(parseEngagementResponse({decision:'accept',conflict_check_confirmed:true}).decision,'accept');
  assert.equal(parseEngagementResponse({decision:'decline'}).decision,'decline');
  const now=new Date('2026-11-14T10:00:00Z');
  const inv={lawyer_reference:'INV-2026/001',fee_type:'Consultation',amount_kobo:2500000,due_date:'2026-11-30'};
  assert.equal(parseInvoice(inv,now).amount_kobo,2500000);
  bad(()=>parseInvoice({...inv,amount_kobo:50},now));
  bad(()=>parseInvoice({...inv,amount_kobo:25000.5},now));
  bad(()=>parseInvoice({...inv,amount_kobo:'2500000'},now));
  bad(()=>parseInvoice({...inv,fee_type:'Success fee'},now));
  bad(()=>parseInvoice({...inv,due_date:'2026-11-01'},now));
  bad(()=>parseInvoice({...inv,lawyer_reference:'unlawful arrest of Mr X'},now));
  bad(()=>parseInvoice({...inv,notes:'case facts'},now));
  bad(()=>parsePaidReport({received_on:'2026-11-14'},now));
  bad(()=>parsePaidReport({received_on:'2026-12-01',funds_received_confirmed:true},now));
  assert.equal(parsePaidReport({received_on:'2026-11-14',funds_received_confirmed:true},now).received_on,'2026-11-14');
  bad(()=>parseClientResponse({response:'refund'}));
});
test('ENABLE_ENGAGEMENTS defaults to off',()=>{
  const env={DATABASE_URL:'postgresql://x@localhost/x',OIDC_ISSUER:'https://id.example.test/',OIDC_AUDIENCE:'a',OIDC_JWKS_URI:'https://id.example.test/keys',ALLOWED_ORIGINS:'https://app.example.test'};
  assert.equal(readConfig(env).gates.engagements,false);
  assert.equal(readConfig({...env,ENABLE_ENGAGEMENTS:'true'}).gates.engagements,true);
});

const auth=async req=>{
  if(req.headers.authorization!=='Bearer test-valid')throw new InputError('Authentication required',401);
  return {subject:'idp|test-user'};
};
const calls=[];
const rec=name=>async(...a)=>{calls.push([name,...a]);return {ok:name};};
const db={ready:async()=>true};
for(const m of ['savePaymentDetails','myPaymentDetails','paymentDetailQueue','reviewPaymentDetails','requestEngagement','myEngagements','respondEngagement','closeEngagement','issueInvoice','listInvoices','reportPaid','clientPaymentResponse','voidInvoice','receipt'])db[m]=rec(m);
const base={allowedOrigins:['https://legal.bsoedu.org'],gates:{applications:false,verification:false,publication:false,directory:false,engagements:false}};
const routes=[['PUT','/v1/payment-details'],['GET','/v1/payment-details/me'],['GET','/v1/payment-details/queue'],['POST',`/v1/payment-details/${id}/review`],
  ['POST','/v1/engagements'],['GET','/v1/engagements'],['POST',`/v1/engagements/${id}/respond`],['POST',`/v1/engagements/${id}/complete`],['POST',`/v1/engagements/${id}/cancel`],
  ['POST',`/v1/engagements/${id}/invoices`],['GET',`/v1/engagements/${id}/invoices`],['POST',`/v1/invoices/${id}/report-paid`],['POST',`/v1/invoices/${id}/client-response`],
  ['POST',`/v1/invoices/${id}/void`],['GET',`/v1/invoices/${id}/receipt`]];
test('every engagement route is closed while the gate is off, even with a valid token',async()=>{
  const app=await buildApp({config:base,db,authenticate:auth});
  try{
    for(const [method,url] of routes){
      const r=await app.inject({method,url,headers:{authorization:'Bearer test-valid'},...(method==='GET'?{}:{payload:{}})});
      assert.equal(r.statusCode,503,method+' '+url);
    }
    assert.equal(calls.length,0);
    const m=(await app.inject({url:'/v1/meta'})).json().live_services;
    assert.deepEqual([m.engagements,m.payments,m.legal_fee_custody],[false,false,false]);
  }finally{await app.close();}
});
test('with the gate on, routes need sign-in and valid input; LexFlow still reports no custody',async()=>{
  const app=await buildApp({config:{...base,gates:{...base.gates,engagements:true}},db,authenticate:auth});
  const h={authorization:'Bearer test-valid'};
  try{
    for(const [method,url] of routes){
      const r=await app.inject({method,url,...(method==='GET'?{}:{payload:{}})});
      assert.equal(r.statusCode,401,method+' '+url);
    }
    assert.equal((await app.inject({method:'POST',url:'/v1/engagements',headers:h,payload:{application_id:id}})).statusCode,400);
    assert.equal((await app.inject({method:'POST',url:'/v1/invoices/not-an-id/report-paid',headers:h,payload:{}})).statusCode,400);
    assert.equal((await app.inject({method:'POST',url:`/v1/invoices/${id}/void`,headers:h,payload:{amount_kobo:1}})).statusCode,400);
    assert.equal(calls.length,0);
    const made=await app.inject({method:'POST',url:'/v1/engagements',headers:h,payload:{application_id:id,service_category:'Employment',client_name:'Test Client',client_contact:'client@example.test',direct_payment_acknowledged:true}});
    assert.equal(made.statusCode,201);
    const inv=await app.inject({method:'POST',url:`/v1/engagements/${id}/invoices`,headers:h,payload:{lawyer_reference:'INV-1',fee_type:'Consultation',amount_kobo:2500000,due_date:'2099-01-01'}});
    assert.equal(inv.statusCode,201);
    assert.deepEqual(calls.map(c=>c[0]),['requestEngagement','issueInvoice']);
    assert.equal(calls[1][1],'idp|test-user');
    const m=(await app.inject({url:'/v1/meta'})).json().live_services;
    assert.deepEqual([m.engagements,m.payments,m.legal_fee_custody],[true,false,false]);
  }finally{await app.close();}
});
