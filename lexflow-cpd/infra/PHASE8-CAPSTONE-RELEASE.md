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
4. Check GitHub's `lexflow-cpd-api-image.yml` workflow passed tests, `npm audit` and Trivy. Obtain a new **immutable** digest, not a mutable tag. The current committed `infra/dev.parameters.json` still contains an **older** image digest; do not mistake that recorded reference for the Phase 8 build.
5. Have the Azure operator deploy the approved digest through existing `infra/dev.bicep` to the existing `rg-lexflow-cpd-dev`, port 8080.
6. Check live `/healthz` = 200 and `/readyz` = 200; confirm the running revision digest matches. The Phase 8 `/readyz` now performs read-only queries against **both capstone tables** as well as the users table. If migration 003 or runtime grants are absent, readiness returns 503.
7. Use **fictional** Entra learner and assigned faculty accounts. Verify unauthenticated 401, wrong roles 403, invalid payload 400, second pending submission 409, assigned faculty marking, rejection of unassigned faculty, and readback of marks.
8. Check that capstone grading creates **no** BSOE completion certificate or NBA-ICLE credit. Verify the pre-existing 10-point assessment plus independent attendance controls still gate certificate issuance.
9. Confirm the learner's browser explicitly asks consent before transmission; workbook exports remain local until the learner submits.
10. Audit database retention, faculty rights, and privacy before admitting real participant data. No current production learner records may be copied to development.

## Teaching/media review and scope
The five HeyGen video sessions in `VIDEO-PRODUCTION-TRACKER.md` are distinct; do not regenerate or pay twice merely to inspect status. Preserve the request for **one consolidated academic/legal/accessibility review after all instructional and media production**, rather than intermittent reviews.

No changes to `auth-config.js`, Azure managed-identity role assignments, Cosmos, or database settings were made by the capstone code itself.

## Read-only preflight scripts (new)

**Before the release**, check that you have selected the correct Azure subscription. The scripts do not change cloud infrastructure or the database.

```bash
az login
az account set --subscription "<BSOE SUBSCRIPTION ID>"
EXPECTED_IMAGE="ghcr.io/nigeriastudentcenter/lexflow-cpd-api@sha256:<APPROVED_DIGEST>" \\
  bash lexflow-cpd/infra/check-phase8-azure.sh
```

The script checks the actual Azure Container App's ingress port, running immutable image, `/healthz`, `/readyz`, and unauthenticated rejection from `/api/capstone/my`. A different image is reported as **not yet deployed** without changing it. The script cannot directly prove migration 003 was applied or that every PostgreSQL permission is correct.

For a **separate restricted runtime database login**, run the read-only SQL report after an authorised operator has applied migration 003 and explicit grants. Use secure PG environment variables/connection configuration rather than printing a password-bearing URL:

```bash
psql -X -v ON_ERROR_STOP=1 -f lexflow-cpd/infra/check-phase8-runtime-grants.sql
```

Every row must say `PASS`; a `FAIL` blocks release. The database role must not own the new tables, and must have no DELETE/TRUNCATE, schema CREATE, database CREATE, or database TEMP privileges. For the strict no-DDL policy, the migration operator may need to revoke database TEMP from PUBLIC after checking impact on other database users. The operator must grant only SELECT, INSERT, UPDATE on the two new capstone tables.

**Important:** The read-only preflight cannot magically deploy the backend, apply migrations, or prove a GitHub Actions image has been approved. The real operator-controlled rollout still requires fresh CI results, migration evidence and an immutable digest.

## Request-size compatibility

Capstone JSON may contain six substantial sections. The API now accepts requests up to **32 KB** rather than the old 12 KB limit, while checking the six bounded answer strings and total content size at the application layer. A new test verifies a valid request larger than 12 KB is handled by the capstone application rather than rejected by Express as HTTP 413. Do not interpret permissive request parsing as permission to upload real client files or personally identifying details.

## Rehearsed operator deployment wrapper (Phase 8)
`infra/release-phase8.sh` is designed to fail closed. By default it runs **Azure ARM what-if only**, confirms the Azure subscription and pinned GHCR SHA-256 digest, and never applies SQL or deploys a container. It displays a **full resource difference** because the Bicep template also references shared identity, AI and Key Vault resources. A responsible operator must read the proposed changes and stop if they affect unexpected resources.

Example dry-run:
```bash
APPROVED_IMAGE='ghcr.io/nigeriastudentcenter/lexflow-cpd-api@sha256:<64_HEX_CHARACTERS>' \
EXPECTED_SUBSCRIPTION_ID='<INTENDED_SUBSCRIPTION_UUID>' \
bash lexflow-cpd/infra/release-phase8.sh
```

The release must not run in apply mode until migration 003 is applied, restricted-runtime access is audited, GitHub build/security tests have passed, and the full ARM difference is approved by the authorised operator. Explicit acknowledgments include `MIGRATION_003_CONFIRMED=YES`, `DB_RUNTIME_GRANTS_AUDITED=YES`, `GITHUB_TESTS_PASSED=YES`, `WHAT_IF_REVIEWED=YES`, `RELEASE_APPROVAL=YES`, and `APPLY_PHASE8=YES`.

The wrapper never guesses an image digest or updates `dev.parameters.json`. After an approved deploy, an operator must verify the running image and the secured API's 401 response. The new script `infra/test-phase8-release.sh` rehearses no-deploy defaults, missing approval and wrong-subscription protection with an **offline fake Azure CLI**. The GitHub Actions image workflow includes this rehearsal; a committed test is not evidence it has passed until the workflow result is checked.

`auth-config.js` remains untouched. The single consolidated academic/legal review stays deferred until all videos and course material are complete. No NBA-ICLE accreditation or official CPD credits are claimed.
