import {readFileSync,existsSync} from "node:fs";
import assert from "node:assert/strict";
const root=new URL("./",import.meta.url);
const names=[
 "README.md","01-PRELIMINARY-EMAIL.md","02-RULE12-COVER-LETTER.md",
 "03-INSTITUTIONAL-PROFILE.md","04-FLAGSHIP-COURSE-DOSSIER.md",
 "05-COMPLIANCE-EVIDENCE-MATRIX.md","06-ANNUAL-PROGRAMME-FACULTY-AND-FEES.md",
 "07-DOCUMENT-CHECKLIST-AND-DECISIONS.md","08-RULE13-COURSE-APPLICATION.md"
];
for(const name of names){assert.ok(existsSync(new URL(name,root)),name+" missing");const c=readFileSync(new URL(name,root),"utf8");assert.ok(c.length>800,name+" incomplete")}
const sources=names.map(name=>readFileSync(new URL(name,root),"utf8")).join("\n");
for(const term of ["Rule 12","Rule 13","NBA-ICLE","CAC","INACTIVE","440","20","100","not", "faculty"]){
 assert.ok(sources.toLowerCase().includes(term.toLowerCase()),"Missing key compliance reference: "+term);
}
assert.ok(sources.includes("60 days"),"Rule 13 timing must be addressed");
assert.ok(sources.includes("₦100,000")&&sources.includes("₦200,000"),"Published Rule 12 fees must be transparently identified");
assert.ok(sources.includes("10%"),"Published remittance must be documented");
assert.ok(sources.includes("five")&&sources.includes("three"),"Ambiguous retention rule must be expressly flagged");
assert.ok(sources.includes("NOT YET READY FOR FORMAL SUBMISSION"),"No false-ready signoff");
assert.ok(sources.includes("paid_tier_quota_exceeded")||sources.includes("credits were exhausted"),"Disclose pending video failure");
assert.ok(!sources.includes("NBA-ICLE approved provider (BSOE)"),"Do not falsely represent accreditation");
console.log("Validated nine NBA-ICLE application drafts and outstanding regulatory gates; ready for BSOE internal editing, NOT formal submission.");
