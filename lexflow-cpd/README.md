# LexFlow CPD Academy — BSOE Nigerian legal AI education

A distinct learning section of NigeriaStudentCenter/legal-systems-lab.

## Access points

- [Academy homepage](index.html)
- [Expanded flagship: 20 guided lessons](academy.html)
- [Five interactive professional simulations](academy-simulations.html)
- [Original five-module pilot and 8-question knowledge check](course.html)
- [Original citation verification walkthrough](animation.html)
- [Authenticated fictional learner development portal and Azure tutor](portal.html)
- [Faculty and compliance development workspace](staff.html)
- [Accreditation and governance](compliance.html)

## Flagship curriculum v1

Responsible AI for Nigerian Legal Practice comprises **five modules, four lessons in each, 20 lessons total**. Planned guided teaching activities sum to approximately 440 minutes, excluding independent reading and full capstone preparation; this estimate is *not* an approved NBA-ICLE credit calculation.

Each lesson includes a structured concept explanation, fictional practice demonstration, written workbook task and an automatically checked knowledge question. Five interactive simulations each offer three linked professional decisions and formative feedback. Workbook answers/checkpoints are browser-local and exportable in JSON/text; they are **not** verified identity, attendance, assessment competence or NBA-ICLE evidence.

The [animation preproduction pack](INSTRUCTOR-ANIMATIONS.md) includes five original instructor video storyboards. **They are scripts, not published videos.** A separate HeyGen clip was previously submitted but has no confirmed permanent media asset.

## Azure development integration (reported testing on 16 Nov 2026)

The version-controlled record [infra/DEV-DEPLOYMENT.md](infra/DEV-DEPLOYMENT.md) documents a fictional-data Container Apps development deployment, PostgreSQL migrations 001 and 002, Microsoft Entra role testing, faculty evaluation, independent attendance review, BSOE certificate creation/revocation logic, and managed-identity Azure AI tutor tests. Do not treat a repository record as a fresh direct Azure control-plane verification; verify running revision, authentication, logs and health independently.

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

Outstanding tasks include editorial and faculty review of the 20-lesson material; filmed or rendered original media; lesson-aware Azure tutor grounding to approved content; accessible equivalent activities; secure verified production analytics; actual learner onboarding, identity policies and privacy review; robust certificate governance and NBA-ICLE application materials. Do not put real client matters, privileged papers, production learner information or Azure secrets in this public GitHub repository.

### Release procedure

Curriculum files are on `main`, and a GitHub Actions curriculum workflow has been added to check five modules, 20 lessons, five simulations, source references, syntax and page connections. Check its actual run status before calling the curriculum technically validated. Code commit alone does not prove GitHub Pages rendering or live Azure operation.
