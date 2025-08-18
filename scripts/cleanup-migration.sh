#!/bin/bash

# =============================================================================
# Migration Cleanup Script - Remove Firebase/Gemini Dependencies
# =============================================================================
# This script removes unused imports, deprecated services, and outdated references
# from the PrepBettr codebase after Azure migration
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

echo -e "${BLUE}🧹 PrepBettr Migration Cleanup Script${NC}"
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

# =============================================================================
# Cleanup Functions
# =============================================================================

cleanup_gemini_references() {
    log_step "Removing Gemini AI references..."
    
    # List of files containing Gemini references to clean up
    local files_to_clean=(
        "components/AutoApplyDashboard.tsx"
        "lib/services/azure-openai-service.ts" 
        "types/resume-tailoring.ts"
        "scripts/test-azure-openai-integration.ts"
    )
    
    for file in "${files_to_clean[@]}"; do
        local file_path="$PROJECT_ROOT/$file"
        if [[ -f "$file_path" ]]; then
            log_info "Cleaning Gemini references from $file"
            
            # Remove Gemini-specific comments and references
            sed -i.bak 's/Gemini API/Azure OpenAI/g' "$file_path"
            sed -i.bak 's/Gemini/Azure OpenAI/g' "$file_path"
            sed -i.bak 's/GoogleGenerativeAI/AzureOpenAI/g' "$file_path"
            sed -i.bak '/google-generative/d' "$file_path"
            sed -i.bak '/@google\/generative-ai/d' "$file_path"
            
            # Remove backup files
            rm -f "${file_path}.bak"
            
            log_info "✅ Cleaned $file"
        else
            log_warning "$file not found, skipping"
        fi
    done
}

remove_unused_firestore_imports() {
    log_step "Removing unused Firestore imports and dependencies..."
    
    cd "$PROJECT_ROOT"
    
    # Find files with Firestore imports that should be migrated
    local firestore_files=(
        "app/api/profile/update/route.ts"
        "app/api/notifications/preferences/route.ts"
        "lib/hooks/useRealtimeFirestore.ts"
        "lib/hooks/useFirestore.ts"
        "lib/hooks/useCommunityInterview.ts"
    )
    
    for file in "${firestore_files[@]}"; do
        if [[ -f "$file" ]]; then
            log_warning "⚠️ $file still contains Firestore dependencies"
            log_warning "   This file needs manual migration to Azure Cosmos DB"
            echo "   File: $file" >> migration-todos.md
        fi
    done
    
    # Remove unused Firebase Storage references
    find . -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | \
    grep -v node_modules | \
    xargs grep -l "firebase/storage" | \
    while read -r file; do
        log_info "Removing Firebase Storage imports from $file"
        sed -i.bak '/firebase\/storage/d' "$file"
        sed -i.bak '/getStorage/d' "$file"
        rm -f "${file}.bak"
    done
}

update_package_json() {
    log_step "Cleaning up package.json dependencies..."
    
    cd "$PROJECT_ROOT"
    
    # Create a backup
    cp package.json package.json.backup
    
    # Note: We're keeping firebase and firebase-admin for authentication
    # But removing unused Google AI packages if they exist
    
    # Remove Google AI packages if present
    if grep -q "@google/generative-ai" package.json; then
        log_info "Removing @google/generative-ai from package.json"
        npm uninstall @google/generative-ai || true
    fi
    
    # Check for other unused packages
    local potentially_unused=(
        "google-auth-library"
        "@google-cloud/firestore"
        "@google-cloud/storage"
        "googleapis"
    )
    
    for package in "${potentially_unused[@]}"; do
        if grep -q "\"$package\"" package.json; then
            log_warning "Found potentially unused package: $package"
            echo "Review and remove if unused: $package" >> migration-todos.md
        fi
    done
    
    log_info "✅ Package.json cleanup completed"
}

clean_build_artifacts() {
    log_step "Cleaning build artifacts and cache..."
    
    cd "$PROJECT_ROOT"
    
    # Remove Next.js build artifacts
    rm -rf .next
    
    # Remove node_modules cache
    rm -rf node_modules/.cache
    
    # Remove Jest cache
    rm -rf node_modules/.cache/jest
    
    # Remove TypeScript cache
    rm -rf node_modules/.cache/typescript
    
    # Remove other caches
    rm -rf coverage
    
    log_info "✅ Build artifacts cleaned"
}

check_unused_imports() {
    log_step "Scanning for unused imports..."
    
    cd "$PROJECT_ROOT"
    
    # Create unused imports report
    echo "# Unused Imports Report - $(date)" > unused-imports-report.md
    echo "" >> unused-imports-report.md
    
    # Check for common unused imports
    local common_unused=(
        "firebase/firestore"
        "firebase/storage"
        "google-generative-ai"
        "@google/generative-ai"
    )
    
    for import_pattern in "${common_unused[@]}"; do
        log_info "Checking for unused import: $import_pattern"
        
        find . -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | \
        grep -v node_modules | \
        xargs grep -l "$import_pattern" | \
        while read -r file; do
            echo "- Found in: $file" >> unused-imports-report.md
            log_warning "  Found in: $file"
        done
    done
    
    log_info "✅ Unused imports scan completed"
}

update_environment_scripts() {
    log_step "Updating environment setup scripts..."
    
    # Update dev script to remove Firebase environment variables
    local package_json="$PROJECT_ROOT/package.json"
    
    if [[ -f "$package_json" ]]; then
        # Update dev/build/start scripts to remove Firebase emulator variables
        sed -i.bak "s/FIRESTORE_EMULATOR_HOST=''//g" "$package_json"
        sed -i.bak "s/GOOGLE_APPLICATION_CREDENTIALS=''//g" "$package_json"
        
        # Clean up extra spaces
        sed -i.bak 's/  / /g' "$package_json"
        
        rm -f "${package_json}.bak"
        
        log_info "✅ Updated package.json scripts"
    fi
}

remove_deprecated_files() {
    log_step "Removing deprecated service files..."
    
    cd "$PROJECT_ROOT"
    
    # List of files that should be removed if they exist
    local deprecated_files=(
        "lib/services/gemini-service.ts"
        "lib/services/google-ai-service.ts"
        "lib/services/firestore-service.ts"
        "lib/adapters/gemini-adapter.ts"
        "lib/adapters/google-ai-adapter.ts"
    )
    
    for file in "${deprecated_files[@]}"; do
        if [[ -f "$file" ]]; then
            log_warning "Found deprecated file: $file"
            
            # Move to deprecated folder instead of deleting
            mkdir -p deprecated-services
            mv "$file" "deprecated-services/"
            log_info "Moved $file to deprecated-services/"
        fi
    done
}

generate_migration_todos() {
    log_step "Generating migration TODOs..."
    
    cd "$PROJECT_ROOT"
    
    cat > migration-todos.md << EOF
# Migration TODOs - $(date)

## Manual Verification Required

### High Priority
- [ ] Update Firestore-dependent API routes to use Azure Cosmos DB
- [ ] Migrate real-time hooks from Firestore to Azure Cosmos DB
- [ ] Update authentication flows to work with Azure backend
- [ ] Test all user registration/login flows
- [ ] Verify resume upload functionality with Azure Blob Storage

### Medium Priority  
- [ ] Review and remove unused package dependencies
- [ ] Update environment variable documentation
- [ ] Test all Azure service integrations
- [ ] Update API error handling for Azure services
- [ ] Verify CORS configuration for Azure Functions

### Low Priority
- [ ] Clean up any remaining Gemini AI references in comments
- [ ] Update README with new Azure architecture
- [ ] Review and optimize Azure resource usage
- [ ] Update deployment documentation

### Files Requiring Manual Migration

#### API Routes (Firestore → Cosmos DB)
EOF

    # Add files that still contain Firestore
    find . -name "*.ts" -o -name "*.tsx" | \
    grep -v node_modules | \
    xargs grep -l "firebase/firestore" | \
    while read -r file; do
        echo "- \`$file\` - Contains Firestore dependencies" >> migration-todos.md
    done
    
    cat >> migration-todos.md << EOF

#### Hooks (Real-time Firestore → Cosmos DB)
- \`lib/hooks/useRealtimeFirestore.ts\` - Real-time Firestore hooks
- \`lib/hooks/useFirestore.ts\` - Static Firestore queries  
- \`lib/hooks/useCommunityInterview.ts\` - Community features

#### Components (Data Layer Updates)
EOF
    
    # Add components that might need updates
    find components -name "*.tsx" | \
    xargs grep -l "firebase" | \
    while read -r file; do
        echo "- \`$file\` - May need data layer updates" >> migration-todos.md
    done
    
    cat >> migration-todos.md << EOF

## Testing Checklist

### Unit Tests
- [ ] All existing unit tests pass
- [ ] Azure service unit tests pass  
- [ ] Authentication unit tests pass

### Integration Tests
- [ ] API route integration tests pass
- [ ] Azure Functions integration tests pass
- [ ] End-to-end authentication flow tests pass

### Manual Testing
- [ ] User registration works
- [ ] User login works
- [ ] Profile updates work
- [ ] Resume upload works
- [ ] Mock interviews work
- [ ] Voice features work
- [ ] Payment processing works

## Notes
- Generated by migration cleanup script
- Review each item before marking as complete
- Test thoroughly in staging before production deployment

EOF

    log_info "✅ Migration TODOs generated: migration-todos.md"
}

run_type_check() {
    log_step "Running TypeScript type checking..."
    
    cd "$PROJECT_ROOT"
    
    if npm run type-check; then
        log_info "✅ TypeScript compilation successful"
    else
        log_error "❌ TypeScript compilation failed"
        log_warning "Check the errors above and fix before deployment"
        echo "## TypeScript Errors" >> migration-todos.md
        echo "- Fix TypeScript compilation errors before deployment" >> migration-todos.md
        return 1
    fi
}

# =============================================================================
# Main Execution
# =============================================================================

main() {
    log_step "Starting migration cleanup"
    
    # Ensure we're in the project root
    if [[ ! -f "$PROJECT_ROOT/package.json" ]]; then
        log_error "Not in a valid Next.js project directory"
        exit 1
    fi
    
    # Create backup
    log_info "Creating backup..."
    timestamp=$(date +"%Y%m%d_%H%M%S")
    mkdir -p "backups/cleanup_$timestamp"
    cp -r "package.json" "backups/cleanup_$timestamp/" 2>/dev/null || true
    
    # Run cleanup steps
    cleanup_gemini_references
    remove_unused_firestore_imports  
    update_package_json
    update_environment_scripts
    remove_deprecated_files
    check_unused_imports
    clean_build_artifacts
    generate_migration_todos
    
    # Run checks
    if run_type_check; then
        echo ""
        log_info "🎉 Migration cleanup completed successfully!"
        echo ""
        log_info "📋 Next steps:"
        log_info "1. Review migration-todos.md for manual tasks"
        log_info "2. Run npm install to update dependencies"
        log_info "3. Test the application in development"
        log_info "4. Run the test suites"
        log_info "5. Deploy to staging for validation"
        
    else
        echo ""
        log_warning "⚠️ Migration cleanup completed with warnings"
        log_warning "Please address TypeScript errors before deployment"
    fi
    
    log_info "📄 Reports generated:"
    log_info "- migration-todos.md - Manual tasks to complete"
    log_info "- unused-imports-report.md - Import cleanup status"
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
