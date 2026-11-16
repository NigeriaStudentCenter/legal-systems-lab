/**
 * LexFlow CPD flagship capstone, version 1: professional educational assessment design.
 * Fictional exercise only. The public activity is not submitted to Azure, nor verified by faculty.
 */
export const CAPSTONE={
 version:"lexflow-capstone-v1",title:"Board recommendation: responsible legal AI adoption in a Nigerian practice",
 subtitle:"A single integrated fictional law-firm adoption decision",
 duration:"Suggested learner effort: 3–5 hours, excluding optional research and faculty workshop time.",
 audience:"Practising Nigerian lawyers and legal teams learning responsible use of AI.",
 scenario:{
 firm:"Eko Meridian Legal Chambers (entirely fictional)",
 facts:"A six-lawyer commercial practice in Lagos wants to adopt an AI assistant for contract reviews and initial research summaries. Management expects a 30 percent efficiency gain, but no baseline study exists. Staff want to test the tool using real client agreements; the proposed supplier has not answered questions about training-data retention, subprocessors or transfer arrangements. A small internal fictional test produced eight usable clause comparisons out of ten, one invented judicial citation and one missed termination exception. The managing partner is considering immediate automated legal advice with no human review.",
 budget:"Fictional pilot ceiling: NGN 750,000 over six weeks. The figure is invented for budgeting practice, not an actual market quote.",
 team:"Managing partner, one nominated supervising partner, two associates, one IT/security lead and one privacy contact. Roles may overlap in this invented small firm.",
 constraints:"No real client data may be used for this training. There is no regulator approval or NBA-ICLE credit designation for this learning activity."
 },
 evidence:[
  {id:"email",title:"Document A — Managing partner email",body:"'We need the AI assistant live in six weeks. The vendor says it reduces drafting time by 30%. Please recommend automatic client letters to get full value.' The benefit is untested."},
  {id:"contract",title:"Document B — Vendor security questionnaire",body:"Sections for subprocessors, retention, training reuse, cross-border processing and deletion are blank. Marketing claim: 'enterprise-grade and compliant'. No independent evidence provided."},
  {id:"evaluation",title:"Document C — Fictional pilot test log",body:"Ten fictional clause comparisons; eight appear materially useful. One contains a fabricated legal citation, and one overlooks a termination exception. No calibrated serious-error tolerance or reviewer sign-off exists."},
  {id:"policy",title:"Document D — Proposed practice policy",body:"'Any lawyer may paste any contract into AI. Staff may release outputs as long as the tone looks professional.' This draft is deliberately unsafe and requires complete redesign."}
 ],
 components:[
  {id:"scope",title:"1. Define the business case and permitted AI use",points:15,minWords:120,prompt:"Define the exact fictional problem, proposed approved pilot scope, excluded high-risk uses, baseline measures and assumptions. Explain why unattended legal advice is out of scope.",criteria:["Clear objectives and evidence gaps (5)","Appropriate reversible pilot and explicit exclusions (5)","Baseline, realistic benefit measurement and assumptions (5)"]},
  {id:"research",title:"2. Source reliability and legal research controls",points:20,minWords:140,prompt:"Specify a stepwise workflow to prevent fabricated case citations and omitted exceptions. Include sources, version checks, reviewer sign-off and a stop/release rule. Do not invent actual Nigerian law.",criteria:["Authentic source and pinpoint verification (8)","Citation and omission exception management (6)","Accountable sign-off and stop/release controls (6)"]},
  {id:"privacy",title:"3. Confidentiality, privacy and vendor evaluation",points:20,minWords:140,prompt:"Identify client confidentiality and personal-data risks, prohibit real client uploads in the exercise, and create a vendor due-diligence and escalation plan. State legal questions for formal checking rather than assuming compliance.",criteria:["Information classification and data minimisation (7)","Vendor evidence, retention, transfer and security evaluation (8)","Escalation, lawful-processing checks and safeguards (5)"]},
  {id:"governance",title:"4. Governance, roles and incident management",points:15,minWords:110,prompt:"Design a human-controlled workflow with named responsibilities, training, audit log, approval and incident-response stages.",criteria:["Named accountable roles and approval points (6)","Audit, training and changes control (5)","Incident stop, escalation and preservation (4)"]},
  {id:"evaluation",title:"5. Testing and go/no-go conditions",points:15,minWords:110,prompt:"Build a test set, baseline, serious-error veto, evaluation methodology, quality measures and a decision process for revision or suspension.",criteria:["Defined evaluation method and indicators (6)","Serious-error veto and correctives (6)","Re-testing after changes and owner (3)"]},
  {id:"recommendation",title:"6. Board-ready conclusion and rollout",points:15,minWords:120,prompt:"Write a concise board decision: proceed only as a controlled fictional pilot, revise, or defer. Justify the decision with conditions, an outline six-week schedule and budget allocation.",criteria:["Clear qualified recommendation (6)","Dependencies and staged six-week roadmap (5)","Cost and residual-risk transparency (4)"]}
 ],
 thresholds:{recommendedPass:70,criticalRequired:["research","privacy"],criticalMinimumPercent:50},
 submission:[
  "One integrated report of approximately 900–1,400 words across the six sections; the word target is guidance, not a credential requirement.",
  "A source verification register, risk register and responsibility matrix incorporated into the responses.",
  "At least one clearly labelled fictional worked example with evidence, unsupported AI output, correction and human sign-off.",
  "A six-week pilot proposal with defined milestones, an invented budget and specific stop/go criteria.",
  "Any legal propositions requiring current Nigerian law must be flagged for later official-source checking."
 ],
 grading:{
 principle:"Only an authorised faculty member may award an official internal assessment grade; no model or browser checklist is a faculty decision.",
 method:"Score each component independently against the listed criteria. Record evidence excerpts, moderation notes and specific developmental feedback.",
 borderline:"A provisional 70/100 benchmark is proposed for educational design only, subject to course-director confirmation. In addition, require at least half the allocated points in each of Source reliability and Privacy. A high total cannot compensate for a fabricated authority treated as genuine or unsafe client upload.",
 integrity:"All evidence is fictional. Suspected copied text, fabricated sources, confidentiality issues or AI-generated unsupported assertions trigger human review and a recorded opportunity to revise as appropriate."
 }
};
