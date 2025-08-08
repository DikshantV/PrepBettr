#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';

interface EnvComparison {
  variable: string;
  inEnvFile: boolean;
  envValue?: string;
  inKeyVault: boolean;
  keyVaultSecret?: string;
  status: 'match' | 'mismatch' | 'missing_env' | 'missing_kv' | 'not_applicable';
  notes?: string;
}

// Read .env.local file
function readEnvFile(): Map<string, string> {
  const envPath = path.join(process.cwd(), '.env.local');
  const envVars = new Map<string, string>();
  
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key) {
          const value = valueParts.join('=').replace(/^["']|["']$/g, '');
          envVars.set(key, value);
        }
      }
    }
  }
  
  return envVars;
}

// Define Key Vault mapping
const keyVaultMapping = new Map<string, string | null>([
  // Speech Service
  ['SPEECH_KEY', 'speech-key'],
  ['AZURE_SPEECH_KEY', 'speech-key'],
  ['SPEECH_ENDPOINT', 'speech-endpoint'],
  ['AZURE_SPEECH_REGION', 'speech-region'],
  
  // Azure OpenAI
  ['AZURE_OPENAI_API_KEY', 'azure-openai-key'],
  ['AZURE_OPENAI_ENDPOINT', 'azure-openai-endpoint'],
  ['AZURE_OPENAI_DEPLOYMENT', 'azure-openai-deployment'],
  ['AZURE_OPENAI_GPT35_DEPLOYMENT', 'azure-openai-gpt35-deployment'],
  ['AZURE_OPENAI_GPT4O_DEPLOYMENT', 'azure-openai-gpt4o-deployment'],
  
  // Azure Storage
  ['AZURE_STORAGE_ACCOUNT_NAME', 'azure-storage-account-name'],
  ['AZURE_STORAGE_ACCOUNT_KEY', 'azure-storage-account-key'],
  
  // Azure Form Recognizer
  ['AZURE_FORM_RECOGNIZER_ENDPOINT', 'azure-form-recognizer-endpoint'],
  ['AZURE_FORM_RECOGNIZER_KEY', 'azure-form-recognizer-key'],
  
  // Firebase (typically not in Key Vault)
  ['FIREBASE_PROJECT_ID', null],
  ['FIREBASE_PRIVATE_KEY', null],
  ['FIREBASE_CLIENT_EMAIL', null],
  ['NEXT_PUBLIC_FIREBASE_CLIENT_KEY', null],
  ['NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET', null],
  
  // AWS (typically not in Key Vault)
  ['AWS_SES_REGION', null],
  ['AWS_ACCESS_KEY_ID', null],
  ['AWS_SECRET_ACCESS_KEY', null],
  ['AWS_SES_FROM_EMAIL', null],
  
  // DODO Payments (typically not in Key Vault)
  ['DODO_SECRET_KEY', null],
  ['DODO_WEBHOOK_SECRET', null],
  
  // MJML (typically not in Key Vault)
  ['MJML_API_ENDPOINT', null],
  ['MJML_APPLICATION_ID', null],
  ['MJML_PUBLIC_KEY', null],
  ['MJML_SECRET_KEY', null],
  
  // Azure Key Vault URI
  ['AZURE_KEY_VAULT_URI', null],
  
  // Azure Function Key (typically not in Key Vault)
  ['AZURE_FUNCTION_KEY', null],
]);

// Required environment variables
const requiredEnvVars = [
  'AZURE_OPENAI_API_KEY',
  'AZURE_OPENAI_ENDPOINT',
  'AZURE_OPENAI_DEPLOYMENT',
  'SPEECH_KEY',
  'SPEECH_ENDPOINT',
  'AZURE_SPEECH_KEY',
  'AZURE_SPEECH_REGION',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_CLIENT_EMAIL',
  'NEXT_PUBLIC_FIREBASE_CLIENT_KEY',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'AWS_SES_REGION',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_SES_FROM_EMAIL',
  'AZURE_KEY_VAULT_URI',
];

function compareEnvironments(): void {
  console.log('\n🔍 Environment Variables Comparison Report');
  console.log('==========================================\n');
  
  const envVars = readEnvFile();
  const comparisons: EnvComparison[] = [];
  
  // Check all required variables
  for (const varName of requiredEnvVars) {
    const envValue = envVars.get(varName);
    const kvSecret = keyVaultMapping.get(varName);
    
    let status: EnvComparison['status'] = 'not_applicable';
    let notes: string | undefined;
    
    if (kvSecret) {
      // This should be in Key Vault
      if (envValue) {
        status = 'match'; // Assuming match if both exist
        notes = `Maps to Key Vault secret: ${kvSecret}`;
      } else {
        status = 'missing_env';
        notes = `Missing in .env.local but should map to Key Vault secret: ${kvSecret}`;
      }
    } else {
      // This should only be in .env.local
      if (envValue) {
        status = 'match';
        notes = 'Local environment variable only (not in Key Vault)';
      } else {
        status = 'missing_env';
        notes = 'Missing in .env.local';
      }
    }
    
    comparisons.push({
      variable: varName,
      inEnvFile: !!envValue,
      envValue: envValue ? '✅ Set' : '❌ Not set',
      inKeyVault: !!kvSecret,
      keyVaultSecret: kvSecret || 'N/A',
      status,
      notes
    });
  }
  
  // Summary Statistics
  const stats = {
    total: comparisons.length,
    inEnvFile: comparisons.filter(c => c.inEnvFile).length,
    inKeyVault: comparisons.filter(c => c.inKeyVault).length,
    missingEnv: comparisons.filter(c => c.status === 'missing_env').length,
    missingKv: comparisons.filter(c => c.status === 'missing_kv').length,
  };
  
  // Print detailed comparison
  console.log('📊 Variable-by-Variable Comparison:');
  console.log('------------------------------------\n');
  
  for (const comparison of comparisons) {
    const statusIcon = comparison.status === 'match' ? '✅' : 
                       comparison.status === 'missing_env' ? '⚠️' : 
                       comparison.status === 'missing_kv' ? '🔧' : '📝';
    
    console.log(`${statusIcon} ${comparison.variable}`);
    console.log(`   .env.local: ${comparison.envValue}`);
    console.log(`   Key Vault: ${comparison.keyVaultSecret}`);
    if (comparison.notes) {
      console.log(`   Note: ${comparison.notes}`);
    }
    console.log('');
  }
  
  // Print Azure Key Vault secrets that are expected
  console.log('\n🔑 Azure Key Vault Secrets Required:');
  console.log('-------------------------------------');
  const uniqueSecrets = new Set(Array.from(keyVaultMapping.values()).filter(v => v !== null));
  for (const secret of uniqueSecrets) {
    const mappedVars = Array.from(keyVaultMapping.entries())
      .filter(([, v]) => v === secret)
      .map(([k]) => k);
    console.log(`  ${secret}:`);
    console.log(`    Maps to: ${mappedVars.join(', ')}`);
  }
  
  // Print summary
  console.log('\n📈 Summary:');
  console.log('-----------');
  console.log(`Total variables checked: ${stats.total}`);
  console.log(`Variables in .env.local: ${stats.inEnvFile}/${stats.total}`);
  console.log(`Variables expected in Key Vault: ${stats.inKeyVault}/${stats.total}`);
  console.log(`Missing from .env.local: ${stats.missingEnv}`);
  
  // Check actual .env.local values for Azure services
  console.log('\n🔐 Azure Service Configuration Check:');
  console.log('-------------------------------------');
  
  const azureChecks = [
    {
      name: 'Azure OpenAI',
      vars: ['AZURE_OPENAI_API_KEY', 'AZURE_OPENAI_ENDPOINT', 'AZURE_OPENAI_DEPLOYMENT'],
      status: true
    },
    {
      name: 'Azure Speech',
      vars: ['SPEECH_KEY', 'SPEECH_ENDPOINT', 'AZURE_SPEECH_KEY', 'AZURE_SPEECH_REGION'],
      status: true
    },
    {
      name: 'Azure Key Vault',
      vars: ['AZURE_KEY_VAULT_URI'],
      status: true
    }
  ];
  
  for (const check of azureChecks) {
    const allPresent = check.vars.every(v => envVars.has(v));
    const icon = allPresent ? '✅' : '❌';
    console.log(`${icon} ${check.name}: ${allPresent ? 'Configured' : 'Missing variables'}`);
    if (!allPresent) {
      const missing = check.vars.filter(v => !envVars.has(v));
      console.log(`   Missing: ${missing.join(', ')}`);
    }
  }
  
  // Recommendations
  console.log('\n💡 Recommendations:');
  console.log('-------------------');
  
  if (stats.missingEnv > 0) {
    console.log('⚠️  Some required environment variables are missing from .env.local');
    console.log('   Run: npm run deploy:check to see detailed deployment readiness');
  }
  
  const hasKeyVault = envVars.has('AZURE_KEY_VAULT_URI');
  if (hasKeyVault) {
    console.log('✅ Azure Key Vault URI is configured');
    console.log('   The application will attempt to fetch secrets from Key Vault');
    console.log('   Fallback to .env.local values if Key Vault access fails');
  } else {
    console.log('⚠️  Azure Key Vault URI is not configured');
    console.log('   The application will use .env.local values only');
  }
  
  // Export report to JSON
  const report = {
    timestamp: new Date().toISOString(),
    comparisons,
    statistics: stats,
    azureServices: azureChecks.map(c => ({
      service: c.name,
      configured: c.vars.every(v => envVars.has(v)),
      variables: c.vars.map(v => ({
        name: v,
        present: envVars.has(v)
      }))
    }))
  };
  
  fs.writeFileSync('env-comparison-report.json', JSON.stringify(report, null, 2));
  console.log('\n📄 Full report saved to: env-comparison-report.json');
}

// Run the comparison
compareEnvironments();
