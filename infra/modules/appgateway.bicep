@description('Location for all resources')
param location string = resourceGroup().location

@description('Environment name (dev, prod)')
param environment string

@description('Project name')
param projectName string

@description('Subnet ID for the Application Gateway')
param subnetId string

@description('Backend App Service FQDN')
param backendFqdn string

@description('Health probe path')
param healthProbePath string = '/health'

@description('Rate limit requests per minute per IP (0 = disabled)')
param rateLimitRequestsPerMinute int = 100

@description('Blocked country codes (ISO 3166-1 alpha-2), e.g. ["CN","RU"]')
param blockedCountryCodes array = []

@secure()
@description('Base64-encoded PFX SSL certificate for HTTPS')
param sslCertificateData string

@secure()
@description('Password for the PFX SSL certificate')
param sslCertificatePassword string

var appGatewayName = 'appgw-${projectName}-${environment}'
var publicIpName = 'pip-appgw-${projectName}-${environment}'
var dnsLabel = 'appgw-${projectName}-${environment}'
var wafPolicyName = 'wafpol-${projectName}-${environment}'

resource publicIp 'Microsoft.Network/publicIPAddresses@2024-05-01' = {
  name: publicIpName
  location: location
  sku: {
    name: 'Standard'
    tier: 'Regional'
  }
  properties: {
    publicIPAllocationMethod: 'Static'
    dnsSettings: {
      domainNameLabel: dnsLabel
    }
  }
}

// WAF Policy with custom rules (rate limiting, geo-filtering)
resource wafPolicy 'Microsoft.Network/ApplicationGatewayWebApplicationFirewallPolicies@2024-05-01' = {
  name: wafPolicyName
  location: location
  properties: {
    policySettings: {
      requestBodyCheck: true
      maxRequestBodySizeInKb: 128
      fileUploadLimitInMb: 100
      state: 'Enabled'
      mode: 'Prevention'
    }
    managedRules: {
      managedRuleSets: [
        {
          ruleSetType: 'OWASP'
          ruleSetVersion: '3.2'
        }
      ]
    }
    customRules: concat(rateLimitRequestsPerMinute > 0 ? [
        {
          name: 'RateLimitPerIP'
          priority: 10
          ruleType: 'RateLimitRule'
          rateLimitDuration: 'OneMin'
          rateLimitThreshold: rateLimitRequestsPerMinute
          matchConditions: [
            {
              matchVariables: [
                {
                  variableName: 'RemoteAddr'
                }
              ]
              operator: 'IPMatch'
              negationConditon: true
              matchValues: [
                '127.0.0.1'
              ]
            }
          ]
          groupByUserSession: [
            {
              groupByVariables: [
                {
                  variableName: 'ClientAddr'
                }
              ]
            }
          ]
          action: 'Block'
        }
      ] : [], !empty(blockedCountryCodes) ? [
        {
          name: 'GeoFilter'
          priority: 20
          ruleType: 'MatchRule'
          matchConditions: [
            {
              matchVariables: [
                {
                  variableName: 'RemoteAddr'
                }
              ]
              operator: 'GeoMatch'
              matchValues: blockedCountryCodes
            }
          ]
          action: 'Block'
        }
      ] : [], [
        {
          name: 'BlockBadBots'
          priority: 30
          ruleType: 'MatchRule'
          matchConditions: [
            {
              matchVariables: [
                {
                  variableName: 'RequestHeaders'
                  selector: 'User-Agent'
                }
              ]
              operator: 'Contains'
              transforms: ['Lowercase']
              matchValues: [
                'sqlmap'
                'nikto'
                'nmap'
                'masscan'
                'dirbuster'
              ]
            }
          ]
          action: 'Block'
        }
      ])
  }
}

resource appGateway 'Microsoft.Network/applicationGateways@2024-05-01' = {
  name: appGatewayName
  location: location
  properties: {
    sku: {
      name: 'WAF_v2'
      tier: 'WAF_v2'
      capacity: 1
    }
    gatewayIPConfigurations: [
      {
        name: 'gatewayIpConfig'
        properties: {
          subnet: {
            id: subnetId
          }
        }
      }
    ]
    frontendIPConfigurations: [
      {
        name: 'frontendIpConfig'
        properties: {
          publicIPAddress: {
            id: publicIp.id
          }
        }
      }
    ]
    sslCertificates: [
      {
        name: 'appGatewaySslCert'
        properties: {
          data: sslCertificateData
          password: sslCertificatePassword
        }
      }
    ]
    frontendPorts: [
      {
        name: 'httpPort'
        properties: {
          port: 80
        }
      }
      {
        name: 'httpsPort'
        properties: {
          port: 443
        }
      }
    ]
    backendAddressPools: [
      {
        name: 'backendPool'
        properties: {
          backendAddresses: [
            {
              fqdn: backendFqdn
            }
          ]
        }
      }
    ]
    backendHttpSettingsCollection: [
      {
        name: 'backendHttpSettings'
        properties: {
          port: 443
          protocol: 'Https'
          cookieBasedAffinity: 'Disabled'
          pickHostNameFromBackendAddress: true
          requestTimeout: 30
          probe: {
            id: resourceId('Microsoft.Network/applicationGateways/probes', appGatewayName, 'healthProbe')
          }
        }
      }
    ]
    httpListeners: [
      {
        name: 'httpListener'
        properties: {
          frontendIPConfiguration: {
            id: resourceId('Microsoft.Network/applicationGateways/frontendIPConfigurations', appGatewayName, 'frontendIpConfig')
          }
          frontendPort: {
            id: resourceId('Microsoft.Network/applicationGateways/frontendPorts', appGatewayName, 'httpPort')
          }
          protocol: 'Http'
        }
      }
      {
        name: 'httpsListener'
        properties: {
          frontendIPConfiguration: {
            id: resourceId('Microsoft.Network/applicationGateways/frontendIPConfigurations', appGatewayName, 'frontendIpConfig')
          }
          frontendPort: {
            id: resourceId('Microsoft.Network/applicationGateways/frontendPorts', appGatewayName, 'httpsPort')
          }
          protocol: 'Https'
          sslCertificate: {
            id: resourceId('Microsoft.Network/applicationGateways/sslCertificates', appGatewayName, 'appGatewaySslCert')
          }
        }
      }
    ]
    redirectConfigurations: [
      {
        name: 'httpToHttpsRedirect'
        properties: {
          redirectType: 'Permanent'
          targetListener: {
            id: resourceId('Microsoft.Network/applicationGateways/httpListeners', appGatewayName, 'httpsListener')
          }
          includePath: true
          includeQueryString: true
        }
      }
    ]
    requestRoutingRules: [
      {
        name: 'httpsRoutingRule'
        properties: {
          priority: 100
          ruleType: 'Basic'
          httpListener: {
            id: resourceId('Microsoft.Network/applicationGateways/httpListeners', appGatewayName, 'httpsListener')
          }
          backendAddressPool: {
            id: resourceId('Microsoft.Network/applicationGateways/backendAddressPools', appGatewayName, 'backendPool')
          }
          backendHttpSettings: {
            id: resourceId('Microsoft.Network/applicationGateways/backendHttpSettingsCollection', appGatewayName, 'backendHttpSettings')
          }
        }
      }
      {
        name: 'httpRedirectRule'
        properties: {
          priority: 200
          ruleType: 'Basic'
          httpListener: {
            id: resourceId('Microsoft.Network/applicationGateways/httpListeners', appGatewayName, 'httpListener')
          }
          redirectConfiguration: {
            id: resourceId('Microsoft.Network/applicationGateways/redirectConfigurations', appGatewayName, 'httpToHttpsRedirect')
          }
        }
      }
    ]
    probes: [
      {
        name: 'healthProbe'
        properties: {
          protocol: 'Https'
          path: healthProbePath
          interval: 30
          timeout: 30
          unhealthyThreshold: 3
          pickHostNameFromBackendHttpSettings: true
          minServers: 0
          match: {
            statusCodes: [
              '200-399'
            ]
          }
        }
      }
    ]
    firewallPolicy: {
      id: wafPolicy.id
    }
  }
}

output appGatewayName string = appGateway.name
output appGatewayId string = appGateway.id
output publicIpAddress string = publicIp.properties.ipAddress
output publicIpFqdn string = publicIp.properties.dnsSettings.fqdn
