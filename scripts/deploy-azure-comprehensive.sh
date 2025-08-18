#!/bin/bash

# =============================================================================
# Comprehensive Azure Deployment Script for PrepBettr
# =============================================================================
# This script handles the complete deployment of PrepBettr to Azure, including:
# - Environment validation
# - Azure Functions deployment
# - Next.js application build and deployment
# - Configuration validation
# - Health checks
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
AZURE_DIR="$PROJECT_ROOT/azure"

# Default values
ENVIRONMENT=${1:-staging}
DRY_RUN=${2:-false}
FORCE_DEPLOY=${3:-false}

echo -e "${BLUE}🚀 PrepBettr Azure Deployment Script${NC}"
echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"
echo -e "${BLUE}Dry Run: ${DRY_RUN}${NC}"
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

check_prerequisites() {
    log_step "Checking prerequisites..."
    
    # Check if required tools are installed
    local required_tools=("node" "npm" "az" "func")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "$tool is not installed or not in PATH"
        fi
    done
    
    # Check Node.js version
    local node_version=$(node --version | cut -d'v' -f2)
    local required_node_version="18.0.0"
    if ! npx semver -r ">=$required_node_version" "$node_version" &> /dev/null; then
        log_error "Node.js version $node_version is not supported. Minimum required: $required_node_version"
    fi
    
    # Check if logged into Azure
    if ! az account show &> /dev/null; then
        log_error "Not logged into Azure CLI. Run 'az login' first."
    fi
    
    # Check if Azure Functions Core Tools is installed
    if ! func --version &> /dev/null; then
        log_error "Azure Functions Core Tools not found. Install with: npm install -g azure-functions-core-tools@4"
    fi
    
    log_info "All prerequisites met ✅"
}

validate_environment() {
    log_step "Validating environment configuration..."
    
    # Check if .env file exists or environment variables are set
    local required_env_vars=(
        "AZURE_KEY_VAULT_URL"
        "AZURE_COSMOS_ENDPOINT"
        "AZURE_OPENAI_ENDPOINT"
        "AZURE_SPEECH_KEY"
        "AZURE_STORAGE_CONNECTION_STRING"
        "FIREBASE_PROJECT_ID"
    )
    
    local missing_vars=()
    for var in "${required_env_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            missing_vars+=("$var")
        fi
    done
    
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        log_warning "Missing environment variables:"
        for var in "${missing_vars[@]}"; do
            echo "  - $var"
        done
        
        if [[ "$FORCE_DEPLOY" != "true" ]]; then
            log_error "Environment validation failed. Set FORCE_DEPLOY=true to bypass."
        else
            log_warning "Continuing with missing variables due to FORCE_DEPLOY=true"
        fi
    fi
    
    log_info "Environment validation passed ✅"
}

run_tests() {
    log_step "Running pre-deployment tests..."
    
    cd "$PROJECT_ROOT"
    
    # Type checking
    log_info "Running TypeScript type checking..."
    if ! npm run type-check; then
        if [[ "$FORCE_DEPLOY" != "true" ]]; then
            log_error "Type checking failed"
        else
            log_warning "Type checking failed, but continuing due to FORCE_DEPLOY"
        fi
    fi
    
    # Run Azure-specific health checks
    log_info "Running Azure services health check..."
    if ! npm run check:azure; then
        if [[ "$FORCE_DEPLOY" != "true" ]]; then
            log_error "Azure health check failed"
        else
            log_warning "Azure health check failed, but continuing due to FORCE_DEPLOY"
        fi
    fi
    
    # Run unit tests
    log_info "Running unit tests..."
    if ! npm run test:unit; then
        if [[ "$FORCE_DEPLOY" != "true" ]]; then
            log_error "Unit tests failed"
        else
            log_warning "Unit tests failed, but continuing due to FORCE_DEPLOY"
        fi
    fi
    
    log_info "Pre-deployment tests completed ✅"
}

deploy_azure_functions() {
    log_step "Deploying Azure Functions..."
    
    cd "$AZURE_DIR"
    
    # Check if Azure Functions directory exists
    if [[ ! -d "$AZURE_DIR" ]]; then
        log_error "Azure Functions directory not found at $AZURE_DIR"
    fi
    
    # Install dependencies
    log_info "Installing Azure Functions dependencies..."
    npm install --production
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would deploy Azure Functions"
        return 0
    fi
    
    # Get Function App name from environment or use default
    local function_app_name="${AZURE_FUNCTION_APP_NAME:-prepbettr-functions-${ENVIRONMENT}}"
    local resource_group="${AZURE_RESOURCE_GROUP:-prepbettr-rg-${ENVIRONMENT}}"
    
    log_info "Deploying to Function App: $function_app_name"
    
    # Deploy using Azure Functions Core Tools
    if ! func azure functionapp publish "$function_app_name" --build remote; then
        log_error "Azure Functions deployment failed"
    fi
    
    # Update Application Settings
    log_info "Updating Function App settings..."
    
    # Set required environment variables
    az functionapp config appsettings set \
        --name "$function_app_name" \
        --resource-group "$resource_group" \
        --settings \
            "AZURE_KEY_VAULT_URL=$AZURE_KEY_VAULT_URL" \
            "AZURE_COSMOS_ENDPOINT=$AZURE_COSMOS_ENDPOINT" \
            "AZURE_COSMOS_KEY=$AZURE_COSMOS_KEY" \
            "AZURE_STORAGE_CONNECTION_STRING=$AZURE_STORAGE_CONNECTION_STRING" \
            "FIREBASE_PROJECT_ID=$FIREBASE_PROJECT_ID" \
            "FIREBASE_CLIENT_EMAIL=$FIREBASE_CLIENT_EMAIL" \
            "FIREBASE_PRIVATE_KEY=$FIREBASE_PRIVATE_KEY" \
            "ENVIRONMENT=$ENVIRONMENT" \
        > /dev/null
    
    log_info "Azure Functions deployed successfully ✅"
}

build_application() {
    log_step "Building Next.js application..."
    
    cd "$PROJECT_ROOT"
    
    # Set build environment
    export ENVIRONMENT="$ENVIRONMENT"
    export NODE_ENV="production"
    
    # Run deployment checklist
    log_info "Running deployment checklist..."
    if ! npm run deploy:check:"$ENVIRONMENT"; then
        if [[ "$FORCE_DEPLOY" != "true" ]]; then
            log_error "Deployment checklist failed"
        else
            log_warning "Deployment checklist failed, but continuing due to FORCE_DEPLOY"
        fi
    fi
    
    # Build application
    log_info "Building application for $ENVIRONMENT..."
    if [[ "$ENVIRONMENT" == "production" ]]; then
        npm run build:azure
    else
        npm run build:staging
    fi
    
    # Validate build output
    if [[ ! -d "$PROJECT_ROOT/.next" ]]; then
        log_error "Build output directory .next not found"
    fi
    
    log_info "Application built successfully ✅"
}

deploy_to_azure_static_web_app() {
    log_step "Deploying to Azure Static Web App..."
    
    cd "$PROJECT_ROOT"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would deploy to Azure Static Web App"
        return 0
    fi
    
    # Check if Azure Static Web Apps CLI is available
    if ! command -v swa &> /dev/null; then
        log_warning "Azure Static Web Apps CLI not found. Installing..."
        npm install -g @azure/static-web-apps-cli
    fi
    
    # Deploy based on environment
    local app_name="prepbettr-swa-${ENVIRONMENT}"
    local resource_group="${AZURE_RESOURCE_GROUP:-prepbettr-rg-${ENVIRONMENT}}"
    
    log_info "Deploying to Azure Static Web App: $app_name"
    
    # Deploy using Azure CLI or GitHub Actions integration
    if [[ -n "$AZURE_STATIC_WEB_APPS_API_TOKEN" ]]; then
        swa deploy --deployment-token "$AZURE_STATIC_WEB_APPS_API_TOKEN" --app-location "." --output-location ".next"
    else
        log_info "Using GitHub Actions for deployment - skipping CLI deployment"
    fi
    
    log_info "Azure Static Web App deployment completed ✅"
}

run_health_checks() {
    log_step "Running post-deployment health checks..."
    
    cd "$PROJECT_ROOT"
    
    # Wait a moment for services to be ready
    log_info "Waiting for services to be ready..."
    sleep 30
    
    # Run Azure services health check
    log_info "Checking Azure Functions health..."
    if ! npm run test:azure-health; then
        log_warning "Azure health check failed after deployment"
    fi
    
    # Test Azure Functions endpoints
    local function_app_name="${AZURE_FUNCTION_APP_NAME:-prepbettr-functions-${ENVIRONMENT}}"
    local function_url="https://${function_app_name}.azurewebsites.net/api/health"
    
    log_info "Testing Function App endpoint: $function_url"
    if curl -f -s "$function_url" > /dev/null; then
        log_info "Function App is responding ✅"
    else
        log_warning "Function App health check failed"
    fi
    
    # Run integration tests if available
    if [[ "$ENVIRONMENT" == "staging" ]]; then
        log_info "Running integration tests..."
        if ! npm run test:integration:staging; then
            log_warning "Integration tests failed"
        fi
    fi
    
    log_info "Health checks completed ✅"
}

cleanup() {
    log_step "Cleaning up..."
    
    cd "$PROJECT_ROOT"
    
    # Clean up temporary files
    rm -rf "$PROJECT_ROOT/.next/cache" 2>/dev/null || true
    
    # Clean up Azure Functions build artifacts
    if [[ -d "$AZURE_DIR" ]]; then
        cd "$AZURE_DIR"
        rm -rf node_modules/.cache 2>/dev/null || true
    fi
    
    log_info "Cleanup completed ✅"
}

generate_deployment_report() {
    log_step "Generating deployment report..."
    
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local report_file="$PROJECT_ROOT/deployment-report-${ENVIRONMENT}-${timestamp}.json"
    
    cat > "$report_file" << EOF
{
  "deployment": {
    "timestamp": "$timestamp",
    "environment": "$ENVIRONMENT",
    "dry_run": $DRY_RUN,
    "force_deploy": $FORCE_DEPLOY
  },
  "azure_functions": {
    "app_name": "${AZURE_FUNCTION_APP_NAME:-prepbettr-functions-${ENVIRONMENT}}",
    "resource_group": "${AZURE_RESOURCE_GROUP:-prepbettr-rg-${ENVIRONMENT}}"
  },
  "application": {
    "build_environment": "$ENVIRONMENT",
    "node_version": "$(node --version)",
    "npm_version": "$(npm --version)"
  },
  "status": "completed"
}
EOF
    
    log_info "Deployment report generated: $report_file"
}

main() {
    log_step "Starting Azure deployment for $ENVIRONMENT environment"
    
    # Validate environment argument
    if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
        log_error "Invalid environment: $ENVIRONMENT. Use 'staging' or 'production'"
    fi
    
    # Load environment variables if .env file exists
    if [[ -f "$PROJECT_ROOT/.env.local" ]]; then
        log_info "Loading environment variables from .env.local"
        set -a  # Export all variables
        source "$PROJECT_ROOT/.env.local"
        set +a  # Stop exporting
    fi
    
    # Run deployment steps
    check_prerequisites
    validate_environment
    run_tests
    build_application
    deploy_azure_functions
    deploy_to_azure_static_web_app
    run_health_checks
    cleanup
    generate_deployment_report
    
    log_info "🎉 Deployment completed successfully!"
    log_info "Environment: $ENVIRONMENT"
    
    if [[ "$ENVIRONMENT" == "production" ]]; then
        echo ""
        log_warning "Production deployment completed. Please:"
        log_warning "1. Monitor application logs for any issues"
        log_warning "2. Run smoke tests on the production environment"
        log_warning "3. Verify all critical user flows are working"
        log_warning "4. Check monitoring dashboards"
    fi
}

# Handle script interruption
trap cleanup EXIT

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
