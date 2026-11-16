/**
 * Original, deliberately fictional training dossiers. All persons, companies, authorities,
 * internal rules, dates and document excerpts are invented for exercises, NOT Nigerian law.
 */
export const CASES=[
{
 id:"authority",module:0,title:"The untraceable appellate judgment",
 brief:"Your fictional Lagos research team has 45 minutes to prepare a partner's note on an ambiguous indemnity clause. A chatbot supplies a citation labelled (2025) 12 NLR 902, but the team has not seen a judgment. Every name and citation in this dossier is fictitious.",
 materials:[
  {title:"Matter instruction · FICTIONAL",text:"Client: Riverstone Packaging Ltd (invented). Question: Can a broadly drafted indemnity clause cover losses caused by the indemnified party? The partner asks for Nigerian case law, but no source documents have been provided."},
  {title:"AI output · UNVERIFIED",text:"‘Riverstone Packaging Ltd v Market Board (2025) 12 NLR 902 confirms indemnity language always covers the indemnified party's own negligence.’ This alleged judgment is invented for training. No such authority should be cited."},
  {title:"Research log",text:"09:10 generated claim copied into draft. 09:16 name searched in local reference index: no verified match. 09:24 primary judgment not located. 09:30 senior lawyer requires independent checking before advice."}
 ],
 mission:"Write a source-verification memorandum that identifies the false authority, the precise proposition requiring checking, source searches, a correction note and the escalation decision.",
 required:["Distinguish generated assertion from primary source","Record why the citation is unusable","Specify a hierarchy of sources and pinpoint method","Write a cautiously worded partner update","Identify human sign-off"],
 model:"The invented citation cannot support any proposition. Flag the alleged holding as unverified, exclude it from the draft, independently search for applicable current authorities and explain the unresolved issue to supervising counsel. Avoid claiming a specific Nigerian doctrine without a verified source."
},
{
 id:"amendment",module:1,title:"A filing period that may have changed",
 brief:"A fictional Abuja-based registrant needs a submission by an unknown date. For this exercise only, fictional Practice Rule A provides 30 days after a trigger. A proposed 14-day amendment was issued but no commencement notice is in the materials.",
 materials:[
  {title:"Fictional Rule A · 2 March",text:"Section 8 (invented): registration notice is due within 30 calendar days after an eligible change. The exercise does not define 'eligible change'."},
  {title:"Fictional Amending Instrument B · 20 April",text:"Clause 2 (invented): replace ‘30’ with ‘14’. Clause 4 (invented): the instrument commences on a date appointed by further notice. No notice is included."},
  {title:"AI deadline summary",text:"‘The deadline has definitely become 14 days for all organisations.’ The summary omits commencement, trigger definition and transitional scope."}
 ],
 mission:"Prepare a legislative version map and a qualified advice note explaining what evidence is missing before a deadline can be calculated.",
 required:["Identify trigger and relevant jurisdiction","Compare source instruments and exact provisions","Flag missing commencement evidence","Investigate transitions and effective dates","Avoid asserting a real deadline"],
 model:"Neither 30 nor 14 days can be adopted without resolving the scenario's trigger, commencement and transitional conditions. Request authenticated texts and the necessary factual dates. Label the illustration as hypothetical; it is not a Nigerian filing rule."
},
{
 id:"contract",module:2,title:"The two notice periods",
 brief:"A fictional supply agreement between Meridian Foods Ltd and Amber Logistics Ltd contains conflicting timing obligations and a reference to a schedule that does not exist. The model proposes a tidy rewrite but silently makes commercial choices.",
 materials:[
  {title:"Clause 8 · Fictional supply contract",text:"Either party may terminate for convenience after giving at least seven (7) days' written notice to the other party."},
  {title:"Definition 1.7",text:"‘Notice Period’ means thirty (30) consecutive days. All references to 'Notice Period' use this definition."},
  {title:"Clause 19.3",text:"Service-level credits are calculated under Schedule 3. The supplied document contains only Schedule 1 and Schedule 2."},
  {title:"AI rewrite",text:"‘The parties agree that termination requires fourteen (14) business days and that dispute resolution occurs before the Maritime Tribunal of Lagos.’ Neither instruction nor supporting source exists in this exercise."}
 ],
 mission:"Produce a contract exception register and draft an authorised-instructions request rather than choosing the notice period or tribunal yourself.",
 required:["Compare notice periods","Check defined terms against all clauses","Identify missing schedule","Reject unsupported drafting additions","Provide human review/release checklist"],
 model:"Mark the discrepancy between clause 8 and definition 1.7; identify absent Schedule 3; exclude the unsupported 14-business-day and tribunal language. Ask the fictional client which commercially acceptable terms are intended before finalising a redline."
},
{
 id:"privacy",module:3,title:"An unapproved document upload",
 brief:"A fictional law firm has been offered a free public chatbot. A junior lawyer wants to upload a privileged case memo and employee spreadsheet for drafting assistance. The client files are never actually displayed or transmitted in this exercise.",
 materials:[
  {title:"Partner email · Fictional",text:"‘Please upload the full memo to the free AI tool today. It is quicker, and the supplier calls itself secure.’ No authorised data-processing decision is recorded."},
  {title:"Vendor brochure",text:"‘Industry-leading AI security.’ The fictional brochure says nothing about processor terms, retention, subprocessors, access, geographic transfers or incident notification."},
  {title:"Firm policy extract · Invented",text:"External services must pass legal, privacy and security approval before any protected information is shared; exceptions require a recorded decision by named firm officers."}
 ],
 mission:"Write an escalation note, a vendor due-diligence checklist, and a compliant-by-design training alternative using only genuinely fictional facts.",
 required:["Stop unapproved data disclosure","Classify confidentiality and personal-data risks","Assess vendor terms and retention","Identify safe fictional alternatives","Draft escalation/incident plan"],
 model:"Do not upload the documents. Explain the professional and privacy concerns without definitive conclusions about any real provider; seek appropriate approval, review contract and technical safeguards, and practise only with truly fictionalised teaching content."
},
{
 id:"pilot",module:4,title:"The five-lawyer firm's adoption decision",
 brief:"A fictional Nigerian practice with five lawyers wants an AI assistant to cut drafting time by 40 percent. There is no baseline study, vendor evaluation or lawyer review policy. The managing partner asks for a board recommendation by Friday.",
 materials:[
  {title:"Benefits claim · Fictional proposal",text:"‘AI will reduce all client-letter work by 40% and can send legal advice autonomously with no litigation risk.’ No test data support either claim."},
  {title:"Available resources",text:"A two-week pilot, one supervising partner, two associates and a test folder containing only fictional contract examples. Budget and model usage limits are undecided."},
  {title:"Sample test log",text:"20 fictional summaries produced; 18 generally correct; one invented legal citation; one missed exception. The firm has not checked how severe each error would be in real practice."}
 ],
 mission:"Prepare a board-ready controlled-pilot proposal with a use-case ranking, risk register, evaluation plan, stop/go rules and an accountable decision maker.",
 required:["Reject unattended advice/filings","Choose limited reversible use case","Define approved data categories and security","Create tests with serious-error veto","Assign owners, monitoring and rollout gates"],
 model:"Recommend a controlled fictional-template evaluation only, not unattended client advice. Set explicit accuracy, hallucination and privacy controls, independent review and a serious-error stop condition; measure real gains against a baseline before expanding."
}
];