@description('Location for the autoscale setting')
param location string = resourceGroup().location

@description('Environment name (dev, prod)')
param environment string

@description('Project name')
param projectName string

@description('Resource ID of the App Service Plan to autoscale')
param appServicePlanId string

@description('Minimum number of instances')
param minCapacity int = 1

@description('Maximum number of instances')
param maxCapacity int = 3

@description('Default number of instances')
param defaultCapacity int = 1

@description('CPU threshold to scale out (%)')
param scaleOutCpuThreshold int = 70

@description('CPU threshold to scale in (%)')
param scaleInCpuThreshold int = 30

@description('Admin email for autoscale notifications')
param notificationEmail string = 'admin@${projectName}.com'

var autoscaleSettingName = 'autoscale-${projectName}-${environment}'

resource autoscaleSetting 'Microsoft.Insights/autoscalesettings@2022-10-01' = {
  name: autoscaleSettingName
  location: location
  properties: {
    enabled: true
    targetResourceUri: appServicePlanId
    profiles: [
      {
        name: 'CPU-based autoscale'
        capacity: {
          minimum: string(minCapacity)
          maximum: string(maxCapacity)
          default: string(defaultCapacity)
        }
        rules: [
          {
            metricTrigger: {
              metricName: 'CpuPercentage'
              metricResourceUri: appServicePlanId
              timeGrain: 'PT1M'
              statistic: 'Average'
              timeWindow: 'PT5M'
              timeAggregation: 'Average'
              operator: 'GreaterThan'
              threshold: scaleOutCpuThreshold
            }
            scaleAction: {
              direction: 'Increase'
              type: 'ChangeCount'
              value: '1'
              cooldown: 'PT5M'
            }
          }
          {
            metricTrigger: {
              metricName: 'CpuPercentage'
              metricResourceUri: appServicePlanId
              timeGrain: 'PT1M'
              statistic: 'Average'
              timeWindow: 'PT5M'
              timeAggregation: 'Average'
              operator: 'LessThan'
              threshold: scaleInCpuThreshold
            }
            scaleAction: {
              direction: 'Decrease'
              type: 'ChangeCount'
              value: '1'
              cooldown: 'PT5M'
            }
          }
        ]
      }
    ]
    notifications: [
      {
        operation: 'Scale'
        email: {
          sendToSubscriptionAdministrator: false
          sendToSubscriptionCoAdministrators: false
          customEmails: [
            notificationEmail
          ]
        }
      }
    ]
  }
}

output autoscaleSettingName string = autoscaleSetting.name
