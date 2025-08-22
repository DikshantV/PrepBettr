// ===================================================
// PrepBettr Azure Infrastructure Optimization
// Main Bicep Template - Orchestrates all optimization modules
// ===================================================

targetScope = 'subscription'

@description('Environment name')
@allowed(['dev', 'staging', 'prod'])
param environment string = 'dev'

@description('Primary Azure region')
param primaryRegion string = 'eastus2'

@description('Secondary region for disaster recovery')
param secondaryRegion string = 'westus2'

@description('Resource naming prefix')
param namePrefix string = 'prepbettr'

@description('Cost budget limit in USD')
param monthlyBudgetLimit int = environment == 'prod' ? 500 : 200

@description('Enable advanced security features')
param enableAdvancedSecurity bool = environment == 'prod'

@description('Enable multi-region deployment')
param enableMultiRegion bool = environment == 'prod'

// ===== VARIABLES =====

var resourceGroupName = '${namePrefix}-${environment}-rg'
var tags = {
  Environment: environment
  Project: 'PrepBettr'
  CostCenter: 'Engineering'
  Owner: 'Platform-Team'
  CreatedBy: 'Bicep-IaC'
  LastDeployed: utcNow('yyyy-MM-dd')
}

// ===== RESOURCE GROUP =====

resource resourceGroup 'Microsoft.Resources/resourceGroups@2021-04-01' = {
  name: resourceGroupName
  location: primaryRegion
  tags: tags
}

// ===== SHARED RESOURCES =====

module keyVault 'modules/security.bicep' = {
  name: 'keyVault-deployment'
  scope: resourceGroup
  params: {
    environment: environment
    namePrefix: namePrefix
    location: primaryRegion
    enableAdvancedSecurity: enableAdvancedSecurity
    tags: tags
  }
}

module networking 'modules/networking.bicep' = if (enableAdvancedSecurity) {
  name: 'networking-deployment'
  scope: resourceGroup
  params: {
    environment: environment
    namePrefix: namePrefix
    location: primaryRegion
    tags: tags
  }
}

// ===== PERFORMANCE OPTIMIZATION MODULES =====

module redis 'modules/redis.bicep' = {
  name: 'redis-deployment'
  scope: resourceGroup
  params: {
    environment: environment
    namePrefix: namePrefix
    location: primaryRegion
    tier: environment == 'prod' ? 'Premium' : 'Standard'
    capacity: environment == 'prod' ? 2 : 1
    enableClustering: environment == 'prod'
    enablePersistence: environment == 'prod'
    subnetId: enableAdvancedSecurity ? networking.outputs.redisSubnetId : null
    tags: tags
  }
}

module cosmos 'modules/cosmos.bicep' = {
  name: 'cosmos-deployment'
  scope: resourceGroup
  params: {
    environment: environment
    namePrefix: namePrefix
    location: primaryRegion
    secondaryRegion: enableMultiRegion ? secondaryRegion : null
    enableMultiRegion: enableMultiRegion
    enableServerlessTier: environment == 'dev'
    maxAutoscaleRU: environment == 'prod' ? 10000 : 4000
    privateEndpointSubnetId: enableAdvancedSecurity ? networking.outputs.cosmosSubnetId : null
    tags: tags
  }
}

module storage 'modules/storage-cdn.bicep' = {
  name: 'storage-deployment'
  scope: resourceGroup
  params: {
    environment: environment
    namePrefix: namePrefix
    location: primaryRegion
    enableCDN: true
    enableAdvancedThreatProtection: enableAdvancedSecurity
    privateEndpointSubnetId: enableAdvancedSecurity ? networking.outputs.storageSubnetId : null
    tags: tags
  }
}

module functions 'modules/functions.bicep' = {
  name: 'functions-deployment'
  scope: resourceGroup
  params: {
    environment: environment
    namePrefix: namePrefix
    location: primaryRegion
    planType: environment == 'prod' ? 'Premium' : 'Consumption'
    preWarmedInstances: environment == 'prod' ? 2 : 0
    vnetIntegrationSubnetId: enableAdvancedSecurity ? networking.outputs.functionsSubnetId : null
    keyVaultName: keyVault.outputs.keyVaultName
    storageAccountName: storage.outputs.storageAccountName
    cosmosDbEndpoint: cosmos.outputs.cosmosDbEndpoint
    redisConnectionString: redis.outputs.connectionString
    tags: tags
  }
}

// ===== COST OPTIMIZATION =====

module costManagement 'modules/cost-management.bicep' = {
  name: 'cost-management-deployment'
  scope: resourceGroup
  params: {
    environment: environment
    monthlyBudgetLimit: monthlyBudgetLimit
    resourceGroupId: resourceGroup.id
    actionGroupName: monitoring.outputs.costAlertActionGroupName
    tags: tags
  }
}

// ===== MONITORING & ALERTING =====

module monitoring 'modules/monitoring.bicep' = {
  name: 'monitoring-deployment'
  scope: resourceGroup
  params: {
    environment: environment
    namePrefix: namePrefix
    location: primaryRegion
    cosmosDbAccountName: cosmos.outputs.cosmosDbAccountName
    redisName: redis.outputs.redisName
    functionAppName: functions.outputs.functionAppName
    storageAccountName: storage.outputs.storageAccountName
    tags: tags
  }
}

// ===== OUTPUTS =====

output resourceGroupName string = resourceGroup.name
output keyVaultName string = keyVault.outputs.keyVaultName
output redisConnectionString string = redis.outputs.connectionString
output cosmosDbEndpoint string = cosmos.outputs.cosmosDbEndpoint
output storageAccountName string = storage.outputs.storageAccountName
output cdnEndpoint string = storage.outputs.cdnEndpoint
output functionAppName string = functions.outputs.functionAppName
output applicationInsightsName string = monitoring.outputs.applicationInsightsName

// Security outputs (for CI/CD pipeline)
output keyVaultUri string = keyVault.outputs.keyVaultUri
output managedIdentityPrincipalId string = functions.outputs.managedIdentityPrincipalId

// Monitoring outputs
output dashboardId string = monitoring.outputs.dashboardId
output costBudgetId string = costManagement.outputs.budgetId
