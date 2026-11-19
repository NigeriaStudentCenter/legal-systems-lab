import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {READINESS_QUESTIONS,READINESS_VERSION,scoreReadiness} from "./readiness-policy.js";
assert.equal(READINESS_VERSION,"legal-ai-readiness-v1");
assert.equal(READINESS_QUESTIONS.length,12);
const ids=new Set(READINESS_QUESTIONS.map(q=>q.id));assert.equal(ids.size,12);
for(const q of READINESS_QUESTIONS){assert.equal(q.options.length,3);assert.ok(q.correct>=0&&q.correct<3);assert.ok(q.why.length>20)}
const correct=READINESS_QUESTIONS.map(q=>q.correct),high=scoreReadiness(correct);
assert.equal(high.score,12);assert.equal(high.band,"advanced");
assert.equal(Object.values(high.domains).reduce((n,d)=>n+d.total,0),12);
const wrong=READINESS_QUESTIONS.map(q=>(q.correct+1)%3),low=scoreReadiness(wrong);
assert.equal(low.score,0);assert.equal(low.band,"foundation");
assert.equal(scoreReadiness([0]),null);assert.equal(scoreReadiness(Array(12).fill("1")),null);
for(const name of ["readiness.html","readiness.js","monitoring.html","academy.html","academy.js","staff.html","staff.js","portal.html","auth.js"]){
 assert.ok(existsSync(new URL(name,import.meta.url)),name+" must exist");
}
const assessment=readFileSync(new URL("readiness.html",import.meta.url),"utf8");
const monitor=readFileSync(new URL("monitoring.html",import.meta.url),"utf8");
const landing=readFileSync(new URL("index.html",import.meta.url),"utf8");
const staff=readFileSync(new URL("staff.html",import.meta.url),"utf8");
assert.ok(assessment.includes("moduleCards")&&assessment.includes('id="results"'));
assert.ok(monitor.includes("FICTIONAL TEST DATA")&&monitor.includes("not a live Secretariat dashboard"));
assert.ok(landing.includes('href="readiness.html"'));
assert.ok(staff.includes('id="readinessSummary"'));
const dir="accreditation/course-approval/";
const idsHtml=["01-DETAILED-SYLLABUS","02-OBJECTIVES-AND-OUTCOMES","03-INSTRUCTIONAL-MATERIALS-AND-METHODOLOGY","04-INSTITUTION-AND-FACILITATOR-PROFILES","05-ASSESSMENT-AND-EVALUATION","06-ONLINE-PLATFORM-AND-DELIVERY"];
for(const id of idsHtml)assert.ok(existsSync(new URL(dir+id+".html",import.meta.url)),"Missing Secretariat HTML "+id);
const index=readFileSync(new URL(dir+"index.html",import.meta.url),"utf8");
assert.ok(idsHtml.every(id=>index.includes(id+".html")));
console.log("Readiness diagnostic, scoring, 6 Secretariat HTML annexes and monitored-access disclosures: PASS.");
