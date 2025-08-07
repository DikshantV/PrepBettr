#!/bin/bash

# Azure Deployment Script for PrepBettr
# This script handles deployment to Azure App Service with staging slot validation

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-prepbettr-rg}"
APP_NAME="${AZURE_APP_NAME:-prepbettr-app}"
STAGING_SLOT="staging"
DEPLOYMENT_NAME="deploy-$(date +%Y%m%d-%H%M%S)"

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if Azure CLI is installed
check_azure_cli() {
    if ! command -v az &> /dev/null; then
        print_error "Azure CLI is not installed. Please install it first."
        exit 1
    fi
    print_status "Azure CLI found"
}

# Function to check if logged in to Azure
check_azure_login() {
    if ! az account show &> /dev/null; then
        print_error "Not logged in to Azure. Please run 'az login' first."
        exit 1
    fi
    print_status "Azure login verified"
}

# Function to build the application
build_app() {
    print_status "Building application..."
    npm run build
    if [ $? -eq 0 ]; then
        print_status "Build completed successfully"
    else
        print_error "Build failed"
        exit 1
    fi
}

# Function to create deployment package
create_package() {
    print_status "Creating deployment package..."
    
    # Create a temporary directory for deployment files
    DEPLOY_DIR="deploy-temp"
    rm -rf $DEPLOY_DIR
    mkdir -p $DEPLOY_DIR
    
    # Copy necessary files
    cp -r .next $DEPLOY_DIR/
    cp -r public $DEPLOY_DIR/
    cp -r azure $DEPLOY_DIR/
    cp package*.json $DEPLOY_DIR/
    cp next.config.js $DEPLOY_DIR/ 2>/dev/null || true
    cp tsconfig.json $DEPLOY_DIR/ 2>/dev/null || true
    
    # Create web.config for Azure App Service (IIS)
    cat > $DEPLOY_DIR/web.config << 'EOF'
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <handlers>
      <add name="iisnode" path="server.js" verb="*" modules="iisnode"/>
    </handlers>
    <rewrite>
      <rules>
        <rule name="NodeInspector" patternSyntax="ECMAScript" stopProcessing="true">
          <match url="^server.js\/debug[\/]?" />
        </rule>
        <rule name="StaticContent">
          <action type="Rewrite" url="public{REQUEST_URI}"/>
        </rule>
        <rule name="DynamicContent">
          <conditions>
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="True"/>
          </conditions>
          <action type="Rewrite" url="server.js"/>
        </rule>
      </rules>
    </rewrite>
    <security>
      <requestFiltering>
        <hiddenSegments>
          <remove segment="bin"/>
        </hiddenSegments>
      </requestFiltering>
    </security>
    <httpErrors existingResponse="PassThrough" />
    <iisnode node_env="production" />
  </system.webServer>
</configuration>
EOF
    
    # Create server.js for Azure App Service
    cat > $DEPLOY_DIR/server.js << 'EOF'
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = false;
const hostname = '0.0.0.0';
const port = process.env.PORT || 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  }).listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
EOF
    
    # Create deployment zip
    cd $DEPLOY_DIR
    zip -r ../deploy.zip . -q
    cd ..
    rm -rf $DEPLOY_DIR
    
    print_status "Deployment package created: deploy.zip"
}

# Function to deploy to staging slot
deploy_to_staging() {
    print_status "Deploying to staging slot..."
    
    az webapp deployment source config-zip \
        --resource-group "$RESOURCE_GROUP" \
        --name "$APP_NAME" \
        --slot "$STAGING_SLOT" \
        --src deploy.zip
    
    if [ $? -eq 0 ]; then
        print_status "Deployment to staging slot completed"
    else
        print_error "Deployment to staging slot failed"
        exit 1
    fi
}

# Function to run smoke tests
run_smoke_tests() {
    print_status "Running smoke tests on staging..."
    
    STAGING_URL="https://${APP_NAME}-${STAGING_SLOT}.azurewebsites.net"
    
    # Basic health check
    print_status "Testing health endpoint..."
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${STAGING_URL}/api/health")
    
    if [ "$HTTP_STATUS" -eq 200 ]; then
        print_status "Health check passed"
    else
        print_error "Health check failed with status: $HTTP_STATUS"
        return 1
    fi
    
    # Test Azure services
    print_status "Testing Azure services..."
    AZURE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${STAGING_URL}/api/health/azure")
    
    if [ "$AZURE_STATUS" -eq 200 ]; then
        print_status "Azure services check passed"
    else
        print_warning "Azure services check returned status: $AZURE_STATUS"
    fi
    
    # Run E2E tests if available
    if [ -f "playwright.config.production.ts" ]; then
        print_status "Running E2E tests..."
        NEXT_PUBLIC_APP_URL="$STAGING_URL" npm run test:e2e:prod
        
        if [ $? -eq 0 ]; then
            print_status "E2E tests passed"
        else
            print_warning "Some E2E tests failed - review before swapping"
        fi
    fi
    
    return 0
}

# Function to swap staging to production
swap_to_production() {
    print_status "Swapping staging to production..."
    
    read -p "Are you sure you want to swap staging to production? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_warning "Swap cancelled"
        return 1
    fi
    
    az webapp deployment slot swap \
        --resource-group "$RESOURCE_GROUP" \
        --name "$APP_NAME" \
        --slot "$STAGING_SLOT" \
        --target-slot "production"
    
    if [ $? -eq 0 ]; then
        print_status "Successfully swapped to production"
        
        # Verify production
        PROD_URL="https://${APP_NAME}.azurewebsites.net"
        HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${PROD_URL}/api/health")
        
        if [ "$HTTP_STATUS" -eq 200 ]; then
            print_status "Production health check passed"
        else
            print_error "Production health check failed with status: $HTTP_STATUS"
            print_warning "Consider rolling back the deployment"
        fi
    else
        print_error "Swap to production failed"
        return 1
    fi
}

# Function to rollback deployment
rollback() {
    print_warning "Rolling back deployment..."
    
    az webapp deployment slot swap \
        --resource-group "$RESOURCE_GROUP" \
        --name "$APP_NAME" \
        --slot "production" \
        --target-slot "$STAGING_SLOT"
    
    if [ $? -eq 0 ]; then
        print_status "Rollback completed"
    else
        print_error "Rollback failed - manual intervention required"
    fi
}

# Function to cleanup
cleanup() {
    print_status "Cleaning up..."
    rm -f deploy.zip
    print_status "Cleanup completed"
}

# Main deployment flow
main() {
    print_status "Starting deployment process..."
    print_status "Deployment ID: $DEPLOYMENT_NAME"
    print_status "Target: $APP_NAME ($RESOURCE_GROUP)"
    
    # Pre-flight checks
    check_azure_cli
    check_azure_login
    
    # Build and package
    build_app
    create_package
    
    # Deploy to staging
    deploy_to_staging
    
    # Test staging
    if run_smoke_tests; then
        print_status "Smoke tests passed"
        
        # Swap to production
        if swap_to_production; then
            print_status "Deployment completed successfully!"
            print_status "Production URL: https://${APP_NAME}.azurewebsites.net"
        else
            print_warning "Production swap was cancelled or failed"
        fi
    else
        print_error "Smoke tests failed - deployment stopped"
        print_warning "Staging URL: https://${APP_NAME}-${STAGING_SLOT}.azurewebsites.net"
        print_warning "Please review the staging environment before proceeding"
        
        read -p "Do you want to force swap to production anyway? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            swap_to_production
        fi
    fi
    
    # Cleanup
    cleanup
}

# Handle script interruption
trap 'print_error "Deployment interrupted"; cleanup; exit 1' INT TERM

# Check for command line arguments
case "${1:-}" in
    rollback)
        rollback
        ;;
    test)
        STAGING_URL="https://${APP_NAME}-${STAGING_SLOT}.azurewebsites.net"
        print_status "Testing staging environment: $STAGING_URL"
        run_smoke_tests
        ;;
    swap)
        swap_to_production
        ;;
    *)
        main
        ;;
esac
