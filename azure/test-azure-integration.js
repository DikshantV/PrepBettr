#!/usr/bin/env node

/**
 * Azure Integration Test
 * 
 * This script tests Azure Key Vault and App Configuration connectivity
 * for local development and debugging.
 */

const { fetchAzureSecrets, getAzureConfig, initializeAzureEnvironment } = require('./lib/azure-config.ts');
const { getAppConfigService } = require('./lib/azure-app-config.ts');

async function testAzureIntegration() {
  console.log('🧪 Testing Azure Integration');
  console.log('=' .repeat(50));
  console.log();

  // Test 1: Key Vault Secrets
  console.log('1️⃣ Testing Azure Key Vault connectivity...');
  try {
    const secrets = await fetchAzureSecrets();
    console.log('✅ Key Vault secrets fetched successfully');
    console.log('   Available secrets:', Object.keys(secrets).join(', '));
    
    // Validate required secrets
    const required = ['speechKey', 'azureOpenAIKey', 'azureOpenAIEndpoint'];
    const missing = required.filter(key => !secrets[key]);
    
    if (missing.length > 0) {
      console.log('⚠️  Missing required secrets:', missing.join(', '));
    } else {
      console.log('✅ All required secrets are present');
    }
  } catch (error) {
    console.log('❌ Key Vault test failed:', error.message);
  }
  
  console.log();

  // Test 2: Environment Initialization
  console.log('2️⃣ Testing environment initialization...');
  try {
    await initializeAzureEnvironment();
    const config = getAzureConfig();
    console.log('✅ Environment initialized successfully');
    console.log('   Environment status:', 
      Object.entries(config.environment)
        .map(([key, value]) => `${key}: ${value ? '✅' : '❌'}`)
        .join(', ')
    );
  } catch (error) {
    console.log('❌ Environment initialization failed:', error.message);
  }

  console.log();

  // Test 3: App Configuration
  console.log('3️⃣ Testing Azure App Configuration...');
  try {
    const appConfigService = getAppConfigService();
    const config = await appConfigService.fetchConfiguration();
    
    if (config) {
      console.log('✅ App Configuration connected successfully');
      console.log(`   Loaded ${Object.keys(config.values).length} config values`);
      console.log(`   Loaded ${Object.keys(config.featureFlags).length} feature flags`);
    } else {
      console.log('⚠️  App Configuration not available (using fallback)');
    }
  } catch (error) {
    console.log('❌ App Configuration test failed:', error.message);
  }

  console.log();

  // Test 4: OpenAI Integration Test
  console.log('4️⃣ Testing OpenAI integration...');
  try {
    const secrets = await fetchAzureSecrets();
    if (secrets.azureOpenAIKey && secrets.azureOpenAIEndpoint) {
      console.log('✅ OpenAI credentials available');
      console.log(`   Endpoint: ${secrets.azureOpenAIEndpoint}`);
      console.log(`   Deployment: ${secrets.azureOpenAIDeployment}`);
    } else {
      console.log('❌ OpenAI credentials missing');
    }
  } catch (error) {
    console.log('❌ OpenAI test failed:', error.message);
  }

  console.log();
  console.log('🏁 Azure integration test completed');
}

// Run the test
if (require.main === module) {
  testAzureIntegration().catch(console.error);
}

module.exports = { testAzureIntegration };
