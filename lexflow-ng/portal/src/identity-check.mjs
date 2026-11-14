import {PublicClientApplication} from '@azure/msal-browser';
import {createMsal} from './msal-init.mjs';
import {validateAcceptanceConfig,verifyGenuineToken,fingerprintSubject,verifyDiagnosticResponse} from './entra-acceptance-domain.mjs';

const $=id=>document.getElementById(id);
const evidenceKey='lexflow.staging.entra.evidence.v1';
const pendingKey='lexflow.staging.entra.pending.v1';
const saltKey='lexflow.staging.entra.salt.v1';
const scenarios=['client','lawyer'];
let cfg,msal;

function message(id,text,failed=false){
  const element=$(id);
  if(!element)return;
  element.textContent=text;
  element.classList.toggle('error',failed);
}
function evidence(){
  try{
    const raw=JSON.parse(sessionStorage.getItem(evidenceKey)||'{}');
    return raw&&typeof raw==='object'?raw:{};
  }catch{return {};}
}
function save(e){sessionStorage.setItem(evidenceKey,JSON.stringify(e));}
function updateUi(){
  const state=evidence();
  message('clientResult',state.client?'PASS: genuine Entra client scenario verified.':'Not tested');
  message('lawyerResult',state.lawyer?'PASS: genuine Entra lawyer scenario verified.':'Not tested');
  const distinct=Boolean(state.client&&state.lawyer&&state.client!==state.lawyer);
  message('distinctResult',distinct?
    'PASS: Two distinct Entra subject identities authenticated with valid, signed delegated API tokens.':
    'Two distinct Entra identities have not yet been verified.');
  message('apiDiagnosticResult',cfg?.apiProbe?
    'API diagnostic is configured for the approved temporary test window.':
    'API diagnostic not tested. The Azure diagnostic remains disabled by default.');
  $('copyTestReport').disabled=!state.client&&!state.lawyer;
  $('testSignOut').disabled=!msal?.getActiveAccount();
}
function salt(){
  let value=sessionStorage.getItem(saltKey);
  if(!/^[0-9a-f]{32}$/i.test(value||'')){
    const bytes=crypto.getRandomValues(new Uint8Array(16));
    value=[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
    sessionStorage.setItem(saltKey,value);
  }
  return value;
}
async function requireClosedBusinessGates(){
  const response=await fetch(cfg.apiBaseUrl+'/v1/meta',{
    method:'GET',credentials:'omit',cache:'no-store',redirect:'error',
    headers:{Accept:'application/json'},signal:AbortSignal.timeout(18000)
  });
  if(response.status!==200)throw Error('Staging metadata is unavailable');
  const meta=await response.json();
  for(const key of ['applications','verification','directory','engagements','payments',
    'legal_fee_custody','custody_dispatch','client_matter_storage']){
    if(meta.live_services?.[key]!==false)
      throw Error('Business service is unexpectedly enabled');
  }
}
async function verifyRealLogin(loginResult){
  const persona=sessionStorage.getItem(pendingKey);
  sessionStorage.removeItem(pendingKey);
  if(!scenarios.includes(persona))throw Error('No permitted synthetic test scenario selected');
  if(!loginResult?.account)throw Error('Microsoft Entra returned no signed-in account');
  msal.setActiveAccount(loginResult.account);
  const tokenResult=loginResult.accessToken?loginResult:
    await msal.acquireTokenSilent({account:loginResult.account,scopes:[cfg.apiScope]});
  const checked=await verifyGenuineToken(tokenResult.accessToken,cfg);
  await requireClosedBusinessGates();
  const fingerprint=await fingerprintSubject(checked.subject,salt());
  const state=evidence();
  if((persona==='client'&&state.lawyer===fingerprint)||
     (persona==='lawyer'&&state.client===fingerprint)){
    throw Error('The same Entra identity was used twice; two different fictional accounts are required');
  }
  let apiChecked=false;
  if(cfg.apiProbe){
    const result=await fetch(cfg.apiBaseUrl+'/v1/diagnostics/auth',{
      method:'GET',redirect:'error',credentials:'omit',cache:'no-store',
      headers:{Accept:'application/json',Authorization:'Bearer '+tokenResult.accessToken},
      signal:AbortSignal.timeout(18000)
    });
    if(result.status!==200)throw Error('Azure authentication diagnostic refused the genuine bearer token');
    verifyDiagnosticResponse(await result.json());
    apiChecked=true;
  }
  state[persona]=fingerprint;
  state[persona+'Api']=apiChecked;
  save(state);
  message('identityCheckStatus','PASS: Real Microsoft Entra signature, issuer, audience and delegated API scope verified for the '+persona+' test scenario.');
  updateUi();
  if(apiChecked)message('apiDiagnosticResult','PASS: Azure staging API accepted this genuine access token; all business functions remain disabled.');
}
async function startScenario(persona){
  if(!scenarios.includes(persona)||!cfg?.enabled||!msal)return;
  try{
    await requireClosedBusinessGates();
    sessionStorage.setItem(pendingKey,persona);
    // Redirect flow with PKCE: avoids insecure ROPC and MSAL v5 popup bridge issues.
    await msal.loginRedirect({scopes:[cfg.apiScope],prompt:'login',
      redirectUri:cfg.redirectUri,redirectStartPage:cfg.redirectUri});
  }catch{
    sessionStorage.removeItem(pendingKey);
    message('identityCheckStatus','Microsoft Entra redirect could not start. Verify the approved redirect URI, user flow and staging settings.',true);
  }
}
async function signOut(){
  if(!msal)return;
  try{
    await msal.logoutRedirect({account:msal.getActiveAccount()||undefined,
      postLogoutRedirectUri:cfg.redirectUri});
  }catch{
    message('identityCheckStatus','Sign-out was not completed; close this private browser session.',true);
  }
}
function reset(){
  sessionStorage.removeItem(evidenceKey);
  sessionStorage.removeItem(pendingKey);
  sessionStorage.removeItem(saltKey);
  updateUi();
  message('identityCheckStatus','Local synthetic results cleared. Sign out separately before reusing this browser.');
}
async function copyReport(){
  const e=evidence();
  const distinct=Boolean(e.client&&e.lawyer&&e.client!==e.lawyer);
  const report=['LEXFLOW NG — ENTRA EXTERNAL ID STAGING',
    'Fictional client: '+(e.client?'SIGNED JWT VERIFIED':'NOT TESTED'),
    'Fictional lawyer: '+(e.lawyer?'SIGNED JWT VERIFIED':'NOT TESTED'),
    'Distinct accounts: '+(distinct?'YES':'NOT YET'),
    'Azure API diagnostic: '+(e.clientApi&&e.lawyerApi?'BOTH VERIFIED':'NOT BOTH VERIFIED'),
    'User roles and lawyer licence: NOT VERIFIED',
    'Legal engagements/payments: DISABLED',
    'No identifiers or tokens included'].join('\n');
  try{
    await navigator.clipboard.writeText(report);
    message('identityCheckStatus','Non-sensitive test results copied. No personal data or tokens were included.');
  }catch{
    message('identityCheckStatus','Clipboard unavailable; browser results remain visible on this page.',true);
  }
}
async function boot(){
  $('testClient').addEventListener('click',()=>startScenario('client'));
  $('testLawyer').addEventListener('click',()=>startScenario('lawyer'));
  $('testSignOut').addEventListener('click',signOut);
  $('resetIdentityTest').addEventListener('click',reset);
  $('copyTestReport').addEventListener('click',copyReport);
  try{
    cfg=validateAcceptanceConfig(window.LEXFLOW_IDENTITY_ACCEPTANCE,
      location.origin,location.pathname);
    if(!cfg.enabled){
      message('identityCheckStatus','Closed: the public site has disabled the synthetic identity test. This is the expected default.');
      return;
    }
    // Verify API gates before initiating any Entra sign-in attempt.
    await requireClosedBusinessGates();
    msal=await createMsal(PublicClientApplication,{
      auth:{clientId:cfg.clientId,authority:cfg.authority,
        knownAuthorities:['lexflowngstaging.ciamlogin.com'],
        redirectUri:cfg.redirectUri,navigateToLoginRequestUrl:false},
      cache:{cacheLocation:'sessionStorage'}
    });
    const response=await msal.handleRedirectPromise();
    if(response)await verifyRealLogin(response);
    else message('identityCheckStatus','Ready: choose a fictional client or lawyer to authenticate with the real Entra staging tenant.');
    $('testClient').disabled=false;$('testLawyer').disabled=false;
    updateUi();
  }catch{
    sessionStorage.removeItem(pendingKey);
    message('identityCheckStatus','Test not ready or sign-in verification failed. Confirm Entra redirect, API metadata, test-account separation and signing keys. No credentials are displayed.',true);
  }
}
boot();
