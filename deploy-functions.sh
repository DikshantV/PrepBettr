#!/bin/bash

# Azure Functions Deployment Script for PrepBettr Voice Agent

set -e

echo "🚀 Starting Azure Functions deployment for PrepBettr Voice Agent..."

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
RESOURCE_GROUP="PrepBettr-VoiceAgent"
FUNCTION_APP_NAME="PrepBettr-VoiceAgent-Functions" 
LOCATION="eastus2"
STORAGE_ACCOUNT="pbvoiceagentstorage001"
APP_INSIGHTS_NAME="pbVoiceAI-Insights"

echo -e "${BLUE}📋 Configuration:${NC}"
echo "  Resource Group: $RESOURCE_GROUP"
echo "  Function App: $FUNCTION_APP_NAME"
echo "  Location: $LOCATION"
echo "  Storage Account: $STORAGE_ACCOUNT"
echo ""

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo -e "${RED}❌ Azure CLI is not installed. Please install it first.${NC}"
    echo "Visit: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
fi

# Check if Azure Functions Core Tools is installed
if ! command -v func &> /dev/null; then
    echo -e "${RED}❌ Azure Functions Core Tools is not installed.${NC}"
    echo "Install with: npm install -g azure-functions-core-tools@4 --unsafe-perm true"
    exit 1
fi

# Check if logged in to Azure
echo -e "${BLUE}🔐 Checking Azure login status...${NC}"
if ! az account show &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged in to Azure. Please login...${NC}"
    az login
fi

# Get subscription info
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
echo -e "${GREEN}✅ Logged in to Azure subscription: $SUBSCRIPTION_ID${NC}"

# Create storage account if it doesn't exist
echo -e "${BLUE}🗄️  Checking storage account...${NC}"
if ! az storage account show --name $STORAGE_ACCOUNT --resource-group $RESOURCE_GROUP &> /dev/null; then
    echo -e "${YELLOW}⚠️  Creating storage account...${NC}"
    az storage account create \
        --name $STORAGE_ACCOUNT \
        --resource-group $RESOURCE_GROUP \
        --location $LOCATION \
        --sku Standard_LRS \
        --kind StorageV2
    echo -e "${GREEN}✅ Storage account created${NC}"
else
    echo -e "${GREEN}✅ Storage account exists${NC}"
fi

# Get Application Insights instrumentation key
echo -e "${BLUE}📊 Getting Application Insights key...${NC}"
APP_INSIGHTS_KEY=$(az monitor app-insights component show \
    --app $APP_INSIGHTS_NAME \
    --resource-group $RESOURCE_GROUP \
    --query instrumentationKey -o tsv)

if [ -z "$APP_INSIGHTS_KEY" ]; then
    echo -e "${RED}❌ Failed to get Application Insights key${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Application Insights key retrieved${NC}"

# Create Function App if it doesn't exist
echo -e "${BLUE}⚡ Checking Function App...${NC}"
if ! az functionapp show --name $FUNCTION_APP_NAME --resource-group $RESOURCE_GROUP &> /dev/null; then
    echo -e "${YELLOW}⚠️  Creating Function App...${NC}"
    az functionapp create \
        --name $FUNCTION_APP_NAME \
        --resource-group $RESOURCE_GROUP \
        --storage-account $STORAGE_ACCOUNT \
        --consumption-plan-location $LOCATION \
        --runtime node \
        --runtime-version 18 \
        --functions-version 4 \
        --app-insights $APP_INSIGHTS_NAME
    echo -e "${GREEN}✅ Function App created${NC}"
else
    echo -e "${GREEN}✅ Function App exists${NC}"
fi

# Configure Function App settings
echo -e "${BLUE}⚙️  Configuring Function App settings...${NC}"
az functionapp config appsettings set \
    --name $FUNCTION_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --settings \
    "APPINSIGHTS_INSTRUMENTATIONKEY=$APP_INSIGHTS_KEY" \
    "AZURE_KEY_VAULT_URI=https://pbVoiceVaultProd.vault.azure.net/" \
    "FUNCTIONS_WORKER_RUNTIME=node" \
    "WEBSITE_NODE_DEFAULT_VERSION=~18" \
    "SCM_DO_BUILD_DURING_DEPLOYMENT=true"

echo -e "${GREEN}✅ Function App settings configured${NC}"

# Build and deploy the function
echo -e "${BLUE}🔨 Building and deploying function...${NC}"
cd azure

# Install dependencies
echo -e "${BLUE}📦 Installing dependencies...${NC}"
npm install

# Build TypeScript
echo -e "${BLUE}🔧 Building TypeScript...${NC}"
npm run build

# Deploy to Azure
echo -e "${BLUE}🚀 Deploying to Azure...${NC}"
func azure functionapp publish $FUNCTION_APP_NAME --typescript

cd ..

# Get Function App URL
FUNCTION_URL=$(az functionapp show --name $FUNCTION_APP_NAME --resource-group $RESOURCE_GROUP --query defaultHostName -o tsv)

echo ""
echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo ""
echo -e "${BLUE}📋 Function App Details:${NC}"
echo "  Name: $FUNCTION_APP_NAME"
echo "  URL: https://$FUNCTION_URL"
echo "  Resource Group: $RESOURCE_GROUP"
echo ""
echo -e "${BLUE}🔗 Function Endpoints:${NC}"
echo "  Voice Service: https://$FUNCTION_URL/api/voiceService"
echo ""
echo -e "${BLUE}📝 Next Steps:${NC}"
echo "1. Test the function endpoint"
echo "2. Update your frontend to use the new Azure Function URL"
echo "3. Monitor logs in Application Insights"
echo ""
