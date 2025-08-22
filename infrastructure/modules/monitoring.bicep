// ===================================================
// Enhanced Monitoring & Alerting Module
// Comprehensive observability for PrepBettr optimization
// ===================================================

@description('Environment name')
param environment string

@description('Resource naming prefix')
param namePrefix string

@description('Azure region')
param location string

@description('Cosmos DB account name for monitoring')
param cosmosDbAccountName string

@description('Redis cache name for monitoring')
param redisName string

@description('Function App name for monitoring')
param functionAppName string

@description('Storage account name for monitoring')
param storageAccountName string

@description('Resource tags')
param tags object = {}

// ===== VARIABLES =====

var workspaceName = '${namePrefix}-workspace-${environment}'
var appInsightsName = '${namePrefix}-insights-${environment}'
var dashboardName = '${namePrefix}-dashboard-${environment}'

// Alert action groups
var alertActionGroups = [
  {
    name: 'CriticalAlerts'
    shortName: 'Critical'
    description: 'Critical system alerts requiring immediate attention'
    emails: ['ops@prepbettr.com', 'oncall@prepbettr.com']
    sms: environment == 'prod' ? ['+1234567890'] : []
    webhooks: ['https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK']
  }
  {
    name: 'PerformanceAlerts'
    shortName: 'Perf'
    description: 'Performance degradation alerts'
    emails: ['dev-team@prepbettr.com']
    sms: []
    webhooks: ['https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK']
  }
  {
    name: 'CostAlerts'
    shortName: 'Cost'
    description: 'Cost management and budget alerts'
    emails: ['finance@prepbettr.com', 'ops@prepbettr.com']
    sms: []
    webhooks: []
  }
]

// ===== LOG ANALYTICS WORKSPACE =====

resource workspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: workspaceName
  location: location
  tags: tags
  
  properties: {
    sku: {
      name: environment == 'prod' ? 'PerGB2018' : 'Free'
    }
    retentionInDays: environment == 'prod' ? 90 : 30
    features: {
      legacy: 0
      searchVersion: 1
      enableLogAccessUsingOnlyResourcePermissions: true
    }
    workspaceCapping: {
      dailyQuotaGb: environment == 'dev' ? 1 : -1  // 1GB daily cap for dev, unlimited for others
    }
  }
}

// ===== APPLICATION INSIGHTS =====

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  tags: tags
  kind: 'web'
  
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: workspace.id
    IngestionMode: 'LogAnalytics'
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
    DisableIpMasking: false
    
    // Sampling configuration for cost optimization
    SamplingPercentage: environment == 'prod' ? 100 : 50  // Full sampling in prod, 50% in others
    Flow_Type: 'Redfield'
    Request_Source: 'IbizaWebAppExtensionCreate'
  }
}

// ===== ACTION GROUPS =====

resource actionGroups 'Microsoft.Insights/actionGroups@2023-01-01' = [for group in alertActionGroups: {
  name: '${namePrefix}-${group.name}-${environment}'
  location: 'global'
  tags: tags
  
  properties: {
    groupShortName: group.shortName
    enabled: true
    
    emailReceivers: [for email in group.emails: {
      name: replace(email, '@', '-at-')
      emailAddress: email
      useCommonAlertSchema: true
    }]
    
    smsReceivers: [for (sms, index) in group.sms: {
      name: 'sms-${index}'
      countryCode: '1'
      phoneNumber: sms
    }]
    
    webhookReceivers: [for (webhook, index) in group.webhooks: {
      name: 'webhook-${index}'
      serviceUri: webhook
      useCommonAlertSchema: true
    }]
  }
}]

// ===== PERFORMANCE ALERT RULES =====

// High latency alert for Functions
resource functionLatencyAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: '${functionAppName}-high-latency'
  location: 'global'
  tags: tags
  
  properties: {
    description: 'Alert when Azure Functions P95 latency exceeds 1000ms'
    severity: 2
    enabled: true
    scopes: [resourceId('Microsoft.Web/sites', functionAppName)]
    evaluationFrequency: 'PT5M'
    windowSize: 'PT5M'
    
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'FunctionLatency'
          metricName: 'FunctionExecutionTime'
          operator: 'GreaterThan'
          threshold: 1000
          timeAggregation: 'Average'
        }
      ]
    }
    
    actions: [
      {
        actionGroupId: actionGroups[1].id  // Performance alerts
      }
    ]
  }
}

// Redis cache hit ratio alert
resource redisCacheAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: '${redisName}-low-hit-ratio'
  location: 'global'
  tags: tags
  
  properties: {
    description: 'Alert when Redis cache hit ratio drops below 80%'
    severity: 2
    enabled: true
    scopes: [resourceId('Microsoft.Cache/redis', redisName)]
    evaluationFrequency: 'PT10M'
    windowSize: 'PT15M'
    
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'CacheHitRatio'
          metricName: 'CacheHitRate'
          operator: 'LessThan'
          threshold: 80
          timeAggregation: 'Average'
        }
      ]
    }
    
    actions: [
      {
        actionGroupId: actionGroups[1].id
      }
    ]
  }
}

// Function cold start alert
resource functionColdStartAlert 'Microsoft.Insights/scheduledQueryRules@2021-08-01' = {
  name: '${functionAppName}-cold-starts'
  location: location
  tags: tags
  
  properties: {
    description: 'Alert when Function cold starts exceed 10 per hour'
    severity: 2
    enabled: true
    scopes: [appInsights.id]
    evaluationFrequency: 'PT15M'
    windowSize: 'PT1H'
    
    criteria: {
      allOf: [
        {
          query: '''
            requests
            | where cloud_RoleName == "${functionAppName}"
            | where customDimensions.coldStart == "true"
            | summarize ColdStarts = count() by bin(timestamp, 1h)
            | where ColdStarts > 10
          '''
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 0
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    
    actions: {
      actionGroups: [actionGroups[1].id]
    }
  }
}

// ===== SECURITY ALERT RULES =====

// Authentication failure alert
resource authFailureAlert 'Microsoft.Insights/scheduledQueryRules@2021-08-01' = {
  name: '${namePrefix}-auth-failures-${environment}'
  location: location
  tags: tags
  
  properties: {
    description: 'Alert when authentication failures exceed 10 per minute'
    severity: 1
    enabled: true
    scopes: [appInsights.id]
    evaluationFrequency: 'PT5M'
    windowSize: 'PT5M'
    
    criteria: {
      allOf: [
        {
          query: '''
            requests
            | where resultCode >= 401 and resultCode <= 403
            | where url contains "/api/auth" or url contains "/login"
            | summarize FailedAuth = count() by bin(timestamp, 5m)
            | where FailedAuth > 10
          '''
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 0
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    
    actions: {
      actionGroups: [actionGroups[0].id]  // Critical alerts
    }
  }
}

// ===== COST MONITORING ALERTS =====

// Daily cost alert
resource dailyCostAlert 'Microsoft.Insights/scheduledQueryRules@2021-08-01' = {
  name: '${namePrefix}-daily-cost-${environment}'
  location: location
  tags: tags
  
  properties: {
    description: 'Alert when daily Azure costs exceed expected threshold'
    severity: 2
    enabled: true
    scopes: [workspace.id]
    evaluationFrequency: 'PT6H'
    windowSize: 'P1D'
    
    criteria: {
      allOf: [
        {
          query: '''
            Usage
            | where TimeGenerated > ago(1d)
            | where IsBillable == true
            | summarize TotalCost = sum(Quantity * UnitPrice) by bin(TimeGenerated, 1d)
            | where TotalCost > ${environment == 'prod' ? '50' : '20'}  // $50 for prod, $20 for dev/staging
          '''
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 0
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    
    actions: {
      actionGroups: [actionGroups[2].id]  // Cost alerts
    }
  }
}

// ===== AVAILABILITY TESTS =====

resource healthCheckAvailabilityTest 'Microsoft.Insights/webtests@2022-06-15' = {
  name: '${namePrefix}-health-check-${environment}'
  location: location
  tags: tags
  kind: 'ping'
  
  properties: {
    SyntheticMonitorId: '${namePrefix}-health-check-${environment}'
    Name: 'Health Check Availability Test'
    Description: 'Monitors the health check endpoint availability'
    Enabled: true
    Frequency: 300  // 5 minutes
    Timeout: 30
    Kind: 'ping'
    Locations: [
      {
        Id: 'us-east-1'
      }
      {
        Id: 'us-west-2'
      }
      {
        Id: 'eu-west-1'
      }
    ]
    
    Configuration: {
      WebTest: '''
        <WebTest Name="${namePrefix}-health-check" Enabled="True" CssProjectStructure="" CssIteration="" Timeout="30" WorkItemIds="" xmlns="http://microsoft.com/schemas/VisualStudio/TeamTest/2010" Description="" CredentialUserName="" CredentialPassword="" PreAuthenticate="True" Proxy="default" StopOnError="False" RecordedResultFile="" ResultsLocale="">
          <Items>
            <Request Method="GET" Version="1.1" Url="https://${namePrefix}-${environment}.azurewebsites.net/api/health" ThinkTime="0" Timeout="30" ParseDependentRequests="False" FollowRedirects="True" RecordResult="True" Cache="False" ResponseTimeGoal="0" Encoding="utf-8" ExpectedHttpStatusCode="200" ExpectedResponseUrl="" ReportingName="" IgnoreHttpStatusCode="False" />
          </Items>
        </WebTest>
      '''
    }
    
    Request: {
      RequestUrl: 'https://${namePrefix}-${environment}.azurewebsites.net/api/health'
      HttpVerb: 'GET'
      RequestBody: null
      ParseDependentRequests: false
      FollowRedirects: true
    }
    
    ValidationRules: {
      ExpectedHttpStatusCode: 200
      SSLCheck: true
      SSLCertRemainingLifetimeCheck: 30
    }
  }
}

// Availability test alert
resource availabilityAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: '${namePrefix}-availability-alert-${environment}'
  location: 'global'
  tags: tags
  
  properties: {
    description: 'Alert when availability drops below 95%'
    severity: 0  // Critical
    enabled: true
    scopes: [appInsights.id]
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'AvailabilityRate'
          metricName: 'availabilityResults/availabilityPercentage'
          operator: 'LessThan'
          threshold: 95
          timeAggregation: 'Average'
          dimensions: [
            {
              name: 'availabilityResult/name'
              operator: 'Include'
              values: [healthCheckAvailabilityTest.name]
            }
          ]
        }
      ]
    }
    
    actions: [
      {
        actionGroupId: actionGroups[0].id  // Critical alerts
      }
    ]
  }
}

// ===== AZURE DASHBOARD =====

resource dashboard 'Microsoft.Portal/dashboards@2020-09-01-preview' = {
  name: guid(dashboardName)
  location: location
  tags: union(tags, { 'hidden-title': 'PrepBettr Optimization Dashboard' })
  
  properties: {
    lenses: [
      {
        order: 0
        parts: [
          // Overview metrics
          {
            position: { x: 0, y: 0, rowSpan: 2, colSpan: 4 }
            metadata: {
              inputs: [
                {
                  name: 'resourceTypeMode'
                  value: 'workspace'
                }
                {
                  name: 'ComponentId'
                  value: {
                    Name: workspaceName
                    SubscriptionId: subscription().subscriptionId
                    ResourceGroup: resourceGroup().name
                  }
                }
                {
                  name: 'Query'
                  value: '''
                    // System Overview KPIs
                    let timeRange = ago(1h);
                    let requests = requests | where timestamp > timeRange;
                    let dependencies = dependencies | where timestamp > timeRange;
                    requests
                    | summarize 
                        TotalRequests = count(),
                        SuccessfulRequests = countif(success == true),
                        AvgDuration = avg(duration),
                        P95Duration = percentile(duration, 95)
                    | extend 
                        SuccessRate = round(SuccessfulRequests * 100.0 / TotalRequests, 2),
                        AvgDurationMs = round(AvgDuration, 0),
                        P95DurationMs = round(P95Duration, 0)
                    | project 
                        ["📊 Total Requests"] = TotalRequests,
                        ["✅ Success Rate %"] = SuccessRate,
                        ["⏱️ Avg Latency (ms)"] = AvgDurationMs,
                        ["📈 P95 Latency (ms)"] = P95DurationMs
                  '''
                }
              ]
              type: 'Extension/HubsExtension/PartType/MonitorChartPart'
              settings: {
                content: {
                  chartType: 'Table'
                  title: '🎯 System Performance Overview'
                }
              }
            }
          }
          
          // Redis performance
          {
            position: { x: 4, y: 0, rowSpan: 2, colSpan: 4 }
            metadata: {
              inputs: [
                {
                  name: 'resourceTypeMode'
                  value: 'azure-monitor'
                }
                {
                  name: 'componentId'
                  value: resourceId('Microsoft.Cache/redis', redisName)
                }
                {
                  name: 'metricName'
                  value: 'CacheHitRate'
                }
              ]
              type: 'Extension/HubsExtension/PartType/MonitorChartPart'
              settings: {
                content: {
                  chartType: 'Line'
                  title: '💾 Redis Cache Hit Rate'
                }
              }
            }
          }
          
          // Cosmos DB RU consumption
          {
            position: { x: 8, y: 0, rowSpan: 2, colSpan: 4 }
            metadata: {
              inputs: [
                {
                  name: 'resourceTypeMode'
                  value: 'azure-monitor'
                }
                {
                  name: 'componentId'
                  value: resourceId('Microsoft.DocumentDB/databaseAccounts', cosmosDbAccountName)
                }
                {
                  name: 'metricName'
                  value: 'TotalRequestUnits'
                }
              ]
              type: 'Extension/HubsExtension/PartType/MonitorChartPart'
              settings: {
                content: {
                  chartType: 'Line'
                  title: '🔥 Cosmos DB RU/s Consumption'
                }
              }
            }
          }
          
          // Function cold starts
          {
            position: { x: 0, y: 2, rowSpan: 2, colSpan: 6 }
            metadata: {
              inputs: [
                {
                  name: 'resourceTypeMode'
                  value: 'workspace'
                }
                {
                  name: 'ComponentId'
                  value: {
                    Name: workspaceName
                    SubscriptionId: subscription().subscriptionId
                    ResourceGroup: resourceGroup().name
                  }
                }
                {
                  name: 'Query'
                  value: '''
                    requests
                    | where cloud_RoleName == "${functionAppName}"
                    | where isnotempty(customDimensions.coldStart)
                    | summarize 
                        ColdStarts = countif(customDimensions.coldStart == "true"),
                        TotalRequests = count()
                    by bin(timestamp, 5m)
                    | extend ColdStartRate = round(ColdStarts * 100.0 / TotalRequests, 2)
                    | project timestamp, ColdStarts, ColdStartRate
                    | render timechart
                  '''
                }
              ]
              type: 'Extension/HubsExtension/PartType/MonitorChartPart'
              settings: {
                content: {
                  chartType: 'Line'
                  title: '❄️ Function Cold Starts Over Time'
                }
              }
            }
          }
          
          // Cost trending
          {
            position: { x: 6, y: 2, rowSpan: 2, colSpan: 6 }
            metadata: {
              inputs: [
                {
                  name: 'resourceTypeMode'
                  value: 'workspace'
                }
                {
                  name: 'ComponentId'
                  value: {
                    Name: workspaceName
                    SubscriptionId: subscription().subscriptionId
                    ResourceGroup: resourceGroup().name
                  }
                }
                {
                  name: 'Query'
                  value: '''
                    Usage
                    | where TimeGenerated > ago(7d)
                    | where IsBillable == true
                    | summarize DailyCost = sum(Quantity * UnitPrice) by bin(TimeGenerated, 1d)
                    | render timechart
                  '''
                }
              ]
              type: 'Extension/HubsExtension/PartType/MonitorChartPart'
              settings: {
                content: {
                  chartType: 'Line'
                  title: '💰 Daily Cost Trending (Last 7 Days)'
                }
              }
            }
          }
        ]
      }
    ]
    
    metadata: {
      model: {
        timeRange: {
          value: {
            relative: {
              duration: 24
              timeUnit: 1
            }
          }
          type: 'MsPortalFx.Composition.Configuration.ValueTypes.TimeRange'
        }
      }
    }
  }
}

// ===== WORKBOOK TEMPLATES =====

resource performanceWorkbook 'Microsoft.Insights/workbooks@2023-06-01' = {
  name: guid('${namePrefix}-performance-workbook-${environment}')
  location: location
  tags: tags
  kind: 'user'
  
  properties: {
    displayName: 'PrepBettr Performance Analysis'
    serializedData: json(loadTextContent('./workbooks/performance-workbook.json'))
    version: '1.0'
    category: 'workbook'
    
    sourceId: appInsights.id
  }
}

resource costAnalysisWorkbook 'Microsoft.Insights/workbooks@2023-06-01' = {
  name: guid('${namePrefix}-cost-workbook-${environment}')
  location: location
  tags: tags
  kind: 'user'
  
  properties: {
    displayName: 'PrepBettr Cost Analysis'
    serializedData: json(loadTextContent('./workbooks/cost-analysis-workbook.json'))
    version: '1.0'
    category: 'workbook'
    
    sourceId: workspace.id
  }
}

// ===== OUTPUTS =====

output workspaceId string = workspace.id
output workspaceName string = workspace.name
output applicationInsightsId string = appInsights.id
output applicationInsightsName string = appInsights.name
output applicationInsightsKey string = appInsights.properties.InstrumentationKey
output applicationInsightsConnectionString string = appInsights.properties.ConnectionString

output dashboardId string = dashboard.id
output dashboardUrl string = 'https://portal.azure.com/#@/dashboard/arm${dashboard.id}'

// Action group outputs for other modules
output criticalActionGroupId string = actionGroups[0].id
output performanceActionGroupId string = actionGroups[1].id
output costAlertActionGroupName string = actionGroups[2].name

// Monitoring endpoints for health checks
output healthCheckUrls array = [
  'https://${namePrefix}-${environment}.azurewebsites.net/api/health'
  'https://${namePrefix}-${environment}.azurewebsites.net/api/health/azure'
  'https://${namePrefix}-${environment}.azurewebsites.net/api/health/redis'
  'https://${namePrefix}-${environment}.azurewebsites.net/api/health/cosmos'
]

// KQL queries for troubleshooting
output troubleshootingQueries object = {
  topSlowRequests: '''
    requests
    | where timestamp > ago(1h)
    | top 10 by duration desc
    | project timestamp, name, url, duration, resultCode, success
  '''
  
  errorAnalysis: '''
    exceptions
    | where timestamp > ago(1h)
    | summarize count() by type, outerMessage
    | order by count_ desc
  '''
  
  cosmosRUAnalysis: '''
    dependencies
    | where type == "Azure DocumentDB"
    | where timestamp > ago(1h)
    | extend RU = todouble(customDimensions["Consumed Request Units"])
    | summarize avg(RU), max(RU), percentile(RU, 95) by operation_Name
    | order by avg_RU desc
  '''
  
  redisPerformance: '''
    dependencies
    | where type == "Redis"
    | where timestamp > ago(1h)
    | summarize 
        HitRate = countif(success == true) * 100.0 / count(),
        AvgLatency = avg(duration),
        P95Latency = percentile(duration, 95)
    by bin(timestamp, 5m)
  '''
}
