targetScope = 'subscription'

@description('Location for all resources')
param location string = 'swedencentral'

@description('Environment name (dev, prod)')
param environment string = 'dev'

@description('Project name')
param projectName string = 'cloudazure'

@description('PostgreSQL administrator login')
param dbAdminLogin string = 'pgadmin'

@secure()
@description('PostgreSQL administrator password')
param dbAdminPassword string

var resourceGroupName = 'rg-${projectName}-${environment}'
var keyVaultName = 'kv-${projectName}-${environment}'
var appConfigEndpoint = 'https://appcs-${projectName}-${environment}.azconfig.io'

resource rg 'Microsoft.Resources/resourceGroups@2021-04-01' = {
  name: resourceGroupName
  location: location
}

module database 'modules/database.bicep' = {
  name: 'database-deployment'
  scope: rg
  params: {
    location: location
    environment: environment
    projectName: projectName
    administratorLogin: dbAdminLogin
    administratorLoginPassword: dbAdminPassword
  }
}

module storage 'modules/storage.bicep' = {
  name: 'storage-deployment'
  scope: rg
  params: {
    location: location
    environment: environment
    projectName: projectName
  }
}

module appService 'modules/appservice.bicep' = {
  name: 'appservice-deployment'
  scope: rg
  params: {
    location: location
    environment: environment
    projectName: projectName
    keyVaultName: keyVaultName
    appConfigEndpoint: appConfigEndpoint
    storageAccountName: storage.outputs.storageAccountName
    databaseServerFqdn: database.outputs.serverFqdn
  }
}

module keyVault 'modules/keyvault.bicep' = {
  name: 'keyvault-deployment'
  scope: rg
  params: {
    location: location
    environment: environment
    projectName: projectName
    accessPrincipalIds: [
      appService.outputs.frontendPrincipalId
      appService.outputs.backendPrincipalId
    ]
    databaseConnectionString: database.outputs.connectionString
    storageAccountName: storage.outputs.storageAccountName
    storageContainerName: 'uploads'
  }
  dependsOn: [
    appService
  ]
}

module appConfig 'modules/appconfig.bicep' = {
  name: 'appconfig-deployment'
  scope: rg
  params: {
    location: location
    environment: environment
    projectName: projectName
    storageContainerName: 'uploads'
    backendPrincipalId: appService.outputs.backendPrincipalId
  }
  dependsOn: [
    appService
  ]
}

output resourceGroupName string = rg.name
output frontendUrl string = appService.outputs.frontendAppUrl
output backendUrl string = appService.outputs.backendAppUrl
output storageAccountName string = storage.outputs.storageAccountName
output keyVaultName string = keyVault.outputs.keyVaultName
output appConfigEndpoint string = appConfig.outputs.configStoreEndpoint
output databaseServer string = database.outputs.serverFqdn
