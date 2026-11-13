import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { InputError, parseApplication, parseFilters, parseReview, parsePublication, parseSuspension, states, practiceAreas, languages } from './domain.mjs';

function gated(config,key){if(!config.gates[key])throw new InputError('Feature is not enabled',503);}
const uuidRe=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function requireUuid(x){if(typeof x!=='string'||!uuidRe.test(x))throw new InputError('Invalid application ID');return x;}

export async function buildApp({config, db, authenticate}) {
  // No request bodies, auth tokens or sensitive claims are logged.
  const app=Fastify({logger:false,bodyLimit:16384,trustProxy:false,disableRequestLogging:true});
  await app.register(helmet,{contentSecurityPolicy:false});
  await app.register(cors,{
    origin(origin,cb){
      if (!origin || config.allowedOrigins.includes(origin)) return cb(null,true);
      cb(new InputError('Origin not allowed',403),false);
    },
    credentials:false,
    methods:['GET','POST'],
    allowedHeaders:['Content-Type','Authorization'],
    maxAge:600
  });
  await app.register(rateLimit,{global:true,max:60,timeWindow:'1 minute'});
  app.setErrorHandler((error,request,reply)=>{
    const status=error instanceof InputError?error.statusCode:(error.statusCode>=400&&error.statusCode<500?error.statusCode:500);
    if(status>=500 && !(error instanceof InputError)){
      // Send no SQL, auth, stack or provider failure details to clients.
      reply.code(500).send({error:'Internal service error'});return;
    }
    reply.code(status).send({error:status>=500?'Service not configured':(error.message||'Request failed')});
  });
  const withAuth=async request=>authenticate(request);
  app.get('/healthz',async()=>({status:'running',product:'lexflow-ng-api'}));
  app.get('/readyz',async()=>{await db.ready();return {status:'ready'};});
  app.get('/v1/meta',async()=>({jurisdictions:states,practice_areas:practiceAreas,languages,live_services:{
    applications:config.gates.applications,verification:config.gates.verification,
    directory:config.gates.directory,payments:false,custody_dispatch:false,client_matter_storage:false
  }}));
  app.get('/v1/directory',async request=>{gated(config,'directory');return db.listPublic(parseFilters(Object.fromEntries(Object.entries(request.query))));});
  app.post('/v1/applications', {config:{rateLimit:{max:5,timeWindow:'1 hour'}}},async(request,reply)=>{
    gated(config,'applications');const actor=await withAuth(request);const data=parseApplication(request.body);
    const record=await db.apply(actor.subject,data);reply.code(201);return record;
  });
  app.get('/v1/applications/me',async request=>{
    gated(config,'applications');const actor=await withAuth(request);
    return {application:await db.myApplication(actor.subject)};
  });
  app.get('/v1/verification/queue',async request=>{
    gated(config,'verification');const actor=await withAuth(request);
    return {applications:await db.queue(actor.subject)};
  });
  app.post('/v1/verification/:id/review', {config:{rateLimit:{max:20,timeWindow:'1 hour'}}},async request=>{
    gated(config,'verification');const actor=await withAuth(request);
    const id=requireUuid(request.params.id);const review=parseReview(request.body);
    return db.review(actor.subject,id,review);
  });
  app.post('/v1/verification/:id/publish', {config:{rateLimit:{max:20,timeWindow:'1 hour'}}},async request=>{
    gated(config,'publication');const actor=await withAuth(request);
    const id=requireUuid(request.params.id);parsePublication(request.body);
    return db.publish(actor.subject,id);
  });
  app.post('/v1/verification/:id/suspend', {config:{rateLimit:{max:20,timeWindow:'1 hour'}}},async request=>{
    gated(config,'verification');const actor=await withAuth(request);
    return db.suspend(actor.subject,requireUuid(request.params.id),parseSuspension(request.body));
  });
  app.setNotFoundHandler((_request,reply)=>reply.code(404).send({error:'Endpoint not found'}));
  return app;
}
