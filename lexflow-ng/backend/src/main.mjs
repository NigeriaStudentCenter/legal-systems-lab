import {readConfig} from './config.mjs';
import {makeDb} from './db.mjs';
import {makeAuthenticator} from './auth.mjs';
import {buildApp} from './app.mjs';
const config=readConfig();
const db=makeDb(config);
const app=await buildApp({config,db,authenticate:makeAuthenticator(config)});
const shutdown=async()=>{await app.close();await db.close();};
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{shutdown().finally(()=>process.exit(0));});
// Remove closed engagements' client contacts once a day. Failures are retried next day
// and never stop the service. Skipped when the engagements schema is not in use.
const purge=()=>{if(config.gates.engagements)db.purgeClosedContacts(config.clientContactRetentionDays).catch(()=>{});};
setInterval(purge,24*60*60*1000).unref();
try{await db.ready();await app.listen({port:config.port,host:config.host});purge();}
catch(error){process.stderr.write('Startup failed; check configuration and database availability.\n');await shutdown();process.exitCode=1;}
