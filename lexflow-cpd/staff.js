import {PublicClientApplication,InteractionRequiredAuthError} from "./vendor/msal-browser-4.25.1.mjs";
import {lexflowAuthConfig as cfg} from "./auth-config.js";
const $=id=>document.getElementById(id),msg=s=>$("staffState").textContent=s;
const uuid=s=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(s||"");
const el=(tag,txt,cl)=>{const v=document.createElement(tag);if(txt!==undefined)v.textContent=String(txt);if(cl)v.className=cl;return v};
const button=(label,cb)=>{const b=el("button",label);b.type="button";b.addEventListener("click",cb);return b};
const field=(label,value,opts={})=>{const w=el("div");w.appendChild(el("label",label));const input=document.createElement(opts.multi?"textarea":"input");if(!opts.multi)input.type=opts.type||"text";if(opts.max)input.maxLength=opts.max;if(value)input.value=value;w.appendChild(input);return {wrap:w,input}};
const ready=uuid(cfg.clientId)&&/^https:\/\//.test(cfg.apiBaseUrl)&&!cfg.apiBaseUrl.includes("REPLACE")&&cfg.knownAuthority?.endsWith(".ciamlogin.com")&&!cfg.knownAuthority.includes("REPLACE");
if(!ready){msg("Not configured: public Entra settings and API address must be set before sign-in.");$("staffLogin").disabled=true}
else{
 try{
 const client=new PublicClientApplication({auth:{clientId:cfg.clientId,authority:cfg.authority,knownAuthorities:[cfg.knownAuthority],redirectUri:new URL("staff.html",location.href).href,postLogoutRedirectUri:new URL("staff.html",location.href).href,navigateToLoginRequestUrl:false},cache:{cacheLocation:"sessionStorage"}});
 await client.initialize();const result=await client.handleRedirectPromise();if(result?.account)client.setActiveAccount(result.account);
 const account=()=>client.getActiveAccount()||client.getAllAccounts()[0];
 async function accessToken(){const acc=account();if(!acc)throw Error("Sign in first");try{return(await client.acquireTokenSilent({account:acc,scopes:[cfg.apiScope]})).accessToken}catch(e){if(e instanceof InteractionRequiredAuthError){await client.acquireTokenRedirect({account:acc,scopes:[cfg.apiScope]});return null}throw e}}
 async function request(path,method="GET",body){const token=await accessToken();if(!token)return null;const res=await fetch(cfg.apiBaseUrl.replace(/\/$/,"")+path,{method,cache:"no-store",headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined});const data=await res.json().catch(()=>({}));if(!res.ok)throw Error(String(data.error||"HTTP "+res.status));return data}
 async function action(path,body,after){try{msg("Submitting for server verification...");const r=await request(path,"POST",body);if(!r)return;if(after)await after();msg("Done: "+(r.reference?"certificate "+r.reference+" issued to "+(r.learnerName||"the learner")+" with "+r.nbaCredits+" NBA-ICLE credits":r.status?"status is now "+r.status:r.decision?"decision recorded ("+r.decision+", "+r.score+"/10)":"saved")+".")}catch(e){msg("Not completed: "+e.message)}}
 function paint(){const a=account();$("staffIdentity").textContent=a?"Signed in: "+(a.name||"Microsoft account"):"Not signed in";$("staffLogin").hidden=!!a;$("staffLogout").hidden=!a;$("staffRefresh").hidden=!a;$("staffData").hidden=!a}
 $("staffLogin").onclick=()=>client.loginRedirect({scopes:["openid","profile",cfg.apiScope]});
 $("staffLogout").onclick=()=>client.logoutRedirect({account:account()});
 $("staffRefresh").onclick=load;
 function selectTab(which){for(const k of ["faculty","admin"]){$(k+"Section").classList.toggle("active",k===which);$(k+"Tab").setAttribute("aria-pressed",String(k===which))}}
 $("facultyTab").onclick=()=>selectTab("faculty");$("adminTab").onclick=()=>selectTab("admin");
 async function loadFaculty(){const d=await request("/api/faculty/sessions");const root=$("facultySessions");root.replaceChildren();for(const s of d.sessions||[]){const wrap=el("article",undefined,"record");wrap.append(el("h3",s.course),el("p","Session: "+s.id+" · "+s.status));for(const learner of s.learners||[]){const box=el("div",undefined,"record");box.append(el("b",learner.display_name||"Learner"),el("p","Attendance: "+(learner.attendance_status||"none")+" · Assessment verified: "+Boolean(learner.assessment_verified)));const evidence=field("Faculty attendance evidence (fictional only)","",{multi:true,max:2000});box.append(evidence.wrap,button("Submit attendance attestation",()=>{if(!confirm("Submit attestation for independent compliance review?"))return;action("/api/attendance/attest",{sessionId:s.id,learnerId:learner.learner_id,evidence:evidence.input.value},load)}));wrap.appendChild(box)}
 for(const a of s.pendingSubmissions||[]){const box=el("article",undefined,"record");box.append(el("h4","Assessment · "+(a.display_name||"Learner")),el("p",a.response));const decision=field("Decision",null);decision.input.replaceWith(document.createElement("select"));const sel=decision.wrap.querySelector("select");sel.append(new Option("Pass","pass"),new Option("Fail","fail"));const score=field("Score 0–10","",{type:"number"});score.input.min="0";score.input.max="10";score.input.step="1";const feedback=field("Faculty feedback","",{multi:true,max:2000});box.append(decision.wrap,score.wrap,feedback.wrap,button("Record faculty decision",()=>{if(score.input.value.trim()===""){msg("Enter a score first.");return}if(!confirm("Record this faculty assessment decision?"))return;const raw=score.input.value.trim();if(!/^(10|[0-9])$/.test(raw)){msg("Enter a whole-number score from 0 to 10.");return}action("/api/assessments/"+a.id+"/decision",{decision:sel.value,score:Number(raw),feedback:feedback.input.value},load)}));wrap.appendChild(box)}root.appendChild(wrap)}if(!d.sessions?.length)root.append(el("p","No faculty sessions assigned."))}
 const capstoneMax={scope:15,research:20,privacy:20,governance:15,evaluation:15,recommendation:15};
 async function loadCapstones(){
   const root=$("facultyCapstones");root.replaceChildren();
   let d;
   try{d=await request("/api/faculty/capstones")}catch(e){
     root.append(el("p","Capstone queue not available: "+e.message+". This may mean the newer API image and migration 003 are not yet deployed."));
     return;
   }
   const pending=d?.pending||[];
   if(!pending.length){root.append(el("p","No pending faculty capstones."));return}
   for(const item of pending){
     const card=el("article",undefined,"record");
     card.append(el("h3",(item.course||"Capstone")+" · "+(item.display_name||"Learner")),
       el("p","Fictional enrolment: "+item.session_id+" · Submitted: "+(item.submitted_at||"")));
     const answers=item.answers||{};
     for(const [id,maximum] of Object.entries(capstoneMax)){
       const region=el("section",undefined,"record");
       region.append(el("h4",id.charAt(0).toUpperCase()+id.slice(1)+" — maximum "+maximum),
         el("p",String(answers[id]||"(no response)")));
       card.append(region);
     }
     const fields={};
     for(const [id,maximum] of Object.entries(capstoneMax)){
       const control=field(id+" score (0–"+maximum+")","",{type:"number"});
       control.input.min="0";control.input.max=String(maximum);control.input.step="1";
       fields[id]=control.input;card.append(control.wrap);
     }
     const decisionLabel=el("label","Faculty decision");const decision=document.createElement("select");
     for(const [label,value] of [["Pass (provisional policy)","pass"],["Fail","fail"],["Return for revision","return"]])decision.append(new Option(label,value));
     card.append(decisionLabel,decision);
     const feedback=field("Detailed developmental feedback (10–3000 characters)","",{multi:true,max:3000});
     card.append(feedback.wrap);
     const total=el("p","Total: enter scores in each dimension (100 maximum).");
     const calculate=()=>{
       const values=Object.entries(fields).map(([id,input])=>[id,input.value.trim()]);
       if(values.some(([,v])=>v==="")){total.textContent="Complete all six scores before marking.";return null}
       const marks={};for(const [id,v] of values){
         if(!/^\d+$/.test(v)||Number(v)>capstoneMax[id]){total.textContent="A score is invalid or exceeds its dimension's maximum.";return null}
         marks[id]=Number(v);
       }
       const sum=Object.values(marks).reduce((a,b)=>a+b,0);
       total.textContent="Human scoring total: "+sum+"/100. Proposed pass needs ≥70, research ≥10 and privacy ≥10.";
       return marks;
     };
     for(const input of Object.values(fields))input.addEventListener("input",calculate);
     card.append(total,button("Record faculty capstone decision",()=>{
       const marks=calculate();if(!marks)return;
       if(feedback.input.value.trim().length<10){msg("Provide at least 10 characters of meaningful feedback.");return}
       if(decision.value==="pass"&&!(Object.values(marks).reduce((a,b)=>a+b,0)>=70&&marks.research>=10&&marks.privacy>=10)){
         msg("Proposed educational pass threshold not met.");return
       }
       if(!confirm("Save this assigned faculty assessment decision? It is not certificate issuance or NBA-ICLE accreditation."))return;
       action("/api/faculty/capstones/"+encodeURIComponent(item.id)+"/decision",
         {decision:decision.value,marks,feedback:feedback.input.value},async()=>{await loadCapstones()});
     }));
     root.append(card);
   }
 }
 async function loadSessionPicker(){const d=await request("/api/sessions");const box=$("completionSession");let list=$("sessionChoices");if(!list){list=document.createElement("div");list.id="sessionChoices";list.className="toolbar";box.parentNode.insertBefore(list,box)}list.replaceChildren();for(const s of d?.sessions||[])list.append(button(s.course+" ("+s.status+")",()=>{box.value=s.id;$("loadCompletions").click()}))}
 async function loadReadiness(){
  const box=$("readinessSummary");if(!box)return;box.textContent="Loading protected aggregate scores...";
  try{
   const data=await request("/api/admin/readiness/summary");
   box.replaceChildren();
   const t=data.totals||{};
   box.append(el("p","Attempts: "+(t.attempts??0)+" · Distinct synthetic learners: "+(t.learners??0)+" · Mean score: "+(t.mean_score??"—")+"/12"));
   box.append(el("p","Foundation: "+(t.foundation??0)+" · Developing: "+(t.developing??0)+" · Advanced: "+(t.advanced??0)));
   box.append(el("p","Scores are calculated by the protected API. No names or question answers are exposed in this summary. NBA-ICLE access is not configured."));
   const list=el("ul");for(const day of data.daily||[])list.append(el("li",String(day.date)+" · "+day.attempts+" attempts · mean "+day.mean_score+"/12"));box.append(list);
  }catch(e){box.textContent="No live readiness summary: "+e.message+". Migration 004 and a controlled API release are required."}
 }
 $("refreshReadiness")?.addEventListener("click",loadReadiness);
 async function loadAdmin(){await loadReadiness();await loadSessionPicker();const d=await request("/api/admin/attendance-reviews");const root=$("pendingReviews");root.replaceChildren();for(const a of d.pending||[]){const box=el("article",undefined,"record");box.append(el("h3",a.course),el("p","Learner: "+(a.learner_name||"unverified")+" · Faculty: "+(a.faculty_name||"unverified")),el("p","Evidence: "+a.evidence));const reason=field("Reason for rejection (required if rejecting)","",{multi:true,max:500});box.append(reason.wrap,button("Approve independent attendance",()=>{if(confirm("Approve this faculty attestation as reviewed evidence?"))action("/api/attendance/"+a.id+"/review",{decision:"approved"},load)}),button("Reject",()=>{if(confirm("Reject this faculty attestation?"))action("/api/attendance/"+a.id+"/review",{decision:"rejected",reason:reason.input.value},load)}));root.append(box)}if(!d.pending?.length)root.append(el("p","No pending attendance reviews."))}
 $("loadCompletions").onclick=async()=>{const id=$("completionSession").value.trim();if(!uuid(id)){msg("Enter a valid session UUID.");return}try{const d=await request("/api/admin/completions?sessionId="+encodeURIComponent(id));const root=$("completionRows");root.replaceChildren();for(const l of d.learners||[]){const w=el("article",undefined,"record");w.append(el("b",l.display_name||"Learner"),el("p","Assessment: "+l.assessment_verified+" · Approved attendance: "+l.approved_attendance+" · "+(l.certificate_status?"Certificate "+l.certificate_status+": "+(l.reference||"(no reference)"):"Eligible: "+l.eligible)));if(l.eligible)w.append(button("Issue BSOE completion certificate",()=>{if(confirm("Issue certificate? No NBA credits without formal approval."))action("/api/certificates/issue",{sessionId:id,learnerId:l.learner_id},()=>$("loadCompletions").click())}));root.append(w)}if(!d.learners?.length)root.append(el("p","No enrolled participants."))}catch(e){msg(e.message)}};
 $("revokeButton").onclick=()=>{const ref=$("revokeRef").value.trim(),reason=$("revokeReason").value.trim();if(!ref||!reason){msg("Certificate reference and reason are required");return}if(confirm("Revoke this certificate? This is an auditable action."))action("/api/certificates/revoke",{reference:ref,reason})};
 async function load(){if(!account())return;try{const who=await request("/api/me");if(!who)return;paint();msg("Authenticated role: "+who.role+". These records must remain fictional in development.");if(who.role==="faculty"){selectTab("faculty");$("adminTab").hidden=true;await loadFaculty();await loadCapstones()}else if(who.role==="admin"){selectTab("admin");$("facultyTab").hidden=true;await loadAdmin()}else{$("staffData").hidden=true;msg("A learner account cannot access faculty or administrator records.")}}catch(e){$("staffData").hidden=true;msg("Access not available: "+e.message)}}
 $("verifyButton").onclick=async()=>{const result=$("verifyResult");result.textContent="Checking...";try{const res=await fetch(cfg.apiBaseUrl.replace(/\/$/,"")+"/api/certificates/verify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({reference:$("verifyRef").value.trim()})});const data=await res.json();result.textContent=data.valid?"Valid. Issued by "+data.issuer+" to "+(data.learnerName||"(name not recorded)")+" for "+data.course+" on "+new Date(data.issuedAt).toLocaleDateString("en-GB",{dateStyle:"long"})+". NBA-ICLE credits: "+Number(data.nbaCredits)+".":data.revoked?"This certificate was revoked on "+new Date(data.revokedAt).toLocaleDateString("en-GB",{dateStyle:"long"})+".":"No certificate found with that reference."}catch{result.textContent="Verification service unavailable."}};
 paint();if(account())load();else msg("Sign in with a BSOE-provisioned faculty or administrator account.");
 }catch{msg("Microsoft Entra initialisation failed. Check the registration and redirect URI.")}}
