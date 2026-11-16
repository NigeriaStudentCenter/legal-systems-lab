/** Capstone v1 server policy. Educational marking only; not certificate eligibility. */
export const CAPSTONE_VERSION="lexflow-capstone-v1";
export const DIMENSIONS=Object.freeze({
 scope:15,research:20,privacy:20,governance:15,evaluation:15,recommendation:15
});
export function validateCapstoneAnswers(raw){
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return null;
 const ids=Object.keys(DIMENSIONS);
 if(Object.keys(raw).length!==ids.length||Object.keys(raw).some(k=>!ids.includes(k)))return null;
 const out={};let total=0;
 for(const k of ids){
  if(typeof raw[k]!=="string")return null;
  const v=raw[k].trim();
  if(v.length<120||v.length>6000)return null;
  total+=v.length;out[k]=v;
 }
 return total<=24000?out:null;
}
export function validateCapstoneMarks(raw){
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return null;
 const keys=Object.keys(DIMENSIONS);
 if(keys.length!==Object.keys(raw).length)return null;
 let sum=0;const out={};
 for(const k of keys){
  const value=raw[k];
  if(!Number.isInteger(value)||value<0||value>DIMENSIONS[k])return null;
  out[k]=value;sum+=value;
 }
 return {marks:out,total:sum};
}
export function isProvisionalPass(marks){
 const verified=validateCapstoneMarks(marks);
 return Boolean(verified&&verified.total>=70&&marks.research>=10&&marks.privacy>=10);
}
