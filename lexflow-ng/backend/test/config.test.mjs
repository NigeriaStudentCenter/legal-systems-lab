import test from 'node:test';
import assert from 'node:assert/strict';
import {readConfig} from '../src/config.mjs';
const env={
  NODE_ENV:'production',PORT:'8080',HOST:'127.0.0.1',
  DATABASE_URL:'postgresql://api:not-a-real-password@db.internal:5432/lexflow',
  DATABASE_SSL:'true',
  OIDC_ISSUER:'https://id.example.ng/',
  OIDC_AUDIENCE:'lexflow-api',
  OIDC_JWKS_URI:'https://id.example.ng/.well-known/jwks.json',
  ALLOWED_ORIGINS:'https://nigeriastudentcenter.github.io',
  ENABLE_APPLICATIONS:'false',ENABLE_VERIFICATION:'false',
  ENABLE_PUBLICATION:'false',ENABLE_DIRECTORY:'false'
};
test('safe feature gates default off',()=>{
  const x=readConfig(env);assert.equal(x.production,true);
  assert.equal(x.gates.directory,false);assert.equal(x.gates.applications,false);
  assert.equal(x.allowedOrigins[0],'https://nigeriastudentcenter.github.io');
});
test('production refuses insecure provider and DB configuration',()=>{
  assert.throws(()=>readConfig({...env,DATABASE_SSL:'false'}));
  assert.throws(()=>readConfig({...env,OIDC_ISSUER:'http://id.example.ng/'}));
  assert.throws(()=>readConfig({...env,ALLOWED_ORIGINS:'*'}));
  assert.throws(()=>readConfig({...env,ALLOWED_ORIGINS:'http://localhost:5173'}));
  assert.throws(()=>readConfig({...env,ENABLE_PUBLICATION:'yes'}));
  assert.throws(()=>readConfig({...env,OIDC_AUDIENCE:''}));
});
