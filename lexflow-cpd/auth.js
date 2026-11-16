/**
 * LexFlow external-tenant sign-in for the public SPA.
 * Uses MSAL browser PKCE redirect flow and an explicitly registered SPA redirect URI.
 * No client secret; Entra tokens stay in MSAL session cache and are not displayed or logged.
 * This page is NOT an authorisation boundary: the Azure API enforces all access.
 */
import {PublicClientApplication,InteractionRequiredAuthError} from "https://cdn.jsdelivr.net/npm/@azure/msal-browser@4.25.1/+esm";
import {lexflowAuthConfig as cfg} from "./auth-config.js";
const el=id=>document.getElementById(id);
const status=msg=>{if(el("identityStatus"))el("identityStatus").textContent=msg};
const isGuid=s=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const valid=()=>isGuid(cfg.clientId)&&cfg.knownAuthority.endsWith(".ciamlogin.com")&&!cfg.knownAuthority.includes("REPLACE")&&
  cfg.authority.startsWith("https://"+cfg.knownAuthority+"/")&&
  cfg.redirectUri===new URL("portal.html",location.href).href&&
  /^api:\/\/[^\s]+\/access_as_user$/.test(cfg.apiScope)&&!cfg.apiScope.includes("REPLACE")&&
  /^https:\/\//.test(cfg.apiBaseUrl)&&!cfg.apiBaseUrl.includes("REPLACE");
if(!valid()){
  status("Sign-in not configured. BSOE must supply the public tenant subdomain, Portal app ID, API app ID/scope and Azure API URL. No credentials should be entered into this webpage.");
  el("loginAction")?.setAttribute("disabled","");
}else{
  try{
    const client=new PublicClientApplication({auth:{
      clientId:cfg.clientId,authority:cfg.authority,
      knownAuthorities:[cfg.knownAuthority],redirectUri:cfg.redirectUri,
      postLogoutRedirectUri:cfg.redirectUri,navigateToLoginRequestUrl:false
    },cache:{cacheLocation:"sessionStorage",storeAuthStateInCookie:false}});
    await client.initialize();
    const response=await client.handleRedirectPromise();
    if(response?.account)client.setActiveAccount(response.account);
    const current=()=>client.getActiveAccount()||client.getAllAccounts()[0]||null;
    const paint=()=>{
      const account=current();
      el("loginAction").hidden=Boolean(account);
      el("logoutAction").hidden=!account;
      el("apiCheckAction").hidden=!account;
      status(account?"Microsoft Entra sign-in established. API access and enrolment remain subject to separate server-side permissions.":"Not signed in. Select Sign in to open Microsoft's hosted authentication screen.");
      el("identityName").textContent=account?"Signed in: "+(account.name||"Microsoft account"):"No authenticated account";
    };
    async function token(){
      const account=current();if(!account)throw Error("Sign in first");
      try{return (await client.acquireTokenSilent({account,scopes:[cfg.apiScope]})).accessToken}
      catch(e){
        if(e instanceof InteractionRequiredAuthError){
          await client.acquireTokenRedirect({account,scopes:[cfg.apiScope]});
          return null;
        }
        throw e;
      }
    }
    // Live data from the protected API. Everything is written with textContent, never as HTML.
    async function api(method,path,body){
      const accessToken=await token();if(!accessToken)return null;
      return fetch(cfg.apiBaseUrl.replace(/\/$/,"")+path,{method,cache:"no-store",
        headers:{Authorization:"Bearer "+accessToken,...(body?{"Content-Type":"application/json"}:{})},
        body:body?JSON.stringify(body):undefined});
    }
    const live=msg=>{el("liveStatus").textContent=msg};
    const cell=(row,text)=>{const td=document.createElement("td");td.textContent=text;row.appendChild(td);return td};
    const when=v=>new Date(v).toLocaleString("en-GB",{dateStyle:"medium",timeStyle:"short"});
    const emptyRow=(body,cols,text)=>{const tr=document.createElement("tr");cell(tr,text).colSpan=cols;body.appendChild(tr)};
    async function act(path,sessionId,done){
      live("Working...");
      try{
        const r=await api("POST",path,{sessionId});if(!r)return;
        if(r.ok){await loadLive();live(done)}
        else{const d=await r.json().catch(()=>({}));live("Not done: "+String(d.error||("HTTP "+r.status))+".")}
      }catch{live("The API could not be reached.")}
    }
    async function loadLive(){
      if(!current()){el("liveRecord").hidden=true;return}
      el("liveRecord").hidden=false;el("liveBody").hidden=true;el("registerAction").hidden=true;el("refreshAction").hidden=true;
      live("Loading your record from the protected API...");
      try{
        const me=await api("GET","/api/me");if(!me)return;
        if(me.status===403){el("registerAction").hidden=false;live("You are signed in, but have no learner record yet.");return}
        if(!me.ok){live("The API returned HTTP "+me.status+".");return}
        const role=String((await me.json()).role);
        const [sr,rr]=await Promise.all([api("GET","/api/sessions"),api("GET","/api/me/record")]);
        if(!sr?.ok||!rr?.ok){live("Your record could not be loaded.");return}
        const sessions=(await sr.json()).sessions||[],record=await rr.json();
        el("liveEnrolments").textContent=record.enrolments.length;
        el("liveAttendance").textContent=record.attendance.length;
        el("liveCertificates").textContent=record.certificates.filter(c=>c.status==="issued").length;
        el("liveCredits").textContent=Number(record.nbaCredits||0);
        const mine=new Map(record.enrolments.map(e=>[e.session_id,e.status]));
        const sb=el("liveSessions");sb.replaceChildren();
        for(const s of sessions){
          const tr=document.createElement("tr");
          cell(tr,s.course);cell(tr,when(s.starts_at));cell(tr,s.status);cell(tr,mine.get(s.id)||"not enrolled");
          const td=cell(tr,"");
          if(role==="learner"){
            const b=document.createElement("button");b.type="button";
            if(!mine.has(s.id)&&["planned","running"].includes(s.status)){
              b.textContent="Enrol";b.addEventListener("click",()=>act("/api/enrolments",s.id,"Enrolled."));td.appendChild(b);
            }else if(mine.get(s.id)==="enrolled"&&s.status==="running"){
              b.textContent="Check in";b.addEventListener("click",()=>act("/api/attendance/checkin",s.id,"Check-in recorded as unverified. No credit is awarded."));td.appendChild(b);
            }
          }
          sb.appendChild(tr);
        }
        if(!sessions.length)emptyRow(sb,5,"No open sessions.");
        const eb=el("liveEvents");eb.replaceChildren();
        for(const a of record.attendance){const tr=document.createElement("tr");cell(tr,when(a.occurred_at));cell(tr,a.event_type);cell(tr,a.status);eb.appendChild(tr)}
        if(!record.attendance.length)emptyRow(eb,3,"No attendance entries.");
        const ab=el("liveAssessments");ab.replaceChildren();
        for(const e of record.enrolments){
          const latest=(record.assessments||[]).find(a=>a.session_id===e.session_id);
          const box=document.createElement("div");box.className="tile";box.style.margin="10px 0";
          const h=document.createElement("b");h.textContent=e.course;
          const p=document.createElement("p");
          if(e.assessment_verified)p.textContent="Passed"+(latest?.score!=null?" ("+latest.score+"/10)":"")+(latest?.feedback?". Feedback: "+latest.feedback:".");
          else if(latest?.status==="submitted")p.textContent="Submitted "+when(latest.submitted_at)+". Awaiting a faculty decision.";
          else if(latest?.status==="failed")p.textContent="Not passed ("+latest.score+"/10). Feedback: "+latest.feedback+" You may submit again.";
          else p.textContent="Not yet submitted.";
          box.append(h,p);
          if(role==="learner"&&e.status==="enrolled"&&!e.assessment_verified&&latest?.status!=="submitted"){
            const ta=document.createElement("textarea");ta.maxLength=6000;
            ta.placeholder="Answer the Assessment Centre scenario using fictional facts only (20 to 6000 characters).";
            ta.setAttribute("aria-label","Assessment answer for "+e.course);
            const b=document.createElement("button");b.type="button";b.textContent="Submit for faculty marking";
            b.addEventListener("click",async()=>{
              live("Submitting...");
              try{
                const r=await api("POST","/api/assessments",{sessionId:e.session_id,response:ta.value});if(!r)return;
                if(r.ok){await loadLive();live("Submitted for faculty marking.")}
                else{const d=await r.json().catch(()=>({}));live("Not submitted: "+String(d.error||("HTTP "+r.status))+".")}
              }catch{live("The API could not be reached.")}
            });
            box.append(ta,b);
          }
          ab.appendChild(box);
        }
        if(!record.enrolments.length){const p=document.createElement("p");p.className="muted";p.textContent="Enrol in a session to take its assessment.";ab.appendChild(p)}
        const cb=el("liveCerts");cb.replaceChildren();
        for(const c of record.certificates||[]){
          const tr=document.createElement("tr");
          cell(tr,c.course);cell(tr,when(c.issued_at));cell(tr,c.reference||"(no reference)");
          cell(tr,c.status==="issued"?"valid":"revoked");cell(tr,String(Number(c.nba_credits)));cb.appendChild(tr);
        }
        if(!(record.certificates||[]).length)emptyRow(cb,5,"No certificates yet.");
        el("liveBody").hidden=false;el("refreshAction").hidden=false;
        live("Signed-in role: "+role+".");
      }catch{live("The API could not be reached.")}
    }
    el("refreshAction")?.addEventListener("click",loadLive);
    el("tutorAsk")?.addEventListener("click",async()=>{
      const out=el("tutorAnswer");out.hidden=false;out.textContent="Thinking...";
      try{
        const r=await api("POST","/api/tutor",{question:el("tutorQuestion").value});if(!r){out.textContent="";return}
        const d=await r.json().catch(()=>({}));
        out.textContent=r.ok?d.answer+"\n\n"+d.warning:"Not answered: "+String(d.error||("HTTP "+r.status))+".";
      }catch{out.textContent="The tutor could not be reached."}
    });
    el("registerAction")?.addEventListener("click",async()=>{
      live("Creating your learner record...");
      try{
        const r=await api("POST","/api/register");if(!r)return;
        if(r.ok)await loadLive();
        else{const d=await r.json().catch(()=>({}));live("Not created: "+String(d.error||("HTTP "+r.status))+".")}
      }catch{live("The API could not be reached.")}
    });
    el("loginAction")?.addEventListener("click",async()=>{
      try{await client.loginRedirect({scopes:["openid","profile",cfg.apiScope]})}
      catch{status("Sign-in could not start. Confirm app association, authority, redirect URI and permissions.")}});
    el("logoutAction")?.addEventListener("click",async()=>{
      try{await client.logoutRedirect({account:current()})}
      catch{status("Sign-out failed. Retry or close this browser session.")}});
    el("apiCheckAction")?.addEventListener("click",async()=>{
      status("Checking the protected BSOE API...");
      try{
        const accessToken=await token();if(!accessToken)return;
        const response=await fetch(cfg.apiBaseUrl.replace(/\/$/,"")+"/api/me",
          {headers:{Authorization:"Bearer "+accessToken},cache:"no-store"});
        if(response.ok){const data=await response.json();status("Azure API authenticated. Assigned role: "+String(data.role||"unassigned")+".")}
        else if(response.status===403)status("Microsoft sign-in succeeded, but BSOE has not provisioned this learner's backend account or role.");
        else status("Microsoft sign-in succeeded, but API access returned HTTP "+response.status+". Check Azure deployment and API permissions.");
      }catch{status("The Azure API is unavailable or the cross-origin configuration is incomplete.");}
    });
    paint();
    loadLive();
  }catch{status("Microsoft sign-in could not initialise. Check tenant registration and browser network permissions.");}
}
