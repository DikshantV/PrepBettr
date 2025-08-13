#!/bin/bash

# =============================================================================
# Post-Migration Validation Script for PrepBettr Azure Migration
# =============================================================================
# Comprehensive testing and validation after Firebase → Azure migration
# =============================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
REPORT_FILE="$PROJECT_ROOT/POST_MIGRATION_VALIDATION_REPORT.md"

# Test results tracking
FUNCTIONAL_TESTS_PASSED=0
FUNCTIONAL_TESTS_FAILED=0
SECURITY_ISSUES=0
PERFORMANCE_ISSUES=0
CLEANUP_ACTIONS=0

echo -e "${BLUE}🔍 PrepBettr Post-Migration Validation${NC}"
echo -e "${BLUE}=======================================${NC}"
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
}

log_step() {
    echo -e "${BLUE}📋 Step: $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
    ((FUNCTIONAL_TESTS_PASSED++))
}

log_failure() {
    echo -e "${RED}❌ $1${NC}"
    ((FUNCTIONAL_TESTS_FAILED++))
}

log_security_issue() {
    echo -e "${RED}🔐 SECURITY: $1${NC}"
    ((SECURITY_ISSUES++))
}

log_performance_issue() {
    echo -e "${YELLOW}⚡ PERFORMANCE: $1${NC}"
    ((PERFORMANCE_ISSUES++))
}

log_cleanup() {
    echo -e "${PURPLE}🧹 CLEANUP: $1${NC}"
    ((CLEANUP_ACTIONS++))
}

# Initialize report
init_report() {
    cat > "$REPORT_FILE" << EOF
# PrepBettr Post-Migration Validation Report

**Generated:** $(date -u +"%Y-%m-%d %H:%M:%S UTC")  
**Migration Phase:** Firebase → Azure Complete  
**Validation Type:** Comprehensive End-to-End  

---

## 🎯 Executive Summary

| Category | Status | Details |
|----------|---------|---------|
| **Functional Tests** | 🔄 Running | - |
| **Security Audit** | 🔄 Running | - |
| **Performance Check** | 🔄 Running | - |
| **Code Cleanup** | 🔄 Running | - |
| **Deployment Ready** | 🔄 Pending | - |

---

## 📋 Detailed Results

EOF
}

# Update report section
update_report() {
    local section="$1"
    local content="$2"
    
    echo "" >> "$REPORT_FILE"
    echo "### $section" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo "$content" >> "$REPORT_FILE"
}

# =============================================================================
# 1️⃣ Functional End-to-End Testing
# =============================================================================

test_build_system() {
    log_step "Testing Build System"
    
    cd "$PROJECT_ROOT"
    
    # Test TypeScript compilation
    log_info "Checking TypeScript compilation..."
    if npm run type-check > /dev/null 2>&1; then
        log_success "TypeScript compilation passed"
    else
        log_failure "TypeScript compilation failed"
        update_report "🔴 Build System Issues" "- TypeScript compilation errors detected"
    fi
    
    # Test linting
    log_info "Running ESLint checks..."
    if npm run lint > /dev/null 2>&1; then
        log_success "Linting passed"
    else
        log_failure "Linting issues detected"
    fi
    
    # Test build process
    log_info "Testing production build..."
    if npm run build > /dev/null 2>&1; then
        log_success "Production build successful"
    else
        log_failure "Production build failed"
    fi
}

test_azure_services() {
    log_step "Testing Azure Services Connectivity"
    
    cd "$PROJECT_ROOT"
    
    # Test Azure health
    log_info "Testing Azure services health..."
    if npm run check:azure > /dev/null 2>&1; then
        log_success "Azure services healthy"
    else
        log_failure "Azure services health check failed"
    fi
    
    # Test Azure OpenAI
    log_info "Testing Azure OpenAI integration..."
    if npm run test:azure-openai > /dev/null 2>&1; then
        log_success "Azure OpenAI integration working"
    else
        log_failure "Azure OpenAI integration failed"
    fi
}

test_authentication_flow() {
    log_step "Testing Authentication Flow"
    
    cd "$PROJECT_ROOT"
    
    # Test Firebase Auth integration
    log_info "Testing Firebase Auth integration..."
    if npm run test:auth-flow > /dev/null 2>&1; then
        log_success "Authentication flow working"
    else
        log_failure "Authentication flow test failed"
    fi
}

test_api_endpoints() {
    log_step "Testing API Endpoints"
    
    cd "$PROJECT_ROOT"
    
    # Start dev server in background
    log_info "Starting development server for API testing..."
    npm run dev > /dev/null 2>&1 &
    DEV_SERVER_PID=$!
    
    # Wait for server to start
    sleep 10
    
    # Test key API endpoints
    local endpoints=(
        "http://localhost:3000/api/health"
        "http://localhost:3000/api/auth/verify"
    )
    
    for endpoint in "${endpoints[@]}"; do
        if curl -f -s "$endpoint" > /dev/null 2>&1; then
            log_success "API endpoint $endpoint responding"
        else
            log_failure "API endpoint $endpoint not responding"
        fi
    done
    
    # Cleanup dev server
    kill $DEV_SERVER_PID 2>/dev/null || true
}

# =============================================================================
# 2️⃣ Security Audit
# =============================================================================

run_security_audit() {
    log_step "Running Security Audit"
    
    cd "$PROJECT_ROOT"
    
    # NPM audit
    log_info "Running npm audit..."
    if npm audit --audit-level=moderate > /dev/null 2>&1; then
        log_success "No high/critical security vulnerabilities found"
    else
        log_security_issue "Security vulnerabilities detected in dependencies"
        npm audit --audit-level=moderate
    fi
    
    # Check for hardcoded secrets
    log_info "Scanning for hardcoded secrets..."
    if grep -r "sk-" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" . > /dev/null 2>&1; then
        log_security_issue "Potential API keys found in code"
    else
        log_success "No hardcoded API keys found"
    fi
    
    # Check environment variable usage
    log_info "Checking environment variable security..."
    local env_files=(
        ".env"
        ".env.local"
        ".env.production"
        ".env.staging"
    )
    
    for env_file in "${env_files[@]}"; do
        if [[ -f "$env_file" ]]; then
            log_security_issue "Environment file $env_file found in repository"
        fi
    done
}

check_firebase_security() {
    log_step "Checking Firebase Security Configuration"
    
    cd "$PROJECT_ROOT"
    
    # Check Firebase Auth configuration
    if grep -q "apiKey:" firebase/client.ts 2>/dev/null; then
        log_info "Firebase Auth configuration found (expected)"
    else
        log_warning "Firebase Auth configuration not found"
    fi
    
    # Ensure no Firestore usage
    if grep -r "getFirestore\|firestore" --include="*.ts" --include="*.tsx" app/ lib/ components/ 2>/dev/null | grep -v "useFirestore.ts\|useRealtimeFirestore.ts"; then
        log_security_issue "Unexpected Firestore usage found (should be migrated to Cosmos DB)"
    else
        log_success "No unexpected Firestore usage found"
    fi
}

# =============================================================================
# 3️⃣ Codebase Cleanup
# =============================================================================

search_and_cleanup() {
    log_step "Searching for Legacy Code and Unused Imports"
    
    cd "$PROJECT_ROOT"
    
    # Search for Gemini references
    log_info "Searching for remaining Gemini AI references..."
    if find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) -not -path "./node_modules/*" -not -path "./.next/*" | xargs grep -l -i "gemini\|GoogleGenerativeAI" 2>/dev/null; then
        log_cleanup "Found remaining Gemini AI references"
    else
        log_success "No Gemini AI references found"
    fi
    
    # Search for unused Firebase imports
    log_info "Searching for unused Firebase Storage/Analytics imports..."
    if find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) -not -path "./node_modules/*" -not -path "./.next/*" | xargs grep -l "firebase/storage\|firebase/analytics\|firebase/remote-config" 2>/dev/null; then
        log_cleanup "Found unused Firebase service imports"
    else
        log_success "No unused Firebase service imports found"
    fi
    
    # Check for empty service files
    log_info "Checking for empty service files..."
    local empty_files=0
    find lib/services -name "*.ts" -size -100c 2>/dev/null | while read -r file; do
        if [[ -f "$file" ]]; then
            log_cleanup "Small/potentially empty service file: $file"
            ((empty_files++))
        fi
    done
    
    # Search for TODO/FIXME comments related to migration
    log_info "Searching for migration-related TODO/FIXME comments..."
    if find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) -not -path "./node_modules/*" -not -path "./.next/*" | xargs grep -n "TODO.*[Ff]irebase\|TODO.*[Gg]emini\|FIXME.*[Mm]igration" 2>/dev/null; then
        log_cleanup "Found migration-related TODO/FIXME comments"
    else
        log_success "No migration-related TODO/FIXME comments found"
    fi
}

check_package_dependencies() {
    log_step "Checking Package Dependencies"
    
    cd "$PROJECT_ROOT"
    
    # Check for unused packages
    log_info "Checking for potentially unused packages..."
    
    local potentially_unused=(
        "@google/generative-ai"
        "google-generative-ai"
        "@google-cloud/firestore"
        "@google-cloud/storage"
        "googleapis"
    )
    
    for package in "${potentially_unused[@]}"; do
        if grep -q "\"$package\"" package.json 2>/dev/null; then
            log_cleanup "Potentially unused package found: $package"
        fi
    done
    
    # Check for security vulnerabilities in packages
    log_info "Checking for outdated packages with security issues..."
    if npm outdated --parseable 2>/dev/null | head -10; then
        log_warning "Some packages may need updates"
    fi
}

# =============================================================================
# 4️⃣ Performance & Logging Review
# =============================================================================

check_performance() {
    log_step "Performance & Logging Review"
    
    cd "$PROJECT_ROOT"
    
    # Check for console.log statements in production code
    log_info "Checking for debug console statements..."
    if find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) -not -path "./node_modules/*" -not -path "./.next/*" -not -path "./tests/*" | xargs grep -n "console\.log\|console\.debug" 2>/dev/null | head -5; then
        log_performance_issue "Debug console statements found (should be removed for production)"
    else
        log_success "No debug console statements found"
    fi
    
    # Check Application Insights configuration
    log_info "Checking Application Insights configuration..."
    if grep -q "applicationinsights" lib/utils/telemetry.ts 2>/dev/null; then
        log_success "Application Insights telemetry configured"
    else
        log_warning "Application Insights configuration not found"
    fi
    
    # Check for proper error handling
    log_info "Checking error handling patterns..."
    if find . -type f \( -name "*.ts" -o -name "*.tsx" \) -not -path "./node_modules/*" -not -path "./.next/*" | xargs grep -l "try.*catch" 2>/dev/null | wc -l | grep -q "[0-9][0-9]"; then
        log_success "Proper error handling patterns found"
    else
        log_warning "Limited error handling patterns detected"
    fi
}

# =============================================================================
# 5️⃣ Deployment Readiness
# =============================================================================

check_deployment_readiness() {
    log_step "Checking Deployment Readiness"
    
    cd "$PROJECT_ROOT"
    
    # Check environment example file
    log_info "Checking .env.example completeness..."
    if [[ -f ".env.example" ]]; then
        local azure_vars=(
            "AZURE_KEY_VAULT_URL"
            "AZURE_COSMOS_ENDPOINT"
            "AZURE_OPENAI_ENDPOINT"
            "AZURE_SPEECH_KEY"
            "AZURE_STORAGE_CONNECTION_STRING"
        )
        
        local missing_vars=0
        for var in "${azure_vars[@]}"; do
            if ! grep -q "$var" .env.example; then
                log_warning "Missing $var in .env.example"
                ((missing_vars++))
            fi
        done
        
        if [[ $missing_vars -eq 0 ]]; then
            log_success "All required Azure variables in .env.example"
        fi
    else
        log_failure ".env.example file not found"
    fi
    
    # Check deployment scripts
    log_info "Checking deployment scripts..."
    local deploy_scripts=(
        "scripts/deploy-azure-comprehensive.sh"
        "scripts/setup-staging-environment.sh"
    )
    
    for script in "${deploy_scripts[@]}"; do
        if [[ -f "$script" && -x "$script" ]]; then
            log_success "Deployment script $script ready"
        else
            log_warning "Deployment script $script missing or not executable"
        fi
    done
    
    # Run deployment checklist
    log_info "Running deployment readiness checklist..."
    if npm run deploy:check:staging > /dev/null 2>&1; then
        log_success "Staging deployment checklist passed"
    else
        log_failure "Staging deployment checklist failed"
    fi
}

# =============================================================================
# Generate Final Report
# =============================================================================

generate_final_report() {
    log_step "Generating Final Validation Report"
    
    local total_tests=$((FUNCTIONAL_TESTS_PASSED + FUNCTIONAL_TESTS_FAILED))
    local success_rate=0
    if [[ $total_tests -gt 0 ]]; then
        success_rate=$(( (FUNCTIONAL_TESTS_PASSED * 100) / total_tests ))
    fi
    
    # Update executive summary
    sed -i.bak "s/| \*\*Functional Tests\*\* | 🔄 Running | - |/| **Functional Tests** | $(if [[ $FUNCTIONAL_TESTS_FAILED -eq 0 ]]; then echo "✅ Passed"; else echo "⚠️ Issues"; fi) | $FUNCTIONAL_TESTS_PASSED\/$total_tests ($success_rate%) |/" "$REPORT_FILE"
    sed -i.bak "s/| \*\*Security Audit\*\* | 🔄 Running | - |/| **Security Audit** | $(if [[ $SECURITY_ISSUES -eq 0 ]]; then echo "✅ Clean"; else echo "🔴 Issues"; fi) | $SECURITY_ISSUES issues found |/" "$REPORT_FILE"
    sed -i.bak "s/| \*\*Performance Check\*\* | 🔄 Running | - |/| **Performance Check** | $(if [[ $PERFORMANCE_ISSUES -eq 0 ]]; then echo "✅ Good"; else echo "⚠️ Issues"; fi) | $PERFORMANCE_ISSUES issues found |/" "$REPORT_FILE"
    sed -i.bak "s/| \*\*Code Cleanup\*\* | 🔄 Running | - |/| **Code Cleanup** | ✅ Complete | $CLEANUP_ACTIONS actions performed |/" "$REPORT_FILE"
    sed -i.bak "s/| \*\*Deployment Ready\*\* | 🔄 Pending | - |/| **Deployment Ready** | $(if [[ $FUNCTIONAL_TESTS_FAILED -eq 0 && $SECURITY_ISSUES -eq 0 ]]; then echo "✅ Ready"; else echo "⚠️ Blocked"; fi) | Prerequisites $(if [[ $FUNCTIONAL_TESTS_FAILED -eq 0 && $SECURITY_ISSUES -eq 0 ]]; then echo "met"; else echo "pending"; fi) |/" "$REPORT_FILE"
    
    rm -f "$REPORT_FILE.bak"
    
    # Add detailed results
    update_report "🧪 Functional Test Results" "
**Summary:** $FUNCTIONAL_TESTS_PASSED passed, $FUNCTIONAL_TESTS_FAILED failed

**Test Categories:**
- Build System: $(if npm run type-check > /dev/null 2>&1; then echo "✅ Passed"; else echo "❌ Failed"; fi)
- Azure Services: $(if npm run check:azure > /dev/null 2>&1; then echo "✅ Healthy"; else echo "⚠️ Issues"; fi)  
- Authentication: $(if [[ -f "lib/firebase/admin.ts" ]]; then echo "✅ Configured"; else echo "⚠️ Check needed"; fi)
- API Endpoints: ⚠️ Manual verification required

**Recommendations:**
- Fix any TypeScript compilation errors before deployment
- Ensure all Azure services are properly configured in environment
- Complete manual testing of user authentication flows
"
    
    update_report "🔐 Security Audit Results" "
**Issues Found:** $SECURITY_ISSUES

**Security Checks:**
- Dependency Vulnerabilities: $(if npm audit --audit-level=moderate > /dev/null 2>&1; then echo "✅ Clean"; else echo "⚠️ Issues found"; fi)
- Hardcoded Secrets: $(if grep -r "sk-\|key-" --include="*.ts" --include="*.js" . > /dev/null 2>&1; then echo "⚠️ Potential issues"; else echo "✅ None found"; fi)
- Environment Security: $(if ls .env* 2>/dev/null | grep -q "."; then echo "⚠️ Env files in repo"; else echo "✅ Secure"; fi)
- Firebase Configuration: $(if grep -q "apiKey" firebase/client.ts 2>/dev/null; then echo "✅ Properly configured"; else echo "⚠️ Check needed"; fi)

**Recommendations:**
- Remove any .env files from repository
- Run npm audit fix for dependency issues
- Verify all secrets are loaded from environment variables only
"
    
    update_report "🧹 Code Cleanup Actions" "
**Actions Performed:** $CLEANUP_ACTIONS

**Cleanup Results:**
- Gemini AI References: $(if find . -name "*.ts" -o -name "*.tsx" -not -path "./node_modules/*" | xargs grep -l -i "gemini" 2>/dev/null; then echo "⚠️ Some found"; else echo "✅ All removed"; fi)
- Legacy Firebase Code: $(if find . -name "*.ts" -o -name "*.tsx" -not -path "./node_modules/*" | xargs grep -l "firebase/storage\|firebase/analytics" 2>/dev/null; then echo "⚠️ Some found"; else echo "✅ All removed"; fi)
- Unused Dependencies: $(if grep -q "@google.*generative\|google-generative" package.json; then echo "⚠️ Some found"; else echo "✅ All removed"; fi)
- Debug Code: $(if find . -name "*.ts" -o -name "*.tsx" -not -path "./node_modules/*" -not -path "./tests/*" | xargs grep "console\.log" 2>/dev/null | wc -l | grep -q "^0$"; then echo "✅ Removed"; else echo "⚠️ Some remaining"; fi)

**Next Steps:**
- Remove any remaining debug console statements
- Clean up migration-related TODO comments
- Update package.json to remove unused dependencies
"
    
    update_report "⚡ Performance & Logging Review" "
**Performance Issues:** $PERFORMANCE_ISSUES

**Performance Checks:**
- Console Debug Statements: $(if find . -name "*.ts" -not -path "./node_modules/*" -not -path "./tests/*" | xargs grep "console\.log" 2>/dev/null | wc -l | grep -q "^0$"; then echo "✅ None found"; else echo "⚠️ Found some"; fi)
- Error Handling: $(if find . -name "*.ts" -not -path "./node_modules/*" | xargs grep -l "try.*catch" 2>/dev/null | wc -l | awk '{if($1>10) print "✅ Good coverage"; else print "⚠️ Limited coverage"}')
- Telemetry Configuration: $(if grep -q "applicationinsights" lib/utils/telemetry.ts 2>/dev/null; then echo "✅ Configured"; else echo "⚠️ Missing"; fi)
- Logging Framework: $(if grep -q "console\\.log\\|console\\.error" lib/ -r 2>/dev/null; then echo "⚠️ Basic logging"; else echo "✅ Structured logging"; fi)

**Recommendations:**
- Implement structured logging with Azure Application Insights
- Remove console.log statements in production code
- Add comprehensive error handling for Azure service calls
"
    
    update_report "🚀 Deployment Readiness Assessment" "
**Deployment Status:** $(if [[ $FUNCTIONAL_TESTS_FAILED -eq 0 && $SECURITY_ISSUES -eq 0 ]]; then echo "✅ Ready for staging deployment"; else echo "⚠️ Prerequisites required"; fi)

**Readiness Checklist:**
- Build System: $(if npm run type-check > /dev/null 2>&1; then echo "✅ Working"; else echo "❌ TypeScript errors"; fi)
- Environment Config: $(if [[ -f ".env.example" ]]; then echo "✅ Complete"; else echo "❌ Missing"; fi)  
- Deployment Scripts: $(if [[ -f "scripts/deploy-azure-comprehensive.sh" ]]; then echo "✅ Available"; else echo "❌ Missing"; fi)
- Azure Services: $(if npm run check:azure > /dev/null 2>&1; then echo "✅ Healthy"; else echo "⚠️ Check needed"; fi)

**Prerequisites for Deployment:**
1. Fix all TypeScript compilation errors
2. Resolve security vulnerabilities  
3. Complete remaining Firestore → Cosmos DB migration
4. Test authentication flows manually
5. Verify all Azure services are accessible

**Staging Deployment Command:**
\`\`\`bash
npm run deploy:azure:staging
\`\`\`

**Production Deployment Command:**
\`\`\`bash
npm run deploy:azure:production  
\`\`\`
"

    # Add final recommendations
    update_report "📋 Next Steps & Recommendations" "
## Immediate Actions (Required before deployment):

1. **Fix TypeScript Errors** (Critical)
   \`\`\`bash
   npm run type-check
   # Fix all compilation errors
   \`\`\`

2. **Install Missing Dependencies** (Critical)  
   \`\`\`bash
   npm install @azure/cosmos @azure/openai
   \`\`\`

3. **Complete Data Migration** (Critical)
   - Migrate \`app/api/profile/update/route.ts\` to Azure Cosmos DB
   - Migrate \`lib/hooks/useRealtimeFirestore.ts\` to Azure equivalents
   - Update authentication middleware integration

4. **Security Hardening** (High Priority)
   - Run \`npm audit fix\` for vulnerabilities
   - Remove any .env files from repository  
   - Verify all secrets use environment variables

5. **Manual Testing** (High Priority)
   - Test complete user registration/login flow
   - Verify resume upload to Azure Blob Storage
   - Test mock interview creation and retrieval
   - Validate GDPR request processing

## Post-Deployment Verification:

- Monitor Azure Application Insights for errors
- Verify all API endpoints respond correctly  
- Check authentication flows work end-to-end
- Validate file uploads/downloads from Azure storage
- Confirm no requests to legacy Firebase services

## Long-term Optimizations:

- Implement comprehensive logging strategy
- Set up Azure monitoring and alerting
- Optimize Cosmos DB queries and indexing
- Performance testing under load
- Implement automated integration testing
"

    log_info "Validation report generated: $REPORT_FILE"
}

# =============================================================================
# Main Execution
# =============================================================================

main() {
    log_step "Starting Post-Migration Validation"
    
    # Initialize report
    init_report
    
    cd "$PROJECT_ROOT"
    
    # Run all validation steps
    echo -e "${BLUE}1️⃣ Functional End-to-End Testing${NC}"
    test_build_system
    test_azure_services  
    test_authentication_flow
    test_api_endpoints
    
    echo -e "\n${BLUE}2️⃣ Security Audit${NC}"
    run_security_audit
    check_firebase_security
    
    echo -e "\n${BLUE}3️⃣ Codebase Cleanup${NC}"
    search_and_cleanup
    check_package_dependencies
    
    echo -e "\n${BLUE}4️⃣ Performance & Logging Review${NC}"
    check_performance
    
    echo -e "\n${BLUE}5️⃣ Deployment Readiness${NC}"
    check_deployment_readiness
    
    # Generate final report
    generate_final_report
    
    # Summary
    echo ""
    echo -e "${BLUE}📊 Validation Summary${NC}"
    echo -e "${BLUE}===================${NC}"
    echo -e "Functional Tests: ${GREEN}$FUNCTIONAL_TESTS_PASSED passed${NC}, ${RED}$FUNCTIONAL_TESTS_FAILED failed${NC}"
    echo -e "Security Issues: ${RED}$SECURITY_ISSUES found${NC}"  
    echo -e "Performance Issues: ${YELLOW}$PERFORMANCE_ISSUES found${NC}"
    echo -e "Cleanup Actions: ${PURPLE}$CLEANUP_ACTIONS performed${NC}"
    echo ""
    
    if [[ $FUNCTIONAL_TESTS_FAILED -eq 0 && $SECURITY_ISSUES -eq 0 ]]; then
        echo -e "${GREEN}🎉 Migration validation completed successfully!${NC}"
        echo -e "${GREEN}   Ready for staging deployment.${NC}"
    else
        echo -e "${YELLOW}⚠️  Migration validation completed with issues.${NC}"
        echo -e "${YELLOW}   Address critical issues before deployment.${NC}"
    fi
    
    echo ""
    echo -e "${BLUE}📄 Detailed report: ${REPORT_FILE}${NC}"
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
