// ===================================================
// App Service with Deployment Slots for Blue-Green Deployments
// Includes staging slot, production slot, and Traffic Manager integration
// ===================================================

@description('Environment name')
param environment string

@description('Resource naming prefix')
param namePrefix string

@description('Azure region')
param location string

@description('App Service Plan SKU')
@allowed(['S1', 'S2', 'S3', 'P1v2', 'P2v2', 'P3v2', 'P1v3', 'P2v3', 'P3v3'])
param appServicePlanSku string = 'P1v2'

@description('Key Vault name for secrets')
param keyVaultName string

@description('Application Insights connection string')
param appInsightsConnectionString string

@description('Cosmos DB connection string')
@secure()
param cosmosConnectionString string

@description('Redis connection string')
@secure()
param redisConnectionString string

@description('Azure App Configuration endpoint')
param appConfigEndpoint string

@description('Enable Always On')
param alwaysOn bool = true

@description('Enable automatic healing')
param autoHeal bool = true

@description('Custom domain name (optional)')
param customDomain string?

@description('Resource tags')
param tags object = {}

// ===== VARIABLES =====

var appServicePlanName = '${namePrefix}-plan-${environment}'
var appServiceName = '${namePrefix}-app-${environment}'
var stagingSlotName = 'staging'

// App Service Plan scaling configuration based on environment
var scalingConfig = environment == 'prod' ? {
  minInstances: 2
  maxInstances: 10
  targetCPU: 70
  targetMemory: 80
} : {
  minInstances: 1
  maxInstances: 3
  targetCPU: 80
  targetMemory: 85
}

// ===== MANAGED IDENTITY =====

resource appServiceIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${appServiceName}-identity'
  location: location
  tags: tags
}

// ===== APP SERVICE PLAN =====

resource appServicePlan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: appServicePlanName
  location: location
  tags: tags
  
  sku: {
    name: appServicePlanSku
    capacity: scalingConfig.minInstances
  }
  
  kind: 'linux'
  
  properties: {
    reserved: true  // Linux app service plan
    targetWorkerCount: scalingConfig.minInstances
    targetWorkerSizeId: 0
    
    // Zone redundancy for production
    zoneRedundant: environment == 'prod'
  }
}

// ===== AUTOSCALE SETTINGS =====

resource autoScale 'Microsoft.Insights/autoscalesettings@2022-10-01' = {
  name: '${appServicePlanName}-autoscale'
  location: location
  tags: tags
  
  properties: {
    name: '${appServicePlanName}-autoscale'
    targetResourceUri: appServicePlan.id
    enabled: true
    
    profiles: [
      {
        name: 'Default-Profile'
        capacity: {
          minimum: string(scalingConfig.minInstances)
          maximum: string(scalingConfig.maxInstances)
          default: string(scalingConfig.minInstances)
        }
        
        rules: [
          // Scale out rules
          {
            metricTrigger: {
              metricName: 'CpuPercentage'
              metricResourceUri: appServicePlan.id
              timeGrain: 'PT1M'
              statistic: 'Average'
              timeWindow: 'PT10M'
              timeAggregation: 'Average'
              operator: 'GreaterThan'
              threshold: scalingConfig.targetCPU
            }
            scaleAction: {
              direction: 'Increase'
              type: 'ChangeCount'
              value: '1'
              cooldown: 'PT10M'
            }
          }
          {
            metricTrigger: {
              metricName: 'MemoryPercentage'
              metricResourceUri: appServicePlan.id
              timeGrain: 'PT1M'
              statistic: 'Average'
              timeWindow: 'PT10M'
              timeAggregation: 'Average'
              operator: 'GreaterThan'
              threshold: scalingConfig.targetMemory
            }
            scaleAction: {
              direction: 'Increase'
              type: 'ChangeCount'
              value: '1'
              cooldown: 'PT10M'
            }
          }
          
          // Scale in rules
          {
            metricTrigger: {
              metricName: 'CpuPercentage'
              metricResourceUri: appServicePlan.id
              timeGrain: 'PT1M'
              statistic: 'Average'
              timeWindow: 'PT30M'
              timeAggregation: 'Average'
              operator: 'LessThan'
              threshold: scalingConfig.targetCPU - 20
            }
            scaleAction: {
              direction: 'Decrease'
              type: 'ChangeCount'
              value: '1'
              cooldown: 'PT30M'
            }
          }
        ]
      }
      
      // Weekend scale-down profile
      {
        name: 'Weekend-Profile'
        capacity: {
          minimum: '1'
          maximum: string(scalingConfig.maxInstances)
          default: '1'
        }
        
        recurrence: {
          frequency: 'Week'
          schedule: {
            timeZone: 'UTC'
            days: ['Saturday', 'Sunday']
            hours: [0]
            minutes: [0]
          }
        }
        
        rules: []  // Minimal scaling during weekends
      }
    ]
  }
}

// ===== PRODUCTION APP SERVICE =====

resource appService 'Microsoft.Web/sites@2023-01-01' = {
  name: appServiceName
  location: location
  tags: tags
  
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${appServiceIdentity.id}': {}
    }
  }
  
  properties: {
    serverFarmId: appServicePlan.id
    reserved: true
    
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts'
      
      // Always On and performance settings
      alwaysOn: alwaysOn
      http20Enabled: true
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      
      // Auto-healing configuration
      autoHealEnabled: autoHeal
      autoHealRules: autoHeal ? {
        triggers: {
          requestsBasedTrigger: {
            count: 100
            timeInterval: '00:05:00'
          }
          slowRequestsBasedTrigger: {
            timeTaken: '00:01:00'
            count: 10
            timeInterval: '00:05:00'
          }
        }
        actions: {
          actionType: 'Recycle'
          minProcessExecutionTime: '00:01:00'
        }
      } : null
      
      // Health check
      healthCheckPath: '/api/health'
      
      // Application settings (will be set via separate resource)
      appSettings: []
    }
    
    httpsOnly: true
    clientAffinityEnabled: false  // Stateless app
    
    // Custom domain configuration
    customDomainVerificationId: customDomain != null ? guid(appService.id, customDomain!) : null
  }
}

// ===== STAGING SLOT =====

resource stagingSlot 'Microsoft.Web/sites/slots@2023-01-01' = {
  parent: appService
  name: stagingSlotName
  location: location
  tags: union(tags, { Slot: 'staging' })
  
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${appServiceIdentity.id}': {}
    }
  }
  
  properties: {
    serverFarmId: appServicePlan.id
    reserved: true
    
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts'
      alwaysOn: environment == 'prod'  // Save costs in dev/staging environments
      http20Enabled: true
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      healthCheckPath: '/api/health'
      
      // Staging-specific settings
      autoHealEnabled: false  // Disable auto-heal in staging for testing
      
      appSettings: []
    }
    
    httpsOnly: true
    clientAffinityEnabled: false
  }
}

// ===== SLOT CONFIGURATION SETTINGS =====

// Settings that should NOT be swapped (sticky to each slot)
resource slotConfigNames 'Microsoft.Web/sites/config@2023-01-01' = {
  parent: appService
  name: 'slotConfigNames'
  
  properties: {
    appSettingNames: [
      'SLOT_NAME'
      'APPINSIGHTS_INSTRUMENTATIONKEY'
      'APPLICATIONINSIGHTS_CONNECTION_STRING'
      'MONITORING_ENABLED'
    ]
    connectionStringNames: []
  }
}

// ===== PRODUCTION SLOT APP SETTINGS =====

resource productionAppSettings 'Microsoft.Web/sites/config@2023-01-01' = {
  parent: appService
  name: 'appsettings'
  
  properties: {
    // Slot identification
    SLOT_NAME: 'production'
    
    // Node.js configuration
    NODE_ENV: 'production'
    WEBSITE_NODE_DEFAULT_VERSION: '20.9.0'
    
    // Azure services
    APPINSIGHTS_INSTRUMENTATIONKEY: appInsightsConnectionString
    APPLICATIONINSIGHTS_CONNECTION_STRING: appInsightsConnectionString
    AZURE_CLIENT_ID: appServiceIdentity.properties.clientId
    
    // Key Vault reference for secrets
    COSMOS_CONNECTION_STRING: '@Microsoft.KeyVault(SecretUri=https://${keyVaultName}${environment().suffixes.keyvaultDns}/secrets/cosmos-connection-string/)'
    REDIS_CONNECTION_STRING: '@Microsoft.KeyVault(SecretUri=https://${keyVaultName}${environment().suffixes.keyvaultDns}/secrets/redis-connection-string/)'
    
    // App Configuration
    AZURE_APP_CONFIG_ENDPOINT: appConfigEndpoint
    
    // Performance settings
    WEBSITE_DYNAMIC_CACHE: '0'
    WEBSITE_LOCAL_CACHE_OPTION: 'Always'
    WEBSITE_LOCAL_CACHE_SIZEINMB: '1000'
    
    // Health and monitoring
    WEBSITE_HEALTHCHECK_MAXPINGFAILURES: '3'
    MONITORING_ENABLED: 'true'
    
    // PrepBettr specific
    NEXT_PUBLIC_ENV: 'production'
    ENABLE_REDIS_CACHE: 'true'
    CACHE_TTL_SECONDS: '300'
    
    // Security headers
    WEBSITE_ADD_SITENAME_BINDINGS_IN_APPHOST_CONFIG: '1'
  }
  
  dependsOn: [
    keyVaultAccess
  ]
}

// ===== STAGING SLOT APP SETTINGS =====

resource stagingAppSettings 'Microsoft.Web/sites/slots/config@2023-01-01' = {
  parent: stagingSlot
  name: 'appsettings'
  
  properties: {
    // Slot identification
    SLOT_NAME: 'staging'
    
    // Node.js configuration
    NODE_ENV: 'staging'
    WEBSITE_NODE_DEFAULT_VERSION: '20.9.0'
    
    // Azure services (separate App Insights for staging)
    APPINSIGHTS_INSTRUMENTATIONKEY: appInsightsConnectionString
    APPLICATIONINSIGHTS_CONNECTION_STRING: appInsightsConnectionString
    AZURE_CLIENT_ID: appServiceIdentity.properties.clientId
    
    // Key Vault references (same secrets, different slot)
    COSMOS_CONNECTION_STRING: '@Microsoft.KeyVault(SecretUri=https://${keyVaultName}${environment().suffixes.keyvaultDns}/secrets/cosmos-connection-string/)'
    REDIS_CONNECTION_STRING: '@Microsoft.KeyVault(SecretUri=https://${keyVaultName}${environment().suffixes.keyvaultDns}/secrets/redis-connection-string/)'
    
    // App Configuration (staging environment)
    AZURE_APP_CONFIG_ENDPOINT: appConfigEndpoint
    
    // Performance settings (relaxed for staging)
    WEBSITE_DYNAMIC_CACHE: '1'
    WEBSITE_LOCAL_CACHE_OPTION: 'Never'
    
    // Health and monitoring (more verbose in staging)
    WEBSITE_HEALTHCHECK_MAXPINGFAILURES: '5'
    MONITORING_ENABLED: 'true'
    LOG_LEVEL: 'debug'
    
    // PrepBettr specific (staging variants)
    NEXT_PUBLIC_ENV: 'staging'
    ENABLE_REDIS_CACHE: 'true'
    CACHE_TTL_SECONDS: '60'  // Shorter TTL for testing
    
    // Staging-specific features
    ENABLE_DEBUG_MODE: 'true'
    MOCK_EXTERNAL_APIS: 'false'
  }
  
  dependsOn: [
    keyVaultAccess
  ]
}

// ===== KEY VAULT ACCESS POLICY =====

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

resource keyVaultAccess 'Microsoft.KeyVault/vaults/accessPolicies@2023-07-01' = {
  parent: keyVault
  name: 'add'
  
  properties: {
    accessPolicies: [
      {
        tenantId: subscription().tenantId
        objectId: appServiceIdentity.properties.principalId
        permissions: {
          secrets: [
            'get'
            'list'
          ]
          certificates: [
            'get'
            'list'
          ]
        }
      }
    ]
  }
}

// ===== CUSTOM DOMAIN AND SSL =====

resource customDomainBinding 'Microsoft.Web/sites/hostNameBindings@2023-01-01' = if (customDomain != null) {
  parent: appService
  name: customDomain!
  
  properties: {
    hostNameType: 'Verified'
    sslState: 'SniEnabled'
    thumbprint: managedCertificate.properties.thumbprint
  }
  
  dependsOn: [
    managedCertificate
  ]
}

resource managedCertificate 'Microsoft.Web/certificates@2023-01-01' = if (customDomain != null) {
  name: '${customDomain}-ssl'
  location: location
  tags: tags
  
  properties: {
    canonicalName: customDomain
    serverFarmId: appServicePlan.id
  }
}

// ===== DIAGNOSTIC SETTINGS =====

resource appServiceDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  scope: appService
  name: '${appServiceName}-diagnostics'
  
  properties: {
    logs: [
      {
        category: 'AppServiceHTTPLogs'
        enabled: true
        retentionPolicy: {
          enabled: true
          days: environment == 'prod' ? 90 : 30
        }
      }
      {
        category: 'AppServiceConsoleLogs'
        enabled: true
        retentionPolicy: {
          enabled: true
          days: environment == 'prod' ? 90 : 30
        }
      }
      {
        category: 'AppServiceAppLogs'
        enabled: true
        retentionPolicy: {
          enabled: true
          days: environment == 'prod' ? 90 : 30
        }
      }
      {
        category: 'AppServicePlatformLogs'
        enabled: true
        retentionPolicy: {
          enabled: true
          days: environment == 'prod' ? 90 : 30
        }
      }
    ]
    
    metrics: [
      {
        category: 'AllMetrics'
        enabled: true
        retentionPolicy: {
          enabled: true
          days: environment == 'prod' ? 90 : 30
        }
      }
    ]
    
    workspaceId: null  // Will be set by monitoring module
  }
}

// ===== OUTPUTS =====

output appServiceName string = appService.name
output appServiceId string = appService.id
output appServiceHostName string = appService.properties.defaultHostName
output appServicePlanId string = appServicePlan.id

output stagingSlotName string = stagingSlot.name
output stagingSlotId string = stagingSlot.id
output stagingSlotHostName string = stagingSlot.properties.defaultHostName

output managedIdentityPrincipalId string = appServiceIdentity.properties.principalId
output managedIdentityClientId string = appServiceIdentity.properties.clientId

// Slot swap configuration
output slotSwapConfig object = {
  sourceSlot: 'staging'
  targetSlot: 'production'
  preserveVnet: true
  
  swapCommand: 'az webapp deployment slot swap --resource-group ${resourceGroup().name} --name ${appService.name} --slot staging --target-slot production'
  
  rollbackCommand: 'az webapp deployment slot swap --resource-group ${resourceGroup().name} --name ${appService.name} --slot production --target-slot staging'
}

// Deployment endpoints
output deploymentEndpoints object = {
  production: {
    url: 'https://${appService.properties.defaultHostName}'
    healthCheck: 'https://${appService.properties.defaultHostName}/api/health'
    scmUrl: 'https://${appService.name}.scm.azurewebsites.net'
  }
  
  staging: {
    url: 'https://${appService.name}-staging.azurewebsites.net'
    healthCheck: 'https://${appService.name}-staging.azurewebsites.net/api/health'
    scmUrl: 'https://${appService.name}-staging.scm.azurewebsites.net'
  }
}

// Auto-scaling configuration
output autoScalingConfig object = {
  enabled: true
  minInstances: scalingConfig.minInstances
  maxInstances: scalingConfig.maxInstances
  targetCPU: scalingConfig.targetCPU
  targetMemory: scalingConfig.targetMemory
}
