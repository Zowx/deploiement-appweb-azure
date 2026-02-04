@description('Location for all resources')
param location string = resourceGroup().location

@description('Environment name (dev, prod)')
param environment string

@description('Project name')
param projectName string

@description('Storage container name')
param storageContainerName string = 'uploads'

@description('Backend Principal ID for RBAC')
param backendPrincipalId string = ''

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

// App Configuration Data Reader role for backend
resource configStoreRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(backendPrincipalId)) {
  name: guid(configStore.id, backendPrincipalId, 'App Configuration Data Reader')
  scope: configStore
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '516239f1-63e1-4d78-a4de-a74fb236a071')
    principalId: backendPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// === Application Settings ===
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

resource configApiVersion 'Microsoft.AppConfiguration/configurationStores/keyValues@2023-03-01' = {
  parent: configStore
  name: 'Api:Version'
  properties: {
    value: '1.0.0'
  }
}

// === Upload Settings ===
resource configUploadMaxSize 'Microsoft.AppConfiguration/configurationStores/keyValues@2023-03-01' = {
  parent: configStore
  name: 'Upload:MaxFileSizeMB'
  properties: {
    value: '10'
  }
}

resource configUploadAllowedExtensions 'Microsoft.AppConfiguration/configurationStores/keyValues@2023-03-01' = {
  parent: configStore
  name: 'Upload:AllowedExtensions'
  properties: {
    value: '.jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.txt,.zip'
  }
}

resource configStorageContainer 'Microsoft.AppConfiguration/configurationStores/keyValues@2023-03-01' = {
  parent: configStore
  name: 'Storage:ContainerName'
  properties: {
    value: storageContainerName
  }
}

// === Feature Flags ===
resource featureLogging 'Microsoft.AppConfiguration/configurationStores/keyValues@2023-03-01' = {
  parent: configStore
  name: 'Feature:LoggingEnabled'
  properties: {
    value: 'true'
  }
}

resource featureFileValidation 'Microsoft.AppConfiguration/configurationStores/keyValues@2023-03-01' = {
  parent: configStore
  name: 'Feature:FileValidationEnabled'
  properties: {
    value: 'true'
  }
}

output configStoreName string = configStore.name
output configStoreEndpoint string = configStore.properties.endpoint
output configStoreId string = configStore.id
