@description('Environment name (dev, prod)')
param environment string

@description('Project name')
param projectName string

@description('Primary backend FQDN (region 1)')
param primaryBackendFqdn string

@description('Secondary backend FQDN (region 2) - empty if single region')
param secondaryBackendFqdn string = ''

@description('Health probe path')
param healthProbePath string = '/health'

var frontDoorName = 'fd-${projectName}-${environment}'
var originGroupName = 'og-backend'
var primaryOriginName = 'origin-primary'
var secondaryOriginName = 'origin-secondary'
var endpointName = 'fde-${projectName}-${environment}'
var routeName = 'route-default'

// Front Door Profile (Standard/AzureFrontDoor for cost efficiency)
resource frontDoor 'Microsoft.Cdn/profiles@2024-09-01' = {
  name: frontDoorName
  location: 'global'
  sku: {
    name: 'Standard_AzureFrontDoor'
  }
}

// Endpoint
resource endpoint 'Microsoft.Cdn/profiles/afdEndpoints@2024-09-01' = {
  parent: frontDoor
  name: endpointName
  location: 'global'
  properties: {
    enabledState: 'Enabled'
  }
}

// Origin Group with health probe and failover
resource originGroup 'Microsoft.Cdn/profiles/originGroups@2024-09-01' = {
  parent: frontDoor
  name: originGroupName
  properties: {
    loadBalancingSettings: {
      sampleSize: 4
      successfulSamplesRequired: 3
      additionalLatencyInMilliseconds: 50
    }
    healthProbeSettings: {
      probePath: healthProbePath
      probeRequestType: 'GET'
      probeProtocol: 'Https'
      probeIntervalInSeconds: 30
    }
    sessionAffinityState: 'Disabled'
  }
}

// Primary Origin (region 1 - swedencentral)
resource primaryOrigin 'Microsoft.Cdn/profiles/originGroups/origins@2024-09-01' = {
  parent: originGroup
  name: primaryOriginName
  properties: {
    hostName: primaryBackendFqdn
    httpPort: 80
    httpsPort: 443
    originHostHeader: primaryBackendFqdn
    priority: 1
    weight: 1000
    enabledState: 'Enabled'
    enforceCertificateNameCheck: true
  }
}

// Secondary Origin (region 2 - only if provided)
resource secondaryOrigin 'Microsoft.Cdn/profiles/originGroups/origins@2024-09-01' = if (!empty(secondaryBackendFqdn)) {
  parent: originGroup
  name: secondaryOriginName
  properties: {
    hostName: secondaryBackendFqdn
    httpPort: 80
    httpsPort: 443
    originHostHeader: secondaryBackendFqdn
    priority: 2
    weight: 1000
    enabledState: 'Enabled'
    enforceCertificateNameCheck: true
  }
}

// Route
resource route 'Microsoft.Cdn/profiles/afdEndpoints/routes@2024-09-01' = {
  parent: endpoint
  name: routeName
  properties: {
    originGroup: {
      id: originGroup.id
    }
    supportedProtocols: [
      'Http'
      'Https'
    ]
    patternsToMatch: [
      '/*'
    ]
    forwardingProtocol: 'HttpsOnly'
    linkToDefaultDomain: 'Enabled'
    httpsRedirect: 'Enabled'
  }
  dependsOn: [
    primaryOrigin
    secondaryOrigin
  ]
}

output frontDoorName string = frontDoor.name
output frontDoorEndpoint string = endpoint.properties.hostName
output frontDoorId string = frontDoor.id
