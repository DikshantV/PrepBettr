@description('Name of the Azure Function App')
param functionAppName string = 'prepbettr-functions'

@description('Resource group location')
param location string = resourceGroup().location

@description('Environment name')
@allowed(['production', 'staging', 'development'])
param environment string = 'production'

@description('Function App service plan SKU')
@allowed(['EP1', 'EP2', 'EP3', 'Y1'])
param functionAppSku string = 'EP1'

@description('Minimum number of instances for Premium plan')
param minimumInstances int = 1

@description('Pre-warmed instances for Premium plan')
param preWarmedInstances int = 1

@description('Maximum number of instances')
param maximumInstances int = 20

@description('Tags to apply to resources')
param tags object = {
  environment: environment
  project: 'prepbettr'
  component: 'auto-apply-functions'
}

// Reference to existing Function App
resource functionApp 'Microsoft.Web/sites@2022-03-01' existing = {
  name: functionAppName
}

// Reference to existing App Service Plan
resource appServicePlan 'Microsoft.Web/serverfarms@2022-03-01' existing = {
  name: functionApp.properties.serverFarmId
}

// Update App Service Plan to Premium (EP1) if not already
resource updatedAppServicePlan 'Microsoft.Web/serverfarms@2022-03-01' = if (functionAppSku != 'Y1') {
  name: appServicePlan.name
  location: location
  tags: tags
  sku: {
    name: functionAppSku
    tier: 'ElasticPremium'
    size: functionAppSku
    family: 'EP'
    capacity: minimumInstances
  }
  properties: {
    maximumElasticWorkerCount: maximumInstances
    reserved: false
    isSpot: false
    targetWorkerCount: minimumInstances
    targetWorkerSizeId: 0
  }
  kind: 'elastic'
}

// Configure Function App settings for production
resource functionAppConfig 'Microsoft.Web/sites/config@2022-03-01' = {
  name: 'appsettings'
  parent: functionApp
  properties: {
    // Existing settings (preserve these)
    FUNCTIONS_EXTENSION_VERSION: '~4'
    FUNCTIONS_WORKER_RUNTIME: 'node'
    WEBSITE_NODE_DEFAULT_VERSION: '~20'
    
    // Performance and scaling settings
    WEBSITE_MEMORY_LIMIT_MB: '1536'
    WEBSITE_MAX_DYNAMIC_APPLICATION_SCALE_OUT: '${maximumInstances}'
    WEBSITE_MIN_TLS_VERSION: '1.2'
    WEBSITE_USE_PLACEHOLDER: '1'
    WEBSITE_PLACEHOLDER_MODE: 'generalized'
    
    // Browser automation optimizations
    PLAYWRIGHT_BROWSERS_PATH: '/tmp/browsers'
    BROWSER_MEMORY_LIMIT: '1024'
    MAX_CONCURRENT_BROWSERS: '5'
    BROWSER_TIMEOUT_MS: '300000'
    
    // Queue processing settings
    AZURE_FUNCTIONS_QUEUE_BATCH_SIZE: '8'
    AZURE_FUNCTIONS_QUEUE_MAX_DEQUEUE_COUNT: '3'
    AZURE_FUNCTIONS_QUEUE_VISIBILITY_TIMEOUT: '00:02:00'
    
    // Monitoring and health checks
    APPINSIGHTS_SAMPLE_RATE: '100'
    WEBSITE_ENABLE_SYNC_UPDATE_SITE: '1'
    WEBSITE_HEALTH_CHECK_MAXPINGFAILURES: '3'
    WEBSITE_HEALTHCHECK_MAXUNHEALTHYWORKERPERCENT: '25'
    
    // Auto-Apply specific settings
    AUTO_APPLY_MAX_RETRIES: '2'
    AUTO_APPLY_TIMEOUT_MS: '600000'
    AUTO_APPLY_CONCURRENT_LIMIT: '5'
    
    // Environment-specific settings
    NODE_ENV: environment
    ENVIRONMENT: environment
  }
}

// Configure scaling rules for queue-based scaling
resource autoScaleSettings 'Microsoft.Insights/autoscalesettings@2022-10-01' = {
  name: '${functionAppName}-autoscale'
  location: location
  tags: tags
  properties: {
    enabled: true
    targetResourceUri: functionApp.id
    profiles: [
      {
        name: 'Default-Profile'
        capacity: {
          minimum: '${minimumInstances}'
          maximum: '${maximumInstances}'
          default: '${minimumInstances}'
        }
        rules: [
          {
            metricTrigger: {
              metricName: 'QueueLength'
              metricResourceUri: functionApp.id
              timeGrain: 'PT1M'
              statistic: 'Average'
              timeWindow: 'PT5M'
              timeAggregation: 'Average'
              operator: 'GreaterThan'
              threshold: 20
              dimensions: []
              dividePerInstance: false
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
              metricName: 'QueueLength'
              metricResourceUri: functionApp.id
              timeGrain: 'PT1M'
              statistic: 'Average'
              timeWindow: 'PT10M'
              timeAggregation: 'Average'
              operator: 'LessThan'
              threshold: 5
              dimensions: []
              dividePerInstance: false
            }
            scaleAction: {
              direction: 'Decrease'
              type: 'ChangeCount'
              value: '1'
              cooldown: 'PT10M'
            }
          }
          {
            metricTrigger: {
              metricName: 'CpuPercentage'
              metricResourceUri: functionApp.id
              timeGrain: 'PT1M'
              statistic: 'Average'
              timeWindow: 'PT10M'
              timeAggregation: 'Average'
              operator: 'GreaterThan'
              threshold: 80
              dimensions: []
              dividePerInstance: false
            }
            scaleAction: {
              direction: 'Increase'
              type: 'ChangeCount'
              value: '2'
              cooldown: 'PT5M'
            }
          }
          {
            metricTrigger: {
              metricName: 'MemoryPercentage'
              metricResourceUri: functionApp.id
              timeGrain: 'PT1M'
              statistic: 'Average'
              timeWindow: 'PT10M'
              timeAggregation: 'Average'
              operator: 'GreaterThan'
              threshold: 85
              dimensions: []
              dividePerInstance: false
            }
            scaleAction: {
              direction: 'Increase'
              type: 'ChangeCount'
              value: '2'
              cooldown: 'PT5M'
            }
          }
        ]
      }
      {
        name: 'High-Load-Profile'
        capacity: {
          minimum: '3'
          maximum: '${maximumInstances}'
          default: '3'
        }
        rules: [
          {
            metricTrigger: {
              metricName: 'QueueLength'
              metricResourceUri: functionApp.id
              timeGrain: 'PT1M'
              statistic: 'Average'
              timeWindow: 'PT3M'
              timeAggregation: 'Average'
              operator: 'GreaterThan'
              threshold: 50
              dimensions: []
              dividePerInstance: false
            }
            scaleAction: {
              direction: 'Increase'
              type: 'ChangeCount'
              value: '3'
              cooldown: 'PT3M'
            }
          }
        ]
        recurrence: {
          frequency: 'Week'
          schedule: {
            timeZone: 'UTC'
            days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
            hours: [9, 10, 11, 12, 13, 14, 15, 16]
            minutes: [0]
          }
        }
      }
    ]
    notifications: []
  }
}

// Configure Always On and other site configuration
resource siteConfig 'Microsoft.Web/sites/config@2022-03-01' = {
  name: 'web'
  parent: functionApp
  properties: {
    alwaysOn: functionAppSku != 'Y1' // Only enable Always On for Premium plans
    preWarmedInstanceCount: preWarmedInstances
    minimumElasticInstanceCount: minimumInstances
    functionAppScaleLimit: maximumInstances
    
    // HTTP settings
    http20Enabled: true
    minTlsVersion: '1.2'
    ftpsState: 'Disabled'
    
    // Monitoring and diagnostics
    httpLoggingEnabled: true
    logsDirectorySizeLimit: 35
    detailedErrorLoggingEnabled: true
    requestTracingEnabled: true
    remoteDebuggingEnabled: false
    
    // Node.js specific settings
    nodeVersion: '~20'
    
    // Auto-heal configuration
    autoHealEnabled: true
    autoHealRules: {
      triggers: {
        requests: {
          count: 100
          timeInterval: '00:01:00'
        }
        privateBytesInKB: 1572864 // 1.5GB in KB
        statusCodes: [
          {
            status: 500
            subStatus: 0
            win32Status: 0
            count: 10
            timeInterval: '00:05:00'
          }
        ]
      }
      actions: {
        actionType: 'Recycle'
        minProcessExecutionTime: '00:01:00'
      }
    }
    
    // CORS settings for development (restrict in production)
    cors: {
      allowedOrigins: environment == 'production' ? ['https://prepbettr.com'] : ['*']
      supportCredentials: false
    }
  }
}

// Create deployment script for Azure CLI commands
resource deploymentScript 'Microsoft.Resources/deploymentScripts@2020-10-01' = {
  name: '${functionAppName}-scaling-config'
  location: location
  tags: tags
  kind: 'AzureCLI'
  properties: {
    azCliVersion: '2.50.0'
    timeout: 'PT30M'
    retentionInterval: 'P1D'
    scriptContent: '''
      # Set additional function app settings that aren't supported in Bicep
      az functionapp config appsettings set \
        --name ${functionAppName} \
        --resource-group ${resourceGroup().name} \
        --settings \
        "WEBSITE_MEMORY_LIMIT_MB=1536" \
        "PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1" \
        "BROWSER_EXECUTABLE_PATH=/tmp/browsers/chromium/chrome"
      
      # Configure health check endpoint
      az functionapp config set \
        --name ${functionAppName} \
        --resource-group ${resourceGroup().name} \
        --generic-configurations '{"healthCheckPath": "/api/health"}'
      
      # Enable Application Insights profiler
      az monitor app-insights component update \
        --app prepbettr-insights \
        --resource-group ${resourceGroup().name} \
        --enable-profiler true
      
      echo "Function app scaling configuration completed successfully"
    '''
    cleanupPreference: 'OnSuccess'
  }
}

// Output configuration details
output functionAppId string = functionApp.id
output appServicePlanId string = appServicePlan.id
output autoscaleSettingsId string = autoScaleSettings.id
output scalingConfiguration object = {
  sku: functionAppSku
  minimumInstances: minimumInstances
  maximumInstances: maximumInstances
  preWarmedInstances: preWarmedInstances
  memoryLimit: 1536
  maxConcurrentBrowsers: 5
}

// Rollback commands for documentation
output rollbackCommands array = [
  'az functionapp plan update --name ${appServicePlan.name} --resource-group ${resourceGroup().name} --sku Y1'
  'az functionapp config appsettings delete --name ${functionAppName} --resource-group ${resourceGroup().name} --setting-names WEBSITE_MEMORY_LIMIT_MB'
  'az monitor autoscale delete --name ${functionAppName}-autoscale --resource-group ${resourceGroup().name}'
]
