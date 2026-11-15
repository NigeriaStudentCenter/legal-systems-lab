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
  }catch{status("Microsoft sign-in could not initialise. Check tenant registration and browser network permissions.");}
}
