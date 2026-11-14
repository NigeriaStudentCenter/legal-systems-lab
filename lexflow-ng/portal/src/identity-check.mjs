import {PublicClientApplication} from '@azure/msal-browser';
import {validatePortalConfig} from './runtime.mjs';

const status=document.querySelector('#identityCheckStatus');
const output=document.querySelector('#identityTestResult');
const login=document.querySelector('#identityTestLogin');
const logout=document.querySelector('#identityTestLogout');
let settings,identity;

function show(node,message,error=false){
  node.textContent=message;
  node.classList.toggle('error',error);
}
async function checkMetadata(){
  const response=await fetch(settings.apiBaseUrl+'/v1/meta',{
    method:'GET',credentials:'omit',cache:'no-store',redirect:'error',
    headers:{Accept:'application/json'}
  });
  if(!response.ok)throw Error('API metadata unavailable');
  const meta=await response.json();
  const flags=meta?.live_services;
  for(const key of ['applications','verification','directory','engagements',
      'payments','legal_fee_custody','custody_dispatch','client_matter_storage']){
    if(flags?.[key]!==false)throw Error('Business feature is not disabled: '+key);
  }
}
async function signInAndVerify(){
  try {
    const result=await identity.loginPopup({scopes:[settings.apiScope],prompt:'select_account'});
    const account=result.account;
    if(!account)throw Error('No staging account returned');
    identity.setActiveAccount(account);
    const token=await identity.acquireTokenSilent({scopes:[settings.apiScope],account});
    if(typeof token.accessToken!=='string'||!token.accessToken)throw Error('No access token received');
    // A token is never displayed, stored, logged or sent anywhere but the intended Azure API.
    const response=await fetch(settings.apiBaseUrl+'/v1/diagnostics/auth',{
      method:'GET',credentials:'omit',cache:'no-store',redirect:'error',
      headers:{Accept:'application/json',Authorization:'Bearer '+token.accessToken}
    });
    if(!response.ok)throw Error('API token validation returned HTTP '+response.status);
    const body=await response.json();
    if(body?.authenticated!==true || body?.data_access!==false ||
      body?.professional_verification!==false ||
      Object.keys(body).some(key=>!['authenticated','environment','data_access',
        'professional_verification'].includes(key))){
      throw Error('Unexpected diagnostic response');
    }
    await checkMetadata();
    show(output,'PASS: Real Entra staging sign-in and API access-token verification completed. All business functions remain disabled.');
    logout.disabled=false;
  }catch{
    show(output,'Sign-in verification did not pass. Check approved redirect URIs, API scope, feature gate and permitted origin. No token or account details are displayed.',true);
  }
}
async function start(){
  try{
    settings=validatePortalConfig(window.LEXFLOW_PORTAL,location.origin);
    if(!settings.enabled){
      show(status,'Closed: staging login configuration is disabled. This is expected until an operator approves the test.');
      return;
    }
    identity=await PublicClientApplication.createPublicClientApplication({
      auth:{clientId:settings.clientId,authority:settings.authority,
        redirectUri:settings.redirectUri,navigateToLoginRequestUrl:false},
      cache:{cacheLocation:'sessionStorage'}
    });
    await identity.handleRedirectPromise();
    await checkMetadata();
    show(status,'Ready for a designated synthetic staging account. Business features remain disabled.');
    login.disabled=false;
  }catch{
    show(status,'Staging identity test unavailable. Configuration or business-gate validation failed.',true);
  }
}
login.addEventListener('click',signInAndVerify);
logout.addEventListener('click',async()=>{
  const account=identity?.getActiveAccount();
  if(!account)return;
  try{await identity.logoutPopup({account});show(output,'Signed out of staging identity check.');logout.disabled=true;}
  catch{show(output,'Unable to sign out; close the browser session.',true)}
});
start();
