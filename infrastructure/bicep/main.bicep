@description('Location for all resources')
param location string = resourceGroup().location

@description('Environment name (dev, staging, prod)')
param environment string = 'dev'

@description('Application name prefix')
param appNamePrefix string = 'prepbettr'

@description('Function App SKU')
param functionAppSkuName string = 'Y1'

@description('Storage Account SKU')
param storageAccountSkuName string = 'Standard_LRS'

@description('Key Vault SKU')
param keyVaultSkuName string = 'standard'

@description('Azure OpenAI Model deployments')
param openAiDeployments array = [
  {
    name: 'gpt-4'
    model: {
      format: 'OpenAI'
      name: 'gpt-4'
      version: '0613'
    }
    sku: {
      name: 'Standard'
      capacity: 30
    }
  }
  {
    name: 'gpt-35-turbo'
    model: {
      format: 'OpenAI'
      name: 'gpt-35-turbo'
      version: '0125'
    }
    sku: {
      name: 'Standard'
      capacity: 120
    }
  }
]

// Variables
var uniqueSuffix = substring(uniqueString(resourceGroup().id), 0, 6)
var storageAccountName = '${appNamePrefix}${environment}${uniqueSuffix}'
var functionAppName = '${appNamePrefix}-functions-${environment}-${uniqueSuffix}'
var keyVaultName = '${appNamePrefix}-kv-${environment}-${uniqueSuffix}'
var appInsightsName = '${appNamePrefix}-insights-${environment}-${uniqueSuffix}'
var cognitiveServicesName = '${appNamePrefix}-openai-${environment}-${uniqueSuffix}'
var speechServicesName = '${appNamePrefix}-speech-${environment}-${uniqueSuffix}'
var formRecognizerName = '${appNamePrefix}-form-${environment}-${uniqueSuffix}'
var servicePlanName = '${appNamePrefix}-plan-${environment}-${uniqueSuffix}'

// Storage Account
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: storageAccountSkuName
  }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    supportsHttpsTrafficOnly: true
    networkAcls: {
      defaultAction: 'Allow'
    }
  }

  resource blobService 'blobServices' = {
    name: 'default'
    properties: {
      cors: {
        corsRules: [
          {
            allowedHeaders: ['*']
            allowedMethods: ['GET', 'POST', 'PUT']
            allowedOrigins: ['*']
            maxAgeInSeconds: 3600
          }
        ]
      }
    }

    resource resumesContainer 'containers' = {
      name: 'resumes'
      properties: {
        publicAccess: 'None'
      }
    }

    resource audioContainer 'containers' = {
      name: 'audio-recordings'
      properties: {
        publicAccess: 'None'
      }
    }
  }

  resource queueService 'queueServices' = {
    name: 'default'
    
    resource interviewQueue 'queues' = {
      name: 'interview-processing'
    }

    resource feedbackQueue 'queues' = {
      name: 'feedback-generation'
    }
  }
}

// Application Insights
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    Request_Source: 'rest'
    RetentionInDays: 90
    WorkspaceResourceId: logAnalyticsWorkspace.id
  }
}

// Log Analytics Workspace
resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: '${appNamePrefix}-logs-${environment}-${uniqueSuffix}'
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 90
  }
}

// App Service Plan for Functions
resource appServicePlan 'Microsoft.Web/serverfarms@2022-09-01' = {
  name: servicePlanName
  location: location
  sku: {
    name: functionAppSkuName
    tier: functionAppSkuName == 'Y1' ? 'Dynamic' : 'PremiumV3'
  }
  properties: {
    reserved: true
  }
  kind: 'functionapp'
}

// Function App
resource functionApp 'Microsoft.Web/sites@2022-09-01' = {
  name: functionAppName
  location: location
  kind: 'functionapp,linux'
  properties: {
    serverFarmId: appServicePlan.id
    reserved: true
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'NODE|18'
      appSettings: [
        {
          name: 'AzureWebJobsStorage'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};EndpointSuffix=${az.environment().suffixes.storage};AccountKey=${storageAccount.listKeys().keys[0].value}'
        }
        {
          name: 'WEBSITE_CONTENTAZUREFILECONNECTIONSTRING'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};EndpointSuffix=${az.environment().suffixes.storage};AccountKey=${storageAccount.listKeys().keys[0].value}'
        }
        {
          name: 'WEBSITE_CONTENTSHARE'
          value: toLower(functionAppName)
        }
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~18'
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'node'
        }
        {
          name: 'APPINSIGHTS_INSTRUMENTATIONKEY'
          value: appInsights.properties.InstrumentationKey
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsights.properties.ConnectionString
        }
        {
          name: 'AZURE_OPENAI_ENDPOINT'
          value: cognitiveServices.properties.endpoint
        }
        {
          name: 'AZURE_OPENAI_KEY'
          value: '@Microsoft.KeyVault(VaultName=${keyVault.name};SecretName=azure-openai-key)'
        }
        {
          name: 'AZURE_SPEECH_KEY'
          value: '@Microsoft.KeyVault(VaultName=${keyVault.name};SecretName=azure-speech-key)'
        }
        {
          name: 'AZURE_SPEECH_REGION'
          value: location
        }
        {
          name: 'AZURE_FORM_RECOGNIZER_ENDPOINT'
          value: formRecognizer.properties.endpoint
        }
        {
          name: 'AZURE_FORM_RECOGNIZER_KEY'
          value: '@Microsoft.KeyVault(VaultName=${keyVault.name};SecretName=azure-form-recognizer-key)'
        }
        {
          name: 'FIREBASE_PROJECT_ID'
          value: '@Microsoft.KeyVault(VaultName=${keyVault.name};SecretName=firebase-project-id)'
        }
        {
          name: 'FIREBASE_CLIENT_EMAIL'
          value: '@Microsoft.KeyVault(VaultName=${keyVault.name};SecretName=firebase-client-email)'
        }
        {
          name: 'FIREBASE_PRIVATE_KEY'
          value: '@Microsoft.KeyVault(VaultName=${keyVault.name};SecretName=firebase-private-key)'
        }
        {
          name: 'STORAGE_CONNECTION_STRING'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};EndpointSuffix=${az.environment().suffixes.storage};AccountKey=${storageAccount.listKeys().keys[0].value}'
        }
        {
          name: 'KEY_VAULT_NAME'
          value: keyVault.name
        }
        {
          name: 'AZURE_KEY_VAULT_URI'
          value: keyVault.properties.vaultUri
        }
        {
          name: 'ENVIRONMENT'
          value: environment
        }
      ]
      cors: {
        allowedOrigins: [
          'https://portal.azure.com'
          'https://${functionAppName}.azurewebsites.net'
        ]
        supportCredentials: false
      }
      use32BitWorkerProcess: false
      ftpsState: 'FtpsOnly'
      minTlsVersion: '1.2'
    }
  }
  identity: {
    type: 'SystemAssigned'
  }
}

// Azure OpenAI Cognitive Services
resource cognitiveServices 'Microsoft.CognitiveServices/accounts@2023-05-01' = {
  name: cognitiveServicesName
  location: location
  sku: {
    name: 'S0'
  }
  kind: 'OpenAI'
  properties: {
    customSubDomainName: cognitiveServicesName
    networkAcls: {
      defaultAction: 'Allow'
      virtualNetworkRules: []
      ipRules: []
    }
    publicNetworkAccess: 'Enabled'
    disableLocalAuth: false
  }
}

// OpenAI Model Deployments
resource openAiModelDeployments 'Microsoft.CognitiveServices/accounts/deployments@2023-05-01' = [for deployment in openAiDeployments: {
  parent: cognitiveServices
  name: deployment.name
  sku: deployment.sku
  properties: {
    model: deployment.model
    versionUpgradeOption: 'OnceCurrentVersionExpired'
    raiPolicyName: 'Microsoft.Default'
  }
}]

// Azure Speech Services
resource speechServices 'Microsoft.CognitiveServices/accounts@2023-05-01' = {
  name: speechServicesName
  location: location
  sku: {
    name: 'S0'
  }
  kind: 'SpeechServices'
  properties: {
    customSubDomainName: speechServicesName
    networkAcls: {
      defaultAction: 'Allow'
    }
    publicNetworkAccess: 'Enabled'
    disableLocalAuth: false
  }
}

// Azure Form Recognizer
resource formRecognizer 'Microsoft.CognitiveServices/accounts@2023-05-01' = {
  name: formRecognizerName
  location: location
  sku: {
    name: 'S0'
  }
  kind: 'FormRecognizer'
  properties: {
    customSubDomainName: formRecognizerName
    networkAcls: {
      defaultAction: 'Allow'
    }
    publicNetworkAccess: 'Enabled'
    disableLocalAuth: false
  }
}

// Key Vault
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  properties: {
    sku: {
      family: 'A'
      name: keyVaultSkuName
    }
    tenantId: subscription().tenantId
    accessPolicies: [
      {
        tenantId: subscription().tenantId
        objectId: functionApp.identity.principalId
        permissions: {
          keys: []
          secrets: ['get', 'list']
          certificates: []
        }
      }
    ]
    enabledForTemplateDeployment: true
    enableRbacAuthorization: false
    networkAcls: {
      defaultAction: 'Allow'
      bypass: 'AzureServices'
    }
  }

  // Store secrets
  resource azureOpenAiKeySecret 'secrets' = {
    name: 'azure-openai-key'
    properties: {
      value: cognitiveServices.listKeys().key1
    }
  }

  resource azureSpeechKeySecret 'secrets' = {
    name: 'azure-speech-key'
    properties: {
      value: speechServices.listKeys().key1
    }
  }

  resource azureFormRecognizerKeySecret 'secrets' = {
    name: 'azure-form-recognizer-key'
    properties: {
      value: formRecognizer.listKeys().key1
    }
  }

  resource storageConnectionStringSecret 'secrets' = {
    name: 'storage-connection-string'
    properties: {
      value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};EndpointSuffix=${az.environment().suffixes.storage};AccountKey=${storageAccount.listKeys().keys[0].value}'
    }
  }
}

// Action Group for Monitoring
resource actionGroup 'Microsoft.Insights/actionGroups@2023-01-01' = {
  name: '${appNamePrefix}-alerts-${environment}'
  location: 'Global'
  properties: {
    groupShortName: 'PrepBettr'
    enabled: true
    emailReceivers: [
      {
        name: 'AdminEmail'
        emailAddress: 'admin@prepbettr.com'
        useCommonAlertSchema: true
      }
    ]
  }
}

// Metric Alerts
resource functionAppErrorRate 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: '${functionAppName}-error-rate'
  location: 'Global'
  properties: {
    description: 'High error rate in Function App'
    severity: 2
    enabled: true
    scopes: [functionApp.id]
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          threshold: 5
          name: 'ErrorRate'
          metricNamespace: 'Microsoft.Web/sites'
          metricName: 'Http5xx'
          operator: 'GreaterThan'
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

resource cognitiveServicesThrottling 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: '${cognitiveServicesName}-throttling'
  location: 'Global'
  properties: {
    description: 'High throttling rate in Cognitive Services'
    severity: 1
    enabled: true
    scopes: [cognitiveServices.id]
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          threshold: 10
          name: 'ThrottlingRate'
          metricNamespace: 'Microsoft.CognitiveServices/accounts'
          metricName: 'ClientErrors'
          operator: 'GreaterThan'
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

// Outputs
output functionAppName string = functionApp.name
output functionAppUrl string = 'https://${functionApp.properties.defaultHostName}'
output storageAccountName string = storageAccount.name
output keyVaultName string = keyVault.name
output cognitiveServicesEndpoint string = cognitiveServices.properties.endpoint
output speechServicesEndpoint string = speechServices.properties.endpoint
output formRecognizerEndpoint string = formRecognizer.properties.endpoint
output appInsightsInstrumentationKey string = appInsights.properties.InstrumentationKey
output resourceGroupName string = resourceGroup().name
output subscriptionId string = subscription().subscriptionId
output tenantId string = subscription().tenantId
