# LexFlow NG — Real Entra Staging Acceptance

**Status:** Code and read-only discovery tests are prepared. No real user sign-in test or new Azure container deployment has been performed by this work.

## Verified prerequisite
- [Protected Azure staging inspection passed](https://github.com/NigeriaStudentCenter/legal-systems-lab/actions/runs/43579893414).
- [Public Microsoft Entra staging discovery and JWKS verification](https://github.com/NigeriaStudentCenter/legal-systems-lab/actions/workflows/lexflow-entra-discovery.yml).
- Production-facing registration, lawyer matching, engagements and payments must remain off.

## Staging-only authentication probe
`identity-check.html` is a **closed diagnostic page** (not published on the public marketplace). It uses a short-lived access token issued by the real Entra External ID tenant, then sends it exclusively to `GET /v1/diagnostics/auth` on the approved Azure staging API. That endpoint:
- is **disabled by default** in `src/config.mjs`, and `staging-hybrid.bicep` explicitly sets `ENABLE_AUTH_DIAGNOSTIC=false`;
- returns HTTP 503 while disabled;
- when temporarily enabled by the approved Azure operator, verifies the JWT signature, issuer and audience through the same production authenticator as the API;
- returns only `authenticated:true`, `environment:staging-acceptance`, `data_access:false`, `professional_verification:false`;
- performs **no database read or write**, and exposes no token, subject identifier or user profile;
- is rate-limited and must be switched off immediately after the designated synthetic-account test.

## Operator preparation
1. Review the scope and security protections in the code, then obtain explicit approval for a temporary synthetic-data test. The existing Visual Studio / hybrid staging is not approved for live legal matters.
2. Approve a dedicated staging preview origin or a protected test page under `https://legal.bsoedu.org`. Do not use public GitHub Pages as a secure store or upload real client facts.
3. In Entra External ID staging, validate the app registrations, delegated API scope and a redirect URI matching the actual approved page. Set the public-only `portal/config.js` at the staging preview origin to `enabled:true` with authority, portal client ID, API scope, API origin and registered redirect URI. **No secrets** in this file. Keep the production/public site's own config disabled.
4. Deploy an independently reviewed new API image to **staging only** from `entra-staging-acceptance`; preserve all business feature flags false and database settings unchanged. Then check `/healthz`, `/readyz`, `/v1/meta` and `/v1/diagnostics/auth` without credentials. The diagnostic must answer 503 by default.
5. Only under controlled change approval, temporarily set `ENABLE_AUTH_DIAGNOSTIC=true` on the synthetic staging Container App while every business feature remains off; verify the change is audited and the rollback is known.
6. In the approved test browser, open `identity-check.html` and click **Sign in and test API** using a designated synthetic External ID account. The page intentionally does not print tokens or user IDs.
7. A passing test confirms that an authentic issuer-signed delegated access token reaches the right API. Verify negative cases with isolated test clients, and ensure no real data is present.
8. Immediately restore `ENABLE_AUTH_DIAGNOSTIC=false` and re-run the read-only staging inspection. Record deployment digest, time, reviewer, rollback and audit log. **No authorisation to accept real lawyer registrations is implied.**

## Failure criteria
- Redirect mismatch, CORS error, expired/wrong-audience token, unauthorized Origin, or API 503 when operator expected a temporarily enabled diagnostic.
- API 200 with an anonymous/invalid token or unexpected identity information in the body.
- Any business gate enabled or any real user information stored in test databases.
- Missing independent approval, test account security controls or rollback plan.

## Not yet validated
Real MSAL popup sign-in, Entra test user invitation and recovery, Azure API JWT acceptance with an authentic token, direct-to-lawyer engagement browser journey against Azure, regulator-verified lawyers, protected client portal and payment settlement.

**No money movement, client legal records, or merchant-payment credentials are involved.**
