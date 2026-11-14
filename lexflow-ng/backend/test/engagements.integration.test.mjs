import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import pg from 'pg';
import {makeDb} from '../src/db.mjs';

const url=process.env.TEST_DATABASE_URL;
const integration=url?test:test.skip;
const code=n=>e=>e.statusCode===n;
integration('PostgreSQL enforces the direct-to-lawyer engagement, invoice and receipt rules',async()=>{
  const admin=new pg.Pool({connectionString:url});
  for(const f of ['001_initial.sql','002_engagements.sql'])await admin.query(await readFile(new URL('../sql/'+f,import.meta.url),'utf8'));
  await admin.query('TRUNCATE invoices,engagements,payment_detail_reviews,lawyer_payment_details,audit_events,verification_reviews,lawyer_applications,app_users RESTART IDENTITY CASCADE');
  const db=makeDb({databaseUrl:url,databaseSsl:false});
  const today=new Date().toISOString().slice(0,10);
  const later=new Date(Date.now()+60*86400000).toISOString().slice(0,10);
  const profile={full_name:'Ada Nwosu',state:'Lagos',city:'Ikeja',year_of_call:2020,practice_areas:['Employment'],languages:['English'],
    summary:'Fictional training practice profile with no actual solicitor.',privacy_acknowledged:true,verification_authorised:true};
  const bank={method:'bank_transfer',account_name:'Ada Nwosu',bank_name:'Example Bank',account_number:'0123456789',payment_url:null};
  const request=app=>({application_id:app,service_category:'Employment',client_name:'Test Client',client_contact:'client@example.test'});
  const inv=ref=>({lawyer_reference:ref,fee_type:'Consultation',amount_kobo:2500000,due_date:later});
  try{
    await admin.query(`INSERT INTO app_users(oidc_subject,role) VALUES ('reviewer-1','reviewer'),('reviewer-2','reviewer'),('publisher-1','publisher')`);
    const a=await db.apply('lawyer-1',profile);
    // Not yet verified: no payment details, and clients cannot engage an unpublished lawyer.
    await assert.rejects(db.savePaymentDetails('lawyer-1',bank),code(403));
    await assert.rejects(db.requestEngagement('client-1',request(a.id)),code(404));
    const review={decision:'approve',source:'nba_annual_list',reference:'MOCK-1',checked_on:today,valid_until:later};
    await db.review('reviewer-1',a.id,review);await db.review('reviewer-2',a.id,{...review,reference:'MOCK-2'});
    await db.publish('publisher-1',a.id);

    const e=await db.requestEngagement('client-1',request(a.id));
    assert.equal(e.status,'requested');
    await assert.rejects(db.requestEngagement('client-1',request(a.id)),code(409));
    await assert.rejects(db.requestEngagement('lawyer-1',request(a.id)),code(403));
    await assert.rejects(db.requestEngagement('reviewer-1',request(a.id)),code(403));
    // A stranger learns nothing; the client cannot answer their own request.
    await db.requestEngagement('client-2',request(a.id));
    await assert.rejects(db.listInvoices('reviewer-1',e.id),code(404));
    await assert.rejects(db.respondEngagement('client-1',e.id,{decision:'accept'}),code(403));
    await assert.rejects(db.issueInvoice('lawyer-1',e.id,inv('INV-0')),code(409));
    assert.equal((await db.respondEngagement('lawyer-1',e.id,{decision:'accept'})).status,'accepted');
    const mineLawyer=await db.myEngagements('lawyer-1'),mineClient=await db.myEngagements('client-1');
    assert.equal(mineLawyer.find(x=>x.id===e.id).client_contact,'client@example.test');
    assert.equal(mineClient.length,1);assert.equal(mineClient[0].client_contact,null);assert.equal(mineClient[0].my_role,'client');

    // No invoice until two independent reviewers approve where the money goes.
    await assert.rejects(db.issueInvoice('lawyer-1',e.id,inv('INV-1')),code(409));
    const d=await db.savePaymentDetails('lawyer-1',bank);
    assert.equal(d.status,'pending_review');
    assert.equal((await db.paymentDetailQueue('reviewer-1'))[0].verified_name,'Ada Nwosu');
    await assert.rejects(db.paymentDetailQueue('client-1'),code(403));
    const ok={decision:'approve',name_match_confirmed:true};
    assert.equal((await db.reviewPaymentDetails('reviewer-1',d.id,ok)).status,'pending_review');
    await assert.rejects(db.reviewPaymentDetails('reviewer-1',d.id,ok),code(409));
    await assert.rejects(db.issueInvoice('lawyer-1',e.id,inv('INV-1')),code(409));
    assert.equal((await db.reviewPaymentDetails('reviewer-2',d.id,ok)).status,'approved');

    await assert.rejects(db.issueInvoice('client-1',e.id,inv('INV-1')),code(403));
    const i=await db.issueInvoice('lawyer-1',e.id,inv('INV-1'));
    assert.equal(i.status,'issued');assert.equal(i.amount_kobo,2500000);assert.equal(i.due_date,later);
    assert.equal(i.pay_to.account_number,'0123456789');
    await assert.rejects(db.issueInvoice('lawyer-1',e.id,inv('INV-1')),code(409));
    assert.equal((await db.listInvoices('client-1',e.id)).length,1);
    await assert.rejects(db.listInvoices('client-2',e.id),code(404));
    await assert.rejects(db.receipt('client-1',i.id),code(409));
    await assert.rejects(db.clientPaymentResponse('client-1',i.id,{response:'confirm'}),code(409));
    await assert.rejects(db.reportPaid('client-1',i.id,{received_on:today}),code(403));
    await assert.rejects(db.reportPaid('client-2',i.id,{received_on:today}),code(404));

    // Changing the account sends it back to review and blocks new invoices, but the
    // issued invoice keeps the account that was approved when it was issued.
    const changed=await db.savePaymentDetails('lawyer-1',{...bank,account_number:'9999999999'});
    assert.equal(changed.status,'pending_review');assert.equal(changed.version,2);
    await assert.rejects(db.issueInvoice('lawyer-1',e.id,inv('INV-2')),code(409));
    assert.equal((await db.listInvoices('client-1',e.id))[0].pay_to.account_number,'0123456789');
    assert.equal((await db.reviewPaymentDetails('reviewer-1',changed.id,{decision:'reject',name_match_confirmed:false,reason:'Unexplained account change'})).status,'rejected');

    const paid=await db.reportPaid('lawyer-1',i.id,{received_on:today});
    assert.match(paid.receipt_number,/^LFR-\d{8}-[0-9A-F]{10}$/);
    await assert.rejects(db.reportPaid('lawyer-1',i.id,{received_on:today}),code(409));
    await assert.rejects(db.voidInvoice('lawyer-1',i.id),code(409));
    await assert.rejects(db.clientPaymentResponse('lawyer-1',i.id,{response:'confirm'}),code(403));
    const r1=await db.receipt('client-1',i.id);
    assert.equal(r1.client_confirmed,false);assert.match(r1.notice,/did not receive, hold, process or verify/);
    assert.equal((await db.clientPaymentResponse('client-1',i.id,{response:'confirm'})).status,'client_confirmed');
    const r2=await db.receipt('lawyer-1',i.id);
    assert.equal(r2.client_confirmed,true);assert.equal(r2.amount_kobo,2500000);assert.equal(r2.issued_by,'Ada Nwosu');
    assert.ok(!('account_number' in r2.paid_to));

    await assert.rejects(db.closeEngagement('client-1',e.id,'complete'),code(403));
    await assert.rejects(db.closeEngagement('client-1',e.id,'cancel'),code(409));
    assert.equal((await db.closeEngagement('lawyer-1',e.id,'complete')).status,'completed');
    const actions=(await admin.query('SELECT action FROM audit_events ORDER BY id')).rows.map(x=>x.action);
    for(const x of ['engagement_requested','engagement_accepted','payment_details_submitted','payment_details_approved','payment_details_rejected','invoice_issued','invoice_reported_paid','invoice_client_confirmed','engagement_completed'])
      assert.ok(actions.includes(x),x);
  }finally{await db.close();await admin.end();}
});
