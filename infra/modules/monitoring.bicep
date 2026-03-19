@description('Location for all resources')
param location string = resourceGroup().location

@description('Environment name (dev, prod)')
param environment string

@description('Project name')
param projectName string

@description('Backend App Service resource ID')
param backendAppId string

@description('App Service Plan resource ID')
param appServicePlanId string

@description('Application Gateway resource ID')
param appGatewayId string

@description('Alert notification email')
param alertEmail string = 'admin@${projectName}.com'

var actionGroupName = 'ag-${projectName}-${environment}'
var dashboardName = 'dash-${projectName}-${environment}'

// Action Group for alert notifications
resource actionGroup 'Microsoft.Insights/actionGroups@2023-01-01' = {
  name: actionGroupName
  location: 'global'
  properties: {
    groupShortName: 'CloudAlerts'
    enabled: true
    emailReceivers: [
      {
        name: 'AdminEmail'
        emailAddress: alertEmail
        useCommonAlertSchema: true
      }
    ]
  }
}

// Alert: Response time > 2s on backend
resource responseTimeAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'alert-response-time-${projectName}-${environment}'
  location: 'global'
  properties: {
    description: 'Backend response time exceeds 2 seconds'
    severity: 2
    enabled: true
    scopes: [
      backendAppId
    ]
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'HighResponseTime'
          metricName: 'HttpResponseTime'
          metricNamespace: 'Microsoft.Web/sites'
          operator: 'GreaterThan'
          threshold: 2
          timeAggregation: 'Average'
          criterionType: 'StaticThresholdCriterion'
        }
      ]
    }
    actions: [
      {
        actionGroupId: actionGroup.id
      }
    ]
  }
}

// Alert: HTTP 5xx error rate > 5%
resource errorRateAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'alert-error-rate-${projectName}-${environment}'
  location: 'global'
  properties: {
    description: 'HTTP 5xx error rate exceeds 5%'
    severity: 1
    enabled: true
    scopes: [
      backendAppId
    ]
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'HighErrorRate'
          metricName: 'Http5xx'
          metricNamespace: 'Microsoft.Web/sites'
          operator: 'GreaterThan'
          threshold: 5
          timeAggregation: 'Total'
          criterionType: 'StaticThresholdCriterion'
        }
      ]
    }
    actions: [
      {
        actionGroupId: actionGroup.id
      }
    ]
  }
}

// Alert: CPU > 80% on App Service Plan
resource cpuAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'alert-cpu-${projectName}-${environment}'
  location: 'global'
  properties: {
    description: 'App Service Plan CPU exceeds 80%'
    severity: 2
    enabled: true
    scopes: [
      appServicePlanId
    ]
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'HighCPU'
          metricName: 'CpuPercentage'
          metricNamespace: 'Microsoft.Web/serverfarms'
          operator: 'GreaterThan'
          threshold: 80
          timeAggregation: 'Average'
          criterionType: 'StaticThresholdCriterion'
        }
      ]
    }
    actions: [
      {
        actionGroupId: actionGroup.id
      }
    ]
  }
}

// Alert: App Gateway unhealthy backend
resource unhealthyBackendAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'alert-unhealthy-backend-${projectName}-${environment}'
  location: 'global'
  properties: {
    description: 'Application Gateway has unhealthy backend hosts'
    severity: 1
    enabled: true
    scopes: [
      appGatewayId
    ]
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'UnhealthyHosts'
          metricName: 'UnhealthyHostCount'
          metricNamespace: 'Microsoft.Network/applicationGateways'
          operator: 'GreaterThan'
          threshold: 0
          timeAggregation: 'Average'
          criterionType: 'StaticThresholdCriterion'
        }
      ]
    }
    actions: [
      {
        actionGroupId: actionGroup.id
      }
    ]
  }
}

// Azure Portal Dashboard
resource dashboard 'Microsoft.Portal/dashboards@2020-09-01-preview' = {
  name: dashboardName
  location: location
  properties: {
    lenses: [
      {
        order: 0
        parts: [
          {
            position: { x: 0, y: 0, colSpan: 6, rowSpan: 4 }
            metadata: {
              type: 'Extension/HubsExtension/PartType/MonitorChartPart'
              inputs: [
                {
                  name: 'options'
                  value: {
                    chart: {
                      title: 'Backend Response Time'
                      metrics: [
                        {
                          resourceMetadata: { id: backendAppId }
                          name: 'HttpResponseTime'
                          aggregationType: 4
                        }
                      ]
                      timespan: { relative: { duration: 3600000 } }
                      visualization: { chartType: 2 }
                    }
                  }
                }
              ]
            }
          }
          {
            position: { x: 6, y: 0, colSpan: 6, rowSpan: 4 }
            metadata: {
              type: 'Extension/HubsExtension/PartType/MonitorChartPart'
              inputs: [
                {
                  name: 'options'
                  value: {
                    chart: {
                      title: 'CPU Usage'
                      metrics: [
                        {
                          resourceMetadata: { id: appServicePlanId }
                          name: 'CpuPercentage'
                          aggregationType: 4
                        }
                      ]
                      timespan: { relative: { duration: 3600000 } }
                      visualization: { chartType: 2 }
                    }
                  }
                }
              ]
            }
          }
          {
            position: { x: 0, y: 4, colSpan: 6, rowSpan: 4 }
            metadata: {
              type: 'Extension/HubsExtension/PartType/MonitorChartPart'
              inputs: [
                {
                  name: 'options'
                  value: {
                    chart: {
                      title: 'HTTP 5xx Errors'
                      metrics: [
                        {
                          resourceMetadata: { id: backendAppId }
                          name: 'Http5xx'
                          aggregationType: 1
                        }
                      ]
                      timespan: { relative: { duration: 3600000 } }
                      visualization: { chartType: 2 }
                    }
                  }
                }
              ]
            }
          }
          {
            position: { x: 6, y: 4, colSpan: 6, rowSpan: 4 }
            metadata: {
              type: 'Extension/HubsExtension/PartType/MonitorChartPart'
              inputs: [
                {
                  name: 'options'
                  value: {
                    chart: {
                      title: 'App Gateway Healthy Hosts'
                      metrics: [
                        {
                          resourceMetadata: { id: appGatewayId }
                          name: 'HealthyHostCount'
                          aggregationType: 4
                        }
                      ]
                      timespan: { relative: { duration: 3600000 } }
                      visualization: { chartType: 2 }
                    }
                  }
                }
              ]
            }
          }
        ]
      }
    ]
    metadata: {
      model: {
        timeRange: {
          type: 'MsPortalFx.Composition.Configuration.ValueTypes.TimeRange'
          value: { relative: { duration: 24, timeUnit: 1 } }
        }
      }
    }
  }
  tags: {
    'hidden-title': 'CloudAzure Monitoring - ${environment}'
  }
}

output actionGroupId string = actionGroup.id
output dashboardName string = dashboard.name
