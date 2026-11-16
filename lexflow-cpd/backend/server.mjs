/**
 * LexFlow CPD PostgreSQL API - Azure Container Apps / port 8080.
 * Schema is provisioned OUT OF BAND by an operator; runtime never executes DDL.
 * Production requires security review, actual faculty approvals and regulator agreement.
 *
 * Separation of duties:
 *   learner  - enrols, checks in (never verified), submits assessments
 *   faculty  - attests attendance and marks assessments, only for sessions they are assigned to
 *   admin    - reviews faculty attestations, issues and revokes certificates; cannot attest
 * A certificate needs a passed assessment AND a faculty attestation approved by someone else.
 */
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pg from "pg";
import {createRemoteJWKSet,jwtVerify} from "jose";
import {DefaultAzureCredential,getBearerTokenProvider} from "@azure/identity";
import {randomUUID,createHash} from "node:crypto";
import {resolveLesson,makeTutorMessages,COURSE_VERSION} from "./tutor-curriculum.mjs";
import {getCaseStage,makeCaseTutorMessages} from "./tutor-investigations.mjs";
import {CAPSTONE_VERSION,validateCapstoneAnswers,validateCapstoneMarks,isProvisionalPass} from "./capstone-policy.mjs";

const required=["DATABASE_URL","ENTRA_ISSUER","ENTRA_AUDIENCE","ENTRA_JWKS_URI"];
for(const key of required){if(!process.env[key]){console.error("Missing "+key);process.exit(1)}}
if(process.env.DATABASE_SSL!=="true"){console.error("DATABASE_SSL=true is required");process.exit(1)}
const pool=new pg.Pool({
  connectionString:process.env.DATABASE_URL,
  ssl:{rejectUnauthorized:true},
  max:10,connectionTimeoutMillis:4500,idleTimeoutMillis:30000,
  application_name:"lexflow-cpd-api"
});
pool.on("error",()=>console.error("Idle PostgreSQL connection error"));
const query=(sql,values=[])=>pool.query(sql,values);
async function tx(work){
  const client=await pool.connect();
  try{
    await client.query("BEGIN");
    const result=await work((sql,values=[])=>client.query(sql,values));
    await client.query("COMMIT");
    return result;
  }catch(e){await client.query("ROLLBACK").catch(()=>{});throw e}
  finally{client.release()}
}
const jwks=createRemoteJWKSet(new URL(process.env.ENTRA_JWKS_URI));
// Beyond signature, issuer, audience and expiry, a token must: be a delegated (user) token for
// the access_as_user permission, come from the expected tenant, and be held by an approved app.
const REQUIRED_SCOPE="access_as_user";
const TENANT_ID=process.env.ENTRA_TENANT_ID||"";
const CLIENT_IDS=(process.env.ALLOWED_CLIENT_IDS||"").split(",").map(s=>s.trim()).filter(Boolean);
if(process.env.NODE_ENV==="production"&&(!TENANT_ID||!CLIENT_IDS.length)){
  console.error("ENTRA_TENANT_ID and ALLOWED_CLIENT_IDS are required in production");process.exit(1)}
const credential=new DefaultAzureCredential();
const PASS_MARK=7; // Mirrors the database constraint pass_needs_pass_mark.
const TUTOR_PER_USER=Number(process.env.TUTOR_DAILY_PER_USER||20);
const TUTOR_TOTAL=Number(process.env.TUTOR_DAILY_TOTAL||150);
const app=express();app.disable("x-powered-by");
// One trusted hop: the Azure Container Apps ingress. Without this every caller shares the
// ingress address and therefore one rate-limit bucket.
app.set("trust proxy",1);
app.use(helmet());app.use(express.json({limit:"12kb"}));
app.use(rateLimit({windowMs:60000,limit:Number(process.env.RATE_LIMIT_PER_MINUTE||60),standardHeaders:"draft-7",legacyHeaders:false}));
app.use((req,res,next)=>{
  const allowed=process.env.PUBLIC_WEB_ORIGIN;
  if(req.headers.origin===allowed&&allowed){
    res.setHeader("Access-Control-Allow-Origin",allowed);
    res.setHeader("Vary","Origin");
    res.setHeader("Access-Control-Allow-Headers","Authorization,Content-Type");
    res.setHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS");
  }
  if(req.method==="OPTIONS")return res.sendStatus(req.headers.origin===allowed?204:403);
  next();
});
const error=(res,status,message)=>res.status(status).json({error:message});
const value=(s,max=2000)=>typeof s==="string"&&s.trim()&&s.length<=max?s.trim():null;
const text=(s,min,max)=>typeof s==="string"&&s.trim().length>=min&&s.length<=max?s.trim():null;
const hash=s=>createHash("sha256").update(s).digest("hex");
const isUUID=s=>typeof s==="string"&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(s);
const CONFIDENTIAL=/client file|passport|bank account|confidential attachment/i;
const audit=async(actor,action,target,details={},q=query)=>q(
  "INSERT INTO cpd_audit_events(id,actor_id,action,target,details) VALUES($1,$2,$3,$4,$5::jsonb)",
  [randomUUID(),actor,action,target,JSON.stringify(details)]
);
async function identify(req,res){
  const match=req.headers.authorization?.match(/^Bearer (.+)$/);
  if(!match){error(res,401,"Sign-in required");return null}
  let payload;
  try{
    ({payload}=await jwtVerify(match[1],jwks,{
      issuer:process.env.ENTRA_ISSUER,audience:process.env.ENTRA_AUDIENCE,algorithms:["RS256"]
    }));
  }catch{error(res,401,"Invalid access token");return null}
  const scopes=typeof payload.scp==="string"?payload.scp.split(" "):[];
  if(!scopes.includes(REQUIRED_SCOPE)){error(res,401,"Token lacks the required permission");return null}
  if(TENANT_ID&&payload.tid!==TENANT_ID){error(res,401,"Token from another tenant");return null}
  if(CLIENT_IDS.length&&!CLIENT_IDS.includes(payload.azp)){error(res,401,"Token issued to an unapproved app");return null}
  const id=payload.oid||payload.sub;
  if(!value(id,250)){error(res,401,"Invalid subject");return null}
  return {id,name:value(payload.name,120)};
}
async function auth(req,res,next){
  const who=await identify(req,res);
  if(!who)return;
  try{
    const user=await query("SELECT id,role,active,display_name FROM cpd_users WHERE id=$1",[who.id]);
    const row=user.rows[0];
    if(!row?.active)return error(res,403,"User not provisioned");
    // Keep the name current from the token; written only when it changes.
    if(who.name&&who.name!==row.display_name)
      await query("UPDATE cpd_users SET display_name=$2 WHERE id=$1",[who.id,who.name]);
    req.user={id:who.id,role:row.role};
    return next();
  }catch{return error(res,503,"Identity store unavailable")}
}
const allow=(...roles)=>(req,res,next)=>roles.includes(req.user.role)?next():error(res,403,"Insufficient permissions");
app.get("/healthz",(req,res)=>res.status(200).json({status:"alive"}));
app.get("/readyz",async(req,res)=>{
  try{
    await query("SELECT 1 FROM cpd_users LIMIT 1");
    return res.status(200).json({status:"ready"});
  }catch{return res.status(503).json({status:"unavailable"})}
});
app.get("/api/me",auth,(req,res)=>res.json(req.user));
// Self-registration creates a LEARNER record only, for someone Microsoft Entra has already
// authenticated. Off unless ALLOW_SELF_REGISTRATION=true. Faculty and admin roles are never
// granted here: an operator sets those in the database.
app.post("/api/register",async(req,res)=>{
  const who=await identify(req,res);
  if(!who)return;
  if(process.env.ALLOW_SELF_REGISTRATION!=="true")return error(res,403,"Self-registration is closed");
  try{
    const made=await query("INSERT INTO cpd_users(id,role,display_name) VALUES($1,'learner',$2) ON CONFLICT (id) DO NOTHING",[who.id,who.name]);
    const user=await query("SELECT id,role,active FROM cpd_users WHERE id=$1",[who.id]);
    if(!user.rows[0]?.active)return error(res,403,"Account is not active");
    if(made.rowCount)await audit(who.id,"self-registered",who.id,{});
    return res.status(made.rowCount?201:200).json({id:who.id,role:user.rows[0].role});
  }catch{return error(res,503,"Registration unavailable")}
});
app.post("/api/enrolments",auth,allow("learner"),async(req,res)=>{
  if(!isUUID(req.body?.sessionId))return error(res,400,"Valid sessionId required");
  try{
    const open=await query("SELECT 1 FROM cpd_course_sessions WHERE id=$1 AND public=true AND status IN ('planned','running') AND ends_at>now()",[req.body.sessionId]);
    if(!open.rowCount)return error(res,409,"Session is not open for enrolment");
    const made=await query("INSERT INTO cpd_enrolments(session_id,learner_id) VALUES($1,$2) ON CONFLICT (session_id,learner_id) DO NOTHING",[req.body.sessionId,req.user.id]);
    if(made.rowCount)await audit(req.user.id,"self-enrolled",req.body.sessionId,{});
    const row=await query("SELECT status FROM cpd_enrolments WHERE session_id=$1 AND learner_id=$2",[req.body.sessionId,req.user.id]);
    return res.status(made.rowCount?201:200).json({sessionId:req.body.sessionId,status:row.rows[0].status});
  }catch{return error(res,503,"Enrolment unavailable")}
});
// A learner's own record only. Credits come solely from an issued certificate row.
// Faculty evidence text and assessors' identities are not returned.
app.get("/api/me/record",auth,async(req,res)=>{
  try{
    const [enrolments,attendance,assessments,certificates]=await Promise.all([
      query("SELECT e.session_id,s.course,s.starts_at,s.ends_at,s.status AS session_status,e.status,e.assessment_verified FROM cpd_enrolments e JOIN cpd_course_sessions s ON s.id=e.session_id WHERE e.learner_id=$1 ORDER BY s.starts_at DESC LIMIT 200",[req.user.id]),
      query("SELECT id,session_id,event_type,status,occurred_at FROM cpd_attendance_events WHERE learner_id=$1 ORDER BY occurred_at DESC LIMIT 200",[req.user.id]),
      query("SELECT a.id,a.session_id,a.status,a.submitted_at,d.score,d.feedback,d.decided_at FROM cpd_assessment_submissions a LEFT JOIN cpd_assessment_decisions d ON d.submission_id=a.id WHERE a.learner_id=$1 ORDER BY a.submitted_at DESC LIMIT 200",[req.user.id]),
      query("SELECT session_id,course,reference,learner_name,issued_at,status,nba_credits,revoked_at FROM cpd_certificates WHERE learner_id=$1 ORDER BY issued_at DESC LIMIT 200",[req.user.id])
    ]);
    const credits=certificates.rows.filter(c=>c.status==="issued").reduce((n,c)=>n+Number(c.nba_credits),0);
    return res.json({enrolments:enrolments.rows,attendance:attendance.rows,assessments:assessments.rows,
      certificates:certificates.rows,nbaCredits:credits});
  }catch{return error(res,503,"Record unavailable")}
});
app.get("/api/sessions",auth,async(req,res)=>{
  try{
    const result=await query("SELECT id,course,starts_at,ends_at,status FROM cpd_course_sessions WHERE public=true ORDER BY starts_at DESC LIMIT 100");
    return res.json({sessions:result.rows});
  }catch{return error(res,503,"Sessions unavailable")}
});
app.post("/api/attendance/checkin",auth,allow("learner"),async(req,res)=>{
  if(!isUUID(req.body?.sessionId))return error(res,400,"Valid sessionId required");
  try{
    const enrolled=await query(
      "SELECT 1 FROM cpd_course_sessions s JOIN cpd_enrolments e ON e.session_id=s.id WHERE s.id=$1 AND e.learner_id=$2 AND e.status='enrolled' AND s.status='running' AND now() BETWEEN s.starts_at AND s.ends_at",
      [req.body.sessionId,req.user.id]);
    if(!enrolled.rowCount)return error(res,409,"No active enrolment/session");
    const id=randomUUID();
    await query("INSERT INTO cpd_attendance_events(id,session_id,learner_id,event_type,status) VALUES($1,$2,$3,'self-checkin','unverified')",
      [id,req.body.sessionId,req.user.id]);
    await audit(req.user.id,"self-checkin",id,{sessionId:req.body.sessionId});
    return res.status(201).json({id,status:"unverified",cpdCredits:0});
  }catch{return error(res,503,"Check-in unavailable")}
});

/* ---------- Faculty: attendance attestation and assessment marking ---------- */
app.get("/api/faculty/sessions",auth,allow("faculty"),async(req,res)=>{
  try{
    const sessions=await query(
      "SELECT s.id,s.course,s.starts_at,s.ends_at,s.status FROM cpd_session_faculty f JOIN cpd_course_sessions s ON s.id=f.session_id WHERE f.faculty_id=$1 ORDER BY s.starts_at DESC LIMIT 50",
      [req.user.id]);
    const ids=sessions.rows.map(s=>s.id);
    if(!ids.length)return res.json({sessions:[]});
    const [learners,submissions]=await Promise.all([
      query(`SELECT e.session_id,e.learner_id,u.display_name,e.status,e.assessment_verified,
          last.status AS attendance_status
        FROM cpd_enrolments e JOIN cpd_users u ON u.id=e.learner_id
        LEFT JOIN LATERAL (SELECT a.status FROM cpd_attendance_events a
          WHERE a.session_id=e.session_id AND a.learner_id=e.learner_id AND a.event_type='faculty-attestation'
          ORDER BY a.occurred_at DESC LIMIT 1) last ON true
        WHERE e.session_id=ANY($1::uuid[]) AND e.status<>'withdrawn'
        ORDER BY u.display_name NULLS LAST LIMIT 1000`,[ids]),
      query(`SELECT a.id,a.session_id,a.learner_id,u.display_name,a.response,a.submitted_at
        FROM cpd_assessment_submissions a JOIN cpd_users u ON u.id=a.learner_id
        WHERE a.session_id=ANY($1::uuid[]) AND a.status='submitted' ORDER BY a.submitted_at LIMIT 200`,[ids])
    ]);
    return res.json({sessions:sessions.rows.map(s=>({...s,
      learners:learners.rows.filter(l=>l.session_id===s.id),
      pendingSubmissions:submissions.rows.filter(x=>x.session_id===s.id)}))});
  }catch{return error(res,503,"Faculty sessions unavailable")}
});
// Participation evidence from an assigned faculty member. Admins cannot attest: they review.
app.post("/api/attendance/attest",auth,allow("faculty"),async(req,res)=>{
  const sessionId=req.body?.sessionId,learnerId=value(req.body?.learnerId,250),evidence=value(req.body?.evidence,2000);
  if(!isUUID(sessionId)||!learnerId||!evidence)return error(res,400,"Valid sessionId, learnerId and evidence required");
  try{
    const r=await query(
      "SELECT 1 FROM cpd_session_faculty f JOIN cpd_enrolments e ON e.session_id=f.session_id WHERE f.session_id=$1 AND f.faculty_id=$2 AND e.learner_id=$3 AND e.status IN ('enrolled','completed')",
      [sessionId,req.user.id,learnerId]);
    if(!r.rowCount)return error(res,403,"Faculty assignment and enrolment required");
    const id=randomUUID();
    await query("INSERT INTO cpd_attendance_events(id,session_id,learner_id,event_type,faculty_id,evidence,status) VALUES($1,$2,$3,'faculty-attestation',$4,$5,'pending-compliance-review')",
      [id,sessionId,learnerId,req.user.id,evidence]);
    await audit(req.user.id,"attestation-submitted",id,{sessionId,learnerId});
    return res.status(201).json({id,status:"pending-compliance-review",cpdCredits:0});
  }catch{return error(res,503,"Attestation unavailable")}
});
/* ---------- Separate human-marked 100-point capstone (NOT certificate eligibility) ---------- */
app.get("/api/capstone/my",auth,allow("learner"),async(req,res)=>{
  try{
    const rows=await query(`SELECT c.id,c.session_id,c.course_version,c.status,c.submitted_at,
      d.decision,d.marks,d.total,d.feedback,d.decided_at
      FROM cpd_capstone_submissions c
      LEFT JOIN cpd_capstone_decisions d ON d.submission_id=c.id
      WHERE c.learner_id=$1 ORDER BY c.submitted_at DESC LIMIT 50`,[req.user.id]);
    return res.json({submissions:rows.rows,certificateEligible:false});
  }catch{return error(res,503,"Capstone records unavailable")}
});
app.post("/api/capstone/submissions",auth,allow("learner"),async(req,res)=>{
  const sessionId=req.body?.sessionId,answers=validateCapstoneAnswers(req.body?.answers);
  if(!isUUID(sessionId)||!answers)return error(res,400,"Valid session and six bounded capstone answers required");
  if(Object.values(answers).some(x=>CONFIDENTIAL.test(x)))return error(res,400,"Do not submit client or confidential material");
  try{
    const e=await query("SELECT 1 FROM cpd_enrolments WHERE session_id=$1 AND learner_id=$2 AND status='enrolled'",[sessionId,req.user.id]);
    if(!e.rowCount)return error(res,409,"Active enrolment required");
    const id=randomUUID();
    await query("INSERT INTO cpd_capstone_submissions(id,session_id,learner_id,course_version,answers) VALUES($1,$2,$3,$4,$5::jsonb)",
      [id,sessionId,req.user.id,CAPSTONE_VERSION,JSON.stringify(answers)]);
    await audit(req.user.id,"capstone-submitted",id,{sessionId,courseVersion:CAPSTONE_VERSION});
    return res.status(201).json({id,status:"submitted",certificateEligible:false});
  }catch(e){
    if(e.code==="23505")return error(res,409,"A capstone is already awaiting faculty review");
    return error(res,503,"Capstone submission unavailable");
  }
});
app.get("/api/faculty/capstones",auth,allow("faculty"),async(req,res)=>{
  try{
    const rows=await query(`SELECT c.id,c.session_id,c.learner_id,c.course_version,c.answers,c.submitted_at,
      s.course,u.display_name
      FROM cpd_capstone_submissions c
      JOIN cpd_session_faculty f ON f.session_id=c.session_id AND f.faculty_id=$1
      JOIN cpd_course_sessions s ON s.id=c.session_id
      JOIN cpd_users u ON u.id=c.learner_id
      WHERE c.status='submitted' ORDER BY c.submitted_at LIMIT 100`,[req.user.id]);
    return res.json({pending:rows.rows});
  }catch{return error(res,503,"Faculty capstone queue unavailable")}
});
app.post("/api/faculty/capstones/:id/decision",auth,allow("faculty"),async(req,res)=>{
  const id=req.params.id,decision=req.body?.decision,feedback=text(req.body?.feedback,10,3000),
    computed=validateCapstoneMarks(req.body?.marks);
  if(!isUUID(id)||!["pass","fail","return"].includes(decision)||!feedback||!computed)
    return error(res,400,"Valid decision, six integer marks and detailed feedback required");
  if(decision==="pass"&&!isProvisionalPass(computed.marks))
    return error(res,400,"Proposed educational pass threshold not met");
  try{
    const result=await tx(async q=>{
      const found=await q(`SELECT c.id FROM cpd_capstone_submissions c
        JOIN cpd_session_faculty f ON f.session_id=c.session_id AND f.faculty_id=$2
        WHERE c.id=$1 AND c.status='submitted' FOR UPDATE OF c`,[id,req.user.id]);
      if(!found.rowCount)return false;
      await q(`INSERT INTO cpd_capstone_decisions(submission_id,faculty_id,decision,marks,total,feedback)
        VALUES($1,$2,$3,$4::jsonb,$5,$6)`,[id,req.user.id,decision,JSON.stringify(computed.marks),computed.total,feedback]);
      await q("UPDATE cpd_capstone_submissions SET status=$2,decided_at=now() WHERE id=$1",
        [id,decision==="return"?"returned":decision==="pass"?"passed":"failed"]);
      await audit(req.user.id,"capstone-decision",id,{decision,total:computed.total},q);
      return true;
    });
    if(!result)return error(res,404,"Pending assigned capstone not found");
    return res.json({decision,total:computed.total,certificateEligible:false,
      warning:"Human educational capstone decision is not connected to certificates or NBA-ICLE credit."});
  }catch{return error(res,503,"Capstone marking unavailable")}
});
app.post("/api/assessments",auth,allow("learner"),async(req,res)=>{
  const sessionId=req.body?.sessionId,response=text(req.body?.response,20,6000);
  if(!isUUID(sessionId)||!response)return error(res,400,"Valid sessionId and a response of 20 to 6000 characters required");
  if(CONFIDENTIAL.test(response))return error(res,400,"Do not submit confidential data");
  try{
    const e=await query("SELECT status,assessment_verified FROM cpd_enrolments WHERE session_id=$1 AND learner_id=$2",[sessionId,req.user.id]);
    if(!e.rowCount||e.rows[0].status!=="enrolled")return error(res,409,"Active enrolment required");
    if(e.rows[0].assessment_verified)return error(res,409,"Assessment already passed");
    const id=randomUUID();
    await query("INSERT INTO cpd_assessment_submissions(id,session_id,learner_id,response) VALUES($1,$2,$3,$4)",[id,sessionId,req.user.id,response]);
    await audit(req.user.id,"assessment-submitted",id,{sessionId});
    return res.status(201).json({id,status:"submitted"});
  }catch(e){
    if(e.code==="23505")return error(res,409,"A submission is already awaiting a decision");
    return error(res,503,"Submission unavailable");
  }
});
app.post("/api/assessments/:id/decision",auth,allow("faculty"),async(req,res)=>{
  const id=req.params.id,decision=req.body?.decision,score=req.body?.score,feedback=text(req.body?.feedback,5,2000);
  if(!isUUID(id)||!["pass","fail"].includes(decision)||!Number.isInteger(score)||score<0||score>10||!feedback)
    return error(res,400,"decision (pass or fail), whole-number score 0 to 10 and feedback of 5 to 2000 characters required");
  if(decision==="pass"&&score<PASS_MARK)return error(res,400,"A pass needs a score of at least "+PASS_MARK);
  try{
    const done=await tx(async q=>{
      const s=await q(`SELECT a.session_id,a.learner_id FROM cpd_assessment_submissions a
        JOIN cpd_session_faculty f ON f.session_id=a.session_id AND f.faculty_id=$2
        WHERE a.id=$1 AND a.status='submitted' FOR UPDATE OF a`,[id,req.user.id]);
      if(!s.rowCount)return null;
      const {session_id,learner_id}=s.rows[0];
      await q("INSERT INTO cpd_assessment_decisions(submission_id,faculty_id,decision,score,feedback) VALUES($1,$2,$3,$4,$5)",
        [id,req.user.id,decision,score,feedback]);
      await q("UPDATE cpd_assessment_submissions SET status=$2 WHERE id=$1",[id,decision==="pass"?"passed":"failed"]);
      if(decision==="pass")
        await q("UPDATE cpd_enrolments SET assessment_verified=true WHERE session_id=$1 AND learner_id=$2",[session_id,learner_id]);
      await audit(req.user.id,"assessment-decided",id,{sessionId:session_id,learnerId:learner_id,decision,score},q);
      return true;
    });
    if(!done)return error(res,404,"No pending submission in a session assigned to you");
    return res.status(201).json({id,decision,score});
  }catch{return error(res,503,"Decision unavailable")}
});

/* ---------- Admin: independent attendance review, completions, certificates ---------- */
app.get("/api/admin/attendance-reviews",auth,allow("admin"),async(req,res)=>{
  try{
    const r=await query(`SELECT a.id,a.session_id,s.course,a.learner_id,lu.display_name AS learner_name,
        a.faculty_id,fu.display_name AS faculty_name,a.evidence,a.occurred_at
      FROM cpd_attendance_events a JOIN cpd_course_sessions s ON s.id=a.session_id
      JOIN cpd_users lu ON lu.id=a.learner_id JOIN cpd_users fu ON fu.id=a.faculty_id
      WHERE a.event_type='faculty-attestation' AND a.status='pending-compliance-review'
      ORDER BY a.occurred_at LIMIT 200`);
    return res.json({pending:r.rows});
  }catch{return error(res,503,"Reviews unavailable")}
});
app.post("/api/attendance/:id/review",auth,allow("admin"),async(req,res)=>{
  const id=req.params.id,decision=req.body?.decision,reason=value(req.body?.reason,500);
  if(!isUUID(id)||!["approved","rejected"].includes(decision))return error(res,400,"decision (approved or rejected) required");
  if(decision==="rejected"&&!reason)return error(res,400,"A rejection needs a reason");
  try{
    const out=await tx(async q=>{
      const a=await q("SELECT faculty_id FROM cpd_attendance_events WHERE id=$1 AND event_type='faculty-attestation' AND status='pending-compliance-review' FOR UPDATE",[id]);
      if(!a.rowCount)return 404;
      if(a.rows[0].faculty_id===req.user.id)return 403;
      await q("INSERT INTO cpd_attendance_reviews(attendance_id,attested_by,reviewer_id,decision,reason) VALUES($1,$2,$3,$4,$5)",
        [id,a.rows[0].faculty_id,req.user.id,decision,reason]);
      await q("UPDATE cpd_attendance_events SET status=$2 WHERE id=$1",[id,decision]);
      await audit(req.user.id,"attendance-"+decision,id,{},q);
      return 201;
    });
    if(out===404)return error(res,404,"No faculty attestation awaiting review");
    if(out===403)return error(res,403,"You cannot review your own attestation");
    return res.status(201).json({id,status:decision});
  }catch{return error(res,503,"Review unavailable")}
});
app.get("/api/admin/completions",auth,allow("admin"),async(req,res)=>{
  const sessionId=req.query.sessionId;
  if(!isUUID(sessionId))return error(res,400,"Valid sessionId required");
  try{
    const r=await query(`SELECT e.learner_id,u.display_name,e.status,e.assessment_verified,
        (SELECT count(*)::int FROM cpd_attendance_events a WHERE a.session_id=e.session_id AND a.learner_id=e.learner_id
          AND a.event_type='faculty-attestation' AND a.status='approved') AS approved_attendance,
        c.reference,c.status AS certificate_status
      FROM cpd_enrolments e JOIN cpd_users u ON u.id=e.learner_id
      LEFT JOIN cpd_certificates c ON c.session_id=e.session_id AND c.learner_id=e.learner_id
      WHERE e.session_id=$1 ORDER BY u.display_name NULLS LAST LIMIT 1000`,[sessionId]);
    return res.json({sessionId,learners:r.rows.map(l=>({...l,
      eligible:l.status!=="withdrawn"&&l.assessment_verified&&l.approved_attendance>0&&!l.certificate_status&&Boolean(l.display_name)}))});
  }catch{return error(res,503,"Completions unavailable")}
});
app.post("/api/certificates/issue",auth,allow("admin"),async(req,res)=>{
  const learnerId=value(req.body?.learnerId,250),sessionId=req.body?.sessionId;
  if(!learnerId||!isUUID(sessionId))return error(res,400,"Invalid learner or session");
  try{
    const out=await tx(async q=>{
      const r=await q(`SELECT e.status,e.assessment_verified,u.display_name,s.course,s.approval_id,
          (SELECT count(*)::int FROM cpd_attendance_events a WHERE a.session_id=e.session_id AND a.learner_id=e.learner_id
            AND a.event_type='faculty-attestation' AND a.status='approved') AS approved_attendance,
          (SELECT ap.credits FROM cpd_course_approvals ap WHERE ap.id=s.approval_id AND ap.status='approved'
            AND ap.valid_until>=current_date) AS approved_credits,
          EXISTS (SELECT 1 FROM cpd_certificates c WHERE c.session_id=e.session_id AND c.learner_id=e.learner_id) AS has_certificate
        FROM cpd_enrolments e JOIN cpd_users u ON u.id=e.learner_id JOIN cpd_course_sessions s ON s.id=e.session_id
        WHERE e.session_id=$1 AND e.learner_id=$2 FOR UPDATE OF e`,[sessionId,learnerId]);
      const row=r.rows[0];
      if(!row)return {status:404,message:"No enrolment for this learner and session"};
      if(row.has_certificate)return {status:409,message:"Certificate already issued for this session"};
      if(row.status==="withdrawn")return {status:409,message:"Learner withdrew from this session"};
      if(!row.assessment_verified)return {status:409,message:"Assessment not passed"};
      if(row.approved_attendance<1)return {status:409,message:"No independently approved attendance"};
      if(!row.display_name)return {status:409,message:"Learner name missing"};
      const credits=row.approved_credits==null?0:Number(row.approved_credits);
      const reference="LF-"+randomUUID();
      await q(`INSERT INTO cpd_certificates(reference_hash,reference,learner_id,session_id,course,issued_by,learner_name,nba_credits,approval_id)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [hash(reference),reference,learnerId,sessionId,row.course,req.user.id,row.display_name,credits,credits>0?row.approval_id:null]);
      await q("UPDATE cpd_enrolments SET status='completed' WHERE session_id=$1 AND learner_id=$2",[sessionId,learnerId]);
      await audit(req.user.id,"certificate-issued",reference,{sessionId,learnerId,nbaCredits:credits},q);
      return {status:201,body:{reference,learnerName:row.display_name,course:row.course,nbaCredits:credits}};
    });
    return out.body?res.status(out.status).json(out.body):error(res,out.status,out.message);
  }catch(e){
    if(e.code==="23505")return error(res,409,"Certificate already issued for this session");
    return error(res,503,"Certificate issuance unavailable");
  }
});
app.post("/api/certificates/revoke",auth,allow("admin"),async(req,res)=>{
  const ref=value(req.body?.reference,100),reason=value(req.body?.reason,500);
  if(!ref||!/^LF-[a-f0-9-]{36}$/i.test(ref)||!reason)return error(res,400,"Reference and reason required");
  try{
    const r=await query("UPDATE cpd_certificates SET status='revoked',revoked_at=now(),revoked_by=$2,revoke_reason=$3 WHERE reference_hash=$1 AND status='issued'",
      [hash(ref),req.user.id,reason]);
    if(!r.rowCount)return error(res,404,"No issued certificate with that reference");
    await audit(req.user.id,"certificate-revoked",ref,{});
    return res.json({reference:ref,status:"revoked"});
  }catch{return error(res,503,"Revocation unavailable")}
});
// Public. The reference is printed on the certificate; the learner's name is returned so a
// verifier can match it to the person presenting the certificate.
app.post("/api/certificates/verify",async(req,res)=>{
  const ref=value(req.body?.reference,100);
  if(!ref||!/^LF-[a-f0-9-]{36}$/i.test(ref))return error(res,400,"Invalid reference");
  try{
    const result=await query(
      "SELECT course,issued_at,nba_credits,approval_id,status,learner_name,revoked_at FROM cpd_certificates WHERE reference_hash=$1",[hash(ref)]);
    const row=result.rows[0];
    if(!row)return res.json({valid:false});
    if(row.status!=="issued")return res.json({valid:false,revoked:true,revokedAt:row.revoked_at});
    return res.json({valid:true,issuer:"BSOE",learnerName:row.learner_name,course:row.course,issuedAt:row.issued_at,
      nbaCredits:row.nba_credits,approvalId:row.approval_id});
  }catch{return error(res,503,"Verification unavailable")}
});
app.get("/api/reports/attendance",auth,allow("admin"),async(req,res)=>{
  const sessionId=req.query.sessionId;
  if(!isUUID(sessionId))return error(res,400,"Valid sessionId required");
  try{
    const result=await query(
      "SELECT learner_id,session_id,occurred_at,faculty_id,status FROM cpd_attendance_events WHERE session_id=$1 AND event_type='faculty-attestation' ORDER BY occurred_at DESC LIMIT 1000",
      [sessionId]);
    await audit(req.user.id,"internal-export",sessionId,{count:result.rows.length});
    return res.json({type:"DRAFT_INTERNAL_REVIEW_NOT_NBA_ICLE_SUBMISSION",
      sessionId,records:result.rows});
  }catch{return error(res,503,"Report unavailable")}
});

/* ---------- AI tutor: off until AZURE_OPENAI_* is set; daily caps; nothing stored but counts ---------- */
app.post("/api/tutor",auth,async(req,res)=>{
  const question=value(req.body?.question,1000);
  const lessonId=req.body?.lessonId;
  if(lessonId!==undefined&&lessonId!==null&&lessonId!==""){
    if(typeof lessonId!=="string"||!resolveLesson(lessonId))
      return error(res,400,"Unknown course lesson");
  }
  const caseId=req.body?.caseId;
  const investigationStage=req.body?.investigationStage;
  const hasCase=caseId!==undefined||investigationStage!==undefined;
  if(hasCase){
    if(typeof caseId!=="string"||!getCaseStage(caseId,investigationStage))
      return error(res,400,"Unknown case investigation or stage");
    if(lessonId!==undefined&&lessonId!==null&&lessonId!=="")
      return error(res,400,"Select either a course lesson or a case investigation");
  }
  if(!question)return error(res,400,"Question required");
  if(CONFIDENTIAL.test(question))return error(res,400,"Do not submit confidential data");
  if(!process.env.AZURE_OPENAI_ENDPOINT||!process.env.AZURE_OPENAI_DEPLOYMENT)
    return error(res,503,"AI tutor not configured");
  let usageId;
  try{
    usageId=await tx(async q=>{
      await q("SELECT pg_advisory_xact_lock(724001)"); // serialise the cap check
      const used=await q("SELECT count(*) FILTER (WHERE user_id=$1)::int AS mine,count(*)::int AS total FROM cpd_tutor_usage WHERE used_on=current_date",[req.user.id]);
      if(used.rows[0].mine>=TUTOR_PER_USER||used.rows[0].total>=TUTOR_TOTAL)return null;
      const id=randomUUID();
      await q("INSERT INTO cpd_tutor_usage(id,user_id) VALUES($1,$2)",[id,req.user.id]);
      return id;
    });
  }catch{return error(res,503,"Tutor unavailable")}
  if(!usageId)return error(res,429,"Daily tutor limit reached. Try again tomorrow.");
  const finish=(outcome,usage={})=>query("UPDATE cpd_tutor_usage SET outcome=$2,prompt_tokens=$3,completion_tokens=$4 WHERE id=$1",
    [usageId,outcome,Number(usage.prompt_tokens)||0,Number(usage.completion_tokens)||0]).catch(()=>{});
  try{
    const provider=getBearerTokenProvider(credential,"https://cognitiveservices.azure.com/.default");
    const token=await provider();
    const base=process.env.AZURE_OPENAI_ENDPOINT.replace(/\/$/,"");
    const url=base+"/openai/deployments/"+encodeURIComponent(process.env.AZURE_OPENAI_DEPLOYMENT)+
      "/chat/completions?api-version="+encodeURIComponent(process.env.AZURE_OPENAI_API_VERSION||"2024-10-21");
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),18000);
    let response;
    try{
      response=await fetch(url,{method:"POST",signal:controller.signal,headers:{
        Authorization:"Bearer "+token,"Content-Type":"application/json"
      },body:JSON.stringify({temperature:0.2,max_tokens:500,messages:[
        ...(hasCase?makeCaseTutorMessages(question,caseId,investigationStage):makeTutorMessages(question,lessonId))
      ]})});
    }finally{clearTimeout(timer)}
    if(!response.ok){await finish("failed");return error(res,502,"AI provider unavailable")}
    const data=await response.json();
    await finish("answered",data.usage);
    return res.json({answer:data.choices?.[0]?.message?.content||"No response",
      courseVersion:COURSE_VERSION,lessonId:lessonId||null,
      investigation:hasCase?{caseId,stage:investigationStage}:null,
      warning:"Educational guidance only. Verify primary legal sources; no NBA-ICLE credits are conferred."});
  }catch{await finish("failed");return error(res,503,"Tutor unavailable")}
});
app.use((req,res)=>error(res,404,"Not found"));
const server=app.listen(8080,"0.0.0.0",()=>console.log("LexFlow CPD on 8080"));
process.on("SIGTERM",()=>{server.close(async()=>{await pool.end();process.exit(0)});
  setTimeout(()=>process.exit(1),20000).unref()});
