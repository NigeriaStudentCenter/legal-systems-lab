# LexFlow NG — Genuine Entra External ID two-account acceptance

**Status:** Test UI and JWT-verification code are on the `staging-auth-gate-hardening` review branch. The deployed staging Azure API is healthy and closed, but **real two-account sign-in is not yet executed**. No credentials, legal data or money are used by CI.

## Evidence already collected
- [Azure read-only portal/API acceptance passed](https://github.com/NigeriaStudentCenter/legal-systems-lab/actions/runs/43618634025).
- [Staging Entra public discovery and signing keys passed](https://github.com/NigeriaStudentCenter/legal-systems-lab/actions/runs/43580758377).
- [Isolated browser/API/DB synthetic client-to-lawyer lifecycle passed](https://github.com/NigeriaStudentCenter/legal-systems-lab/actions/runs/43578146747).

## Safe two-account test workflow
1. Have an Entra External ID tenant administrator create or enrol **two distinct fictional staging identities**, one marked as the fictional client and one as the fictional lawyer for **test purposes only**. Set their test-account names and password through Microsoft Entra's normal secure management interface. Do not paste passwords into GitHub, ChatGPT, the repository, app configuration, test logs or screenshots.
2. Require browser authorization code + PKCE with MSAL. Confirm the staging Entra application `c0ec48d2-b103-4f62-950a-e3d6c65bb55d` has the delegated API scope `api://e0db88c1-c50d-48ff-985d-df0a01a222d4/access_as_user` and appropriate user-flow association. This code does NOT use the older ROPC test client.
3. Confirm the SPA app registration has the **exact** redirect URI `https://legal.bsoedu.org/lexflow-ng/portal/identity-check.html`. The 14 November staging handover documented only `register.html`, `status.html` and `review.html`, **not** the new identity-check URI. An Entra administrator must add/verify this URI before sign-in.
4. Deploy the identity-check page, corresponding `dist/identity-check.js`, `portal.css` and **a temporary `identity-acceptance-config.js`** to a deliberately access-controlled preview at the registered origin. GitHub Pages itself is public; it is NOT adequate protection for a live-enabled acceptance page. Do not set `enabled:true` in the repository's public `main` configuration. The trusted HTTPS host/path needs a genuine identity-aware gateway or equivalent access control.
5. The operator-supplied temporary public-only configuration must match `src/entra-acceptance-domain.mjs` exactly: `enabled:true`, staging tenant, authority, issuer, public JWKS URI, API audience, SPA client ID, delegated scope, exact registered redirect URI, and the **actual approved** Azure Container App FQDN. Set `apiProbe:false` initially. Do not insert passwords, client secrets, user tokens or key material.
6. Confirm the API reports every business feature off and `GET /v1/diagnostics/auth` returns HTTP 503 without a token. The page does not switch Azure flags.
7. In a private browser session, choose **Sign in as fictional client**. The browser redirects to Microsoft Entra; authenticate with client account. On return, the browser checks the issuer-signed access-token signature and claims against Microsoft's JWKS and checks closed API business gates. It stores only a salted, session-scoped hash of the subject for later comparison. No token, user name or email is displayed or exported.
8. Sign out of Entra; choose **Sign in as fictional lawyer** using the other fictional Entra account. The test rejects using the same subject twice. A successful two-account result proves only two distinct Entra identities with delegated access to the API app, **not** that the second account is a licensed legal practitioner or has lawyer role permissions.
9. Optional API diagnostic: ONLY after separate time-bound approval and rollback check, an Azure operator may temporarily set `ENABLE_AUTH_DIAGNOSTIC=true` while every business gate remains off, and turn `apiProbe:true` in the protected test preview. The page can then require `GET /v1/diagnostics/auth` to return a restricted identity validation response. Revert `ENABLE_AUTH_DIAGNOSTIC=false` immediately after testing; re-run read-only preflight and review deployment logs.
10. Copy only the page's **non-sensitive pass/fail report**, note the observed environment and reviewer, and expire/disable test identities after acceptance. Record no credentials, raw tokens, subjects, emails or real legal files.

## Important limitations and go/no-go
- **Testing two Entra sign-ins does not create a verified lawyer.** A professional profile still needs independent authorisation and publication under the backend verification workflow.
- It does not prove actual multi-role DB authorisation, complete password reset/MFA, real portal navigation under signed-in accounts, reviewer independence or production security.
- All staging lawyers, clients and payment details must be fictional; no real transactions.
- The current shared publicly reachable PostgreSQL server is NOT approved for client records or live legal case information.
- Actual account provisioning, callback registration, private preview hosting and temporary Azure diagnostic approval require administrator access not available through this GitHub repository connection. The CI job tests source code but cannot honestly claim to execute real Entra login.

## Success report required
- Client: valid genuine Entra-signed token for approved tenant, audience and delegated scope
- Lawyer: same checks with a **different** authenticated subject
- Azure API: business flags remain off throughout
- Optional API probe: bearer validation accepted by staging only in approved time window and disabled afterwards
- No credentials, token strings, identity names, case facts or payments in report
