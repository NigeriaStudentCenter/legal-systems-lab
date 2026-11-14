import {readFile, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {inspectStaging, validateBaseUrl} from './staging-readonly.mjs';
import {validateConfiguration} from './entra-discovery.mjs';

const idFile=new URL('./entra-staging-public-config.json',import.meta.url);
const siteOrigin='https://legal.bsoedu.org';
const portalRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../portal');
const require=createRequire(new URL('../backend/package.json',import.meta.url));
const expect=(ok,message)=>{if(!ok)throw Error(message);};

export async function verifyCors(baseInput,{fetchImpl=fetch}={}){
  const base=validateBaseUrl(baseInput);
  const request=(url,origin,method='GET')=>fetchImpl(base+url,{
    method,redirect:'manual',cache:'no-store',
    headers:{Origin:origin,Accept:'application/json',
      ...(method==='OPTIONS'?{
        'Access-Control-Request-Method':'GET',
        'Access-Control-Request-Headers':'authorization'
      }:{})},
    signal:AbortSignal.timeout(25000)
  });
  const allowed=await request('/v1/meta',siteOrigin);
  expect(allowed.status===200,'Allowed-site metadata returned HTTP '+allowed.status);
  expect(allowed.headers.get('access-control-allow-origin')===siteOrigin,
    'Trusted staging site is missing a matching CORS allow-origin header');
  const blocked=await request('/v1/meta','https://malicious.invalid');
  expect(blocked.status===403,'Untrusted browser origin must be rejected');
  const preflight=await request('/v1/engagements',siteOrigin,'OPTIONS');
  expect(preflight.status===204 && preflight.headers.get('access-control-allow-origin')===siteOrigin,
    'Preflight must approve only the trusted site');
  expect((preflight.headers.get('access-control-allow-headers')||'').toLowerCase().includes('authorization'),
    'CORS preflight does not allow access token header');
  return {allowed_origin:siteOrigin,untrusted_origin_rejected:true,
    preflight_restricted:true,legal_client_data_used:false};
}

export async function verifyClosedPortalBrowser(baseInput,{chromiumImpl, buildImpl,readFileImpl=readFile}={}){
  const base=validateBaseUrl(baseInput);
  const identity=validateConfiguration(JSON.parse(await readFileImpl(idFile,'utf8')));
  expect(identity.callbackOrigin===siteOrigin,'Identity redirect origin is not the approved site');
  const {chromium}=chromiumImpl?{chromium:chromiumImpl}:require('playwright');
  const {build}=buildImpl?{build:buildImpl}:require('esbuild');
  const built=await build({
    entryPoints:[path.join(portalRoot,'src/engagements.mjs')],
    bundle:true,write:false,platform:'browser',format:'esm',target:'es2022',minify:true
  });
  expect(built.outputFiles?.length===1,'No compiled portal was produced');
  const files=new Map();
  for(const name of ['client.html','lawyer.html','portal.css','engagements.css']){
    const kind=name.endsWith('.css')?'text/css':'text/html';
    files.set(name,[kind,await readFileImpl(path.join(portalRoot,name))]);
  }
  files.set('dist/engagements.js',['application/javascript',built.outputFiles[0].contents]);
  files.set('config.js',['application/javascript',Buffer.from(
    'window.LEXFLOW_PORTAL=Object.freeze('+JSON.stringify({
      enabled:true,authority:identity.authority,clientId:identity.portalClientId,
      apiScope:identity.apiScope,apiBaseUrl:base,
      // Registered Entra callback is never visited because no sign-in is permitted.
      redirectUri:siteOrigin+'/lexflow-ng/portal/register.html'
    })+');'
  )]);
  let browser;
  const screens=[];
  try{
    browser=await chromium.launch({headless:true,args:['--no-sandbox']});
    for(const name of ['client.html','lawyer.html']){
      const page=await browser.newPage();
      const errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.route(siteOrigin+'/lexflow-ng/portal/**',async route=>{
        const requestUrl=new URL(route.request().url());
        const prefix='/lexflow-ng/portal/';
        expect(requestUrl.pathname.startsWith(prefix),'Unexpected static asset');
        const item=files.get(requestUrl.pathname.slice(prefix.length));
        if(!item){await route.fulfill({status:404,body:'Static preview asset not found'});return;}
        await route.fulfill({status:200,contentType:item[0],body:item[1]});
      });
      await page.goto(siteOrigin+'/lexflow-ng/portal/'+name,{waitUntil:'domcontentloaded',timeout:30000});
      await page.locator('#engagementSystemStatus').getByText(
        'Staging client–lawyer workflows are disabled',{exact:false}
      ).waitFor({timeout:35000});
      expect(await page.locator('#engagementSignIn').isDisabled(),
        name+': sign-in unexpectedly enabled while business gates are closed');
      expect(await page.locator(name==='client.html'?'#clientEnquiryFields':'#invoiceFields').isDisabled(),
        name+': business input fields unexpectedly enabled');
      expect(!errors.length,name+': browser JavaScript error occurred');
      screens.push({screen:name,load:'PASS',business_controls:'disabled'});
      await page.close();
    }
    return {result:'PASS: Azure public API with closed client and lawyer portal',
      browser:'real Chromium, production browser source; no token or account',
      identity_origin:siteOrigin,cors:'validated separately',screens};
  }finally{if(browser)await browser.close();}
}
async function main(){
  const base=process.env.LEXFLOW_STAGING_BASE_URL;
  const preflight=await inspectStaging(base);
  const cors=await verifyCors(base);
  const browser=await verifyClosedPortalBrowser(base);
  const result={preflight:{result:preflight.result,features:preflight.feature_gates},
    cors,browser,scope:'READ ONLY; no real sign-in, invoices, lawyer profiles or transactions'};
  if(process.env.LEXFLOW_ACCEPTANCE_REPORT){
    await writeFile(process.env.LEXFLOW_ACCEPTANCE_REPORT,JSON.stringify(result,null,2)+'\n',{mode:0o600});
  }
  process.stdout.write('PASS: Azure staging CORS and client/lawyer portals reject closed business features.\n');
}
if(process.argv[1]===fileURLToPath(import.meta.url))main().catch(e=>{
  process.stderr.write('FAIL: staged browser-to-Azure read-only inspection: '+e.message+'\n');
  process.exitCode=1;
});
