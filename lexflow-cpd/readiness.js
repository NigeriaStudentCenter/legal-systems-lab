import {READINESS_QUESTIONS,READINESS_VERSION,scoreReadiness} from "./readiness-policy.js";
const $=id=>document.getElementById(id),make=(t,text)=>{const e=document.createElement(t);if(text!==undefined)e.textContent=text;return e};
for(const [i,q] of READINESS_QUESTIONS.entries()){
 const field=make("fieldset"),legend=make("legend",(i+1)+". "+q.q);field.className="question";field.append(legend);
 const choices=make("div");choices.className="answers";
 q.options.forEach((txt,j)=>{const label=make("label"),radio=make("input");radio.type="radio";radio.name="question-"+i;radio.value=String(j);radio.required=true;label.append(radio,document.createTextNode(txt));choices.append(label)});
 field.append(choices);$("questions").append(field);
}
$("readinessForm").addEventListener("submit",event=>{
 event.preventDefault();
 const answers=READINESS_QUESTIONS.map((_,i)=>Number(new FormData(event.currentTarget).get("question-"+i)));
 if(READINESS_QUESTIONS.some((_,i)=>!new FormData(event.currentTarget).has("question-"+i))){$("assessmentStatus").textContent="Please complete every question.";return}
 const result=scoreReadiness(answers);if(!result)return;
 const saved={version:READINESS_VERSION,answers,assessedAt:new Date().toISOString()};
 try{sessionStorage.setItem("lexflow-readiness-pending-v1",JSON.stringify(saved))}catch{$("assessmentStatus").textContent="Result available below; your browser cannot store it for later submission."}
 $("resultTitle").textContent="Your AI readiness score: "+result.score+" / "+result.max+" ("+result.percentage+"%)";
 $("resultSummary").textContent=result.band==="advanced"?"Advanced starting point: you demonstrated strong baseline judgment on these fictional scenarios.":result.band==="developing"?"Developing readiness: your answers show promising understanding with some areas for reinforcement.":"Foundation starting point: you will benefit from beginning with essential AI and legal-source verification safeguards.";
 $("resultDomains").textContent="Domain results: "+Object.entries(result.domains).map(([k,v])=>k+" "+v.correct+"/"+v.total).join(" · ");
 $("pathway").textContent=result.band==="advanced"?"Begin with Module 2 legal-source verification, then complete the drafting, ethics and governance modules. Module 1 remains available for revision.":result.band==="developing"?"Begin at Module 1, prioritise the lowest-scoring topic, then advance through the full guided course.":"Start with Module 1's AI foundations and human-review practice, then follow Module 2's source-verification sequence. All five modules remain accessible.";
 $("courseLink").href="academy.html"+(result.band==="advanced"?"?module=1":"");
 $("feedback").replaceChildren();
 result.feedback.forEach((f,i)=>{const li=make("li",(f.correct?"Correct. ":"Review needed. ")+READINESS_QUESTIONS[i].q+" — "+f.why);$("feedback").append(li)});
 $("readinessForm").hidden=true;$("results").hidden=false;$("results").focus();
 $("assessmentStatus").textContent="Assessment completed. Your recommended course is displayed.";
});
$("redo").addEventListener("click",()=>{try{sessionStorage.removeItem("lexflow-readiness-pending-v1")}catch{}$("readinessForm").reset();$("readinessForm").hidden=false;$("results").hidden=true;$("assessmentStatus").textContent="Answer all questions to unlock your course.";window.scrollTo(0,0)});
