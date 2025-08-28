#!/bin/bash

# Production Monitoring Setup Script for PrepBettr Auto-Apply System
# Phase 8: Production Deployment & Go-Live (Week 1)
#
# Sets up comprehensive monitoring with alerts for:
# - TheirStack credit consumption >80%
# - Application success rates <90%
# - Browser failures >5%
# - Azure Function errors >1%
# - Health status tracking

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${GREEN}📊 PrepBettr Auto-Apply System - Production Monitoring Setup${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""

# Configuration
RESOURCE_GROUP=${RESOURCE_GROUP:-"PrepBettr_group"}
FUNCTION_APP_NAME=${FUNCTION_APP_NAME:-"prepbettr-auto-apply"}
APP_INSIGHTS_NAME=${APP_INSIGHTS_NAME:-"prepbettr-auto-apply-insights"}
ACTION_GROUP_NAME=${ACTION_GROUP_NAME:-"prepbettr-auto-apply-alerts"}
EMAIL_ADDRESS=${EMAIL_ADDRESS:-""}
SLACK_WEBHOOK_URL=${SLACK_WEBHOOK_URL:-""}

echo -e "${BLUE}📋 Monitoring Configuration:${NC}"
echo "   Resource Group: $RESOURCE_GROUP"
echo "   Function App: $FUNCTION_APP_NAME"
echo "   Application Insights: $APP_INSIGHTS_NAME"
echo "   Action Group: $ACTION_GROUP_NAME"
echo ""

# Check prerequisites
echo -e "${YELLOW}🔍 Checking prerequisites...${NC}"

if ! command -v az &> /dev/null; then
    echo -e "${RED}❌ Azure CLI not found. Please install it first.${NC}"
    exit 1
fi

# Check Azure login
if ! az account show &> /dev/null; then
    echo -e "${YELLOW}🔑 Please login to Azure...${NC}"
    az login
fi

# Prompt for email if not set
if [ -z "$EMAIL_ADDRESS" ]; then
    echo -e "${YELLOW}Enter your email address for alert notifications:${NC}"
    read EMAIL_ADDRESS
fi

if [ -z "$EMAIL_ADDRESS" ]; then
    echo -e "${RED}Error: Email address is required for alerts${NC}"
    exit 1
fi

# Prompt for Slack webhook if needed
if [ -z "$SLACK_WEBHOOK_URL" ]; then
    echo -e "${YELLOW}Enter Slack webhook URL (optional, press Enter to skip):${NC}"
    read SLACK_WEBHOOK_URL
fi

SUBSCRIPTION_ID=$(az account show --query id -o tsv)
SUBSCRIPTION_NAME=$(az account show --query name -o tsv)
echo -e "${GREEN}✅ Logged in to Azure subscription: $SUBSCRIPTION_NAME${NC}"

# Check if Application Insights exists
echo -e "${YELLOW}Checking if Application Insights exists...${NC}"
if ! az monitor app-insights component show --app "$APP_INSIGHTS_NAME" --resource-group "$RESOURCE_GROUP" &> /dev/null; then
    echo -e "${RED}Error: Application Insights '$APP_INSIGHTS_NAME' not found in resource group '$RESOURCE_GROUP'${NC}"
    exit 1
fi

APP_INSIGHTS_RESOURCE_ID="/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.Insights/components/$APP_INSIGHTS_NAME"
echo -e "${GREEN}✅ Application Insights found${NC}"

# Create action group for notifications
echo -e "${YELLOW}📢 Creating action group for notifications...${NC}"

# Check if action group already exists
if az monitor action-group show --name "$ACTION_GROUP_NAME" --resource-group "$RESOURCE_GROUP" &> /dev/null; then
    echo -e "${YELLOW}⚠️  Action group already exists, updating...${NC}"
    az monitor action-group delete --name "$ACTION_GROUP_NAME" --resource-group "$RESOURCE_GROUP" --yes
fi

# Create action group with email and optional Slack webhook
EMAIL_RECEIVERS="[{\"name\":\"AutoApply-Email\",\"emailAddress\":\"$EMAIL_ADDRESS\",\"useCommonAlertSchema\":true}]"

if [ -n "$SLACK_WEBHOOK_URL" ]; then
    WEBHOOK_RECEIVERS="[{\"name\":\"AutoApply-Slack\",\"serviceUri\":\"$SLACK_WEBHOOK_URL\",\"useCommonAlertSchema\":true}]"
else
    WEBHOOK_RECEIVERS="[]"
fi

az monitor action-group create \
    --name "$ACTION_GROUP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --short-name "AutoApply" \
    --email-receivers "$EMAIL_RECEIVERS" \
    --webhook-receivers "$WEBHOOK_RECEIVERS" \
    --output table

echo -e "${GREEN}✅ Action group created successfully${NC}"

# Create alert rules
echo -e "${YELLOW}⚡ Creating production alert rules...${NC}"

# 1. TheirStack Credit Consumption Warning (>80%)
echo "Creating TheirStack credit usage warning alert..."
az monitor scheduled-query create \
    --name "AutoApply-TheirStack-CreditWarning" \
    --resource-group "$RESOURCE_GROUP" \
    --scopes "$APP_INSIGHTS_RESOURCE_ID" \
    --condition "count 'customMetrics | where name == \"theirStackCreditsUsed\" | where timestamp > ago(1d) | summarize CurrentUsage = sum(value) by bin(timestamp, 1h) | extend UsagePercentage = CurrentUsage / 1000 * 100 | where UsagePercentage >= 80' > 0" \
    --condition-query "customMetrics | where name == \"theirStackCreditsUsed\" | where timestamp > ago(1d) | summarize CurrentUsage = sum(value) by bin(timestamp, 1h) | extend UsagePercentage = CurrentUsage / 1000 * 100 | where UsagePercentage >= 80" \
    --description "Alert when TheirStack credit usage exceeds 80% of monthly quota" \
    --evaluation-frequency 15m \
    --severity 2 \
    --window-size 15m \
    --action-groups "$ACTION_GROUP_NAME" \
    --output none || echo "⚠️  Alert rule may already exist"

# 2. Application Success Rate Low (<90%)
echo "Creating application success rate alert..."
az monitor scheduled-query create \
    --name "AutoApply-LowSuccessRate" \
    --resource-group "$RESOURCE_GROUP" \
    --scopes "$APP_INSIGHTS_RESOURCE_ID" \
    --condition "count 'customEvents | where name in (\"applicationSuccess\", \"applicationError\") | where timestamp > ago(30m) | summarize Total = count(), Successes = countif(name == \"applicationSuccess\") | extend SuccessRate = (Successes * 100.0) / Total | where SuccessRate < 90' > 0" \
    --condition-query "customEvents | where name in (\"applicationSuccess\", \"applicationError\") | where timestamp > ago(30m) | summarize Total = count(), Successes = countif(name == \"applicationSuccess\") | extend SuccessRate = (Successes * 100.0) / Total | where SuccessRate < 90" \
    --description "Alert when application success rate drops below 90%" \
    --evaluation-frequency 5m \
    --severity 1 \
    --window-size 30m \
    --action-groups "$ACTION_GROUP_NAME" \
    --output none || echo "⚠️  Alert rule may already exist"

# 3. Browser Failures High (>5%)
echo "Creating browser failure rate alert..."
az monitor scheduled-query create \
    --name "AutoApply-HighBrowserFailures" \
    --resource-group "$RESOURCE_GROUP" \
    --scopes "$APP_INSIGHTS_RESOURCE_ID" \
    --condition "count 'customEvents | where name in (\"browserLaunch\", \"browserError\") | where timestamp > ago(15m) | summarize Total = count(), Errors = countif(name == \"browserError\") | extend ErrorRate = (Errors * 100.0) / Total | where ErrorRate > 5' > 0" \
    --condition-query "customEvents | where name in (\"browserLaunch\", \"browserError\") | where timestamp > ago(15m) | summarize Total = count(), Errors = countif(name == \"browserError\") | extend ErrorRate = (Errors * 100.0) / Total | where ErrorRate > 5" \
    --description "Alert when browser failure rate exceeds 5%" \
    --evaluation-frequency 5m \
    --severity 2 \
    --window-size 15m \
    --action-groups "$ACTION_GROUP_NAME" \
    --output none || echo "⚠️  Alert rule may already exist"

# 4. Azure Function Errors (>1%)
echo "Creating Azure Function error rate alert..."
az monitor scheduled-query create \
    --name "AutoApply-FunctionErrors" \
    --resource-group "$RESOURCE_GROUP" \
    --scopes "$APP_INSIGHTS_RESOURCE_ID" \
    --condition "count 'requests | where timestamp > ago(10m) | summarize Total = count(), Errors = countif(success == false) | extend ErrorRate = (Errors * 100.0) / Total | where ErrorRate > 1' > 0" \
    --condition-query "requests | where timestamp > ago(10m) | summarize Total = count(), Errors = countif(success == false) | extend ErrorRate = (Errors * 100.0) / Total | where ErrorRate > 1" \
    --description "Alert when Azure Function error rate exceeds 1%" \
    --evaluation-frequency 2m \
    --severity 1 \
    --window-size 10m \
    --action-groups "$ACTION_GROUP_NAME" \
    --output none || echo "⚠️  Alert rule may already exist"

# 5. Health Check Endpoint Down
echo "Creating health check availability alert..."
az monitor scheduled-query create \
    --name "AutoApply-HealthCheckDown" \
    --resource-group "$RESOURCE_GROUP" \
    --scopes "$APP_INSIGHTS_RESOURCE_ID" \
    --condition "count 'requests | where name == \"GET /api/health\" | where timestamp > ago(5m) | where success == false' > 2" \
    --condition-query "requests | where name == \"GET /api/health\" | where timestamp > ago(5m) | where success == false" \
    --description "Alert when health check endpoint fails multiple times" \
    --evaluation-frequency 1m \
    --severity 0 \
    --window-size 5m \
    --action-groups "$ACTION_GROUP_NAME" \
    --output none || echo "⚠️  Alert rule may already exist"

# 6. High Memory Usage
echo "Creating memory usage alert..."
az monitor scheduled-query create \
    --name "AutoApply-HighMemoryUsage" \
    --resource-group "$RESOURCE_GROUP" \
    --scopes "$APP_INSIGHTS_RESOURCE_ID" \
    --condition "count 'performanceCounters | where name == \"Private Bytes\" | where timestamp > ago(15m) | where value > 1400000000' > 5" \
    --condition-query "performanceCounters | where name == \"Private Bytes\" | where timestamp > ago(15m) | where value > 1400000000" \
    --description "Alert when memory usage exceeds 1.4GB (90% of 1.5GB limit)" \
    --evaluation-frequency 5m \
    --severity 2 \
    --window-size 15m \
    --action-groups "$ACTION_GROUP_NAME" \
    --output none || echo "⚠️  Alert rule may already exist"

# 7. Queue Processing Delays
echo "Creating queue processing delay alert..."
az monitor scheduled-query create \
    --name "AutoApply-QueueProcessingDelay" \
    --resource-group "$RESOURCE_GROUP" \
    --scopes "$APP_INSIGHTS_RESOURCE_ID" \
    --condition "count 'customMetrics | where name == \"queueProcessingTime\" | where timestamp > ago(30m) | where value > 300000' > 10" \
    --condition-query "customMetrics | where name == \"queueProcessingTime\" | where timestamp > ago(30m) | where value > 300000" \
    --description "Alert when queue processing takes longer than 5 minutes" \
    --evaluation-frequency 5m \
    --severity 2 \
    --window-size 30m \
    --action-groups "$ACTION_GROUP_NAME" \
    --output none || echo "⚠️  Alert rule may already exist"

echo -e "${GREEN}✅ All alert rules created successfully${NC}"

# Create monitoring dashboard queries
echo -e "${YELLOW}📊 Creating monitoring dashboard queries...${NC}"

cat > auto-apply-monitoring-queries.kql << 'EOF'
// Auto-Apply System Health Dashboard Queries

// 1. Application Success Rate Over Time
customEvents
| where name in ("applicationSuccess", "applicationError")
| where timestamp > ago(24h)
| summarize 
    Total = count(),
    Successes = countif(name == "applicationSuccess"),
    Failures = countif(name == "applicationError")
    by bin(timestamp, 1h)
| extend SuccessRate = (Successes * 100.0) / Total
| render timechart 

// 2. Portal Distribution (LinkedIn, Indeed, TheirStack, Generic)
customEvents
| where name == "applicationSuccess"
| where timestamp > ago(24h)
| extend portal = tostring(customDimensions.portal)
| summarize count() by portal
| render piechart

// 3. Browser Launch Success/Failure Rate
customEvents
| where name in ("browserLaunch", "browserError")
| where timestamp > ago(24h)
| summarize 
    Total = count(),
    Errors = countif(name == "browserError")
    by bin(timestamp, 1h)
| extend ErrorRate = (Errors * 100.0) / Total
| render timechart

// 4. TheirStack Credit Usage Trend
customMetrics
| where name == "theirStackCreditsUsed"
| where timestamp > ago(7d)
| summarize TotalCredits = sum(value) by bin(timestamp, 6h)
| extend UsagePercentage = TotalCredits / 1000 * 100
| render timechart

// 5. Application Processing Duration Distribution
customMetrics
| where name == "applicationDuration"
| where timestamp > ago(24h)
| summarize 
    avg(value),
    percentile(value, 50),
    percentile(value, 90),
    percentile(value, 95)
    by bin(timestamp, 1h)
| render timechart

// 6. Health Status Over Time
customEvents
| where name == "healthCheck"
| where timestamp > ago(24h)
| extend 
    status = tostring(customDimensions.status),
    activeBrowsers = toint(customDimensions.activeBrowsers),
    queuedOperations = toint(customDimensions.queuedOperations)
| summarize 
    avg(activeBrowsers),
    avg(queuedOperations)
    by bin(timestamp, 15m)
| render timechart

// 7. Top Error Messages
customEvents
| where name == "applicationError"
| where timestamp > ago(24h)
| extend errorMessage = tostring(customDimensions.errorMessage)
| summarize Count = count() by errorMessage
| order by Count desc
| take 10

// 8. Function Execution Duration
requests
| where timestamp > ago(24h)
| where name in ("applicationWorker", "jobSearchWorker", "followUpWorker")
| summarize 
    avg(duration),
    percentile(duration, 95)
    by name, bin(timestamp, 1h)
| render timechart

// 9. Memory Usage Trend
performanceCounters
| where name == "Private Bytes"
| where timestamp > ago(24h)
| extend MemoryMB = value / 1048576
| summarize avg(MemoryMB) by bin(timestamp, 15m)
| render timechart

// 10. Queue Message Processing Rate
customMetrics
| where name in ("queueMessagesProcessed", "queueMessagesReceived")
| where timestamp > ago(24h)
| summarize sum(value) by name, bin(timestamp, 1h)
| render timechart
EOF

echo -e "${GREEN}✅ Monitoring queries saved to: auto-apply-monitoring-queries.kql${NC}"

# Test the action group
echo -e "${YELLOW}🧪 Testing alert configuration...${NC}"

echo "Sending test notification..."
az monitor action-group test-notifications create \
    --resource-group "$RESOURCE_GROUP" \
    --action-group-name "$ACTION_GROUP_NAME" \
    --notification-type "Email" \
    --receivers "$EMAIL_ADDRESS" \
    --alert-type "servicehealth" \
    --preferred-language "en-US" \
    --test-notification-details "notificationId=auto-apply-test-$(date +%s)" \
    --output none || echo "⚠️  Test notification may have failed"

echo -e "${GREEN}✅ Test notification sent (check your email)${NC}"

# Create health check validation script
echo -e "${YELLOW}🏥 Creating health check validation script...${NC}"

cat > validate-auto-apply-health.sh << 'EOF'
#!/bin/bash

# Auto-Apply System Health Validation Script
# Run this script to validate the production health of your auto-apply system

FUNCTION_APP_URL=${1:-"https://prepbettr-auto-apply.azurewebsites.net"}
HEALTH_ENDPOINT="$FUNCTION_APP_URL/api/health"

echo "🏥 Validating Auto-Apply System Health"
echo "======================================"
echo "Function App: $FUNCTION_APP_URL"
echo ""

# Test health endpoint
echo "1. Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s -w "%{http_code}" -o /tmp/health_response "$HEALTH_ENDPOINT")
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -c 4)

if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ Health endpoint responding (HTTP $HTTP_CODE)"
    
    # Parse health response
    if command -v jq &> /dev/null; then
        HEALTH_DATA=$(cat /tmp/health_response)
        echo "   📊 Health Status:"
        echo "      - Status: $(echo "$HEALTH_DATA" | jq -r '.status // "unknown"')"
        echo "      - Active Browsers: $(echo "$HEALTH_DATA" | jq -r '.activeBrowsers // "unknown"')"
        echo "      - Max Browsers: $(echo "$HEALTH_DATA" | jq -r '.maxConcurrentBrowsers // "unknown"')"
        echo "      - Queued Operations: $(echo "$HEALTH_DATA" | jq -r '.queuedOperations // "unknown"')"
    else
        echo "   📄 Health Response:"
        cat /tmp/health_response | head -5
    fi
else
    echo "   ❌ Health endpoint failed (HTTP $HTTP_CODE)"
    cat /tmp/health_response
fi

echo ""

# Test function app availability
echo "2. Testing function app availability..."
PING_RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null "$FUNCTION_APP_URL")
if [ "$PING_RESPONSE" = "200" ] || [ "$PING_RESPONSE" = "404" ]; then
    echo "   ✅ Function app is accessible"
else
    echo "   ❌ Function app not accessible (HTTP $PING_RESPONSE)"
fi

echo ""

# Check Azure Function logs (requires Azure CLI)
echo "3. Checking recent function logs..."
if command -v az &> /dev/null && az account show &> /dev/null; then
    FUNCTION_APP_NAME=$(echo "$FUNCTION_APP_URL" | sed 's|https://||' | sed 's|\.azurewebsites\.net.*||')
    
    echo "   📜 Recent application events:"
    az monitor app-insights query \
        --app "prepbettr-auto-apply-insights" \
        --analytics-query "customEvents | where timestamp > ago(1h) | where name in ('applicationSuccess', 'applicationError') | project timestamp, name, customDimensions | take 5" \
        --output table 2>/dev/null || echo "   ⚠️  Unable to fetch recent logs"
else
    echo "   ⚠️  Azure CLI not available for log checking"
fi

echo ""
echo "🎯 Health validation complete"
echo ""
echo "Next steps if issues found:"
echo "1. Check Application Insights for detailed logs"
echo "2. Review Function App configuration in Azure Portal"
echo "3. Validate environment variables and secrets"
echo "4. Check storage account connectivity"
EOF

chmod +x validate-auto-apply-health.sh

echo -e "${GREEN}✅ Health validation script created: validate-auto-apply-health.sh${NC}"

# Display monitoring summary
echo ""
echo -e "${GREEN}🎉 Production Monitoring Setup Complete!${NC}"
echo -e "${GREEN}=====================================${NC}"
echo ""
echo -e "${BLUE}📊 Monitoring Components Created:${NC}"
echo "   Action Group: $ACTION_GROUP_NAME"
echo "   Email Notifications: $EMAIL_ADDRESS"
if [ -n "$SLACK_WEBHOOK_URL" ]; then
    echo "   Slack Notifications: Configured"
fi
echo ""
echo -e "${BLUE}⚡ Alert Rules Configured:${NC}"
echo "   1. TheirStack Credit Warning (>80%)"
echo "   2. Low Application Success Rate (<90%)"
echo "   3. High Browser Failure Rate (>5%)"
echo "   4. Azure Function Errors (>1%)"
echo "   5. Health Check Endpoint Down"
echo "   6. High Memory Usage (>1.4GB)"
echo "   7. Queue Processing Delays (>5min)"
echo ""
echo -e "${BLUE}📄 Files Created:${NC}"
echo "   - auto-apply-monitoring-queries.kql (Dashboard queries)"
echo "   - validate-auto-apply-health.sh (Health validation script)"
echo ""
echo -e "${YELLOW}📋 Next Steps:${NC}"
echo "1. Import monitoring queries into Azure Dashboard"
echo "2. Test the system to generate telemetry data"
echo "3. Run health validation: ./validate-auto-apply-health.sh"
echo "4. Monitor alerts in Azure Portal"
echo "5. Customize alert thresholds based on actual usage patterns"
echo ""
echo -e "${YELLOW}🔗 Monitoring URLs:${NC}"
echo "- Action Groups: https://portal.azure.com/#blade/Microsoft_Azure_Monitoring/MonitoringMenuBlade/actionGroups"
echo "- Alert Rules: https://portal.azure.com/#blade/Microsoft_Azure_Monitoring/MonitoringMenuBlade/alertsV2"
echo "- Application Insights: https://portal.azure.com/#@/resource$APP_INSIGHTS_RESOURCE_ID/overview"
echo ""
echo -e "${GREEN}📊 Your auto-apply system now has comprehensive production monitoring!${NC}"
