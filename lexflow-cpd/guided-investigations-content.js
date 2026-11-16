// Five staged investigations with original fictional evidence and a local learner response at each stage.
// This is teaching material only; the protected backend separately validates the selected case and stage.
export const INVESTIGATIONS=Object.freeze({
 authority:[
  {name:"Frame the issue",question:"What exact legal proposition did the AI claim, and which facts or instructions are missing?",evidence:"Record a narrow research issue, claimed source, source status and missing instructions.",hint:"Do not assume the invented holding is genuine. Distinguish what the model wrote from what a court actually said."},
  {name:"Trace the authority",question:"Which details would you check to verify a judicial citation and its actual holding?",evidence:"List the case name, issuing court, date, report/judgment, relevant passage and search outcomes.",hint:"A matching case name alone does not establish the proposition or the ratio."},
  {name:"Record the defect",question:"How will you document the failed source search without inventing a replacement citation?",evidence:"Write an exception-log entry with the unsupported assertion, checks attempted and disposition.",hint:"Use an explicit unverified label and mark the authority unsuitable to cite."},
  {name:"Escalate",question:"What will you tell the partner about the unresolved legal question?",evidence:"Draft a qualified two-paragraph partner update and the next verification step.",hint:"A caution should be specific about the gap, not merely say that AI might be inaccurate."},
  {name:"Defend the decision",question:"What controls prevent the same error reaching a client letter?",evidence:"Identify accountable reviewer, source sign-off and a stop/release criterion.",hint:"Review of the primary passage, not model confidence, determines release."}
 ],
 amendment:[
  {name:"Define scope",question:"Which event starts the hypothetical clock, and what details are still unknown?",evidence:"Write the trigger, parties, relevant period, source jurisdiction and unresolved facts.",hint:"The exercise rule is fictional; it cannot be used as a real Nigerian filing deadline."},
  {name:"Build a version table",question:"What do invented Rule A and amending Instrument B say, word for word?",evidence:"Record 30-day and 14-day texts and their stated source locations.",hint:"The amendment's adoption and operative effect may not occur on the same date."},
  {name:"Check commencement",question:"What evidence is missing before anyone can apply the proposed 14-day period?",evidence:"Mark the absent commencement notice and the evidence needed to confirm effectiveness.",hint:"No commencement evidence has been supplied. Never assume it."},
  {name:"Consider transitions",question:"Which transitional conditions would require a further check?",evidence:"Draft a conditional issues table without creating new legal rules.",hint:"Different periods may have different applicable versions; the exercise supplies no transition rule."},
  {name:"Write the opinion",question:"How will you advise without falsely calculating the deadline?",evidence:"Produce a short qualified note, source-tracing plan and reviewer sign-off requirement.",hint:"An honest 'cannot yet determine' is better than a confident fabricated period."}
 ],
 contract:[
  {name:"Map the source",question:"Locate the notice provisions and every missing cross-reference.",evidence:"Quote or paraphrase the fictional Clause 8, Definition 1.7 and Clause 19.3 in an exception table.",hint:"One notice period is 7 days and a defined term is 30 days. Schedule 3 is absent."},
  {name:"Find inventions",question:"What unsupported terms did AI insert into its rewrite?",evidence:"Identify the added 14-business-day period and fictional tribunal clause.",hint:"Neither was authorised in the source contract."},
  {name:"Rate the consequences",question:"Which inconsistencies require instructions before redrafting?",evidence:"Create a three-column source/defect/action table with owners.",hint:"Separate factual, commercial and legal sign-off responsibilities."},
  {name:"Request instructions",question:"Write an impartial clarification message to the fictional client.",evidence:"Ask which notice term is agreed and where the missing schedule should be obtained.",hint:"Do not imply a proposed period is legally preferred without source work."},
  {name:"Run release checks",question:"How will you check the corrected draft across the document?",evidence:"Set out cross-reference, definitions, redline, source and senior-review gates.",hint:"A polished rewrite remains a draft until approved."}
 ],
 privacy:[
  {name:"Contain the proposal",question:"What should happen before real material goes to an unapproved AI service?",evidence:"Record the stop/escalate decision and a no-upload explanation.",hint:"A vendor marketing claim is not an approved processing arrangement."},
  {name:"Classify risk",question:"Which information is privileged, confidential or personal?",evidence:"Build a fictional classification table; identify missing data and recipients.",hint:"Changing names may not remove indirect identifiers."},
  {name:"Evaluate provider",question:"Which contractual and technical controls must be checked?",evidence:"List retention, subprocessors, location, training policy, access, security, deletion and incident response.",hint:"Ask for verifiable evidence rather than general assurance."},
  {name:"Escalation route",question:"Who should decide whether the service is approved?",evidence:"Draft an approval request with defined scope, purpose and named reviewer roles.",hint:"Do not announce a definitive legal obligation without checking official current requirements."},
  {name:"Continue safely",question:"How could the associate still learn or practise without client information?",evidence:"Describe a genuinely fictional exercise and an incident-response outline if disclosure already occurred.",hint:"Never upload identifiable real documents for a classroom task."}
 ],
 pilot:[
  {name:"Choose use case",question:"Which work is suitable for a controlled pilot instead of unattended client advice?",evidence:"Rank one low-risk and two higher-risk workflows with reasons.",hint:"Consider reversibility, accuracy verification and professional responsibility."},
  {name:"Risk register",question:"What failures could harm confidentiality, accuracy or accountability?",evidence:"Build five risk entries with owner, severity, mitigation and residual concerns.",hint:"Include an invented citation and missed exception from the test log."},
  {name:"Design evaluation",question:"How will you evaluate model reliability on fictional source material?",evidence:"Set baseline, 20-test sample, reviewer checks and serious-error veto criteria.",hint:"A high average score cannot excuse a fabricated binding authority."},
  {name:"Assign responsibilities",question:"Who is allowed to approve, use, audit and stop the pilot?",evidence:"Write a responsibility matrix and cost/security controls.",hint:"The provider is not the firm's accountable signatory."},
  {name:"Board recommendation",question:"Would you proceed, revise or defer and on what conditions?",evidence:"Give a conditional recommendation, supporting evidence, timeline and explicit gates.",hint:"The board needs a decision with measurable stop/go criteria."}
 ]
});
