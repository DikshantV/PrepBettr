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
  const expectedPattern = /^https:\/\/prepbettr-keyvault-\d+\.vault\.azure\.net\/$/;
  
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
