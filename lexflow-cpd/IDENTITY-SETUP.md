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
   `https://nigeriastudentcenter.github.io/legal-systems-lab/lexflow-cpd/portal.html`.
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
