import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
const root=new URL("./",import.meta.url);
const names=[
 "README.md","01-DETAILED-SYLLABUS.md","02-OBJECTIVES-AND-OUTCOMES.md",
 "03-INSTRUCTIONAL-MATERIALS-AND-METHODOLOGY.md",
 "04-INSTITUTION-AND-FACILITATOR-PROFILES.md",
 "05-ASSESSMENT-AND-EVALUATION.md",
 "06-ONLINE-PLATFORM-AND-DELIVERY.md",
 "07-COVERING-EMAIL.md","08-SUBMISSION-READINESS-CHECKLIST.md"
];
for (const name of names){
 assert.ok(existsSync(new URL(name,root)),name+" missing");
 assert.ok(readFileSync(new URL(name,root),"utf8").length>=800,name+" incomplete");
}
const full=names.map(n=>readFileSync(new URL(n,root),"utf8")).join("\n");
for(const expected of [
 "icle@nigerianbar.org.ng","sarah.ajijola@nigerianbar.org.ng",
 "₦100,000","₦10,000","NOT SUBMITTED","not approved",
 "20 lessons","100","440","facilitator","online"
])assert.ok(full.toLowerCase().includes(expected.toLowerCase()),"Missing verified submission boundary: "+expected);
const annex=names.slice(1,7).map(n=>readFileSync(new URL(n,root),"utf8"));
assert.ok(annex[0].includes("Detailed Course Syllabus"));
assert.ok(annex[1].includes("Expected Learning Outcomes"));
assert.ok(annex[2].includes("Instructional Materials"));
assert.ok(annex[3].includes("Facilitators"));
assert.ok(annex[4].includes("Assessment"));
assert.ok(annex[5].includes("Online Platform"));
assert.ok(full.includes("INCOMPLETE")&&full.includes("four"),"Must disclose readiness and outstanding video/material issues");
console.log("NBA-ICLE six requested course-approval annexes found and status safeguards preserved. This is documentary completeness, not regulatory acceptance.");
