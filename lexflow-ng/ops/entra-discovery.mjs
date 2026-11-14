import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import process from 'node:process';

const self=fileURLToPath(import.meta.url);
const configFile=new URL('./entra-staging-public-config.json',import.meta.url);
const guid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const requiredKeys=['issuer','authorization_endpoint','token_endpoint','jwks_uri'];
const assertion=(condition,message)=>{if(!condition)throw Error(message);};

function exactHttps(raw,hostname,pathname){
  let url;
  try{url=new URL(raw)}catch{throw Error('Invalid HTTPS URL in identity metadata');}
  assertion(url.protocol==='https:' && url.hostname===hostname && url.pathname===pathname &&
    !url.username && !url.password && !url.port && !url.search && !url.hash,
    'Unexpected host, path or protocol in identity metadata');
  return url.href;
}
export function validateConfiguration(config){
  assertion(config && guid.test(config.tenantId),'Invalid staging tenant ID');
  const identityHost='lexflowngstaging.ciamlogin.com';
  exactHttps(config.authority,identityHost,'/');
  exactHttps(config.expectedIssuer,config.tenantId+'.ciamlogin.com',
    '/'+config.tenantId+'/v2.0');
  exactHttps(config.expectedJwksUri,identityHost,
    '/'+config.tenantId+'/discovery/v2.0/keys');
  assertion(guid.test(config.apiAudience) && guid.test(config.portalClientId),
    'Invalid public API or SPA client ID');
  assertion(config.apiAudience!==config.portalClientId,
    'SPA and API registrations must be distinct');
  assertion(config.apiScope==='api://'+config.apiAudience+'/access_as_user',
    'API delegated scope does not match audience registration');
  exactHttps(config.callbackOrigin,'legal.bsoedu.org','/');
  return Object.freeze({...config,
    discoveryUrl:'https://'+identityHost+'/'+config.tenantId+
      '/v2.0/.well-known/openid-configuration'});
}
function verifyEndpoint(url,host,tenant,pathPrefix){
  let parsed;
  try{parsed=new URL(url)}catch{throw Error('Invalid provider endpoint');}
  assertion(parsed.protocol==='https:' && !parsed.username && !parsed.password &&
    !parsed.port && !parsed.search && !parsed.hash &&
    parsed.hostname===host && parsed.pathname.startsWith('/'+tenant+pathPrefix),
    'Provider endpoint does not belong to the expected staging tenant');
}
export function validateDiscovery(data,keys,conf){
  const cfg=validateConfiguration(conf);
  assertion(data && typeof data==='object' && !Array.isArray(data),
    'Provider OIDC discovery must be a JSON object');
  for(const k of requiredKeys)assertion(typeof data[k]==='string'&&data[k].length>0,
    'OIDC discovery missing '+k);
  assertion(data.issuer===cfg.expectedIssuer,
    'OIDC issuer differs from the API validation configuration');
  assertion(data.jwks_uri===cfg.expectedJwksUri,
    'OIDC signing keys URL differs from API configuration');
  const host='lexflowngstaging.ciamlogin.com';
  verifyEndpoint(data.authorization_endpoint,host,cfg.tenantId,'/oauth2/v2.0/authorize');
  verifyEndpoint(data.token_endpoint,host,cfg.tenantId,'/oauth2/v2.0/token');
  // Every signing key should be public, intended for signing, and from the
  // provider endpoint; no private JWK fields are acceptable.
  assertion(keys && Array.isArray(keys.keys) && keys.keys.length>0,
    'The published JWKS is empty');
  for(const key of keys.keys){
    assertion(['RSA','EC'].includes(key.kty) &&
      typeof key.kid==='string' && key.kid.length>0,
      'Invalid public signing key');
    assertion(!['d','p','q','dp','dq','qi','oth'].some(privateField=>privateField in key),
      'Private JWK material found in public JWKS');
  }
  const unique=new Set(keys.keys.map(x=>x.kid));
  assertion(unique.size===keys.keys.length,'Duplicate signing key IDs');
  return {result:'PASS: Entra External ID staging OIDC discovery',
    tenant:'LexFlow NG Staging',
    issuerMatchesBackend:true,jwksMatchesBackend:true,
    keysAvailable:keys.keys.length,
    scopeMappingValid:true,
    note:'Public discovery only. No account was signed in or token validated.'};
}
async function fetchJson(url,fetchImpl=fetch){
  const res=await fetchImpl(url,{method:'GET',redirect:'manual',
    headers:{Accept:'application/json'},signal:AbortSignal.timeout(20000)});
  assertion(res.status===200,'OIDC endpoint returned '+res.status);
  const type=res.headers?.get('content-type')??'application/json';
  assertion(type.includes('json'),'OIDC endpoint must return JSON');
  const text=await res.text();
  assertion(text.length<262144,'OIDC metadata response is too large');
  return JSON.parse(text);
}
export async function checkIdentity(config,{fetchImpl=fetch}={}){
  const conf=validateConfiguration(config);
  const discovery=await fetchJson(conf.discoveryUrl,fetchImpl);
  const publicKeys=await fetchJson(conf.expectedJwksUri,fetchImpl);
  return validateDiscovery(discovery,publicKeys,config);
}
async function main(){
  const conf=JSON.parse(await readFile(configFile,'utf8'));
  const result=await checkIdentity(conf);
  process.stdout.write(JSON.stringify(result,null,2)+'\n');
}
if(process.argv[1]===self)main().catch(e=>{
  process.stderr.write('FAIL: CIAM staging discovery: '+e.message+'\n');
  process.exitCode=1;
});
