@description('Location for all resources')
param location string = resourceGroup().location

@description('Environment name (dev, prod)')
param environment string

@description('Project name')
param projectName string

@description('App Service Plan SKU name')
param skuName string = 'S1'

@description('App Service Plan SKU tier')
param skuTier string = 'Standard'

@description('App Gateway subnet ID for access restrictions (empty = no restriction)')
param appGatewaySubnetId string = ''

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

@secure()
@description('Google OAuth Client ID')
param googleClientId string = ''

@secure()
@description('Google OAuth Client Secret')
param googleClientSecret string = ''

@secure()
@description('Session secret for express-session')
param sessionSecret string = ''

@description('Backend base URL (for OAuth callback)')
param baseUrl string = ''

@description('Frontend URL (for CORS and post-login redirect)')
param frontendUrl string = ''

@secure()
@description('Azure Function key for logging')
param azureFunctionKey string = ''

var appServicePlanName = 'asp-${projectName}-${environment}'
var frontendAppName = 'app-${projectName}-frontend-${environment}'
var backendAppName = 'app-${projectName}-backend-${environment}'

resource appServicePlan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: appServicePlanName
  location: location
  kind: 'linux'
  sku: {
    name: skuName
    tier: skuTier
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
      alwaysOn: true
      linuxFxVersion: 'NODE|20-lts'
      appCommandLine: 'node server.cjs'
      ipSecurityRestrictions: !empty(appGatewaySubnetId) ? [
        {
          vnetSubnetResourceId: appGatewaySubnetId
          action: 'Allow'
          priority: 100
          name: 'AllowAppGateway'
          description: 'Allow traffic from Application Gateway subnet'
        }
        {
          ipAddress: 'Any'
          action: 'Deny'
          priority: 2147483647
          name: 'DenyAll'
          description: 'Deny all other traffic'
        }
      ] : []
      appSettings: [
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~20'
        }
        {
          name: 'BACKEND_HOST'
          value: '${backendAppName}.azurewebsites.net'
        }
        {
          name: 'FRONTEND_URL'
          value: frontendUrl
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
      alwaysOn: true
      linuxFxVersion: 'DOCKER|ghcr.io/zowx/cloudazure-backend:latest'
      ipSecurityRestrictions: !empty(appGatewaySubnetId) ? [
        {
          vnetSubnetResourceId: appGatewaySubnetId
          action: 'Allow'
          priority: 100
          name: 'AllowAppGateway'
          description: 'Allow traffic from Application Gateway subnet'
        }
        {
          ipAddress: 'AzureCloud'
          action: 'Allow'
          priority: 200
          name: 'AllowAzureServices'
          tag: 'ServiceTag'
          description: 'Allow traffic from Azure services (frontend proxy)'
        }
        {
          ipAddress: 'Any'
          action: 'Deny'
          priority: 2147483647
          name: 'DenyAll'
          description: 'Deny all other traffic'
        }
      ] : []
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
        {
          name: 'DATABASE_URL'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=database-connection-string)'
        }
        {
          name: 'GOOGLE_CLIENT_ID'
          value: googleClientId
        }
        {
          name: 'GOOGLE_CLIENT_SECRET'
          value: googleClientSecret
        }
        {
          name: 'SESSION_SECRET'
          value: sessionSecret
        }
        {
          name: 'BASE_URL'
          value: baseUrl
        }
        {
          name: 'FRONTEND_URL'
          value: frontendUrl
        }
        {
          name: 'AZURE_FUNCTION_KEY'
          value: azureFunctionKey
        }
      ]
    }
    httpsOnly: true
  }
}

output appServicePlanId string = appServicePlan.id
output appServicePlanName string = appServicePlan.name
output backendFqdn string = backendApp.properties.defaultHostName
output frontendFqdn string = frontendApp.properties.defaultHostName
output frontendAppName string = frontendApp.name
output frontendAppUrl string = 'https://${frontendApp.properties.defaultHostName}'
output frontendPrincipalId string = frontendApp.identity.principalId
output backendAppId string = backendApp.id
output backendAppName string = backendApp.name
output backendAppUrl string = 'https://${backendApp.properties.defaultHostName}'
output backendPrincipalId string = backendApp.identity.principalId
