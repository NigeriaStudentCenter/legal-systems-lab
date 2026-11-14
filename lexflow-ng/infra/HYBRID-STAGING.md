# LexFlow NG — hybrid staging as deployed (14 Nov 2026)

**Synthetic data only.** All four `ENABLE_*` gates are off. No identity provider is connected, so nobody can sign in. This replaces `bootstrap.bicep` + `containerapp.bicep` for staging; those remain the starting point for a private, dedicated environment before any real professional data.

## Why hybrid
The subscription is a Visual Studio Enterprise subscription with a spending cap and roughly $12 a month of unused credit. The fully dedicated template costs about $22 a month (PostgreSQL server about $16, container registry $5) and would have tripped the cap, which disables every service in the subscription. The hybrid costs close to nothing.

## What exists
| Piece | Name | Shared? |
|---|---|---|
| Resource group | `lexflow-staging-rg` (West Europe) | Dedicated |
| Budget alert | `lexflow-staging-budget`, $5 a month, emails at 80% actual and 100% forecast | Dedicated |
| Database | `lexflow_staging` on server `estatecopilot-db` | **Shared server**, own database |
| Runtime DB login | `lexflow_staging_api`: SELECT/INSERT/UPDATE on the four tables, no DDL, no DELETE | Dedicated |
| Key Vault | `lexflowstg-kv-f88b66`, RBAC-only, secret `database-url` | Dedicated |
| Logs | `lexflowstg-logs`, 30 days, 0.1 GB daily cap | Dedicated |
| Container Apps environment | `lexflowstg-cae`, consumption, scale to zero | Dedicated |
| API | `lexflowstg-api`, identity `lexflowstg-api-id` reads the vault | Dedicated |
| Image | `ghcr.io/nigeriastudentcenter/lexflow-ng-api`, pinned by digest | GitHub registry (public) |
| Deployment identity | `lexflowstg-deploy-id`, Contributor on the resource group only, trusted only from GitHub environment `lexflow-staging` | Dedicated |

GitHub: environment `lexflow-staging` (required reviewer, branches `main`, `production-foundation`, `azure-staging-hybrid`) and the `LEXFLOW_*` repository variables are set. `LEXFLOW_STAGING_PG_ADMIN` and the `LEXFLOW_STAGING_PG_ADMIN_PASSWORD` secret are not needed in the hybrid.

## Deviations from SETUP-CHECKLIST.md, deliberately
- **Shared, publicly reachable PostgreSQL server.** It also hosts other products' production databases. `CONNECT` on `lexflow_staging` is revoked from `PUBLIC`, and the runtime login has no rights in the other databases. Not acceptable for real lawyer data.
- **Public HTTPS ingress** so `/healthz` and `/readyz` can be tested. No WAF or gateway.
- **Key Vault public endpoint**, RBAC-only. No private endpoint.
- **Public image on GitHub's registry** instead of a private Azure registry. The source is already public.
- **Placeholder OIDC settings**: issuer and JWKS point at the organisation's workforce Entra tenant and the audience is `api://lexflow-staging-not-yet-registered`. No token will validate until a Microsoft Entra External ID tenant and app registrations exist (checklist step 2, not done).

## Operating it
- New image: push to `azure-staging-hybrid` under `lexflow-ng/backend/`; copy the digest from the run summary into `staging-hybrid.parameters.json`.
- Deploy: `az deployment group create -g lexflow-staging-rg --template-file lexflow-ng/infra/staging-hybrid.bicep --parameters @lexflow-ng/infra/staging-hybrid.parameters.json` by an authorised operator. There is still no automated deploy workflow.
- Schema changes: connect to `estatecopilot-db` as a Microsoft Entra administrator, never as the runtime login.
- Remove everything: delete `lexflow-staging-rg`, then `DROP DATABASE lexflow_staging; DROP ROLE lexflow_staging_api;`.

## Still open before real use
Checklist steps 2, 5, 6 and 7, every row of `backend/RELEASE-GATES.md`, and a move to a pay-as-you-go subscription with a private database (Visual Studio credits are licensed for development and test only).
