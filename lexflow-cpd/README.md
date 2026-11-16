# LexFlow CPD Academy — BSOE Nigerian legal AI education

A distinct learning section of NigeriaStudentCenter/legal-systems-lab.

## Access points

- [Academy homepage](index.html)
- [Expanded flagship: 20 guided lessons](academy.html)
- [Five interactive professional simulations](academy-simulations.html)
- [Five fictional evidence dossiers with document-level assignments](case-lab.html)
- [25-stage Socratic guided case investigation workspace](guided-investigations.html)
- [Six-part integrated 100-point capstone assignment](capstone.html) — local drafting plus a new protected faculty submission route (requires migration 003 and deployment)
- [Printable instructor workshop and assessment guide](instructor-guide.html)
- [Complete instructor delivery handbook and marking guidance](INSTRUCTOR-DELIVERY-PACK.md)
- [Original five-module pilot and 8-question knowledge check](course.html)
- [Original citation verification walkthrough](animation.html)
- [Authenticated fictional learner development portal and Azure tutor](portal.html)
- [Faculty and compliance development workspace](staff.html)
- [Accreditation and governance](compliance.html)
- [Phase 12 consolidated QA review dossier](PHASE12-QA-REVIEW-DOSSIER.md) — independent reviewer approval outstanding

## Flagship curriculum v1

Responsible AI for Nigerian Legal Practice comprises **five modules, four lessons in each, 20 lessons total**. Planned guided teaching activities sum to approximately 440 minutes, excluding independent reading and full capstone preparation; this estimate is *not* an approved NBA-ICLE credit calculation.

Each lesson includes a structured concept explanation, fictional practice demonstration, written workbook task and an automatically checked knowledge question. Five interactive simulations each offer three linked professional decisions and formative feedback. Five case files provide invented evidence documents, cross-document inconsistencies, a workbook and a self-review rubric. The guided investigation workspace adds 5 stages per case (25 steps total) with browser-local evidence notes and optional case/stage-specific secure Azure tutor coaching. The capstone includes six written dimensions and a proposed 100-point faculty rubric, with download and draft-completeness checks. New GitHub backend source supports separate authenticated submission and human marking, but the running Azure revision and migration 003 must be verified before live use. These decisions remain separate from certificate eligibility. The instructor delivery pack includes five 120-minute workshop agendas, lesson objectives, case facilitation, marking and moderation guidance. Workbook answers/checkpoints are browser-local and exportable in JSON/text; they are **not** verified identity, attendance, assessment competence or NBA-ICLE evidence.

The [animation preproduction pack](INSTRUCTOR-ANIMATIONS.md) includes five original teaching scripts. Five production sessions have now been accepted by HeyGen; their [video production tracker](VIDEO-PRODUCTION-TRACKER.md) lists the session links. Rendering and permanent media publication are not yet confirmed.

## Azure development integration (reported testing on 16 Nov 2026)

The version-controlled record [infra/DEV-DEPLOYMENT.md](infra/DEV-DEPLOYMENT.md) documents a fictional-data Container Apps development deployment, PostgreSQL migrations 001, 002 and 003, Microsoft Entra role testing, faculty evaluation, independent attendance review, BSOE certificate creation/revocation logic, and managed-identity Azure AI tutor tests. Do not treat a repository record as a fresh direct Azure control-plane verification; verify running revision, authentication, logs and health independently.

- Source: [backend/](backend/)
- Deployment Bicep: [infra/dev.bicep](infra/dev.bicep)
- Azure verification checklist: [infra/STATUS-VERIFICATION.md](infra/STATUS-VERIFICATION.md)
- Curriculum checks: [academy-check.mjs](academy-check.mjs) and GitHub Actions workflow
- Runtime data: **PostgreSQL** with `pg`, `DATABASE_URL`, `DATABASE_SSL=true`
- Deployment: **Azure Container Apps**, port 8080; `/healthz`, `/readyz`
- SQL schema: numbered files in `backend/sql/`, applied by an out-of-band operator, never by the runtime
- Runtime database grants: SELECT/INSERT/UPDATE only; no DELETE or DDL

`auth-config.js` is a public identifier file and must never hold secrets. Course development does not change it.

## Legal, teaching and production gates

NBA-ICLE provider/course approval is **not established**. This Academy does **not** award NBA CPD credits. BSOE completion certificates in the fictional development environment must not be confused with accredited NBA awards.

Outstanding tasks include editorial and faculty review of the 20-lesson material; filmed or rendered original media; deployment and acceptance testing of server-owned lesson-aware Azure tutor context (20 lessons), and subsequent alignment to the final consolidated expert-reviewed materials; accessible equivalent activities; secure verified production analytics; actual learner onboarding, identity policies and privacy review; robust certificate governance and NBA-ICLE application materials. Do not put real client matters, privileged papers, production learner information or Azure secrets in this public GitHub repository.

### Release procedure

Curriculum, guided investigation, capstone, instructor and server-side tutor source changes are on `main`, and a GitHub Actions curriculum workflow has been added to check five modules, 20 lessons, five simulations, source references, syntax and page connections. Check its actual run status before calling the curriculum technically validated. The lesson-aware and five-stage case-aware tutor code requires a fresh container image, GitHub CI evidence, approved digest and manual Azure deployment; no DDL, schema migration or changes to auth-config.js are required for this tutor-context release. Code commit alone does not prove GitHub Pages rendering or live Azure operation.

## Phase 8: capstone assessment integration (source committed)

New `backend/sql/003_capstone_assessment.sql` defines learner capstone submissions and six-dimension faculty decisions. It must be applied by an authorised migration operator before releasing the updated Azure image. The runtime identity remains limited to SELECT, INSERT and UPDATE, with no DDL or DELETE; `auth-config.js` is untouched.

Protected API endpoints include `GET /api/capstone/my`, `POST /api/capstone/submissions`, `GET /api/faculty/capstones`, and `POST /api/faculty/capstones/:id/decision`. All are Entra-authenticated, with role permissions and server-side enrolment/faculty assignment checks. Capstone submissions do not trigger certificate issue or NBA-ICLE credit awards. The detailed operator-runbook is [Phase 8 capstone release](infra/PHASE8-CAPSTONE-RELEASE.md).

## Phase 12 consolidated quality review status

An evidence-based source and regulatory desk review has been performed and documented in [Phase 12 QA dossier](PHASE12-QA-REVIEW-DOSSIER.md). It **does not** constitute an independent Nigerian legal practitioner/assessment/accessibility sign-off. One of five teaching videos is completed; modules 2–5 failed at HeyGen because video credits were exhausted (`paid_tier_quota_exceeded`). The reviewed expert approval, actual media acceptance, measured learning hours, complete browser accessibility and production privacy controls remain launch blockers. Phase 8 Azure development deployment is documented with migration 003 and 26/26 authenticated API checks in [DEV-DEPLOYMENT.md](infra/DEV-DEPLOYMENT.md). Do not call the current development programme accredited.
