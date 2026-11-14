targetScope = 'resourceGroup'

@description('Approved Azure staging region')
param location string = resourceGroup().location

@minLength(4)
@maxLength(16)
@description('Unique, lower-case staging prefix')
param prefix string

param postgresAdmin string

@secure()
param postgresAdminPassword string

var tags = { project:'lexflow-ng', environment:'staging', dataClassification:'professional-onboarding' }
var vaultName = take(format('{0}kv{1}',prefix,uniqueString(resourceGroup().id)),24)
var registryName = take(format('{0}acr{1}',prefix,uniqueString(resourceGroup().id)),45)

resource vnet 'Microsoft.Network/virtualNetworks@2024-05-01' = {
  name: format('{0}-vnet',prefix)
  location: location
  tags: tags
  properties: {
    addressSpace: {addressPrefixes:['10.88.0.0/16']}
    subnets: [
      {
        name:'postgres'
        properties: {
          addressPrefix:'10.88.1.0/24'
          delegations:[{
            name:'postgres'
            properties:{serviceName:'Microsoft.DBforPostgreSQL/flexibleServers'}
          }]
        }
      }
      {
        name:'containerapps'
        properties:{addressPrefix:'10.88.4.0/23'}
      }
    ]
  }
}

resource privateZone 'Microsoft.Network/privateDnsZones@2024-06-01' = {
  name:format('{0}.postgres.database.azure.com',prefix)
  location:'global'
  tags:tags
}

resource networkLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = {
  parent:privateZone
  name:'staging-network'
  location:'global'
  properties: {
    registrationEnabled:false
    virtualNetwork:{id:vnet.id}
  }
}

resource db 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: format('{0}-pg',prefix)
  location:location
  tags:tags
  sku:{name:'Standard_B1ms',tier:'Burstable'}
  properties: {
    administratorLogin:postgresAdmin
    administratorLoginPassword:postgresAdminPassword
    version:'16'
    storage:{storageSizeGB:32,autoGrow:'Enabled'}
    backup:{backupRetentionDays:14,geoRedundantBackup:'Disabled'}
    highAvailability:{mode:'Disabled'}
    network: {
      publicNetworkAccess:'Disabled'
      delegatedSubnetResourceId:format('{0}/subnets/postgres',vnet.id)
      privateDnsZoneArmResourceId:privateZone.id
    }
  }
  dependsOn:[networkLink]
}

resource vault 'Microsoft.KeyVault/vaults@2024-11-01' = {
  name:vaultName
  location:location
  tags:tags
  properties: {
    tenantId:subscription().tenantId
    sku:{family:'A',name:'standard'}
    enableRbacAuthorization:true
    enablePurgeProtection:true
    softDeleteRetentionInDays:90
    publicNetworkAccess:'Disabled'
    networkAcls:{bypass:'None',defaultAction:'Deny'}
  }
}

resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name:registryName
  location:location
  tags:tags
  sku:{name:'Basic'}
  properties:{adminUserEnabled:false}
}

resource monitoring 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name:format('{0}-logs',prefix)
  location:location
  tags:tags
  properties:{sku:{name:'PerGB2018'},retentionInDays:30}
}

output vnetId string = vnet.id
output containerSubnetId string = format('{0}/subnets/containerapps',vnet.id)
output postgresName string = db.name
output keyVaultName string = vault.name
output registryName string = registry.name
output monitoringWorkspaceId string = monitoring.id
