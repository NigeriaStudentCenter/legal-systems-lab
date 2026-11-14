import {readConfig} from './config.mjs';
import {makeDb} from './db.mjs';
import {makeAuthenticator} from './auth.mjs';
import {buildApp} from './app.mjs';
const config=readConfig();
const db=makeDb(config);
const app=await buildApp({config,db,authenticate:makeAuthenticator(config)});
const shutdown=async()=>{await app.close();await db.close();};
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{shutdown().finally(()=>process.exit(0));});
try{await db.ready();await app.listen({port:config.port,host:config.host});}
catch(error){process.stderr.write('Startup failed; check configuration and database availability.\n');await shutdown();process.exitCode=1;}
