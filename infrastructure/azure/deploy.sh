#!/bin/bash

# PrepBettr Infrastructure Deployment Script
# Usage: ./deploy.sh <environment> [options]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="prepbettr"
SUBSCRIPTION_ID=""  # Will be set from environment or prompted
LOCATION="East US"

# Functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

usage() {
    echo "Usage: $0 <environment> [options]"
    echo ""
    echo "Arguments:"
    echo "  environment    Target environment (dev, staging, prod)"
    echo ""
    echo "Options:"
    echo "  -s, --subscription    Azure subscription ID"
    echo "  -l, --location        Azure region (default: East US)"
    echo "  -d, --dry-run        Show what would be deployed without executing"
    echo "  -v, --validate       Validate templates only"
    echo "  -f, --force          Skip confirmation prompts"
    echo "  -h, --help           Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 dev"
    echo "  $0 prod --subscription 12345678-1234-1234-1234-123456789012"
    echo "  $0 staging --dry-run"
    exit 1
}

check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check Azure CLI
    if ! command -v az &> /dev/null; then
        error "Azure CLI is not installed. Please install it from https://docs.microsoft.com/cli/azure/install-azure-cli"
    fi
    
    # Check if logged in
    if ! az account show &> /dev/null; then
        error "Not logged into Azure. Please run 'az login' first."
    fi
    
    # Check Bicep CLI
    if ! az bicep version &> /dev/null; then
        log "Installing Bicep CLI..."
        az bicep install
    fi
    
    info "Prerequisites check completed successfully"
}

set_subscription() {
    if [ -n "$SUBSCRIPTION_ID" ]; then
        log "Setting subscription to: $SUBSCRIPTION_ID"
        az account set --subscription "$SUBSCRIPTION_ID"
    else
        # Get current subscription
        CURRENT_SUB=$(az account show --query id -o tsv)
        CURRENT_SUB_NAME=$(az account show --query name -o tsv)
        warn "Using current subscription: $CURRENT_SUB_NAME ($CURRENT_SUB)"
        
        if [ "$FORCE" != "true" ]; then
            read -p "Continue with this subscription? (y/n): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                error "Deployment cancelled by user"
            fi
        fi
        
        SUBSCRIPTION_ID=$CURRENT_SUB
    fi
}

validate_environment() {
    local env=$1
    case $env in
        dev|staging|prod)
            return 0
            ;;
        *)
            error "Invalid environment: $env. Must be one of: dev, staging, prod"
            ;;
    esac
}

create_resource_group() {
    local env=$1
    local rg_name
    
    if [ "$env" = "prod" ]; then
        rg_name="rg-${PROJECT_NAME}"
    else
        rg_name="rg-${PROJECT_NAME}-${env}"
    fi
    
    log "Creating resource group: $rg_name"
    
    # Check if resource group exists
    if az group show --name "$rg_name" &> /dev/null; then
        warn "Resource group $rg_name already exists"
    else
        az group create \
            --name "$rg_name" \
            --location "$LOCATION" \
            --tags \
                project="PrepBettr" \
                environment="$env" \
                managedBy="Infrastructure-as-Code" \
                createdBy="deployment-script"
        
        log "Resource group $rg_name created successfully"
    fi
    
    echo "$rg_name"
}

validate_deployment() {
    local env=$1
    local rg_name=$2
    local params_file="$SCRIPT_DIR/main.parameters.${env}.json"
    
    log "Validating Bicep template for $env environment..."
    
    # Check if parameters file exists
    if [ ! -f "$params_file" ]; then
        error "Parameters file not found: $params_file"
    fi
    
    # Validate the deployment
    local validation_result
    validation_result=$(az deployment group validate \
        --resource-group "$rg_name" \
        --template-file "$SCRIPT_DIR/main.bicep" \
        --parameters "@$params_file" \
        --query "error" -o tsv)
    
    if [ "$validation_result" != "" ] && [ "$validation_result" != "null" ]; then
        error "Template validation failed: $validation_result"
    fi
    
    log "Template validation passed successfully"
}

deploy_infrastructure() {
    local env=$1
    local rg_name=$2
    local params_file="$SCRIPT_DIR/main.parameters.${env}.json"
    
    log "Deploying infrastructure to $env environment..."
    
    local deployment_name="prepbettr-infrastructure-$(date +%Y%m%d-%H%M%S)"
    
    if [ "$DRY_RUN" = "true" ]; then
        info "DRY RUN: Would deploy the following resources:"
        az deployment group what-if \
            --resource-group "$rg_name" \
            --template-file "$SCRIPT_DIR/main.bicep" \
            --parameters "@$params_file" \
            --name "$deployment_name"
        return 0
    fi
    
    # Confirm deployment for production
    if [ "$env" = "prod" ] && [ "$FORCE" != "true" ]; then
        warn "You are about to deploy to PRODUCTION environment"
        read -p "Are you sure you want to continue? Type 'yes' to confirm: " -r
        if [ "$REPLY" != "yes" ]; then
            error "Production deployment cancelled by user"
        fi
    fi
    
    # Execute deployment
    log "Starting deployment: $deployment_name"
    
    az deployment group create \
        --resource-group "$rg_name" \
        --template-file "$SCRIPT_DIR/main.bicep" \
        --parameters "@$params_file" \
        --name "$deployment_name" \
        --verbose
    
    if [ $? -eq 0 ]; then
        log "Deployment completed successfully: $deployment_name"
        
        # Get deployment outputs
        log "Retrieving deployment outputs..."
        az deployment group show \
            --resource-group "$rg_name" \
            --name "$deployment_name" \
            --query "properties.outputs" \
            --output table
        
        # Save outputs to file
        local outputs_file="$SCRIPT_DIR/outputs-${env}.json"
        az deployment group show \
            --resource-group "$rg_name" \
            --name "$deployment_name" \
            --query "properties.outputs" \
            --output json > "$outputs_file"
        
        log "Deployment outputs saved to: $outputs_file"
        
    else
        error "Deployment failed. Check the Azure portal for detailed error information."
    fi
}

post_deployment_verification() {
    local env=$1
    local rg_name=$2
    
    log "Running post-deployment verification..."
    
    # Check key resources
    local resources=("Microsoft.DocumentDB/databaseAccounts" "Microsoft.Storage/storageAccounts" "Microsoft.KeyVault/vaults")
    
    for resource_type in "${resources[@]}"; do
        local count
        count=$(az resource list --resource-group "$rg_name" --resource-type "$resource_type" --query "length(@)")
        
        if [ "$count" -eq 0 ]; then
            warn "No resources of type $resource_type found in resource group $rg_name"
        else
            info "Found $count resource(s) of type $resource_type"
        fi
    done
    
    # Test connectivity to Key Vault (if accessible)
    local kv_name
    if [ "$env" = "prod" ]; then
        kv_name="${PROJECT_NAME}-kv"
    else
        kv_name="${PROJECT_NAME}-${env}-kv"
    fi
    
    if az keyvault secret list --vault-name "$kv_name" --query "length(@)" &> /dev/null; then
        log "Key Vault connectivity test passed"
    else
        warn "Key Vault connectivity test failed - this may be expected if access policies need time to propagate"
    fi
    
    log "Post-deployment verification completed"
}

# Parse command line arguments
ENVIRONMENT=""
DRY_RUN=false
VALIDATE_ONLY=false
FORCE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -s|--subscription)
            SUBSCRIPTION_ID="$2"
            shift 2
            ;;
        -l|--location)
            LOCATION="$2"
            shift 2
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -v|--validate)
            VALIDATE_ONLY=true
            shift
            ;;
        -f|--force)
            FORCE=true
            shift
            ;;
        -h|--help)
            usage
            ;;
        -*|--*)
            error "Unknown option $1"
            ;;
        *)
            if [ -z "$ENVIRONMENT" ]; then
                ENVIRONMENT="$1"
            else
                error "Unexpected argument: $1"
            fi
            shift
            ;;
    esac
done

# Validate required arguments
if [ -z "$ENVIRONMENT" ]; then
    error "Environment argument is required"
fi

# Main execution
main() {
    log "Starting PrepBettr infrastructure deployment"
    log "Environment: $ENVIRONMENT"
    log "Location: $LOCATION"
    log "Dry Run: $DRY_RUN"
    log "Validate Only: $VALIDATE_ONLY"
    
    # Validate environment
    validate_environment "$ENVIRONMENT"
    
    # Check prerequisites
    check_prerequisites
    
    # Set subscription
    set_subscription
    
    # Create resource group
    local rg_name
    rg_name=$(create_resource_group "$ENVIRONMENT")
    
    # Validate deployment
    validate_deployment "$ENVIRONMENT" "$rg_name"
    
    if [ "$VALIDATE_ONLY" = "true" ]; then
        log "Validation completed successfully. Exiting (validate-only mode)."
        exit 0
    fi
    
    # Deploy infrastructure
    deploy_infrastructure "$ENVIRONMENT" "$rg_name"
    
    # Post-deployment verification
    if [ "$DRY_RUN" != "true" ]; then
        post_deployment_verification "$ENVIRONMENT" "$rg_name"
    fi
    
    log "PrepBettr infrastructure deployment completed successfully!"
    
    if [ "$ENVIRONMENT" = "prod" ]; then
        warn "Remember to:"
        warn "1. Update application configuration with new resource endpoints"
        warn "2. Configure network security rules if needed"
        warn "3. Set up monitoring alerts"
        warn "4. Review and update backup policies"
    fi
}

# Execute main function
main