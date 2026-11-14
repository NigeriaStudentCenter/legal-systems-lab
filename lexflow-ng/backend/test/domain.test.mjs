import test from 'node:test';
import assert from 'node:assert/strict';
import {parseApplication,parseFilters,parseReview,parsePublication,parseSuspension,reviewOutcome,states,InputError} from '../src/domain.mjs';
const application={
  full_name:'Ada Nwosu', state:'Lagos', city:'Ikeja', year_of_call:2020,
  practice_areas:['Property & tenancy'],languages:['English','Igbo'],
  summary:'Factual experience handling property documentation and tenancy work.',
  privacy_acknowledged:true,verification_authorised:true
};
test('all states and FCT are available once',()=>{
  assert.equal(states.length,37);assert.equal(new Set(states).size,37);
  assert.ok(states.includes('Federal Capital Territory'));
});
test('valid professional application parsed without unknown fields',()=>{
  assert.equal(parseApplication(application).state,'Lagos');
  assert.ok(Object.isFrozen(parseApplication(application)));
});
test('invalid location and profession claims blocked',()=>{
  assert.throws(()=>parseApplication({...application,state:'Atlantis'}),InputError);
  assert.throws(()=>parseApplication({...application,summary:'We guarantee 100% success in all cases for everyone.'}),InputError);
  assert.throws(()=>parseApplication({...application,privacy_acknowledged:false}),InputError);
  assert.throws(()=>parseApplication({...application,role:'publisher'}),InputError);
  assert.throws(()=>parseApplication({...application,year_of_call:'2020'}),InputError);
  assert.throws(()=>parseApplication({...application,practice_areas:['Employment','Employment']}),InputError);
});
test('search is strictly restricted and bounded',()=>{
  assert.deepEqual(parseFilters({}),{state:null,practice:null,language:null,limit:20,offset:0});
  assert.equal(parseFilters({page:'2',limit:'10'}).offset,10);
  assert.throws(()=>parseFilters({state:'unknown'}),InputError);
  assert.throws(()=>parseFilters({limit:'500'}),InputError);
  assert.throws(()=>parseFilters({search:'anything'}),InputError);
});
test('independent verification evidence must be current',()=>{
  const r=parseReview({decision:'approve',source:'nba_annual_list',reference:'NBA-REF-123',checked_on:'2026-11-01',valid_until:'2027-01-01'},new Date('2026-11-13T00:00:00Z'));
  assert.equal(r.source,'nba_annual_list');
  assert.throws(()=>parseReview({...r,valid_until:'2026-11-13'},new Date('2026-11-13T00:00:00Z')),InputError);
  assert.throws(()=>parseReview({...r,checked_on:'2026-12-01'},new Date('2026-11-13T00:00:00Z')),InputError);
  assert.throws(()=>parseReview({...r,reference:'https://fake.example/verify'},new Date('2026-11-13T00:00:00Z')),InputError);
  assert.equal(parseReview({decision:'reject',reason:'Credential could not be confirmed'}).decision,'reject');
});
test('two approvals, rejection overrides and publication is review-gated',()=>{
  assert.equal(reviewOutcome([]),'pending');
  assert.equal(reviewOutcome(['approve']),'pending');
  assert.equal(reviewOutcome(['approve','approve']),'verified');
  assert.equal(reviewOutcome(['approve','reject']),'rejected');
  assert.throws(()=>parsePublication({profile_reviewed:true,remuneration_reviewed:false}),InputError);
  assert.deepEqual(parsePublication({profile_reviewed:true,remuneration_reviewed:true}),{profile_reviewed:true,remuneration_reviewed:true});
  assert.throws(()=>parseSuspension({reason:'too short'}),InputError);
});
