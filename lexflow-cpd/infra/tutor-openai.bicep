// The CPD AI tutor's model deployment, and permission for ONE identity to call it.
// Deployed into the existing Azure OpenAI account 'Bsoe' (rg AI), which holds no other
// deployments, so this identity reaches nothing belonging to other courses.
param accountName string
param deploymentName string
param principalId string
@description('Tokens per minute in thousands: a provider-side throttle on top of the API daily caps')
param capacityK int = 10

var openAiUserRole = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd')

resource account 'Microsoft.CognitiveServices/accounts@2024-10-01' existing = {
  name: accountName
}
resource model 'Microsoft.CognitiveServices/accounts/deployments@2024-10-01' = {
  parent: account
  name: deploymentName
  sku: { name: 'DataZoneStandard', capacity: capacityK }
  properties: {
    model: { format: 'OpenAI', name: 'gpt-4.1-mini', version: '2025-04-14' }
    // Microsoft's default content filters (hate, sexual, violence, self-harm, jailbreak).
    raiPolicyName: 'Microsoft.DefaultV2'
    versionUpgradeOption: 'NoAutoUpgrade'
  }
}
resource call 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: account
  name: guid(account.id, principalId, openAiUserRole)
  properties: {
    principalId: principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: openAiUserRole
  }
}
output endpoint string = account.properties.endpoint
