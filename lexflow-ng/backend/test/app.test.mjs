import test from 'node:test';
import assert from 'node:assert/strict';
import {buildApp} from '../src/app.mjs';
const auth=async req=>{
  if(req.headers.authorization!=='Bearer test-valid')throw Object.assign(new Error('Authentication required'),{statusCode:401});
  return {subject:'idp|test-lawyer'};
};
const called=[];
const db={
  ready:async()=>true,
  listPublic:async()=>({profiles:[],has_more:false}),
  apply:async(_sub,body)=>{called.push(['apply',body]);return{id:'not-a-real-id',status:'pending'};},
  myApplication:async()=>null,
  queue:async()=>[],
  review:async()=>({status:'pending'}),
  publish:async()=>({published:true}),
  suspend:async()=>({suspended:true})
};
const config={
  allowedOrigins:['https://nigeriastudentcenter.github.io'],
  gates:{applications:false,verification:false,publication:false,directory:false}
};
test('closed gate prevents public directory or signup, health remains available',async()=>{
  const app=await buildApp({config,db,authenticate:auth});
  try{
    const h=await app.inject({url:'/healthz'});assert.equal(h.statusCode,200);
    const m=await app.inject({url:'/v1/meta'});assert.equal(m.json().live_services.directory,false);
    const d=await app.inject({url:'/v1/directory'});assert.equal(d.statusCode,503);
    const a=await app.inject({method:'POST',url:'/v1/applications',payload:{}});assert.equal(a.statusCode,503);
    assert.equal(called.length,0);
  }finally{await app.close();}
});
test('onboarding validates data and needs authenticated identity',async()=>{
  const cfg={...config,gates:{...config.gates,applications:true,directory:true}};
  const app=await buildApp({config:cfg,db,authenticate:auth});
  try{
    const unauthorized=await app.inject({method:'POST',url:'/v1/applications',payload:{}});
    assert.equal(unauthorized.statusCode,401);
    const invalid=await app.inject({method:'POST',url:'/v1/applications',
      headers:{authorization:'Bearer test-valid'},payload:{full_name:'Bad Lawyer'}});
    assert.equal(invalid.statusCode,400);
    assert.equal(called.length,0);
    const directory=await app.inject({url:'/v1/directory?state=Lagos'});
    assert.equal(directory.statusCode,200);
    const bad=await app.inject({url:'/v1/directory?state=Atlantis'});
    assert.equal(bad.statusCode,400);
  }finally{await app.close();}
});
test('browser CORS allows only approved origin',async()=>{
  const app=await buildApp({config,db,authenticate:auth});
  try{
    const ok=await app.inject({url:'/healthz',headers:{origin:'https://nigeriastudentcenter.github.io'}});
    assert.equal(ok.headers['access-control-allow-origin'],'https://nigeriastudentcenter.github.io');
    const fail=await app.inject({url:'/healthz',headers:{origin:'https://attacker.example'}});
    assert.equal(fail.statusCode,403);
  }finally{await app.close();}
});
