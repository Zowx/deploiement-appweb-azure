@description('Location for all resources')
param location string = resourceGroup().location

@description('Environment name (dev, prod)')
param environment string

@description('Project name')
param projectName string

@description('App Service Plan SKU')
param skuName string = 'B1'

@description('Key Vault name for secrets')
param keyVaultName string = ''

@description('App Configuration endpoint')
param appConfigEndpoint string = ''

@description('Storage account name')
param storageAccountName string = ''

@description('Database server FQDN')
param databaseServerFqdn string = ''

@description('Azure Function URL for logging')
param functionAppUrl string = ''

var appServicePlanName = 'asp-${projectName}-${environment}'
var frontendAppName = 'app-${projectName}-frontend-${environment}'
var backendAppName = 'app-${projectName}-backend-${environment}'

resource appServicePlan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: appServicePlanName
  location: location
  kind: 'linux'
  sku: {
    name: skuName
    tier: 'Basic'
  }
  properties: {
    reserved: true
  }
}

resource frontendApp 'Microsoft.Web/sites@2024-04-01' = {
  name: frontendAppName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts'
      appCommandLine: 'node server.cjs'
      appSettings: [
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~20'
        }
        {
          name: 'VITE_API_URL'
          value: 'https://${backendAppName}.azurewebsites.net/api/files'
        }
      ]
    }
    httpsOnly: true
  }
}

resource backendApp 'Microsoft.Web/sites@2024-04-01' = {
  name: backendAppName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'DOCKER|ghcr.io/zowx/cloudazure-backend:latest'
      appSettings: [
        {
          name: 'WEBSITES_PORT'
          value: '3001'
        }
        {
          name: 'DOCKER_REGISTRY_SERVER_URL'
          value: 'https://ghcr.io'
        }
        {
          name: 'WEBSITES_ENABLE_APP_SERVICE_STORAGE'
          value: 'false'
        }
        {
          name: 'NODE_ENV'
          value: environment == 'prod' ? 'production' : 'development'
        }
        {
          name: 'AZURE_KEYVAULT_NAME'
          value: keyVaultName
        }
        {
          name: 'AZURE_APPCONFIG_ENDPOINT'
          value: appConfigEndpoint
        }
        {
          name: 'AZURE_STORAGE_ACCOUNT_NAME'
          value: storageAccountName
        }
        {
          name: 'AZURE_STORAGE_CONTAINER_NAME'
          value: 'uploads'
        }
        {
          name: 'DATABASE_SERVER'
          value: databaseServerFqdn
        }
        {
          name: 'AZURE_FUNCTION_URL'
          value: functionAppUrl
        }
      ]
    }
    httpsOnly: true
  }
}

output appServicePlanId string = appServicePlan.id
output frontendAppName string = frontendApp.name
output frontendAppUrl string = 'https://${frontendApp.properties.defaultHostName}'
output frontendPrincipalId string = frontendApp.identity.principalId
output backendAppName string = backendApp.name
output backendAppUrl string = 'https://${backendApp.properties.defaultHostName}'
output backendPrincipalId string = backendApp.identity.principalId
