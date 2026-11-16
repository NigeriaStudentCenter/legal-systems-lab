// LexFlow CPD API, development: FICTIONAL DATA ONLY.
// Lives in rg-lexflow-cpd-dev: the API container app and its runtime identity.
// Reuses, from lexflow-staging-rg: the Container Apps environment (and so its logs) and the
// Key Vault, where this identity can read ONE secret, cpd-database-url.
// Reuses, not declared here: database lexflow_cpd on the shared server estatecopilot-db.
// Real learner records need a private database and a production subscription instead.
targetScope = 'resourceGroup'

param location string = resourceGroup().location
param sharedResourceGroup string = 'lexflow-staging-rg'
param environmentName string = 'lexflowstg-cae'
param vaultName string = 'lexflowstg-kv-f88b66'
@description('Immutable image reference with @sha256 digest')
param image string
param entraIssuer string
param entraAudience string
param entraJwksUri string
@description('Exact browser origin of the Academy site, for CORS')
param publicWebOrigin string = 'https://legal.bsoedu.org'

var tags = { project: 'lexflow-cpd', environment: 'dev', dataClassification: 'fictional-only' }

resource environment 'Microsoft.App/managedEnvironments@2024-03-01' existing = {
  name: environmentName
  scope: resourceGroup(sharedResourceGroup)
}

resource runtime 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'lexflowcpd-api-id'
  location: location
  tags: tags
}

module secretRead 'kv-secret-reader.bicep' = {
  name: 'cpd-database-url-reader'
  scope: resourceGroup(sharedResourceGroup)
  params: {
    vaultName: vaultName
    secretName: 'cpd-database-url'
    principalId: runtime.properties.principalId
  }
}

resource api 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'lexflowcpd-api'
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
      ingress: {
        external: true
        targetPort: 8080
        allowInsecure: false
        transport: 'auto'
      }
      secrets: [
        {
          name: 'database-url'
          keyVaultUrl: 'https://${vaultName}${az.environment().suffixes.keyvaultDns}/secrets/cpd-database-url'
          identity: runtime.id
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'lexflow-cpd-api'
          image: image
          resources: { cpu: json('0.25'), memory: '0.5Gi' }
          env: [
            { name: 'NODE_ENV', value: 'production' }
            { name: 'DATABASE_URL', secretRef: 'database-url' }
            { name: 'DATABASE_SSL', value: 'true' }
            { name: 'PUBLIC_WEB_ORIGIN', value: publicWebOrigin }
            { name: 'ENTRA_ISSUER', value: entraIssuer }
            { name: 'ENTRA_AUDIENCE', value: entraAudience }
            { name: 'ENTRA_JWKS_URI', value: entraJwksUri }
            // AZURE_OPENAI_* deliberately unset: the AI tutor answers 503 until it is
            // given a deployment and a spending limit.
          ]
          probes: [
            { type: 'Liveness', httpGet: { path: '/healthz', port: 8080 }, periodSeconds: 30 }
            { type: 'Readiness', httpGet: { path: '/readyz', port: 8080 }, periodSeconds: 30 }
          ]
        }
      ]
      scale: { minReplicas: 0, maxReplicas: 1 }
    }
  }
  dependsOn: [secretRead]
}

output apiUrl string = 'https://${api.properties.configuration.ingress.fqdn}'
output warning string = 'FICTIONAL DATA ONLY. Shared database server. AI tutor off.'
