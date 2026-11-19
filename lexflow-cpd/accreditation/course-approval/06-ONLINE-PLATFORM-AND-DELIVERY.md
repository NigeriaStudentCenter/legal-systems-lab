# Document VI — Proposed Online Platform and Delivery Arrangements

## Platform architecture
**Public information/teaching pages:** BSOE LexFlow Academy static HTML learning pages hosted from GitHub Pages under the educational domain.  
**Learner/faculty identity:** Microsoft Entra authentication for role-restricted learner and faculty operations.  
**Protected application/API:** Azure Container Apps with authenticated Node.js API, managed identity and Azure-hosted tutoring service.  
**Records:** PostgreSQL course sessions, enrolment, attendance attestations, assessment decisions and BSOE certification audit, restricted to authorised staff/service accounts.  
**Secrets:** Azure Key Vault or other approved managed secret store; no secrets are stored in public GitHub.  
**Practice notes:** Browser-local workbooks and case exercises. These are **not** treated as official regulator attendance or academic assessment records.

## Learner journey
1. Learner receives public course information and a verified registration/approval route.
2. Following approved production onboarding, learner authenticates through Entra and obtains a session enrolment.
3. Learner studies 20 lessons, with formative questions and fictional-case activities.
4. Learner views approved video demonstrations and completes digital workbooks.
5. The AI tutor offers lesson/stage-specific educational questions; it does not process real client matters or issue legal advice.
6. Learner completes the integrated capstone and explicitly submits it to the authenticated API.
7. Assigned faculty grades the capstone, provides feedback and handles revision or resubmission.
8. Independent approved attendance and assessment controls support any valid BSOE completion decision.
9. If NBA-ICLE approves the course, specific participant reporting and recognised credit decisions follow the Institute's instructions, not automatic platform calculations.

## Delivery settings for NBA-ICLE consideration
- **Intended delivery mode:** Online, with instructor-led components if required by Institute approval.
- **Proposed workshop structure:** Five facilitated blocks of 120 minutes; timetables, exact dates and verified facilitators to be supplied.
- **Independent material:** 20 authored lessons totalling 440 *planned*, not verified, minutes; five case dossiers, 25 guided stages and five simulations.
- **Online tutor:** Azure model with server-owned bounded lesson/case prompts and daily usage caps. Responses are educational suggestions; claims to official law must be verified independently.
- **Course media:** Five original videos commissioned; only one confirmed completed, four quota-failed and awaiting credit-authorised recovery.
- **Access / devices:** Responsive HTML site intended for desktop and mobile; production browser and accessible-technology tests outstanding.
- **Learning support:** Faculty-led responses, moderated assessments, accessibility alternatives and approved participant communications, subject to final staffing.
- **CPD credits:** None allocated until written NBA-ICLE decision.

## Existing development evidence (not production approval)
Repository deployment log `../../infra/DEV-DEPLOYMENT.md` reports Azure dev resource group `rg-lexflow-cpd-dev`, Container App `lexflowcpd-api`, separate SQL migrations, runtime database grants and 26/26 tested fictional Phase 8 API scenarios. It does not prove production segregation or regulator-accepted participant tracking. Actual participant accounts must not be created in this shared fictional environment.

## Online platform demonstration for NBA-ICLE
Offer a scheduled *supervised* demonstration rather than public administrative access. Demonstration agenda:
- Public learner syllabus, lessons and mobile view;
- Fictional legal research and contract-control case;
- Authenticated fictional learner and bounded tutor consultation;
- Explicit capstone submission and assigned faculty grading;
- Demonstrated independent attendance approval and BSOE certificate safeguards;
- Proposed secure participant spreadsheet exports and reporting controls;
- Audit trails, role restriction, accessible alternatives and privacy design;
- Questions and technical acceptance criteria required by Institute.

A dedicated institution viewer/demo role must not be invented as active. Provide approved, time-limited demonstration credentials to the NBA-ICLE officer through a private verified channel; revoke access afterward.

## Production and operational gates
Current environment remains fictional-data-only. Before actual accredited delivery: isolated production identity and DB; secure enrolment/attendance reporting and retention; authorised data protection documents; instructor profiles; complete and approved videos; accessibility audit; full browser acceptance; clear payment/refund policy; final academic/legal sign-off. No official credit allocation is calculated from a quiz or video watching.
