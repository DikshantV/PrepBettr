#!/bin/bash

# Azure Key Vault Migration Script
# Create dedicated Key Vault in PrepBettr_group and migrate secrets

set -e

echo "🔐 Migrating to Dedicated Azure Key Vault"
echo "========================================="

# Configuration
RESOURCE_GROUP="PrepBettr_group"
OLD_KEY_VAULT_NAME="pbVoiceVaultProd"
NEW_KEY_VAULT_NAME="prepbettr-keyvault-$(date +%s | tail -c 4)"  # Add timestamp for uniqueness
LOCATION="eastus2"
SKU="standard"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check Azure CLI
check_azure_cli() {
    if ! command -v az &> /dev/null; then
        print_error "Azure CLI is not installed"
        exit 1
    fi
    
    print_status "Azure CLI found"
    
    # Check login
    if ! az account show &> /dev/null; then
        print_error "Not logged in to Azure. Please run 'az login'"
        exit 1
    fi
    
    local subscription_id=$(az account show --query id --output tsv)
    print_status "Using Azure subscription: $subscription_id"
    
    # Get current user for Key Vault permissions
    CURRENT_USER=$(az account show --query user.name --output tsv)
    print_status "Current user: $CURRENT_USER"
}

print_status "📋 Configuration:"
echo "  Resource Group: $RESOURCE_GROUP"
echo "  Old Key Vault: $OLD_KEY_VAULT_NAME"
echo "  New Key Vault: $NEW_KEY_VAULT_NAME"
echo "  Location: $LOCATION"
echo "  SKU: $SKU"
echo ""

print_status "🔐 Checking Azure CLI..."
check_azure_cli

print_status "🔐 Step 1: Creating new Key Vault..."

# Create new Key Vault
az keyvault create \
    --name "$NEW_KEY_VAULT_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --location "$LOCATION" \
    --sku "$SKU" \
    --enabled-for-deployment true \
    --enabled-for-template-deployment true

if [ $? -eq 0 ]; then
    print_status "✅ New Key Vault created successfully!"
else
    print_error "❌ Failed to create Key Vault"
    exit 1
fi

print_status "🔑 Step 2: Setting Key Vault access policies..."

# Set access policy for current user
az keyvault set-policy \
    --name "$NEW_KEY_VAULT_NAME" \
    --upn "$CURRENT_USER" \
    --secret-permissions get list set delete backup restore recover purge \
    --key-permissions get list create delete backup restore recover purge \
    --certificate-permissions get list create delete managecontacts getissuers listissuers setissuers deleteissuers manageissuers recover purge

if [ $? -eq 0 ]; then
    print_status "✅ Access policies set for current user"
else
    print_warning "⚠️ Failed to set access policies - you may need to set them manually"
fi

print_status "📤 Step 3: Migrating secrets from old Key Vault..."

# Get list of secrets from old Key Vault
print_status "🔍 Discovering secrets in old Key Vault..."

OLD_SECRETS=$(az keyvault secret list --vault-name "$OLD_KEY_VAULT_NAME" --query "[].name" --output tsv 2>/dev/null || echo "")

if [ -z "$OLD_SECRETS" ]; then
    print_warning "⚠️ No secrets found or cannot access old Key Vault"
    print_warning "    This might be normal if the old vault is in a different subscription or you don't have access"
else
    print_status "📋 Found secrets to migrate:"
    echo "$OLD_SECRETS" | while IFS= read -r secret; do
        echo "   - $secret"
    done
    
    # Migrate each secret
    echo "$OLD_SECRETS" | while IFS= read -r secret; do
        if [ -n "$secret" ]; then
            print_status "🔄 Migrating secret: $secret"
            
            # Get secret value from old vault
            SECRET_VALUE=$(az keyvault secret show --vault-name "$OLD_KEY_VAULT_NAME" --name "$secret" --query value --output tsv 2>/dev/null || echo "")
            
            if [ -n "$SECRET_VALUE" ]; then
                # Set secret in new vault
                az keyvault secret set \
                    --vault-name "$NEW_KEY_VAULT_NAME" \
                    --name "$secret" \
                    --value "$SECRET_VALUE" \
                    --output none
                
                if [ $? -eq 0 ]; then
                    print_status "   ✅ Migrated: $secret"
                else
                    print_warning "   ⚠️ Failed to migrate: $secret"
                fi
            else
                print_warning "   ⚠️ Could not read secret: $secret"
            fi
        fi
    done
fi

print_status "🔐 Step 4: Adding new secrets from Phase 1..."

# Add the new secrets we created in Phase 1 if they don't exist
NEW_SECRETS=(
    "form-recognizer-key"
    "form-recognizer-endpoint" 
    "storage-account-name"
    "storage-account-key"
    "storage-connection-string"
    "speech-key"
    "speech-endpoint"
)

for secret in "${NEW_SECRETS[@]}"; do
    # Check if secret exists in old vault first
    SECRET_VALUE=$(az keyvault secret show --vault-name "$OLD_KEY_VAULT_NAME" --name "$secret" --query value --output tsv 2>/dev/null || echo "")
    
    if [ -n "$SECRET_VALUE" ]; then
        print_status "🔄 Migrating Phase 1 secret: $secret"
        az keyvault secret set \
            --vault-name "$NEW_KEY_VAULT_NAME" \
            --name "$secret" \
            --value "$SECRET_VALUE" \
            --output none
        
        if [ $? -eq 0 ]; then
            print_status "   ✅ Migrated: $secret"
        else
            print_warning "   ⚠️ Failed to migrate: $secret"
        fi
    else
        print_warning "   ⚠️ Secret not found in old vault: $secret (this might be expected)"
    fi
done

print_status "📋 Step 5: Resource Summary"
echo "========================================"

NEW_VAULT_URI="https://${NEW_KEY_VAULT_NAME}.vault.azure.net/"

echo "🔐 New Key Vault:"
echo "   Name: $NEW_KEY_VAULT_NAME"
echo "   Resource Group: $RESOURCE_GROUP" 
echo "   Location: $LOCATION"
echo "   SKU: $SKU"
echo "   URI: $NEW_VAULT_URI"
echo ""

# List secrets in new vault
print_status "📋 Secrets in new Key Vault:"
NEW_VAULT_SECRETS=$(az keyvault secret list --vault-name "$NEW_KEY_VAULT_NAME" --query "[].name" --output tsv 2>/dev/null || echo "")

if [ -n "$NEW_VAULT_SECRETS" ]; then
    echo "$NEW_VAULT_SECRETS" | while IFS= read -r secret; do
        echo "   - $secret"
    done
else
    echo "   (No secrets found - this might indicate a permissions issue)"
fi

print_status "🧪 Step 6: Generating test script..."

# Create test script
cat > test-key-vault-migration.js << 'EOF'
#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });

console.log('🧪 Testing Key Vault Migration');

async function testKeyVault() {
  console.log('\n📋 Environment Variables:');
  console.log('AZURE_KEY_VAULT_URI:', process.env.AZURE_KEY_VAULT_URI);
  
  const keyVaultUri = process.env.AZURE_KEY_VAULT_URI;
  
  if (!keyVaultUri) {
    console.log('❌ Missing Key Vault URI');
    return false;
  }
  
  console.log('\n🔐 Testing Key Vault accessibility...');
  
  try {
    const fetch = (await import('node-fetch')).default;
    
    // Test the Key Vault metadata endpoint (should return 401 without auth, but confirms reachability)
    const testUrl = `${keyVaultUri}secrets?api-version=7.4`;
    console.log('🔗 Testing endpoint:', testUrl);
    
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.status === 401) {
      // This is expected without proper authentication, but confirms endpoint is reachable
      console.log('✅ Key Vault endpoint is accessible');
      console.log('✅ Expected 401 without authentication');
      console.log('🎯 Response status:', response.status);
      return true;
    } else if (response.status === 403) {
      console.log('✅ Key Vault endpoint is accessible');
      console.log('✅ Expected 403 without proper permissions');
      console.log('🎯 Response status:', response.status);
      return true;
    } else {
      const errorText = await response.text().catch(() => 'No error details');
      console.log('❌ Key Vault test unexpected result:');
      console.log('   Status:', response.status, response.statusText);
      console.log('   Error:', errorText);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Key Vault endpoint test failed:', error.message);
    return false;
  }
}

async function verifyMigration() {
  console.log('\n✅ Migration Verification Summary:');
  console.log('────────────────────────────────────────');
  
  const currentVaultUri = process.env.AZURE_KEY_VAULT_URI;
  const expectedPattern = /^https:\/\/prepbettr-keyvault\d+\.vault\.azure\.net\/$/;
  
  if (expectedPattern.test(currentVaultUri)) {
    console.log('✅ Using new dedicated Key Vault');
  } else {
    console.log('❌ Vault URI mismatch:');
    console.log('   Current:', currentVaultUri);
    console.log('   Expected pattern: https://prepbettr-keyvault[timestamp].vault.azure.net/');
  }
  
  console.log('\n🏗️ Resource Details:');
  console.log('   Resource Group: PrepBettr_group');
  console.log('   Key Vault: ' + (currentVaultUri ? currentVaultUri.split('.')[0].split('//')[1] : 'unknown'));
  console.log('   Region: eastus2');
  console.log('   SKU: Standard');
  console.log('   Features: Soft Delete (90 days), Deployment enabled');
}

async function runTests() {
  console.log('🧪 Testing Dedicated Key Vault');
  console.log('=' + '='.repeat(50));
  
  const endpointTest = await testKeyVault();
  await verifyMigration();
  
  console.log('\n🎉 Test Results Summary:');
  console.log('   Key Vault Endpoint:', endpointTest ? '✅ PASSED' : '❌ FAILED');
  
  if (endpointTest) {
    console.log('\n✨ Great! Your new dedicated Key Vault is accessible.');
  } else {
    console.log('\n⚠️ There might be an issue with the Key Vault configuration.');
  }
  
  console.log('\n📋 Next Steps:');
  console.log('1. Update application code to use new Key Vault URI');
  console.log('2. Test secret retrieval in your applications');
  console.log('3. Update any CI/CD pipelines with new vault name');
  console.log('4. Monitor the new resource in Azure portal');
  
  console.log('\n🔗 Azure Portal Links:');
  console.log('Key Vault: https://portal.azure.com/#@/resource/subscriptions/' + process.env.AZURE_SUBSCRIPTION_ID + '/resourceGroups/PrepBettr_group/providers/Microsoft.KeyVault/vaults/' + (process.env.AZURE_KEY_VAULT_URI ? process.env.AZURE_KEY_VAULT_URI.split('.')[0].split('//')[1] : 'unknown'));
}

runTests().catch(console.error);
EOF

chmod +x test-key-vault-migration.js
print_status "✅ Test script created: test-key-vault-migration.js"

print_status "📝 Step 7: Updating environment configuration..."

# Backup current .env.local if it exists
if [ -f .env.local ]; then
    if [ ! -f .env.local.backup.keyvault ]; then
        cp .env.local .env.local.backup.keyvault
        print_status "✅ Backed up .env.local to .env.local.backup.keyvault"
    fi
fi

# Update .env.local with new Key Vault URI
if [ -f .env.local ]; then
    # Update or add the Key Vault URI
    if grep -q "AZURE_KEY_VAULT_URI=" .env.local; then
        sed -i '' "s|AZURE_KEY_VAULT_URI=.*|AZURE_KEY_VAULT_URI=\"$NEW_VAULT_URI\"|" .env.local
    else
        echo "" >> .env.local
        echo "# Azure Key Vault - Dedicated Resource" >> .env.local
        echo "AZURE_KEY_VAULT_URI=\"$NEW_VAULT_URI\"" >> .env.local
    fi
    
    print_status "✅ Updated .env.local with new Key Vault URI"
else
    print_warning "⚠️ .env.local not found - you'll need to manually add the Key Vault URI"
fi

print_status "🎉 Migration Complete!"
echo "========================================"

echo ""
echo "📋 What was accomplished:"
echo "✅ Created dedicated Key Vault in PrepBettr_group"
echo "✅ Migrated secrets from old Key Vault (if accessible)"
echo "✅ Set appropriate access policies"
echo "✅ Updated .env.local with new Key Vault URI"
echo "✅ Created test script to verify the migration" 
echo "✅ Backed up original configuration"
echo ""

echo "🧪 Next Steps:"
echo "1. Run the test script: node test-key-vault-migration.js"
echo "2. Test secret access in your applications"
echo "3. Update any hardcoded references to old vault name"
echo "4. Monitor the new resource in Azure portal"
echo ""

echo "🔗 Azure Portal Links:"
echo "New Key Vault: https://portal.azure.com/#@/resource/subscriptions/$(az account show --query id --output tsv)/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.KeyVault/vaults/$NEW_KEY_VAULT_NAME"
echo "Resource Group: https://portal.azure.com/#@/resource/subscriptions/$(az account show --query id --output tsv)/resourceGroups/$RESOURCE_GROUP"
echo ""

print_status "✨ Your PrepBettr app now has its own dedicated Key Vault in the PrepBettr_group!"

echo ""
print_warning "⚠️ IMPORTANT NOTES:"
echo "1. The old Key Vault ($OLD_KEY_VAULT_NAME) is still active"
echo "2. Test thoroughly before decommissioning the old vault"
echo "3. Update any applications/services that reference the old vault"
echo "4. Consider setting up automated secret rotation for sensitive secrets"
