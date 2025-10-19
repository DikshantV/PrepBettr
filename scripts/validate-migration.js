#!/usr/bin/env node

/**
 * Data Migration Validation Script
 * Validates that data migration infrastructure is working correctly
 */

const { CosmosClient } = require('@azure/cosmos');
const admin = require('firebase-admin');
const path = require('path');

// Configuration
const COSMOS_ENDPOINT = process.env.COSMOS_ENDPOINT || 'https://localhost:8081';
const COSMOS_KEY = process.env.COSMOS_KEY || 'C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==';
const DATABASE_ID = process.env.DATABASE_ID || 'PrepBettrValidationDB';
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'prepbettr-test';

class MigrationValidator {
  constructor() {
    this.cosmosClient = new CosmosClient({
      endpoint: COSMOS_ENDPOINT,
      key: COSMOS_KEY,
      connectionPolicy: {
        enableEndpointDiscovery: false
      }
    });

    this.results = {
      cosmosConnection: false,
      firestoreConnection: false,
      containerCreation: false,
      documentOperations: false,
      migrationInfrastructure: false,
      overallStatus: false
    };
  }

  async validateCosmosConnection() {
    try {
      console.log('🔍 Testing Cosmos DB connection...');
      
      // Test connection by getting database account
      await this.cosmosClient.getDatabaseAccount();
      
      // Try to create/get test database
      const { database } = await this.cosmosClient.databases.createIfNotExists({
        id: DATABASE_ID
      });
      
      console.log('✅ Cosmos DB connection successful');
      this.results.cosmosConnection = true;
      return database;
    } catch (error) {
      console.error('❌ Cosmos DB connection failed:', error.message);
      this.results.cosmosConnection = false;
      throw error;
    }
  }

  async validateFirestoreConnection() {
    try {
      console.log('🔍 Testing Firestore connection...');
      
      // Initialize Firebase Admin if not already done
      if (!admin.apps.length) {
        admin.initializeApp({
          projectId: FIREBASE_PROJECT_ID,
          credential: admin.credential.applicationDefault()
        });
      }

      // Test Firestore connection
      const firestore = admin.firestore();
      await firestore.collection('validation-test').add({
        timestamp: new Date().toISOString(),
        test: 'connection-validation'
      });

      // Clean up test document
      const snapshot = await firestore.collection('validation-test').get();
      const batch = firestore.batch();
      snapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();

      console.log('✅ Firestore connection successful');
      this.results.firestoreConnection = true;
    } catch (error) {
      console.error('❌ Firestore connection failed:', error.message);
      this.results.firestoreConnection = false;
      throw error;
    }
  }

  async validateContainerCreation(database) {
    try {
      console.log('🔍 Testing container creation...');
      
      const containers = [
        { id: 'validation-resumes', partitionKey: '/userId' },
        { id: 'validation-usage', partitionKey: '/userId' },
        { id: 'validation-migrationState', partitionKey: '/id' }
      ];

      for (const containerConfig of containers) {
        const { container } = await database.containers.createIfNotExists(containerConfig);
        console.log(`✅ Container '${containerConfig.id}' created/verified`);
      }

      this.results.containerCreation = true;
    } catch (error) {
      console.error('❌ Container creation failed:', error.message);
      this.results.containerCreation = false;
      throw error;
    }
  }

  async validateDocumentOperations(database) {
    try {
      console.log('🔍 Testing document operations...');
      
      const container = database.container('validation-resumes');
      
      // Test document creation
      const testDoc = {
        id: 'validation-test-doc',
        userId: 'validation-user',
        fileName: 'validation-test.pdf',
        uploadDate: new Date().toISOString(),
        atsScore: 85
      };

      const { resource: createdDoc } = await container.items.create(testDoc);
      console.log('✅ Document creation successful');

      // Test document read
      const { resource: readDoc } = await container.item(testDoc.id, testDoc.userId).read();
      if (readDoc && readDoc.fileName === testDoc.fileName) {
        console.log('✅ Document read successful');
      } else {
        throw new Error('Document read returned incorrect data');
      }

      // Test document update
      const updatedDoc = { ...readDoc, atsScore: 90 };
      const { resource: updated } = await container.item(testDoc.id, testDoc.userId).replace(updatedDoc);
      if (updated.atsScore === 90) {
        console.log('✅ Document update successful');
      } else {
        throw new Error('Document update failed');
      }

      // Test document deletion
      await container.item(testDoc.id, testDoc.userId).delete();
      console.log('✅ Document deletion successful');

      this.results.documentOperations = true;
    } catch (error) {
      console.error('❌ Document operations failed:', error.message);
      this.results.documentOperations = false;
      throw error;
    }
  }

  async validateMigrationInfrastructure(database) {
    try {
      console.log('🔍 Testing migration infrastructure...');
      
      // Test migration state tracking
      const migrationStateContainer = database.container('validation-migrationState');
      const migrationState = {
        id: 'validation-migration-1',
        status: 'testing',
        startTime: new Date().toISOString(),
        documentsProcessed: 0,
        totalDocuments: 0,
        errors: []
      };

      await migrationStateContainer.items.create(migrationState);
      console.log('✅ Migration state tracking working');

      // Test batch operations (simulate migration batch)
      const resumeContainer = database.container('validation-resumes');
      const batchDocs = Array.from({ length: 5 }, (_, i) => ({
        id: `batch-doc-${i}`,
        userId: 'batch-user',
        fileName: `batch-resume-${i}.pdf`,
        uploadDate: new Date().toISOString(),
        atsScore: 70 + i
      }));

      // Simulate batch insertion
      for (const doc of batchDocs) {
        await resumeContainer.items.create(doc);
      }
      console.log('✅ Batch operations working');

      // Test query operations (migration would need these)
      const { resources: queryResults } = await resumeContainer.items
        .query('SELECT * FROM c WHERE c.userId = "batch-user"')
        .fetchAll();

      if (queryResults.length === 5) {
        console.log('✅ Query operations working');
      } else {
        throw new Error(`Expected 5 documents, got ${queryResults.length}`);
      }

      // Cleanup
      for (const doc of batchDocs) {
        await resumeContainer.item(doc.id, doc.userId).delete();
      }
      await migrationStateContainer.item(migrationState.id, migrationState.id).delete();

      this.results.migrationInfrastructure = true;
    } catch (error) {
      console.error('❌ Migration infrastructure validation failed:', error.message);
      this.results.migrationInfrastructure = false;
      throw error;
    }
  }

  async cleanup() {
    try {
      console.log('🧹 Cleaning up validation resources...');
      await this.cosmosClient.database(DATABASE_ID).delete();
      console.log('✅ Cleanup completed');
    } catch (error) {
      console.warn('⚠️ Cleanup warning:', error.message);
    }
  }

  printResults() {
    console.log('\n📊 Migration Validation Results:');
    console.log('=====================================');
    
    Object.entries(this.results).forEach(([test, passed]) => {
      const emoji = passed ? '✅' : '❌';
      const status = passed ? 'PASSED' : 'FAILED';
      console.log(`${emoji} ${test.padEnd(25)} ${status}`);
    });

    this.results.overallStatus = Object.entries(this.results)
      .filter(([key]) => key !== 'overallStatus')
      .every(([, value]) => value);

    console.log('=====================================');
    const overallEmoji = this.results.overallStatus ? '🎉' : '💥';
    const overallStatus = this.results.overallStatus ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED';
    console.log(`${overallEmoji} Overall Status: ${overallStatus}`);

    return this.results.overallStatus;
  }

  async run() {
    console.log('🚀 Starting Migration Infrastructure Validation\n');
    
    let database;
    try {
      // Run all validation tests
      database = await this.validateCosmosConnection();
      await this.validateFirestoreConnection();
      await this.validateContainerCreation(database);
      await this.validateDocumentOperations(database);
      await this.validateMigrationInfrastructure(database);

    } catch (error) {
      console.error('\n💥 Validation failed with error:', error.message);
    } finally {
      // Always cleanup
      await this.cleanup();
      
      // Print results and exit with appropriate code
      const success = this.printResults();
      process.exit(success ? 0 : 1);
    }
  }
}

// Run validation if this script is executed directly
if (require.main === module) {
  const validator = new MigrationValidator();
  validator.run().catch(error => {
    console.error('💥 Validation script crashed:', error);
    process.exit(1);
  });
}

module.exports = MigrationValidator;