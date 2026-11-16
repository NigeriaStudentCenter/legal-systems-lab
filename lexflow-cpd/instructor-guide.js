import {MODULES} from "./academy-content.js";
import {CASES} from "./case-dossiers.js";
import {CAPSTONE} from "./capstone-content.js";
const $=id=>document.getElementById(id);let index=0;
const agendas=[
["Diagnostic questions and AI limits (10 min)","Language models versus legal authority (20 min)","Fictional citation demonstration (20 min)","Pairs identify unsupported claims (25 min)","Guided investigation and feedback (20 min)","Draft partner escalation (15 min)","Exit ticket and reflection (10 min)"],
["Frame the fictional research question (15 min)","Sources, commencement and amendments (20 min)","Compare invented instruments (20 min)","Build the version map (25 min)","Guided case and challenge (20 min)","Write qualified advice (15 min)","Exit ticket (5 min)"],
["Review fictional drafting instructions (15 min)","Find notice conflicts and missing schedule (20 min)","Compare AI rewrite with contract text (20 min)","Create exception register (25 min)","Clarification role-play (20 min)","Senior reviewer release gate (15 min)","Reflection (5 min)"],
["Classify fictional information (15 min)","Data minimisation and confidentiality (20 min)","Review invented vendor questionnaire (20 min)","Write vendor diligence questions (25 min)","Incident escalation tabletop (20 min)","Safer classroom alternative (15 min)","Exit ticket (5 min)"],
["Prioritise safe AI use cases (15 min)","Write risk register (20 min)","Test serious-error veto (20 min)","Define workflow roles and approvals (20 min)","Peer-challenge risk decisions (20 min)","Explain capstone rubric (15 min)","Q&A and reflection (10 min)"]
];
const coach=[
 "Challenge fluent answers; require a primary-source audit and responsible reviewer.",
 "Ask which instrument, court, date and effective version would actually be authoritative.",
 "Have learners compare exact fictional source text before suggesting any change.",
 "Do not allow real data into exercises; require policy, contractual and legal source verification.",
 "Ask which severe failure stops deployment even if average performance looks high."
];
const make=(tag,text)=>{const v=document.createElement(tag);if(text!==undefined)v.textContent=text;return v};
function show(i){index=i;const m=MODULES[i],c=CASES[i];
 $("currentModule").textContent="Module "+(i+1)+" / "+MODULES.length;
 $("currentTitle").textContent=m.name;$("outcome").textContent=m.objective;
 $("agenda").replaceChildren();agendas[i].forEach(x=>$("agenda").append(make("li",x)));
 $("lessonCards").replaceChildren();
 m.lessons.forEach((l,j)=>{const d=make("article");d.className="plan";d.append(make("h4",(j+1)+". "+l.title),make("p","Guided study estimate: "+l.minutes+" min"),make("p","Teaching: "+l.concept),make("p","Fictional scenario: "+l.demo),make("p","Exercise evidence: "+l.practice));$("lessonCards").append(d)});
 $("caseName").textContent=c.title;$("caseTask").textContent=c.mission;$("caseRubric").replaceChildren();c.required.forEach(x=>$("caseRubric").append(make("li",x)));
 $("caseLink").href="case-lab.html#case-"+(i+1);
 $("investigationLink").href="guided-investigations.html#"+c.id+"-1";
 $("tutorAdvice").textContent=coach[i]+" The authenticated tutor asks stage-specific questions; it must not grade or award CPD points.";
 $("workshopTabs").querySelectorAll("button").forEach((b,j)=>b.setAttribute("aria-pressed",String(j===i)));
}
MODULES.forEach((m,i)=>{const b=make("button",(i+1)+". "+m.name);b.type="button";b.onclick=()=>show(i);$("workshopTabs").append(b)});
$("print").onclick=()=>window.print();
$("capstoneSummary").textContent=CAPSTONE.subtitle+" · "+CAPSTONE.duration;
const table=make("table");table.style.width="100%";const head=make("tr");["Dimension","Marks"].forEach(t=>head.append(make("th",t)));table.append(head);
CAPSTONE.components.forEach(c=>{const row=make("tr");row.append(make("td",c.title),make("td",String(c.points)));table.append(row)});
const total=make("tr");total.append(make("th","Total"),make("th","100"));table.append(total);$("marking").append(table);
show(0);
