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

@description('Azure AI Foundry configuration')
param foundryConfig object = {
  projectId: 'prepbettr-interview-agents'
  resourceGroup: 'PrepBettr_group'
  region: 'eastus'
  apiVersion: '2024-02-15-preview'
}

@description('Legacy Azure OpenAI Model deployments (deprecated)')
param legacyOpenAiDeployments array = []

// Variables
var uniqueSuffix = substring(uniqueString(resourceGroup().id), 0, 6)
var storageAccountName = '${appNamePrefix}${environment}${uniqueSuffix}'
var functionAppName = '${appNamePrefix}-functions-${environment}-${uniqueSuffix}'
var keyVaultName = '${appNamePrefix}-kv-${environment}-${uniqueSuffix}'
var appInsightsName = '${appNamePrefix}-insights-${environment}-${uniqueSuffix}'
var foundryServicesName = '${appNamePrefix}-foundry-${environment}-${uniqueSuffix}'
var legacyCognitiveServicesName = '${appNamePrefix}-openai-${environment}-${uniqueSuffix}'
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
          name: 'AZURE_FOUNDRY_ENDPOINT'
          value: '@Microsoft.KeyVault(VaultName=${keyVault.name};SecretName=azure-foundry-endpoint)'
        }
        {
          name: 'AZURE_FOUNDRY_API_KEY'
          value: '@Microsoft.KeyVault(VaultName=${keyVault.name};SecretName=azure-foundry-api-key)'
        }
        {
          name: 'AZURE_FOUNDRY_PROJECT_ID'
          value: foundryConfig.projectId
        }
        {
          name: 'AZURE_FOUNDRY_RESOURCE_GROUP'
          value: foundryConfig.resourceGroup
        }
        {
          name: 'AZURE_FOUNDRY_REGION'
          value: foundryConfig.region
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

// Azure AI Foundry Services (replaces legacy OpenAI)
// Note: Azure AI Foundry resources are managed separately through the Azure AI Studio portal
// This section maintains compatibility for key vault secrets only

// Legacy Azure OpenAI Cognitive Services (deprecated - kept for transition)
resource legacyCognitiveServices 'Microsoft.CognitiveServices/accounts@2023-05-01' = if(length(legacyOpenAiDeployments) > 0) {
  name: legacyCognitiveServicesName
  location: location
  sku: {
    name: 'S0'
  }
  kind: 'OpenAI'
  properties: {
    customSubDomainName: legacyCognitiveServicesName
    networkAcls: {
      defaultAction: 'Allow'
      virtualNetworkRules: []
      ipRules: []
    }
    publicNetworkAccess: 'Enabled'
    disableLocalAuth: false
  }
}

// Legacy OpenAI Model Deployments (deprecated)
resource legacyOpenAiModelDeployments 'Microsoft.CognitiveServices/accounts/deployments@2023-05-01' = [for deployment in legacyOpenAiDeployments: if(length(legacyOpenAiDeployments) > 0) {
  parent: legacyCognitiveServices
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

  // Store secrets for Azure AI Foundry
  resource azureFoundryEndpointSecret 'secrets' = {
    name: 'azure-foundry-endpoint'
    properties: {
      value: 'https://prepbettr-ai-foundry.services.ai.azure.com/'
    }
  }
  
  resource azureFoundryApiKeySecret 'secrets' = {
    name: 'azure-foundry-api-key'
    properties: {
      value: '285fe419a2784fd2bba7f439477a518e' // This should be replaced with actual key
    }
  }

  // Legacy Azure OpenAI key (deprecated)
  resource legacyAzureOpenAiKeySecret 'secrets' = if(length(legacyOpenAiDeployments) > 0) {
    name: 'azure-openai-key-legacy'
    properties: {
      value: legacyCognitiveServices.listKeys().key1
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

// Azure AI Foundry throttling monitoring (resource scope updated)
resource foundryThrottling 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: '${foundryServicesName}-throttling'
  location: 'Global'
  properties: {
    description: 'High throttling rate in Azure AI Foundry Services'
    severity: 1
    enabled: true
    scopes: [resourceGroup().id] // Monitor at resource group level for AI Foundry
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.MultipleResourceMultipleMetricCriteria'
      allOf: [
        {
          threshold: 10
          name: 'ThrottlingRate'
          metricNamespace: 'Microsoft.CognitiveServices/accounts'
          metricName: 'ClientErrors'
          operator: 'GreaterThan'
          timeAggregation: 'Total'
          criterionType: 'StaticThresholdCriterion'
          dimensions: []
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
output foundryEndpoint string = 'https://prepbettr-ai-foundry.services.ai.azure.com/'
output legacyCognitiveServicesEndpoint string = length(legacyOpenAiDeployments) > 0 ? legacyCognitiveServices.properties.endpoint : ''
output speechServicesEndpoint string = speechServices.properties.endpoint
output formRecognizerEndpoint string = formRecognizer.properties.endpoint
output appInsightsInstrumentationKey string = appInsights.properties.InstrumentationKey
output resourceGroupName string = resourceGroup().name
output subscriptionId string = subscription().subscriptionId
output tenantId string = subscription().tenantId
