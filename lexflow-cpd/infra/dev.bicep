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
param entraTenantId string
@description('Client IDs of apps allowed to call the API on behalf of a user')
param allowedClientIds array
@description('Exact browser origin of the Academy site, for CORS')
param publicWebOrigin string = 'https://legal.bsoedu.org'
@allowed(['true', 'false'])
param allowSelfRegistration string = 'true'
@description('Turn the AI tutor on: deploys gpt-4.1-mini into the Bsoe account and lets this API call it')
param enableTutor bool = false
param tutorResourceGroup string = 'AI'
param tutorAccountName string = 'Bsoe'
param tutorDeploymentName string = 'lexflow-cpd-tutor-gpt41mini'
@description('Answers per day across all users; at most about $0.001 each')
param tutorDailyTotal int = 50
param tutorDailyPerUser int = 10

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

module tutor 'tutor-openai.bicep' = if (enableTutor) {
  name: 'cpd-tutor-openai'
  scope: resourceGroup(tutorResourceGroup)
  params: {
    accountName: tutorAccountName
    deploymentName: tutorDeploymentName
    principalId: runtime.properties.principalId
  }
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
          env: concat([
            { name: 'NODE_ENV', value: 'production' }
            { name: 'DATABASE_URL', secretRef: 'database-url' }
            { name: 'DATABASE_SSL', value: 'true' }
            { name: 'PUBLIC_WEB_ORIGIN', value: publicWebOrigin }
            { name: 'ENTRA_ISSUER', value: entraIssuer }
            { name: 'ENTRA_AUDIENCE', value: entraAudience }
            { name: 'ENTRA_JWKS_URI', value: entraJwksUri }
            { name: 'ENTRA_TENANT_ID', value: entraTenantId }
            // Apps whose user tokens are accepted. Dev also allows the password-only test client
            // used for automated checks; production must list the portal app only.
            { name: 'ALLOWED_CLIENT_IDS', value: join(allowedClientIds, ',') }
            // Signed-in users may create their own LEARNER record. Acceptable here only because
            // the tenant has self-service sign-up off, so every account was made by an operator.
            { name: 'ALLOW_SELF_REGISTRATION', value: allowSelfRegistration }
            // Which managed identity DefaultAzureCredential uses to call Azure OpenAI.
            { name: 'AZURE_CLIENT_ID', value: runtime.properties.clientId }
          ], enableTutor ? [
            { name: 'AZURE_OPENAI_ENDPOINT', value: 'https://${toLower(tutorAccountName)}.openai.azure.com/' }
            { name: 'AZURE_OPENAI_DEPLOYMENT', value: tutorDeploymentName }
            { name: 'TUTOR_DAILY_TOTAL', value: string(tutorDailyTotal) }
            { name: 'TUTOR_DAILY_PER_USER', value: string(tutorDailyPerUser) }
          ] : [])
          probes: [
            { type: 'Liveness', httpGet: { path: '/healthz', port: 8080 }, periodSeconds: 30 }
            { type: 'Readiness', httpGet: { path: '/readyz', port: 8080 }, periodSeconds: 30 }
          ]
        }
      ]
      scale: { minReplicas: 0, maxReplicas: 1 }
    }
  }
  dependsOn: [secretRead, tutor]
}

output apiUrl string = 'https://${api.properties.configuration.ingress.fqdn}'
output warning string = enableTutor ? 'FICTIONAL DATA ONLY. Shared database server. AI tutor ON with daily caps.' : 'FICTIONAL DATA ONLY. Shared database server. AI tutor off.'
