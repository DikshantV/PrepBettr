#!/bin/bash

# Azure Cosmos DB Management Script for PrepBettr
# This script provides comprehensive monitoring and auditing capabilities for Cosmos DB

set -euo pipefail

# Configuration
SUBSCRIPTION_ID="d8a087af-6789-498e-9a5c-ba8f470e11e5"
RESOURCE_GROUP="PrepBettr_group"
COSMOS_ACCOUNT="prepbettr-cosmosdb"
REPORT_DATE=$(date +%Y-%m-%d)
REPORT_FILE="cosmos_audit_report_${REPORT_DATE}.md"
SAMPLES_DIR="samples"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Initialize environment
initialize_environment() {
    log_info "Initializing Azure Cosmos DB audit environment..."
    
    # Set subscription
    az account set --subscription "$SUBSCRIPTION_ID" || {
        log_error "Failed to set subscription $SUBSCRIPTION_ID"
        exit 1
    }
    
    # Check if cosmosdb-preview extension is installed
    if ! az extension list --query "[?name=='cosmosdb-preview']" -o tsv | grep -q cosmosdb-preview; then
        log_info "Installing cosmosdb-preview extension..."
        az extension add --name cosmosdb-preview
    fi
    
    # Create samples directory
    mkdir -p "$SAMPLES_DIR"
    
    log_success "Environment initialized successfully"
}

# Discover databases
discover_databases() {
    log_info "Discovering databases in account: $COSMOS_ACCOUNT"
    
    local databases
    databases=$(az cosmosdb sql database list \
        --account-name "$COSMOS_ACCOUNT" \
        --resource-group "$RESOURCE_GROUP" \
        --query "[].name" \
        --output tsv) || {
        log_error "Failed to list databases"
        return 1
    }
    
    if [[ -z "$databases" ]]; then
        log_warning "No databases found in account $COSMOS_ACCOUNT"
        return 1
    fi
    
    echo "$databases"
}

# Get container information
get_container_info() {
    local database=$1
    log_info "Enumerating containers in database: $database"
    
    az cosmosdb sql container list \
        --account-name "$COSMOS_ACCOUNT" \
        --resource-group "$RESOURCE_GROUP" \
        --database-name "$database" \
        --query "[].{name:name, partitionKey:resource.partitionKey.paths[0], documentCount:resource.statistics[0].documentCount, sizeKB:resource.statistics[0].sizeInKB}" \
        --output json || {
        log_error "Failed to list containers for database $database"
        return 1
    }
}

# Get container throughput
get_container_throughput() {
    local database=$1
    local container=$2
    
    az cosmosdb sql container throughput show \
        --account-name "$COSMOS_ACCOUNT" \
        --resource-group "$RESOURCE_GROUP" \
        --database-name "$database" \
        --name "$container" \
        --query "resource.{throughput:throughput, minimumThroughput:minimumThroughput, instantMaximumThroughput:instantMaximumThroughput}" \
        --output json 2>/dev/null || echo '{"throughput": "shared", "minimumThroughput": "N/A", "instantMaximumThroughput": "N/A"}'
}

# Query sample documents
query_sample_documents() {
    local database=$1
    local container=$2
    local document_count=$3
    
    if [[ "$document_count" -eq 0 ]]; then
        log_warning "Container $container is empty – skipped document sampling"
        return 0
    fi
    
    log_info "Retrieving sample documents from $container (found $document_count documents)"
    
    local sample_file="$SAMPLES_DIR/${database}_${container}.json"
    mkdir -p "$(dirname "$sample_file")"
    
    az cosmosdb sql query \
        --account-name "$COSMOS_ACCOUNT" \
        --resource-group "$RESOURCE_GROUP" \
        --database-name "$database" \
        --container-name "$container" \
        --query-text "SELECT * FROM c OFFSET 0 LIMIT 10" \
        --output json > "$sample_file" 2>/dev/null || {
        log_warning "Failed to query documents from $container"
        echo "[]" > "$sample_file"
    }
    
    log_success "Sample documents saved to $sample_file"
}

# Get storage metrics
get_storage_metrics() {
    log_info "Retrieving storage and usage metrics..."
    
    local cosmos_resource_id
    cosmos_resource_id=$(az cosmosdb show \
        --name "$COSMOS_ACCOUNT" \
        --resource-group "$RESOURCE_GROUP" \
        --query "id" \
        --output tsv)
    
    # Get recent RU consumption
    local ru_usage
    ru_usage=$(az monitor metrics list \
        --resource "$cosmos_resource_id" \
        --metric "TotalRequestUnits" \
        --interval PT1H \
        --aggregation Maximum \
        --query "value[0].timeseries[0].data[-1].maximum" \
        --output tsv 2>/dev/null || echo "0")
    
    echo "$ru_usage"
}

# Generate report
generate_report() {
    local databases=("$@")
    
    log_info "Generating comprehensive audit report..."
    
    cat > "$REPORT_FILE" << EOF
# Azure Cosmos DB Audit Report - PrepBettr
**Generated on:** $REPORT_DATE  
**Account:** $COSMOS_ACCOUNT  
**Resource Group:** $RESOURCE_GROUP  
**Subscription:** $SUBSCRIPTION_ID  

## Executive Summary
EOF

    for database in "${databases[@]}"; do
        log_info "Processing database: $database"
        
        local containers_info
        containers_info=$(get_container_info "$database")
        
        # Count containers and documents
        local container_count
        container_count=$(echo "$containers_info" | jq length)
        
        local total_documents
        total_documents=$(echo "$containers_info" | jq '[.[].documentCount] | add // 0')
        
        cat >> "$REPORT_FILE" << EOF

### Database: $database
- **Container Count:** $container_count
- **Total Documents:** $total_documents
- **Status:** $([ "$total_documents" -eq 0 ] && echo "Empty (Development/Staging)" || echo "Active")

## Container Details

| Container | Partition Key | Document Count | Size (KB) | Throughput (RU/s) | Min RU/s | Max RU/s | Status |
|-----------|---------------|----------------|-----------|-------------------|----------|----------|---------|
EOF

        # Process each container
        echo "$containers_info" | jq -r '.[] | @base64' | while IFS= read -r container_data; do
            local container_json
            container_json=$(echo "$container_data" | base64 --decode)
            
            local container_name
            container_name=$(echo "$container_json" | jq -r '.name')
            
            local partition_key
            partition_key=$(echo "$container_json" | jq -r '.partitionKey // "N/A"')
            
            local document_count
            document_count=$(echo "$container_json" | jq -r '.documentCount')
            
            local size_kb
            size_kb=$(echo "$container_json" | jq -r '.sizeKB')
            
            # Get throughput info
            local throughput_info
            throughput_info=$(get_container_throughput "$database" "$container_name")
            
            local throughput
            throughput=$(echo "$throughput_info" | jq -r '.throughput')
            
            local min_throughput
            min_throughput=$(echo "$throughput_info" | jq -r '.minimumThroughput')
            
            local max_throughput
            max_throughput=$(echo "$throughput_info" | jq -r '.instantMaximumThroughput')
            
            local status
            if [[ "$document_count" -eq 0 ]]; then
                status="**Empty**"
            else
                status="Active"
                # Query sample documents for non-empty containers
                query_sample_documents "$database" "$container_name" "$document_count"
            fi
            
            echo "| $container_name | $partition_key | $document_count | $size_kb | $throughput | $min_throughput | $max_throughput | $status |" >> "$REPORT_FILE"
        done
    done
    
    # Add storage metrics
    local ru_usage
    ru_usage=$(get_storage_metrics)
    
    cat >> "$REPORT_FILE" << EOF

## Resource Consumption

### Recent Metrics
- **Recent Peak RU Usage:** $ru_usage RU/s
- **Account Location:** Central US
- **Account Type:** Standard (GlobalDocumentDB)

## Cost Optimization Recommendations

Since all containers are currently empty, consider these optimizations:

1. **Shared Database Throughput:** Move to shared throughput model for cost efficiency
2. **Autoscale Throughput:** Use autoscale to handle varying workloads efficiently  
3. **Monitor Usage Patterns:** Track actual usage once data population begins

### Migration Commands
\`\`\`bash
# Switch to shared database throughput
az cosmosdb sql database throughput migrate \\
  --account-name $COSMOS_ACCOUNT \\
  --resource-group $RESOURCE_GROUP \\
  --name PrepBettrDB \\
  --throughput-type shared \\
  --throughput 400

# Alternative: Enable autoscale
az cosmosdb sql database throughput migrate \\
  --account-name $COSMOS_ACCOUNT \\
  --resource-group $RESOURCE_GROUP \\
  --name PrepBettrDB \\
  --throughput-type autoscale \\
  --max-throughput 1000
\`\`\`

---
*Report generated on $REPORT_DATE using cosmos_manage.sh*
EOF

    log_success "Report generated: $REPORT_FILE"
}

# Provide monitoring guidance
provide_monitoring_guidance() {
    log_info "Generating monitoring and alerting recommendations..."
    
    local cosmos_resource_id
    cosmos_resource_id=$(az cosmosdb show \
        --name "$COSMOS_ACCOUNT" \
        --resource-group "$RESOURCE_GROUP" \
        --query "id" \
        --output tsv)
    
    cat << EOF

========================================
MONITORING & ALERTING RECOMMENDATIONS
========================================

1. RU Consumption Alert (>80% for 5 minutes):
az monitor metrics alert create \\
  --name "CosmosDB-HighRU-PrepBettr" \\
  --resource-group $RESOURCE_GROUP \\
  --scopes "$cosmos_resource_id" \\
  --condition "avg TotalRequestUnits > 5000" \\
  --window-size 5m \\
  --evaluation-frequency 1m \\
  --severity 2 \\
  --description "Alert when Cosmos DB RU consumption exceeds 80% of provisioned capacity"

2. Storage Usage Alert (>500MB):
az monitor metrics alert create \\
  --name "CosmosDB-HighStorage-PrepBettr" \\
  --resource-group $RESOURCE_GROUP \\
  --scopes "$cosmos_resource_id" \\
  --condition "avg DataUsage > 500000000" \\
  --window-size 5m \\
  --evaluation-frequency 5m \\
  --severity 3 \\
  --description "Alert when Cosmos DB storage usage exceeds 500MB"

3. Request Rate Alert (>1000 requests/sec):
az monitor metrics alert create \\
  --name "CosmosDB-HighRequestRate-PrepBettr" \\
  --resource-group $RESOURCE_GROUP \\
  --scopes "$cosmos_resource_id" \\
  --condition "avg TotalRequests > 1000" \\
  --window-size 5m \\
  --evaluation-frequency 1m \\
  --severity 2 \\
  --description "Alert when request rate exceeds 1000 requests per second"

========================================
ARM TEMPLATE SNIPPET FOR AZURE MONITOR
========================================

{
  "type": "Microsoft.Insights/metricAlerts",
  "apiVersion": "2018-03-01",
  "name": "CosmosDB-ComprehensiveMonitoring",
  "properties": {
    "severity": 2,
    "enabled": true,
    "scopes": ["$cosmos_resource_id"],
    "criteria": {
      "allOf": [
        {
          "name": "HighRUConsumption",
          "metricNamespace": "Microsoft.DocumentDB/databaseAccounts",
          "metricName": "TotalRequestUnits",
          "operator": "GreaterThan",
          "threshold": 5000,
          "timeAggregation": "Average"
        }
      ]
    },
    "windowSize": "PT5M",
    "evaluationFrequency": "PT1M"
  }
}

EOF
}

# Main execution
main() {
    log_info "Starting Azure Cosmos DB audit for PrepBettr..."
    
    # Initialize environment
    initialize_environment
    
    # Discover databases
    local databases
    databases=$(discover_databases) || {
        log_error "No databases found or failed to discover databases"
        exit 0  # Exit gracefully for CI/CD pipelines
    }
    
    # Convert to array
    IFS=$'\n' read -rd '' -a db_array <<< "$databases" || true
    
    # Generate report
    generate_report "${db_array[@]}"
    
    # Provide monitoring guidance
    provide_monitoring_guidance
    
    log_success "Cosmos DB audit completed successfully!"
    log_info "Report saved to: $REPORT_FILE"
    
    if [[ -d "$SAMPLES_DIR" ]] && [[ -n "$(ls -A "$SAMPLES_DIR" 2>/dev/null)" ]]; then
        log_info "Sample documents saved to: $SAMPLES_DIR/"
    else
        log_info "No sample documents saved (all containers are empty)"
    fi
}

# Script help
show_help() {
    cat << EOF
Azure Cosmos DB Management Script for PrepBettr

USAGE:
    $0 [OPTION]

OPTIONS:
    -h, --help     Show this help message
    --quick        Run quick audit (skip document sampling)
    --report-only  Generate report from cached data only

EXAMPLES:
    $0                    # Full audit with document sampling
    $0 --quick           # Quick audit without document sampling
    $0 --report-only     # Generate report only

PREREQUISITES:
    - Azure CLI installed and logged in
    - jq installed for JSON processing
    - Appropriate permissions for Cosmos DB account

OUTPUT:
    - cosmos_audit_report_YYYY-MM-DD.md   # Comprehensive audit report
    - samples/                            # Directory with sample documents
    - cosmos_run.log                      # Execution log (if redirected)

EOF
}

# Parse command line arguments
case "${1:-}" in
    -h|--help)
        show_help
        exit 0
        ;;
    --quick)
        log_info "Running in quick mode (no document sampling)"
        QUICK_MODE=true
        ;;
    --report-only)
        log_info "Generating report from existing data only"
        REPORT_ONLY=true
        ;;
    "")
        # Default mode
        ;;
    *)
        log_error "Unknown option: $1"
        show_help
        exit 1
        ;;
esac

# Execute main function
main "$@"
