/**
 * LexFlow CPD PostgreSQL API - Azure Container Apps / port 8080.
 * Schema is provisioned OUT OF BAND by an operator; runtime never executes DDL.
 * Production requires security review, actual faculty approvals and regulator agreement.
 */
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pg from "pg";
import {createRemoteJWKSet,jwtVerify} from "jose";
import {DefaultAzureCredential,getBearerTokenProvider} from "@azure/identity";
import {randomUUID,createHash} from "node:crypto";

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
const jwks=createRemoteJWKSet(new URL(process.env.ENTRA_JWKS_URI));
const credential=new DefaultAzureCredential();
const app=express();app.disable("x-powered-by");
// One trusted hop: the Azure Container Apps ingress. Without this every caller shares the
// ingress address and therefore one rate-limit bucket.
app.set("trust proxy",1);
app.use(helmet());app.use(express.json({limit:"12kb"}));
app.use(rateLimit({windowMs:60000,limit:60,standardHeaders:"draft-7",legacyHeaders:false}));
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
const hash=s=>createHash("sha256").update(s).digest("hex");
const isUUID=s=>typeof s==="string"&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(s);
const audit=async(actor,action,target,details={})=>query(
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
  const id=payload.oid||payload.sub;
  if(!value(id,250)){error(res,401,"Invalid subject");return null}
  return id;
}
async function auth(req,res,next){
  const id=await identify(req,res);
  if(!id)return;
  try{
    const user=await query("SELECT id,role,active FROM cpd_users WHERE id=$1",[id]);
    if(!user.rows[0]?.active)return error(res,403,"User not provisioned");
    req.user={id,role:user.rows[0].role};
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
  const id=await identify(req,res);
  if(!id)return;
  if(process.env.ALLOW_SELF_REGISTRATION!=="true")return error(res,403,"Self-registration is closed");
  try{
    const made=await query("INSERT INTO cpd_users(id,role) VALUES($1,'learner') ON CONFLICT (id) DO NOTHING",[id]);
    const user=await query("SELECT id,role,active FROM cpd_users WHERE id=$1",[id]);
    if(!user.rows[0]?.active)return error(res,403,"Account is not active");
    if(made.rowCount)await audit(id,"self-registered",id,{});
    return res.status(made.rowCount?201:200).json({id,role:user.rows[0].role});
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
// A learner's own record only. Credits come solely from an approved certificate row.
app.get("/api/me/record",auth,async(req,res)=>{
  try{
    const [enrolments,attendance,certificates]=await Promise.all([
      query("SELECT e.session_id,s.course,s.starts_at,s.ends_at,s.status AS session_status,e.status,e.assessment_verified FROM cpd_enrolments e JOIN cpd_course_sessions s ON s.id=e.session_id WHERE e.learner_id=$1 ORDER BY s.starts_at DESC LIMIT 200",[req.user.id]),
      query("SELECT id,session_id,event_type,status,occurred_at FROM cpd_attendance_events WHERE learner_id=$1 ORDER BY occurred_at DESC LIMIT 200",[req.user.id]),
      query("SELECT session_id,course,issued_at,status,nba_credits FROM cpd_certificates WHERE learner_id=$1 ORDER BY issued_at DESC LIMIT 200",[req.user.id])
    ]);
    const credits=certificates.rows.filter(c=>c.status==="issued").reduce((n,c)=>n+Number(c.nba_credits),0);
    return res.json({enrolments:enrolments.rows,attendance:attendance.rows,certificates:certificates.rows,nbaCredits:credits});
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
app.post("/api/attendance/attest",auth,allow("faculty","admin"),async(req,res)=>{
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
app.post("/api/certificates/issue",auth,allow("admin"),async(req,res)=>{
  const learnerId=value(req.body?.learnerId,250),sessionId=req.body?.sessionId;
  if(!learnerId||!isUUID(sessionId))return error(res,400,"Invalid learner or session");
  // Issuance is disabled pending independently approved assessment/attendance workflow.
  return error(res,501,"Certificate issuance requires independently reviewed evidence workflow");
});
app.post("/api/certificates/verify",async(req,res)=>{
  const ref=value(req.body?.reference,100);
  if(!ref||!/^LF-[a-f0-9-]{36}$/i.test(ref))return error(res,400,"Invalid reference");
  try{
    const result=await query(
      "SELECT course,issued_at,nba_credits,approval_id,status FROM cpd_certificates WHERE reference_hash=$1",[hash(ref)]);
    const row=result.rows[0];
    if(!row||row.status!=="issued")return res.json({valid:false});
    return res.json({valid:true,issuer:"BSOE",course:row.course,issuedAt:row.issued_at,
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
app.post("/api/tutor",auth,async(req,res)=>{
  const question=value(req.body?.question,1000);
  if(!question)return error(res,400,"Question required");
  if(/client file|passport|bank account|confidential attachment/i.test(question))
    return error(res,400,"Do not submit confidential data");
  if(!process.env.AZURE_OPENAI_ENDPOINT||!process.env.AZURE_OPENAI_DEPLOYMENT)
    return error(res,503,"AI tutor not configured");
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
        {role:"system",content:"You teach AI literacy to Nigerian lawyers with fictional cases only. Do not invent citations or provide personalised legal advice. Require primary-law verification. Do not handle client secrets or regard tutor chat as CPD attendance."},
        {role:"user",content:question}
      ]})});
    }finally{clearTimeout(timer)}
    if(!response.ok)return error(res,502,"AI provider unavailable");
    const data=await response.json();
    return res.json({answer:data.choices?.[0]?.message?.content||"No response",
      warning:"Education only. Independently verify legal sources."});
  }catch{return error(res,503,"Tutor unavailable")}
});
app.use((req,res)=>error(res,404,"Not found"));
const server=app.listen(8080,"0.0.0.0",()=>console.log("LexFlow CPD on 8080"));
process.on("SIGTERM",()=>{server.close(async()=>{await pool.end();process.exit(0)});
  setTimeout(()=>process.exit(1),20000).unref()});
