// TEMPORARY TEST WINDOW opened 14 Nov 2026 by the repository owner's decision.
// Contains no secrets. Self-service sign-up is OFF in the staging tenant, so only the two
// fictional test accounts can sign in. Must be reverted to {enabled:false} after the test.
window.LEXFLOW_IDENTITY_ACCEPTANCE = Object.freeze({
  enabled:true,
  authority:'https://lexflowngstaging.ciamlogin.com/',
  tenantId:'5ddfd479-a3cb-4ff7-bdd8-9d745c4309b7',
  issuer:'https://5ddfd479-a3cb-4ff7-bdd8-9d745c4309b7.ciamlogin.com/5ddfd479-a3cb-4ff7-bdd8-9d745c4309b7/v2.0',
  jwksUri:'https://lexflowngstaging.ciamlogin.com/5ddfd479-a3cb-4ff7-bdd8-9d745c4309b7/discovery/v2.0/keys',
  clientId:'c0ec48d2-b103-4f62-950a-e3d6c65bb55d',
  apiAudience:'e0db88c1-c50d-48ff-985d-df0a01a222d4',
  apiScope:'api://e0db88c1-c50d-48ff-985d-df0a01a222d4/access_as_user',
  redirectUri:'https://legal.bsoedu.org/lexflow-ng/portal/identity-check.html',
  apiBaseUrl:'https://lexflowstg-api.calmdune-686822d1.westeurope.azurecontainerapps.io',
  apiProbe:false
});
