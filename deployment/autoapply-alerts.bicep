@description('Name of the Application Insights resource')
param applicationInsightsName string = 'prepbettr-insights'

@description('Resource group name')
param resourceGroupName string = resourceGroup().name

@description('Resource group location')
param location string = resourceGroup().location

@description('Email address for alert notifications')
param emailAddress string

@description('Slack webhook URL for notifications (optional)')
param slackWebhookUrl string = ''

@description('Teams webhook URL for notifications (optional)')
param teamsWebhookUrl string = ''

@description('Environment name (production, staging, development)')
@allowed(['production', 'staging', 'development'])
param environment string = 'production'

@description('Tags to apply to all resources')
param tags object = {
  environment: environment
  project: 'prepbettr'
  component: 'auto-apply-monitoring'
}

// Reference to existing Application Insights
resource applicationInsights 'Microsoft.Insights/components@2020-02-02' existing = {
  name: applicationInsightsName
}

// Action Group for Auto-Apply Alerts
resource autoApplyActionGroup 'Microsoft.Insights/actionGroups@2022-06-01' = {
  name: 'auto-apply-alerts'
  location: 'Global'
  tags: tags
  properties: {
    groupShortName: 'autoapply'
    enabled: true
    emailReceivers: [
      {
        name: 'AutoApply Email Alert'
        emailAddress: emailAddress
        useCommonAlertSchema: true
      }
    ]
    webhookReceivers: concat(
      slackWebhookUrl != '' ? [
        {
          name: 'Slack Auto-Apply Alert'
          serviceUri: slackWebhookUrl
          useCommonAlertSchema: true
        }
      ] : [],
      teamsWebhookUrl != '' ? [
        {
          name: 'Teams Auto-Apply Alert'
          serviceUri: teamsWebhookUrl
          useCommonAlertSchema: true
        }
      ] : []
    )
  }
}

// Alert 1: TheirStack Credit Usage Warning (80%)
resource theirStackCreditWarning 'Microsoft.Insights/scheduledQueryRules@2021-08-01' = {
  name: 'AutoApply-TheirStack-CreditUsage-Warning'
  location: location
  tags: tags
  properties: {
    displayName: 'Auto-Apply TheirStack Credit Usage Warning (80%)'
    description: 'Alert when TheirStack credit usage exceeds 80% of monthly quota'
    severity: 2
    enabled: true
    evaluationFrequency: 'PT15M'
    windowSize: 'PT15M'
    scopes: [
      applicationInsights.id
    ]
    criteria: {
      allOf: [
        {
          query: '''
            customMetrics
            | where name == "AutoApply.TheirStack.CreditsUsed"
            | where timestamp > ago(24h)
            | summarize TotalCreditsUsed = sum(value)
            | extend CreditsBudget = 1000 // Monthly budget
            | extend UsagePercentage = TotalCreditsUsed * 100.0 / CreditsBudget
            | where UsagePercentage >= 80
            | project UsagePercentage, TotalCreditsUsed, CreditsBudget
          '''
          timeAggregation: 'Maximum'
          metricMeasureColumn: 'UsagePercentage'
          operator: 'GreaterThanOrEqual'
          threshold: 80
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    actions: {
      actionGroups: [
        autoApplyActionGroup.id
      ]
      customProperties: {
        AlertType: 'TheirStackCreditWarning'
        Component: 'Auto-Apply'
        Environment: environment
        Threshold: '80%'
        Priority: 'Medium'
      }
    }
  }
}

// Alert 2: TheirStack Credit Usage Critical (95%)
resource theirStackCreditCritical 'Microsoft.Insights/scheduledQueryRules@2021-08-01' = {
  name: 'AutoApply-TheirStack-CreditUsage-Critical'
  location: location
  tags: tags
  properties: {
    displayName: 'Auto-Apply TheirStack Credit Usage Critical (95%)'
    description: 'Critical alert when TheirStack credit usage exceeds 95% of monthly quota'
    severity: 0
    enabled: true
    evaluationFrequency: 'PT5M'
    windowSize: 'PT5M'
    scopes: [
      applicationInsights.id
    ]
    criteria: {
      allOf: [
        {
          query: '''
            customMetrics
            | where name == "AutoApply.TheirStack.CreditsUsed"
            | where timestamp > ago(24h)
            | summarize TotalCreditsUsed = sum(value)
            | extend CreditsBudget = 1000 // Monthly budget
            | extend UsagePercentage = TotalCreditsUsed * 100.0 / CreditsBudget
            | where UsagePercentage >= 95
            | project UsagePercentage, TotalCreditsUsed, CreditsBudget
          '''
          timeAggregation: 'Maximum'
          metricMeasureColumn: 'UsagePercentage'
          operator: 'GreaterThanOrEqual'
          threshold: 95
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    actions: {
      actionGroups: [
        autoApplyActionGroup.id
      ]
      customProperties: {
        AlertType: 'TheirStackCreditCritical'
        Component: 'Auto-Apply'
        Environment: environment
        Threshold: '95%'
        Priority: 'Critical'
      }
    }
  }
}

// Alert 3: Browser Failure Rate High (>5% in 10 minutes)
resource browserFailureRate 'Microsoft.Insights/scheduledQueryRules@2021-08-01' = {
  name: 'AutoApply-Browser-FailureRate-High'
  location: location
  tags: tags
  properties: {
    displayName: 'Auto-Apply Browser Failure Rate High (>5%)'
    description: 'Alert when browser failure rate exceeds 5% in 10 minutes'
    severity: 1
    enabled: true
    evaluationFrequency: 'PT5M'
    windowSize: 'PT10M'
    scopes: [
      applicationInsights.id
    ]
    criteria: {
      allOf: [
        {
          query: '''
            customEvents
            | where timestamp > ago(10m)
            | where name in ("AutoApply.Application.Success", "AutoApply.Application.Failed")
            | extend Success = iff(name == "AutoApply.Application.Success", 1, 0)
            | summarize 
                TotalApplications = count(),
                FailedApplications = sum(1 - Success)
            | extend FailureRate = (FailedApplications * 100.0) / TotalApplications
            | where FailureRate > 5 and TotalApplications >= 10
            | project FailureRate, TotalApplications, FailedApplications
          '''
          timeAggregation: 'Maximum'
          metricMeasureColumn: 'FailureRate'
          operator: 'GreaterThan'
          threshold: 5
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    actions: {
      actionGroups: [
        autoApplyActionGroup.id
      ]
      customProperties: {
        AlertType: 'BrowserFailureRate'
        Component: 'Auto-Apply'
        Environment: environment
        Threshold: '5%'
        Priority: 'High'
      }
    }
  }
}

// Alert 4: Application Success Rate Low (<90% in 15 minutes)
resource applicationSuccessRate 'Microsoft.Insights/scheduledQueryRules@2021-08-01' = {
  name: 'AutoApply-Application-SuccessRate-Low'
  location: location
  tags: tags
  properties: {
    displayName: 'Auto-Apply Application Success Rate Low (<90%)'
    description: 'Alert when application success rate drops below 90% in 15 minutes'
    severity: 1
    enabled: true
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    scopes: [
      applicationInsights.id
    ]
    criteria: {
      allOf: [
        {
          query: '''
            customEvents
            | where timestamp > ago(15m)
            | where name in ("AutoApply.Application.Success", "AutoApply.Application.Failed")
            | extend Success = iff(name == "AutoApply.Application.Success", 1, 0)
            | summarize 
                TotalApplications = count(),
                SuccessfulApplications = sum(Success)
            | extend SuccessRate = (SuccessfulApplications * 100.0) / TotalApplications
            | where SuccessRate < 90 and TotalApplications >= 10
            | project SuccessRate, TotalApplications, SuccessfulApplications
          '''
          timeAggregation: 'Minimum'
          metricMeasureColumn: 'SuccessRate'
          operator: 'LessThan'
          threshold: 90
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    actions: {
      actionGroups: [
        autoApplyActionGroup.id
      ]
      customProperties: {
        AlertType: 'ApplicationSuccessRate'
        Component: 'Auto-Apply'
        Environment: environment
        Threshold: '90%'
        Priority: 'High'
      }
    }
  }
}

// Alert 5: Application Worker Function Errors
resource applicationWorkerErrors 'Microsoft.Insights/scheduledQueryRules@2021-08-01' = {
  name: 'AutoApply-ApplicationWorker-Errors'
  location: location
  tags: tags
  properties: {
    displayName: 'Auto-Apply Application Worker Function Errors'
    description: 'Alert on any exceptions in the applicationWorker function'
    severity: 1
    enabled: true
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    scopes: [
      applicationInsights.id
    ]
    criteria: {
      allOf: [
        {
          query: '''
            exceptions
            | where timestamp > ago(5m)
            | where operation_Name =~ "applicationWorker" or outerMessage contains "applicationWorker"
            | summarize ErrorCount = count(), 
                SampleError = any(outerMessage),
                ErrorTypes = make_set(type)
            | where ErrorCount >= 1
            | project ErrorCount, SampleError, ErrorTypes
          '''
          timeAggregation: 'Total'
          metricMeasureColumn: 'ErrorCount'
          operator: 'GreaterThanOrEqual'
          threshold: 1
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    actions: {
      actionGroups: [
        autoApplyActionGroup.id
      ]
      customProperties: {
        AlertType: 'ApplicationWorkerErrors'
        Component: 'Auto-Apply'
        Environment: environment
        Threshold: '1 error'
        Priority: 'High'
      }
    }
  }
}

// Alert 6: Queue Length High (>100 pending applications)
resource queueLengthHigh 'Microsoft.Insights/scheduledQueryRules@2021-08-01' = {
  name: 'AutoApply-Queue-Length-High'
  location: location
  tags: tags
  properties: {
    displayName: 'Auto-Apply Queue Length High (>100)'
    description: 'Alert when queue length exceeds 100 pending applications'
    severity: 2
    enabled: true
    evaluationFrequency: 'PT5M'
    windowSize: 'PT5M'
    scopes: [
      applicationInsights.id
    ]
    criteria: {
      allOf: [
        {
          query: '''
            customMetrics
            | where timestamp > ago(5m)
            | where name == "AutoApply.Queue.Length"
            | summarize MaxQueueLength = max(value)
            | where MaxQueueLength > 100
            | project MaxQueueLength
          '''
          timeAggregation: 'Maximum'
          metricMeasureColumn: 'MaxQueueLength'
          operator: 'GreaterThan'
          threshold: 100
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    actions: {
      actionGroups: [
        autoApplyActionGroup.id
      ]
      customProperties: {
        AlertType: 'QueueLengthHigh'
        Component: 'Auto-Apply'
        Environment: environment
        Threshold: '100 pending applications'
        Priority: 'Medium'
      }
    }
  }
}

// Alert 7: Browser Memory Usage High (>1GB average)
resource browserMemoryHigh 'Microsoft.Insights/scheduledQueryRules@2021-08-01' = {
  name: 'AutoApply-Browser-Memory-High'
  location: location
  tags: tags
  properties: {
    displayName: 'Auto-Apply Browser Memory Usage High (>1GB)'
    description: 'Alert when average browser memory usage exceeds 1GB'
    severity: 2
    enabled: true
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    scopes: [
      applicationInsights.id
    ]
    criteria: {
      allOf: [
        {
          query: '''
            customMetrics
            | where timestamp > ago(15m)
            | where name == "AutoApply.Browser.MemoryMb"
            | summarize AvgMemoryUsage = avg(value)
            | where AvgMemoryUsage > 1024
            | project AvgMemoryUsage
          '''
          timeAggregation: 'Average'
          metricMeasureColumn: 'AvgMemoryUsage'
          operator: 'GreaterThan'
          threshold: 1024
          failingPeriods: {
            numberOfEvaluationPeriods: 2
            minFailingPeriodsToAlert: 2
          }
        }
      ]
    }
    actions: {
      actionGroups: [
        autoApplyActionGroup.id
      ]
      customProperties: {
        AlertType: 'BrowserMemoryHigh'
        Component: 'Auto-Apply'
        Environment: environment
        Threshold: '1GB'
        Priority: 'Medium'
      }
    }
  }
}

// Alert 8: AI Screening Accuracy Low (<70%)
resource screeningAccuracyLow 'Microsoft.Insights/scheduledQueryRules@2021-08-01' = {
  name: 'AutoApply-Screening-Accuracy-Low'
  location: location
  tags: tags
  properties: {
    displayName: 'Auto-Apply AI Screening Accuracy Low (<70%)'
    description: 'Alert when AI screening accuracy drops below 70%'
    severity: 2
    enabled: true
    evaluationFrequency: 'PT15M'
    windowSize: 'PT30M'
    scopes: [
      applicationInsights.id
    ]
    criteria: {
      allOf: [
        {
          query: '''
            customMetrics
            | where timestamp > ago(30m)
            | where name == "AutoApply.Screening.Accuracy"
            | summarize AvgAccuracy = avg(value), SampleCount = count()
            | where AvgAccuracy < 70 and SampleCount >= 5
            | project AvgAccuracy, SampleCount
          '''
          timeAggregation: 'Average'
          metricMeasureColumn: 'AvgAccuracy'
          operator: 'LessThan'
          threshold: 70
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    actions: {
      actionGroups: [
        autoApplyActionGroup.id
      ]
      customProperties: {
        AlertType: 'ScreeningAccuracyLow'
        Component: 'Auto-Apply'
        Environment: environment
        Threshold: '70%'
        Priority: 'Medium'
      }
    }
  }
}

// Alert 9: TheirStack API Response Time High (>10 seconds)
resource theirStackResponseTimeSlow 'Microsoft.Insights/scheduledQueryRules@2021-08-01' = {
  name: 'AutoApply-TheirStack-ResponseTime-Slow'
  location: location
  tags: tags
  properties: {
    displayName: 'Auto-Apply TheirStack API Response Time Slow (>10s)'
    description: 'Alert when TheirStack API response times are consistently slow'
    severity: 2
    enabled: true
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    scopes: [
      applicationInsights.id
    ]
    criteria: {
      allOf: [
        {
          query: '''
            customMetrics
            | where timestamp > ago(15m)
            | where name == "AutoApply.TheirStack.ResponseTimeMs"
            | summarize AvgResponseTime = avg(value), SampleCount = count()
            | where AvgResponseTime > 10000 and SampleCount >= 3
            | project AvgResponseTime, SampleCount
          '''
          timeAggregation: 'Average'
          metricMeasureColumn: 'AvgResponseTime'
          operator: 'GreaterThan'
          threshold: 10000
          failingPeriods: {
            numberOfEvaluationPeriods: 2
            minFailingPeriodsToAlert: 2
          }
        }
      ]
    }
    actions: {
      actionGroups: [
        autoApplyActionGroup.id
      ]
      customProperties: {
        AlertType: 'TheirStackResponseTimeSlow'
        Component: 'Auto-Apply'
        Environment: environment
        Threshold: '10 seconds'
        Priority: 'Medium'
      }
    }
  }
}

// Alert 10: Daily Application Volume Anomaly
resource dailyVolumeAnomaly 'Microsoft.Insights/scheduledQueryRules@2021-08-01' = {
  name: 'AutoApply-Daily-Volume-Anomaly'
  location: location
  tags: tags
  properties: {
    displayName: 'Auto-Apply Daily Application Volume Anomaly'
    description: 'Alert when daily application volume is significantly different from normal'
    severity: 3
    enabled: true
    evaluationFrequency: 'PT1H'
    windowSize: 'PT2H'
    scopes: [
      applicationInsights.id
    ]
    criteria: {
      allOf: [
        {
          query: '''
            customMetrics
            | where timestamp > ago(2h)
            | where name == "AutoApply.Volume.DailyApplications"
            | summarize TotalApplications = sum(value)
            | extend ExpectedRange = iff(TotalApplications < 10 or TotalApplications > 500, 1, 0)
            | where ExpectedRange == 1
            | project TotalApplications, ExpectedRange
          '''
          timeAggregation: 'Total'
          metricMeasureColumn: 'ExpectedRange'
          operator: 'GreaterThanOrEqual'
          threshold: 1
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    actions: {
      actionGroups: [
        autoApplyActionGroup.id
      ]
      customProperties: {
        AlertType: 'DailyVolumeAnomaly'
        Component: 'Auto-Apply'
        Environment: environment
        Threshold: 'Outside 10-500 range'
        Priority: 'Low'
      }
    }
  }
}

// Outputs
output actionGroupId string = autoApplyActionGroup.id
output alertRuleNames array = [
  theirStackCreditWarning.name
  theirStackCreditCritical.name
  browserFailureRate.name
  applicationSuccessRate.name
  applicationWorkerErrors.name
  queueLengthHigh.name
  browserMemoryHigh.name
  screeningAccuracyLow.name
  theirStackResponseTimeSlow.name
  dailyVolumeAnomaly.name
]
