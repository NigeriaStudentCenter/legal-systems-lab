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
const TENANT="22222222-2222-4222-8222-222222222222",PORTAL_APP="33333333-3333-4333-8333-333333333333";
const ids={learner:"learner-0001",other:"learner-0002",faculty:"faculty-0001",faculty2:"faculty-0002",admin:"admin-0001",
  running:randomUUID(),hidden:randomUUID(),approval:randomUUID()};
const certRef="LF-"+randomUUID();
let tmp,proxy,jwksServer,child,privateKey,otherKey,db,runtime,logs="";

const listen=server=>new Promise(r=>server.listen(0,"127.0.0.1",()=>r(server.address().port)));
const token=(sub,{key=privateKey,aud=AUDIENCE,iss=ISSUER,name="Test "+sub,scp="access_as_user",tid=TENANT,azp=PORTAL_APP}={})=>
  new SignJWT({oid:sub,...(name?{name}:{}),...(scp?{scp}:{}),tid,azp}).setProtectedHeader({alg:"RS256",kid:"test"}).setIssuer(iss).setAudience(aud)
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
  await db.query(readFileSync(join(here,"..","sql","002_review_assessment_certificates.sql"),"utf8"));
  await db.query(readFileSync(join(here,"..","sql","003_capstone_assessment.sql"),"utf8"));
  // The grants an operator applies, exactly as listed in sql/README.md.
  await db.query(`REVOKE CREATE ON SCHEMA public FROM PUBLIC; GRANT USAGE ON SCHEMA public TO ${ROLE};
    GRANT SELECT, INSERT, UPDATE ON TABLE cpd_users, cpd_course_sessions, cpd_session_faculty, cpd_enrolments,
      cpd_attendance_events, cpd_course_approvals, cpd_certificates, cpd_audit_events,
      cpd_attendance_reviews, cpd_assessment_submissions, cpd_assessment_decisions, cpd_tutor_usage,
      cpd_capstone_submissions, cpd_capstone_decisions TO ${ROLE}`);
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
    PUBLIC_WEB_ORIGIN:ORIGIN,ALLOW_SELF_REGISTRATION:"true",RATE_LIMIT_PER_MINUTE:"1000",ENTRA_TENANT_ID:TENANT,ALLOWED_CLIENT_IDS:PORTAL_APP,AZURE_OPENAI_ENDPOINT:"",AZURE_OPENAI_DEPLOYMENT:""}});
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
  assert.equal((await call("GET","/api/me",{as:"raw:"+await token(ids.learner,{scp:null})})).status,401,"app-only token with no delegated permission");
  assert.equal((await call("GET","/api/me",{as:"raw:"+await token(ids.learner,{scp:"User.Read"})})).status,401,"other permission");
  assert.equal((await call("GET","/api/me",{as:"raw:"+await token(ids.learner,{tid:"44444444-4444-4444-8444-444444444444"})})).status,401,"other tenant");
  assert.equal((await call("GET","/api/me",{as:"raw:"+await token(ids.learner,{azp:"55555555-5555-4555-8555-555555555555"})})).status,401,"unapproved app");
  assert.equal((await call("GET","/api/me",{as:"raw:"+await token(ids.learner,{scp:"openid access_as_user"})})).status,200,"permission among several");
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
  assert.equal((await call("POST","/api/attendance/attest",{as:ids.admin,body})).status,403,"admins review attestations, they cannot make them");
  assert.equal((await call("POST","/api/attendance/attest",{as:ids.faculty,body:{...body,evidence:""}})).status,400);
  const ok=await call("POST","/api/attendance/attest",{as:ids.faculty,body});
  assert.equal(ok.status,201);assert.equal(ok.json.status,"pending-compliance-review");assert.equal(ok.json.cpdCredits,0);
});

test("certificates: admin-only issuing, one per session, verification by reference",async()=>{
  const issue={learnerId:ids.learner,sessionId:ids.running};
  assert.equal((await call("POST","/api/certificates/issue",{as:ids.learner,body:issue})).status,403);
  assert.equal((await call("POST","/api/certificates/issue",{as:ids.faculty,body:issue})).status,403);
  const again=await call("POST","/api/certificates/issue",{as:ids.admin,body:issue});
  assert.equal(again.status,409);assert.match(again.json.error,/already issued/);
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

test("self-registration makes a learner only, once, and never revives an inactive account",async()=>{
  assert.equal((await call("POST","/api/register")).status,401);
  const first=await call("POST","/api/register",{as:"newcomer-0001"});
  assert.equal(first.status,201);assert.deepEqual(first.json,{id:"newcomer-0001",role:"learner"});
  assert.equal((await call("POST","/api/register",{as:"newcomer-0001"})).status,200,"repeat is harmless");
  assert.equal((await call("POST","/api/register",{as:ids.other})).status,403,"inactive account stays out");
  const admin=await call("POST","/api/register",{as:ids.admin});
  assert.equal(admin.json.role,"admin","an existing role is reported, never changed");
  assert.equal((await call("GET","/api/me",{as:"newcomer-0001"})).status,200);
  const audit=await db.query("SELECT count(*)::int n FROM cpd_audit_events WHERE action='self-registered'");
  assert.equal(audit.rows[0].n,1);
});

test("a learner can enrol in an open public session, and sees only their own record",async()=>{
  assert.equal((await call("POST","/api/enrolments",{as:"newcomer-0001",body:{sessionId:ids.hidden}})).status,409,"non-public session");
  assert.equal((await call("POST","/api/enrolments",{as:ids.faculty,body:{sessionId:ids.running}})).status,403);
  const made=await call("POST","/api/enrolments",{as:"newcomer-0001",body:{sessionId:ids.running}});
  assert.equal(made.status,201);assert.equal(made.json.status,"enrolled");
  assert.equal((await call("POST","/api/enrolments",{as:"newcomer-0001",body:{sessionId:ids.running}})).status,200);
  const mine=await call("GET","/api/me/record",{as:"newcomer-0001"});
  assert.equal(mine.status,200);assert.equal(mine.json.enrolments.length,1);
  assert.equal(mine.json.attendance.length,0);assert.equal(mine.json.certificates.length,0);assert.equal(mine.json.nbaCredits,0);
  const first=await call("GET","/api/me/record",{as:ids.learner});
  assert.equal(first.json.attendance.length,2);assert.equal(first.json.certificates.length,1);
  assert.equal(JSON.stringify(first.json).includes("newcomer"),false);
  assert.equal(JSON.stringify(first.json).includes("Fictional register entry"),false,"faculty evidence is not shown to the learner");
});

/* ---------- Faculty review, assessment, certificates (migration 002) ---------- */
const newcomer="newcomer-0001";

test("assessment: learner submits, the assigned faculty member marks it",async()=>{
  const sid=ids.running;
  assert.equal((await call("POST","/api/assessments",{as:newcomer,body:{sessionId:sid,response:"too short"}})).status,400);
  assert.equal((await call("POST","/api/assessments",{as:newcomer,body:{sessionId:sid,response:"I would paste the client file into the tool and check it"}})).status,400,"confidential wording refused");
  assert.equal((await call("POST","/api/assessments",{as:ids.faculty,body:{sessionId:sid,response:"x".repeat(30)}})).status,403);
  const first=await call("POST","/api/assessments",{as:newcomer,body:{sessionId:sid,response:"Verify every citation against the law reports and remove the invented case."}});
  assert.equal(first.status,201);
  assert.equal((await call("POST","/api/assessments",{as:newcomer,body:{sessionId:sid,response:"A second answer while the first is still pending."}})).status,409);

  const mine=await call("GET","/api/faculty/sessions",{as:ids.faculty});
  assert.equal(mine.status,200);
  const s=mine.json.sessions.find(x=>x.id===sid);
  assert.ok(s.learners.some(l=>l.learner_id===newcomer&&l.display_name==="Test "+newcomer));
  assert.deepEqual(s.pendingSubmissions.map(p=>p.id),[first.json.id]);
  assert.deepEqual((await call("GET","/api/faculty/sessions",{as:ids.faculty2})).json,{sessions:[]},"unassigned faculty see nothing");
  assert.equal((await call("GET","/api/faculty/sessions",{as:ids.admin})).status,403);

  const path="/api/assessments/"+first.json.id+"/decision";
  assert.equal((await call("POST",path,{as:ids.faculty2,body:{decision:"pass",score:9,feedback:"Good work"}})).status,404,"not assigned");
  assert.equal((await call("POST",path,{as:ids.admin,body:{decision:"pass",score:9,feedback:"Good work"}})).status,403);
  assert.equal((await call("POST",path,{as:ids.faculty,body:{decision:"pass",score:5,feedback:"Good work"}})).status,400,"below the pass mark");
  assert.equal((await call("POST",path,{as:ids.faculty,body:{decision:"fail",score:4.5,feedback:"Needs work"}})).status,400,"whole numbers only");
  const failed=await call("POST",path,{as:ids.faculty,body:{decision:"fail",score:4,feedback:"Explain the confidentiality steps."}});
  assert.equal(failed.status,201);
  assert.equal((await call("POST",path,{as:ids.faculty,body:{decision:"pass",score:9,feedback:"Changed my mind"}})).status,404,"a decision is final");

  let rec=(await call("GET","/api/me/record",{as:newcomer})).json;
  assert.equal(rec.assessments[0].status,"failed");assert.equal(rec.assessments[0].score,4);
  assert.equal(rec.assessments[0].feedback,"Explain the confidentiality steps.");
  assert.equal(rec.enrolments[0].assessment_verified,false);

  const second=await call("POST","/api/assessments",{as:newcomer,body:{sessionId:sid,response:"Verify citations, stop sharing client data with public tools, and record human approval."}});
  assert.equal(second.status,201,"resubmission allowed after a fail");
  assert.equal((await call("POST","/api/assessments/"+second.json.id+"/decision",{as:ids.faculty,body:{decision:"pass",score:8,feedback:"Clear and complete."}})).status,201);
  rec=(await call("GET","/api/me/record",{as:newcomer})).json;
  assert.equal(rec.enrolments[0].assessment_verified,true);
  assert.equal((await call("POST","/api/assessments",{as:newcomer,body:{sessionId:sid,response:"Trying to submit again after passing."}})).status,409);
  const audit=await db.query("SELECT count(*)::int n FROM cpd_audit_events WHERE action='assessment-decided'");
  assert.equal(audit.rows[0].n,2);
});

test("no certificate without independently approved attendance",async()=>{
  const r=await call("POST","/api/certificates/issue",{as:ids.admin,body:{learnerId:newcomer,sessionId:ids.running}});
  assert.equal(r.status,409);assert.match(r.json.error,/approved attendance/);
  const c=await call("GET","/api/admin/completions?sessionId="+ids.running,{as:ids.admin});
  const row=c.json.learners.find(l=>l.learner_id===newcomer);
  assert.equal(row.assessment_verified,true);assert.equal(row.approved_attendance,0);assert.equal(row.eligible,false);
});

let newcomerAttestation;
test("attendance review: an admin approves or rejects faculty evidence; self check-ins never qualify",async()=>{
  const att=await call("POST","/api/attendance/attest",{as:ids.faculty,body:{sessionId:ids.running,learnerId:newcomer,evidence:"Present for all five modules (fictional register)"}});
  assert.equal(att.status,201);newcomerAttestation=att.json.id;

  const list=await call("GET","/api/admin/attendance-reviews",{as:ids.admin});
  assert.equal(list.status,200);
  const item=list.json.pending.find(p=>p.id===newcomerAttestation);
  assert.equal(item.learner_name,"Test "+newcomer);assert.equal(item.faculty_name,"Test "+ids.faculty);
  assert.equal(item.evidence,"Present for all five modules (fictional register)");
  assert.equal((await call("GET","/api/admin/attendance-reviews",{as:ids.faculty})).status,403);

  const path="/api/attendance/"+newcomerAttestation+"/review";
  assert.equal((await call("POST",path,{as:ids.faculty,body:{decision:"approved"}})).status,403,"faculty cannot approve");
  assert.equal((await call("POST",path,{as:newcomer,body:{decision:"approved"}})).status,403);
  assert.equal((await call("POST",path,{as:ids.admin,body:{decision:"rejected"}})).status,400,"rejection needs a reason");
  const ok=await call("POST",path,{as:ids.admin,body:{decision:"approved"}});
  assert.equal(ok.status,201);assert.equal(ok.json.status,"approved");
  assert.equal((await call("POST",path,{as:ids.admin,body:{decision:"rejected",reason:"second thoughts"}})).status,404,"a review is final");

  const checkin=await db.query("SELECT id FROM cpd_attendance_events WHERE event_type='self-checkin' LIMIT 1");
  assert.equal((await call("POST","/api/attendance/"+checkin.rows[0].id+"/review",{as:ids.admin,body:{decision:"approved"}})).status,404,"a self check-in cannot be approved");

  const other=(await call("GET","/api/admin/attendance-reviews",{as:ids.admin})).json.pending[0];
  const rej=await call("POST","/api/attendance/"+other.id+"/review",{as:ids.admin,body:{decision:"rejected",reason:"Register page illegible"}});
  assert.equal(rej.status,201);assert.equal(rej.json.status,"rejected");
  const stored=await db.query("SELECT reviewer_id,attested_by,decision,reason FROM cpd_attendance_reviews WHERE attendance_id=$1",[other.id]);
  assert.deepEqual(stored.rows[0],{reviewer_id:ids.admin,attested_by:ids.faculty,decision:"rejected",reason:"Register page illegible"});
});

let issuedRef;
test("certificate is issued once completion is approved, and can be verified and revoked",async()=>{
  const c=await call("GET","/api/admin/completions?sessionId="+ids.running,{as:ids.admin});
  assert.equal(c.json.learners.find(l=>l.learner_id===newcomer).eligible,true);

  const r=await call("POST","/api/certificates/issue",{as:ids.admin,body:{learnerId:newcomer,sessionId:ids.running}});
  assert.equal(r.status,201);assert.match(r.json.reference,/^LF-[a-f0-9-]{36}$/);
  assert.equal(r.json.learnerName,"Test "+newcomer);assert.equal(r.json.nbaCredits,0,"no approved course, no credits");
  issuedRef=r.json.reference;
  assert.equal((await call("POST","/api/certificates/issue",{as:ids.admin,body:{learnerId:newcomer,sessionId:ids.running}})).status,409);

  const rec=(await call("GET","/api/me/record",{as:newcomer})).json;
  assert.equal(rec.enrolments[0].status,"completed");
  assert.equal(rec.certificates[0].reference,issuedRef);assert.equal(rec.nbaCredits,0);

  const v=await call("POST","/api/certificates/verify",{body:{reference:issuedRef}});
  assert.equal(v.json.valid,true);assert.equal(v.json.learnerName,"Test "+newcomer);assert.equal(Number(v.json.nbaCredits),0);
  assert.equal(Object.values(v.json).includes(newcomer),false,"the account ID is not revealed");

  assert.equal((await call("POST","/api/certificates/revoke",{as:ids.admin,body:{reference:issuedRef}})).status,400,"reason required");
  assert.equal((await call("POST","/api/certificates/revoke",{as:ids.faculty,body:{reference:issuedRef,reason:"x"}})).status,403);
  const rv=await call("POST","/api/certificates/revoke",{as:ids.admin,body:{reference:issuedRef,reason:"Issued in error (test)"}});
  assert.equal(rv.status,200);
  const after=await call("POST","/api/certificates/verify",{body:{reference:issuedRef}});
  assert.equal(after.json.valid,false);assert.equal(after.json.revoked,true);
  assert.equal((await call("POST","/api/certificates/revoke",{as:ids.admin,body:{reference:issuedRef,reason:"again"}})).status,404);
  const actions=await db.query("SELECT action FROM cpd_audit_events WHERE action LIKE 'certificate-%' ORDER BY recorded_at");
  assert.deepEqual(actions.rows.map(a=>a.action),["certificate-issued","certificate-revoked"]);
});

test("credits come only from an approved, in-date course approval",async()=>{
  const session=randomUUID(),learner="learner-0003";
  await db.query("INSERT INTO cpd_course_approvals(id,course_version,status,credits,verified_by,authority_reference,valid_until) VALUES($1,'v1','approved',2,'operator','NBA-ICLE-TEST-001',current_date+30)",[ids.approval]);
  await db.query("INSERT INTO cpd_course_sessions(id,course,course_version,starts_at,ends_at,status,public,approval_id) VALUES($1,'Approved course (fictional)','v1',now()-interval '1 day',now()+interval '1 day','running',false,$2)",[session,ids.approval]);
  await db.query("INSERT INTO cpd_users(id,role,display_name) VALUES($1,'learner','Learner Three')",[learner]);
  await db.query("INSERT INTO cpd_session_faculty(session_id,faculty_id) VALUES($1,$2)",[session,ids.faculty]);
  await db.query("INSERT INTO cpd_enrolments(session_id,learner_id,assessment_verified) VALUES($1,$2,true)",[session,learner]);
  const att=await call("POST","/api/attendance/attest",{as:ids.faculty,body:{sessionId:session,learnerId:learner,evidence:"Fictional register"}});
  await call("POST","/api/attendance/"+att.json.id+"/review",{as:ids.admin,body:{decision:"approved"}});
  const r=await call("POST","/api/certificates/issue",{as:ids.admin,body:{learnerId:learner,sessionId:session}});
  assert.equal(r.status,201);assert.equal(r.json.nbaCredits,2);
  assert.equal((await call("GET","/api/me/record",{as:learner})).json.nbaCredits,2);
});

test("database rules for migration 002 hold even if the API is bypassed",async()=>{
  const checkin=await db.query("SELECT id FROM cpd_attendance_events WHERE event_type='self-checkin' LIMIT 1");
  await assert.rejects(db.query("UPDATE cpd_attendance_events SET status='approved' WHERE id=$1",[checkin.rows[0].id]),/self_checkin_never_verified/);
  const att=await call("POST","/api/attendance/attest",{as:ids.faculty,body:{sessionId:ids.running,learnerId:newcomer,evidence:"Fictional"}});
  await assert.rejects(db.query("INSERT INTO cpd_attendance_reviews(attendance_id,attested_by,reviewer_id,decision) VALUES($1,$2,$2,'approved')",[att.json.id,ids.faculty]),/reviewer_is_not_attester/);
  await assert.rejects(db.query("INSERT INTO cpd_attendance_reviews(attendance_id,attested_by,reviewer_id,decision) VALUES($1,$2,$3,'approved')",[att.json.id,ids.faculty2,ids.admin]),/foreign key/,"the attester must be the real one");
  await assert.rejects(db.query("INSERT INTO cpd_certificates(reference_hash,learner_id,session_id,course,issued_by,nba_credits) VALUES($1,$2,$3,'x',$4,3)",["f".repeat(64),ids.other,ids.running,ids.admin]),/credits_need_approval/);
  await assert.rejects(db.query("UPDATE cpd_certificates SET status='revoked' WHERE reference_hash=$1",[createHash("sha256").update(certRef).digest("hex")]),/revocation_complete/);
  const sub=await db.query("SELECT id FROM cpd_assessment_submissions LIMIT 1");
  await assert.rejects(db.query("INSERT INTO cpd_assessment_decisions(submission_id,faculty_id,decision,score,feedback) VALUES($1,$2,'pass',5,'x')",[sub.rows[0].id,ids.faculty]),/pass_needs_pass_mark|duplicate key/);
  await assert.rejects(runtime.query("DELETE FROM cpd_attendance_reviews"),/permission denied/);
  await assert.rejects(runtime.query("DELETE FROM cpd_certificates"),/permission denied/);
});


test("secure capstone: restricted learner submission, six-part faculty marking and no certificate side-effects",async()=>{
 const answers=Object.fromEntries(["scope","research","privacy","governance","evaluation","recommendation"].map(k=>[k,("Fictional evidence, verification and responsible review for "+k+". ").repeat(4)]));
 const marks={scope:11,research:15,privacy:16,governance:12,evaluation:10,recommendation:12};
 const sessionId=ids.running;
 assert.equal((await call("POST","/api/capstone/submissions",{body:{sessionId,answers}})).status,401);
 assert.equal((await call("POST","/api/capstone/submissions",{as:ids.faculty,body:{sessionId,answers}})).status,403);
 assert.equal((await call("POST","/api/capstone/submissions",{as:ids.learner,body:{sessionId,answers:{scope:"incomplete"}}})).status,400);
 const created=await call("POST","/api/capstone/submissions",{as:ids.learner,body:{sessionId,answers}});
 assert.equal(created.status,201);assert.equal(created.json.certificateEligible,false);
 const id=created.json.id;
 assert.equal((await call("POST","/api/capstone/submissions",{as:ids.learner,body:{sessionId,answers}})).status,409);
 const mine=await call("GET","/api/capstone/my",{as:ids.learner});
 assert.equal(mine.status,200);assert.equal(mine.json.submissions.find(x=>x.id===id).status,"submitted");
 assert.equal((await call("GET","/api/faculty/capstones",{as:ids.learner})).status,403);
 assert.equal((await call("GET","/api/faculty/capstones",{as:ids.admin})).status,403);
 const pending=await call("GET","/api/faculty/capstones",{as:ids.faculty});
 assert.equal(pending.status,200);assert.equal(pending.json.pending.find(x=>x.id===id).answers.scope,answers.scope.trim());
 const endpoint="/api/faculty/capstones/"+id+"/decision";
 assert.equal((await call("POST",endpoint,{as:ids.admin,body:{decision:"pass",marks,feedback:"Good fictional analysis and careful controls."}})).status,403);
 assert.equal((await call("POST",endpoint,{as:ids.faculty2,body:{decision:"pass",marks,feedback:"Good fictional analysis and careful controls."}})).status,404,"only assigned faculty can decide");
 assert.equal((await call("POST",endpoint,{as:ids.faculty,body:{decision:"pass",marks:{...marks,research:21},feedback:"Good fictional analysis and careful controls."}})).status,400);
 const decided=await call("POST",endpoint,{as:ids.faculty,body:{decision:"pass",marks,feedback:"Good fictional analysis and careful controls."}});
 assert.equal(decided.status,200);assert.equal(decided.json.total,76);assert.equal(decided.json.certificateEligible,false);
 assert.equal((await call("POST",endpoint,{as:ids.faculty,body:{decision:"fail",marks,feedback:"Second change of mind not allowed."}})).status,404);
 const after=await call("GET","/api/capstone/my",{as:ids.learner});
 const outcome=after.json.submissions.find(x=>x.id===id);
 assert.equal(outcome.status,"passed");assert.equal(outcome.total,76);
 const legacy=(await call("GET","/api/me/record",{as:ids.learner})).json;
 assert.equal(legacy.enrolments[0].assessment_verified,false,"capstone cannot change original certificate qualification");
 assert.equal(legacy.certificates.length,0);
 await assert.rejects(runtime.query("DELETE FROM cpd_capstone_submissions"),/permission denied/);
 await assert.rejects(runtime.query("CREATE TABLE runtime_capstone_ddl_test (id integer)"),/permission denied/);
});
