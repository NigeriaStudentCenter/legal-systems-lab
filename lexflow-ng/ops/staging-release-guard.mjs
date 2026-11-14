import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';
import path from 'node:path';

const dir=path.dirname(fileURLToPath(import.meta.url));
const identity=JSON.parse(readFileSync(path.join(dir,'entra-staging-public-config.json'),'utf8'));
const gates=['ENABLE_APPLICATIONS','ENABLE_VERIFICATION','ENABLE_PUBLICATION','ENABLE_DIRECTORY','ENABLE_ENGAGEMENTS','ENABLE_AUTH_DIAGNOSTIC'];
const APP='lexflowstg-api';
const GROUP='lexflow-staging-rg';
const IMG=/^ghcr\.io\/nigeriastudentcenter\/lexflow-ng-api@sha256:[a-f0-9]{64}$/i;
const fail=msg=>{throw Error('Refusing LexFlow staging release: '+msg);};
const need=(value,message)=>{if(!value)fail(message);};
export function validateExistingApp(raw,{expectedImage,requireAuthGate=false}={}){
  const app=typeof raw==='string'?JSON.parse(raw):raw;
  need(app && typeof app==='object','missing Azure Container App response');
  need(app.name===APP,'unexpected app name');
  need(String(app.id||'').toLowerCase().includes('/resourcegroups/'+GROUP.toLowerCase()+'/providers/microsoft.app/containerapps/'+APP),
    'unexpected Azure resource group or ID');
  const properties=app.properties||{};
  need(properties.configuration?.ingress?.external===true &&
    properties.configuration?.ingress?.allowInsecure!==true,
    'expected synthetic-only Azure Container App HTTPS ingress');
  need(properties.configuration?.activeRevisionsMode==='Single',
    'staging must use single active revision');
  const containers=properties.template?.containers;
  need(Array.isArray(containers)&&containers.length===1&&containers[0].name==='lexflow-api',
    'unexpected API container topology');
  const container=containers[0];
  need(IMG.test(container.image),'running image must be immutable approved GHCR digest');
  if(expectedImage)need(container.image===expectedImage,'deployed image differs from approved digest');
  const env=container.env;
  need(Array.isArray(env),'environment configuration missing');
  const duplicate=new Set();
  const variables=new Map();
  for(const e of env){
    need(typeof e.name==='string' && !duplicate.has(e.name),'duplicate/invalid environment key');
    duplicate.add(e.name);variables.set(e.name,e);
  }
  for(const flag of gates){
    const value=variables.get(flag)?.value;
    if(flag==='ENABLE_AUTH_DIAGNOSTIC'&&!requireAuthGate&&value===undefined)continue;
    need(value==='false','unexpected enabled or missing gate: '+flag);
  }
  need(variables.get('NODE_ENV')?.value==='production','NODE_ENV is not set');
  need(variables.get('DATABASE_SSL')?.value==='true','database TLS disabled');
  // Azure CLI updates echo secret-backed variables back as value:"" (or null) beside the
  // secretRef. That carries no secret; any non-empty value is still refused.
  const dbValue=variables.get('DATABASE_URL')?.value;
  need(variables.get('DATABASE_URL')?.secretRef==='database-url' &&
    (dbValue===undefined||dbValue===null||dbValue===''),
    'database connection must be secretRef without a plain-text value');
  need(variables.get('OIDC_ISSUER')?.value===identity.expectedIssuer,'identity issuer drift');
  need(variables.get('OIDC_AUDIENCE')?.value===identity.apiAudience,'identity audience drift');
  need(variables.get('OIDC_JWKS_URI')?.value===identity.expectedJwksUri,'identity signing keys drift');
  need(variables.get('ALLOWED_ORIGINS')?.value===identity.callbackOrigin,'unexpected CORS origin');
  return {ok:true,image:container.image,allBusinessGatesDisabled:true,
    authDiagnosticDisabled: variables.get('ENABLE_AUTH_DIAGNOSTIC')?.value==='false',
    appName:APP,group:GROUP};
}
function main(){
  const input=fs.readFileSync(0,'utf8');
  const expected=process.env.LEXFLOW_EXPECTED_IMAGE||undefined;
  const result=validateExistingApp(input,{expectedImage:expected,
    requireAuthGate:process.env.LEXFLOW_REQUIRE_AUTH_GATE==='true'});
  const githubEnv=process.env.GITHUB_ENV;
  if(githubEnv && process.env.LEXFLOW_SAVE_OLD_IMAGE==='true'){
    fs.appendFileSync(githubEnv,'LEXFLOW_OLD_IMAGE='+result.image+'\n');
  }
  process.stdout.write('PASS: Azure staging container identity, immutable image and closed business gates verified.\n');
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  try{main()}catch(e){process.stderr.write(e.message+'\n');process.exitCode=1;}
}
