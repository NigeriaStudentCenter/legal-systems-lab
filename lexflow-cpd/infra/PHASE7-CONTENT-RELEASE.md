# Phase 7 — Guided Case Investigations, Capstone and Instructor Delivery: release handoff
**Status:** Source implemented in GitHub; deployment of the new case-aware tutor backend is NOT established by this file. Development uses fictional identities and invented legal materials only.

## Completed source components
| Deliverable | Source | Boundary |
|---|---|---|
| Five structured case investigations × five guided stages | `guided-investigations.html`, `guided-investigations.js`, `guided-investigations-content.js` | Browser-local written responses and self-reported progress |
| Azure tutor case coaching | `backend/tutor-investigations.mjs`, `backend/server.mjs`, `auth.js` | Entra JWT required, server-controlled case/stage, no client/workbook upload |
| Extended fictional evidence | `case-dossiers.js`, `case-lab.html` | Entirely invented source documents |
| Professional integrated capstone | `capstone.html`, `capstone.js`, `capstone-content.js` | Six parts, proposed 100-point rubric, exportable draft, no automatic grading |
| Instructor workshop guide | `instructor-guide.html`, `instructor-guide.js` | Five workshop navigations and lesson evidence cues |
| Full instructor handbook | `INSTRUCTOR-DELIVERY-PACK.md` | Faculty scripts, all twenty lesson plans, case debriefs, assessment moderation |
| Automated checks | `academy-check.mjs`, `backend/test/case-investigations.test.mjs`, CI YAML | Source-level checks are committed; actual successful runs must be verified independently |

## Protected tutor API contract
Existing route: `POST /api/tutor` with Microsoft Entra Bearer token.

Three supported request formats (one at a time):
```json
{"question":"Help me check a fictional citation."}
{"question":"Explain a fictional legal research workflow.","lessonId":"1-2"}
{"question":"Ask me one question about the missing source.","caseId":"authority","investigationStage":1}
```
Case ID allowlist: `authority`, `amendment`, `contract`, `privacy`, `pilot`.
Stage: integer 0–4. Unknown cases, stages or a case+lesson combination return 400; unauthenticated requests remain denied. The browser sends **only** case/stage selector and the learner's question, **not** local case notes, capstone answers or fictional evidence files. System instructions and fictional lesson context are owned by server code.

## Release checklist — operator controlled
1. Verify `lexflow-cpd-curriculum.yml` completed successfully on the desired SHA.
2. Verify `lexflow-cpd-api-image.yml`: new no-DB case/tutor tests, pre-existing PostgreSQL integration tests, dependency audit, Trivy scan and image build all pass.
3. Obtain the built immutable image digest and confirm Dockerfile includes `tutor-curriculum.mjs` and `tutor-investigations.mjs`.
4. An authorised operator updates `infra/dev.parameters.json` and performs a Bicep deployment to existing `rg-lexflow-cpd-dev`; never assume a push to GitHub deploys Azure.
5. Check live `/healthz` and `/readyz`. Test fictional authenticated calls: case stage 0 and 4 work, stage 5/unknown case/lesson+case are rejected, unauthenticated call rejected, wrong tenant and learner access to admin controls denied.
6. Confirm the Entra redirect flow returns to the registered `portal.html` and retains the non-sensitive case/stage selector across sign-in via bounded sessionStorage handoff. No workbook text belongs in sessionStorage beyond browser-local exercise storage already used for personal work.
7. Verify daily tutor quota still applies, and only usage counts/tokens are stored in `cpd_tutor_usage` (not prompts/answers).
8. Confirm restricted PostgreSQL runtime login: SELECT/INSERT/UPDATE only; no schema DDL/DELETE; migration 002 unchanged. **No migration 003 is necessary for this phase**.
9. Test the five learner case stages, capstone export, instructor guide print view and keyboard navigation on desktop and mobile.
10. Do not embed any HeyGen video until completed media assets and licence rights are confirmed.

## Proposed final assessment marking governance
Six dimensions, 100 points: business case 15; source reliability 20; confidentiality/vendor controls 20; governance 15; evaluation 15; board recommendation 15. Proposed educational benchmark: 70 points and at least 10/20 in the source and privacy dimensions, subject to later course-director adoption. Only assigned faculty may mark official assessments through the authenticated Azure operations system. A local word-count indicator or formative checklist must never issue a passing certificate.

## Final expert review (ONE consolidated review after production)
Per BSOE's instruction, do not block content production for interim external expert approvals. When final lesson materials, all five completed videos, the case laboratory, guided tutor, capstone, instructor pack and platform behaviour are complete, assemble one legal/instructional/accessibility/assessment review package. Until then: fictional development only and no NBA-ICLE-accredited credit claims.

## Dependencies
- The five HeyGen sessions are recorded in `VIDEO-PRODUCTION-TRACKER.md` but final renders remain unverified.
- GitHub source changes here are **not** proof the new Azure revision is serving requests.
- Staff actions and faculty grading must remain role-restricted; the public instructor planning guide is not an authorisation boundary.
- Do not overwrite `lexflow-cpd/auth-config.js` or expose Azure secrets.
