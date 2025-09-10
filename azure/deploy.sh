#!/bin/bash

# Azure Functions Deployment Script
# This script deploys the PrepBettr automation functions to Azure

set -e

echo "🚀 Starting Azure Functions deployment..."

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo "❌ Azure CLI is not installed. Please install it first."
    exit 1
fi

# Check if Functions Core Tools is installed
if ! command -v func &> /dev/null; then
    echo "❌ Azure Functions Core Tools is not installed. Please install it first."
    exit 1
fi

# Configuration
RESOURCE_GROUP="prepbettr-functions-rg"
LOCATION="East US"
STORAGE_ACCOUNT="prepbettrfuncstorage"
FUNCTION_APP_PREFIX="prepbettr-functions"
APP_INSIGHTS_NAME="prepbettr-functions-insights"

# Create resource group if it doesn't exist
echo "📦 Creating resource group..."
az group create --name $RESOURCE_GROUP --location "$LOCATION"

# Create storage account
echo "💾 Creating storage account..."
az storage account create \
    --name $STORAGE_ACCOUNT \
    --resource-group $RESOURCE_GROUP \
    --location "$LOCATION" \
    --sku Standard_LRS \
    --kind StorageV2 \
    --access-tier Hot

# Get storage connection string
STORAGE_CONNECTION=$(az storage account show-connection-string \
    --resource-group $RESOURCE_GROUP \
    --name $STORAGE_ACCOUNT \
    --query connectionString \
    --output tsv)

# Create Application Insights
echo "📊 Creating Application Insights..."
az monitor app-insights component create \
    --app $APP_INSIGHTS_NAME \
    --location "$LOCATION" \
    --resource-group $RESOURCE_GROUP \
    --kind web

# Get Application Insights key
APPINSIGHTS_KEY=$(az monitor app-insights component show \
    --app $APP_INSIGHTS_NAME \
    --resource-group $RESOURCE_GROUP \
    --query instrumentationKey \
    --output tsv)

# Create Function App
echo "⚡ Creating Function App..."
az functionapp create \
    --name "$FUNCTION_APP_PREFIX-app" \
    --resource-group $RESOURCE_GROUP \
    --storage-account $STORAGE_ACCOUNT \
    --consumption-plan-location "$LOCATION" \
    --runtime node \
    --runtime-version 18 \
    --functions-version 4 \
    --app-insights $APP_INSIGHTS_NAME

# Configure function app settings
echo "⚙️  Configuring function app settings..."
az functionapp config appsettings set \
    --name "$FUNCTION_APP_PREFIX-app" \
    --resource-group $RESOURCE_GROUP \
    --settings \
    "APPINSIGHTS_INSTRUMENTATIONKEY=$APPINSIGHTS_KEY" \
    "AZURE_OPENAI_KEY=your-azure-openai-key-here" \
    "AZURE_OPENAI_ENDPOINT=your-azure-openai-endpoint-here"

# Install npm dependencies
echo "📋 Installing dependencies..."
npm install

# Deploy functions
echo "🔧 Deploying functions..."
func azure functionapp publish "$FUNCTION_APP_PREFIX-app"

echo "✅ Deployment completed successfully!"
echo ""
echo "📝 Next steps:"
echo "1. Update the Azure OpenAI API key in Azure Portal"
echo "2. Configure Azure OpenAI credentials for AI processing"
echo "3. Test the functions using the Azure Portal or HTTP requests"
echo "4. Monitor function execution in Application Insights"
echo ""
echo "🔗 Function App URL: https://$FUNCTION_APP_PREFIX-app.azurewebsites.net"
echo "🔗 Application Insights: https://portal.azure.com/#@/resource/subscriptions//resourceGroups/$RESOURCE_GROUP/providers/microsoft.insights/components/$APP_INSIGHTS_NAME"

# Create queues
echo "📨 Creating storage queues..."
az storage queue create --name "search-jobs" --connection-string "$STORAGE_CONNECTION"
az storage queue create --name "process-applications" --connection-string "$STORAGE_CONNECTION"
az storage queue create --name "follow-up-reminders" --connection-string "$STORAGE_CONNECTION"
az storage queue create --name "automation-logs" --connection-string "$STORAGE_CONNECTION"

echo "🎉 All done! Your Azure Functions are ready to process job automation tasks."
