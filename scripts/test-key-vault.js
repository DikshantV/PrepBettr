#!/usr/bin/env node

const { DefaultAzureCredential } = require('@azure/identity');
const { SecretClient } = require('@azure/keyvault-secrets');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const AZURE_KEY_VAULT_URI = process.env.AZURE_KEY_VAULT_URI || 'https://pbVoiceVaultProd.vault.azure.net/';

async function testKeyVault() {
  console.log('\n🔐 Testing Azure Key Vault Connection');
  console.log('======================================\n');
  console.log(`Key Vault URI: ${AZURE_KEY_VAULT_URI}\n`);

  try {
    // Create Key Vault client
    const credential = new DefaultAzureCredential();
    const client = new SecretClient(AZURE_KEY_VAULT_URI, credential);

    // List of expected secrets based on azure-config.ts
    const expectedSecrets = [
      'speech-key',
      'speech-endpoint',
      'azure-openai-key',
      'azure-openai-endpoint',
      'azure-openai-deployment',
      'azure-openai-gpt35-deployment',
      'azure-openai-gpt4o-deployment',
      'azure-storage-account-name',
      'azure-storage-account-key',
      'azure-form-recognizer-endpoint',
      'azure-form-recognizer-key'
    ];

    console.log('📋 Checking Expected Secrets:');
    console.log('------------------------------\n');

    const secretStatus = [];
    
    for (const secretName of expectedSecrets) {
      try {
        const secret = await client.getSecret(secretName);
        const hasValue = secret.value && secret.value.length > 0;
        const status = hasValue ? '✅' : '⚠️';
        const valueInfo = hasValue 
          ? `[${secret.value.length} chars]` 
          : '[Empty]';
        
        console.log(`${status} ${secretName}: ${valueInfo}`);
        
        secretStatus.push({
          name: secretName,
          exists: true,
          hasValue: hasValue,
          length: secret.value ? secret.value.length : 0
        });
      } catch (error) {
        console.log(`❌ ${secretName}: Not found or access denied`);
        secretStatus.push({
          name: secretName,
          exists: false,
          hasValue: false,
          error: error.message
        });
      }
    }

    // Summary
    console.log('\n📊 Summary:');
    console.log('-----------');
    const foundSecrets = secretStatus.filter(s => s.exists);
    const withValues = secretStatus.filter(s => s.hasValue);
    const missing = secretStatus.filter(s => !s.exists);
    
    console.log(`Total expected secrets: ${expectedSecrets.length}`);
    console.log(`Secrets found: ${foundSecrets.length}`);
    console.log(`Secrets with values: ${withValues.length}`);
    console.log(`Secrets missing/inaccessible: ${missing.length}`);
    
    if (missing.length > 0) {
      console.log('\n⚠️ Missing/Inaccessible Secrets:');
      missing.forEach(s => {
        console.log(`  - ${s.name}`);
        if (s.error) {
          console.log(`    Error: ${s.error}`);
        }
      });
    }

    // Check if we can list all secrets (requires list permission)
    console.log('\n🔍 Attempting to list all secrets in Key Vault:');
    console.log('------------------------------------------------');
    
    try {
      const allSecrets = [];
      for await (const secretProperties of client.listPropertiesOfSecrets()) {
        allSecrets.push(secretProperties.name);
      }
      
      if (allSecrets.length > 0) {
        console.log(`Found ${allSecrets.length} total secrets in Key Vault:`);
        allSecrets.forEach(name => {
          const isExpected = expectedSecrets.includes(name);
          const icon = isExpected ? '✅' : '📝';
          console.log(`  ${icon} ${name}${!isExpected ? ' (not in expected list)' : ''}`);
        });
        
        // Check for unexpected secrets
        const unexpected = allSecrets.filter(s => !expectedSecrets.includes(s));
        if (unexpected.length > 0) {
          console.log('\n📝 Additional secrets in Key Vault (not used by app):');
          unexpected.forEach(s => console.log(`  - ${s}`));
        }
      } else {
        console.log('No secrets found or list permission not granted.');
      }
    } catch (error) {
      console.log('❌ Cannot list secrets - permission denied or error occurred');
      console.log(`   Error: ${error.message}`);
    }

    // Test fallback to environment variables
    console.log('\n🔄 Testing Fallback to Environment Variables:');
    console.log('----------------------------------------------');
    
    const envMapping = {
      'AZURE_OPENAI_API_KEY': process.env.AZURE_OPENAI_API_KEY,
      'AZURE_OPENAI_ENDPOINT': process.env.AZURE_OPENAI_ENDPOINT,
      'AZURE_OPENAI_DEPLOYMENT': process.env.AZURE_OPENAI_DEPLOYMENT,
      'SPEECH_KEY': process.env.SPEECH_KEY,
      'AZURE_SPEECH_KEY': process.env.AZURE_SPEECH_KEY,
      'SPEECH_ENDPOINT': process.env.SPEECH_ENDPOINT,
      'AZURE_SPEECH_REGION': process.env.AZURE_SPEECH_REGION
    };
    
    for (const [key, value] of Object.entries(envMapping)) {
      const status = value ? '✅' : '❌';
      const info = value ? `[${value.length} chars]` : 'Not set';
      console.log(`${status} ${key}: ${info}`);
    }

  } catch (error) {
    console.error('\n❌ Failed to connect to Azure Key Vault:');
    console.error(`   ${error.message}`);
    
    if (error.message.includes('DefaultAzureCredential')) {
      console.log('\n💡 Authentication Tips:');
      console.log('  1. Make sure you are logged in to Azure CLI: az login');
      console.log('  2. Or set up service principal credentials');
      console.log('  3. Or use managed identity in Azure environment');
    }
    
    console.log('\n🔄 The application will fall back to environment variables');
  }
}

// Run the test
testKeyVault().catch(console.error);
