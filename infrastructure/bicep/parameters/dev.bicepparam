using '../main.bicep'

param environment = 'dev'
param appNamePrefix = 'prepbettr'
param location = 'eastus'
param functionAppSkuName = 'Y1'
param storageAccountSkuName = 'Standard_LRS'
param keyVaultSkuName = 'standard'
param openAiDeployments = [
  {
    name: 'gpt-35-turbo'
    model: {
      format: 'OpenAI'
      name: 'gpt-35-turbo'
      version: '0125'
    }
    sku: {
      name: 'Standard'
      capacity: 50
    }
  }
]
