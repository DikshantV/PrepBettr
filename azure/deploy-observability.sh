#!/bin/bash

# Azure Observability Infrastructure Deployment Script
# This script deploys Azure Monitor, Application Insights, and Log Analytics workspace

set -e

echo "🚀 PrepBettr - Azure Observability Infrastructure Deployment"
echo "=============================================================="

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo "❌ Azure CLI is not installed. Please install it first."
    exit 1
fi

# Configuration variables
RESOURCE_GROUP=${RESOURCE_GROUP:-"prepbettr-rg"}
LOCATION=${LOCATION:-"East US"}
WORKSPACE_NAME=${WORKSPACE_NAME:-"prepbettr-log-analytics"}
APP_INSIGHTS_NAME=${APP_INSIGHTS_NAME:-"prepbettr-app-insights"}
RETENTION_DAYS=${RETENTION_DAYS:-30}
SUBSCRIPTION_ID=$(az account show --query id -o tsv)

echo "📋 Deployment Configuration:"
echo "   Resource Group: $RESOURCE_GROUP"
echo "   Location: $LOCATION"
echo "   Subscription: $SUBSCRIPTION_ID"
echo "   Log Analytics Workspace: $WORKSPACE_NAME"
echo "   Application Insights: $APP_INSIGHTS_NAME"
echo "   Data Retention: $RETENTION_DAYS days"
echo ""

# Prompt for confirmation
read -p "Do you want to proceed with this configuration? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Deployment cancelled."
    exit 1
fi

echo "🔑 Logging in to Azure..."
if ! az account show &> /dev/null; then
    az login
fi

echo "📦 Setting subscription to $SUBSCRIPTION_ID..."
az account set --subscription "$SUBSCRIPTION_ID"

echo "🏗️  Creating resource group (if it doesn't exist)..."
az group create \
    --name "$RESOURCE_GROUP" \
    --location "$LOCATION" \
    --output table

echo "🚀 Deploying observability infrastructure..."
DEPLOYMENT_OUTPUT=$(az deployment group create \
    --resource-group "$RESOURCE_GROUP" \
    --template-file "./observability-deployment.json" \
    --parameters \
        location="$LOCATION" \
        workspaceName="$WORKSPACE_NAME" \
        appInsightsName="$APP_INSIGHTS_NAME" \
        retentionInDays=$RETENTION_DAYS \
    --output json)

# Extract outputs from deployment
WORKSPACE_ID=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.properties.outputs.workspaceId.value')
WORKSPACE_KEY=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.properties.outputs.workspaceKey.value')
APP_INSIGHTS_KEY=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.properties.outputs.appInsightsInstrumentationKey.value')
APP_INSIGHTS_CONNECTION_STRING=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.properties.outputs.appInsightsConnectionString.value')
APP_INSIGHTS_RESOURCE_ID=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.properties.outputs.appInsightsResourceId.value')

echo ""
echo "✅ Deployment completed successfully!"
echo ""
echo "📊 Observability Resources:"
echo "   Log Analytics Workspace ID: $WORKSPACE_ID"
echo "   Application Insights Instrumentation Key: $APP_INSIGHTS_KEY"
echo "   Application Insights Connection String: $APP_INSIGHTS_CONNECTION_STRING"
echo ""

# Create environment variables file
ENV_FILE="../.env.observability"
echo "📝 Creating environment variables file: $ENV_FILE"

cat > "$ENV_FILE" << EOF
# Azure Observability Configuration
# Generated on $(date)

# Log Analytics Workspace
AZURE_LOG_ANALYTICS_WORKSPACE_ID="$WORKSPACE_ID"
AZURE_LOG_ANALYTICS_WORKSPACE_KEY="$WORKSPACE_KEY"

# Application Insights
NEXT_PUBLIC_APP_INSIGHTS_INSTRUMENTATION_KEY="$APP_INSIGHTS_KEY"
APP_INSIGHTS_CONNECTION_STRING="$APP_INSIGHTS_CONNECTION_STRING"
APP_INSIGHTS_RESOURCE_ID="$APP_INSIGHTS_RESOURCE_ID"
APPINSIGHTS_INSTRUMENTATIONKEY="$APP_INSIGHTS_KEY"

# For Azure Functions
APPLICATIONINSIGHTS_CONNECTION_STRING="$APP_INSIGHTS_CONNECTION_STRING"
EOF

echo "✅ Environment variables written to $ENV_FILE"
echo ""

# Store secrets in Azure Key Vault if available
KEY_VAULT_NAME="pbVoiceVaultProd"
if az keyvault show --name "$KEY_VAULT_NAME" &> /dev/null; then
    echo "🔐 Storing secrets in Azure Key Vault: $KEY_VAULT_NAME"
    
    az keyvault secret set \
        --vault-name "$KEY_VAULT_NAME" \
        --name "app-insights-instrumentation-key" \
        --value "$APP_INSIGHTS_KEY" \
        --output none
    
    az keyvault secret set \
        --vault-name "$KEY_VAULT_NAME" \
        --name "app-insights-connection-string" \
        --value "$APP_INSIGHTS_CONNECTION_STRING" \
        --output none
    
    az keyvault secret set \
        --vault-name "$KEY_VAULT_NAME" \
        --name "log-analytics-workspace-id" \
        --value "$WORKSPACE_ID" \
        --output none
    
    az keyvault secret set \
        --vault-name "$KEY_VAULT_NAME" \
        --name "log-analytics-workspace-key" \
        --value "$WORKSPACE_KEY" \
        --output none
    
    echo "✅ Secrets stored in Azure Key Vault"
else
    echo "⚠️  Azure Key Vault '$KEY_VAULT_NAME' not found. Secrets not stored in vault."
fi

echo ""
echo "🎯 Next Steps:"
echo "1. Add the environment variables from $ENV_FILE to your .env.local file"
echo "2. Redeploy your Next.js application with the new Application Insights key"
echo "3. Redeploy your Azure Functions with the new connection string"
echo "4. Monitor your application at:"
echo "   - Azure Portal: https://portal.azure.com/#resource$APP_INSIGHTS_RESOURCE_ID"
echo "   - Application Insights: https://portal.azure.com/#@/resource$APP_INSIGHTS_RESOURCE_ID/overview"
echo ""

# Create alert rules
echo "📢 Setting up basic alert rules..."

# High error rate alert
az monitor metrics alert create \
    --name "PrepBettr-HighErrorRate" \
    --resource-group "$RESOURCE_GROUP" \
    --scopes "$APP_INSIGHTS_RESOURCE_ID" \
    --condition "count exceptions/count > 10" \
    --window-size 5m \
    --evaluation-frequency 1m \
    --severity 2 \
    --description "Alert when error rate is high" \
    --output none || echo "⚠️  Alert rule creation failed (might already exist)"

# High response time alert
az monitor metrics alert create \
    --name "PrepBettr-HighResponseTime" \
    --resource-group "$RESOURCE_GROUP" \
    --scopes "$APP_INSIGHTS_RESOURCE_ID" \
    --condition "avg requests/duration > 5000" \
    --window-size 5m \
    --evaluation-frequency 1m \
    --severity 3 \
    --description "Alert when response time is high" \
    --output none || echo "⚠️  Alert rule creation failed (might already exist)"

echo "✅ Basic alert rules configured"
echo ""
echo "🎉 Azure Observability Infrastructure deployment completed!"
echo "   Your PrepBettr application now has comprehensive monitoring and logging."
