# LexFlow CPD Entra External ID: sign-in completion steps

## Deployed code vs active connection
The GitHub Pages portal contains a MSAL sign-in interface but is **not configured** until public app IDs and the External tenant host are entered. The protected API is **not running** until Azure App Service and Cosmos DB are provisioned. Do not collect real participant information yet.

## Identity settings needed (not secrets)
Find these in Microsoft Entra (switch to the LexFlow *External* tenant):
- Tenant subdomain, from the sign-in hostname, e.g. `example.ciamlogin.com`.
- `LexFlow-CPD-Portal` **Application (client) ID**.
- `LexFlow-CPD-API` **Application (client) ID** and **exact exposed delegated permission scope**.
- Azure App Service HTTPS URL once the API is deployed.

Edit `auth-config.js`. The file is public and may contain those app identifiers, but **never** a client secret or password.

## Entra portal checks
1. On `LexFlow-CPD-Portal`, under **Authentication**, register **Single-page application** redirect URI, exactly:
   `https://legal.bsoedu.org/lexflow-cpd/portal.html` (the `github.io` address redirects to this custom domain, so it can never be the sign-in address).
2. The LexFlow sign-up/sign-in user flow must be associated with the Portal app.
3. The API app registration must **Expose an API** scope `access_as_user`. Its exact URI might be `api://<api-app-id>/access_as_user` or a different registered Application ID URI. Copy the exact full scope into config.
4. On Portal **API permissions**, add that delegated permission and grant appropriate consent.
5. Ensure the API app has a matching audience/issuer configuration and that app roles are **enforced using BSOE's private database**, never by the browser interface.
6. Test sign-in with a fictional pilot identity using the browser's **Sign in with Microsoft** button. Test API access only after the backend has a real HTTPS endpoint and the identity has been provisioned.

## Important security and integration notes
- This static app uses MSAL's redirect flow; do **not** mix it with popup flow without a separate bridge page and security review.
- `auth.js` imports an explicitly version-pinned MSAL library from jsDelivr. For a production rollout, use an audited local build with dependency lockfiles, CSP and supply-chain checks.
- The sign-in button proves authentication with Microsoft, **not verified professional status, attendance, approved CPD credit or entitlement**.
- The public portal continues to contain only fictional example learner data, no confidential documents and no real administrator records.
- This code does not provision users; real API users require separately reviewed, secure onboarding, role assignment, data residency and NDPA processing controls.
- The current backend implements an early scaffold and **must not be released for real records without independent security testing and approval workflow completion**.
- To begin production Azure services, BSOE must deploy App Service and Cosmos DB, configure the managed identity and Azure model deployment and finish regulator-specific approval/reporting workflows.

## Registered on 15 Nov 2026 (staging tenant, fictional identities only)
Created in the **LexFlow NG Staging** external tenant (`lexflowngstaging.onmicrosoft.com`, tenant ID `5ddfd479-a3cb-4ff7-bdd8-9d745c4309b7`). This is a test tenant: it must not hold real learners. A production tenant is a separate, later decision.

| Item | Value |
|---|---|
| `LexFlow-CPD-Portal` client ID | `56b704b7-ab4f-48dd-a292-5825f2a0ddc9` |
| Portal type | Single-page application, no secret or certificate |
| Portal redirect URI | `https://legal.bsoedu.org/lexflow-cpd/portal.html` |
| `LexFlow-CPD-API` client ID | `4fe1be03-4e20-49d1-b52e-0f6fe5118d80` |
| API scope | `api://4fe1be03-4e20-49d1-b52e-0f6fe5118d80/access_as_user` (v2 access tokens) |
| Authority | `https://lexflowngstaging.ciamlogin.com/5ddfd479-a3cb-4ff7-bdd8-9d745c4309b7/` |
| Issuer the API must check | `https://5ddfd479-a3cb-4ff7-bdd8-9d745c4309b7.ciamlogin.com/5ddfd479-a3cb-4ff7-bdd8-9d745c4309b7/v2.0` |
| Audience the API must check | `4fe1be03-4e20-49d1-b52e-0f6fe5118d80` |
| User flow | Portal added to "LexFlow staging sign-up and sign-in"; self-service sign-up is off |
| Consent | Tenant-wide consent granted for `access_as_user`, `openid`, `profile`, `offline_access` |

Steps 1 to 4 above are done. Still open: step 5 (no CPD API is deployed, so `apiBaseUrl` is unset and the sign-in button stays disabled), and step 6 (no browser sign-in has been tested for this registration). The device-code sign-in method is blocked in this tenant; administrators must use the browser sign-in.
