// ===================================================
// Azure Cache for Redis - Intelligent Caching Layer
// Includes autoscale, VNet integration & premium features
// ===================================================

@description('Environment name')
param environment string

@description('Resource naming prefix')
param namePrefix string

@description('Azure region')
param location string

@description('Redis tier (Basic, Standard, Premium)')
@allowed(['Basic', 'Standard', 'Premium'])
param tier string = 'Standard'

@description('Redis capacity (SKU size)')
@minValue(0)
@maxValue(6)
param capacity int = 1

@description('Enable Redis clustering')
param enableClustering bool = false

@description('Enable Redis persistence')
param enablePersistence bool = false

@description('Subnet ID for VNet integration')
param subnetId string?

@description('Resource tags')
param tags object = {}

// ===== VARIABLES =====

var redisName = '${namePrefix}-redis-${environment}'

// Redis configurations optimized for PrepBettr workload
var redisConfiguration = {
  'maxmemory-policy': 'allkeys-lru'  // Evict least recently used keys
  'maxmemory-delta': '10'
  'maxmemory-reserved': '30'
  'notify-keyspace-events': 'Ex'     // Enable expiration events
  'timeout': '300'                   // 5 min timeout for idle connections
  'tcp-keepalive': '300'
}

// Premium-specific configurations
var premiumConfiguration = union(redisConfiguration, {
  'rdb-backup-enabled': enablePersistence ? 'true' : 'false'
  'rdb-backup-frequency': '60'       // Backup every hour in production
  'rdb-backup-max-snapshot-count': '3'
  'rdb-storage-connection-string': enablePersistence ? storageAccount.outputs.connectionString : ''
})

// ===== STORAGE ACCOUNT FOR REDIS PERSISTENCE =====

module storageAccount '../shared/storage-account.bicep' = if (enablePersistence && tier == 'Premium') {
  name: 'redis-backup-storage'
  params: {
    storageAccountName: '${namePrefix}redisbak${environment}'
    location: location
    tier: 'Standard'
    replicationType: 'LRS'
    allowBlobPublicAccess: false
    tags: union(tags, { Purpose: 'Redis-Backup' })
  }
}

// ===== REDIS CACHE =====

resource redisCache 'Microsoft.Cache/redis@2023-08-01' = {
  name: redisName
  location: location
  tags: tags
  
  properties: {
    sku: {
      name: tier
      family: tier == 'Premium' ? 'P' : 'C'
      capacity: capacity
    }
    
    // Basic Redis settings
    enableNonSslPort: false  // Force SSL connections
    minimumTlsVersion: '1.2'
    publicNetworkAccess: subnetId != null ? 'Disabled' : 'Enabled'
    
    // VNet integration for security
    subnetId: subnetId
    staticIP: null  // Let Azure assign IP within subnet
    
    // Configuration based on tier
    redisConfiguration: tier == 'Premium' ? premiumConfiguration : redisConfiguration
    
    // Clustering (Premium only)
    shardCount: enableClustering && tier == 'Premium' ? 3 : null
    
    // Zones for high availability (Premium only)
    zones: tier == 'Premium' && environment == 'prod' ? ['1', '2', '3'] : null
  }
}

// ===== PRIVATE ENDPOINT FOR SECURE ACCESS =====

resource privateEndpoint 'Microsoft.Network/privateEndpoints@2023-06-01' = if (subnetId != null) {
  name: '${redisName}-private-endpoint'
  location: location
  tags: tags
  
  properties: {
    subnet: {
      id: subnetId!
    }
    
    privateLinkServiceConnections: [
      {
        name: '${redisName}-connection'
        properties: {
          privateLinkServiceId: redisCache.id
          groupIds: ['redisCache']
        }
      }
    ]
  }
}

// ===== DNS ZONE FOR PRIVATE ENDPOINT =====

resource privateDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = if (subnetId != null) {
  name: 'privatelink.redis.cache.windows.net'
  location: 'global'
  tags: tags
}

resource privateDnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-06-01' = if (subnetId != null) {
  parent: privateEndpoint
  name: 'default'
  
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'redis-config'
        properties: {
          privateDnsZoneId: privateDnsZone.id
        }
      }
    ]
  }
}

// ===== AUTOSCALE SETTINGS =====

resource autoScaleSettings 'Microsoft.Insights/autoscalesettings@2022-10-01' = if (tier == 'Standard' || tier == 'Premium') {
  name: '${redisName}-autoscale'
  location: location
  tags: tags
  
  properties: {
    name: '${redisName}-autoscale'
    targetResourceUri: redisCache.id
    enabled: true
    
    profiles: [
      {
        name: 'Default-Profile'
        capacity: {
          minimum: capacity < 2 ? '1' : '2'
          maximum: capacity < 4 ? '4' : '6'
          default: string(capacity)
        }
        
        rules: [
          // Scale up when CPU > 75% for 10 minutes
          {
            metricTrigger: {
              metricName: 'PercentProcessorTime'
              metricResourceUri: redisCache.id
              timeGrain: 'PT1M'
              statistic: 'Average'
              timeWindow: 'PT10M'
              timeAggregation: 'Average'
              operator: 'GreaterThan'
              threshold: 75
            }
            scaleAction: {
              direction: 'Increase'
              type: 'ChangeCount'
              value: '1'
              cooldown: 'PT20M'  // Wait 20 minutes before next scale action
            }
          }
          
          // Scale down when CPU < 25% for 30 minutes
          {
            metricTrigger: {
              metricName: 'PercentProcessorTime'
              metricResourceUri: redisCache.id
              timeGrain: 'PT1M'
              statistic: 'Average'
              timeWindow: 'PT30M'
              timeAggregation: 'Average'
              operator: 'LessThan'
              threshold: 25
            }
            scaleAction: {
              direction: 'Decrease'
              type: 'ChangeCount'
              value: '1'
              cooldown: 'PT30M'
            }
          }
          
          // Scale up when operations per second > 1000
          {
            metricTrigger: {
              metricName: 'OperationsPerSecond'
              metricResourceUri: redisCache.id
              timeGrain: 'PT1M'
              statistic: 'Average'
              timeWindow: 'PT5M'
              timeAggregation: 'Average'
              operator: 'GreaterThan'
              threshold: 1000
            }
            scaleAction: {
              direction: 'Increase'
              type: 'ChangeCount'
              value: '1'
              cooldown: 'PT15M'
            }
          }
        ]
      }
      
      // Weekend/off-hours profile (reduced capacity)
      {
        name: 'Weekend-Profile'
        capacity: {
          minimum: '1'
          maximum: string(capacity)
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
        
        rules: []  // Use minimal scaling during off-hours
      }
    ]
  }
}

// ===== DIAGNOSTIC SETTINGS =====

resource diagnosticSettings 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  scope: redisCache
  name: '${redisName}-diagnostics'
  
  properties: {
    logs: [
      {
        categoryGroup: 'allLogs'
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

output redisName string = redisCache.name
output redisId string = redisCache.id
output connectionString string = '${redisCache.properties.hostName}:${redisCache.properties.sslPort},password=${redisCache.listKeys().primaryKey},ssl=True,abortConnect=False'
output hostName string = redisCache.properties.hostName
output sslPort int = redisCache.properties.sslPort
output primaryKey string = redisCache.listKeys().primaryKey
output privateEndpointId string = subnetId != null ? privateEndpoint.id : ''

// Connection details for applications
output connectionConfig object = {
  host: redisCache.properties.hostName
  port: redisCache.properties.sslPort
  password: redisCache.listKeys().primaryKey
  ssl: true
  db: 0
  keyPrefix: '${environment}:'
  defaultTTL: 300  // 5 minutes default TTL
  maxConnections: 50
  retryDelayOnFailover: 100
  retryTimeoutInMilliseconds: 5000
}
