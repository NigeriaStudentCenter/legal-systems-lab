// LexFlow NG hybrid staging: SYNTHETIC DATA ONLY.
// Dedicated: Key Vault, logs, runtime identity, Container Apps environment and API.
// Shared (not declared here): the PostgreSQL server that hosts the lexflow_staging
// database, and the public GitHub container registry that holds the image.
// Real professional data needs bootstrap.bicep-style private networking instead.
targetScope = 'resourceGroup'

param location string = resourceGroup().location
@description('Staging naming prefix')
param prefix string = 'lexflowstg'
@description('Existing-or-new Key Vault name; must hold a secret called database-url')
param vaultName string
@description('Immutable image reference with @sha256 digest')
param image string
param oidcIssuer string
param oidcAudience string
param oidcJwksUri string
@description('Exact browser origin for CORS')
param browserOrigin string

var tags = { project: 'lexflow-ng', environment: 'staging', dataClassification: 'synthetic-only' }
var secretsUserRole = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')

resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${prefix}-logs'
  location: location
  tags: tags
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
    workspaceCapping: { dailyQuotaGb: json('0.1') }
  }
}

resource vault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: vaultName
  location: location
  tags: tags
  properties: {
    tenantId: subscription().tenantId
    sku: { family: 'A', name: 'standard' }
    enableRbacAuthorization: true
    softDeleteRetentionInDays: 90
    // Public endpoint, RBAC-only. A private endpoint is required before real data.
    publicNetworkAccess: 'Enabled'
  }
}

resource runtime 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${prefix}-api-id'
  location: location
  tags: tags
}

resource vaultRead 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: vault
  name: guid(vault.id, runtime.id, secretsUserRole)
  properties: {
    principalId: runtime.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: secretsUserRole
  }
}

resource environment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${prefix}-cae'
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logs.properties.customerId
        sharedKey: logs.listKeys().primarySharedKey
      }
    }
  }
}

resource api 'Microsoft.App/containerApps@2024-03-01' = {
  name: '${prefix}-api'
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${runtime.id}': {} }
  }
  properties: {
    managedEnvironmentId: environment.id
    configuration: {
      activeRevisionsMode: 'Single'
      // Public HTTPS for staging health checks only. Every business gate below is off.
      ingress: {
        external: true
        targetPort: 8080
        allowInsecure: false
        transport: 'auto'
      }
      secrets: [
        {
          name: 'database-url'
          keyVaultUrl: '${vault.properties.vaultUri}secrets/database-url'
          identity: runtime.id
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'lexflow-api'
          image: image
          resources: { cpu: json('0.25'), memory: '0.5Gi' }
          env: [
            { name: 'NODE_ENV', value: 'production' }
            { name: 'HOST', value: '0.0.0.0' }
            { name: 'PORT', value: '8080' }
            { name: 'DATABASE_URL', secretRef: 'database-url' }
            { name: 'DATABASE_SSL', value: 'true' }
            { name: 'OIDC_ISSUER', value: oidcIssuer }
            { name: 'OIDC_AUDIENCE', value: oidcAudience }
            { name: 'OIDC_JWKS_URI', value: oidcJwksUri }
            { name: 'ALLOWED_ORIGINS', value: browserOrigin }
            { name: 'ENABLE_APPLICATIONS', value: 'false' }
            { name: 'ENABLE_VERIFICATION', value: 'false' }
            { name: 'ENABLE_PUBLICATION', value: 'false' }
            { name: 'ENABLE_DIRECTORY', value: 'false' }
          ]
        }
      ]
      scale: { minReplicas: 0, maxReplicas: 1 }
    }
  }
  dependsOn: [vaultRead]
}

output apiUrl string = 'https://${api.properties.configuration.ingress.fqdn}'
output keyVaultName string = vault.name
output warning string = 'SYNTHETIC DATA ONLY. All business features disabled. Shared database server.'
