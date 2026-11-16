import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {MODULES,SOURCES} from "./academy-content.js";
import {SCENARIOS} from "./academy-scenarios.js";
import {CASES} from "./case-dossiers.js";
import {LESSONS_BY_ID} from "./backend/tutor-curriculum.mjs";
import {INVESTIGATIONS} from "./guided-investigations-content.js";
import {GUIDED_CASES} from "./backend/tutor-investigations.mjs";
import {CAPSTONE} from "./capstone-content.js";

assert.equal(MODULES.length,5,"Must have five flagship modules");
assert.equal(MODULES.reduce((n,m)=>n+m.lessons.length,0),20,"Must have twenty complete lessons");
assert.equal(SCENARIOS.length,5,"Must have one scenario per module");
assert.equal(CASES.length,5,"Must have five evidence dossiers");
assert.equal(CAPSTONE.components.reduce((n,c)=>n+c.points,0),100,"Capstone rubric must total 100");
assert.equal(CAPSTONE.components.length,6,"Capstone has six assessed components");
assert.equal(Object.keys(GUIDED_CASES).length,5,"Protected API knows all five cases");
assert.equal(Object.keys(LESSONS_BY_ID).length,20,"Server must cover every lesson");
for(const [mi,m] of MODULES.entries()){
 assert.equal(CASES[mi].module,mi);
 assert.equal(INVESTIGATIONS[CASES[mi].id].length,5);
 assert.equal(GUIDED_CASES[CASES[mi].id].stages.length,5);
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
for(const name of ["academy.html","academy.js","academy-content.js","academy-simulations.html","academy-simulations.js","academy-scenarios.js","case-lab.html","case-lab.js","case-dossiers.js","guided-investigations.html","guided-investigations.js","guided-investigations-content.js","capstone.html","capstone.js","capstone-content.js","instructor-guide.html","instructor-guide.js","INSTRUCTOR-DELIVERY-PACK.md"]){
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
assert.ok(home.includes("guided-investigations.html")&&home.includes("capstone.html"));
const guided=readFileSync(new URL("guided-investigations.html",import.meta.url),"utf8");
assert.ok(guided.includes("guided-investigations.js")&&guided.includes("NBA-ICLE"));
const capstonePage=readFileSync(new URL("capstone.html",import.meta.url),"utf8");
assert.ok(capstonePage.includes("capstone.js")&&capstonePage.includes("faculty"));
assert.ok(readFileSync(new URL("instructor-guide.html",import.meta.url),"utf8").includes("instructor-guide.js"));
const portal=readFileSync(new URL("portal.html",import.meta.url),"utf8");
const staff=readFileSync(new URL("staff.html",import.meta.url),"utf8");
const auth=readFileSync(new URL("auth.js",import.meta.url),"utf8");
const staffJs=readFileSync(new URL("staff.js",import.meta.url),"utf8");
assert.ok(portal.includes('id="liveCapstone"'),"Authenticated portal must show capstone submission");
assert.ok(staff.includes('id="facultyCapstones"'),"Faculty console must show human capstone marking");
assert.ok(auth.includes('/api/capstone/submissions'),"Learner page must send capstone to secure API only on explicit action");
assert.ok(staffJs.includes('/api/faculty/capstones/'),"Faculty page must use secured capstone decision endpoint");
assert.ok(existsSync(new URL("backend/sql/003_capstone_assessment.sql",import.meta.url)),"Operator migration 003 is required");
console.log("Checked five modules, twenty lessons, five simulations, five cases, 25 guided stages, a 100-point capstone, instructor materials and lesson contexts.");
