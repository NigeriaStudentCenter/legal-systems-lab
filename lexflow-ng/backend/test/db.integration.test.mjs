import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import pg from 'pg';
import {makeDb} from '../src/db.mjs';
import {InputError} from '../src/domain.mjs';

const url=process.env.TEST_DATABASE_URL;
const integration=url?test:test.skip;
integration('PostgreSQL enforces multi-party professional verification and delisting',async()=>{
  const adminPool=new pg.Pool({connectionString:url});
  const sql=await readFile(new URL('../sql/001_initial.sql',import.meta.url),'utf8');
  await adminPool.query(sql);
  await adminPool.query('TRUNCATE audit_events,verification_reviews,lawyer_applications,app_users RESTART IDENTITY CASCADE');
  const db=makeDb({databaseUrl:url,databaseSsl:false});
  const today=new Date().toISOString().slice(0,10);
  const expiry=new Date(Date.now()+60*86400000).toISOString().slice(0,10);
  const app={full_name:'Ada Nwosu',state:'Lagos',city:'Ikeja',year_of_call:2020,
    practice_areas:['Property & tenancy'],languages:['English'],
    summary:'Fictional training practice profile with no actual solicitor.',
    privacy_acknowledged:true,verification_authorised:true};
  try{
    await adminPool.query(`INSERT INTO app_users(oidc_subject,role)
      VALUES ('reviewer-1','reviewer'),('reviewer-2','reviewer'),('publisher-1','publisher'),('admin-1','compliance_admin')`);
    const submitted=await db.apply('applicant-1',app);
    assert.equal(submitted.status,'pending');
    await assert.rejects(db.apply('applicant-1',app),e=>e instanceof InputError&&e.statusCode===409);
    const empty=await db.listPublic({state:null,practice:null,language:null,limit:20,offset:0});
    assert.equal(empty.profiles.length,0);
    await assert.rejects(db.queue('applicant-1'),e=>e.statusCode===403);
    const review={decision:'approve',source:'nba_annual_list',reference:'MOCK-TRAINING-1',checked_on:today,valid_until:expiry};
    const one=await db.review('reviewer-1',submitted.id,review);
    assert.equal(one.status,'pending');
    await assert.rejects(db.review('reviewer-1',submitted.id,review),e=>e.statusCode===409);
    await assert.rejects(db.publish('publisher-1',submitted.id),e=>e.statusCode===409);
    const two=await db.review('reviewer-2',submitted.id,{...review,reference:'MOCK-TRAINING-2'});
    assert.equal(two.status,'verified');
    await assert.rejects(db.publish('reviewer-1',submitted.id),e=>e.statusCode===403);
    const published=await db.publish('publisher-1',submitted.id);
    assert.equal(published.published,true);
    const result=await db.listPublic({state:'Lagos',practice:'Property & tenancy',language:'English',limit:20,offset:0});
    assert.equal(result.profiles.length,1);
    assert.equal(result.profiles[0].full_name,'Ada Nwosu');
    assert.ok(!('source_reference' in result.profiles[0]));
    await db.suspend('admin-1',submitted.id,{reason:'Training simulation compliance suspension'});
    const hidden=await db.listPublic({state:null,practice:null,language:null,limit:20,offset:0});
    assert.equal(hidden.profiles.length,0);
    const aud=await adminPool.query('SELECT action FROM audit_events WHERE target_application_id=$1 ORDER BY id',[submitted.id]);
    assert.deepEqual(aud.rows.map(x=>x.action),[
      'application_submitted','verification_approved','verification_approved',
      'profile_published','profile_suspended'
    ]);
  } finally {
    await db.close();await adminPool.end();
  }
});
