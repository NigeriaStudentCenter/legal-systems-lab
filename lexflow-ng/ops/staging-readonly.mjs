import {mkdir, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import process from 'node:process';

// NEVER sends credentials, IDs, legal facts, or anything that can change Azure data.
// The only allowed destination is the specific LexFlow staging Container App FQDN.
const EXPECTED_HOST=/^lexflowstg-api\.[a-z0-9-]+(?:\.[a-z0-9-]+)*\.azurecontainerapps\.io$/i;
const ROUTES=[
  ['/healthz',200],['/readyz',200],['/v1/meta',200],
  ['/v1/directory',503],['/v1/applications/me',503],
  ['/v1/verification/queue',503],['/v1/engagements',503],
  ['/v1/payment-details/me',503],
  ['/v1/invoices/00000000-0000-4000-8000-000000000000/receipt',503]
];
const CLOSED=['applications','verification','directory','engagements','payments',
  'legal_fee_custody','custody_dispatch','client_matter_storage'];
export function validateBaseUrl(input){
  if(typeof input!=='string'||!input.trim())throw Error('Staging base URL is not configured');
  let parsed;
  try {parsed=new URL(input);} catch {throw Error('Invalid staging base URL');}
  if(parsed.protocol!=='https:'||parsed.port||parsed.pathname!=='/'||
    parsed.search||parsed.hash||parsed.username||parsed.password||
    !EXPECTED_HOST.test(parsed.hostname)){
    throw Error('Refusing to contact an address outside LexFlow Azure Container Apps staging');
  }
  return parsed.origin;
}
function expectation(ok,message){
  if(!ok)throw Error(message);
}
export async function inspectStaging(baseInput,{fetchImpl=fetch}={}){
  const base=validateBaseUrl(baseInput);
  const statusByRoute={};
  let meta=null;
  for(const [path,statusExpected] of ROUTES){
    const response=await fetchImpl(base+path,{
      method:'GET',redirect:'manual',cache:'no-store',
      headers:{Accept:'application/json'},
      signal:AbortSignal.timeout(40000)
    });
    expectation(response.status===statusExpected,
      path+' expected HTTP '+statusExpected+' but received '+response.status);
    statusByRoute[path]=response.status;
    if(path==='/healthz'){
      const body=await response.json();
      expectation(body.product==='lexflow-ng-api'&&body.status==='running',
        'Staging health check did not match LexFlow API');
    }
    if(path==='/readyz'){
      const body=await response.json();
      expectation(body.status==='ready','Staging database is not ready');
    }
    if(path==='/v1/meta'){
      const body=await response.json();
      expectation(Array.isArray(body.jurisdictions)&&body.jurisdictions.length===37,
        'Missing expected Nigerian state/FCT jurisdictions');
      expectation(body.live_services&&typeof body.live_services==='object',
        'Missing explicit feature gate report');
      for(const flag of CLOSED){
        expectation(body.live_services[flag]===false,
          'Unexpectedly enabled live feature: '+flag);
      }
      // Legacy meta may not include "publication" but current staging API should.
      expectation(body.live_services.publication===undefined||body.live_services.publication===false,
        'Publication must not be enabled');
      meta={all_business_features_disabled:true,jurisdiction_count:body.jurisdictions.length};
    }
  }
  return Object.freeze({
    result:'PASS: read-only Azure staging inspection',
    checked_at:new Date().toISOString(),
    service:'lexflowstg-api',
    identity:'no user credentials or tokens sent',
    endpoints:statusByRoute,
    feature_gates:meta,
    scope:'synthetic-only shared Azure staging; no client/lawyer data was used',
    limitations:'Does not test Entra browser login, live engagement journey, or security approval'
  });
}
async function main(){
  const report=await inspectStaging(process.env.LEXFLOW_STAGING_BASE_URL);
  const output=process.env.LEXFLOW_PREFLIGHT_REPORT||'';
  if(output){
    await mkdir(new URL('.', 'file://'+output).pathname,{recursive:true});
    await writeFile(output,JSON.stringify(report,null,2)+'\n',{mode:0o600});
  }
  process.stdout.write('PASS: LexFlow staging API and database ready; all business gates disabled.\n');
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  main().catch(e=>{
    process.stderr.write('FAIL: read-only staging acceptance: '+e.message+'\n');
    process.exitCode=1;
  });
}
