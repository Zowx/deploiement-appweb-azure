@description('Location for all resources')
param location string = resourceGroup().location

@description('Environment name (dev, prod)')
param environment string

@description('Project name')
param projectName string

var configStoreName = 'appcs-${projectName}-${environment}'

resource configStore 'Microsoft.AppConfiguration/configurationStores@2023-03-01' = {
  name: configStoreName
  location: location
  sku: {
    name: 'free'
  }
  properties: {
    publicNetworkAccess: 'Enabled'
  }
}

resource configAppName 'Microsoft.AppConfiguration/configurationStores/keyValues@2023-03-01' = {
  parent: configStore
  name: 'App:Name'
  properties: {
    value: projectName
  }
}

resource configEnvironment 'Microsoft.AppConfiguration/configurationStores/keyValues@2023-03-01' = {
  parent: configStore
  name: 'App:Environment'
  properties: {
    value: environment
  }
}

output configStoreName string = configStore.name
output configStoreEndpoint string = configStore.properties.endpoint
output configStoreId string = configStore.id
