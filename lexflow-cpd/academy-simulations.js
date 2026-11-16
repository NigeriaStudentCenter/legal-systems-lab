import {SCENARIOS} from "./academy-scenarios.js";
const $=id=>document.getElementById(id);
let current=0,stage=0,score=0,answered=false;
function start(n){current=n;stage=0;score=0;answered=false;history.replaceState(null,"","#scenario-"+(n+1));render()}
function render(){
 const scenario=SCENARIOS[current],step=scenario.steps[stage];
 $("simName").textContent="Scenario "+(current+1)+" of "+SCENARIOS.length+": "+scenario.title;
 $("context").textContent=scenario.context;
 $("question").textContent="Decision "+(stage+1)+" of "+scenario.steps.length+": "+step.q;
 $("simProgress").style.width=(stage/scenario.steps.length*100)+"%";
 $("choices").replaceChildren();$("feedback").textContent="";$("continue").hidden=true;
 $("result").textContent="";answered=false;
 step.options.forEach((option,i)=>{const b=document.createElement("button");b.type="button";b.className="choice";b.textContent=option;b.onclick=()=>choose(i);$("choices").append(b)});
 Array.from($("scenarioSelect").children).forEach((b,i)=>b.setAttribute("aria-current",String(i===current)));
}
function choose(n){
 if(answered)return;answered=true;const step=SCENARIOS[current].steps[stage];
 if(n===step.best)score++;
 Array.from($("choices").children).forEach((b,i)=>{b.disabled=true;if(i===step.best)b.classList.add("correct")});
 $("feedback").textContent=(n===step.best?"Sound decision. ":"Reconsider the risk. ")+step.why;
 $("continue").hidden=false;$("continue").textContent=stage===2?"Finish simulation":"Next decision";
}
$("continue").onclick=()=>{if(stage<2){stage++;render()}else{
 $("simProgress").style.width="100%";$("choices").replaceChildren();$("question").textContent="Scenario complete";
 $("feedback").textContent="";$("continue").hidden=true;
 $("result").textContent="You chose "+score+" of 3 preferred responses. Review the reasoning, then attempt another scenario. This is educational practice, not CPD evidence.";
 }};
SCENARIOS.forEach((s,i)=>{const b=document.createElement("button");b.type="button";b.className="btn light";b.textContent=(i+1)+". "+s.title;b.addEventListener("click",()=>start(i));$("scenarioSelect").append(b)});
const match=location.hash.match(/^#scenario-(\d+)$/);start(match?Math.min(SCENARIOS.length-1,Math.max(0,Number(match[1])-1)):0);
