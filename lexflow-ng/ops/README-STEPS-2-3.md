# Steps 2 and 3 — Azure staging client/lawyer portal acceptance

**Goal:** Validate the real Azure API with the client and lawyer browser interface while keeping the API gates off and retaining no actual client or professional data.

## Completed before this task
- Approved immutable backend image deployed successfully: https://github.com/NigeriaStudentCenter/legal-systems-lab/actions/runs/43593738277
- Real Microsoft Entra staging public OIDC discovery and signing-key metadata passed: https://github.com/NigeriaStudentCenter/legal-systems-lab/actions/runs/43580758377
- Synthetic end-to-end browser/Fastify/PostgreSQL engagement-to-receipt journey passed: https://github.com/NigeriaStudentCenter/legal-systems-lab/actions/runs/43578146747
- Entra token via a staging direct public client was previously documented in infra/HYBRID-STAGING.md, but **real portal popup sign-in, MFA and client/lawyer multi-role Entra journeys have not been verified**.
- No current direct Azure management connector is available in this session. The protected GitHub workflow reads staging only; it cannot create user accounts, change flags or collect legal fees.

## Closed-gate Azure browser acceptance
The GitHub workflow at `.github/workflows/lexflow-azure-portal-closed-gate.yml` uses the existing approved `lexflow-staging` environment, logs in to Azure through federated OIDC, resolves the exact `lexflowstg-api` Container App FQDN and runs a real headless Chromium test with the **actual** portal client and lawyer HTML and JavaScript. It never signs in, sends tokens or submits case facts, invoices or payment data. It checks:
1. Staging `/healthz`, `/readyz` and `/v1/meta` are healthy.
2. All application, professional verification, directory, engagement, payment, client record and related gates remain disabled.
3. The approved browser origin `https://legal.bsoedu.org` passes the API CORS allowlist; an attacker origin is blocked; authorization preflight is correctly scoped.
4. Browser pages are rendered from the committed portal source using an in-memory bundle and temporary network routing for static files. Their **API requests reach actual Azure staging**.
5. Both client and lawyer portal sign-in and business action controls remain disabled; JavaScript does not crash.

## Next approval milestone: genuine browser Entra auth and two-sided engagements
A genuine Entra popup test requires an approved browser preview on an **exact registered redirect URI**, plus distinct synthetic client and lawyer Entra accounts (only one applicant is currently documented). Do not expose the current `test-user-password` or test credentials in GitHub, conversation, logs or a public web page.
- Provision a synthetic verified-lawyer user, two reviewer principals and a separate publishing principal for the synthetic-only database, and use a dedicated staging browser origin.
- Explicitly review the existing staging login app allowing direct username/password. Remove this test-only public client app before any real users are introduced.
- For a short and authorised acceptance window on a **dedicated, isolated test tenancy**, temporarily enable only the controls needed for a synthetic journey, run a genuine browser login, then restore all gates off. The current shared database server is not approved to hold real legal matters.
- Add rollback, user lifecycle, MFA, professional conduct, NDPA privacy and financial reconciliation approvals before any public launch.

**Do not represent real Azure portal sign-in or acceptance of real client engagements as complete solely because a read-only browser check or synthetic E2E suite passes.**
