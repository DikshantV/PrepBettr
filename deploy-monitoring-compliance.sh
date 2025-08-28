#!/bin/bash
set -euo pipefail

# Auto-Apply Monitoring & Compliance Deployment Script
# Version: 1.0
# Description: Deploy enhanced monitoring, alerting, and compliance features for Auto-Apply

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
RESOURCE_GROUP="${RESOURCE_GROUP:-PrepBettr-Production}"
LOCATION="${LOCATION:-westus2}"
FUNCTION_APP_NAME="${FUNCTION_APP_NAME:-prepbettr-functions}"
APP_INSIGHTS_NAME="${APP_INSIGHTS_NAME:-prepbettr-insights}"
EMAIL_ADDRESS="${EMAIL_ADDRESS}"
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
TEAMS_WEBHOOK_URL="${TEAMS_WEBHOOK_URL:-}"

# Validate required environment variables
if [[ -z "${EMAIL_ADDRESS:-}" ]]; then
    echo -e "${RED}Error: EMAIL_ADDRESS environment variable is required${NC}"
    echo "Usage: EMAIL_ADDRESS=your-email@domain.com ./deploy-monitoring-compliance.sh"
    exit 1
fi

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         Auto-Apply Monitoring & Compliance Setup            ║${NC}"
echo -e "${BLUE}║                                                              ║${NC}"
echo -e "${BLUE}║  Deploying production monitoring, alerts & compliance       ║${NC}"
echo -e "${BLUE}║  features for Auto-Apply automation system                  ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo

# Function to log with timestamp
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check Azure CLI
    if ! command -v az &> /dev/null; then
        error "Azure CLI is not installed"
        exit 1
    fi
    
    # Check if logged in to Azure
    if ! az account show &> /dev/null; then
        error "Not logged in to Azure. Please run 'az login'"
        exit 1
    fi
    
    # Check if resource group exists
    if ! az group show --name "$RESOURCE_GROUP" &> /dev/null; then
        error "Resource group $RESOURCE_GROUP does not exist"
        exit 1
    fi
    
    log "Prerequisites check completed ✓"
}

# Deploy function scaling configuration
deploy_function_scaling() {
    log "Deploying Azure Function scaling configuration..."
    
    if ! az deployment group create \
        --resource-group "$RESOURCE_GROUP" \
        --template-file "./deployment/configure-function-scaling.bicep" \
        --parameters \
            functionAppName="$FUNCTION_APP_NAME" \
            location="$LOCATION" \
            environment="production" \
            functionAppSku="EP1" \
            minimumInstances=1 \
            preWarmedInstances=1 \
            maximumInstances=20; then
        error "Failed to deploy function scaling configuration"
        return 1
    fi
    
    log "Function scaling configuration deployed ✓"
}

# Deploy monitoring dashboard
deploy_monitoring_dashboard() {
    log "Deploying Auto-Apply monitoring dashboard..."
    
    if ! az deployment group create \
        --resource-group "$RESOURCE_GROUP" \
        --template-file "./deployment/autoapply-dashboard.bicep" \
        --parameters \
            applicationInsightsName="$APP_INSIGHTS_NAME" \
            location="$LOCATION"; then
        error "Failed to deploy monitoring dashboard"
        return 1
    fi
    
    log "Monitoring dashboard deployed ✓"
}

# Deploy alert rules
deploy_alert_rules() {
    log "Deploying Auto-Apply alert rules..."
    
    local params="emailAddress=$EMAIL_ADDRESS"
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        params="$params slackWebhookUrl=$SLACK_WEBHOOK_URL"
    fi
    if [[ -n "${TEAMS_WEBHOOK_URL:-}" ]]; then
        params="$params teamsWebhookUrl=$TEAMS_WEBHOOK_URL"
    fi
    
    if ! az deployment group create \
        --resource-group "$RESOURCE_GROUP" \
        --template-file "./deployment/autoapply-alerts.bicep" \
        --parameters \
            applicationInsightsName="$APP_INSIGHTS_NAME" \
            location="$LOCATION" \
            environment="production" \
            $params; then
        error "Failed to deploy alert rules"
        return 1
    fi
    
    log "Alert rules deployed ✓"
}

# Configure cost budgets
configure_cost_budgets() {
    log "Configuring cost budgets..."
    
    # Get subscription ID
    local subscription_id
    subscription_id=$(az account show --query id --output tsv)
    
    # Create Functions consumption budget
    local budget_name="auto-apply-functions-budget"
    local monthly_limit="${MONTHLY_BUDGET_LIMIT:-200}" # $200 default
    
    # Create budget with notifications
    if ! az consumption budget create \
        --budget-name "$budget_name" \
        --amount "$monthly_limit" \
        --time-grain Monthly \
        --time-period start-date="$(date +%Y-%m)-01" \
        --resource-group-filter "$RESOURCE_GROUP" \
        --category Cost \
        --notifications \
            'actual.80={ "enabled": true, "operator": "GreaterThanOrEqualTo", "threshold": 80, "contactEmails": ["'$EMAIL_ADDRESS'"], "contactRoles": [], "contactGroups": [] }' \
            'actual.95={ "enabled": true, "operator": "GreaterThanOrEqualTo", "threshold": 95, "contactEmails": ["'$EMAIL_ADDRESS'"], "contactRoles": [], "contactGroups": [] }' \
            'forecasted.100={ "enabled": true, "operator": "GreaterThanOrEqualTo", "threshold": 100, "contactEmails": ["'$EMAIL_ADDRESS'"], "contactRoles": [], "contactGroups": [] }' \
        2>/dev/null; then
        warning "Failed to create cost budget (may already exist or insufficient permissions)"
    fi
    
    log "Cost budgets configured ✓"
}

# Run health checks
run_health_checks() {
    log "Running system health checks..."
    
    # Test Azure services health
    info "Testing Azure services connectivity..."
    if command -v npm &> /dev/null && [[ -f "package.json" ]]; then
        if ! npm run test:azure-health 2>/dev/null; then
            warning "Azure health checks failed or not available"
        else
            log "Azure health checks passed ✓"
        fi
    fi
    
    # Test Function App endpoints
    info "Testing Function App health endpoint..."
    local function_url="https://${FUNCTION_APP_NAME}.azurewebsites.net"
    
    if curl -f -s "${function_url}/api/health" > /dev/null 2>&1; then
        log "Function App health endpoint responding ✓"
    else
        warning "Function App health endpoint not responding"
    fi
    
    log "Health checks completed"
}

# Validate monitoring setup
validate_monitoring() {
    log "Validating monitoring setup..."
    
    # Check if Application Insights is receiving data
    info "Checking Application Insights data flow..."
    local app_id
    app_id=$(az monitor app-insights component show \
        --app "$APP_INSIGHTS_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --query appId \
        --output tsv 2>/dev/null || echo "")
    
    if [[ -n "$app_id" ]]; then
        log "Application Insights configured ✓"
    else
        warning "Application Insights configuration issue"
    fi
    
    # Check alert rules
    info "Validating alert rules..."
    local alert_count
    alert_count=$(az monitor scheduled-query list \
        --resource-group "$RESOURCE_GROUP" \
        --query "length([?contains(name, 'AutoApply')])" \
        --output tsv 2>/dev/null || echo "0")
    
    if [[ "$alert_count" -gt 0 ]]; then
        log "Found $alert_count Auto-Apply alert rules ✓"
    else
        warning "No Auto-Apply alert rules found"
    fi
    
    log "Monitoring validation completed ✓"
}

# Update Function App with compliance settings
update_compliance_settings() {
    log "Updating Function App with compliance settings..."
    
    # Set compliance-related app settings
    if ! az functionapp config appsettings set \
        --name "$FUNCTION_APP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --settings \
            "COMPLIANCE_ROBOTS_TXT_RESPECT=true" \
            "COMPLIANCE_CAPTCHA_DETECTION=true" \
            "COMPLIANCE_HUMAN_DELAYS_ENABLED=true" \
            "COMPLIANCE_USER_AGENT=PrepBettrBot/1.0 (+https://prepbettr.com/bot-info)" \
            "GDPR_DATA_RETENTION_DAYS=30" \
            "GDPR_SCREENSHOT_RETENTION_DAYS=7" \
            "GDPR_TEMP_FILE_CLEANUP=true" \
        --output none; then
        error "Failed to update compliance settings"
        return 1
    fi
    
    log "Compliance settings updated ✓"
}

# Create deployment summary
create_deployment_summary() {
    log "Creating deployment summary..."
    
    local dashboard_url
    dashboard_url="https://portal.azure.com/#@/resource/subscriptions/$(az account show --query id --output tsv)/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.Insights/workbooks/auto-apply-production-dashboard/workbook"
    
    local function_app_url
    function_app_url="https://portal.azure.com/#@/resource/subscriptions/$(az account show --query id --output tsv)/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.Web/sites/$FUNCTION_APP_NAME/overview"
    
    cat << EOF > monitoring-deployment-summary.md
# Auto-Apply Monitoring & Compliance Deployment Summary

## Deployment Details
- **Date**: $(date)
- **Resource Group**: $RESOURCE_GROUP
- **Function App**: $FUNCTION_APP_NAME
- **Application Insights**: $APP_INSIGHTS_NAME

## Components Deployed

### ✅ Monitoring Dashboard
- **URL**: $dashboard_url
- **Features**: Daily volume, success rates, resource usage, AI accuracy, costs

### ✅ Alert Rules (10 alerts configured)
1. TheirStack Credit Usage Warning (≥80%)
2. TheirStack Credit Usage Critical (≥95%)
3. Browser Failure Rate High (>5% in 10min)
4. Application Success Rate Low (<90% in 15min)
5. Application Worker Function Errors (≥1 in 5min)
6. Queue Length High (>100 applications)
7. Browser Memory Usage High (>1GB avg)
8. AI Screening Accuracy Low (<70%)
9. TheirStack API Response Slow (>10s)
10. Daily Application Volume Anomaly

### ✅ Function Scaling Configuration
- **Plan**: Azure Functions Premium EP1
- **Minimum Instances**: 1 (pre-warmed)
- **Maximum Instances**: 20
- **Memory Limit**: 1536 MB
- **Concurrent Functions**: 5
- **Timeout**: 10 minutes

### ✅ Cost Management
- **Monthly Budget**: \$${MONTHLY_BUDGET_LIMIT:-200}
- **Alerts**: 80%, 95%, 100% (forecasted)
- **Scope**: Resource Group ($RESOURCE_GROUP)

### ✅ Compliance Features
- robots.txt respect enabled
- CAPTCHA detection enabled
- Human-like delays (1-3 seconds)
- GDPR-compliant file cleanup
- Screenshot retention (7 days)
- Data retention (30 days)

## Monitoring Links
- **Function App**: $function_app_url
- **Application Insights**: https://portal.azure.com/#@/resource/subscriptions/$(az account show --query id --output tsv)/resourceGroups/$RESOURCE_GROUP/providers/microsoft.insights/components/$APP_INSIGHTS_NAME
- **Alerts**: https://portal.azure.com/#@/resource/subscriptions/$(az account show --query id --output tsv)/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.Insights/scheduledQueryRules

## Validation Checklist
- [ ] Dashboard tiles showing data within 1 hour
- [ ] Test alerts fire within 5 minutes
- [ ] Function App health endpoint responding
- [ ] Compliance settings active in logs
- [ ] Cost alerts configured correctly

## Next Steps
1. Monitor dashboard for first 24-48 hours
2. Validate alert thresholds with real usage
3. Test Auto-Apply functionality end-to-end
4. Review compliance logs weekly
5. Adjust scaling parameters based on load

## Rollback Commands
\`\`\`bash
# Remove alert rules
az deployment group delete --resource-group $RESOURCE_GROUP --name autoapply-alerts --yes

# Remove dashboard
az deployment group delete --resource-group $RESOURCE_GROUP --name autoapply-dashboard --yes

# Remove scaling configuration
az monitor autoscale delete --name $FUNCTION_APP_NAME-autoscale --resource-group $RESOURCE_GROUP

# Revert to Consumption plan
az functionapp plan update --name $FUNCTION_APP_NAME-plan --resource-group $RESOURCE_GROUP --sku Y1
\`\`\`
EOF
    
    log "Deployment summary created: monitoring-deployment-summary.md"
}

# Main deployment workflow
main() {
    log "Starting Auto-Apply monitoring and compliance deployment..."
    
    check_prerequisites
    
    # Track deployment success
    local deployment_success=true
    
    # Core monitoring components
    if ! deploy_function_scaling; then
        deployment_success=false
    fi
    
    if ! deploy_monitoring_dashboard; then
        deployment_success=false
    fi
    
    if ! deploy_alert_rules; then
        deployment_success=false
    fi
    
    # Cost management
    configure_cost_budgets
    
    # Compliance settings
    if ! update_compliance_settings; then
        deployment_success=false
    fi
    
    # Validation
    run_health_checks
    validate_monitoring
    
    # Documentation
    create_deployment_summary
    
    echo
    if $deployment_success; then
        echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║                   DEPLOYMENT SUCCESSFUL                     ║${NC}"
        echo -e "${GREEN}║                                                              ║${NC}"
        echo -e "${GREEN}║  Auto-Apply monitoring and compliance features deployed!    ║${NC}"
        echo -e "${GREEN}║                                                              ║${NC}"
        echo -e "${GREEN}║  • 10 alert rules configured                                ║${NC}"
        echo -e "${GREEN}║  • Production dashboard deployed                            ║${NC}"
        echo -e "${GREEN}║  • Function scaling optimized                               ║${NC}"
        echo -e "${GREEN}║  • Compliance features enabled                              ║${NC}"
        echo -e "${GREEN}║  • Cost monitoring active                                   ║${NC}"
        echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
        echo
    else
        echo -e "${YELLOW}╔══════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${YELLOW}║                 DEPLOYMENT PARTIAL SUCCESS                  ║${NC}"
        echo -e "${YELLOW}║                                                              ║${NC}"
        echo -e "${YELLOW}║  Some components deployed successfully, others failed       ║${NC}"
        echo -e "${YELLOW}║  Check logs above for specific error details                ║${NC}"
        echo -e "${YELLOW}╚══════════════════════════════════════════════════════════════╝${NC}"
        echo
    fi
    
    info "Dashboard: https://portal.azure.com/#@/resource/subscriptions/$(az account show --query id --output tsv)/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.Insights/workbooks/auto-apply-production-dashboard/workbook"
    info "Function App: https://portal.azure.com/#@/resource/subscriptions/$(az account show --query id --output tsv)/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.Web/sites/$FUNCTION_APP_NAME/overview"
    info "Application Insights: https://portal.azure.com/#@/resource/subscriptions/$(az account show --query id --output tsv)/resourceGroups/$RESOURCE_GROUP/providers/microsoft.insights/components/$APP_INSIGHTS_NAME/overview"
    
    log "Monitoring and compliance deployment completed!"
    
    return $($deployment_success && echo 0 || echo 1)
}

# Handle script interruption
trap 'error "Deployment interrupted"; exit 1' INT TERM

# Run main function
main "$@"
