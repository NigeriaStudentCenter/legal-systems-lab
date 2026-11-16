# Phase 12 — Consolidated Quality Assurance and Independent Review Dossier
**BSOE LexFlow CPD Academy, Nigeria** · 16 November 2026 · Draft QA dossier v1
**Disposition:** TECHNICAL / DESK REVIEW COMPLETED; **FINAL EXPERT SIGN-OFF NOT GRANTED**.
**Scope:** twenty professional lessons, five fictional evidence dossiers, twenty-five guided case stages, five decision simulations, one six-dimension capstone (100 points), instructor delivery pack, server-owned Azure tutor context, identity/assessment controls, video media and NBA-ICLE readiness.

## 1. Review integrity and evidence standard
This is a documented **AI-assisted desk review of source assets**, not an independent opinion by an enrolled Nigerian legal practitioner, data-protection specialist, accessibility auditor or NBA-ICLE officer. The final consolidated expert review requested by BSOE requires named qualified reviewers to examine the actual rendered final media and real browser experience, and to sign their findings. Do not describe this dossier as an accredited course, an external legal sign-off, or a substitute for that review.

**Evidence levels**
- **A — Inspected:** direct GitHub source examination; public Nigerian legal text; live HeyGen session status; GitHub run records.
- **B — Documented:** deployment tests described in `infra/DEV-DEPLOYMENT.md` (26/26 Phase 8 API tests); not independently replayed in Azure at review time.
- **C — Unverified:** physical learner/faculty/browser accessibility walkthrough, live production privacy architecture, final expert judgment, durable video hosting, external accreditation.

## 2. Inventory and assessment

| Area | Evidence | Finding | Gate |
|---|---|---|---|
| Course map | `academy-content.js` | 5 modules / 20 lesson objects verified; minute allocations total **440** (65+85+85+95+110). Each lesson has concept, fictional demonstration, workbook practice and a single knowledge checkpoint | **Conditional**: a paragraph/quiz is not itself proof of 440 minutes of delivered instruction |
| Practice | `case-dossiers.js`, `academy-scenarios.js`, `guided-investigations-content.js` | Five invented evidence packs, five 3-decision simulations and 25 bounded guided stages | **Conditional**: expert to audit realism, validity of model approach and avoidance of actual client identifiers |
| Learner workbook | `academy.js`, `case-lab.js`, `guided-investigations.js`, `capstone.js` | Browser-local responses with exports; do not claim verified attendance or professional competency | **Conditional**: browser QA, lost-device warning, clear privacy notice |
| Capstone | `capstone-content.js`, `backend/capstone-policy.mjs` | Six components = 100 proposed marks; critical minima research/privacy. Assigned faculty must grade; no automatic certificate | **Conditional**: grading policy, inter-rater calibration, evidence submission and appeals procedures remain for final academic approval |
| Staff / Azure API | `infra/DEV-DEPLOYMENT.md` | GitHub record reports migration 003, restricted database grants, 26/26 authenticated live API checks, and no certificate eligibility from capstone | **Conditional**: learner and faculty **browser** workflow unverified, no fresh direct control-plane attestation |
| AI tutor | `backend/tutor-curriculum.mjs`, `backend/tutor-investigations.mjs` | Server-side bounded lesson/case context, safe fictional prompts, confidentiality and citation checks. AI answers remain non-authoritative | **Conditional**: adversarial prompt-injection tests, hallucination samples and lesson-by-lesson pedagogical testing outstanding |
| Video | `VIDEO-PRODUCTION-TRACKER.md` checked against HeyGen on 16 Nov 2026 | **1 completed video (module 1, 76.2 sec); 4 sessions FAILED**. No final content/visual/caption acceptance yet | **FAIL / BLOCKED** |
| Faculty pack | `INSTRUCTOR-DELIVERY-PACK.md`, `instructor-guide.html` | Five suggested 120-min workshops; 20 lesson evidence prompts; moderation and rubric procedures; named staff credentials still needed | **Conditional** |
| Regulatory | Official NBA-ICLE MCPD Rules 2025, Rules 11–13; NDPA 2023; NDPC GAID 2025; RPC 2023 | Primary regulatory sources identified. No approval received. Rules impose operational reporting and provider obligations | **FAIL / NOT ACCREDITED** |
| Accessibility | HTML code inspection only | Responsive CSS, labels and live feedback implemented; no measured WCAG/keyboard/screen-reader/caption audit | **Conditional / unverified** |

## 3. Corrected facts and critical findings

### P12-001 — Video production (critical, open)
Live HeyGen status: Module 1 completed, video ID `7b13a8e6cd204fcbb2fc3e5cdda59e79`; duration 76.1991 seconds. Modules 2–5 are **failed** sessions, not merely waiting for credits. The completed video must be watched, its spoken and on-screen legal assertions checked, and a permitted durable media copy stored. Recover or explicitly replace the four failed sessions only after credit/cost approval. Do not publish non-final placeholders or signed expiring URLs. This item blocks final certification of Phase 12.

### P12-002 — Independent subject-matter review (critical, open)
A Nigerian lawyer experienced in professional conduct, legal research, litigation/drafting and continuing education must validate every didactic legal claim, simulation outcome, marking rubric, answer key, source link, documentary example and AI tutor system instruction. Name the reviewer, qualification, date and approval scope; record revisions and a signed decision. BSOE has requested one consolidated review **after production**, not an interim approval after each module. No signature is represented as having been obtained.

### P12-003 — Professional depth versus claimed hours (major, open)
The 20 authored lessons have **440 minutes of planned lesson time**. This does not prove those minutes are filled with substantive instruction or learning activity. Current lesson content uses concise explanations. Require actual teaching media, worked examples, guided exercises, instructor facilitation and measured activity timing, plus an evidence table mapping each lesson to learner outputs and observed time. No NBA-ICLE credits are to be derived by dividing 440 by 60.

### P12-004 — Accreditation compliance scope (critical, open)
The published NBA-ICLE MCPD Rules 2025 distinguish provider accreditation under **Rule 12** from advance accreditation of individual activities under **Rule 13**. Rule 12 requires, inter alia, courses of at least one hour, modes of instruction, faculty/fee schedules, an online dry-run option, advance notice and participant reporting; Rule 13 describes advance application timing (at least 60 days before a proposed activity). The Rules also address ethics and anti-money laundering/terrorism-financing activity expectations. BSOE must decide the approval route with NBA-ICLE and meet applicable conditions. **No automatic credits or provider approval exist.**

**Interpretive issue:** Rule 12(7) describes keeping participants' names for **at least five years**; Rule 12(10) describes **three years** for an accredited provider. This is internally inconsistent on its face. Do not silently select either duration. Seek the Board's current formal interpretation and assess retention obligations under NDPA/GAID; implement the appropriate approved policy only after privacy review.

### P12-005 — Nigerian primary-source and privacy context (major, partially addressed)
The course reading list now includes the official Nigeria Data Protection Act 2023, the NDPC General Application and Implementation Directive (GAID) 2025, RPC 2023 reference reproduction, and NBA-ICLE MCPD Rules 2025. The NDPC's published Annual Report explains the GAID was issued 20 March 2025 and effective **19 September 2025**. Do not give final interpretations of NDPA lawful bases, privilege exceptions, cross-border data rules or lawyers' duties from model summary alone. The NPC/RPC reproduction is a useful finding aid; obtain an authoritative copy for citation and confirm current amendments at final expert review.

### P12-006 — Tutor and confidentiality (major, open)
The API documents bounded tutor lessons/cases, Microsoft Entra sign-in, managed identity, 10 answers per user/day and 50 across users/day, and no prompt/answer database logging. These are design/documentation claims requiring runtime and provider-data-processing verification. Perform a red-team set: fabricated judicial holding, injection in user text, real client data attempts, hidden source request, prompt leakage, unverified regulatory question, unapproved accreditation claim, and off-topic escalation. Record outputs, corrections and post-fix regression.

### P12-007 — Assessment fairness (major, open)
The 100-point capstone marks sections 15/20/20/15/15/15, with a **proposed**, not approved, 70-point pass and 10/20 minima in research/privacy. Faculty credentials, marker training, double-marked moderation samples, plagiarism/AI disclosure, accommodations, appeals, reassessment opportunities, evidence integrity and secure records retention need a written final policy. One-question-per-lesson formative checks must not be treated as proof of professional competency.

### P12-008 — Accessibility and user acceptance (major, open)
Conduct actual keyboard-only, focus/order, heading structure, mobile zoom and orientation, screen-reader, contrast, error messaging, questionnaire progression, localStorage failure, export and browser-sign-in checks. Confirm video captions are synchronised and a complete transcript exists. No auditor has observed the full final learner experience at review time.

### P12-009 — Azure environment and production governance (major, open)
GitHub's `infra/DEV-DEPLOYMENT.md` documents the Phase 8 image `sha256:9bffed4c…`, migration 003, restricted runtime privileges and 26/26 live API checks. This is a **shared, fictional-data development environment**. Real learners must not enter it. Before production: separate Entra tenancy and test identities, Key Vault/secrets boundaries, database and logs, backup/retention controls, firewall scopes, provider terms, accessibility audit and data-protection documentation.

### P12-010 — Documentation consistency (minor, addressed)
The obsolete introductory claim that the backend returned HTTP 501 for certificate issue contradicted later documented fictional BSOE issuance. Corrected `DEV-DEPLOYMENT.md`: BSOE certificates use an independent verified attendance/assessment approval process; they are **not** NBA-ICLE-accredited credit.

## 4. Reviewer assignments and evidence requirements
| Reviewer role | Verification scope | Required evidence |
|---|---|---|
| Nigeria-qualified senior legal practitioner | Current law, professional responsibility, privilege, citations, scenarios and legal-review sign-off | Signed legal source matrix, content annotations |
| Nigerian data protection specialist | NDPA, GAID, disclosure, transfers, retention, tool procurement | Privacy impact summary and supplier/control report |
| Experienced CPD curriculum/faculty assessor | Objectives, 440-minute learning-hour evidence, rubrics, capstone moderation and instructor competence | Mapped learning outcomes, sample double-marking |
| Accessibility/UX tester | WCAG 2.2 AA criteria as relevant, keyboard, mobile, captions/transcripts, learner and faculty screens | Browser/screen-reader screenshots, failure log |
| Azure security and operations owner | Entra role boundaries, privacy, usage metering, API tests, backup/recovery, production isolation | Reviewed configuration and deployment evidence |
| Video producer/editor | Accuracy of five rendered videos, captions, rights, durable hosting and transcripts | Final approved videos and accessible media register |
| NBA-ICLE liaison / accreditation officer | Rules 11–13, accreditation route, attendance/reporting templates and credit approval | NBA-ICLE written confirmation or formal decision |

No role in this matrix has yet provided an independent signature in this dossier.

## 5. Release gates: all must pass to declare Phase 12 complete
- [ ] All five original videos completed, retained on durable authorised hosting and individually accepted by reviewer
- [ ] Every legal claim, source, answer key, example and assessment rubric signed off by qualified subject specialist
- [ ] Evidence supports instructional duration and measurable learning outcomes (not just planned minutes)
- [ ] Faculty marking calibration, appeals/reassessment and data-handling policies approved
- [ ] All 25 guided stages and lesson-aware tutor behaviours tested with structured adversarial cases
- [ ] Browser acceptance and accessibility tests completed on mobile and desktop
- [ ] Production environment and privacy/identity safeguards approved before any real learner
- [ ] NBA-ICLE claims remain at zero credits unless provider/course accreditation is formally granted
- [ ] Final consolidated review board minutes, changes and signatures archived

**Phase 12 review readiness:** dossier assembled; remediation register opened; no independent panel sign-off obtained. **Overall decision: HOLD — NOT READY FOR REGULATED PROFESSIONAL LAUNCH.** The fictional educational development experience may continue, clearly labelled, without real client data.

## 6. Authoritative review starting points
- Nigeria Data Protection Act 2023: https://cert.gov.ng/ngcert/resources/Nigeria_Data_Protection_Act_2023.pdf
- NDPC GAID 2025: https://ndpc.gov.ng/wp-content/uploads/2025/07/NDP-ACT-GAID-2025-MARCH-20TH.pdf
- RPC 2023 reference copy: https://www.judy.legal/legislation/akn/ng/act/si/2023/32
- NBA-ICLE MCPD Rules 2025: https://www.nbaicle.org/_files/ugd/81a65d_03fc1c9b473a4c6c8ebb26d02debfcc2.pdf?index=true

## 7. Final-review decision record template
**Review board date:** ______  
**Scope/version reviewed:** ______  
**Named reviewers and professional credentials:** ______  
**Findings closed (IDs and evidence):** ______  
**Residual risks accepted by authorised BSOE representative:** ______  
**NBA-ICLE provider/course decision and supporting correspondence:** ______  
**Decision:** APPROVE / APPROVE SUBJECT TO REMEDIATION / REJECT  
**Signatures, professional identifiers and dates:** ______

_This section must remain unsigned until independent experts actually review the final materials._
