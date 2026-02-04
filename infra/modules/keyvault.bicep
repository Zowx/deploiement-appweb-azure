@description('Location for all resources')
param location string = resourceGroup().location

@description('Environment name (dev, prod)')
param environment string

@description('Project name')
param projectName string

@description('Tenant ID for Key Vault')
param tenantId string = subscription().tenantId

@description('Principal IDs that need access to Key Vault')
param accessPrincipalIds array = []

// === Secrets to store ===
@secure()
@description('Database connection string')
param databaseConnectionString string = ''

@description('Storage account name')
param storageAccountName string = ''

@description('Storage container name')
param storageContainerName string = 'uploads'

var keyVaultName = 'kv-${projectName}-${environment}'

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  properties: {
    enabledForDeployment: true
    enabledForTemplateDeployment: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
    tenantId: tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    accessPolicies: [for principalId in accessPrincipalIds: {
      objectId: principalId
      tenantId: tenantId
      permissions: {
        secrets: [
          'get'
          'list'
        ]
      }
    }]
  }
}

// === Secrets ===
resource secretDatabaseUrl 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (!empty(databaseConnectionString)) {
  parent: keyVault
  name: 'database-connection-string'
  properties: {
    value: databaseConnectionString
  }
}

resource secretStorageAccount 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (!empty(storageAccountName)) {
  parent: keyVault
  name: 'storage-account-name'
  properties: {
    value: storageAccountName
  }
}

resource secretStorageContainer 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'storage-container-name'
  properties: {
    value: storageContainerName
  }
}

output keyVaultName string = keyVault.name
output keyVaultUri string = keyVault.properties.vaultUri
output keyVaultId string = keyVault.id
