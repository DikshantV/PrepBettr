#!/bin/bash

# Azure Resource Tagging Strategy for PrepBettr
# This script applies comprehensive tags to all Azure resources for governance and cost tracking

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SUBSCRIPTION_ID="d8a087af-6789-498e-9a5c-ba8f470e11e5"
DEFAULT_ENVIRONMENT="Production"
DEFAULT_COST_CENTER="Engineering"
DEFAULT_OWNER="dikshant.vashishtha@prepbettr.com"
DEFAULT_PROJECT="AI-Interview-Platform"

# Function to display colored output
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Function to determine environment from resource group
get_environment() {
    local rg_name="$1"
    case $rg_name in
        *"production"*) echo "Production" ;;
        *"staging"*) echo "Staging" ;;
        *"dev"*|*"development"*) echo "Development" ;;
        *"test"*) echo "Test" ;;
        *"DefaultResourceGroup"*) echo "System" ;;
        *"managed"*) echo "System" ;;
        *) echo "Production" ;;
    esac
}

# Function to determine criticality based on resource type
get_criticality() {
    local resource_type="$1"
    case $resource_type in
        *"Microsoft.Web/sites"*|*"Microsoft.CognitiveServices/accounts"*|*"Microsoft.KeyVault/vaults"*) echo "High" ;;
        *"Microsoft.DocumentDB/databaseAccounts"*|*"Microsoft.Storage/storageAccounts"*) echo "High" ;;
        *"Microsoft.Web/serverFarms"*|*"Microsoft.Insights/components"*) echo "Medium" ;;
        *"Microsoft.Insights/actionGroups"*|*"Microsoft.Insights/metricalerts"*) echo "Medium" ;;
        *"Microsoft.Web/staticSites"*|*"Microsoft.Network/dnszones"*) echo "Low" ;;
        *) echo "Medium" ;;
    esac
}

# Function to determine data classification
get_data_classification() {
    local resource_type="$1"
    local resource_name="$2"
    case $resource_type in
        *"Microsoft.KeyVault/vaults"*) echo "Confidential" ;;
        *"Microsoft.DocumentDB/databaseAccounts"*) echo "Internal" ;;
        *"Microsoft.CognitiveServices/accounts"*) echo "Internal" ;;
        *"Microsoft.Storage/storageAccounts"*) echo "Internal" ;;
        *"Microsoft.Insights"*) echo "Internal" ;;
        *"Microsoft.Web/sites"*) echo "Public" ;;
        *"Microsoft.Network/dnszones"*) echo "Public" ;;
        *) echo "Internal" ;;
    esac
}

# Function to get application component based on resource name/type
get_application_component() {
    local resource_name="$1"
    local resource_type="$2"
    case $resource_name in
        *"speech"*) echo "Voice-Interview-System" ;;
        *"openai"*|*"Interview-agent"*) echo "AI-Conversation-Engine" ;;
        *"cosmosdb"*) echo "Configuration-Management" ;;
        *"keyvault"*) echo "Security-Management" ;;
        *"functions"*) echo "Backend-Processing" ;;
        *"auto-apply"*) echo "Auto-Apply-Feature" ;;
        *"document-intelligence"*|*"form-recognizer"*) echo "Resume-Processing" ;;
        *"insights"*) echo "Monitoring-Observability" ;;
        *"storage"*) echo "Data-Storage" ;;
        *"PrepBettr"*) echo "Web-Application" ;;
        *"swa"*) echo "Static-Content" ;;
        *"dns"*|*".com"*) echo "Network-Infrastructure" ;;
        *) echo "Core-Platform" ;;
    esac
}

# Function to apply tags to a resource
apply_tags() {
    local resource_id="$1"
    local resource_name="$2"
    local resource_type="$3"
    local resource_group="$4"
    local location="$5"

    log_info "Tagging resource: $resource_name ($resource_type)"

    # Determine tag values
    local environment=$(get_environment "$resource_group")
    local criticality=$(get_criticality "$resource_type")
    local data_classification=$(get_data_classification "$resource_type" "$resource_name")
    local app_component=$(get_application_component "$resource_name" "$resource_type")

    # Build tags JSON
    local tags=$(cat << EOF
{
    "Environment": "$environment",
    "Application": "PrepBettr",
    "Project": "$DEFAULT_PROJECT",
    "CostCenter": "$DEFAULT_COST_CENTER",
    "Owner": "$DEFAULT_OWNER",
    "Criticality": "$criticality",
    "DataClassification": "$data_classification",
    "Component": "$app_component",
    "ManagedBy": "Infrastructure-Team",
    "CreatedBy": "Azure-Tagging-Script",
    "LastTagged": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "Region": "$location",
    "ResourceGroup": "$resource_group"
}
EOF
    )

    # Apply tags
    if az resource tag --ids "$resource_id" --tags "$tags" --operation merge >/dev/null 2>&1; then
        log_success "✅ Tagged: $resource_name"
        return 0
    else
        log_error "❌ Failed to tag: $resource_name"
        return 1
    fi
}

# Function to process resources in a resource group
process_resource_group() {
    local rg_name="$1"
    
    log_info "Processing resource group: $rg_name"
    
    # Get all resources in the resource group
    local resources=$(az resource list --resource-group "$rg_name" --query '[].{id:id,name:name,type:type,location:location}' -o json)
    
    if [ "$resources" = "[]" ]; then
        log_warning "No resources found in resource group: $rg_name"
        return
    fi
    
    # Process each resource
    local success_count=0
    local total_count=0
    
    echo "$resources" | jq -r '.[] | @base64' | while read -r encoded_resource; do
        decoded_resource=$(echo "$encoded_resource" | base64 --decode)
        
        resource_id=$(echo "$decoded_resource" | jq -r '.id')
        resource_name=$(echo "$decoded_resource" | jq -r '.name')
        resource_type=$(echo "$decoded_resource" | jq -r '.type')
        resource_location=$(echo "$decoded_resource" | jq -r '.location')
        
        total_count=$((total_count + 1))
        
        if apply_tags "$resource_id" "$resource_name" "$resource_type" "$rg_name" "$resource_location"; then
            success_count=$((success_count + 1))
        fi
    done
    
    log_success "Completed resource group: $rg_name"
}

# Main execution
main() {
    log_info "🏷️  Starting Azure Resource Tagging Strategy for PrepBettr"
    log_info "Subscription: $SUBSCRIPTION_ID"
    log_info "Timestamp: $(date)"
    
    # Verify Azure CLI login
    if ! az account show >/dev/null 2>&1; then
        log_error "Azure CLI not authenticated. Please run 'az login'"
        exit 1
    fi
    
    # Set the correct subscription
    az account set --subscription "$SUBSCRIPTION_ID"
    
    # Get all resource groups
    log_info "Discovering resource groups..."
    resource_groups=$(az group list --query '[].name' -o tsv)
    
    # Process each resource group
    for rg in $resource_groups; do
        process_resource_group "$rg"
        echo # Add spacing
    done
    
    # Generate summary report
    log_success "🎉 Tagging strategy completed!"
    log_info "📊 Generating tag compliance report..."
    
    # Count tagged resources
    total_resources=$(az resource list --subscription "$SUBSCRIPTION_ID" --query 'length(@)')
    tagged_resources=$(az resource list --subscription "$SUBSCRIPTION_ID" --query 'length([?tags.Environment != null])')
    compliance_percentage=$(echo "scale=2; $tagged_resources * 100 / $total_resources" | bc)
    
    echo
    log_success "=== TAGGING SUMMARY ==="
    log_success "Total Resources: $total_resources"
    log_success "Tagged Resources: $tagged_resources"
    log_success "Compliance: ${compliance_percentage}%"
    
    # Show breakdown by environment
    echo
    log_info "=== BY ENVIRONMENT ==="
    az resource list --subscription "$SUBSCRIPTION_ID" --query 'group_by([?tags.Environment != null], &tags.Environment)[].{Environment: key, Count: length(value)}' -o table
    
    # Show breakdown by criticality
    echo
    log_info "=== BY CRITICALITY ==="
    az resource list --subscription "$SUBSCRIPTION_ID" --query 'group_by([?tags.Criticality != null], &tags.Criticality)[].{Criticality: key, Count: length(value)}' -o table
    
    # Show cost center summary
    echo
    log_info "=== BY COST CENTER ==="
    az resource list --subscription "$SUBSCRIPTION_ID" --query 'group_by([?tags.CostCenter != null], &tags.CostCenter)[].{CostCenter: key, Count: length(value)}' -o table
    
    log_success "✅ Azure tagging strategy implementation completed!"
    log_info "💡 You can now use these tags for cost analysis, governance policies, and resource management"
}

# Script help
show_help() {
    echo "Azure Resource Tagging Strategy Script"
    echo
    echo "Usage: $0 [OPTIONS]"
    echo
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo "  --dry-run      Show what would be tagged without making changes"
    echo "  --rg NAME      Tag resources in specific resource group only"
    echo
    echo "Examples:"
    echo "  $0                          # Tag all resources"
    echo "  $0 --rg PrepBettr_group    # Tag resources in specific group"
    echo "  $0 --dry-run               # Preview changes"
}

# Parse command line arguments
case "${1:-}" in
    -h|--help)
        show_help
        exit 0
        ;;
    --dry-run)
        log_warning "DRY RUN MODE - No changes will be made"
        # Override apply_tags function for dry run
        apply_tags() {
            local resource_name="$2"
            local resource_type="$3"
            log_info "Would tag: $resource_name ($resource_type)"
            return 0
        }
        main
        ;;
    --rg)
        if [ -z "${2:-}" ]; then
            log_error "Resource group name required"
            exit 1
        fi
        process_resource_group "$2"
        ;;
    *)
        main
        ;;
esac
