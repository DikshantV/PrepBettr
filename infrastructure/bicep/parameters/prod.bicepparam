using '../main.bicep'

param environment = 'prod'
param appNamePrefix = 'prepbettr'
param location = 'eastus'
param functionAppSkuName = 'EP1'
param storageAccountSkuName = 'Standard_ZRS'
param keyVaultSkuName = 'premium'
param openAiDeployments = [
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
