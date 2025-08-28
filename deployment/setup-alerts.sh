#!/bin/bash

# Application Insights Alerts Setup Script for TheirStack Integration
# Phase 1: Production Monitoring Configuration

set -e

# Configuration variables
RESOURCE_GROUP="PrepBettr-Production"     # Update with your resource group name
APPINSIGHTS_NAME="prepbettr-insights"     # Update with your Application Insights name
ACTION_GROUP_NAME="prepbettr-alerts"     # Update with desired action group name
EMAIL_ADDRESS=""                          # Update with your email address
SLACK_WEBHOOK_URL=""                      # Optional: Update with your Slack webhook URL
SUBSCRIPTION_ID=""                        # Update with your subscription ID

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== TheirStack Application Insights Alerts Setup ===${NC}"
echo "Resource Group: $RESOURCE_GROUP"
echo "Application Insights: $APPINSIGHTS_NAME"
echo "Action Group: $ACTION_GROUP_NAME"
echo

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

# Validate Azure CLI is logged in
echo -e "${YELLOW}Checking Azure CLI authentication...${NC}"
if ! az account show &> /dev/null; then
    echo -e "${RED}Error: Not logged in to Azure CLI. Please run 'az login' first.${NC}"
    exit 1
fi

# Set subscription if provided
if [ -n "$SUBSCRIPTION_ID" ]; then
    echo -e "${YELLOW}Setting subscription to $SUBSCRIPTION_ID...${NC}"
    az account set --subscription "$SUBSCRIPTION_ID"
fi

# Check if Application Insights exists
echo -e "${YELLOW}Checking if Application Insights exists...${NC}"
if ! az monitor app-insights component show --app "$APPINSIGHTS_NAME" --resource-group "$RESOURCE_GROUP" &> /dev/null; then
    echo -e "${RED}Error: Application Insights '$APPINSIGHTS_NAME' not found in resource group '$RESOURCE_GROUP'${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Application Insights found${NC}"

# Deploy alerts using ARM template
echo -e "${YELLOW}Deploying Application Insights alerts...${NC}"

DEPLOYMENT_NAME="theirstack-alerts-$(date +%Y%m%d-%H%M%S)"

# Prepare parameters for ARM template deployment
PARAMETERS="emailAddress=$EMAIL_ADDRESS"
PARAMETERS="$PARAMETERS applicationInsightsName=$APPINSIGHTS_NAME"
PARAMETERS="$PARAMETERS resourceGroupName=$RESOURCE_GROUP"
PARAMETERS="$PARAMETERS actionGroupName=$ACTION_GROUP_NAME"

if [ -n "$SLACK_WEBHOOK_URL" ]; then
    PARAMETERS="$PARAMETERS slackWebhookUrl=$SLACK_WEBHOOK_URL"
fi

# Deploy ARM template
az deployment group create \
    --resource-group "$RESOURCE_GROUP" \
    --template-file "appinsights-alerts.json" \
    --parameters $PARAMETERS \
    --name "$DEPLOYMENT_NAME" \
    --verbose

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Successfully deployed Application Insights alerts${NC}"
else
    echo -e "${RED}✗ Failed to deploy alerts${NC}"
    exit 1
fi

# Get deployment outputs
echo -e "${YELLOW}Retrieving deployment information...${NC}"
DEPLOYMENT_OUTPUT=$(az deployment group show \
    --resource-group "$RESOURCE_GROUP" \
    --name "$DEPLOYMENT_NAME" \
    --query "properties.outputs" \
    --output json)

# Display created alerts
echo -e "${GREEN}✓ Successfully created the following alerts:${NC}"
echo -e "${BLUE}1. TheirStack Credit Usage Warning (80%)${NC}"
echo -e "   - Severity: Warning"
echo -e "   - Frequency: Every 15 minutes"
echo -e "   - Trigger: Credit usage > 80% of monthly quota"

echo -e "${BLUE}2. TheirStack Credit Usage Critical (95%)${NC}"
echo -e "   - Severity: Critical"
echo -e "   - Frequency: Every 5 minutes"
echo -e "   - Trigger: Credit usage > 95% of monthly quota"

echo -e "${BLUE}3. TheirStack High Error Rate (>5%)${NC}"
echo -e "   - Severity: High"
echo -e "   - Frequency: Every 5 minutes"
echo -e "   - Trigger: Error rate > 5% in 15-minute window"

echo -e "${BLUE}4. TheirStack Frequent Rate Limiting${NC}"
echo -e "   - Severity: Medium"
echo -e "   - Frequency: Every 5 minutes"
echo -e "   - Trigger: ≥5 rate limit events in 15 minutes"

echo -e "${BLUE}5. TheirStack API Unavailable${NC}"
echo -e "   - Severity: Critical"
echo -e "   - Frequency: Every 1 minute"
echo -e "   - Trigger: ≥3 server errors in 5 minutes"

echo -e "${BLUE}6. TheirStack Slow Response Times${NC}"
echo -e "   - Severity: Medium"
echo -e "   - Frequency: Every 5 minutes"
echo -e "   - Trigger: Average response time > 10 seconds"

echo
echo -e "${GREEN}✓ Action Group Configuration:${NC}"
echo -e "   Name: $ACTION_GROUP_NAME"
echo -e "   Email: $EMAIL_ADDRESS"
if [ -n "$SLACK_WEBHOOK_URL" ]; then
    echo -e "   Slack: Configured"
else
    echo -e "   Slack: Not configured"
fi

echo
echo -e "${YELLOW}Testing alert configuration...${NC}"

# Test action group
echo -e "${YELLOW}Sending test notification...${NC}"
az monitor action-group test-notifications create \
    --resource-group "$RESOURCE_GROUP" \
    --action-group-name "$ACTION_GROUP_NAME" \
    --notification-type "Email" \
    --receivers "$EMAIL_ADDRESS" \
    --alert-type "servicehealth" \
    --preferred-language "en-US" \
    --test-notification-details notificationId=test-$(date +%s)

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Test notification sent successfully${NC}"
    echo -e "${BLUE}  Check your email for the test alert${NC}"
else
    echo -e "${YELLOW}⚠ Test notification may have failed, but alerts are still configured${NC}"
fi

# Create monitoring dashboard query samples
echo -e "${YELLOW}Creating monitoring queries for dashboard...${NC}"

cat > theirstack-monitoring-queries.kql << EOF
// TheirStack Credit Usage Over Time
customMetrics
| where name == "theirStackCreditsUsed"
| where timestamp > ago(7d)
| summarize TotalCredits = sum(value) by bin(timestamp, 1h)
| render timechart

// TheirStack Error Rate Trend
customEvents
| where name in ("theirStackSearchSuccess", "theirStackSearchError")
| where timestamp > ago(24h)
| summarize 
    Total = count(),
    Errors = countif(name == "theirStackSearchError")
| extend ErrorRate = (Errors * 100.0) / Total
| render barchart

// TheirStack Response Time Distribution
customEvents
| where name == "theirStackSearchSuccess"
| where timestamp > ago(24h)
| extend ResponseTime = todouble(customDimensions.responseTime)
| where isnotnull(ResponseTime)
| summarize 
    avg(ResponseTime),
    percentile(ResponseTime, 50),
    percentile(ResponseTime, 90),
    percentile(ResponseTime, 95)
by bin(timestamp, 1h)
| render timechart

// TheirStack Rate Limiting Events
customEvents
| where name == "theirStackSearchError"
| where tostring(customDimensions.statusCode) == "429"
| where timestamp > ago(24h)
| summarize RateLimitCount = count() by bin(timestamp, 1h)
| render columnchart

// TheirStack Top Error Messages
customEvents
| where name == "theirStackSearchError"
| where timestamp > ago(24h)
| summarize Count = count() by tostring(customDimensions.error)
| order by Count desc
| take 10
EOF

echo -e "${GREEN}✓ Created monitoring queries file: theirstack-monitoring-queries.kql${NC}"

echo
echo -e "${GREEN}=== Setup Complete ===${NC}"
echo -e "${GREEN}TheirStack monitoring alerts are now active!${NC}"
echo
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Check your email for the test alert notification"
echo "2. Import the monitoring queries into Azure Dashboard"
echo "3. Run some job searches to generate telemetry data"
echo "4. Monitor the alerts in Azure Portal"
echo "5. Customize alert thresholds based on actual usage patterns"
echo
echo -e "${YELLOW}Monitoring URLs:${NC}"
echo "- Action Groups: https://portal.azure.com/#blade/Microsoft_Azure_Monitoring/MonitoringMenuBlade/actionGroups"
echo "- Alert Rules: https://portal.azure.com/#blade/Microsoft_Azure_Monitoring/MonitoringMenuBlade/alertsV2"
echo "- Application Insights: https://portal.azure.com/#@/resource/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.Insights/components/${APPINSIGHTS_NAME}/overview"
echo
echo -e "${BLUE}Alert Configuration Summary:${NC}"
echo "- 6 alert rules created"
echo "- Credit usage monitoring (80% warning, 95% critical)"
echo "- Error rate monitoring (>5% threshold)"
echo "- API availability monitoring"
echo "- Performance monitoring (response times)"
echo "- Rate limiting detection"
echo
echo -e "${GREEN}🎉 Production monitoring is now fully configured!${NC}"
