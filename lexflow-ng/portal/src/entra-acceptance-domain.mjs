import {createRemoteJWKSet,jwtVerify} from 'jose';

const tenant='5ddfd479-a3cb-4ff7-bdd8-9d745c4309b7';
const portalClient='c0ec48d2-b103-4f62-950a-e3d6c65bb55d';
const apiAudience='e0db88c1-c50d-48ff-985d-df0a01a222d4';
const authority='https://lexflowngstaging.ciamlogin.com/';
const issuer='https://'+tenant+'.ciamlogin.com/'+tenant+'/v2.0';
const jwksUri='https://lexflowngstaging.ciamlogin.com/'+tenant+'/discovery/v2.0/keys';
const scope='api://'+apiAudience+'/access_as_user';
const exactOrigin='https://legal.bsoedu.org';
const exactPath='/lexflow-ng/portal/identity-check.html';
const azureHostname=/^lexflowstg-api\.[a-z0-9-]+(?:\.[a-z0-9-]+)*\.azurecontainerapps\.io$/i;

export function validateAcceptanceConfig(raw,origin=exactOrigin,pathname=exactPath){
  if(!raw||raw.enabled!==true)return Object.freeze({enabled:false});
  if(origin!==exactOrigin||pathname!==exactPath)
    throw Error('Use the approved LexFlow test website and registered redirect path');
  if(raw.authority!==authority||raw.issuer!==issuer||
      raw.jwksUri!==jwksUri||raw.clientId!==portalClient||
      raw.tenantId!==tenant||raw.apiAudience!==apiAudience||
      raw.apiScope!==scope||raw.redirectUri!==exactOrigin+exactPath)
    throw Error('Test identity configuration does not match the approved Entra tenant and SPA');
  let api;
  try{api=new URL(raw.apiBaseUrl);}catch{throw Error('Invalid Azure API origin');}
  if(api.protocol!=='https:'||!azureHostname.test(api.hostname)||api.port||
     api.pathname!=='/'||api.search||api.hash||api.username||api.password)
    throw Error('Refusing to send tokens outside the LexFlow staging API');
  if(raw.apiProbe!==true&&raw.apiProbe!==false)
    throw Error('API diagnostic permission must be explicit');
  return Object.freeze({enabled:true,authority,issuer,jwksUri,
    clientId:portalClient,tenantId:tenant,apiAudience,apiScope:scope,
    redirectUri:exactOrigin+exactPath,apiBaseUrl:api.origin,apiProbe:raw.apiProbe});
}
export function checkAccessTokenClaims(payload,config){
  if(!payload||typeof payload!=='object')throw Error('Access-token claims are missing');
  if(typeof payload.sub!=='string'||payload.sub.length<3||payload.sub.length>250)
    throw Error('Access-token subject is absent');
  if(payload.tid!==undefined&&payload.tid!==config.tenantId)
    throw Error('Access token belongs to another Entra tenant');
  const scopes=typeof payload.scp==='string'?payload.scp.split(/\s+/):[];
  if(!scopes.includes('access_as_user'))
    throw Error('Delegated LexFlow API access scope is absent');
  if(payload.azp!==undefined&&payload.azp!==config.clientId)
    throw Error('Access token was issued to another SPA');
  if(!Number.isInteger(payload.exp)||!Number.isInteger(payload.iat))
    throw Error('Access token expiry or issue time is absent');
  return payload.sub;
}
export async function verifyGenuineToken(token,config,{
  verify=jwtVerify,keyFactory=createRemoteJWKSet
}={}){
  if(typeof token!=='string'||token.split('.').length!==3)
    throw Error('Missing JWT access token');
  if(config?.enabled!==true)throw Error('Identity test is disabled');
  const {payload}=await verify(token,keyFactory(new URL(config.jwksUri)),{
    issuer:config.issuer,audience:config.apiAudience,
    algorithms:['RS256','ES256'],clockTolerance:5
  });
  const subject=checkAccessTokenClaims(payload,config);
  return {subject,delegatedScopeConfirmed:true,issuerConfirmed:true,signatureConfirmed:true};
}
export async function fingerprintSubject(subject,salt,cryptoImpl=globalThis.crypto){
  if(typeof salt!=='string'||!/^[0-9a-f]{32}$/i.test(salt))throw Error('Invalid session salt');
  if(typeof subject!=='string'||!subject.trim())throw Error('Missing subject');
  const content=new TextEncoder().encode('lexflow-entra-test-v1:'+salt+':'+subject);
  const digest=await cryptoImpl.subtle.digest('SHA-256',content);
  return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
export function verifyDiagnosticResponse(body){
  if(!body||typeof body!=='object'||Array.isArray(body))throw Error('Invalid API response');
  const keys=Object.keys(body).sort();
  if(JSON.stringify(keys)!==JSON.stringify(['authenticated','data_access','environment','professional_verification'].sort())||
     body.authenticated!==true||body.environment!=='staging-acceptance'||
     body.data_access!==false||body.professional_verification!==false)
    throw Error('Diagnostic returned unexpected identity or data access fields');
  return true;
}
