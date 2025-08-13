#!/bin/bash

# =============================================================================
# Staging Environment Setup and Testing Script
# =============================================================================
# This script sets up and tests the staging environment for PrepBettr
# =============================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}🏗️  PrepBettr Staging Environment Setup${NC}"
echo ""

# =============================================================================
# Helper Functions
# =============================================================================

log_info() {
    echo -e "${GREEN}ℹ️  $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

log_step() {
    echo -e "${BLUE}📋 Step: $1${NC}"
}

check_azure_resources() {
    log_step "Checking Azure resources for staging..."
    
    local resource_group="prepbettr-rg-staging"
    
    # Check if resource group exists
    if ! az group show --name "$resource_group" &> /dev/null; then
        log_warning "Resource group $resource_group not found. Creating..."
        
        # Create resource group
        az group create \
            --name "$resource_group" \
            --location "East US 2" \
            --tags Environment=staging Project=PrepBettr
        
        log_info "Resource group $resource_group created"
    else
        log_info "Resource group $resource_group exists ✅"
    fi
    
    # Check key resources
    local resources=(
        "Microsoft.DocumentDB/databaseAccounts:prepbettr-cosmos-staging"
        "Microsoft.Storage/storageAccounts:prepbettrstagingstorage"
        "Microsoft.Web/sites:prepbettr-functions-staging"
        "Microsoft.KeyVault/vaults:prepbettr-keyvault-staging"
        "Microsoft.CognitiveServices/accounts:prepbettr-openai-staging"
        "Microsoft.CognitiveServices/accounts:prepbettr-speech-staging"
    )
    
    for resource in "${resources[@]}"; do
        local resource_type="${resource%%:*}"
        local resource_name="${resource##*:}"
        
        if az resource show \
            --resource-group "$resource_group" \
            --name "$resource_name" \
            --resource-type "$resource_type" &> /dev/null; then
            log_info "✅ $resource_name exists"
        else
            log_warning "❌ $resource_name not found"
        fi
    done
}

setup_environment_variables() {
    log_step "Setting up staging environment variables..."
    
    local staging_env_file="$PROJECT_ROOT/.env.staging"
    
    # Create staging environment file template
    cat > "$staging_env_file" << EOF
# Staging Environment Variables for PrepBettr
# Auto-generated on $(date)

# Environment
NODE_ENV=production
ENVIRONMENT=staging
NEXT_PUBLIC_APP_URL=https://staging.prepbettr.com

# Azure Resources (Staging)
AZURE_KEY_VAULT_URL=https://prepbettr-keyvault-staging.vault.azure.net/
AZURE_COSMOS_ENDPOINT=https://prepbettr-cosmos-staging.documents.azure.com:443/
AZURE_COSMOS_DATABASE_NAME=PrepBettrDB
AZURE_STORAGE_ACCOUNT_NAME=prepbettrstagingstorage

# Azure Functions (Staging)
AZURE_FUNCTIONS_BASE_URL=https://prepbettr-functions-staging.azurewebsites.net
AZURE_FUNCTION_APP_NAME=prepbettr-functions-staging
AZURE_RESOURCE_GROUP=prepbettr-rg-staging

# Application Settings
LOG_LEVEL=debug
ENABLE_ANALYTICS=true
ENABLE_MONITORING=true
USE_AZURE_MOCK=false

# Rate Limiting (More permissive for testing)
RATE_LIMIT_MAX_REQUESTS=200
RATE_LIMIT_WINDOW_MS=900000

EOF
    
    log_info "Staging environment file created: $staging_env_file"
    log_warning "Please update the following values manually:"
    log_warning "- Azure service connection strings and keys"
    log_warning "- Firebase configuration for staging project"
    log_warning "- External service API keys (if different for staging)"
}

test_azure_services() {
    log_step "Testing Azure services connectivity..."
    
    cd "$PROJECT_ROOT"
    
    # Export staging environment
    if [[ -f ".env.staging" ]]; then
        log_info "Loading staging environment variables..."
        set -a
        source .env.staging
        set +a
    fi
    
    # Test Azure Key Vault
    log_info "Testing Azure Key Vault access..."
    if npm run env:keyvault; then
        log_info "✅ Azure Key Vault accessible"
    else
        log_warning "❌ Azure Key Vault access failed"
    fi
    
    # Test Azure OpenAI
    log_info "Testing Azure OpenAI service..."
    if npm run test:azure-openai; then
        log_info "✅ Azure OpenAI service working"
    else
        log_warning "❌ Azure OpenAI service test failed"
    fi
    
    # Test Azure services health
    log_info "Running comprehensive Azure health check..."
    if npm run test:azure-health; then
        log_info "✅ All Azure services healthy"
    else
        log_warning "❌ Some Azure services health checks failed"
    fi
}

deploy_staging_functions() {
    log_step "Deploying Azure Functions to staging..."
    
    cd "$PROJECT_ROOT/azure"
    
    # Install dependencies
    log_info "Installing dependencies..."
    npm install
    
    # Deploy to staging function app
    local function_app_name="prepbettr-functions-staging"
    
    log_info "Deploying to $function_app_name..."
    func azure functionapp publish "$function_app_name" --build remote
    
    # Configure staging-specific settings
    log_info "Configuring staging function app settings..."
    az functionapp config appsettings set \
        --name "$function_app_name" \
        --resource-group "prepbettr-rg-staging" \
        --settings \
            "ENVIRONMENT=staging" \
            "LOG_LEVEL=debug" \
            "ENABLE_MONITORING=true" \
        > /dev/null
    
    log_info "✅ Staging functions deployed"
}

run_staging_tests() {
    log_step "Running staging environment tests..."
    
    cd "$PROJECT_ROOT"
    
    # Set staging environment
    export ENVIRONMENT=staging
    export NODE_ENV=test
    
    # Run staging-specific tests
    log_info "Running integration tests against staging..."
    if npm run test:integration:staging; then
        log_info "✅ Integration tests passed"
    else
        log_warning "❌ Some integration tests failed"
    fi
    
    # Test auth flow in staging
    log_info "Testing authentication flow..."
    if npm run test:auth-flow; then
        log_info "✅ Authentication flow working"
    else
        log_warning "❌ Authentication flow test failed"
    fi
    
    # Test voice features
    log_info "Testing voice interview features..."
    if npm run test:voice-flow; then
        log_info "✅ Voice features working"
    else
        log_warning "❌ Voice features test failed"
    fi
}

validate_staging_deployment() {
    log_step "Validating staging deployment..."
    
    local staging_url="${NEXT_PUBLIC_APP_URL:-https://staging.prepbettr.com}"
    
    # Test main application endpoint
    log_info "Testing main application at $staging_url"
    if curl -f -s "$staging_url" > /dev/null; then
        log_info "✅ Main application responsive"
    else
        log_warning "❌ Main application not responding"
    fi
    
    # Test API endpoints
    local api_endpoints=(
        "/api/health"
        "/api/auth/verify"
        "/api/azure/health"
    )
    
    for endpoint in "${api_endpoints[@]}"; do
        local url="${staging_url}${endpoint}"
        log_info "Testing API endpoint: $endpoint"
        
        if curl -f -s "$url" > /dev/null; then
            log_info "✅ $endpoint working"
        else
            log_warning "❌ $endpoint not responding"
        fi
    done
    
    # Test Azure Functions directly
    local function_app_url="${AZURE_FUNCTIONS_BASE_URL:-https://prepbettr-functions-staging.azurewebsites.net}"
    local function_endpoints=(
        "/api/health"
        "/api/verifyToken"
    )
    
    for endpoint in "${function_endpoints[@]}"; do
        local url="${function_app_url}${endpoint}"
        log_info "Testing Function endpoint: $endpoint"
        
        if curl -f -s "$url" > /dev/null; then
            log_info "✅ Function $endpoint working"
        else
            log_warning "❌ Function $endpoint not responding"
        fi
    done
}

create_staging_checklist() {
    log_step "Creating staging environment checklist..."
    
    local checklist_file="$PROJECT_ROOT/staging-checklist.md"
    
    cat > "$checklist_file" << EOF
# Staging Environment Checklist

Generated on: $(date)

## Azure Resources
- [ ] Resource Group: prepbettr-rg-staging
- [ ] Cosmos DB: prepbettr-cosmos-staging
- [ ] Storage Account: prepbettrstagingstorage
- [ ] Function App: prepbettr-functions-staging
- [ ] Key Vault: prepbettr-keyvault-staging
- [ ] OpenAI Service: prepbettr-openai-staging
- [ ] Speech Service: prepbettr-speech-staging
- [ ] Form Recognizer: prepbettr-formrec-staging
- [ ] App Configuration: prepbettr-appconfig-staging
- [ ] Application Insights: prepbettr-insights-staging

## Environment Configuration
- [ ] .env.staging file created and populated
- [ ] Azure Key Vault secrets configured
- [ ] Firebase staging project configured
- [ ] Vercel staging environment configured

## Functionality Tests
- [ ] User registration and login
- [ ] Mock interview creation
- [ ] Voice interview functionality
- [ ] Resume upload and processing
- [ ] AI feedback generation
- [ ] Payment processing (test mode)
- [ ] Email notifications
- [ ] Data export functionality

## Security & Compliance
- [ ] HTTPS certificates valid
- [ ] CORS configuration correct
- [ ] Rate limiting functional
- [ ] Authentication middleware working
- [ ] GDPR compliance features working

## Monitoring & Logging
- [ ] Application Insights collecting data
- [ ] Azure Function logs accessible
- [ ] Error tracking working
- [ ] Performance monitoring active

## Integration Points
- [ ] Azure OpenAI API working
- [ ] Azure Speech Services working
- [ ] Azure Form Recognizer working
- [ ] External payment provider working
- [ ] Email service working

## Performance
- [ ] Page load times acceptable
- [ ] API response times acceptable
- [ ] Voice processing performance good
- [ ] File upload/download working

## Notes
- Staging URL: ${NEXT_PUBLIC_APP_URL:-https://staging.prepbettr.com}
- Function App URL: ${AZURE_FUNCTIONS_BASE_URL:-https://prepbettr-functions-staging.azurewebsites.net}

EOF
    
    log_info "Staging checklist created: $checklist_file"
}

main() {
    log_step "Starting staging environment setup"
    
    # Check prerequisites
    if ! command -v az &> /dev/null; then
        log_error "Azure CLI not found. Please install it first."
    fi
    
    if ! command -v func &> /dev/null; then
        log_error "Azure Functions Core Tools not found. Please install it first."
    fi
    
    # Ensure we're logged into Azure
    if ! az account show &> /dev/null; then
        log_error "Not logged into Azure CLI. Run 'az login' first."
    fi
    
    # Run setup steps
    check_azure_resources
    setup_environment_variables
    test_azure_services
    deploy_staging_functions
    run_staging_tests
    validate_staging_deployment
    create_staging_checklist
    
    echo ""
    log_info "🎉 Staging environment setup completed!"
    log_info "Next steps:"
    log_info "1. Review and update .env.staging with actual values"
    log_info "2. Configure secrets in Azure Key Vault"
    log_info "3. Set up staging domain and SSL certificate"
    log_info "4. Configure monitoring alerts"
    log_info "5. Review staging-checklist.md and test all functionality"
    
    echo ""
    log_warning "Important reminders:"
    log_warning "- Use test data only in staging environment"
    log_warning "- Enable debug logging for troubleshooting"
    log_warning "- Monitor costs as staging will incur Azure charges"
    log_warning "- Regularly sync staging with production configuration"
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
