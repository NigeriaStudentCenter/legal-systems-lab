# LexFlow NG — hybrid staging as deployed (14 Nov 2026)

**Synthetic data only.** All four `ENABLE_*` gates are off, so sign-in exists but every business endpoint still refuses requests. This replaces `bootstrap.bicep` + `containerapp.bicep` for staging; those remain the starting point for a private, dedicated environment before any real professional data.

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
## Sign-in (checklist step 2, staging only)
Microsoft Entra External ID tenant **LexFlow NG Staging** (`lexflowngstaging.onmicrosoft.com`, tenant ID `5ddfd479-a3cb-4ff7-bdd8-9d745c4309b7`, Europe data location, linked to `lexflow-staging-rg`, free tier billed per monthly active user).

| Item | Value |
|---|---|
| Authority | `https://lexflowngstaging.ciamlogin.com/` |
| Issuer | `https://5ddfd479-a3cb-4ff7-bdd8-9d745c4309b7.ciamlogin.com/5ddfd479-a3cb-4ff7-bdd8-9d745c4309b7/v2.0` |
| JWKS | `https://lexflowngstaging.ciamlogin.com/5ddfd479-a3cb-4ff7-bdd8-9d745c4309b7/discovery/v2.0/keys` |
| API app (audience) | `e0db88c1-c50d-48ff-985d-df0a01a222d4` |
| API scope | `api://e0db88c1-c50d-48ff-985d-df0a01a222d4/access_as_user` |
| Portal app (SPA client ID) | `c0ec48d2-b103-4f62-950a-e3d6c65bb55d` |
| Redirect URIs | `https://legal.bsoedu.org/lexflow-ng/portal/{register,status,review}.html` |
| User flow | "LexFlow staging sign-up and sign-in", email and password, self-service sign-up allowed |

None of these values is secret. `portal/config.js` is still `enabled: false` and has **not** been filled in: doing so on the public site would open sign-up to anyone. No MFA or conditional access is configured.

### End-to-end sign-in test, 14 Nov 2026
`ENABLE_APPLICATIONS` was switched on in staging for a few minutes, then back off.

| Call | Result |
|---|---|
| `GET /v1/applications/me`, no token | 401 |
| Same, token with a tampered signature | 401 |
| Same, valid token | 200, no application |
| `POST /v1/applications`, synthetic record | 201, status `pending` |
| `GET /v1/applications/me` again | 200, returns the record |
| `POST /v1/applications` a second time | 409 |
| `GET /v1/verification/queue` (gate off) | 503 |

Left in place for repeat tests:
- Test user `synthetic.applicant1@lexflowngstaging.onmicrosoft.com`; its password is the Key Vault secret `test-user-password`.
- App "LexFlow NG test client (staging)" (`996d77d8-9a65-44d9-a7e7-38c179b2e474`), a public client that allows direct username-and-password sign-in. Delete it before the tenant holds any real account.
- One synthetic application, "Synthetic Applicant One", in `lexflow_staging`.

Not covered: the browser pop-up sign-in from the portal pages, the sign-up flow, and the reviewer, publisher and suspension routes.

## Direct-to-lawyer engagements (14 Nov 2026)
`sql/002_engagements.sql` is applied to `lexflow_staging` and the image includes the engagement, invoice and receipt endpoints. `ENABLE_ENGAGEMENTS` is `false`, so they all answer 503. The image also carries `/v1/diagnostics/auth`, which only confirms a token is valid; `ENABLE_AUTH_DIAGNOSTIC` is `false`.

## Operating it
- **Releases go through GitHub**, not a laptop: run `LexFlow approved Entra staging API release` on `main` with the confirmation `DEPLOY_SYNTHETIC_STAGING` and approve the `lexflow-staging` environment. It builds a pinned commit, updates only the image, re-checks every gate and rolls back on failure. See `../ops/README-APPROVED-STAGING-RELEASE.md`.
- After each release, copy the new image digest into `staging-hybrid.parameters.json` so this template keeps matching what is running. Last synced 14 Nov 2026 (`sha256:874a5698…`, source commit `9d15b55`); `az deployment group what-if` then showed no change to the API's image or settings.
- The Bicep template is for rebuilding the environment or changing its shape: `az deployment group create -g lexflow-staging-rg --template-file lexflow-ng/infra/staging-hybrid.bicep --parameters @lexflow-ng/infra/staging-hybrid.parameters.json` by an authorised operator. Deploying it with a stale digest would undo the latest release.
- Read-only check at any time: run `LexFlow Azure staging acceptance (READ ONLY)` on `main`.
- The deployment identity trusts GitHub's ID-based subject `repo:NigeriaStudentCenter@88378425/legal-systems-lab@1456667293:environment:lexflow-staging`; the name-only form is refused by Azure.
- Schema changes: connect to `estatecopilot-db` as a Microsoft Entra administrator, never as the runtime login.
- Remove everything: delete `lexflow-staging-rg`, then `DROP DATABASE lexflow_staging; DROP ROLE lexflow_staging_api;`.

## Still open before real use
Checklist steps 5, 6 and 7, MFA in the sign-in tenant, a browser test of the portal, every row of `backend/RELEASE-GATES.md`, and a move to a pay-as-you-go subscription with a private database (Visual Studio credits are licensed for development and test only).
