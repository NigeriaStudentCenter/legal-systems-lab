# LexFlow CPD API: development environment as deployed (16 Nov 2026)

**Fictional data only.** No real learner, attendance or certificate record may be stored here. The API awards zero NBA-ICLE credits and certificate issuing answers 501.

## What exists
| Piece | Name | Shared? |
|---|---|---|
| Resource group | `rg-lexflow-cpd-dev` (West Europe) | Dedicated |
| API | Container app `lexflowcpd-api`, scales to zero, at most one replica | Dedicated |
| Runtime identity | `lexflowcpd-api-id`; its only permission is reading the one secret below | Dedicated |
| Container Apps environment and logs | `lexflowstg-cae`, `lexflowstg-logs` in `lexflow-staging-rg` | **Shared with LexFlow NG staging** |
| Key Vault | `lexflowstg-kv-f88b66`, secret `cpd-database-url` | **Shared vault**, own secret |
| Database | `lexflow_cpd` on server `estatecopilot-db` | **Shared server**, own database |
| Runtime DB login | `lexflow_cpd_runtime`: SELECT/INSERT/UPDATE on the eight `cpd_*` tables; no DELETE, no DDL; 12 connections | Dedicated |
| Image | `ghcr.io/nigeriastudentcenter/lexflow-cpd-api`, pinned by digest in `dev.parameters.json` | GitHub registry (public) |
| Sign-in | `LexFlow-CPD-API` (`4fe1be03-…`) in the LexFlow NG **Staging** external tenant; see `../IDENTITY-SETUP.md` | Shared tenant |

API address: `https://lexflowcpd-api.calmdune-686822d1.westeurope.azurecontainerapps.io`

Extra cost is close to nothing: the app is idle at zero replicas and everything else already existed. The Azure subscription has a spending cap, so price anything new before adding it.

## How it was put together
1. `sql/001_initial.sql` (commit `7daf747`) applied to `lexflow_cpd` by a Microsoft Entra administrator of the server, then the grants in `../backend/sql/README.md`. `CONNECT` on the database is revoked from `PUBLIC`.
2. Image built by the workflow `LexFlow CPD API image`, which runs the 12 integration tests first. It deploys nothing.
3. `az deployment group create -g rg-lexflow-cpd-dev --template-file lexflow-cpd/infra/dev.bicep --parameters @lexflow-cpd/infra/dev.parameters.json`, run by an operator.

To release new code: merge to `main`, take the digest from the workflow summary, put it in `dev.parameters.json`, and run step 3 again.

## Checked on 16 Nov 2026
| Check | Result |
|---|---|
| Local syntax check and 12 integration tests; the same 12 in GitHub | Pass |
| `/healthz`, and `/readyz` (reaches the database over verified TLS) | 200 |
| `/api/me` with no token, a malformed token, a tampered real token | 401 |
| `/api/me` with a real token issued for the *other* LexFlow API | 401 |
| `/api/me` with a real token, user not in `cpd_users` | 403 |
| Same after an operator added the fictional user as `learner` | 200, role `learner` |
| `/api/sessions` | 200, empty |
| Admin report as a learner | 403 |
| Check-in with no enrolment | 409 |
| AI tutor | 503, not configured |
| Cross-origin preflight from `https://legal.bsoedu.org` / from elsewhere | 204 / 403 |
| Runtime login: DELETE, CREATE TABLE, DROP TABLE; connect to `lexflow_staging` | All refused |

The real tokens came from the fictional account `synthetic.applicant1` through the password-only test client `996d77d8-…`, which was granted the CPD scope for this purpose. That client must be deleted before the tenant holds any real account.

## Browser sign-in, 16 Nov 2026
`../auth-config.js` now points at this API, so **Sign in with Microsoft** is enabled on `https://legal.bsoedu.org/lexflow-cpd/portal.html`. Self-service sign-up is off in the tenant.

| Step | Result |
|---|---|
| Click Sign in with Microsoft | Microsoft's hosted screen for the staging tenant, no error |
| A person signs in as the fictional learner | Returned to the portal: "Signed in: Synthetic Applicant One (TEST)" |
| Click Check protected API access | "Azure API authenticated. Assigned role: learner." |

This needed one fix first: `portal.js` used to overwrite the address fragment that carries Microsoft's response. The Sign in button staying visible after sign-in was fixed in the next release.

## Release of 16 Nov 2026: learner registration, enrolment and live record
Image `sha256:b08ae65c…` from commit `d069d1c` (14 integration tests passed in GitHub before the build).

| Check on the live site or API | Result |
|---|---|
| Signed-in page: Sign in button hidden, Sign out shown | Pass |
| Page lists the open fictional session from the API | Pass |
| Click Enrol | "Enrolled.", enrolments 1, button becomes Check in |
| Click Check in | "Check-in recorded as unverified. No credit is awarded.", attendance 1, credits 0 |
| `POST /api/register` with no token | 401 |
| Second fictional account: `/api/me` before, register, register again, `/api/me` after | 403, 201 learner, 200, 200 |
| That account's own record | Empty, credits 0 |
| Audit trail | One each of `self-registered`, `self-enrolled`, `self-checkin` |

## Release of 16 Nov 2026: attendance review, assessment marking, certificates
Image `sha256:e256637f…` from commit `b65028f` (20 integration tests passed in GitHub). `sql/002_review_assessment_certificates.sql` (commit `83c57d5`) applied by a Microsoft Entra administrator before the image switch, then `SELECT, INSERT, UPDATE` on the four new tables granted to `lexflow_cpd_runtime`.

Roles given by an operator for the test: `synthetic.reviewer1` = faculty, assigned to the test session; `synthetic.reviewer2` = admin.

27 of 27 live checks passed with real tokens, including:

| Check | Result |
|---|---|
| Learner submits assessment; faculty sees it with the learner's name | 201, 200 |
| Faculty pass below 7/10; admin tries to mark | 400, 403 |
| Faculty passes the learner 8/10 | 201 |
| Certificate before attendance is approved | 409 |
| Admin tries to attest; faculty tries to approve own attestation | 403, 403 |
| Rejection without a reason; with a reason | 400, 201 |
| Admin approves the other attestation; completions show one eligible learner | 201, 200 |
| Certificate for the learner without a passed assessment; faculty tries to issue | 409, 403 |
| Admin issues; issues again | 201 (0 credits), 409 |
| Public verification by reference, no sign-in | valid, with name and course |

The learner's own page then showed: "Passed (8/10)" with feedback, the faculty attestation as approved, and the certificate with its reference.

## Known limits
- `lexflow_cpd_runtime` can open a connection to other products' databases on the shared server (their `CONNECT` is still granted to `PUBLIC`) but can read none of their tables.
- Self-registration (`ALLOW_SELF_REGISTRATION=true` here) creates learner records only. It is acceptable in this environment because self-service sign-up is off in the tenant, so every account was made by an operator. Faculty and admin roles are set by an operator in `cpd_users`.
- A learner can check in more than once for the same session; each entry is unverified and carries no credit.
- The portal button for creating a learner record was not clicked in a browser; the route behind it was tested with a real token.
- The AI tutor is off. Turning it on needs an Azure OpenAI deployment, a role for `lexflowcpd-api-id`, and a spending limit.
- Fictional rows now in the database: four users (two learners, one faculty, one admin), one open test session, two enrolments, one self check-in, two faculty attestations (one approved, one rejected), one passed assessment, one issued certificate.
- Faculty and admin have API routes only: their portal tabs are still demonstrations.
- Certificate revocation was tested locally only, so the live certificate stays valid.
- The learner's assessment form on the page was not clicked; the submission went through the API with a real token.

## Remove everything
Delete `rg-lexflow-cpd-dev`; delete the Key Vault secret `cpd-database-url`; then `DROP DATABASE lexflow_cpd; DROP ROLE lexflow_cpd_runtime;`.
