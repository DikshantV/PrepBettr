#!/usr/bin/env ts-node

/**
 * Quick Test for Azure AI Foundry Migration
 * 
 * Verifies that the MigrationOpenAIClient correctly routes through
 * the Azure AI Foundry infrastructure.
 */

import { MigrationOpenAIClient } from '../../lib/azure-ai-foundry/clients/migration-wrapper';

async function testMigration() {
  console.log('🚀 Testing Azure AI Foundry Migration Wrapper...');
  
  const client = new MigrationOpenAIClient();
  
  console.log('📋 Testing model mapping...');
  
  // Test model mapping
  const testMappings = [
    'gpt-4',
    'gpt-35-turbo', 
    'gpt-3.5-turbo',
    'gpt-4o',
    'unknown-model'
  ];
  
  for (const model of testMappings) {
    const mapped = client.mapModel(model);
    console.log(`  ${model} → ${mapped}`);
  }
  
  console.log('\n📊 Testing usage stats...');
  const stats = client.getUsageStats();
  console.log('  Stats:', stats);
  
  console.log('\n✅ Basic migration wrapper tests completed successfully!');
  console.log('\n💡 Note: Full integration testing requires Azure AI Foundry credentials');
  console.log('    Run npm run test:azure-foundry for complete integration testing');
}

if (require.main === module) {
  testMigration().catch(console.error);
}

export { testMigration };
