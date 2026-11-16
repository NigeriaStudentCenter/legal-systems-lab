import {MODULES,SOURCES} from "./academy-content.js";
const $=id=>document.getElementById(id);
const key="lexflow-academy-20-lesson-v1";
const lessons=MODULES.flatMap((m,mi)=>m.lessons.map((l,li)=>({...l,mi,li,module:m.name,objective:m.objective,id:mi+"-"+li})));
let saved={};try{const x=JSON.parse(localStorage.getItem(key)||"{}");if(x&&typeof x==="object")saved=x}catch{}
if(!saved.answers||typeof saved.answers!=="object")saved.answers={};
if(!saved.completed||typeof saved.completed!=="object")saved.completed={};
let active=0;
const persist=()=>{try{localStorage.setItem(key,JSON.stringify(saved));$("savedMsg").textContent="Saved locally in this browser."}catch{$("savedMsg").textContent="Browser storage is unavailable. Export your work to keep a copy."}};
function count(){return lessons.filter(l=>saved.completed[l.id]===true).length}
function progress(){const n=count();$("progressLabel").textContent=n+" of "+lessons.length+" lessons checked ("+Math.round(n/lessons.length*100)+"%)";$("progressBar").setAttribute("aria-valuenow",n);$("progressFill").style.width=(100*n/lessons.length)+"%"}
function menu(){
 const root=$("lessonMenu");root.replaceChildren();
 MODULES.forEach((m,mi)=>{
  const d=document.createElement("details");d.open=mi===lessons[active].mi;
  const sum=document.createElement("summary");sum.textContent=(mi+1)+". "+m.name;d.appendChild(sum);
  m.lessons.forEach((l,li)=>{
   const idx=mi*4+li;const b=document.createElement("button");b.type="button";
   b.textContent=(saved.completed[mi+"-"+li]?"✓ ":"")+(li+1)+". "+l.title;
   b.setAttribute("aria-current",String(idx===active));b.addEventListener("click",()=>show(idx));
   d.appendChild(b);
  });root.appendChild(d);
 });
}
function show(index){
 active=Math.min(lessons.length-1,Math.max(0,index));const l=lessons[active];
 $("moduleLabel").textContent="Module "+(l.mi+1)+" of "+MODULES.length+" · Lesson "+(active+1)+" of "+lessons.length;
 $("lessonTitle").textContent=l.title;$("lessonMeta").textContent="Approximate guided study: "+l.minutes+" minutes";
 $("lessonOutcome").textContent=l.objective;$("lessonText").textContent=l.concept;
 $("demoText").textContent=l.demo;$("workLabel").textContent="Workbook task: "+l.practice;
 $("workbook").value=saved.answers[l.id]||"";
 $("questionText").textContent=l.checkpoint.q;
 const answerRoot=$("answers");answerRoot.replaceChildren();
 l.checkpoint.a.forEach((a,i)=>{
   const label=document.createElement("label");label.className="option";
   const radio=document.createElement("input");radio.type="radio";radio.name="checkpoint";radio.value=String(i);radio.style.width="auto";
   label.append(radio,document.createTextNode(" "+a));answerRoot.append(label);
 });
 $("questionFeedback").textContent=saved.completed[l.id]?"Previously answered correctly. You can review this question.":"";
 $("previousLesson").disabled=active===0;$("nextLesson").disabled=active===lessons.length-1;
 $("savedMsg").textContent="";
 history.replaceState(null,"","#lesson-"+(active+1));
 menu();progress();
}
$("workbook").addEventListener("input",()=>{const l=lessons[active];saved.answers[l.id]=$("workbook").value;persist()});
$("checkAnswer").addEventListener("click",()=>{
 const l=lessons[active];const choice=document.querySelector('input[name="checkpoint"]:checked');
 if(!choice){$("questionFeedback").textContent="Select an answer to continue.";return}
 if(Number(choice.value)===l.checkpoint.correct){
  saved.completed[l.id]=true;$("questionFeedback").textContent="Correct. "+l.checkpoint.why;
  persist();menu();progress();
 }else {$("questionFeedback").textContent="Not quite. Review the lesson and try again. "+l.checkpoint.why}
});
$("previousLesson").addEventListener("click",()=>show(active-1));$("nextLesson").addEventListener("click",()=>show(active+1));
$("openSimulation").addEventListener("click",()=>{
 const m=lessons[active].mi;
 location.href="academy-simulations.html#scenario-"+(m+1);
});
function download(content,name,type){
 const u=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement("a");a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),500);
}
$("exportRecord").addEventListener("click",()=>download(JSON.stringify({
 course:"Responsible AI for Nigerian Legal Practice",edition:"Development learning material",
 disclaimer:"Browser-local self-study, not verified attendance or NBA-ICLE CPD evidence",
 exportedAt:new Date().toISOString(),progress:count(),of:lessons.length,entries:lessons.map(l=>({
 lesson:l.title,module:l.module,exercise:l.practice,response:saved.answers[l.id]||"",checkPassed:!!saved.completed[l.id]
 }))},null,2),"lexflow-legal-ai-workbook.json","application/json"));
$("exportText").addEventListener("click",()=>{
 const text=["LexFlow CPD Academy — Personal study workbook","NOT VERIFIED CPD EVIDENCE. DO NOT INCLUDE CLIENT DATA.","Export: "+new Date().toISOString(),""].concat(lessons.flatMap((l,i)=>[
  "Module "+(l.mi+1)+" / Lesson "+(i+1)+": "+l.title,
  "Outcome: "+l.objective,"Exercise: "+l.practice,"Learner response:",saved.answers[l.id]||"(not completed)",
  "Knowledge checkpoint correct: "+(saved.completed[l.id]?"Yes":"No"),"","---",""
 ])).join("\n");
 download(text,"lexflow-study-workbook.txt","text/plain;charset=utf-8");
});
$("resetRecord").addEventListener("click",()=>{
 if(confirm("Permanently clear all 20 lesson answers and completion checks from this browser?")){
  saved={answers:{},completed:{}};try{localStorage.removeItem(key)}catch{}show(active);
 }
});
const reading=$("reading");for(const item of SOURCES){const li=document.createElement("li"),a=document.createElement("a");a.href=item.url;a.textContent=item.name;a.target="_blank";a.rel="noopener noreferrer";li.append(a);reading.append(li)}
const match=location.hash.match(/^#lesson-(\d+)$/);show(match?Number(match[1])-1:0);
