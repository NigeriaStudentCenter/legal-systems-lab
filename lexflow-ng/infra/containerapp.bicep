targetScope = 'resourceGroup'

@description('Approved staging Azure region')
param location string = resourceGroup().location
@description('Staging naming prefix')
param prefix string
@description('Container Apps infrastructure subnet ID from bootstrap')
param infrastructureSubnetId string
@description('A scanned, immutable container image reference with @sha256 digest')
param imageDigest string
@description('Azure Container Registry login server (managed identity needs AcrPull)')
param registryLoginServer string
@description('Resource ID of the approved Log Analytics workspace')
param monitoringWorkspaceId string
@description('Expected external identity issuer URL')
param oidcIssuer string
@description('Expected API audience')
param oidcAudience string
@description('Trusted identity-provider JWKS URL')
param oidcJwksUri string
@description('Exact browser origin for CORS')
param browserOrigin string
@secure()
@description('Staging PostgreSQL runtime connection string; provision from Key Vault, never GitHub')
param databaseConnectionString string

resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' existing = {
  name:last(split(monitoringWorkspaceId,'/'))
}

resource environment 'Microsoft.App/managedEnvironments@2025-07-01' = {
  name:format('{0}-cae',prefix)
  location:location
  properties:{
    vnetConfiguration:{
      infrastructureSubnetId:infrastructureSubnetId
      internal:true
    }
    appLogsConfiguration:{
      destination:'log-analytics'
      logAnalyticsConfiguration:{
        customerId:logs.properties.customerId
        sharedKey:logs.listKeys().primarySharedKey
      }
    }
  }
}

resource api 'Microsoft.App/containerApps@2025-07-01' = {
  name:format('{0}-api',prefix)
  location:location
  identity:{type:'SystemAssigned'}
  properties:{
    managedEnvironmentId:environment.id
    configuration:{
      activeRevisionsMode:'Single'
      // NO ingress: not reachable by external clients or even the VNet.
      // A separate, reviewed gateway change is required before real use.
      registries:[{
        server:registryLoginServer
        identity:'system'
      }]
      secrets:[{name:'database-url',value:databaseConnectionString}]
    }
    template:{
      containers:[{
        name:'lexflow-api'
        image:imageDigest
        resources:{cpu:json('0.25'),memory:'0.5Gi'}
        env:[
          {name:'NODE_ENV',value:'production'}
          {name:'HOST',value:'0.0.0.0'}
          {name:'PORT',value:'8080'}
          {name:'DATABASE_URL',secretRef:'database-url'}
          {name:'DATABASE_SSL',value:'true'}
          {name:'OIDC_ISSUER',value:oidcIssuer}
          {name:'OIDC_AUDIENCE',value:oidcAudience}
          {name:'OIDC_JWKS_URI',value:oidcJwksUri}
          {name:'ALLOWED_ORIGINS',value:browserOrigin}
          {name:'ENABLE_APPLICATIONS',value:'false'}
          {name:'ENABLE_VERIFICATION',value:'false'}
          {name:'ENABLE_PUBLICATION',value:'false'}
          {name:'ENABLE_DIRECTORY',value:'false'}
          {name:'ENABLE_ENGAGEMENTS',value:'false'}
          {name:'ENABLE_AUTH_DIAGNOSTIC',value:'false'}
        ]
      }]
      scale:{minReplicas:0,maxReplicas:1}
    }
  }
}

output containerAppId string = api.id
output warning string = 'NO INGRESS AND ALL BUSINESS FEATURES DISABLED. Requires AcrPull role and approved runtime identity.'
