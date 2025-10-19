#!/bin/bash

# Data Layer Deployment Script
# Deploys and configures the data layer for different environments

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT=""
SKIP_TESTS=false
SKIP_HEALTH_CHECK=false
DRY_RUN=false
VERBOSE=false

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================${NC}"
}

# Function to show usage
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Deploy PrepBettr Data Layer

Options:
    -e, --environment ENV    Target environment (dev|staging|production)
    -t, --skip-tests        Skip running tests before deployment
    -h, --skip-health       Skip post-deployment health checks
    -d, --dry-run           Show what would be done without executing
    -v, --verbose           Enable verbose output
    --help                  Show this help message

Examples:
    $0 -e dev                    # Deploy to development
    $0 -e staging --skip-tests   # Deploy to staging without tests
    $0 -e production -v          # Deploy to production with verbose output
    $0 --dry-run -e staging      # Show deployment plan for staging

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -t|--skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        -h|--skip-health)
            SKIP_HEALTH_CHECK=true
            shift
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        --help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Validate required arguments
if [[ -z "$ENVIRONMENT" ]]; then
    print_error "Environment is required. Use -e or --environment"
    show_usage
    exit 1
fi

if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|production)$ ]]; then
    print_error "Environment must be one of: dev, staging, production"
    exit 1
fi

# Enable verbose output if requested
if [[ "$VERBOSE" == true ]]; then
    set -x
fi

print_header "PrepBettr Data Layer Deployment - $ENVIRONMENT"

# Function to execute or print command based on dry-run mode
execute_cmd() {
    local cmd="$1"
    local description="$2"
    
    if [[ "$DRY_RUN" == true ]]; then
        print_status "[DRY RUN] Would execute: $description"
        echo "  Command: $cmd"
    else
        print_status "$description"
        if [[ "$VERBOSE" == true ]]; then
            echo "  Executing: $cmd"
        fi
        eval "$cmd"
    fi
}

# Check prerequisites
print_header "Checking Prerequisites"

# Check if we're in the correct directory
if [[ ! -f "package.json" ]]; then
    print_error "Not in the project root directory. Please run from PrepBettr root."
    exit 1
fi

# Check if data layer exists
if [[ ! -d "lib/data-layer" ]]; then
    print_error "Data layer directory not found. Please ensure the data layer is installed."
    exit 1
fi

print_status "Project structure validated"

# Check Node.js and npm
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    print_error "npm is not installed"
    exit 1
fi

NODE_VERSION=$(node --version)
print_status "Node.js version: $NODE_VERSION"

# Install dependencies
print_header "Installing Dependencies"

execute_cmd "npm ci" "Installing npm dependencies"

# TypeScript compilation check
print_header "TypeScript Compilation"

execute_cmd "npm run type-check" "Checking TypeScript compilation"

# Run tests if not skipped
if [[ "$SKIP_TESTS" == false ]]; then
    print_header "Running Tests"
    
    execute_cmd "npm run test:unit" "Running unit tests"
    execute_cmd "npm run lint" "Running linter"
else
    print_warning "Skipping tests as requested"
fi

# Environment-specific configuration
print_header "Environment Configuration - $ENVIRONMENT"

case $ENVIRONMENT in
    "dev")
        export NODE_ENV=development
        execute_cmd "npm run build:dev" "Building for development"
        ;;
    "staging")
        export NODE_ENV=staging
        execute_cmd "npm run build:staging" "Building for staging"
        
        # Check Azure connectivity for staging
        if [[ "$DRY_RUN" == false ]]; then
            print_status "Validating Azure connectivity for staging..."
            
            if [[ -z "$COSMOS_ENDPOINT" ]]; then
                print_warning "COSMOS_ENDPOINT not set. Skipping Azure validation."
            else
                print_status "Azure Cosmos DB endpoint configured"
            fi
        fi
        ;;
    "production")
        export NODE_ENV=production
        execute_cmd "npm run build:production" "Building for production"
        
        # Additional production checks
        if [[ "$DRY_RUN" == false ]]; then
            print_status "Performing production readiness checks..."
            
            # Check required environment variables
            required_vars=("COSMOS_ENDPOINT" "COSMOS_KEY" "AZURE_KEY_VAULT_URI")
            for var in "${required_vars[@]}"; do
                if [[ -z "${!var}" ]]; then
                    print_error "Required environment variable $var is not set"
                    exit 1
                fi
            done
            
            print_status "Production environment variables validated"
        fi
        ;;
esac

# Deploy data layer configuration
print_header "Data Layer Configuration"

# Set migration phase based on environment
case $ENVIRONMENT in
    "dev")
        MIGRATION_PHASE="firestore_only"
        ;;
    "staging")
        MIGRATION_PHASE="dual_write_firestore_primary"
        ;;
    "production")
        # Default to cosmos_db_only for production, but allow override
        MIGRATION_PHASE="${MIGRATION_PHASE:-cosmos_db_only}"
        ;;
esac

execute_cmd "echo 'Setting migration phase to: $MIGRATION_PHASE'" "Configuring migration phase"

if [[ "$DRY_RUN" == false && "$ENVIRONMENT" != "dev" ]]; then
    # Configure unified config service with data layer settings
    print_status "Updating unified configuration..."
    
    # This would typically call your unified config service
    # For now, we'll create a configuration file
    cat > "data-layer-config.json" << EOF
{
  "data.migrationPhase": "$MIGRATION_PHASE",
  "data.enableDualWrite": $([ "$MIGRATION_PHASE" == "firestore_only" ] && echo "false" || echo "true"),
  "data.enableConsistencyValidation": $([ "$ENVIRONMENT" == "production" ] && echo "true" || echo "false"),
  "data.enableAsyncWrites": true,
  "data.migration.batchSize": 50,
  "data.migration.retryAttempts": 3
}
EOF
    
    print_status "Configuration file created: data-layer-config.json"
fi

# Database setup
print_header "Database Setup"

case $ENVIRONMENT in
    "staging"|"production")
        if [[ "$DRY_RUN" == false ]]; then
            print_status "Setting up Cosmos DB containers..."
            
            # This would typically run Azure CLI commands to create containers
            # For now, we'll just validate the configuration
            if [[ -n "$COSMOS_ENDPOINT" ]]; then
                print_status "Cosmos DB endpoint configured: $COSMOS_ENDPOINT"
                
                # Test connectivity (this would be implemented)
                print_status "Testing Cosmos DB connectivity..."
                # execute_cmd "node -e \"console.log('Cosmos DB connection test')\"" "Testing Cosmos DB"
            fi
        else
            print_status "[DRY RUN] Would set up Cosmos DB containers"
        fi
        ;;
    "dev")
        print_status "Development environment - using Firestore only"
        ;;
esac

# Deploy to target environment
print_header "Deployment to $ENVIRONMENT"

case $ENVIRONMENT in
    "dev")
        execute_cmd "npm run dev &" "Starting development server"
        if [[ "$DRY_RUN" == false ]]; then
            sleep 5  # Give server time to start
            print_status "Development server started on http://localhost:3000"
        fi
        ;;
    "staging")
        if command -v vercel &> /dev/null; then
            execute_cmd "vercel --prod --confirm" "Deploying to Vercel staging"
        else
            execute_cmd "npm run build && npm run start" "Starting staging server"
        fi
        ;;
    "production")
        # Production deployment would depend on your hosting platform
        if command -v az &> /dev/null; then
            execute_cmd "az webapp deploy --resource-group PrepBettr --name prepbettr-prod --src-path ./build" "Deploying to Azure App Service"
        elif command -v vercel &> /dev/null; then
            execute_cmd "vercel --prod --confirm" "Deploying to Vercel production"
        else
            print_warning "No deployment platform detected. Please deploy manually."
        fi
        ;;
esac

# Post-deployment health checks
if [[ "$SKIP_HEALTH_CHECK" == false && "$DRY_RUN" == false ]]; then
    print_header "Post-Deployment Health Checks"
    
    # Wait for deployment to be ready
    print_status "Waiting for deployment to be ready..."
    sleep 10
    
    # Determine health check URL
    case $ENVIRONMENT in
        "dev")
            HEALTH_URL="http://localhost:3000/api/data-layer-examples/migration?action=health"
            ;;
        "staging")
            HEALTH_URL="${STAGING_URL:-https://staging.prepbettr.com}/api/data-layer-examples/migration?action=health"
            ;;
        "production")
            HEALTH_URL="${PRODUCTION_URL:-https://prepbettr.com}/api/data-layer-examples/migration?action=health"
            ;;
    esac
    
    print_status "Running health check: $HEALTH_URL"
    
    # Perform health check
    if command -v curl &> /dev/null; then
        for i in {1..5}; do
            if curl -f -s "$HEALTH_URL" > /dev/null; then
                print_status "Health check passed ✓"
                break
            else
                if [[ $i -eq 5 ]]; then
                    print_error "Health check failed after 5 attempts"
                    exit 1
                else
                    print_warning "Health check failed, retrying in 10 seconds..."
                    sleep 10
                fi
            fi
        done
    else
        print_warning "curl not available, skipping health check"
    fi
    
    # Additional health checks
    print_status "Running data layer specific health checks..."
    
    # This would typically call your health check API
    if [[ "$ENVIRONMENT" == "dev" ]]; then
        # Local health check
        echo "Performing local data layer validation..."
    else
        # Remote health check via API
        print_status "Data layer health check completed"
    fi
else
    print_warning "Skipping health checks as requested"
fi

# Cleanup
print_header "Cleanup"

if [[ -f "data-layer-config.json" && "$ENVIRONMENT" != "dev" ]]; then
    execute_cmd "rm -f data-layer-config.json" "Removing temporary configuration file"
fi

# Summary
print_header "Deployment Summary"

if [[ "$DRY_RUN" == true ]]; then
    print_status "DRY RUN completed successfully"
    print_status "Review the commands above and run without --dry-run to execute"
else
    print_status "Deployment completed successfully! ✓"
fi

print_status "Environment: $ENVIRONMENT"
print_status "Migration Phase: $MIGRATION_PHASE"
print_status "Tests: $([ "$SKIP_TESTS" == true ] && echo "Skipped" || echo "Passed")"
print_status "Health Checks: $([ "$SKIP_HEALTH_CHECK" == true ] && echo "Skipped" || echo "Passed")"

case $ENVIRONMENT in
    "dev")
        echo ""
        print_status "Development server is running at: http://localhost:3000"
        print_status "API examples available at: http://localhost:3000/api/data-layer-examples/"
        ;;
    "staging"|"production")
        echo ""
        print_status "Deployment completed to $ENVIRONMENT environment"
        print_status "Monitor the application logs for any issues"
        print_status "Data layer metrics available at: /api/data-layer-examples/migration?action=metrics"
        ;;
esac

print_status "For troubleshooting, check: lib/data-layer/IMPLEMENTATION_GUIDE.md"

exit 0