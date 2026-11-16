import {CASES} from "./case-dossiers.js";
const $=id=>document.getElementById(id),key="lexflow-case-lab-v1";let state={};
try{const read=JSON.parse(localStorage.getItem(key)||"{}");if(read&&typeof read==="object")state=read}catch{}
let active=0;
const store=()=>{try{localStorage.setItem(key,JSON.stringify(state));$("saveNotice").textContent="Saved locally in this browser; this is not a formal submission."}catch{$("saveNotice").textContent="Local storage blocked. Export your answer."}};
const item=(tag,content)=>{const e=document.createElement(tag);if(content!==undefined)e.textContent=content;return e};
function show(index){
 active=Math.max(0,Math.min(CASES.length-1,index));const c=CASES[active];history.replaceState(null,"","#case-"+(active+1));
 $("caseNumber").textContent="Case "+(active+1)+" of "+CASES.length+" · Module "+(c.module+1);
 $("caseTitle").textContent=c.title;$("caseBrief").textContent=c.brief;$("caseMission").textContent=c.mission;$("model").textContent=c.model;
 const docs=$("documents");docs.replaceChildren();for(const m of c.materials){const article=item("article");article.className="paper";article.append(item("h3",m.title),item("p",m.text));docs.append(article)}
 $("work").value=state[c.id]?.answer||"";$("saveNotice").textContent="";
 const checklist=$("rubric");checklist.replaceChildren();
 c.required.forEach((label,i)=>{const line=item("label");const cb=item("input");cb.type="checkbox";cb.style.width="auto";cb.checked=!!state[c.id]?.checks?.[i];cb.addEventListener("change",()=>{state[c.id]??={answer:"",checks:{}};state[c.id].checks[i]=cb.checked;store()});line.append(cb,document.createTextNode(" "+label));checklist.append(line)});
 $("caseMenu").querySelectorAll("button").forEach((b,i)=>b.setAttribute("aria-pressed",String(i===active)));
 $("casePanel").querySelector("details").open=false;
}
$("work").addEventListener("input",()=>{const c=CASES[active];state[c.id]??={answer:"",checks:{}};state[c.id].answer=$("work").value;store()});
function exportCase(){const c=CASES[active],payload={title:c.title,fictional:true,exportedAt:new Date().toISOString(),mission:c.mission,sourceMaterials:c.materials,learnerResponse:state[c.id]?.answer||"",selfReview:c.required.map((label,i)=>({criterion:label,checked:!!state[c.id]?.checks?.[i]})),notice:"Self-study only. Not attendance, legal advice or NBA-ICLE credits."};const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const link=item("a");link.href=url;link.download="lexflow-fictional-case-"+c.id+".json";link.click();setTimeout(()=>URL.revokeObjectURL(url),500)}
$("export").onclick=exportCase;
CASES.forEach((c,i)=>{const b=item("button",(i+1)+". "+c.title);b.type="button";b.className="case-button";b.onclick=()=>show(i);$("caseMenu").append(b)});
const n=location.hash.match(/^#case-(\d+)$/);show(n?Number(n[1])-1:0);
