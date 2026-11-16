// Public identifiers ONLY. Registrations LexFlow-CPD-Portal and LexFlow-CPD-API were created on 15 Nov 2026
// in the LexFlow NG *Staging* external tenant: fictional test identities only, no real learners.
// apiBaseUrl is the development CPD API (rg-lexflow-cpd-dev). Self-service sign-up is off in the tenant.
// This file is PUBLIC on GitHub Pages: NEVER include client secrets, keys, passwords or tokens.
export const lexflowAuthConfig = Object.freeze({
  clientId: "56b704b7-ab4f-48dd-a292-5825f2a0ddc9",
  // The tenant ID must be in the path: a bare host fails endpoint discovery in MSAL.
  authority: "https://lexflowngstaging.ciamlogin.com/5ddfd479-a3cb-4ff7-bdd8-9d745c4309b7/",
  knownAuthority: "lexflowngstaging.ciamlogin.com",
  redirectUri: "https://legal.bsoedu.org/lexflow-cpd/portal.html",
  apiScope: "api://4fe1be03-4e20-49d1-b52e-0f6fe5118d80/access_as_user",
  apiBaseUrl: "https://lexflowcpd-api.calmdune-686822d1.westeurope.azurecontainerapps.io"
});
