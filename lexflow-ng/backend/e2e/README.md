# LexFlow NG — Controlled End-to-End Verification, 14 November 2026

## What has been built
New automated browser test: `lexflow-ng/backend/e2e/portal.browser.test.mjs`. Workflow: `.github/workflows/lexflow-synthetic-e2e.yml`.

The Playwright browser opens **actual client.html and lawyer.html**, loads the real browser portal code through an in-memory bundle, and connects over test-only intercepted HTTPS origins to **real Fastify API routes and PostgreSQL 16**. Only Microsoft Entra sign-in is substituted with an isolated mock identity provider compiled exclusively for this test; there is no credential or token use from staging, no production API call and no money movement.

The test requires `LEXFLOW_E2E_SANDBOX=YES` and `TEST_DATABASE_URL` on localhost/127.0.0.1 with an exact database name of `lexflow_e2e`. It will refuse a different database. The CI database is an ephemeral PostgreSQL service and contains only fictional identities.

## Tested business journey
1. Create synthetic verified professional through two independent reviewers and a separate publishing officer.
2. Approve the lawyer's fictional bank-account instructions through two independent reviewers.
3. Client signs in with a synthetic persona and sees an empty dashboard (no signup side effects).
4. Client searches the real verified-only directory and selects the law office.
5. Client requests a consultation, explicitly acknowledges that fees go directly to the lawyer, and supplies only synthetic name/contact and a generic practice area.
6. An unrelated client cannot see the engagement.
7. Lawyer signs in, sees the request, confirms conflict checking, and accepts it.
8. Lawyer issues a ₦25,000.50 consultation invoice (stored as integer kobo).
9. Lawyer **reports** receiving payment into the lawyer's own account. The test does not contact a bank or Paystack.
10. Client confirms the lawyer's payment report.
11. Client opens the lawyer-issued receipt record; its notice says LexFlow did not receive, hold, process or verify the payment.
12. Check audit events for the lifecycle.

## What this test does NOT prove
- Genuine Microsoft Entra External ID signup, MFA, account recovery, logout across multiple devices, conditional access, production OIDC token validation or protected redirect URIs.
- Azure Container Apps running the new portal bundle; the new client and lawyer screens are **not yet deployed** to Azure.
- A live staging browser exercising the actual Azure API (the staging `ENABLE_ENGAGEMENTS=false` gate remains off).
- Approved professional credentials, actual lawyers, client consent and retention policies, legal advice, bank account ownership, actual transfers, Paystack settlement, escrow or payment reconciliation.
- Data protection and legal regulatory approval. Production handling of confidential facts is prohibited.

## Staging validation sequence after CI passes
1. Review PR #6 and E2E workflow logs; verify no test fixture secrets were committed.
2. Retain `ENABLE_ENGAGEMENTS=false` and public `portal/config.js` `enabled:false` until separately approved.
3. Perform a **read-only** `GET /healthz`, `GET /readyz` and `GET /v1/meta` on the known staging backend; verify reported gates are off. Do not send synthetic credentials or real client data to a publicly reachable URL.
4. Approve a dedicated preview origin for the portal, with a test-only Entra tenant, precise redirect URIs, test users and API CORS; do not publish confidential records to GitHub Pages.
5. For actual staging E2E, enable the feature only within a controlled test window after technical/operator approval, seed only synthetic professionals with independent verification and audit, run the browser test using genuine Entra test accounts, then immediately restore the feature gates to off. The currently committed test suite does **not** take this action.
6. Record a signed test report, source commit SHA, immutable container-image digest, any failure logs, and a rollback/recovery plan.

## Security and legal go-live blockers
Existing hybrid staging has a shared publicly reachable PostgreSQL server, public staging API health endpoint and no production WAF. It is **synthetic-only**, with no real lawyer/client records. Move to a separately approved private production database and deployment infrastructure; establish NDPA/DPIA, identity MFA, professional conduct and remuneration reviews, incident/retention/appeal runbooks and independent security review before activating live registration.

## Run locally
Use Node.js 22+, Docker/PostgreSQL 16 and Playwright Chromium.

```sh
cd lexflow-ng/backend
npm install
npx playwright install --with-deps chromium
# Start an isolated local PostgreSQL service/db named lexflow_e2e first.
LEXFLOW_E2E_SANDBOX=YES TEST_DATABASE_URL=postgresql://postgres:password@127.0.0.1:5432/lexflow_e2e npm run test:e2e
```

Never use shared/production DB credentials with this command. Test DB tables are truncated on each invocation.
