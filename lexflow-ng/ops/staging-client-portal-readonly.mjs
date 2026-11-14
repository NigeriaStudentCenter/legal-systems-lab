import {readFile, writeFile, mkdtemp, rm} from 'node:fs/promises';
import https from 'node:https';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
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

export async function verifyClosedPortalBrowser(baseInput,{
  chromiumImpl, buildImpl, readFileImpl=readFile,fetchImpl=fetch
}={}){
  // Chromium is served by a loopback-only ephemeral HTTPS origin. Earlier tests
  // timed out navigating to the remote staging website even with route.fulfill().
  // This preview must never be published or used for real user sign-in.
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
    files.set('/lexflow-ng/portal/'+name,[kind,await readFileImpl(path.join(portalRoot,name))]);
  }
  files.set('/lexflow-ng/portal/dist/engagements.js',
    ['application/javascript',built.outputFiles[0].contents]);

  let browser,server,certDir;
  const screens=[];
  try{
    certDir=await mkdtemp(path.join(os.tmpdir(),'lexflow-portal-acceptance-'));
    const privateKey=path.join(certDir,'loopback.key');
    const certificate=path.join(certDir,'loopback.crt');
    execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-sha256',
      '-keyout',privateKey,'-out',certificate,'-days','1',
      '-subj','/CN=127.0.0.1'],{stdio:'ignore'});
    server=https.createServer({
      key:await readFileImpl(privateKey),
      cert:await readFileImpl(certificate)
    },async (req,res)=>{
      try{
        const target=new URL(req.url,'https://localhost');
        // The preview serves a closed allowlist, not an open reverse proxy.
        if(req.method!=='GET'||target.search||target.hash){
          res.writeHead(405);res.end('Test-only method or path not allowed');return;
        }
        if(target.pathname==='/v1/meta'){
          // Only public metadata is relayed from the genuine Azure staging API.
          // Origin and preflight security are separately verified by verifyCors().
          const upstream=await fetchImpl(base+'/v1/meta',{
            method:'GET',redirect:'manual',cache:'no-store',
            headers:{Accept:'application/json',Origin:siteOrigin},
            signal:AbortSignal.timeout(20000)
          });
          if(upstream.status!==200){
            res.writeHead(502);res.end('Azure staging metadata did not return HTTP 200');return;
          }
          const body=Buffer.from(await upstream.arrayBuffer());
          if(body.byteLength>262144){
            res.writeHead(502);res.end('Metadata exceeded test limit');return;
          }
          res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
          res.end(body);return;
        }
        const file=files.get(target.pathname);
        if(!file){res.writeHead(404);res.end('Unknown staging preview asset');return;}
        res.writeHead(200,{'Content-Type':file[0],'Cache-Control':'no-store'});
        res.end(file[1]);
      }catch{
        res.writeHead(502);res.end('Staging preview request failed');
      }
    });
    await new Promise((resolve,reject)=>{
      server.once('error',reject);
      server.listen(0,'127.0.0.1',resolve);
    });
    const previewOrigin='https://127.0.0.1:'+server.address().port;
    files.set('/lexflow-ng/portal/config.js',['application/javascript',Buffer.from(
      'window.LEXFLOW_PORTAL=Object.freeze('+JSON.stringify({
        enabled:true,authority:identity.authority,clientId:identity.portalClientId,
        apiScope:identity.apiScope,apiBaseUrl:previewOrigin,
        redirectUri:previewOrigin+'/lexflow-ng/portal/register.html'
      })+');'
    )]);

    browser=await chromium.launch({headless:true,args:['--no-sandbox']});
    for(const name of ['client.html','lawyer.html']){
      const page=await browser.newPage({ignoreHTTPSErrors:true});
      const errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.goto(previewOrigin+'/lexflow-ng/portal/'+name,{
        waitUntil:'domcontentloaded',timeout:15000
      });
      await page.waitForFunction(
        ()=>(document.querySelector('#engagementSystemStatus')?.textContent||'')
          .includes('Staging client–lawyer workflows are disabled'),
        {timeout:20000}
      );
      expect(await page.locator('#engagementSignIn').isDisabled(),
        name+': sign-in unexpectedly enabled while business gates are closed');
      expect(await page.locator(name==='client.html'?'#clientEnquiryFields':'#invoiceFields').isDisabled(),
        name+': business input fields unexpectedly enabled');
      expect(!errors.length,name+': browser JavaScript error occurred: '+errors.join('; '));
      screens.push({screen:name,load:'PASS',business_controls:'disabled'});
      await page.close();
    }
    return {result:'PASS: closed client and lawyer portal rendering against real Azure metadata',
      browser:'Chromium with local HTTPS preview; real Azure metadata relayed read-only',
      origin_verification:'Azure browser CORS verified separately by HTTP requests',
      user_login:'not performed',screens};
  }finally{
    if(browser)await browser.close();
    if(server)await new Promise(resolve=>server.close(resolve));
    if(certDir)await rm(certDir,{recursive:true,force:true});
  }
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
