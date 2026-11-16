# LexFlow CPD — Phase 8 secure capstone release
**Build status:** Implemented and committed to GitHub source. **Not yet confirmed applied to Azure PostgreSQL or running in Azure Container Apps.**

## Objective
Link the six-part, 100-point fictional capstone to authenticated learner submissions and human faculty marking. This is a **separate educational assessment stream**, intentionally not an automatic condition for certificates or NBA-ICLE credit.

## Source deliverables
- `backend/sql/003_capstone_assessment.sql`: numbered, privileged-operator migration; creates `cpd_capstone_submissions` and `cpd_capstone_decisions`.
- `backend/capstone-policy.mjs`: fixed six-component answer schema, bounded input, dimension-specific maximum marks, total marks / 100, proposed educational pass threshold.
- `backend/server.mjs`: four protected capstone API routes and separate audit events.
- `backend/Dockerfile`: packages `capstone-policy.mjs`.
- `portal.html` + `auth.js`: optional explicit transmission of a complete local capstone draft to an enrolled fictional session, with visible learner status.
- `staff.html` + `staff.js`: assigned faculty can inspect the fictional submission, enter six integer marks and feedback, and decide pass/fail/return.
- `backend/test/api.integration.test.mjs` + `backend/test/capstone-policy.test.mjs`: auth, RBAC, database and capstone-boundary tests.

## API contract (requires Entra delegated access)

| Method | Endpoint | Access | Function |
|---|---|---|---|
| GET | `/api/capstone/my` | Learner | View own past submission statuses, marks and feedback |
| POST | `/api/capstone/submissions` | Learner | Submit six bounded string answers and enrolled session UUID |
| GET | `/api/faculty/capstones` | Faculty | View only submissions belonging to assigned sessions |
| POST | `/api/faculty/capstones/:id/decision` | Faculty | Record one human six-dimension decision with required feedback |

The answer keys are `scope`, `research`, `privacy`, `governance`, `evaluation`, and `recommendation`. The marks maximums are 15,20,20,15,15,15 respectively. Proposed pass rule is total at least 70 with research at least 10 and privacy at least 10, pending final academic policy approval.

**Not connected to certificates:** Capstone faculty decisions do **not** update `cpd_enrolments.assessment_verified`, issue a certificate, alter regulator approval or award any NBA-ICLE credit. Legacy verified assessment/attendance checks remain unchanged. Avoid telling learners that capstone passing automatically completes accredited CPD.

## Required authorised operator deployment
1. Confirm existing 001 and 002 migration history and backup. Apply `003_capstone_assessment.sql` **once** using the migration operator, never on application startup.
2. Apply operator-only grants for runtime login:
```sql
GRANT SELECT, INSERT, UPDATE ON TABLE
  cpd_capstone_submissions, cpd_capstone_decisions
TO lexflow_cpd_runtime;
```
3. Verify runtime identity has no CREATE/ALTER ownership rights, no DELETE, and no TRUNCATE. Capstone tables must not be owned by the runtime login.
4. Check GitHub's `lexflow-cpd-api-image.yml` workflow passed tests, `npm audit` and Trivy. Obtain a new **immutable** digest, not a mutable tag.
5. Have the Azure operator deploy the approved digest through existing `infra/dev.bicep` to the existing `rg-lexflow-cpd-dev`, port 8080.
6. Check live `/healthz` = 200 and `/readyz` = 200; confirm the running revision digest matches.
7. Use **fictional** Entra learner and assigned faculty accounts. Verify unauthenticated 401, wrong roles 403, invalid payload 400, second pending submission 409, assigned faculty marking, rejection of unassigned faculty, and readback of marks.
8. Check that capstone grading creates **no** BSOE completion certificate or NBA-ICLE credit. Verify the pre-existing 10-point assessment plus independent attendance controls still gate certificate issuance.
9. Confirm the learner's browser explicitly asks consent before transmission; workbook exports remain local until the learner submits.
10. Audit database retention, faculty rights, and privacy before admitting real participant data. No current production learner records may be copied to development.

## Teaching/media review and scope
The five HeyGen video sessions in `VIDEO-PRODUCTION-TRACKER.md` are distinct; do not regenerate or pay twice merely to inspect status. Preserve the request for **one consolidated academic/legal/accessibility review after all instructional and media production**, rather than intermittent reviews.

No changes to `auth-config.js`, Azure managed-identity role assignments, Cosmos, or database settings were made by the capstone code itself.
