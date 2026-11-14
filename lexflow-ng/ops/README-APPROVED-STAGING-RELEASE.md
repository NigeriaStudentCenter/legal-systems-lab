# Approved LexFlow Entra Staging API Release — Operator Procedure

**Scope:** Upgrades the existing *synthetic-only* `lexflowstg-api` Container App image to the code from merged PR #7. It does not enable lawyer registration, directory, engagements, payments or the temporary authentication diagnostic. It is NOT a production deployment.

## Exactly what is authorised by this workflow
- The source SHA is pinned to the merged, previously tested commit `9d15b558d10ef5b1874382e924a401c2bc4328b0`.
- The source builds a new container image on GHCR, referenced by its SHA-256 digest, **not** a mutable `:latest` image.
- The deploy job requests the existing protected `lexflow-staging` GitHub environment, with a human reviewer.
- OIDC is used to authenticate to the existing Azure subscription.
- Before the update, the app name/resource group, current immutable image, issuer, audience, JWKS, CORS, TLS connection and all disabled business gates must match the expected configuration.
- The only Azure mutation is an image update **plus explicitly setting `ENABLE_AUTH_DIAGNOSTIC=false`**. All other feature flags must already be disabled and are left untouched. The workflow does not run SQL migrations, grant Azure roles, or publish browser pages.
- After updating it checks the exact new image, readiness, all existing business gates **off**, and `GET /v1/diagnostics/auth` returning 503 with no credentials.
- If the image update or validation fails, an automatic rollback restores the prior immutable image. If rollback itself fails, escalate immediately to the authorised Azure administrator.

## How to execute
1. Open https://github.com/NigeriaStudentCenter/legal-systems-lab/actions/workflows/lexflow-approved-staging-release.yml
2. Select Run workflow on `main`, then type the exact confirmation **`DEPLOY_SYNTHETIC_STAGING`**. The validation job refuses other branches and any other confirmation value.
3. Inspect the pinned commit, image build results and Azure scope. Confirm in GitHub Settings → Environments that `lexflow-staging` has required human reviewers. A named environment alone does not prove reviewer enforcement. Only an authorised owner should approve its deployment.
4. Confirm the deployment and smoke test steps are green. Check the run summary and the protected Azure staging Container App revision.
5. Keep all feature flags disabled. Do not enter personal, professional or client case information.
6. Separately arrange a protected browser preview and a real Entra **synthetic test account**. The actual sign-in acceptance needs another deliberate, short and approved test window for `ENABLE_AUTH_DIAGNOSTIC=true`, followed by immediate closure and read-only re-verification.

## Why testing is still controlled
The hybrid staging system shares a publicly accessible PostgreSQL server and has no production WAF or production-grade security review. It can run synthetic test records only. The authentication diagnostic is deliberately OFF after image deployment; the user must not mistake an installed diagnostic for a live sign-in or payments release.

## Source and verification
- Merge: https://github.com/NigeriaStudentCenter/legal-systems-lab/pull/7
- Existing successful Azure closed-gate preflight: https://github.com/NigeriaStudentCenter/legal-systems-lab/actions/runs/43579893414
- External ID public metadata/JWKS check: https://github.com/NigeriaStudentCenter/legal-systems-lab/actions/runs/43580758377
- Read-only staging acceptance: `lexflow-ng/ops/staging-readonly.mjs`
- Deployment security guard: `lexflow-ng/ops/staging-release-guard.mjs`
