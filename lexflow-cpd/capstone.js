import {CAPSTONE} from "./capstone-content.js";
const $=id=>document.getElementById(id),key="lexflow-capstone-workbook-v1";
let work={};try{const v=JSON.parse(localStorage.getItem(key)||"{}");if(v&&typeof v==="object")work=v}catch{}
work.sections??={};work.acknowledged??={};
const make=(tag,text)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=text;return x};
const wordCount=s=>(s.trim().match(/\S+/g)||[]).length;
const persist=()=>{try{localStorage.setItem(key,JSON.stringify(work))}catch{$("result").textContent="Browser storage unavailable; export your work to avoid loss."}};
$("capstoneTitle").textContent=CAPSTONE.title;$("capstoneIntro").textContent=CAPSTONE.subtitle+" · "+CAPSTONE.duration;
$("brief").textContent=CAPSTONE.scenario.facts;
$("budget").textContent="Fictional budget: "+CAPSTONE.scenario.budget;
$("team").textContent="Team: "+CAPSTONE.scenario.team;
$("constraints").textContent=CAPSTONE.scenario.constraints;
for(const doc of CAPSTONE.evidence){const card=make("article");card.className="capstone-doc";card.append(make("h3",doc.title),make("p",doc.body));$("evidence").append(card)}
function update(){
 const drafted=CAPSTONE.components.filter(c=>wordCount(work.sections[c.id]||"")>=c.minWords).length;
 $("progressText").textContent=drafted+" of 6 sections meet their suggested minimum word counts";
 $("progress").setAttribute("aria-valuenow",drafted);$("progressFill").style.width=String(drafted/6*100)+"%";
 for(const c of CAPSTONE.components){const indicator=$("count-"+c.id);indicator.textContent=wordCount(work.sections[c.id]||"")+" words / suggested "+c.minWords}
}
for(const c of CAPSTONE.components){
 const sec=make("section");sec.className="section-card";const h=make("h3",c.title),desc=make("p",c.prompt);
 const pts=make("p",c.points+" points available · Faculty rubric");pts.className="points";
 const list=make("ul");list.className="rubric";c.criteria.forEach(x=>list.append(make("li",x)));
 const label=make("label","Write your response — "+c.title);label.htmlFor="answer-"+c.id;
 const box=make("textarea");box.id="answer-"+c.id;box.maxLength=16000;box.value=work.sections[c.id]||"";
 const wc=make("p");wc.id="count-"+c.id;wc.className="muted-small";
 box.addEventListener("input",()=>{work.sections[c.id]=box.value;persist();update()});
 sec.append(h,pts,desc,list,label,box,wc);$("components").append(sec);
}
CAPSTONE.submission.forEach((s,i)=>{const lab=make("label"),cb=make("input");cb.type="checkbox";cb.style.width="auto";cb.checked=!!work.acknowledged[i];cb.onchange=()=>{work.acknowledged[i]=cb.checked;persist()};lab.append(cb,document.createTextNode(" "+s));$("submissionChecklist").append(lab)});
function check(){
 const missing=CAPSTONE.components.filter(c=>wordCount(work.sections[c.id]||"")<c.minWords).map(c=>c.title+" ("+wordCount(work.sections[c.id]||"")+"/"+c.minWords+" suggested words)");
 const checks=CAPSTONE.submission.filter((s,i)=>!work.acknowledged[i]).length;
 const message=missing.length?"Continue drafting:\n"+missing.join("\n"):"All six sections meet the suggested word counts.";
 $("result").textContent=message+"\n"+(checks?checks+" self-check acknowledgments remain.":"All self-check acknowledgments marked.")+"\nThis is not a legal-quality grade and does not submit the work to faculty.";
}
$("runChecks").onclick=check;
function download(name,text,type){
 const blob=new Blob([text],{type}),u=URL.createObjectURL(blob),a=make("a");a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),500);
}
$("downloadJson").onclick=()=>download("lexflow-capstone-"+CAPSTONE.version+".json",JSON.stringify({course:CAPSTONE.title,version:CAPSTONE.version,fictional:true,exportedAt:new Date().toISOString(),notice:"Not a formal submission",sections:CAPSTONE.components.map(c=>({id:c.id,prompt:c.prompt,answer:work.sections[c.id]||"",maxPoints:c.points}))},null,2),"application/json");
$("downloadText").onclick=()=>{
 const lines=[CAPSTONE.title,CAPSTONE.subtitle,"Fictional scenario — not verified CPD evidence","","Assignment: "+CAPSTONE.scenario.facts,""];
 for(const c of CAPSTONE.components){lines.push(c.title,"Prompt: "+c.prompt,"",work.sections[c.id]||"(not yet drafted)","","------","")}
 download("lexflow-capstone-report.txt",lines.join("\n"),"text/plain;charset=utf-8");
};
$("clear").onclick=()=>{if(!confirm("Clear all capstone answers and checklist selections in this browser?"))return;work={sections:{},acknowledged:{}};persist();for(const c of CAPSTONE.components)$("answer-"+c.id).value="";$("submissionChecklist").querySelectorAll("input").forEach(x=>x.checked=false);update();$("result").textContent="Local capstone answers cleared."};
update();$("result").textContent="Save your report regularly by exporting a copy. Faculty marks work through an authorised assessment process.";
