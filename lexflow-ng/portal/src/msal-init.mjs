// @azure/msal-browser v5 has no static PublicClientApplication.createPublicClientApplication():
// construct the client, then initialize it before any other call.
export async function createMsal(PublicClientApplication, config) {
  const client = new PublicClientApplication(config);
  await client.initialize();
  return client;
}
