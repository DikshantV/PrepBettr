// PrepBettr Azure Infrastructure - Main Template
// Provisions Cosmos DB, Blob Storage, Key Vault, and related resources

@description('Environment (dev, staging, prod)')
@allowed(['dev', 'staging', 'prod'])
param environment string = 'dev'

@description('Location for all resources')
param location string = resourceGroup().location

@description('Project name prefix')
param projectName string = 'prepbettr'

@description('Tags to apply to all resources')
param tags object = {
  project: 'PrepBettr'
  environment: environment
  managedBy: 'Infrastructure-as-Code'
  costCenter: 'Engineering'
}

// =============================================================================
// Variables
// =============================================================================

var environmentSuffix = environment == 'prod' ? '' : '-${environment}'
var resourcePrefix = '${projectName}${environmentSuffix}'

// Cosmos DB configuration based on environment
var cosmosDbSettings = {
  dev: {
    throughputPolicy: 'serverless'
    locations: [location]
    consistencyLevel: 'Session'
    enableAutomaticFailover: false
    enableMultipleWriteLocations: false
  }
  staging: {
    throughputPolicy: 'provisioned'
    minThroughput: 400
    maxThroughput: 1000
    locations: [location]
    consistencyLevel: 'Session'
    enableAutomaticFailover: false
    enableMultipleWriteLocations: false
  }
  prod: {
    throughputPolicy: 'provisioned' 
    minThroughput: 1000
    maxThroughput: 10000
    locations: [location, 'East US 2'] // Multi-region for production
    consistencyLevel: 'Session'
    enableAutomaticFailover: true
    enableMultipleWriteLocations: false
  }
}

var currentCosmosSettings = cosmosDbSettings[environment]

// =============================================================================
// Azure Cosmos DB Account
// =============================================================================

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2023-04-15' = {
  name: '${resourcePrefix}-cosmos'
  location: location
  tags: tags
  kind: 'GlobalDocumentDB'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    databaseAccountOfferType: 'Standard'
    consistencyPolicy: {
      defaultConsistencyLevel: currentCosmosSettings.consistencyLevel
    }
    locations: [for loc in currentCosmosSettings.locations: {
      locationName: loc
      failoverPriority: indexOf(currentCosmosSettings.locations, loc)
      isZoneRedundant: environment == 'prod'
    }]
    enableAutomaticFailover: currentCosmosSettings.enableAutomaticFailover
    enableMultipleWriteLocations: currentCosmosSettings.enableMultipleWriteLocations
    enableFreeTier: environment == 'dev'
    capabilities: currentCosmosSettings.throughputPolicy == 'serverless' ? [
      {
        name: 'EnableServerless'
      }
    ] : []
    backupPolicy: {
      type: 'Periodic'
      periodicModeProperties: {
        backupIntervalInMinutes: environment == 'prod' ? 240 : 1440
        backupRetentionIntervalInHours: environment == 'prod' ? 720 : 168
        backupStorageRedundancy: environment == 'prod' ? 'Geo' : 'Local'
      }
    }
    publicNetworkAccess: 'Enabled'
    disableKeyBasedMetadataWriteAccess: false
  }
}

// =============================================================================
// Cosmos DB Database
// =============================================================================

resource cosmosDatabase 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2023-04-15' = {
  parent: cosmosAccount
  name: projectName
  properties: currentCosmosSettings.throughputPolicy == 'serverless' ? {
    resource: {
      id: projectName
    }
  } : {
    resource: {
      id: projectName
    }
    options: {
      throughput: currentCosmosSettings.minThroughput
    }
  }
}

// =============================================================================
// Cosmos DB Containers
// =============================================================================

var containers = [
  {
    name: 'resumes'
    partitionKey: '/userId'
    ttl: -1
    indexingPolicy: {
      automatic: true
      includedPaths: [
        { path: '/userId/?' }
        { path: '/fileName/?' }
        { path: '/processorVersion/?' }
        { path: '/uploadDate/?' }
        { path: '/atsScore/?' }
      ]
    }
  }
  {
    name: 'interviews'
    partitionKey: '/userId'
    ttl: -1
    indexingPolicy: {
      automatic: true
      includedPaths: [
        { path: '/userId/?' }
        { path: '/jobTitle/?' }
        { path: '/company/?' }
        { path: '/createdAt/?' }
        { path: '/finalized/?' }
      ]
    }
  }
  {
    name: 'usage'
    partitionKey: '/userId'
    ttl: -1
    indexingPolicy: {
      automatic: true
      includedPaths: [
        { path: '/userId/?' }
        { path: '/plan/?' }
        { path: '/updatedAt/?' }
      ]
    }
  }
  {
    name: 'userConsents'
    partitionKey: '/userId'
    ttl: -1
    indexingPolicy: {
      automatic: true
      includedPaths: [
        { path: '/userId/?' }
        { path: '/consentDate/?' }
        { path: '/version/?' }
      ]
    }
  }
  {
    name: 'auditLogs'
    partitionKey: '/userId'
    ttl: 7776000 // 90 days
    indexingPolicy: {
      automatic: true
      includedPaths: [
        { path: '/userId/?' }
        { path: '/action/?' }
        { path: '/timestamp/?' }
        { path: '/featureName/?' }
      ]
    }
  }
  {
    name: 'notificationEvents'
    partitionKey: '/userId'
    ttl: 2592000 // 30 days
    indexingPolicy: {
      automatic: true
      includedPaths: [
        { path: '/userId/?' }
        { path: '/type/?' }
        { path: '/status/?' }
        { path: '/createdAt/?' }
      ]
    }
  }
  {
    name: 'payments'
    partitionKey: '/userId'
    ttl: -1
    indexingPolicy: {
      automatic: true
      includedPaths: [
        { path: '/userId/?' }
        { path: '/subscriptionId/?' }
        { path: '/status/?' }
        { path: '/createdAt/?' }
      ]
    }
  }
]

resource cosmosContainers 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = [for container in containers: {
  parent: cosmosDatabase
  name: container.name
  properties: {
    resource: {
      id: container.name
      partitionKey: {
        paths: [container.partitionKey]
        kind: 'Hash'
      }
      defaultTtl: container.ttl
      indexingPolicy: container.indexingPolicy
    }
    options: currentCosmosSettings.throughputPolicy == 'provisioned' ? {
      throughput: 400
    } : {}
  }
}]

// =============================================================================
// Storage Account
// =============================================================================

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: replace('${resourcePrefix}storage', '-', '')
  location: location
  tags: tags
  sku: {
    name: environment == 'prod' ? 'Standard_GRS' : 'Standard_LRS'
  }
  kind: 'StorageV2'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    supportsHttpsTrafficOnly: true
    allowSharedKeyAccess: true
    publicNetworkAccess: 'Enabled'
    accessTier: 'Hot'
    encryption: {
      services: {
        blob: {
          enabled: true
          keyType: 'Account'
        }
        file: {
          enabled: true
          keyType: 'Account'
        }
      }
      keySource: 'Microsoft.Storage'
    }
  }
}

// Storage containers
var storageContainers = [
  {
    name: 'user-resumes'
    publicAccess: 'None'
  }
  {
    name: 'user-documents'
    publicAccess: 'None'
  }
  {
    name: 'processed-files'
    publicAccess: 'None'
  }
  {
    name: 'media-uploads'
    publicAccess: 'None'
  }
]

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-01-01' = {
  parent: storageAccount
  name: 'default'
  properties: {
    deleteRetentionPolicy: {
      enabled: true
      days: environment == 'prod' ? 30 : 7
    }
    containerDeleteRetentionPolicy: {
      enabled: true
      days: environment == 'prod' ? 30 : 7
    }
  }
}

resource storageContainerResources 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = [for container in storageContainers: {
  parent: blobService
  name: container.name
  properties: {
    publicAccess: container.publicAccess
  }
}]

// Lifecycle management policy
resource lifecyclePolicy 'Microsoft.Storage/storageAccounts/managementPolicies@2023-01-01' = {
  parent: storageAccount
  name: 'default'
  properties: {
    policy: {
      rules: [
        {
          name: 'moveToArchive'
          enabled: true
          type: 'Lifecycle'
          definition: {
            filters: {
              blobTypes: ['blockBlob']
              prefixMatch: ['user-documents/']
            }
            actions: {
              baseBlob: {
                tierToCool: {
                  daysAfterModificationGreaterThan: 30
                }
                tierToArchive: {
                  daysAfterModificationGreaterThan: 90
                }
                delete: {
                  daysAfterModificationGreaterThan: 2555 // ~7 years
                }
              }
            }
          }
        }
        {
          name: 'cleanupOldProcessedFiles'
          enabled: true
          type: 'Lifecycle'
          definition: {
            filters: {
              blobTypes: ['blockBlob']
              prefixMatch: ['processed-files/']
            }
            actions: {
              baseBlob: {
                delete: {
                  daysAfterModificationGreaterThan: 365
                }
              }
            }
          }
        }
      ]
    }
  }
}

// =============================================================================
// Key Vault
// =============================================================================

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: '${resourcePrefix}-kv'
  location: location
  tags: tags
  properties: {
    tenantId: tenant().tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    enabledForTemplateDeployment: true
    enabledForDiskEncryption: false
    enabledForDeployment: true
    enableRbacAuthorization: true
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      defaultAction: 'Allow'
      bypass: 'AzureServices'
    }
    softDeleteRetentionInDays: 90
    enableSoftDelete: true
  }
}

// Store connection strings in Key Vault
resource cosmosConnectionStringSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'cosmos-connection-string'
  properties: {
    value: cosmosAccount.listConnectionStrings().connectionStrings[0].connectionString
    contentType: 'connection-string'
    attributes: {
      enabled: true
    }
  }
}

resource storageConnectionStringSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'storage-connection-string'
  properties: {
    value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccount.listKeys().keys[0].value};EndpointSuffix=core.windows.net'
    contentType: 'connection-string'
    attributes: {
      enabled: true
    }
  }
}

resource storageAccountNameSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'storage-account-name'
  properties: {
    value: storageAccount.name
    contentType: 'storage-account-name'
    attributes: {
      enabled: true
    }
  }
}

resource storageAccountKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'storage-account-key'
  properties: {
    value: storageAccount.listKeys().keys[0].value
    contentType: 'storage-account-key'
    attributes: {
      enabled: true
    }
  }
}

// =============================================================================
// Application Insights
// =============================================================================

resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: '${resourcePrefix}-logs'
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: environment == 'prod' ? 90 : 30
  }
}

resource applicationInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${resourcePrefix}-insights'
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalyticsWorkspace.id
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

resource appInsightsConnectionStringSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'application-insights-connection-string'
  properties: {
    value: applicationInsights.properties.ConnectionString
    contentType: 'connection-string'
    attributes: {
      enabled: true
    }
  }
}

// =============================================================================
// RBAC and Security
// =============================================================================

// Get current user/service principal
var currentUser = az.resourceId('Microsoft.ManagedIdentity/userAssignedIdentities', 'current')

// Key Vault access for deployment user/service principal  
resource keyVaultAccessPolicy 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: keyVault
  name: guid(keyVault.id, 'Key Vault Administrator', currentUser)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '00482a5a-887f-4fb3-b363-3b7fe8e74483') // Key Vault Administrator
    principalId: reference(currentUser, '2023-01-31').principalId
    principalType: 'User'
  }
}

// Cosmos DB access for the application (managed identity)
resource cosmosRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: cosmosAccount
  name: guid(cosmosAccount.id, 'DocumentDB Account Contributor')
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '5bd9cd88-fe45-4216-938b-f97437e15450') // DocumentDB Account Contributor
    principalId: cosmosAccount.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// Storage access for the application
resource storageRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: storageAccount
  name: guid(storageAccount.id, 'Storage Blob Data Contributor')
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe') // Storage Blob Data Contributor
    principalId: storageAccount.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// =============================================================================
// Outputs
// =============================================================================

output cosmosAccountName string = cosmosAccount.name
output cosmosAccountEndpoint string = cosmosAccount.properties.documentEndpoint
output cosmosDatabaseName string = cosmosDatabase.name
output cosmosConnectionString string = cosmosAccount.listConnectionStrings().connectionStrings[0].connectionString

output storageAccountName string = storageAccount.name
output storageAccountEndpoint string = storageAccount.properties.primaryEndpoints.blob
output storageConnectionString string = 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccount.listKeys().keys[0].value};EndpointSuffix=core.windows.net'

output keyVaultName string = keyVault.name
output keyVaultUri string = keyVault.properties.vaultUri

output applicationInsightsName string = applicationInsights.name
output applicationInsightsConnectionString string = applicationInsights.properties.ConnectionString
output applicationInsightsInstrumentationKey string = applicationInsights.properties.InstrumentationKey

output resourceGroupName string = resourceGroup().name
output environment string = environment
output location string = location