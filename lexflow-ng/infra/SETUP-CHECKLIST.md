# LexFlow NG — GitHub-to-Azure staging checklist

Current status (13 Nov 2026):
- GitHub source branch: `production-foundation`.
- Draft review: https://github.com/NigeriaStudentCenter/legal-systems-lab/pull/3
- Backend tests: GitHub Actions passing.
- Portal build: GitHub Actions passing. Review-only artifact is uploaded to CI; **not published** to the live site.
- Azure Bicep syntax: compiled in CI; **not** deployed or verified against an Azure tenant.
- External lawyer registration: **disabled**. Marketplace demo unchanged.

## What the organisation's Azure owner must configure
1. An approved staging subscription and resource group, chosen Azure region and cost/budget alerts.
2. A Microsoft Entra External ID tenant and separate SPA / API app registrations, access scope, trusted OIDC issuer/audience/JWKS, verified test users and appropriate redirect URIs.
3. An Azure deployment identity using GitHub OIDC, federated trust restricted to the `lexflow-staging` GitHub environment, and least-privilege resource-group permissions.
4. GitHub environment `lexflow-staging` with required human reviewers and branch restrictions. Repository **variables** (non-secret): `LEXFLOW_AZURE_PLAN_ENABLED=true`, `LEXFLOW_AZURE_CLIENT_ID`, `LEXFLOW_AZURE_TENANT_ID`, `LEXFLOW_AZURE_SUBSCRIPTION_ID`, `LEXFLOW_STAGING_RESOURCE_GROUP`, `LEXFLOW_STAGING_PREFIX`, `LEXFLOW_STAGING_PG_ADMIN`. Environment **secret**: `LEXFLOW_STAGING_PG_ADMIN_PASSWORD`. Do not share these credentials in chat or commit them to GitHub.
5. After a formal change request, run **Azure staging plan (no deployment)** manually from the GitHub Actions tab and inspect the resource changes and costs. This workflow uses `az deployment group what-if` only. It does **not** deploy resources.
6. Assign and verify appropriate professional reviewers and publishing officers; produce written Nigerian conduct/remuneration review, professional-register verification procedure, privacy notice, NDPA/DPIA assessment, document retention, incident and appeal runbooks.
7. After separate deployment approval, provision resources using an authorised operator and complete network, identity, certificate, monitoring, backup, performance and security tests. There is deliberately **no automated create-resources workflow** in this branch.

## Blockers not to conceal
- The Bicep template is a staging starting point, not a complete production architecture. Postgres is burstable, HA is disabled, and registry and monitoring endpoints need hardening and cost review.
- Key Vault blocks public access; private endpoint and controlled operator network access must be designed before any automated secret provisioning.
- Container Apps template intentionally has no ingress. ACR pull identity and runtime DB credentials must be set up before it can run.
- Production services need a reviewed Front Door / Private Link or equivalent gateway design. A green Bicep compile is not a deployment test.
- The portal's `config.js` is intentionally disabled; the public website continues to show a fictional marketplace.
- Published clients must have a real, approved privacy policy; the current placeholder cannot be used to collect actual lawyer applications.
- The initial API collects self-reported information only; it does not automatically validate NBA records, does not accept client documents and does not make a lawyer legally eligible to practise.

## Tests and review
- [Backend validation workflow](https://github.com/NigeriaStudentCenter/legal-systems-lab/actions/workflows/lexflow-api-ci.yml)
- [Portal validation workflow](https://github.com/NigeriaStudentCenter/legal-systems-lab/actions/workflows/lexflow-portal-ci.yml)
- [Azure Bicep compilation workflow](https://github.com/NigeriaStudentCenter/legal-systems-lab/actions/workflows/lexflow-infra-check.yml)
- [Staging what-if workflow](https://github.com/NigeriaStudentCenter/legal-systems-lab/actions/workflows/lexflow-azure-whatif.yml)
- [Production release gates](../backend/RELEASE-GATES.md)

**No Azure tenant authorisation was provided in this ChatGPT conversation. No real accounts, payments, or professional data have been processed.**
