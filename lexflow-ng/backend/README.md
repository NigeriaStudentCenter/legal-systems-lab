# LexFlow NG — Production Foundation, Phase 1

This is a **production-oriented API foundation under review**, not a live service.
The existing marketplace and lawyer workspace remain a fictional demonstration.
No payment processing or custody of legal fees, emergency lawyer dispatch, client matters, ID uploads, privileged documents, or AI legal advice is implemented.

## What exists
- Node 22 + Fastify backend with a versioned JSON API and restrictive input checks.
- OIDC JWT signature/audience/issuer verification via trusted provider JWKS.
- PostgreSQL professional application, review, publication and audit tables.
- Exact nationwide state and practice-area filters.
- Reviewer accounts provisioned by an independent operator only.
- Two independent reviewers plus separate publication officer.
- Conditional public search of **published, presently verified** listings only.
- Direct-to-lawyer engagements, lawyer-issued invoices, receipts and reported payment status (`ENABLE_ENGAGEMENTS`).
- Explicit feature flags default **false**, security headers, CORS allowlist, request size limit, rate limits.
- Mocked API tests and GitHub Actions CI checks.

## Running locally (NO real persons or data)
1. Install Node 22+ and PostgreSQL 15+.
2. In `lexflow-ng/backend`, run `npm install`.
3. Create an isolated database and apply `sql/001_initial.sql` then `sql/002_engagements.sql` as an operator.
4. Copy `.env.example` to `.env`. Set test-only OIDC issuer, audience and JWKS URI and test database credentials. **Never commit `.env`.**
5. Leave all `ENABLE_*` flags false until the deployment, privacy and verification processes are approved.
6. `npm run check && npm test && npm start`.
7. `GET /healthz` confirms the process runs; `GET /readyz` confirms a database connection. Neither is proof of production readiness.

The API does not issue its own JWTs or let applicants choose their role. Actual user login must be supplied through a configured external OIDC identity provider. No OIDC provider is currently connected.

## API
| Endpoint | Permissions | Output |
| --- | --- | --- |
| GET /healthz | anonymous | process health |
| GET /readyz | anonymous | DB connection health |
| GET /v1/meta | anonymous | states, areas, language choices and feature availability |
| GET /v1/directory | anonymous, directory gate | verified + published + unexpired profiles only |
| POST /v1/applications | OIDC + applications gate | one application per authenticated lawyer |
| GET /v1/applications/me | OIDC + applications gate | applicant-owned status |
| GET /v1/verification/queue | reviewer/publisher/admin role + gate | applications under review |
| POST /v1/verification/:id/review | reviewer/admin role + gate | approve/reject with evidence |
| POST /v1/verification/:id/publish | publisher/admin role + publication gate | approved public listing |
| POST /v1/verification/:id/suspend | compliance_admin role + verification gate | immediate unpublication |
| PUT /v1/payment-details | OIDC, verified lawyer + engagements gate | where clients should pay; returns to two-reviewer approval on every change |
| GET /v1/payment-details/me | OIDC + engagements gate | lawyer's own details and review status |
| GET /v1/payment-details/queue | reviewer/admin role + engagements gate | details awaiting an account-name check |
| POST /v1/payment-details/:id/review | reviewer/admin role + engagements gate | approve (name match confirmed) or reject |
| POST /v1/engagements | OIDC + engagements gate | client requests a published lawyer; no case facts |
| GET /v1/engagements | OIDC + engagements gate | caller's engagements as client or lawyer |
| POST /v1/engagements/:id/respond | the lawyer | accept (conflict check confirmed) or decline |
| POST /v1/engagements/:id/complete, /cancel | lawyer / client | close an active engagement / withdraw an unanswered request |
| POST /v1/engagements/:id/invoices | the lawyer, approved payment details | invoice paid directly to the lawyer |
| GET /v1/engagements/:id/invoices | either party | invoices with pay-to details |
| POST /v1/invoices/:id/report-paid | the lawyer | lawyer reports funds received; creates receipt |
| POST /v1/invoices/:id/client-response | the client | confirm or dispute the reported payment |
| POST /v1/invoices/:id/void | the lawyer | cancel an unpaid invoice |
| GET /v1/invoices/:id/receipt | either party | receipt stating LexFlow did not process the payment |

**LexFlow never receives legal fees.** The engagement endpoints record invoices and what each party reported; they do not move, hold or verify money. See "Payments model" in `../PRODUCT-SPEC.md`.

## Security and data model
Professional application is not a legal licence. Data from self-reported fields never makes a person verified.
Verification must be independently corroborated with appropriate NBA/official records and current practice requirements.
Publication requires additional review of professional conduct and remuneration rules. Client files and criminal justice evidence have **no schema, endpoint, or storage** in this phase.

Use Azure Key Vault or equivalent, separate read-only directory access if needed, database network isolation, TLS CA verification, MFA for operators, backups, encrypted storage, vulnerability scans, continuous monitoring, and least-privilege DB credentials.
Treat CORS as a browser control, **not** authorisation.
Never log JWTs, application bodies, official source references, financial details or privileged material.

## Integration limitation
The live GitHub Pages prototype is **not wired to this API**. A static GitHub Pages site cannot secretly hold credentials or securely host this backend.
Deploy to approved application hosting behind an HTTPS gateway with correct CORS origins and OIDC before enabling real onboarding.

## Required pre-release review
A Nigerian-qualified lawyer should independently approve advertisements, referrals, the 2023 RPC and remuneration regime, Nigerian Bar lawyer verification protocol, and practice boundaries.
Complete NDPA/DPIA, retention and breach response plans, access/review governance, incident response, and vulnerability testing.
Do not enable any real user flow until an authorised owner signs the release checklist in `RELEASE-GATES.md`.

## Quality
GitHub workflow `.github/workflows/lexflow-api-ci.yml` runs syntax, test and dependency audit checks. Database-level integration tests are still required before deploying any verification flow.
