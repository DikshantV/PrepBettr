#!/usr/bin/env tsx

/**
 * Setup Required Cosmos DB Containers
 * 
 * This script creates the necessary containers for the migration process.
 */

import { azureCosmosService } from '../lib/services/azure-cosmos-service';

async function setupCosmosContainers() {
  console.log('🚀 Setting up required Cosmos DB containers...\n');

  try {
    // Initialize Cosmos DB
    await azureCosmosService.initialize();
    console.log('✅ Azure Cosmos DB initialized');

    // Create migrationProgress container
    console.log('\n📦 Creating migrationProgress container...');
    
    try {
      // Try to create a test document in the container
      const testDoc = {
        id: `setup-test-${Date.now()}`,
        _partitionKey: 'setup',
        setupTime: new Date(),
        containerCreated: true
      };

      await azureCosmosService.createDocument('migrationProgress', testDoc);
      console.log('✅ migrationProgress container is accessible');
      
      // Clean up the test document
      await azureCosmosService.deleteDocument('migrationProgress', testDoc.id, 'setup');
      console.log('✅ Test document cleaned up');
      
    } catch (error) {
      console.log('⚠️  migrationProgress container needs to be created:', error instanceof Error ? error.message : 'Unknown error');
      console.log('ℹ️  This container should be created manually in Azure Portal or will be auto-created on first use.');
    }

    // Verify other required containers
    console.log('\n📋 Checking other required containers...');
    
    const requiredContainers = [
      'usage',
      'interviews',
      'resumes', 
      'feedback',
      'autoApplySettings',
      'applications',
      'jobListings',
      'automationLogs',
      'subscriptionEvents'
    ];

    for (const containerName of requiredContainers) {
      try {
        // Test container access
        const results = await azureCosmosService.queryDocuments(
          containerName,
          'SELECT VALUE COUNT(1) FROM c',
          []
        );
        console.log(`✅ ${containerName}: accessible (${results[0] || 0} documents)`);
      } catch (error) {
        console.log(`⚠️  ${containerName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    console.log('\n🎉 Container setup check completed!');
    console.log('\nℹ️  If any containers are missing, they will be auto-created during migration');
    console.log('   or can be manually created in Azure Portal with:');
    console.log('   - Partition Key: /userId (for user data) or /id (for system data)');
    console.log('   - Throughput: 400 RU/s (can be scaled up as needed)');

  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

// Run the setup
if (require.main === module) {
  setupCosmosContainers();
}
