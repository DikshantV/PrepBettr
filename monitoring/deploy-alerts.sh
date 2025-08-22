#!/bin/bash

# Deploy Azure Alert Rules and Action Groups for Configuration Monitoring
# This script deploys all the monitoring alerts defined in azure-alert-rules.json

set -e

# Configuration - Update these values for your environment
SUBSCRIPTION_ID=${AZURE_SUBSCRIPTION_ID:-"your-subscription-id"}
RESOURCE_GROUP=${AZURE_RESOURCE_GROUP:-"prepbettr-rg"}
APP_INSIGHTS_NAME=${APP_INSIGHTS_NAME:-"prepbettr-insights"}
SLACK_WEBHOOK_URL=${SLACK_WEBHOOK_URL:-""}
SLACK_CRITICAL_WEBHOOK_URL=${SLACK_CRITICAL_WEBHOOK_URL:-""}
LOCATION=${AZURE_LOCATION:-"East US"}

echo "Deploying Configuration Monitoring Alerts..."
echo "Subscription: $SUBSCRIPTION_ID"
echo "Resource Group: $RESOURCE_GROUP"
echo "App Insights: $APP_INSIGHTS_NAME"

# Set the subscription
az account set --subscription "$SUBSCRIPTION_ID"

# Create Action Groups
echo "Creating Action Groups..."

# Create standard alerts action group
az monitor action-group create \
  --resource-group "$RESOURCE_GROUP" \
  --name "ConfigAlerts" \
  --short-name "ConfigAlert" \
  --action email dev-team dev-team@prepbettr.com \
  --action webhook slack-webhook "$SLACK_WEBHOOK_URL" \
  --tags Purpose=ConfigMonitoring Environment=Production

# Create critical alerts action group
az monitor action-group create \
  --resource-group "$RESOURCE_GROUP" \
  --name "ConfigCriticalAlerts" \
  --short-name "ConfigCrit" \
  --action email dev-team dev-team@prepbettr.com \
  --action email oncall oncall@prepbettr.com \
  --action sms oncall 1 "+1234567890" \
  --action webhook slack-critical "$SLACK_CRITICAL_WEBHOOK_URL" \
  --tags Purpose=ConfigMonitoring Environment=Production Priority=Critical

# Get the Application Insights resource ID
APP_INSIGHTS_ID="/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.Insights/components/$APP_INSIGHTS_NAME"
ACTION_GROUP_ID="/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP/providers/microsoft.insights/actionGroups/ConfigAlerts"
CRITICAL_ACTION_GROUP_ID="/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP/providers/microsoft.insights/actionGroups/ConfigCriticalAlerts"

echo "Creating Alert Rules..."

# 1. Configuration Drift Detection Alert
az monitor scheduled-query create \
  --resource-group "$RESOURCE_GROUP" \
  --name "ConfigDriftDetected" \
  --description "Alert when configuration drift is detected between Azure and Firebase" \
  --scopes "$APP_INSIGHTS_ID" \
  --condition "count 'Heartbeat' > 0" \
  --condition-query "customEvents | where name == \"Config.Drift.Detection\" | where customMeasurements.driftCount > 0 | summarize count() by bin(timestamp, 5m)" \
  --evaluation-frequency 5m \
  --window-size 5m \
  --severity 2 \
  --action "$ACTION_GROUP_ID" \
  --tags Purpose=ConfigMonitoring AlertType=Drift

# 2. High Error Rate Alert
az monitor scheduled-query create \
  --resource-group "$RESOURCE_GROUP" \
  --name "ConfigHighErrorRate" \
  --description "Alert when configuration service error rate exceeds 5%" \
  --scopes "$APP_INSIGHTS_ID" \
  --condition "count 'Heartbeat' > 0" \
  --condition-query "requests | where name startswith \"Config-\" | summarize TotalRequests = count(), FailedRequests = countif(success == false) by bin(timestamp, 5m) | extend ErrorRate = FailedRequests * 100.0 / TotalRequests | where ErrorRate > 5" \
  --evaluation-frequency 5m \
  --window-size 10m \
  --severity 1 \
  --action "$ACTION_GROUP_ID" \
  --tags Purpose=ConfigMonitoring AlertType=ErrorRate

# 3. High Latency Alert
az monitor scheduled-query create \
  --resource-group "$RESOURCE_GROUP" \
  --name "ConfigHighLatency" \
  --description "Alert when configuration service P95 latency exceeds 1000ms" \
  --scopes "$APP_INSIGHTS_ID" \
  --condition "count 'Heartbeat' > 0" \
  --condition-query "requests | where name startswith \"Config-\" | summarize P95Latency = percentile(duration, 95) by bin(timestamp, 5m) | where P95Latency > 1000" \
  --evaluation-frequency 5m \
  --window-size 10m \
  --severity 2 \
  --action "$ACTION_GROUP_ID" \
  --tags Purpose=ConfigMonitoring AlertType=Latency

# 4. Firebase Sync Failures Alert
az monitor scheduled-query create \
  --resource-group "$RESOURCE_GROUP" \
  --name "ConfigSyncFailures" \
  --description "Alert when Firebase synchronization fails" \
  --scopes "$APP_INSIGHTS_ID" \
  --condition "count 'Heartbeat' > 0" \
  --condition-query "dependencies | where type == \"Firebase\" and name == \"Config.Sync\" | summarize SyncFailures = countif(success == false) by bin(timestamp, 5m) | where SyncFailures > 0" \
  --evaluation-frequency 5m \
  --window-size 10m \
  --severity 1 \
  --action "$ACTION_GROUP_ID" \
  --tags Purpose=ConfigMonitoring AlertType=Sync

# 5. Low Cache Hit Ratio Alert
az monitor scheduled-query create \
  --resource-group "$RESOURCE_GROUP" \
  --name "ConfigCacheLowHitRatio" \
  --description "Alert when configuration cache hit ratio drops below 80%" \
  --scopes "$APP_INSIGHTS_ID" \
  --condition "count 'Heartbeat' > 0" \
  --condition-query "customEvents | where name == \"Config.Cache.Access\" | extend Hit = tobool(customDimensions.hit) | summarize CacheHits = countif(Hit == true), TotalAccess = count() by bin(timestamp, 10m) | extend HitRatio = CacheHits * 100.0 / TotalAccess | where HitRatio < 80" \
  --evaluation-frequency 10m \
  --window-size 15m \
  --severity 3 \
  --action "$ACTION_GROUP_ID" \
  --tags Purpose=ConfigMonitoring AlertType=Cache

# 6. Health Check Failure Alert (Critical)
az monitor scheduled-query create \
  --resource-group "$RESOURCE_GROUP" \
  --name "ConfigServiceHealthCheck" \
  --description "Alert when configuration service health check fails" \
  --scopes "$APP_INSIGHTS_ID" \
  --condition "count 'Heartbeat' > 0" \
  --condition-query "requests | where url contains \"/health\" | where name contains \"Config\" | summarize UnhealthyCount = countif(resultCode >= 500) by bin(timestamp, 5m) | where UnhealthyCount > 0" \
  --evaluation-frequency 5m \
  --window-size 5m \
  --severity 0 \
  --action "$CRITICAL_ACTION_GROUP_ID" \
  --tags Purpose=ConfigMonitoring AlertType=Health Priority=Critical

echo "Alert Rules deployment completed successfully!"
echo ""
echo "Created Alert Rules:"
echo "1. ConfigDriftDetected - Monitors configuration drift"
echo "2. ConfigHighErrorRate - Monitors error rates > 5%"
echo "3. ConfigHighLatency - Monitors P95 latency > 1000ms"
echo "4. ConfigSyncFailures - Monitors Firebase sync failures"
echo "5. ConfigCacheLowHitRatio - Monitors cache hit ratio < 80%"
echo "6. ConfigServiceHealthCheck - Monitors health check failures"
echo ""
echo "Next steps:"
echo "1. Update email addresses and phone numbers in action groups"
echo "2. Configure Slack webhook URLs in environment variables"
echo "3. Test alerts using the monitoring service test endpoints"
echo "4. Review and adjust alert thresholds as needed"
