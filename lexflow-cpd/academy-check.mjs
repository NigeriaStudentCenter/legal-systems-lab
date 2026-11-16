import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {MODULES,SOURCES} from "./academy-content.js";
import {SCENARIOS} from "./academy-scenarios.js";
import {CASES} from "./case-dossiers.js";
import {LESSONS_BY_ID} from "./backend/tutor-curriculum.mjs";

assert.equal(MODULES.length,5,"Must have five flagship modules");
assert.equal(MODULES.reduce((n,m)=>n+m.lessons.length,0),20,"Must have twenty complete lessons");
assert.equal(SCENARIOS.length,5,"Must have one scenario per module");
assert.equal(CASES.length,5,"Must have five evidence dossiers");
assert.equal(Object.keys(LESSONS_BY_ID).length,20,"Server must cover every lesson");
for(const [mi,m] of MODULES.entries()){
 assert.equal(CASES[mi].module,mi);
 assert.ok(CASES[mi].materials.length>=3 && CASES[mi].required.length>=5);
 assert.equal(m.lessons.length,4,`Module ${mi+1} must contain 4 lessons`);
 for(const [li,l] of m.lessons.entries()){
   assert.ok(l.title.length>12 && l.concept.length>150,`Module ${mi+1} lesson ${li+1} incomplete`);
   assert.equal(LESSONS_BY_ID[mi+"-"+li].title,l.title);
   assert.ok(l.practice.length>15&&l.demo.length>30&&l.minutes>=10);
   assert.equal(l.checkpoint.a.length,3);
   assert.ok(l.checkpoint.correct>=0&&l.checkpoint.correct<3);
 }
 assert.equal(SCENARIOS[mi].steps.length,3);
 for(const step of SCENARIOS[mi].steps){
   assert.equal(step.options.length,3);
   assert.ok(step.best>=0&&step.best<3);
   assert.ok(step.why.length>20);
 }
}
assert.ok(SOURCES.length>=3,"Include external legal references");
for(const s of SOURCES)assert.ok(s.url.startsWith("https://"));
for(const name of ["academy.html","academy.js","academy-content.js","academy-simulations.html","academy-simulations.js","academy-scenarios.js","case-lab.html","case-lab.js","case-dossiers.js"]){
 assert.ok(existsSync(new URL(name,import.meta.url)),name+" missing");
}
const home=readFileSync(new URL("index.html",import.meta.url),"utf8");
const pilot=readFileSync(new URL("course.html",import.meta.url),"utf8");
const course=readFileSync(new URL("academy.html",import.meta.url),"utf8");
assert.ok(home.includes("academy.html")&&pilot.includes("academy.html"));
assert.ok(course.includes('src="academy.js"')&&course.includes('href="portal.html#learner"'));
assert.ok(course.includes("NBA-ICLE credits"));
assert.ok(course.includes("lessonTutorLink")&&course.includes("openCase"));
assert.ok(home.includes("case-lab.html"));
console.log("Checked five modules, twenty lessons, five simulations, five case dossiers, twenty tutor contexts and page connections.");
