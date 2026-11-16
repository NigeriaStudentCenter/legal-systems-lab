# Phase 4-6 production handoff — course, case laboratory and Azure tutor

**Development status: source committed to GitHub; new Container Apps revision NOT deployed or attested by this documentation.**

## Components built

- `academy.html` + `academy.js` + `academy-content.js`: 20 guided lessons.
- `case-lab.html` + `case-lab.js` + `case-dossiers.js`: five original fictional legal evidence dossiers.
- `academy-simulations.html`: existing five decision-based simulations.
- `backend/tutor-curriculum.mjs`: server-owned 20-lesson AI teaching context and behavioural policy.
- `backend/server.mjs`: optional `lessonId` field on `POST /api/tutor`. Uses a strict allowlisted lesson selector of `0-0` through `4-3` and never accepts arbitrary system prompts, source documents or workbook answers from the browser.
- `backend/Dockerfile`: copies server-side teaching context into the Azure Container Apps image.
- `academy.js` deep-links to `portal.html?lessonId=0-0#learner` etc.; `auth.js` forwards only that lesson key along with a student's explicit question.
- `VIDEO-PRODUCTION-TRACKER.md`: records five HeyGen production sessions, not completed MP4s.

## Azure runtime guardrails retained

The Azure API still uses `pg`, `DATABASE_URL`, `DATABASE_SSL=true`, PostgreSQL least privilege (SELECT, INSERT, UPDATE only), Container Apps on 8080, `/healthz`, `/readyz`, and Microsoft Entra JWT validation including issuer, audience, JWKS, delegated scope, tenant and approved client IDs. The tutor retains usage caps and stored usage counts, without storing question/answer text. This phase needs no DDL, schema changes or runtime DELETE permissions. **Do not overwrite `auth-config.js`.**

Curriculum summaries in the AI tutor are teaching aids, not validated legal sources. The user question remains in a lower-trust model role. Answers must label uncertainty and ask the learner to consult authoritative sources. This mitigates hallucinations but does not guarantee factual correctness, confidentiality or prompt-injection resistance.

## Release procedure — operator controlled

1. Review `.github/workflows/lexflow-cpd-api-image.yml` test results: PostgreSQL integration tests, tutor-curriculum unit tests, vulnerability audit and image scan must pass.
2. Check `.github/workflows/lexflow-cpd-curriculum.yml`: 20 lessons, five cases, five simulations and tutor-context alignment.
3. Obtain the **immutable newly built image digest**, not a mutable `:dev` tag.
4. Use an authorised Azure operator to update `infra/dev.parameters.json` and deploy `infra/dev.bicep` to `rg-lexflow-cpd-dev`; this is a separate operator action, not performed by GitHub CI.
5. Validate new revision: `GET /healthz` 200; `GET /readyz` 200; `POST /api/tutor` with a fictional signed-in identity and `lessonId=1-2` returns tutoring on case-citation verification; invalid `lessonId=9-9` returns 400; no token returns 401; learner cannot access admin routes.
6. Check data-minimisation: the browser sends only a lesson key plus a question, and the database stores usage counters, not question/answer text.
7. Check no DDL or DELETE attempted by the runtime and no new Azure AI role grants were added.
8. Only after verifying finished video files and permanent media URLs, embed them at the relevant course modules with captions and transcript alternatives. Do not embed temporary signed HeyGen links.

## Expert review at the end, not during content build

As requested, consolidate **all five videos, all 20 lessons, five simulations, five case dossiers, the AI tutor instructional policy, assessment rubrics, accessibility and source references** into one full expert review at the end of production. Until that review and production controls are complete, the Academy remains fictional-data-only educational development; no NBA-ICLE approval or credits are implied.

## Important limitations

- Real production deployment, video rendering completion and end-to-end AI tutoring have not been freshly confirmed in this development pass.
- A knowledge checkpoint or self-review rubric does not constitute faculty-assessed competence or actual CPD participation.
- No automatic external law retrieval was added; a tutor must never claim the course summaries are authoritative Nigerian law.
