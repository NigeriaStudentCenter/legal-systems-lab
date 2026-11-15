import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import pg from 'pg';
import {makeDb} from '../src/db.mjs';
import {makeAccountCipher} from '../src/crypto.mjs';
import {encryptExisting} from '../scripts/encrypt-account-numbers.mjs';

const url=process.env.TEST_DATABASE_URL;
const integration=url?test:test.skip;
const code=n=>e=>e.statusCode===n;
integration('PostgreSQL: encrypted account numbers, notice version, contact removal, export, requests and erasure',async()=>{
  const admin=new pg.Pool({connectionString:url});
  for(const f of ['001_initial.sql','002_engagements.sql','003_privacy.sql'])await admin.query(await readFile(new URL('../sql/'+f,import.meta.url),'utf8'));
  // A later test run must be able to re-apply the migration and start clean.
  await admin.query('ALTER TABLE lawyer_payment_details DROP CONSTRAINT IF EXISTS no_clear_account_number');
  await admin.query('ALTER TABLE invoices DROP CONSTRAINT IF EXISTS no_clear_pay_account_number');
  await admin.query('TRUNCATE data_requests,invoices,engagements,payment_detail_reviews,lawyer_payment_details,audit_events,verification_reviews,lawyer_applications,app_users RESTART IDENTITY CASCADE');
  const key=Buffer.alloc(32,5);
  const db=makeDb({databaseUrl:url,databaseSsl:false,paymentDetailsKey:key,privacyNoticeVersion:'test-2.0'});
  const noKey=makeDb({databaseUrl:url,databaseSsl:false});
  const today=new Date().toISOString().slice(0,10),later=new Date(Date.now()+60*86400000).toISOString().slice(0,10);
  const profile={full_name:'Ada Nwosu',state:'Lagos',city:'Ikeja',year_of_call:2020,practice_areas:['Employment'],languages:['English'],
    summary:'Fictional training practice profile with no actual solicitor.',privacy_acknowledged:true,verification_authorised:true};
  const bank={method:'bank_transfer',account_name:'Ada Nwosu',bank_name:'Example Bank',account_number:'0123456789',payment_url:null};
  const request=app=>({application_id:app,service_category:'Employment',client_name:'Test Client',client_contact:'client@example.test'});
  try{
    await admin.query(`INSERT INTO app_users(oidc_subject,role) VALUES ('reviewer-1','reviewer'),('reviewer-2','reviewer'),('publisher-1','publisher')`);
    const a=await db.apply('lawyer-1',profile);
    const review={decision:'approve',source:'nba_annual_list',reference:'MOCK-1',checked_on:today,valid_until:later};
    await db.review('reviewer-1',a.id,review);await db.review('reviewer-2',a.id,{...review,reference:'MOCK-2'});await db.publish('publisher-1',a.id);
    assert.equal((await admin.query('SELECT privacy_notice_version v FROM lawyer_applications')).rows[0].v,'test-2.0');

    // Without a key the API refuses to store a bank account at all.
    await assert.rejects(noKey.savePaymentDetails('lawyer-1',bank),code(503));
    const d=await db.savePaymentDetails('lawyer-1',bank);
    const stored=(await admin.query('SELECT account_number,account_number_enc,account_last4 FROM lawyer_payment_details')).rows[0];
    assert.equal(stored.account_number,null);assert.equal(stored.account_last4,'6789');
    assert.ok(!stored.account_number_enc.includes('0123456789'));
    assert.equal((await db.myPaymentDetails('lawyer-1')).account_number,'0123456789');
    const queued=(await db.paymentDetailQueue('reviewer-1'))[0];
    assert.equal(queued.account_number,'0123456789');assert.equal(queued.verified_name,'Ada Nwosu');
    await assert.rejects(noKey.myPaymentDetails('lawyer-1'),code(503));
    const ok={decision:'approve',name_match_confirmed:true};
    await db.reviewPaymentDetails('reviewer-1',d.id,ok);await db.reviewPaymentDetails('reviewer-2',d.id,ok);

    const e=await db.requestEngagement('client-1',request(a.id));
    assert.equal((await admin.query('SELECT privacy_notice_version v FROM engagements')).rows[0].v,'test-2.0');
    await db.respondEngagement('lawyer-1',e.id,{decision:'accept'});
    const i=await db.issueInvoice('lawyer-1',e.id,{lawyer_reference:'INV-1',fee_type:'Consultation',amount_kobo:2500000,due_date:later});
    assert.equal(i.pay_to.account_number,'0123456789');
    const snap=(await admin.query('SELECT pay_account_number,pay_account_number_enc FROM invoices')).rows[0];
    assert.equal(snap.pay_account_number,null);assert.ok(snap.pay_account_number_enc.startsWith('v1.'));
    assert.equal((await db.listInvoices('client-1',e.id))[0].pay_to.account_number,'0123456789');

    // Export: each person gets their own data and nothing about reviewers.
    const mine=await db.exportMyData('lawyer-1');
    assert.equal(mine.application.full_name,'Ada Nwosu');assert.equal(mine.verification.length,2);
    assert.ok(!('reviewer_user_id' in mine.verification[0]));assert.ok(!('source_reference' in mine.verification[0]));
    assert.equal(mine.payment_details.account_number,'0123456789');assert.equal(mine.invoices.length,1);
    assert.equal(mine.engagements[0].my_role,'lawyer');assert.equal(mine.engagements[0].my_contact_as_given,null);
    const theirs=await db.exportMyData('client-1');
    assert.equal(theirs.application,null);assert.equal(theirs.engagements[0].my_contact_as_given,'client@example.test');
    assert.equal((await db.exportMyData('nobody')).account,null);

    // Contact removal: only closed engagements older than the retention period.
    assert.equal((await db.purgeClosedContacts(90)).removed,0);
    await db.closeEngagement('lawyer-1',e.id,'complete');
    assert.equal((await db.purgeClosedContacts(90)).removed,0);
    await admin.query(`UPDATE engagements SET closed_at=now()-interval '91 days'`);
    assert.equal((await db.purgeClosedContacts(90)).removed,1);
    const row=(await admin.query('SELECT client_name,client_contact,client_contact_removed_at FROM engagements')).rows[0];
    assert.equal(row.client_contact,null);assert.ok(row.client_contact_removed_at);assert.equal(row.client_name,'Test Client');
    assert.equal((await db.myEngagements('lawyer-1'))[0].client_contact,null);

    // Requests: one open request per kind; strangers have none.
    const r=await db.createDataRequest('client-1','erasure');
    assert.equal(r.status,'received');
    await assert.rejects(db.createDataRequest('client-1','erasure'),code(409));
    assert.equal((await db.createDataRequest('client-1','correction')).kind,'correction');
    assert.equal((await db.myDataRequests('client-1')).length,2);
    assert.deepEqual(await db.myDataRequests('nobody'),[]);

    // Operator erasure of the client: their details go, the lawyer's invoice stays.
    const clientId=(await admin.query(`SELECT id FROM app_users WHERE oidc_subject='client-1'`)).rows[0].id;
    await admin.query('SELECT lexflow_erase_user($1)',[clientId]);
    const erased=(await admin.query('SELECT client_name,client_contact FROM engagements')).rows[0];
    assert.equal(erased.client_name,'[erased]');assert.equal(erased.client_contact,null);
    assert.equal((await admin.query(`SELECT count(*)::int n FROM app_users WHERE oidc_subject='client-1'`)).rows[0].n,0);
    assert.equal((await admin.query(`SELECT status FROM data_requests WHERE kind='erasure'`)).rows[0].status,'completed');
    assert.equal((await admin.query('SELECT count(*)::int n FROM invoices')).rows[0].n,1);
    await assert.rejects(db.myEngagements('client-1').then(x=>{if(x.length===0)throw Object.assign(Error('gone'),{statusCode:404});}),code(404));
    await assert.rejects(admin.query('SELECT lexflow_erase_user($1)',[clientId]));

    // Operator erasure of the lawyer: unlisted, name and bank details gone everywhere.
    const lawyerId=(await admin.query(`SELECT id FROM app_users WHERE oidc_subject='lawyer-1'`)).rows[0].id;
    await admin.query('SELECT lexflow_erase_user($1)',[lawyerId]);
    const la=(await admin.query('SELECT full_name,published,status FROM lawyer_applications')).rows[0];
    assert.deepEqual([la.full_name,la.published,la.status],['[erased]',false,'suspended']);
    assert.equal((await admin.query('SELECT count(*)::int n FROM lawyer_payment_details')).rows[0].n,0);
    const inv=(await admin.query('SELECT pay_account_name,pay_account_number_enc,pay_bank_name FROM invoices')).rows[0];
    assert.deepEqual([inv.pay_account_name,inv.pay_account_number_enc,inv.pay_bank_name],['[erased]',null,null]);
    assert.equal((await admin.query(`SELECT count(*)::int n FROM verification_reviews WHERE source_reference<>'[erased]'`)).rows[0].n,0);
    assert.equal((await db.listPublic({state:null,practice:null,language:null,limit:20,offset:0})).profiles.length,0);
    assert.equal((await admin.query(`SELECT count(*)::int n FROM audit_events WHERE action='data_subject_erasure'`)).rows[0].n,2);
    // The API's own login must not be able to erase people.
    assert.equal((await admin.query(`SELECT has_function_privilege('public','lexflow_erase_user(uuid)','EXECUTE') p`)).rows[0].p,false);

    // Legacy clear-text rows are converted by the operator script, then forbidden.
    await admin.query('TRUNCATE data_requests,invoices,engagements,payment_detail_reviews,lawyer_payment_details,audit_events,verification_reviews,lawyer_applications,app_users RESTART IDENTITY CASCADE');
    const b=await db.apply('lawyer-2',profile);
    await admin.query(`INSERT INTO lawyer_payment_details(application_id,method,account_name,bank_name,account_number) VALUES ($1,'bank_transfer','Ada Nwosu','Example Bank','1111111111')`,[b.id]);
    const done=await encryptExisting(admin,makeAccountCipher(key));
    assert.equal(done.payment_details,1);
    const conv=(await admin.query('SELECT account_number,account_number_enc,account_last4 FROM lawyer_payment_details')).rows[0];
    assert.equal(conv.account_number,null);assert.equal(conv.account_last4,'1111');
    assert.equal(makeAccountCipher(key).decrypt(conv.account_number_enc),'1111111111');
    await assert.rejects(admin.query(`UPDATE lawyer_payment_details SET account_number='2222222222'`));
    assert.equal((await encryptExisting(admin,makeAccountCipher(key))).payment_details,0);
  }finally{
    await admin.query('ALTER TABLE lawyer_payment_details DROP CONSTRAINT IF EXISTS no_clear_account_number').catch(()=>{});
    await admin.query('ALTER TABLE invoices DROP CONSTRAINT IF EXISTS no_clear_pay_account_number').catch(()=>{});
    await db.close();await noKey.close();await admin.end();
  }
});
