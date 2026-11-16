import {CASES} from "./case-dossiers.js";
import {INVESTIGATIONS} from "./guided-investigations-content.js";
const $=id=>document.getElementById(id),key="lexflow-guided-case-v1";
let memory={};try{const o=JSON.parse(localStorage.getItem(key)||"{}");if(o&&typeof o==="object")memory=o}catch{}
let current=0,stage=0;
function note(s){$("saveState").textContent=s}
function persist(){try{localStorage.setItem(key,JSON.stringify(memory));note("Saved locally; not submitted to an instructor.")}catch{note("Local storage unavailable. Export your evidence before leaving.")}}
function elem(tag,label){const v=document.createElement(tag);if(label!==undefined)v.textContent=label;return v}
function record(){const id=CASES[current].id;memory[id]??={};memory[id][stage]??={response:"",studied:false};return memory[id][stage]}
function allStageCounts(){let n=0;for(const c of CASES){for(let i=0;i<5;i++)if(memory[c.id]?.[i]?.studied)n++}return n}
function renderMenu(){
 $("caseChooser").replaceChildren();
 CASES.forEach((c,i)=>{const b=elem("button",(i+1)+". "+c.title);b.type="button";b.setAttribute("aria-pressed",String(i===current));b.onclick=()=>{current=i;stage=0;render()};$("caseChooser").append(b)});
 $("stageChooser").replaceChildren();
 INVESTIGATIONS[CASES[current].id].forEach((s,i)=>{const done=memory[CASES[current].id]?.[i]?.studied;const b=elem("button",(done?"✓ ":"")+(i+1)+". "+s.name);b.type="button";b.setAttribute("aria-current",String(i===stage));b.onclick=()=>{stage=i;render()};$("stageChooser").append(b)});
 $("stageStatus").textContent=allStageCounts()+" of 25 learning stages marked studied. This is self-reported practice, not verified competence.";
}
function render(){
 const c=CASES[current],v=INVESTIGATIONS[c.id][stage];history.replaceState(null,"","#"+c.id+"-"+(stage+1));
 $("investigationHeader").textContent="Case "+(current+1)+" / 5 · Stage "+(stage+1)+" / 5";
 $("stageHeading").textContent=v.name;$("caseFacts").textContent=c.brief;
 $("stageQuestion").textContent=v.question;$("stageEvidence").textContent="Produce this evidence: "+v.evidence;
 $("stageHint").textContent=v.hint;$("response").value=record().response||"";
 $("previousStep").disabled=stage===0;$("nextStep").disabled=stage===4;
 $("completeStep").textContent=record().studied?"Mark as not yet studied":"Mark stage studied";
 $("askTutor").href="portal.html?caseId="+encodeURIComponent(c.id)+"&stage="+stage+"#learner";
 note("");$("tutorPrompt").value="";renderMenu();
}
$("response").oninput=()=>{record().response=$("response").value;persist()};
$("previousStep").onclick=()=>{stage=Math.max(0,stage-1);render()};
$("nextStep").onclick=()=>{stage=Math.min(4,stage+1);render()};
$("completeStep").onclick=()=>{if(!record().response.trim()){note("Write some analysis before marking this stage studied.");return}record().studied=!record().studied;persist();render()};
function exportData(one){
 const c=CASES[current];
 const data={exportedAt:new Date().toISOString(),course:"LexFlow CPD fictional case investigations",warning:"Self-study only; not attendance, faculty marking or NBA-ICLE credit.",cases:(one?[c]:CASES).map(it=>({id:it.id,title:it.title,fictionalFacts:it.brief,stages:INVESTIGATIONS[it.id].map((s,i)=>({stage:i+1,name:s.name,question:s.question,expectedEvidence:s.evidence,response:memory[it.id]?.[i]?.response||"",selfReportedStudied:!!memory[it.id]?.[i]?.studied}))}))};
 const u=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"})),a=elem("a");a.href=u;a.download=one?"lexflow-investigation-"+c.id+".json":"lexflow-five-investigations.json";a.click();setTimeout(()=>URL.revokeObjectURL(u),500);
}
$("exportCase").onclick=()=>exportData(true);$("exportAll").onclick=()=>exportData(false);
const hash=location.hash.match(/^#(authority|amendment|contract|privacy|pilot)-([1-5])$/);
if(hash){current=Math.max(0,CASES.findIndex(c=>c.id===hash[1]));stage=Number(hash[2])-1}
render();
