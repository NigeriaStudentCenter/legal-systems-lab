// Lets one identity read one named secret, and nothing else in the vault.
param vaultName string
param secretName string
param principalId string

var secretsUserRole = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')

resource vault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: vaultName
}
resource secret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' existing = {
  parent: vault
  name: secretName
}
resource read 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: secret
  name: guid(secret.id, principalId, secretsUserRole)
  properties: {
    principalId: principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: secretsUserRole
  }
}
