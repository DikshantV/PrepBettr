// ===================================================
// Cost Management & Optimization Module
// Budgets, alerts, and autoscale policies for cost control
// ===================================================

@description('Environment name')
param environment string

@description('Monthly budget limit in USD')
param monthlyBudgetLimit int

@description('Resource group ID for budget scope')
param resourceGroupId string

@description('Action group name for cost alerts')
param actionGroupName string

@description('Resource tags')
param tags object = {}

// ===== VARIABLES =====

var budgetName = 'prepbettr-${environment}-budget'
var costThresholds = {
  warning: 80    // 80% of budget
  critical: 95   // 95% of budget
  emergency: 100 // 100% of budget (overspend)
}

// ===== BUDGET =====

resource budget 'Microsoft.Consumption/budgets@2021-10-01' = {
  name: budgetName
  scope: resourceGroupId
  
  properties: {
    category: 'Cost'
    amount: monthlyBudgetLimit
    timeGrain: 'Monthly'
    
    timePeriod: {
      startDate: '${utcNow('yyyy-MM')}-01'
      endDate: '2025-12-31'
    }
    
    filter: {
      dimensions: {
        name: 'ResourceGroupName'
        operator: 'In'
        values: [
          last(split(resourceGroupId, '/'))
        ]
      }
    }
    
    notifications: {
      // Warning at 80%
      budgetWarning: {
        enabled: true
        operator: 'GreaterThan'
        threshold: costThresholds.warning
        contactEmails: [
          'finance@prepbettr.com'
          'ops@prepbettr.com'
        ]
        contactRoles: [
          'Contributor'
          'Reader'
        ]
        contactGroups: [
          resourceId('Microsoft.Insights/actionGroups', actionGroupName)
        ]
        thresholdType: 'Actual'
      }
      
      // Critical at 95%
      budgetCritical: {
        enabled: true
        operator: 'GreaterThan'
        threshold: costThresholds.critical
        contactEmails: [
          'finance@prepbettr.com'
          'ops@prepbettr.com'
          'ceo@prepbettr.com'
        ]
        contactRoles: [
          'Owner'
          'Contributor'
        ]
        contactGroups: [
          resourceId('Microsoft.Insights/actionGroups', actionGroupName)
        ]
        thresholdType: 'Actual'
      }
      
      // Forecasted overspend
      budgetForecasted: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 100
        contactEmails: [
          'finance@prepbettr.com'
          'ops@prepbettr.com'
        ]
        contactRoles: [
          'Owner'
        ]
        contactGroups: [
          resourceId('Microsoft.Insights/actionGroups', actionGroupName)
        ]
        thresholdType: 'Forecasted'
      }
    }
  }
}

// ===== COST ANOMALY DETECTOR =====

resource costAnomalyDetector 'Microsoft.CostManagement/scheduledActions@2022-10-01' = {
  name: '${budgetName}-anomaly-detector'
  
  properties: {
    displayName: 'PrepBettr Cost Anomaly Detection'
    fileDestination: {
      fileFormats: [
        'Csv'
      ]
    }
    
    notification: {
      to: [
        'finance@prepbettr.com'
        'ops@prepbettr.com'
      ]
      subject: 'PrepBettr Cost Anomaly Detected'
    }
    
    schedule: {
      frequency: 'Daily'
      dayOfWeek: null
      weeksOfMonth: null
      daysOfWeek: null
      startDate: utcNow('yyyy-MM-dd')
      endDate: '2025-12-31'
    }
    
    scope: resourceGroupId
    
    viewId: '/subscriptions/${subscription().subscriptionId}/providers/Microsoft.CostManagement/views/AccumulatedCosts'
  }
}

// ===== COST OPTIMIZATION RECOMMENDATIONS =====

// Logic App for cost optimization actions
resource costOptimizationLogicApp 'Microsoft.Logic/workflows@2019-05-01' = {
  name: 'prepbettr-cost-optimization-${environment}'
  location: resourceGroup().location
  tags: tags
  
  properties: {
    definition: {
      '$schema': 'https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#'
      contentVersion: '1.0.0.0'
      
      parameters: {}
      
      triggers: {
        // Trigger on budget alert
        manual: {
          type: 'Request'
          kind: 'Http'
          inputs: {
            schema: {
              type: 'object'
              properties: {
                alertType: { type: 'string' }
                currentSpend: { type: 'number' }
                budgetLimit: { type: 'number' }
                resourceGroupId: { type: 'string' }
              }
            }
          }
        }
      }
      
      actions: {
        // Analyze current costs
        analyzeCosts: {
          type: 'Http'
          inputs: {
            method: 'GET'
            uri: 'https://management.azure.com${resourceGroupId}/providers/Microsoft.Consumption/usageDetails'
            headers: {
              Authorization: 'Bearer @{listKeys(\'${resourceGroupId}\', \'2021-04-01\').keys[0].value}'
            }
          }
        }
        
        // Scale down non-critical resources if over budget
        conditionalScaleDown: {
          type: 'If'
          expression: {
            greater: [
              '@triggerBody().currentSpend',
              '@mul(triggerBody().budgetLimit, 0.9)'  // 90% of budget
            ]
          }
          actions: {
            // Scale down Redis to Basic tier
            scaleDownRedis: {
              type: 'Http'
              inputs: {
                method: 'PATCH'
                uri: 'https://management.azure.com${resourceGroupId}/providers/Microsoft.Cache/redis/prepbettr-redis-${environment}'
                headers: {
                  'Content-Type': 'application/json'
                }
                body: {
                  properties: {
                    sku: {
                      name: 'Basic'
                      capacity: 0
                    }
                  }
                }
              }
              runAfter: {}
            }
            
            // Reduce Cosmos DB throughput
            reduceCosmosRU: {
              type: 'Http'
              inputs: {
                method: 'PUT'
                uri: 'https://management.azure.com${resourceGroupId}/providers/Microsoft.DocumentDB/databaseAccounts/prepbettr-cosmos-${environment}/sqlDatabases/prepbettr/throughputSettings/default'
                body: {
                  properties: {
                    resource: {
                      throughput: 400  // Minimum throughput
                    }
                  }
                }
              }
              runAfter: {
                scaleDownRedis: ['Succeeded']
              }
            }
          }
        }
        
        // Send notification
        sendNotification: {
          type: 'Http'
          inputs: {
            method: 'POST'
            uri: '@parameters(\'slackWebhook\')'
            body: {
              text: 'Cost optimization actions triggered for PrepBettr @{triggerBody().alertType}'
              channel: '#cost-alerts'
            }
          }
          runAfter: {
            conditionalScaleDown: ['Succeeded', 'Skipped']
          }
        }
      }
      
      outputs: {}
    }
    
    parameters: {}
    
    state: 'Enabled'
  }
}

// ===== RESOURCE TAGGING FOR COST ALLOCATION =====

// Policy for mandatory cost center tagging
resource costTaggingPolicy 'Microsoft.Authorization/policyDefinitions@2021-06-01' = {
  name: 'require-cost-center-tag'
  
  properties: {
    displayName: 'Require Cost Center Tag'
    description: 'Enforces the presence of cost center tags on all resources'
    mode: 'All'
    
    policyRule: {
      if: {
        not: {
          field: 'tags[\'CostCenter\']'
          exists: 'true'
        }
      }
      then: {
        effect: 'audit'  // Change to 'deny' to enforce
      }
    }
    
    parameters: {}
  }
}

resource costTaggingAssignment 'Microsoft.Authorization/policyAssignments@2022-06-01' = {
  name: 'assign-cost-center-tag'
  
  properties: {
    displayName: 'Assign Cost Center Tag Policy'
    policyDefinitionId: costTaggingPolicy.id
    scope: resourceGroupId
    
    parameters: {}
  }
}

// ===== SCHEDULED COST REPORTS =====

resource weeklyCostReport 'Microsoft.CostManagement/scheduledActions@2022-10-01' = {
  name: 'weekly-cost-report-${environment}'
  
  properties: {
    displayName: 'Weekly Cost Report'
    
    fileDestination: {
      fileFormats: [
        'Csv'
      ]
    }
    
    notification: {
      to: [
        'finance@prepbettr.com'
        'ops@prepbettr.com'
        'dev-team@prepbettr.com'
      ]
      subject: 'PrepBettr Weekly Cost Report - ${environment}'
      message: 'Attached is the weekly cost breakdown for PrepBettr ${environment} environment.'
    }
    
    schedule: {
      frequency: 'Weekly'
      dayOfWeek: 'Monday'
      weeksOfMonth: null
      daysOfWeek: [
        'Monday'
      ]
      startDate: utcNow('yyyy-MM-dd')
      endDate: '2025-12-31'
    }
    
    scope: resourceGroupId
    
    viewId: '/subscriptions/${subscription().subscriptionId}/providers/Microsoft.CostManagement/views/DailyCosts'
  }
}

// ===== COST OPTIMIZATION POLICIES =====

// Auto-shutdown policy for development environment
resource devAutoShutdownPolicy 'Microsoft.Authorization/policyDefinitions@2021-06-01' = if (environment == 'dev') {
  name: 'dev-auto-shutdown-policy'
  
  properties: {
    displayName: 'Development Environment Auto-Shutdown'
    description: 'Automatically shuts down development resources during off-hours'
    mode: 'All'
    
    policyRule: {
      if: {
        allOf: [
          {
            field: 'type'
            in: [
              'Microsoft.Compute/virtualMachines'
              'Microsoft.Web/sites'
            ]
          }
          {
            field: 'tags[\'Environment\']'
            equals: 'dev'
          }
        ]
      }
      then: {
        effect: 'deployIfNotExists'
        details: {
          type: 'Microsoft.DevTestLab/schedules'
          roleDefinitionIds: [
            '/subscriptions/${subscription().subscriptionId}/providers/Microsoft.Authorization/roleDefinitions/b24988ac-6180-42a0-ab88-20f7382dd24c'  // Contributor
          ]
          deployment: {
            properties: {
              mode: 'Incremental'
              template: {
                '$schema': 'https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#'
                contentVersion: '1.0.0.0'
                resources: [
                  {
                    type: 'Microsoft.DevTestLab/schedules'
                    apiVersion: '2018-09-15'
                    name: 'shutdown-computevm-[parameters(\'vmName\')]'
                    location: '[resourceGroup().location]'
                    properties: {
                      status: 'Enabled'
                      taskType: 'ComputeVmShutdownTask'
                      dailyRecurrence: {
                        time: '1900'  // 7 PM
                      }
                      timeZoneId: 'UTC'
                      targetResourceId: '[parameters(\'vmResourceId\')]'
                    }
                  }
                ]
              }
            }
          }
        }
      }
    }
  }
}

// ===== OUTPUTS =====

output budgetId string = budget.id
output budgetName string = budget.name

output costOptimizationActions object = {
  logicAppId: costOptimizationLogicApp.id
  logicAppTriggerUrl: 'https://management.azure.com${costOptimizationLogicApp.id}/triggers/manual/listCallbackUrl?api-version=2019-05-01'
}

output costThresholds object = costThresholds

output costRecommendations array = [
  'Enable auto-shutdown for development resources during off-hours'
  'Use Azure Spot instances for non-critical workloads'
  'Implement Azure Reserved Instances for predictable workloads'
  'Use cool/archive storage tiers for infrequently accessed data'
  'Enable Cosmos DB autoscale instead of provisioned throughput'
  'Monitor and optimize Redis cache usage and sizing'
  'Use Azure CDN to reduce egress bandwidth costs'
  'Implement proper resource tagging for cost allocation'
  'Regular review of unused resources and zombie assets'
  'Consider Azure Functions consumption plan instead of dedicated plans'
]

output monthlyBudgetBreakdown object = {
  development: {
    budget: monthlyBudgetLimit
    expectedBreakdown: {
      cosmosDB: '30%'
      appService: '25%'
      redis: '20%'
      storage: '10%'
      functions: '10%'
      monitoring: '5%'
    }
  }
  
  production: {
    budget: monthlyBudgetLimit
    expectedBreakdown: {
      cosmosDB: '35%'
      appService: '25%'
      redis: '15%'
      storage: '10%'
      functions: '8%'
      monitoring: '4%'
      cdn: '3%'
    }
  }
}
