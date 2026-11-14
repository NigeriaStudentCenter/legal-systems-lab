import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import https from 'node:https';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import pg from 'pg';
import {makeDb} from '../src/db.mjs';
import {buildApp} from '../src/app.mjs';
import {InputError} from '../src/domain.mjs';

// Synthetic E2E only. The in-memory MSAL test double is never shipped.
const portal=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../portal');
let origin;
const apiOrigin='https://api.lexflow-e2e.test';
const stub=[
 'export class PublicClientApplication {',
 'static async createPublicClientApplication(){return new PublicClientApplication()}',
 'getAllAccounts(){return this.user?[this.user]:[]}',
 'getActiveAccount(){return this.user||null}',
 'setActiveAccount(a){this.user=a}',
 'async handleRedirectPromise(){return null}',
 'async loginPopup(){this.user={username:"Synthetic "+window.__E2E_PERSONA,homeAccountId:window.__E2E_PERSONA};return {account:this.user}}',
 'async acquireTokenSilent(){return {accessToken:"synthetic-"+window.__E2E_PERSONA}}',
 'async acquireTokenPopup(){return this.acquireTokenSilent()}',
 'async logoutPopup(){this.user=null}',
 '}'
].join('\n');

const database=process.env.TEST_DATABASE_URL;
const run=database?test:test.skip;
run('real API and PostgreSQL with synthetic Playwright client/lawyer browser journey',async()=>{
  if(process.env.LEXFLOW_E2E_SANDBOX!=='YES')throw Error('E2E sandbox flag required');
  const url=new URL(database);
  if(!['localhost','127.0.0.1'].includes(url.hostname)||url.pathname!=='/lexflow_e2e')
    throw Error('Only local dedicated lexflow_e2e database can be used');
  const admin=new pg.Pool({connectionString:database});
  let db,api,browser,server,certDir;
  try{
    for(const name of ['001_initial.sql','002_engagements.sql'])
      await admin.query(await readFile(new URL('../sql/'+name,import.meta.url),'utf8'));
    await admin.query('TRUNCATE invoices, engagements, payment_detail_reviews, lawyer_payment_details, audit_events, verification_reviews, lawyer_applications, app_users RESTART IDENTITY CASCADE');
    db=makeDb({databaseUrl:database,databaseSsl:false});
    const today=new Date().toISOString().slice(0,10);
    const later=new Date(Date.now()+60*86400000).toISOString().slice(0,10);
    const tomorrow=new Date(Date.now()+86400000).toISOString().slice(0,10);
    await admin.query("INSERT INTO app_users(oidc_subject,role) VALUES ('e2e-reviewer-one','reviewer'),('e2e-reviewer-two','reviewer'),('e2e-publisher','publisher'),('e2e-stranger','client')");
    const a=await db.apply('e2e-lawyer',{full_name:'Synthetic Law Office',state:'Lagos',city:'Ikeja',year_of_call:2020,
      practice_areas:['Employment'],languages:['English'],summary:'Fictional law office for isolated browser and API testing only.',
      privacy_acknowledged:true,verification_authorised:true});
    const evidence={decision:'approve',source:'nba_annual_list',reference:'SYNTHETIC-TEST-001',checked_on:today,valid_until:later};
    await db.review('e2e-reviewer-one',a.id,evidence);
    await db.review('e2e-reviewer-two',a.id,{...evidence,reference:'SYNTHETIC-TEST-002'});
    await db.publish('e2e-publisher',a.id);
    const p=await db.savePaymentDetails('e2e-lawyer',{method:'bank_transfer',account_name:'Synthetic Law Office',
      bank_name:'Example Training Bank',account_number:'0123456789',payment_url:null});
    await db.reviewPaymentDetails('e2e-reviewer-one',p.id,{decision:'approve',name_match_confirmed:true});
    await db.reviewPaymentDetails('e2e-reviewer-two',p.id,{decision:'approve',name_match_confirmed:true});

    const allowedOrigins=[];
    api=await buildApp({config:{allowedOrigins,
      gates:{applications:false,verification:false,publication:false,directory:true,engagements:true}},
      db,authenticate:async request=>{
        const token=request.headers.authorization;
        if(!/^Bearer synthetic-(client|lawyer|stranger)$/.test(token||''))
          throw new InputError('Authentication required',401);
        return {subject:'e2e-'+token.slice('Bearer synthetic-'.length)};
      }});
    const bundled=await build({entryPoints:[path.join(portal,'src/engagements.mjs')],
      bundle:true,format:'esm',platform:'browser',write:false,plugins:[{
        name:'synthetic-entra-only-in-test',
        setup(b){
          b.onResolve({filter:/^@azure\/msal-browser$/},()=>({path:'fake-entra',namespace:'synthetic'}));
          b.onLoad({filter:/.*/,namespace:'synthetic'},()=>({contents:stub,loader:'js'}));
        }
      }]
    });
    // Host actual portal assets on an ephemeral local HTTPS server.
    // Synthetic browser auth and API forwarding stay isolated from staging.
    const files=new Map([
      ['/client.html',['text/html',await readFile(path.join(portal,'client.html'))]],
      ['/lawyer.html',['text/html',await readFile(path.join(portal,'lawyer.html'))]],
      ['/portal.css',['text/css',await readFile(path.join(portal,'portal.css'))]],
      ['/engagements.css',['text/css',await readFile(path.join(portal,'engagements.css'))]],
      ['/dist/engagements.js',['application/javascript',bundled.outputFiles[0].contents]]
    ]);
    certDir=await mkdtemp(path.join(os.tmpdir(),'lexflow-e2e-'));
    execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-sha256',
      '-keyout',path.join(certDir,'localhost.key'),'-out',path.join(certDir,'localhost.crt'),
      '-days','1','-subj','/CN=localhost'],{stdio:'ignore'});
    server=https.createServer({
      key:await readFile(path.join(certDir,'localhost.key')),
      cert:await readFile(path.join(certDir,'localhost.crt'))
    },(req,res)=>{
      const item=files.get(new URL(req.url,'https://localhost').pathname);
      if(!item){res.writeHead(404);res.end('Unknown synthetic asset');return;}
      res.writeHead(200,{'Content-Type':item[0],'Cache-Control':'no-store'});
      res.end(item[1]);
    });
    await new Promise((resolve,reject)=>{
      server.once('error',reject);
      server.listen(0,'127.0.0.1',resolve);
    });
    origin='https://127.0.0.1:'+server.address().port;
    allowedOrigins.push(origin);
    const clientID='12345678-1234-4234-8234-123456789abc';
    files.set('/config.js',['application/javascript',Buffer.from(
      'window.LEXFLOW_PORTAL='+JSON.stringify({
        enabled:true,authority:'https://testing.ciamlogin.com/',clientId:clientID,
        apiScope:'api://'+clientID+'/access_as_user',apiBaseUrl:apiOrigin,
        redirectUri:origin+'/client.html'
      })+';'
    )]);
    const apiHandler=async route=>{
      console.log('E2E API:',route.request().method(),route.request().url());
      const r=route.request(),location=new URL(r.url());
      const injected=await api.inject({method:r.method(),url:location.pathname+location.search,
        headers:{...r.headers(),origin},...(r.postData()?{payload:r.postData()}:{})});
      console.log('E2E injected response',location.pathname,injected.statusCode,injected.body.slice(0,500));
      await route.fulfill({status:injected.statusCode,
        headers:{'access-control-allow-origin':origin,'access-control-allow-headers':'Authorization,Content-Type',
          'access-control-allow-methods':'GET,POST,PUT,OPTIONS','content-type':injected.headers['content-type']||'application/json'},
        body:injected.body});
    };
    browser=await chromium.launch({headless:true,args:['--no-sandbox']});
    const client=await browser.newPage({ignoreHTTPSErrors:true});
    const lawyer=await browser.newPage({ignoreHTTPSErrors:true});
    await client.addInitScript(()=>window.__E2E_PERSONA='client');
    await lawyer.addInitScript(()=>window.__E2E_PERSONA='lawyer');
    for(const page of [client,lawyer]){
      await page.route(apiOrigin+'/**',apiHandler);
    }
    await client.goto(origin+'/client.html',{waitUntil:'domcontentloaded',timeout:12000});
    await lawyer.goto(origin+'/lawyer.html',{waitUntil:'domcontentloaded',timeout:12000});
    console.log('Client startup:',await client.locator('#engagementSystemStatus').innerText(),'signInDisabled=',await client.locator('#engagementSignIn').isDisabled());
    console.log('Lawyer startup:',await lawyer.locator('#engagementSystemStatus').innerText(),'signInDisabled=',await lawyer.locator('#engagementSignIn').isDisabled());
    await client.getByRole('button',{name:'Sign in'}).click();
    await lawyer.getByRole('button',{name:'Sign in'}).click();
    await client.getByText('No client requests associated with this authenticated account.').waitFor();
    await client.getByRole('button',{name:'Search verified directory'}).click();
    await client.getByText('Synthetic Law Office').first().waitFor();
    await client.getByRole('button',{name:'Choose lawyer'}).click();
    await client.locator('#enquiryName').fill('Synthetic Client');
    await client.locator('#enquiryContact').fill('client@example.test');
    await client.locator('#directFeeAck').check();
    await client.getByRole('button',{name:'Request consultation'}).click();
    await client.getByText(/Request .* submitted/).waitFor();

    const stranger=await api.inject({url:'/v1/engagements',headers:{authorization:'Bearer synthetic-stranger',origin}});
    assert.equal(stranger.statusCode,200);
    assert.deepEqual(stranger.json().engagements,[]);

    await lawyer.getByRole('button',{name:'Refresh'}).click();
    await lawyer.getByText('Synthetic Client').first().waitFor();
    await lawyer.getByRole('button',{name:'Open request'}).click();
    await lawyer.locator('#conflictCheck').check();
    await lawyer.getByRole('button',{name:'Accept request'}).click();
    await lawyer.getByText(/Engagement updated: accepted/).waitFor();
    await lawyer.locator('#invoiceReference').fill('E2E-001');
    await lawyer.locator('#invoiceAmount').fill('25000.50');
    await lawyer.locator('#invoiceDueDate').fill(tomorrow);
    await lawyer.getByRole('button',{name:'Issue lawyer invoice'}).click();
    await lawyer.getByText(/Lawyer invoice E2E-001 issued/).waitFor();
    lawyer.once('dialog',dialog=>dialog.accept());
    await lawyer.getByRole('button',{name:'Report funds received'}).click();
    await lawyer.getByText(/Lawyer reports receiving payment/).first().waitFor();

    await client.getByRole('button',{name:'Refresh'}).click();
    await client.getByRole('button',{name:'Invoices and updates'}).click();
    await client.getByText(/Lawyer reports receiving payment/).first().waitFor();
    await client.getByRole('button',{name:'Confirm my payment'}).click();
    await client.getByText(/Client agrees payment was made/).first().waitFor();
    await client.getByRole('button',{name:'View reported receipt'}).click();
    await client.waitForFunction(()=>(document.querySelector('#receiptBody')?.textContent||'').includes('did not receive, hold, process or verify'));
    const receipt=await client.locator('#receiptBody').innerText();
    assert.match(receipt,/25,000\.50/);
    assert.match(receipt,/did not receive, hold, process or verify/i);
    assert.match(receipt,/Confirmed by client/);
    const audit=await admin.query("SELECT action FROM audit_events WHERE action IN ('engagement_requested','engagement_accepted','invoice_issued','invoice_reported_paid','invoice_client_confirmed') ORDER BY recorded_at,id");
    assert.deepEqual(audit.rows.map(r=>r.action),['engagement_requested','engagement_accepted','invoice_issued','invoice_reported_paid','invoice_client_confirmed']);
  }finally{
    if(browser)await browser.close();
    if(api)await api.close();
    if(db)await db.close();
    if(server)await new Promise(resolve=>server.close(resolve));
    if(certDir)await rm(certDir,{recursive:true,force:true});
    await admin.end();
  }
});
