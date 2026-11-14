# LexFlow NG — Azure Staging Acceptance: Safe Operator Runbook

**Status:** Read-only workflow prepared on `main`. Its source checks passed on 14 November 2026. **No live Azure access or staged client onboarding has been authorised or performed by this workflow yet.**

## Use the existing protected Azure deployment identity

The GitHub environment `lexflow-staging` requires an authorised reviewer and is already trusted by the staging Azure deployment principal according to the 14 Nov hybrid staging handover notes. The workflow is at:

- [LexFlow Azure staging acceptance (READ ONLY)](https://github.com/NigeriaStudentCenter/legal-systems-lab/actions/workflows/lexflow-azure-staging-readonly.yml)
- Source: `.github/workflows/lexflow-azure-staging-readonly.yml`
- Read-only checker: `lexflow-ng/ops/staging-readonly.mjs`
- Negative and safety tests: `lexflow-ng/ops/staging-readonly.test.mjs`

## Exact operator steps

1. Check your subscription spending cap/budget and verify this is the **synthetic-only** staging environment. Do not deploy anything or enable business features.
2. In GitHub, open the workflow above; select **Run workflow**, branch `main`. Approve `lexflow-staging` only if you are an authorised environment reviewer.
3. The workflow logs in to Azure via GitHub OIDC, then **reads** the Container App `lexflowstg-api` in resource group `lexflow-staging-rg` to resolve its true HTTPS host. It does not print keys or credentials. It does not use a hard-coded public API address.
4. The preflight checker refuses other service hosts, credentials in URLs, non-HTTPS URLs, paths and redirects. It sends GET requests only to `/healthz`, `/readyz`, `/v1/meta` and known disabled endpoints.
5. All business endpoints must return **HTTP 503**, health and readiness must return **HTTP 200**, the metadata must enumerate **37 jurisdictions** and explicitly report false for all business gates. Any mismatch causes a failed workflow.
6. Review the run summary and download the non-sensitive `lexflow-staging-readonly-report` artifact. It is retained for 14 days.
7. If a gate is unexpectedly enabled, immediately stop independent staging testing and ask an authorised Azure operator to restore the Bicep feature settings to `false` and investigate. The checker itself never changes deployment settings.

## This is *not* the live end-to-end browser test

The isolated synthetic browser/API/PostgreSQL suite already passed in GitHub Actions, but Microsoft Entra was mocked in that test. This **read-only** workflow verifies the deployed staging API and its closed feature flags; it does **not** authenticate a real user or create an application, engagement, invoice, receipt, transaction or account.

## Exact operator prerequisites before enabling a controlled real-Entra browser test

- A dedicated test-only preview origin secured appropriately and not the public, unreviewed GitHub Pages site.
- Microsoft Entra External ID **staging** application redirect URIs for the exact preview pages; supported browser/MSAL flows with short-lived credentials, MFA/conditional-access controls as required, and reliable account recovery.
- A separate and approved temporary gate-enabled staging instance or staging window **isolated from other hosted products**, using only fictional identities and records.
- Human operator validation of reviewer/publisher role assignments and of the professional credential verification process; no real lawyer identification or case content.
- Independent QA verifying client A cannot access client B's engagement and that lawyer A cannot access lawyer B's data.
- Rollback procedure, incident contact, automated closure of the test window, and an audit record of changes and approvals.
- All production launch requirements in `lexflow-ng/backend/RELEASE-GATES.md` remain unfulfilled until explicitly signed off.

## Existing staging limitations

According to `lexflow-ng/infra/HYBRID-STAGING.md`, the staging environment uses a shared, publicly reachable PostgreSQL server and a public API ingress without a production WAF. Do **not** use this infrastructure for real clients or confidential legal information. The Visual Studio Enterprise subscription spending cap and terms make it unsuitable as a permanent production host.

**No bank, Paystack or escrow integration is exercised by either test suite.** Legal fees are paid directly to lawyers; an invoice/receipt record is not independent bank settlement verification.
