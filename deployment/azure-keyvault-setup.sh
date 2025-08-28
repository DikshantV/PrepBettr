#!/bin/bash

# Azure Key Vault Setup Script for TheirStack Integration
# Phase 1: Production Deployment

set -e

# Configuration variables
RESOURCE_GROUP="PrepBettr-Production"  # Update with your resource group name
KEY_VAULT_NAME="prepbettr-keyvault"    # Update with your Key Vault name
FUNCTION_APP_NAME="prepbettr-functions" # Update with your Function App name
SECRET_NAME="theirStackApiKey"
SUBSCRIPTION_ID=""  # Update with your subscription ID

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== TheirStack Azure Key Vault Setup ===${NC}"
echo "Resource Group: $RESOURCE_GROUP"
echo "Key Vault: $KEY_VAULT_NAME"
echo "Function App: $FUNCTION_APP_NAME"
echo "Secret Name: $SECRET_NAME"
echo

# Prompt for TheirStack API key
if [ -z "$THEIRSTACK_API_KEY" ]; then
    echo -e "${YELLOW}Enter your TheirStack API key:${NC}"
    read -s THEIRSTACK_API_KEY
    echo
fi

if [ -z "$THEIRSTACK_API_KEY" ]; then
    echo -e "${RED}Error: TheirStack API key is required${NC}"
    exit 1
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

# Check if Key Vault exists
echo -e "${YELLOW}Checking if Key Vault exists...${NC}"
if ! az keyvault show --name "$KEY_VAULT_NAME" --resource-group "$RESOURCE_GROUP" &> /dev/null; then
    echo -e "${RED}Error: Key Vault '$KEY_VAULT_NAME' not found in resource group '$RESOURCE_GROUP'${NC}"
    exit 1
fi

# Add TheirStack API key to Key Vault
echo -e "${YELLOW}Adding TheirStack API key to Key Vault...${NC}"
az keyvault secret set \
    --vault-name "$KEY_VAULT_NAME" \
    --name "$SECRET_NAME" \
    --value "$THEIRSTACK_API_KEY" \
    --description "TheirStack job discovery API key" \
    --tags "service=theirstack" "environment=production"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Successfully added TheirStack API key to Key Vault${NC}"
else
    echo -e "${RED}✗ Failed to add API key to Key Vault${NC}"
    exit 1
fi

# Get Function App identity
echo -e "${YELLOW}Getting Function App managed identity...${NC}"
FUNCTION_APP_PRINCIPAL_ID=$(az functionapp identity show \
    --name "$FUNCTION_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query principalId \
    --output tsv 2>/dev/null)

if [ -z "$FUNCTION_APP_PRINCIPAL_ID" ]; then
    echo -e "${YELLOW}Function App managed identity not found. Creating system-assigned identity...${NC}"
    az functionapp identity assign \
        --name "$FUNCTION_APP_NAME" \
        --resource-group "$RESOURCE_GROUP"
    
    FUNCTION_APP_PRINCIPAL_ID=$(az functionapp identity show \
        --name "$FUNCTION_APP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --query principalId \
        --output tsv)
fi

echo "Function App Principal ID: $FUNCTION_APP_PRINCIPAL_ID"

# Grant Key Vault access to Function App
echo -e "${YELLOW}Granting Key Vault access to Function App...${NC}"
az keyvault set-policy \
    --name "$KEY_VAULT_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --object-id "$FUNCTION_APP_PRINCIPAL_ID" \
    --secret-permissions get list

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Successfully granted Key Vault access to Function App${NC}"
else
    echo -e "${RED}✗ Failed to grant Key Vault access${NC}"
    exit 1
fi

# Update Function App environment variables
echo -e "${YELLOW}Updating Function App environment variables...${NC}"
az functionapp config appsettings set \
    --name "$FUNCTION_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --settings THEIRSTACK_API_KEY="@Microsoft.KeyVault(SecretUri=https://${KEY_VAULT_NAME}.vault.azure.net/secrets/${SECRET_NAME}/)"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Successfully updated Function App environment variables${NC}"
else
    echo -e "${RED}✗ Failed to update Function App environment variables${NC}"
    exit 1
fi

# Verify secret retrieval
echo -e "${YELLOW}Verifying secret retrieval...${NC}"
SECRET_VERSION=$(az keyvault secret show \
    --vault-name "$KEY_VAULT_NAME" \
    --name "$SECRET_NAME" \
    --query id \
    --output tsv)

if [ -n "$SECRET_VERSION" ]; then
    echo -e "${GREEN}✓ Secret is accessible: $SECRET_VERSION${NC}"
else
    echo -e "${RED}✗ Failed to verify secret accessibility${NC}"
    exit 1
fi

# Wait for Function App to restart and pick up new settings
echo -e "${YELLOW}Restarting Function App to pick up new settings...${NC}"
az functionapp restart \
    --name "$FUNCTION_APP_NAME" \
    --resource-group "$RESOURCE_GROUP"

echo -e "${GREEN}✓ Function App restarted${NC}"
echo
echo -e "${GREEN}=== Setup Complete ===${NC}"
echo -e "${GREEN}TheirStack integration is now configured in production!${NC}"
echo
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Wait 2-3 minutes for Function App to fully restart"
echo "2. Run the production validation script"
echo "3. Monitor Application Insights for telemetry"
echo "4. Check Firestore for credit tracking"
echo
echo -e "${YELLOW}Key Vault Secret URI:${NC}"
echo "https://${KEY_VAULT_NAME}.vault.azure.net/secrets/${SECRET_NAME}/"
echo
echo -e "${YELLOW}Environment Variable Set:${NC}"
echo "THEIRSTACK_API_KEY=@Microsoft.KeyVault(SecretUri=https://${KEY_VAULT_NAME}.vault.azure.net/secrets/${SECRET_NAME}/)"
