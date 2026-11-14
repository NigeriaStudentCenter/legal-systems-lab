# LexFlow NG — Genuine Microsoft Entra External ID two-account staging acceptance

## Status as of 14 November 2026

**Code prepared and CI passed; genuine browser sign-ins have NOT yet been performed.**
The approved read-only Azure test passed: https://github.com/NigeriaStudentCenter/legal-systems-lab/actions/runs/43618634025.

A separate draft review branch (`staging-auth-gate-hardening`, PR #10) provides a purpose-built two-account identity test. The branch must not be treated as a successful live identity test. Its browser bundle has built, its unit tests passed, and the public `identity-acceptance-config.js` remains `enabled:false`.

## What the test actually proves

1. A **fictional client** signs in to **LexFlow NG Staging** using the Microsoft Entra External ID hosted user flow with a modern MSAL authorization-code + PKCE redirect (no passwords entered into LexFlow).
2. A **different fictional lawyer** signs in in the *same browser session*, after signing out of the first account.
3. The app locally verifies both delegated access tokens with the tenant's public signing keys using JOSE, their exact issuer, LexFlow API audience, delegated `access_as_user` scope, token lifetime and any tenant/client claims supplied by Entra.
4. The app compares session-salted subject digests so the same account cannot pass as both people. It never displays or reports tokens, emails, names or subject IDs.
5. Before a login and after receiving tokens the public staging `/v1/meta` must show all business features disabled. **No client case, lawyer application or invoice is submitted.**
6. An **optional separately approved** API diagnostic can confirm Azure API validation of each genuine access token; it is **off by default**, and local token validation does **not** count as API acceptance.

**Important:** The “fictional lawyer” button selects a test scenario; it does not assign a privileged user role or verify professional qualifications. Real lawyer role enforcement and any engagement flow are separate future tests.

## Exact non-secret test settings

- Tenant: `lexflowngstaging.onmicrosoft.com`, ID `5ddfd479-a3cb-4ff7-bdd8-9d745c4309b7`
- Authority: `https://lexflowngstaging.ciamlogin.com/`
- Portal SPA client ID: `c0ec48d2-b103-4f62-950a-e3d6c65bb55d`
- API app ID / audience: `e0db88c1-c50d-48ff-985d-df0a01a222d4`
- Delegated API scope: `api://e0db88c1-c50d-48ff-985d-df0a01a222d4/access_as_user`
- Required **exact** SPA redirect URI: `https://legal.bsoedu.org/lexflow-ng/portal/identity-check.html`
- Azure API: `https://lexflowstg-api.calmdune-686822d1.westeurope.azurecontainerapps.io`

## What an authorised Entra / site operator must do

1. In the **staging Entra External ID tenant only**, confirm the portal SPA app registration has the exact redirect URI above (SPA platform, not Web). Confirm the user flow allows both designated synthetic test accounts and grants the delegated LexFlow API scope. The current documentation lists only `register.html`, `status.html` and `review.html` as registered; **do not assume `identity-check.html` is already registered**.
2. Create **two distinct synthetic users**, one for the client scenario and one for the lawyer scenario, using fictional labels. The old synthetic applicant may be reused only if its sign-in method is compatible with the browser flow. Do **not** share passwords in GitHub Actions, issue comments, ChatGPT or screenshots. Require the staging account-security controls appropriate to the acceptance exercise. Do not enable live sign-up broadly merely to create these accounts.
3. Arrange a **separately approved access-controlled staging preview** at the exact registered origin and path. The public GitHub Pages site is not protected: **do not change `identity-acceptance-config.js` to `enabled:true` on `main` or deploy an open test page accepting sign-ins**. The protected preview should be restricted to named testers, time limited, not indexed and served over HTTPS.
4. At that protected preview only, provide `identity-check.html`, its built `dist/identity-check.js`, `portal.css` and `identity-acceptance-config.js` with `enabled:true`, the exact non-secret settings above and `apiProbe:false`. The separate live `portal/config.js` remains disabled.
5. With all business flags still off, use a private browser window to click **Sign in as fictional client**, complete Entra-hosted sign-in, verify the PASS message; sign out; then click **Sign in as fictional lawyer**, using a *different* account. The two-account comparison should read PASS.
6. Copy the **non-sensitive** report and record only scenario status, reviewer, date, approved origin and code revision. No identity tokens or identifiers are required.
7. Disable and remove the temporary preview after acceptance and review any Entra sign-in logs. Staging test users must not be granted real reviewer, publisher, lawyer or client permissions.

## Optional real Azure API JWT acceptance (a separate approved change)

The `/v1/diagnostics/auth` endpoint is present in the approved staging API but remains disabled. To exercise the token against Azure, a responsible reviewer must approve a brief, reversible, logged window setting `ENABLE_AUTH_DIAGNOSTIC=true` **only** on the synthetic staging API while the other feature gates stay off. Only during that window should the **protected preview** set `apiProbe:true`. Restore the endpoint and preview to off immediately afterward, rerun the read-only API inspection, and record the rollback. **This PR does not enable either gate or provide an unattended enablement workflow.**

## Acceptance criteria and current limitations

- PASS client sign-in with a real signed delegated access token
- PASS lawyer-scenario sign-in with a second account and genuinely different Entra subject
- PASS exact issuer/audience/scope/signature checks, without identity data in a report
- PASS all business gates disabled before and after sign-ins
- Optional: PASS Azure diagnostic for both accounts **only after explicit operator approval**
- FAIL for expired/malformed/wrong-audience token, duplicated account, wrong redirect, wrong tenant, enabled business flag or unauthorised origin
- No claims of professional credentials, reviewer roles, actual engagement permissions or payment handling.

**Current blockers:** No Entra management connector is linked in this conversation, the second fictional account and new exact SPA redirect are not confirmed, and no protected preview deployment has been authorised. Therefore the genuine user sign-ins are **not completed**. Do not store any real Nigerian legal matter data in this shared-server staging environment.
