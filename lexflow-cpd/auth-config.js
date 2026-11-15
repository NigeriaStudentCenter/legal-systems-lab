// Public identifiers ONLY. Fill after confirming your Entra External tenant and app registrations.
// This file is PUBLIC on GitHub Pages: NEVER include client secrets, keys, passwords or tokens.
export const lexflowAuthConfig = Object.freeze({
  clientId: "REPLACE_WITH_LEXFLOW_PORTAL_APPLICATION_CLIENT_ID",
  authority: "https://REPLACE_WITH_TENANT_SUBDOMAIN.ciamlogin.com/",
  knownAuthority: "REPLACE_WITH_TENANT_SUBDOMAIN.ciamlogin.com",
  redirectUri: "https://nigeriastudentcenter.github.io/legal-systems-lab/lexflow-cpd/portal.html",
  apiScope: "api://REPLACE_WITH_LEXFLOW_API_APPLICATION_CLIENT_ID/access_as_user",
  apiBaseUrl: "https://REPLACE_WITH_AZURE_APP_SERVICE_HOSTNAME"
});
