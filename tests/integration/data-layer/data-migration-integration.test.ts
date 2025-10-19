// Integration Tests for Data Migration System
// Uses Cosmos DB Emulator for realistic testing

import { CosmosClient } from '@azure/cosmos';
import { DataMigrationManager } from '@/lib/data-layer/migration/DataMigrationManager';
import { CosmosResumeRepository } from '@/lib/data-layer/cosmos/CosmosResumeRepository';
import { CosmosUsageRepository } from '@/lib/data-layer/cosmos/CosmosUsageRepository';
import { FirestoreResumeRepository } from '@/lib/data-layer/firestore/FirestoreResumeRepository';
import { DualWriteRepositoryDecorator } from '@/lib/data-layer/dual-write-decorator';
import { IResumeDocument, IUsageDocument } from '@/lib/data-layer/interfaces/IDocuments';
import admin from 'firebase-admin';

// Cosmos DB Emulator configuration
const COSMOS_EMULATOR_ENDPOINT = 'https://localhost:8081';
const COSMOS_EMULATOR_KEY = 'C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==';
const TEST_DATABASE_ID = 'PrepBettrTestDB';

// Firebase Test Project configuration
const TEST_FIREBASE_PROJECT_ID = 'prepbettr-test';

describe('Data Migration Integration Tests', () => {
  let cosmosClient: CosmosClient;
  let resumeRepository: CosmosResumeRepository;
  let usageRepository: CosmosUsageRepository;
  let firestoreResumeRepo: FirestoreResumeRepository;
  let migrationManager: DataMigrationManager;
  let testResumeDocuments: IResumeDocument[];
  let testUsageDocuments: IUsageDocument[];

  beforeAll(async () => {
    // Initialize Cosmos DB Emulator
    cosmosClient = new CosmosClient({
      endpoint: COSMOS_EMULATOR_ENDPOINT,
      key: COSMOS_EMULATOR_KEY,
      connectionPolicy: {
        enableEndpointDiscovery: false
      }
    });

    // Initialize Firebase Admin (test project)
    if (!admin.apps.length) {
      admin.initializeApp({
        projectId: TEST_FIREBASE_PROJECT_ID,
        credential: admin.credential.applicationDefault()
      });
    }

    // Create test database and containers
    const { database } = await cosmosClient.databases.createIfNotExists({
      id: TEST_DATABASE_ID
    });

    await database.containers.createIfNotExists({
      id: 'resumes',
      partitionKey: '/userId'
    });

    await database.containers.createIfNotExists({
      id: 'usage',
      partitionKey: '/userId'
    });

    await database.containers.createIfNotExists({
      id: 'migrationState',
      partitionKey: '/id'
    });

    // Initialize repositories
    resumeRepository = new CosmosResumeRepository(cosmosClient, TEST_DATABASE_ID);
    usageRepository = new CosmosUsageRepository(cosmosClient, TEST_DATABASE_ID);
    firestoreResumeRepo = new FirestoreResumeRepository();

    // Initialize migration manager
    migrationManager = new DataMigrationManager({
      cosmosClient,
      databaseId: TEST_DATABASE_ID,
      batchSize: 5,
      concurrency: 2,
      retryAttempts: 2,
      retryDelayMs: 1000,
      healthCheckIntervalMs: 5000,
      progressReportingIntervalMs: 2000
    });

    // Generate test data
    testResumeDocuments = Array.from({ length: 20 }, (_, i) =>
      testUtils.generateMockResumeDocument({
        id: `resume-${i}`,
        userId: `user-${i % 5}`, // 5 different users
        fileName: `resume-${i}.pdf`,
        atsScore: 70 + (i % 30) // Varied ATS scores
      })
    );

    testUsageDocuments = Array.from({ length: 15 }, (_, i) =>
      testUtils.generateMockUsageDocument({
        id: `usage-${i}`,
        userId: `user-${i % 5}`,
        feature: i % 3 === 0 ? 'interview' : 'resume_processing',
        count: Math.floor(Math.random() * 10) + 1
      })
    );
  }, 30000);

  afterAll(async () => {
    // Cleanup: Delete test database
    try {
      await cosmosClient.database(TEST_DATABASE_ID).delete();
    } catch (error) {
      console.warn('Failed to cleanup test database:', error);
    }

    // Cleanup Firestore test data
    try {
      const batch = admin.firestore().batch();
      const resumeSnapshots = await admin.firestore().collection('resumes').get();
      resumeSnapshots.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    } catch (error) {
      console.warn('Failed to cleanup Firestore test data:', error);
    }
  }, 30000);

  beforeEach(async () => {
    // Clear containers before each test
    await clearCosmosContainer('resumes');
    await clearCosmosContainer('usage');
    await clearCosmosContainer('migrationState');
  });

  async function clearCosmosContainer(containerId: string) {
    const container = cosmosClient.database(TEST_DATABASE_ID).container(containerId);
    const { resources: items } = await container.items.readAll().fetchAll();
    
    for (const item of items) {
      await container.item(item.id, item.id).delete();
    }
  }

  describe('Full Migration Flow', () => {
    it('should migrate resume documents from Firestore to Cosmos DB', async () => {
      // Arrange: Populate Firestore with test data
      const firestore = admin.firestore();
      const batch = firestore.batch();
      
      for (const resume of testResumeDocuments.slice(0, 10)) {
        const docRef = firestore.collection('resumes').doc(resume.id);
        batch.set(docRef, resume);
      }
      await batch.commit();

      // Act: Start migration
      const migrationId = await migrationManager.startMigration({
        direction: 'firestore-to-cosmos',
        collections: ['resumes'],
        validateData: true,
        preserveOriginalData: true
      });

      // Wait for migration to complete
      let status = await migrationManager.getMigrationStatus(migrationId);
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds timeout

      while (status.status !== 'completed' && status.status !== 'failed' && attempts < maxAttempts) {
        await testUtils.delay(1000);
        status = await migrationManager.getMigrationStatus(migrationId);
        attempts++;
      }

      // Assert: Verify migration completed successfully
      expect(status.status).toBe('completed');
      expect(status.documentsProcessed).toBe(10);
      expect(status.errors).toHaveLength(0);

      // Verify data exists in Cosmos DB
      const cosmosResumes = await resumeRepository.findMany({}, { limit: 20 });
      expect(cosmosResumes.success).toBe(true);
      expect(cosmosResumes.data).toHaveLength(10);

      // Verify data integrity
      const migratedResume = cosmosResumes.data![0];
      const originalResume = testResumeDocuments.find(r => r.id === migratedResume.id);
      expect(migratedResume.fileName).toBe(originalResume?.fileName);
      expect(migratedResume.atsScore).toBe(originalResume?.atsScore);
    }, 60000);

    it('should handle migration errors and retry mechanism', async () => {
      // Arrange: Create invalid data that will cause migration errors
      const firestore = admin.firestore();
      
      // Add valid documents
      const validResumes = testResumeDocuments.slice(0, 3);
      const validBatch = firestore.batch();
      for (const resume of validResumes) {
        const docRef = firestore.collection('resumes').doc(resume.id);
        validBatch.set(docRef, resume);
      }
      await validBatch.commit();

      // Add invalid documents (missing required fields)
      const invalidBatch = firestore.batch();
      for (let i = 0; i < 2; i++) {
        const docRef = firestore.collection('resumes').doc(`invalid-${i}`);
        invalidBatch.set(docRef, { 
          id: `invalid-${i}`,
          // Missing userId - required field
          fileName: `invalid-${i}.pdf`
        });
      }
      await invalidBatch.commit();

      // Act: Start migration
      const migrationId = await migrationManager.startMigration({
        direction: 'firestore-to-cosmos',
        collections: ['resumes'],
        validateData: true,
        continueOnError: true
      });

      // Wait for migration to complete
      let status = await migrationManager.getMigrationStatus(migrationId);
      let attempts = 0;
      while (status.status === 'running' && attempts < 30) {
        await testUtils.delay(1000);
        status = await migrationManager.getMigrationStatus(migrationId);
        attempts++;
      }

      // Assert: Migration should complete despite errors
      expect(['completed', 'completed_with_errors']).toContain(status.status);
      expect(status.documentsProcessed).toBe(3); // Only valid documents
      expect(status.errors.length).toBeGreaterThan(0); // Should have errors for invalid docs

      // Verify only valid data was migrated
      const cosmosResumes = await resumeRepository.findMany({}, { limit: 10 });
      expect(cosmosResumes.success).toBe(true);
      expect(cosmosResumes.data).toHaveLength(3);
    }, 45000);

    it('should support rollback functionality', async () => {
      // Arrange: Populate both Firestore and Cosmos DB
      const firestore = admin.firestore();
      const batch = firestore.batch();
      
      const sourceData = testResumeDocuments.slice(0, 5);
      for (const resume of sourceData) {
        const docRef = firestore.collection('resumes').doc(resume.id);
        batch.set(docRef, resume);
      }
      await batch.commit();

      // Also add some existing data to Cosmos DB
      const existingData = testResumeDocuments.slice(10, 12);
      for (const resume of existingData) {
        await resumeRepository.create(resume);
      }

      // Act: Perform migration
      const migrationId = await migrationManager.startMigration({
        direction: 'firestore-to-cosmos',
        collections: ['resumes'],
        createBackup: true
      });

      // Wait for completion
      let status = await migrationManager.getMigrationStatus(migrationId);
      while (status.status === 'running') {
        await testUtils.delay(1000);
        status = await migrationManager.getMigrationStatus(migrationId);
      }

      expect(status.status).toBe('completed');

      // Verify migration worked
      let cosmosResumes = await resumeRepository.findMany({}, { limit: 20 });
      expect(cosmosResumes.data).toHaveLength(7); // 5 migrated + 2 existing

      // Act: Rollback migration
      await migrationManager.rollbackMigration(migrationId);

      // Assert: Data should be restored to pre-migration state
      cosmosResumes = await resumeRepository.findMany({}, { limit: 20 });
      expect(cosmosResumes.data).toHaveLength(2); // Only original existing data
    }, 45000);
  });

  describe('Dual-Write Integration', () => {
    it('should maintain consistency during dual-write operations', async () => {
      // Arrange: Set up dual-write repository
      const dualWriteRepo = new DualWriteRepositoryDecorator(
        resumeRepository,
        firestoreResumeRepo,
        {
          enableDualWrite: true,
          readFallbackEnabled: true,
          writeConsistencyCheck: true,
          syncDelayMs: 100
        }
      );

      const testResume = testResumeDocuments[0];

      // Act: Create document through dual-write
      const createResult = await dualWriteRepo.create(testResume);

      // Assert: Document created successfully
      expect(createResult.success).toBe(true);
      expect(createResult.data).toMatchObject(testResume);

      // Wait for consistency check to complete
      await testUtils.delay(500);

      // Verify document exists in both stores
      const cosmosResult = await resumeRepository.findById(testResume.id);
      const firestoreResult = await firestoreResumeRepo.findById(testResume.id);

      expect(cosmosResult.success).toBe(true);
      expect(cosmosResult.data).toMatchObject(testResume);
      expect(firestoreResult.success).toBe(true);
      expect(firestoreResult.data).toMatchObject(testResume);

      // Verify consistency
      expect(cosmosResult.data?.fileName).toBe(firestoreResult.data?.fileName);
      expect(cosmosResult.data?.atsScore).toBe(firestoreResult.data?.atsScore);
    }, 30000);

    it('should handle partial failures gracefully', async () => {
      // Arrange: Set up dual-write with mocked secondary failure
      const mockFirestoreRepo = {
        create: jest.fn().mockRejectedValue(new Error('Firestore unavailable')),
        findById: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
        exists: jest.fn()
      };

      const dualWriteRepo = new DualWriteRepositoryDecorator(
        resumeRepository,
        mockFirestoreRepo as any,
        {
          enableDualWrite: true,
          maxRetries: 1
        }
      );

      const testResume = testResumeDocuments[1];

      // Act: Attempt creation
      const createResult = await dualWriteRepo.create(testResume);

      // Assert: Primary write should succeed despite secondary failure
      expect(createResult.success).toBe(true);
      expect(createResult.data).toMatchObject(testResume);

      // Verify document exists in primary store
      const cosmosResult = await resumeRepository.findById(testResume.id);
      expect(cosmosResult.success).toBe(true);
      expect(cosmosResult.data).toMatchObject(testResume);

      // Verify retry attempts were made
      expect(mockFirestoreRepo.create).toHaveBeenCalledTimes(2); // Initial + 1 retry
    });

    it('should support fallback reads correctly', async () => {
      // Arrange: Create document only in secondary store (simulating migration state)
      const testResume = testResumeDocuments[2];
      await firestoreResumeRepo.create(testResume);

      const dualWriteRepo = new DualWriteRepositoryDecorator(
        resumeRepository, // Primary (empty)
        firestoreResumeRepo, // Secondary (has data)
        {
          readFallbackEnabled: true
        }
      );

      // Act: Attempt to read
      const readResult = await dualWriteRepo.findById(testResume.id);

      // Assert: Should fallback to secondary and find the document
      expect(readResult.success).toBe(true);
      expect(readResult.data).toMatchObject(testResume);

      // Verify metrics
      const metrics = dualWriteRepo.getMetrics();
      expect(metrics.fallbackReads).toBe(1);
      expect(metrics.readMisses).toBe(1);
    });
  });

  describe('Performance and Stress Testing', () => {
    it('should handle large batch migrations efficiently', async () => {
      // Arrange: Create large dataset in Firestore
      const firestore = admin.firestore();
      const largeDataset = Array.from({ length: 100 }, (_, i) =>
        testUtils.generateMockResumeDocument({
          id: `bulk-resume-${i}`,
          userId: `user-${i % 10}`,
          fileName: `bulk-resume-${i}.pdf`
        })
      );

      // Batch write to Firestore
      const batches: any[] = [];
      for (let i = 0; i < largeDataset.length; i += 500) {
        const batch = firestore.batch();
        const chunk = largeDataset.slice(i, i + 500);
        
        chunk.forEach(resume => {
          const docRef = firestore.collection('resumes').doc(resume.id);
          batch.set(docRef, resume);
        });
        
        batches.push(batch);
      }

      await Promise.all(batches.map(batch => batch.commit()));

      const startTime = Date.now();

      // Act: Perform migration with optimized settings
      const migrationId = await migrationManager.startMigration({
        direction: 'firestore-to-cosmos',
        collections: ['resumes'],
        batchSize: 20,
        concurrency: 5,
        validateData: false // Skip validation for performance
      });

      // Wait for completion
      let status = await migrationManager.getMigrationStatus(migrationId);
      while (status.status === 'running') {
        await testUtils.delay(2000);
        status = await migrationManager.getMigrationStatus(migrationId);
        
        // Log progress
        console.log(`Migration progress: ${status.documentsProcessed}/${status.totalDocuments} (${status.progressPercentage}%)`);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Assert: Migration completed within reasonable time
      expect(status.status).toBe('completed');
      expect(status.documentsProcessed).toBe(100);
      expect(duration).toBeLessThan(60000); // Should complete within 60 seconds

      // Verify data integrity with sampling
      const cosmosResumes = await resumeRepository.findMany({}, { limit: 110 });
      expect(cosmosResumes.success).toBe(true);
      expect(cosmosResumes.data).toHaveLength(100);

      // Sample check - verify first and last documents
      const firstDoc = cosmosResumes.data!.find(d => d.id === 'bulk-resume-0');
      const lastDoc = cosmosResumes.data!.find(d => d.id === 'bulk-resume-99');
      expect(firstDoc).toBeDefined();
      expect(lastDoc).toBeDefined();

      console.log(`Large batch migration completed in ${duration}ms`);
    }, 120000); // 2 minute timeout
  });

  describe('Error Recovery and Monitoring', () => {
    it('should provide detailed progress reporting', async () => {
      // Arrange: Set up data
      const firestore = admin.firestore();
      const batch = firestore.batch();
      const dataset = testResumeDocuments.slice(0, 10);
      
      for (const resume of dataset) {
        const docRef = firestore.collection('resumes').doc(resume.id);
        batch.set(docRef, resume);
      }
      await batch.commit();

      const progressUpdates: any[] = [];

      // Mock progress callback
      const originalReportProgress = migrationManager['reportProgress'];
      migrationManager['reportProgress'] = function(migrationId: string, progress: any) {
        progressUpdates.push({ ...progress, timestamp: Date.now() });
        return originalReportProgress.call(this, migrationId, progress);
      };

      // Act: Start migration
      const migrationId = await migrationManager.startMigration({
        direction: 'firestore-to-cosmos',
        collections: ['resumes'],
        batchSize: 3 // Small batch size for more progress updates
      });

      // Wait for completion
      let status = await migrationManager.getMigrationStatus(migrationId);
      while (status.status === 'running') {
        await testUtils.delay(1000);
        status = await migrationManager.getMigrationStatus(migrationId);
      }

      // Assert: Should have multiple progress updates
      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(status.status).toBe('completed');

      // Verify progress updates show increasing completion
      const completionPercentages = progressUpdates.map(p => p.progressPercentage);
      expect(completionPercentages[completionPercentages.length - 1]).toBe(100);
    });

    it('should handle connection interruptions gracefully', async () => {
      // This test simulates network interruptions during migration
      // Note: This is a simplified simulation - real network issues would be more complex
      
      // Arrange: Set up data
      const firestore = admin.firestore();
      const batch = firestore.batch();
      const dataset = testResumeDocuments.slice(0, 8);
      
      for (const resume of dataset) {
        const docRef = firestore.collection('resumes').doc(resume.id);
        batch.set(docRef, resume);
      }
      await batch.commit();

      // Mock intermittent failures in Cosmos repository
      const originalCreate = resumeRepository.create;
      let callCount = 0;
      
      resumeRepository.create = jest.fn().mockImplementation(async (data) => {
        callCount++;
        // Fail every 3rd call to simulate intermittent issues
        if (callCount % 3 === 0) {
          throw new Error('Simulated connection timeout');
        }
        return originalCreate.call(resumeRepository, data);
      });

      // Act: Start migration with retry enabled
      const migrationId = await migrationManager.startMigration({
        direction: 'firestore-to-cosmos',
        collections: ['resumes'],
        batchSize: 2,
        retryAttempts: 3,
        continueOnError: true
      });

      // Wait for completion
      let status = await migrationManager.getMigrationStatus(migrationId);
      while (status.status === 'running') {
        await testUtils.delay(1000);
        status = await migrationManager.getMigrationStatus(migrationId);
      }

      // Assert: Migration should complete despite intermittent failures
      expect(['completed', 'completed_with_errors']).toContain(status.status);
      expect(status.documentsProcessed).toBeGreaterThan(0);

      // Restore original method
      resumeRepository.create = originalCreate;
    });
  });

  describe('Data Validation and Integrity', () => {
    it('should validate data consistency across stores', async () => {
      // Arrange: Create test data with intentional inconsistencies
      const testResume = { ...testResumeDocuments[0] };
      
      // Create in Cosmos DB
      await resumeRepository.create(testResume);
      
      // Create slightly different version in Firestore
      const inconsistentResume = { 
        ...testResume, 
        atsScore: testResume.atsScore + 10 // Different ATS score
      };
      await firestoreResumeRepo.create(inconsistentResume);

      // Act: Run validation
      const validationResult = await migrationManager.validateDataConsistency({
        collections: ['resumes'],
        sampleSize: 10,
        detailedComparison: true
      });

      // Assert: Should detect inconsistency
      expect(validationResult.success).toBe(false);
      expect(validationResult.inconsistencies).toHaveLength(1);
      expect(validationResult.inconsistencies[0]).toMatchObject({
        id: testResume.id,
        collection: 'resumes',
        differences: expect.arrayContaining(['atsScore'])
      });
    });

    it('should verify migration completeness', async () => {
      // Arrange: Set up source data
      const firestore = admin.firestore();
      const batch = firestore.batch();
      const sourceData = testResumeDocuments.slice(0, 6);
      
      for (const resume of sourceData) {
        const docRef = firestore.collection('resumes').doc(resume.id);
        batch.set(docRef, resume);
      }
      await batch.commit();

      // Perform migration
      const migrationId = await migrationManager.startMigration({
        direction: 'firestore-to-cosmos',
        collections: ['resumes']
      });

      let status = await migrationManager.getMigrationStatus(migrationId);
      while (status.status === 'running') {
        await testUtils.delay(1000);
        status = await migrationManager.getMigrationStatus(migrationId);
      }

      // Act: Verify completeness
      const completenessCheck = await migrationManager.verifyMigrationCompleteness(migrationId);

      // Assert: Should confirm all data migrated
      expect(completenessCheck.complete).toBe(true);
      expect(completenessCheck.sourceCount).toBe(6);
      expect(completenessCheck.targetCount).toBe(6);
      expect(completenessCheck.missingDocuments).toHaveLength(0);
    });
  });
});