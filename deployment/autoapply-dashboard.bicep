@description('Name of the Application Insights resource')
param applicationInsightsName string = 'prepbettr-insights'

@description('Resource group location')
param location string = resourceGroup().location

@description('Tags to apply to resources')
param tags object = {
  environment: 'production'
  project: 'prepbettr'
  component: 'monitoring'
}

// Reference to existing Application Insights
resource applicationInsights 'Microsoft.Insights/components@2020-02-02' existing = {
  name: applicationInsightsName
}

// Auto-Apply Production Monitoring Dashboard
resource autoApplyDashboard 'Microsoft.Insights/workbooks@2021-08-01' = {
  name: 'auto-apply-production-dashboard'
  location: location
  tags: tags
  kind: 'shared'
  properties: {
    displayName: '🤖 Auto-Apply with AI - Production Monitoring'
    description: 'Comprehensive monitoring dashboard for Auto-Apply automation system including application success rates, browser resource usage, AI screening accuracy, and TheirStack API costs.'
    serializedData: loadTextContent('../monitoring/autoapply-dashboard.json')
    category: 'workbook'
    sourceId: applicationInsights.id
    version: '1.0'
  }
}

// Output the dashboard resource ID for reference
output dashboardId string = autoApplyDashboard.id
output dashboardUrl string = 'https://portal.azure.com/#@{tenant().tenantId}/resource${autoApplyDashboard.id}/workbook'
