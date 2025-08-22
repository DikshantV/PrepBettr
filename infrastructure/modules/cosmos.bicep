// ===================================================
// Azure Cosmos DB - Optimized with Autoscale & Indexing
// Includes partition strategy, custom indexing & private endpoints
// ===================================================

@description('Environment name')
param environment string

@description('Resource naming prefix')
param namePrefix string

@description('Primary Azure region')
param location string

@description('Secondary region for multi-region setup')
param secondaryRegion string?

@description('Enable multi-region writes')
param enableMultiRegion bool = false

@description('Enable serverless tier for development')
param enableServerlessTier bool = false

@description('Maximum autoscale RU/s')
@minValue(400)
@maxValue(100000)
param maxAutoscaleRU int = 4000

@description('Subnet ID for private endpoint')
param privateEndpointSubnetId string?

@description('Resource tags')
param tags object = {}

// ===== VARIABLES =====

var cosmosAccountName = '${namePrefix}-cosmos-${environment}'
var databaseName = 'prepbettr'

// Container configurations optimized for PrepBettr workload
var containers = [
  {
    name: 'users'
    partitionKey: '/userId'
    defaultTTL: -1  // No automatic expiration
    maxRU: maxAutoscaleRU
    indexingPolicy: {
      automatic: true
      includedPaths: [
        { path: '/userId/*' }
        { path: '/email/*' }
        { path: '/createdAt/*' }
        { path: '/lastLogin/*' }
      ]
      excludedPaths: [
        { path: '/profile/bio/*' }      // Exclude large text fields
        { path: '/preferences/*' }       // Exclude complex nested objects
        { path: '/_etag/*' }
      ]
      compositeIndexes: [
        [
          { path: '/userId', order: 'ascending' }
          { path: '/createdAt', order: 'descending' }
        ]
      ]
    }
  }
  
  {
    name: 'interviews'
    partitionKey: '/userId'
    defaultTTL: 7776000  // 90 days (interviews expire after 90 days)
    maxRU: maxAutoscaleRU
    indexingPolicy: {
      automatic: true
      includedPaths: [
        { path: '/userId/*' }
        { path: '/type/*' }
        { path: '/status/*' }
        { path: '/createdAt/*' }
        { path: '/completedAt/*' }
        { path: '/jobRole/*' }
        { path: '/companyName/*' }
      ]
      excludedPaths: [
        { path: '/transcript/*' }       // Exclude large transcript data
        { path: '/audioData/*' }        // Exclude audio blob references
        { path: '/analysis/detailed/*' } // Exclude detailed analysis
      ]
      compositeIndexes: [
        [
          { path: '/userId', order: 'ascending' }
          { path: '/status', order: 'ascending' }
          { path: '/createdAt', order: 'descending' }
        ]
        [
          { path: '/type', order: 'ascending' }
          { path: '/jobRole', order: 'ascending' }
          { path: '/createdAt', order: 'descending' }
        ]
      ]
    }
  }
  
  {
    name: 'resumes'
    partitionKey: '/userId'
    defaultTTL: 15552000  // 180 days (resumes expire after 6 months)
    maxRU: maxAutoscaleRU / 2  // Lower RU for resumes (less frequent access)
    indexingPolicy: {
      automatic: true
      includedPaths: [
        { path: '/userId/*' }
        { path: '/fileName/*' }
        { path: '/uploadedAt/*' }
        { path: '/processed/*' }
        { path: '/fileSize/*' }
      ]
      excludedPaths: [
        { path: '/content/text/*' }     // Exclude extracted text content
        { path: '/content/parsed/*' }   // Exclude parsed resume data
        { path: '/analysis/*' }         // Exclude AI analysis results
      ]
    }
  }
  
  {
    name: 'community-interviews'
    partitionKey: '/id'
    defaultTTL: -1  // Community interviews don't expire
    maxRU: maxAutoscaleRU / 4  // Lower RU for community content
    indexingPolicy: {
      automatic: true
      includedPaths: [
        { path: '/jobRole/*' }
        { path: '/experience/*' }
        { path: '/difficulty/*' }
        { path: '/tags/*' }
        { path: '/createdAt/*' }
        { path: '/upvotes/*' }
      ]
      excludedPaths: [
        { path: '/questions/*/answer/*' }  // Exclude detailed answers
        { path: '/feedback/detailed/*' }   // Exclude detailed feedback
      ]
      compositeIndexes: [
        [
          { path: '/jobRole', order: 'ascending' }
          { path: '/difficulty', order: 'ascending' }
          { path: '/upvotes', order: 'descending' }
        ]
      ]
    }
  }
  
  {
    name: 'configAudit'
    partitionKey: '/key'
    defaultTTL: 2592000  // 30 days (config audit expires after 30 days)
    maxRU: maxAutoscaleRU / 8  // Very low RU for audit logs
    indexingPolicy: {
      automatic: true
      includedPaths: [
        { path: '/key/*' }
        { path: '/timestamp/*' }
        { path: '/changedBy/*' }
        { path: '/environment/*' }
      ]
      excludedPaths: [
        { path: '/oldValue/*' }         // Exclude old values from indexing
        { path: '/newValue/*' }         // Exclude new values from indexing
        { path: '/metadata/*' }         // Exclude metadata
      ]
    }
  }
  
  {
    name: 'analytics'
    partitionKey: '/date'
    defaultTTL: 7776000  // 90 days (analytics data expires after 90 days)
    maxRU: maxAutoscaleRU / 4
    indexingPolicy: {
      automatic: true
      includedPaths: [
        { path: '/date/*' }
        { path: '/event/*' }
        { path: '/userId/*' }
        { path: '/timestamp/*' }
      ]
      excludedPaths: [
        { path: '/payload/*' }          // Exclude event payload data
      ]
      compositeIndexes: [
        [
          { path: '/event', order: 'ascending' }
          { path: '/date', order: 'descending' }
        ]
      ]
    }
  }
]

// ===== COSMOS DB ACCOUNT =====

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2023-09-15' = {
  name: cosmosAccountName
  location: location
  tags: tags
  kind: 'GlobalDocumentDB'
  
  properties: {
    // Consistency and availability
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'  // Best performance for most use cases
      maxStalenessPrefix: 100
      maxIntervalInSeconds: 300
    }
    
    // Multi-region configuration
    locations: enableMultiRegion && secondaryRegion != null ? [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: environment == 'prod'
      }
      {
        locationName: secondaryRegion!
        failoverPriority: 1
        isZoneRedundant: environment == 'prod'
      }
    ] : [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: environment == 'prod'
      }
    ]
    
    // Features and capabilities
    databaseAccountOfferType: 'Standard'
    enableFreeTier: environment == 'dev'
    enableAutomaticFailover: enableMultiRegion
    enableMultipleWriteLocations: enableMultiRegion
    enablePartitionKeyMonitoring: true
    enableAnalyticalStorage: environment == 'prod'  // Enable analytical store for production
    
    // Security
    publicNetworkAccess: privateEndpointSubnetId != null ? 'Disabled' : 'Enabled'
    ipRules: privateEndpointSubnetId == null ? [] : []  // Allow all IPs if no private endpoint
    isVirtualNetworkFilterEnabled: privateEndpointSubnetId != null
    
    // Performance optimizations
    capabilities: union(
      [
        { name: 'EnableServerless' }
      ],
      enableServerlessTier ? [] : [],
      environment == 'prod' ? [
        { name: 'EnableAnalyticalStorage' }
        { name: 'EnablePartitionMerge' }
      ] : []
    )
    
    // Backup
    backupPolicy: {
      type: 'Periodic'
      periodicModeProperties: {
        backupIntervalInMinutes: environment == 'prod' ? 240 : 1440  // 4 hours for prod, 24 hours for dev
        backupRetentionIntervalInHours: environment == 'prod' ? 720 : 240  // 30 days for prod, 10 days for dev
        backupStorageRedundancy: environment == 'prod' ? 'Geo' : 'Local'
      }
    }
  }
}

// ===== DATABASE =====

resource database 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2023-09-15' = {
  parent: cosmosAccount
  name: databaseName
  
  properties: enableServerlessTier ? {
    resource: {
      id: databaseName
    }
  } : {
    resource: {
      id: databaseName
    }
    options: {
      autoscaleSettings: {
        maxThroughput: maxAutoscaleRU
      }
    }
  }
}

// ===== CONTAINERS =====

resource cosmosContainers 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-09-15' = [for container in containers: {
  parent: database
  name: container.name
  
  properties: enableServerlessTier ? {
    resource: {
      id: container.name
      partitionKey: {
        paths: [container.partitionKey]
        kind: 'Hash'
      }
      defaultTtl: container.defaultTTL
      indexingPolicy: container.indexingPolicy
      
      // Conflict resolution
      conflictResolutionPolicy: {
        mode: 'LastWriterWins'
        conflictResolutionPath: '/_ts'
      }
      
      // Unique keys for data integrity
      uniqueKeyPolicy: container.name == 'users' ? {
        uniqueKeys: [
          {
            paths: ['/email']
          }
        ]
      } : null
    }
  } : {
    resource: {
      id: container.name
      partitionKey: {
        paths: [container.partitionKey]
        kind: 'Hash'
      }
      defaultTtl: container.defaultTTL
      indexingPolicy: container.indexingPolicy
      
      // Conflict resolution
      conflictResolutionPolicy: {
        mode: 'LastWriterWins'
        conflictResolutionPath: '/_ts'
      }
      
      // Unique keys for data integrity
      uniqueKeyPolicy: container.name == 'users' ? {
        uniqueKeys: [
          {
            paths: ['/email']
          }
        ]
      } : null
    }
    
    options: {
      autoscaleSettings: {
        maxThroughput: container.maxRU
      }
    }
  }
}]

// ===== PRIVATE ENDPOINT =====

resource privateEndpoint 'Microsoft.Network/privateEndpoints@2023-06-01' = if (privateEndpointSubnetId != null) {
  name: '${cosmosAccountName}-private-endpoint'
  location: location
  tags: tags
  
  properties: {
    subnet: {
      id: privateEndpointSubnetId!
    }
    
    privateLinkServiceConnections: [
      {
        name: '${cosmosAccountName}-connection'
        properties: {
          privateLinkServiceId: cosmosAccount.id
          groupIds: ['Sql']
        }
      }
    ]
  }
}

// ===== DNS ZONE FOR PRIVATE ENDPOINT =====

resource privateDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = if (privateEndpointSubnetId != null) {
  name: 'privatelink.documents.azure.com'
  location: 'global'
  tags: tags
}

resource privateDnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-06-01' = if (privateEndpointSubnetId != null) {
  parent: privateEndpoint
  name: 'default'
  
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'cosmos-config'
        properties: {
          privateDnsZoneId: privateDnsZone.id
        }
      }
    ]
  }
}

// ===== DIAGNOSTIC SETTINGS =====

resource diagnosticSettings 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  scope: cosmosAccount
  name: '${cosmosAccountName}-diagnostics'
  
  properties: {
    logs: [
      {
        category: 'DataPlaneRequests'
        enabled: true
        retentionPolicy: {
          enabled: true
          days: environment == 'prod' ? 90 : 30
        }
      }
      {
        category: 'QueryRuntimeStatistics'
        enabled: true
        retentionPolicy: {
          enabled: true
          days: environment == 'prod' ? 90 : 30
        }
      }
      {
        category: 'PartitionKeyStatistics'
        enabled: true
        retentionPolicy: {
          enabled: true
          days: environment == 'prod' ? 90 : 30
        }
      }
      {
        category: 'PartitionKeyRUConsumption'
        enabled: true
        retentionPolicy: {
          enabled: true
          days: environment == 'prod' ? 90 : 30
        }
      }
    ]
    
    metrics: [
      {
        category: 'Requests'
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

// ===== RU CONSUMPTION ALERTS =====

resource ruConsumptionAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = if (!enableServerlessTier) {
  name: '${cosmosAccountName}-ru-consumption-alert'
  location: 'global'
  tags: tags
  
  properties: {
    description: 'Alert when Cosmos DB RU consumption exceeds 80% of provisioned capacity'
    severity: 2
    enabled: true
    scopes: [cosmosAccount.id]
    evaluationFrequency: 'PT5M'
    windowSize: 'PT5M'
    
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'RU Consumption'
          metricName: 'ProvisionedThroughputUtilization'
          operator: 'GreaterThan'
          threshold: 80
          timeAggregation: 'Average'
        }
      ]
    }
    
    actions: []  // Actions will be added by monitoring module
  }
}

resource throttlingAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: '${cosmosAccountName}-throttling-alert'
  location: 'global'
  tags: tags
  
  properties: {
    description: 'Alert when Cosmos DB requests are being throttled'
    severity: 1
    enabled: true
    scopes: [cosmosAccount.id]
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'Throttled Requests'
          metricName: 'TotalRequestUnits'
          operator: 'GreaterThan'
          threshold: 5
          timeAggregation: 'Count'
        }
      ]
    }
    
    actions: []  // Actions will be added by monitoring module
  }
}

// ===== STORED PROCEDURES FOR BULK OPERATIONS =====

resource bulkInsertStoredProc 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers/storedProcedures@2023-09-15' = {
  parent: cosmosContainers[1]  // Apply to interviews container
  name: 'bulkInsert'
  
  properties: {
    resource: {
      id: 'bulkInsert'
      body: '''
        function bulkInsert(docs) {
          var collection = getContext().getCollection();
          var collectionLink = collection.getSelfLink();
          var count = 0;
          
          if (!docs) throw new Error("The array is undefined or null.");
          
          var docsLength = docs.length;
          if (docsLength == 0) {
            getContext().getResponse().setBody(0);
            return;
          }
          
          // Recursive function to insert documents
          function tryInsert(docs, count) {
            var doc = docs[count];
            var isAccepted = collection.createDocument(collectionLink, doc, {},
              function (err, result, options) {
                if (err) throw err;
                count++;
                if (count >= docsLength) {
                  getContext().getResponse().setBody(count);
                } else {
                  tryInsert(docs, count);
                }
              });
              
            if (!isAccepted) {
              getContext().getResponse().setBody(count);
            }
          }
          
          tryInsert(docs, count);
        }
      '''
    }
  }
}

// ===== OUTPUTS =====

output cosmosDbAccountName string = cosmosAccount.name
output cosmosDbAccountId string = cosmosAccount.id
output cosmosDbEndpoint string = cosmosAccount.properties.documentEndpoint
output cosmosDbKey string = cosmosAccount.listKeys().primaryMasterKey
output databaseName string = database.name
output privateEndpointId string = privateEndpointSubnetId != null ? privateEndpoint.id : ''

// Connection configuration for applications
output connectionConfig object = {
  endpoint: cosmosAccount.properties.documentEndpoint
  key: cosmosAccount.listKeys().primaryMasterKey
  database: database.name
  maxConnectionPoolSize: 50
  maxRequestsPerConnection: 30
  maxRetryAttemptsOnThrottling: 9
  maxRetryWaitTimeInSeconds: 30
  preferredLocations: enableMultiRegion && secondaryRegion != null ? [location, secondaryRegion!] : [location]
  consistencyLevel: 'Session'
  enableEndpointDiscovery: enableMultiRegion
  partitionKeyPaths: {
    users: '/userId'
    interviews: '/userId'
    resumes: '/userId'
    'community-interviews': '/id'
    configAudit: '/key'
    analytics: '/date'
  }
}

// Performance tuning recommendations
output performanceTuning object = {
  recommendedQueries: [
    'SELECT * FROM c WHERE c.userId = @userId ORDER BY c.createdAt DESC'
    'SELECT * FROM c WHERE c.type = @type AND c.status = @status'
    'SELECT * FROM c WHERE c.jobRole = @jobRole AND c.difficulty = @difficulty'
  ]
  indexingBestPractices: [
    'Use composite indexes for multi-property ORDER BY queries'
    'Exclude large text fields from indexing to reduce RU consumption'
    'Use partition key in WHERE clauses for optimal performance'
  ]
  partitioningStrategy: 'Use /userId for user-scoped data, /id for shared data'
}
