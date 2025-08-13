#!/bin/bash

# Azure Functions Deployment Script
# This script helps deploy all Firebase-replacement Azure Functions

set -e

echo "🚀 Starting Azure Functions Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo -e "${RED}❌ Azure CLI not found. Please install it first:${NC}"
    echo "   https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
fi

# Check if Azure Functions Core Tools are installed
if ! command -v func &> /dev/null; then
    echo -e "${RED}❌ Azure Functions Core Tools not found. Please install:${NC}"
    echo "   npm install -g azure-functions-core-tools@4 --unsafe-perm true"
    exit 1
fi

# Check if we're in the right directory
if [ ! -d "azure" ]; then
    echo -e "${RED}❌ 'azure' directory not found. Please run this script from the project root.${NC}"
    exit 1
fi

echo -e "${BLUE}ℹ️  Checking Azure login status...${NC}"

# Check if logged in to Azure
if ! az account show &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged in to Azure. Please login:${NC}"
    az login
fi

# Get the current subscription
SUBSCRIPTION=$(az account show --query name -o tsv)
echo -e "${GREEN}✅ Logged in to Azure subscription: $SUBSCRIPTION${NC}"

# Ask for Function App name
echo ""
echo -e "${BLUE}Please provide your Azure Function App details:${NC}"
read -p "Function App Name: " FUNCTION_APP_NAME
read -p "Resource Group Name: " RESOURCE_GROUP

if [ -z "$FUNCTION_APP_NAME" ] || [ -z "$RESOURCE_GROUP" ]; then
    echo -e "${RED}❌ Function App Name and Resource Group are required${NC}"
    exit 1
fi

# Check if the Function App exists
echo -e "${BLUE}ℹ️  Checking if Function App exists...${NC}"
if ! az functionapp show --name "$FUNCTION_APP_NAME" --resource-group "$RESOURCE_GROUP" &> /dev/null; then
    echo -e "${RED}❌ Function App '$FUNCTION_APP_NAME' not found in resource group '$RESOURCE_GROUP'${NC}"
    echo -e "${YELLOW}Please create it first or check the names.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Function App found: $FUNCTION_APP_NAME${NC}"

# Navigate to Azure Functions directory
cd azure

# Install dependencies
echo -e "${BLUE}ℹ️  Installing dependencies...${NC}"
npm install

# List the functions that will be deployed
echo -e "${BLUE}ℹ️  Functions to be deployed:${NC}"
find . -name "function.json" -exec dirname {} \; | sed 's/\.\//  - /' | sort

echo ""
echo -e "${YELLOW}⚠️  This will deploy the following Firebase-replacement functions:${NC}"
echo "  - verifyToken (Token verification)"
echo "  - createSessionCookie (Session cookie creation)"
echo "  - onUserPlanChange (Plan change handler)"
echo "  - deleteUserData (GDPR data deletion)"
echo "  - processScheduledDeletions (Scheduled cleanup)"

echo ""
read -p "Continue with deployment? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}⚠️  Deployment cancelled${NC}"
    exit 0
fi

echo -e "${BLUE}ℹ️  Deploying to Azure Functions...${NC}"

# Deploy the functions
if func azure functionapp publish "$FUNCTION_APP_NAME" --build remote; then
    echo ""
    echo -e "${GREEN}🎉 Deployment successful!${NC}"
    echo ""
    echo -e "${BLUE}📋 Next Steps:${NC}"
    echo "1. Configure environment variables in your Function App:"
    echo "   - FIREBASE_PROJECT_ID"
    echo "   - FIREBASE_CLIENT_EMAIL" 
    echo "   - FIREBASE_PRIVATE_KEY"
    echo "   - AZURE_COSMOS_ENDPOINT"
    echo "   - AZURE_COSMOS_KEY"
    echo "   - AZURE_COSMOS_DATABASE_ID"
    echo "   - AZURE_STORAGE_CONNECTION_STRING"
    echo "   - AZURE_KEY_VAULT_URL"
    echo ""
    echo "2. Add to your Next.js .env.local:"
    echo "   - AZURE_FUNCTIONS_URL=https://$FUNCTION_APP_NAME.azurewebsites.net"
    echo "   - AZURE_FUNCTIONS_KEY=<your-function-key>"
    echo ""
    echo "3. Get your function key:"
    echo "   az functionapp keys list --name $FUNCTION_APP_NAME --resource-group $RESOURCE_GROUP"
    echo ""
    echo -e "${GREEN}✅ Your Firebase to Azure Functions migration is now deployed!${NC}"
else
    echo ""
    echo -e "${RED}❌ Deployment failed. Please check the errors above.${NC}"
    exit 1
fi
