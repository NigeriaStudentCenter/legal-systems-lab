/**
 * Black-box integration test for the CPD API against a real local PostgreSQL.
 * It runs server.mjs unchanged: the app insists on verified TLS to the database, so the
 * test puts a small TLS-terminating proxy with a throwaway certificate in front of the
 * local server, and serves a throwaway signing key in place of Microsoft Entra.
 * Needs: local PostgreSQL (TEST_ADMIN_URL, default postgresql://localhost:5432/postgres),
 * openssl, and port 8080 free. Fictional data only.
 */
import {test,before,after} from "node:test";
import assert from "node:assert/strict";
import {spawn,execFileSync} from "node:child_process";
import {mkdtempSync,readFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {createHash,randomUUID} from "node:crypto";
import net from "node:net";
import tls from "node:tls";
import http from "node:http";
import pg from "pg";
import {generateKeyPair,exportJWK,SignJWT} from "jose";

const here=dirname(fileURLToPath(import.meta.url));
const adminUrl=process.env.TEST_ADMIN_URL||"postgresql://localhost:5432/postgres";
const DB="lexflow_cpd_test",ROLE="lexflow_cpd_test_runtime",PW="local-test-only";
const ISSUER="https://issuer.test/v2.0",AUDIENCE="11111111-1111-4111-8111-111111111111";
const ORIGIN="https://legal.bsoedu.org",API="http://127.0.0.1:8080";
const ids={learner:"learner-0001",other:"learner-0002",faculty:"faculty-0001",faculty2:"faculty-0002",admin:"admin-0001",
  running:randomUUID(),hidden:randomUUID(),approval:randomUUID()};
const certRef="LF-"+randomUUID();
let tmp,proxy,jwksServer,child,privateKey,otherKey,db,runtime,logs="";

const listen=server=>new Promise(r=>server.listen(0,"127.0.0.1",()=>r(server.address().port)));
const token=(sub,{key=privateKey,aud=AUDIENCE,iss=ISSUER}={})=>
  new SignJWT({oid:sub}).setProtectedHeader({alg:"RS256",kid:"test"}).setIssuer(iss).setAudience(aud)
    .setIssuedAt().setExpirationTime("5m").sign(key);
async function call(method,path,{as,body,headers={}}={}){
  const h={...headers};
  if(as)h.Authorization="Bearer "+(as.startsWith("raw:")?as.slice(4):await token(as));
  if(body)h["Content-Type"]="application/json";
  const res=await fetch(API+path,{method,headers:h,body:body?JSON.stringify(body):undefined});
  let json=null;try{json=await res.json()}catch{}
  return {status:res.status,json,headers:res.headers};
}

before(async()=>{
  tmp=mkdtempSync(join(tmpdir(),"cpd-test-"));
  execFileSync("openssl",["req","-x509","-newkey","rsa:2048","-nodes","-days","1","-subj","/CN=localhost",
    "-addext","subjectAltName=DNS:localhost","-keyout",join(tmp,"key.pem"),"-out",join(tmp,"cert.pem")],{stdio:"ignore"});

  const admin=new pg.Client({connectionString:adminUrl});await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${DB} WITH (FORCE)`);
  await admin.query(`DROP ROLE IF EXISTS ${ROLE}`);
  await admin.query(`CREATE DATABASE ${DB}`);
  await admin.query(`CREATE ROLE ${ROLE} LOGIN PASSWORD '${PW}'`);
  await admin.query(`REVOKE CONNECT ON DATABASE ${DB} FROM PUBLIC`);
  await admin.query(`GRANT CONNECT ON DATABASE ${DB} TO ${ROLE}`);
  await admin.end();

  const u=new URL(adminUrl);u.pathname="/"+DB;
  db=new pg.Client({connectionString:u.href});await db.connect();
  await db.query(readFileSync(join(here,"..","sql","001_initial.sql"),"utf8"));
  await db.query(`REVOKE CREATE ON SCHEMA public FROM PUBLIC; GRANT USAGE ON SCHEMA public TO ${ROLE};
    GRANT SELECT, INSERT, UPDATE ON TABLE cpd_users, cpd_course_sessions, cpd_session_faculty, cpd_enrolments,
      cpd_attendance_events, cpd_course_approvals, cpd_certificates, cpd_audit_events TO ${ROLE}`);
  await db.query(`INSERT INTO cpd_users(id,role,active) VALUES
    ($1,'learner',true),($2,'learner',false),($3,'faculty',true),($4,'faculty',true),($5,'admin',true)`,
    [ids.learner,ids.other,ids.faculty,ids.faculty2,ids.admin]);
  await db.query(`INSERT INTO cpd_course_sessions(id,course,course_version,starts_at,ends_at,status,public) VALUES
    ($1,'AI literacy (fictional)','v1',now()-interval '1 hour',now()+interval '1 hour','running',true),
    ($2,'Hidden draft (fictional)','v1',now()+interval '1 day',now()+interval '2 days','planned',false)`,[ids.running,ids.hidden]);
  await db.query("INSERT INTO cpd_session_faculty(session_id,faculty_id) VALUES($1,$2)",[ids.running,ids.faculty]);
  await db.query("INSERT INTO cpd_certificates(reference_hash,learner_id,session_id,course,issued_by) VALUES($1,$2,$3,'AI literacy (fictional)',$4)",
    [createHash("sha256").update(certRef).digest("hex"),ids.learner,ids.running,ids.admin]);

  // PostgreSQL TLS: client sends an 8-byte SSLRequest, server answers 'S', then TLS begins.
  const ctx=tls.createSecureContext({key:readFileSync(join(tmp,"key.pem")),cert:readFileSync(join(tmp,"cert.pem"))});
  proxy=net.createServer(sock=>{
    sock.once("data",first=>{
      if(first.length!==8||first.readUInt32BE(4)!==80877103){sock.destroy();return}
      sock.write("S");
      const secure=new tls.TLSSocket(sock,{isServer:true,secureContext:ctx});
      const up=net.connect(Number(u.port||5432),u.hostname);
      secure.pipe(up);up.pipe(secure);
      const close=()=>{secure.destroy();up.destroy()};
      secure.on("error",close);up.on("error",close);secure.on("close",close);up.on("close",close);
    });
    sock.on("error",()=>{});
  });
  const proxyPort=await listen(proxy);

  ({privateKey:otherKey}=await generateKeyPair("RS256"));
  const kp=await generateKeyPair("RS256");privateKey=kp.privateKey;
  const jwk={...(await exportJWK(kp.publicKey)),kid:"test",alg:"RS256",use:"sig"};
  jwksServer=http.createServer((req,res)=>{res.setHeader("Content-Type","application/json");res.end(JSON.stringify({keys:[jwk]}))});
  const jwksPort=await listen(jwksServer);

  const runtimeUrl=`postgresql://${ROLE}:${PW}@localhost:${proxyPort}/${DB}`;
  child=spawn(process.execPath,[join(here,"..","server.mjs")],{env:{...process.env,
    DATABASE_URL:runtimeUrl,DATABASE_SSL:"true",NODE_EXTRA_CA_CERTS:join(tmp,"cert.pem"),
    ENTRA_ISSUER:ISSUER,ENTRA_AUDIENCE:AUDIENCE,ENTRA_JWKS_URI:`http://127.0.0.1:${jwksPort}/keys`,
    PUBLIC_WEB_ORIGIN:ORIGIN,AZURE_OPENAI_ENDPOINT:"",AZURE_OPENAI_DEPLOYMENT:""}});
  child.stdout.on("data",d=>logs+=d);child.stderr.on("data",d=>logs+=d);
  for(let i=0;i<50;i++){
    try{if((await fetch(API+"/healthz")).ok)break}catch{}
    await new Promise(r=>setTimeout(r,100));
    if(i===49)throw new Error("API did not start: "+logs);
  }
  runtime=new pg.Client({connectionString:runtimeUrl,ssl:{ca:readFileSync(join(tmp,"cert.pem"))}});
  await runtime.connect();
});

after(async()=>{
  child?.kill("SIGTERM");
  await runtime?.end().catch(()=>{});await db?.end().catch(()=>{});
  proxy?.close();jwksServer?.close();
  const admin=new pg.Client({connectionString:adminUrl});await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${DB} WITH (FORCE)`);await admin.query(`DROP ROLE IF EXISTS ${ROLE}`);
  await admin.end();
  if(tmp)rmSync(tmp,{recursive:true,force:true});
});

test("health and readiness over verified TLS as the restricted login",async()=>{
  assert.equal((await call("GET","/healthz")).status,200);
  const ready=await call("GET","/readyz");
  assert.equal(ready.status,200,logs);assert.equal(ready.json.status,"ready");
});

test("sign-in is enforced",async()=>{
  assert.equal((await call("GET","/api/me")).status,401);
  assert.equal((await call("GET","/api/me",{as:"raw:not-a-token"})).status,401);
  assert.equal((await call("GET","/api/me",{as:"raw:"+await token(ids.learner,{key:otherKey})})).status,401,"foreign signing key");
  assert.equal((await call("GET","/api/me",{as:"raw:"+await token(ids.learner,{aud:"another-api"})})).status,401,"wrong audience");
  assert.equal((await call("GET","/api/me",{as:"raw:"+await token(ids.learner,{iss:"https://evil.test/v2.0"})})).status,401,"wrong issuer");
});

test("only provisioned, active users get in, with the role from the database",async()=>{
  assert.equal((await call("GET","/api/me",{as:"nobody-0001"})).status,403);
  assert.equal((await call("GET","/api/me",{as:ids.other})).status,403,"inactive user");
  const me=await call("GET","/api/me",{as:ids.learner});
  assert.equal(me.status,200);assert.deepEqual(me.json,{id:ids.learner,role:"learner"});
});

test("sessions list shows public sessions only",async()=>{
  const r=await call("GET","/api/sessions",{as:ids.learner});
  assert.equal(r.status,200);
  assert.deepEqual(r.json.sessions.map(s=>s.id),[ids.running]);
});

test("self check-in needs an enrolment, is unverified and awards no credit",async()=>{
  assert.equal((await call("POST","/api/attendance/checkin",{as:ids.learner,body:{sessionId:"nope"}})).status,400);
  assert.equal((await call("POST","/api/attendance/checkin",{as:ids.learner,body:{sessionId:ids.running}})).status,409);
  await db.query("INSERT INTO cpd_enrolments(session_id,learner_id) VALUES($1,$2)",[ids.running,ids.learner]);
  const ok=await call("POST","/api/attendance/checkin",{as:ids.learner,body:{sessionId:ids.running}});
  assert.equal(ok.status,201);assert.equal(ok.json.status,"unverified");assert.equal(ok.json.cpdCredits,0);
  assert.equal((await call("POST","/api/attendance/checkin",{as:ids.faculty,body:{sessionId:ids.running}})).status,403,"faculty cannot self check-in");
  const audit=await db.query("SELECT actor_id FROM cpd_audit_events WHERE action='self-checkin' AND target=$1",[ok.json.id]);
  assert.equal(audit.rows[0]?.actor_id,ids.learner);
});

test("attendance attestation needs an assigned faculty member and stays pending review",async()=>{
  const body={sessionId:ids.running,learnerId:ids.learner,evidence:"Fictional register entry"};
  assert.equal((await call("POST","/api/attendance/attest",{as:ids.learner,body})).status,403);
  assert.equal((await call("POST","/api/attendance/attest",{as:ids.faculty2,body})).status,403,"faculty not assigned to the session");
  assert.equal((await call("POST","/api/attendance/attest",{as:ids.faculty,body:{...body,evidence:""}})).status,400);
  const ok=await call("POST","/api/attendance/attest",{as:ids.faculty,body});
  assert.equal(ok.status,201);assert.equal(ok.json.status,"pending-compliance-review");assert.equal(ok.json.cpdCredits,0);
});

test("certificates: issuing is switched off, verification is by reference only",async()=>{
  const issue={learnerId:ids.learner,sessionId:ids.running};
  assert.equal((await call("POST","/api/certificates/issue",{as:ids.learner,body:issue})).status,403);
  assert.equal((await call("POST","/api/certificates/issue",{as:ids.admin,body:issue})).status,501);
  assert.equal((await call("POST","/api/certificates/verify",{body:{reference:"bad"}})).status,400);
  assert.deepEqual((await call("POST","/api/certificates/verify",{body:{reference:"LF-"+randomUUID()}})).json,{valid:false});
  const v=await call("POST","/api/certificates/verify",{body:{reference:certRef}});
  assert.equal(v.json.valid,true);assert.equal(v.json.issuer,"BSOE");assert.equal(Number(v.json.nbaCredits),0);
  assert.equal(JSON.stringify(v.json).includes(ids.learner),false,"verification must not reveal the learner");
});

test("attendance report is admin-only, labelled as a draft, and audited",async()=>{
  const path="/api/reports/attendance?sessionId="+ids.running;
  assert.equal((await call("GET",path,{as:ids.faculty})).status,403);
  const r=await call("GET",path,{as:ids.admin});
  assert.equal(r.status,200);assert.equal(r.json.type,"DRAFT_INTERNAL_REVIEW_NOT_NBA_ICLE_SUBMISSION");
  assert.equal(r.json.records.length,1);
  const audit=await db.query("SELECT count(*)::int n FROM cpd_audit_events WHERE action='internal-export'");
  assert.equal(audit.rows[0].n,1);
});

test("AI tutor refuses confidential wording and is off when not configured",async()=>{
  assert.equal((await call("POST","/api/tutor",{body:{question:"hello"}})).status,401);
  assert.equal((await call("POST","/api/tutor",{as:ids.learner,body:{question:"review this client file"}})).status,400);
  assert.equal((await call("POST","/api/tutor",{as:ids.learner,body:{question:"What is a hallucinated citation?"}})).status,503);
});

test("cross-origin access is limited to the Academy site",async()=>{
  const good=await call("OPTIONS","/api/me",{headers:{Origin:ORIGIN}});
  assert.equal(good.status,204);assert.equal(good.headers.get("access-control-allow-origin"),ORIGIN);
  const bad=await call("OPTIONS","/api/me",{headers:{Origin:"https://evil.test"}});
  assert.equal(bad.status,403);assert.equal(bad.headers.get("access-control-allow-origin"),null);
  assert.equal((await call("GET","/nothing-here")).status,404);
});

test("the runtime login cannot delete rows or change the schema",async()=>{
  await assert.rejects(runtime.query("DELETE FROM cpd_audit_events"),/permission denied/);
  await assert.rejects(runtime.query("TRUNCATE cpd_audit_events"),/permission denied/);
  await assert.rejects(runtime.query("CREATE TABLE sneaky(id int)"),/permission denied/);
  await assert.rejects(runtime.query("DROP TABLE cpd_users"),/must be owner/);
  await assert.rejects(runtime.query("ALTER TABLE cpd_users ADD COLUMN x int"),/must be owner/);
});

test("database rules hold: credits need an approval reference, attestations need evidence",async()=>{
  await assert.rejects(db.query("INSERT INTO cpd_course_approvals(id,course_version,status,credits,verified_by) VALUES($1,'v1','approved',2,'x')",[randomUUID()]),/violates check/);
  await assert.rejects(db.query("INSERT INTO cpd_attendance_events(id,session_id,learner_id,event_type) VALUES($1,$2,$3,'faculty-attestation')",[randomUUID(),ids.running,ids.learner]),/violates check/);
});
