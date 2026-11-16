import assert from "node:assert/strict";
import {test} from "node:test";
import {CAPSTONE} from "../../capstone-content.js";
import {CAPSTONE_VERSION,DIMENSIONS,validateCapstoneAnswers,validateCapstoneMarks,isProvisionalPass} from "../capstone-policy.mjs";
const ids=["scope","research","privacy","governance","evaluation","recommendation"];
const answers=()=>Object.fromEntries(ids.map(k=>[k,"Entirely fictional legal practice evaluation. ".repeat(4)]));
test("six-component capstone has an aligned 100-point rubric",()=>{
 assert.equal(CAPSTONE_VERSION,CAPSTONE.version);
 assert.equal(CAPSTONE.components.length,6);
 assert.deepEqual(CAPSTONE.components.map(c=>c.id),ids);
 for(const c of CAPSTONE.components)assert.equal(DIMENSIONS[c.id],c.points);
 assert.equal(Object.values(DIMENSIONS).reduce((a,b)=>a+b,0),100);
});
test("invalid capstone documents are rejected before storage",()=>{
 assert.deepEqual(validateCapstoneAnswers(answers()),answers());
 assert.equal(validateCapstoneAnswers({scope:"x"}),null);
 assert.equal(validateCapstoneAnswers({...answers(),privacy:"short"}),null);
 assert.equal(validateCapstoneAnswers({...answers(),injected:"any"}),null);
 assert.equal(validateCapstoneAnswers({...answers(),privacy:42}),null);
 assert.equal(validateCapstoneAnswers({...answers(),privacy:"x".repeat(6001)}),null);
});
test("marks must be whole numbers bounded by each dimension",()=>{
 const score={scope:12,research:14,privacy:15,governance:12,evaluation:11,recommendation:10};
 assert.equal(validateCapstoneMarks(score).total,74);
 assert.equal(isProvisionalPass(score),true);
 assert.equal(validateCapstoneMarks({...score,research:21}),null);
 assert.equal(validateCapstoneMarks({...score,scope:12.5}),null);
 assert.equal(validateCapstoneMarks({...score,__proto_test__:1}),null);
 assert.equal(isProvisionalPass({...score,privacy:9}),false);
});
