/**
 * Database Migration Test Suite
 * 
 * Comprehensive tests for Firestore to Azure Cosmos DB migration
 * including unit tests, integration tests, and validation scenarios.
 */

import { describe, beforeAll, beforeEach, afterAll, afterEach, it, expect, jest } from '@jest/globals';
import { DatabaseMigrationService } from '../scripts/database-migration';
import { DualWriteService } from '../lib/services/dual-write-service';
import { azureCosmosService } from '../lib/services/azure-cosmos-service';
import { getAdminFirestore } from '../lib/firebase/admin';

// Mock dependencies
jest.mock('../lib/firebase/admin');
jest.mock('../lib/services/azure-cosmos-service');
jest.mock('../lib/azure-config');

const mockFirestore = {
  collection: jest.fn(),
  batch: jest.fn()
};

const mockCollection = {
  doc: jest.fn(),
  get: jest.fn(),
  add: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  offset: jest.fn(),
  count: jest.fn(),
  startAfter: jest.fn()
};

const mockDoc = {
  get: jest.fn(),
  set: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  exists: false,
  id: 'test-doc-id',
  data: jest.fn()
};

const mockSnapshot = {
  docs: [],
  empty: true,
  size: 0,
  data: jest.fn()
};

const mockBatch = {
  set: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  commit: jest.fn()
};

// Test data fixtures
const sampleInterviewDoc = {
  id: 'interview-123',
  userId: 'user-456',
  questions: ['Q1', 'Q2', 'Q3'],
  responses: ['A1', 'A2', 'A3'],
  createdAt: new Date('2023-01-01'),
  finalized: false,
  metadata: {
    duration: 1800,
    aiModel: 'gpt-4'
  }
};

const sampleResumeDoc = {
  id: 'resume-789',
  userId: 'user-456',
  filename: 'resume.pdf',
  extractedData: {
    skills: ['JavaScript', 'React', 'Node.js'],
    experience: [
      {
        company: 'Tech Corp',
        role: 'Developer',
        duration: '2 years'
      }
    ],
    education: []
  },
  metadata: {
    fileSize: 204800,
    uploadDate: new Date('2023-01-15'),
    mimeType: 'application/pdf',
    storageProvider: 'firebase'
  },
  createdAt: new Date('2023-01-15')
};

describe('DatabaseMigrationService', () => {
  let migrationService: DatabaseMigrationService;

  beforeAll(() => {
    // Setup global mocks
    (getAdminFirestore as jest.Mock).mockReturnValue(mockFirestore);
    
    mockFirestore.collection.mockReturnValue(mockCollection);
    mockCollection.doc.mockReturnValue(mockDoc);
    mockCollection.get.mockReturnValue(Promise.resolve(mockSnapshot));
    mockCollection.count.mockReturnValue({ get: () => Promise.resolve(mockSnapshot) });
    mockFirestore.batch.mockReturnValue(mockBatch);
  });

  beforeEach(() => {
    migrationService = new DatabaseMigrationService();
    jest.clearAllMocks();
  });

  describe('Collection Mapping', () => {
    it('should have correct collection mappings', () => {
      const mappings = (migrationService as any).collectionMappings;
      
      expect(mappings).toEqual({
        'interviews': 'interviews',
        'feedback': 'feedback',
        'resumes': 'resumes',
        'usage': 'usage',
        'autoApplySettings': 'autoApplySettings',
        'applications': 'applications',
        'jobListings': 'jobListings',
        'automationLogs': 'automationLogs',
        'subscription_events': 'subscriptionEvents'
      });
    });

    it('should throw error for unmapped collection', async () => {
      await expect(
        migrationService.migrateCollection('unmapped-collection')
      ).rejects.toThrow('No mapping found for collection: unmapped-collection');
    });
  });

  describe('Document Transformation', () => {
    it('should transform interview document correctly', async () => {
      const transformed = await (migrationService as any).transformDocumentForCosmos(
        { id: sampleInterviewDoc.id, data: () => sampleInterviewDoc },
        'interviews'
      );

      expect(transformed).toEqual({
        id: sampleInterviewDoc.id,
        ...sampleInterviewDoc,
        _partitionKey: sampleInterviewDoc.userId,
        status: 'active', // finalized: false -> status: 'active'
        metadata: {
          ...sampleInterviewDoc.metadata,
          migratedFrom: 'firestore'
        },
        _migrated: {
          from: 'firestore',
          timestamp: expect.any(Date),
          originalId: sampleInterviewDoc.id,
          checksum: expect.any(String)
        }
      });
    });

    it('should transform resume document correctly', async () => {
      const transformed = await (migrationService as any).transformDocumentForCosmos(
        { id: sampleResumeDoc.id, data: () => sampleResumeDoc },
        'resumes'
      );

      expect(transformed).toEqual({
        id: sampleResumeDoc.id,
        ...sampleResumeDoc,
        _partitionKey: sampleResumeDoc.userId,
        interviewQuestions: [], // Added default empty array
        _migrated: {
          from: 'firestore',
          timestamp: expect.any(Date),
          originalId: sampleResumeDoc.id,
          checksum: expect.any(String)
        }
      });
    });

    it('should calculate consistent checksum', () => {
      const data = { field1: 'value1', field2: 'value2' };
      const checksum1 = (migrationService as any).calculateChecksum(data);
      const checksum2 = (migrationService as any).calculateChecksum(data);
      
      expect(checksum1).toBe(checksum2);
      expect(checksum1).toHaveLength(64); // SHA-256 hex string
    });
  });

  describe('Partition Key Generation', () => {
    it('should generate correct partition keys for user-based collections', () => {
      const userData = { userId: 'user-123' };
      
      const partitionKey = (migrationService as any).getPartitionKey(userData, 'interviews');
      expect(partitionKey).toBe('user-123');
    });

    it('should generate correct partition keys for system collections', () => {
      const jobData = { id: 'job-456' };
      
      const partitionKey = (migrationService as any).getPartitionKey(jobData, 'jobListings');
      expect(partitionKey).toBe('job-456');
    });

    it('should fallback to default partition key', () => {
      const emptyData = {};
      
      const partitionKey = (migrationService as any).getPartitionKey(emptyData, 'interviews');
      expect(partitionKey).toBe('default');
    });
  });

  describe('Migration Process', () => {
    beforeEach(() => {
      // Mock Firestore responses
      mockSnapshot.data.mockReturnValue({ count: 5 });
      mockSnapshot.docs = Array(5).fill(null).map((_, index) => ({
        id: `doc-${index}`,
        data: () => ({ ...sampleInterviewDoc, id: `doc-${index}` })
      }));
      
      // Mock Cosmos DB responses
      azureCosmosService.initialize = jest.fn().mockResolvedValue(undefined);
      azureCosmosService.createDocument = jest.fn().mockResolvedValue(undefined);
      azureCosmosService.getDocument = jest.fn().mockResolvedValue(null);
      azureCosmosService.queryDocuments = jest.fn().mockResolvedValue([]);
    });

    it('should perform dry run migration', async () => {
      const result = await migrationService.migrateCollection('interviews', {
        dryRun: true,
        batchSize: 2
      });

      expect(result.collection).toBe('interviews');
      expect(result.total).toBe(5);
      expect(result.migrated).toBe(5);
      expect(result.failed).toBe(0);
      
      // Should not actually call Cosmos DB create
      expect(azureCosmosService.createDocument).not.toHaveBeenCalled();
    });

    it('should handle migration errors gracefully', async () => {
      // Mock one document creation failure
      azureCosmosService.createDocument = jest.fn()
        .mockResolvedValueOnce(undefined) // First call succeeds
        .mockRejectedValueOnce(new Error('Cosmos DB error')); // Second call fails

      const result = await migrationService.migrateCollection('interviews', {
        batchSize: 2
      });

      expect(result.migrated).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toBe('Cosmos DB error');
    });

    it('should validate only without migration', async () => {
      azureCosmosService.queryDocuments = jest.fn().mockResolvedValue([0]); // Mock count query
      
      const result = await migrationService.migrateCollection('interviews', {
        validateOnly: true
      });

      expect(result.total).toBe(0);
      expect(result.migrated).toBe(0);
      expect(azureCosmosService.createDocument).not.toHaveBeenCalled();
    });
  });

  describe('Validation', () => {
    beforeEach(() => {
      mockSnapshot.data.mockReturnValue({ count: 3 });
      azureCosmosService.queryDocuments = jest.fn().mockResolvedValue([3]); // Mock count
    });

    it('should validate equal document counts', async () => {
      const validation = await migrationService.validateMigration('interviews');
      
      expect(validation.collection).toBe('interviews');
      expect(validation.counts.firestore).toBe(3);
      expect(validation.counts.cosmos).toBe(3);
    });

    it('should detect count mismatches', async () => {
      azureCosmosService.queryDocuments = jest.fn().mockResolvedValue([2]); // Different count
      
      const validation = await migrationService.validateMigration('interviews');
      
      expect(validation.counts.firestore).toBe(3);
      expect(validation.counts.cosmos).toBe(2);
      expect(validation.isValid).toBe(false);
    });
  });

  describe('Document Comparison', () => {
    it('should detect identical documents', () => {
      const doc1 = { field1: 'value1', field2: 'value2' };
      const doc2 = { field1: 'value1', field2: 'value2' };
      
      const differences = (migrationService as any).compareDocuments(doc1, doc2);
      expect(differences).toHaveLength(0);
    });

    it('should detect value differences', () => {
      const doc1 = { field1: 'value1', field2: 'value2' };
      const doc2 = { field1: 'value1', field2: 'different' };
      
      const differences = (migrationService as any).compareDocuments(doc1, doc2);
      expect(differences).toContain('Value mismatch for key: field2');
    });

    it('should detect missing fields', () => {
      const doc1 = { field1: 'value1', field2: 'value2' };
      const doc2 = { field1: 'value1' };
      
      const differences = (migrationService as any).compareDocuments(doc1, doc2);
      expect(differences).toContain('Missing key in Cosmos: field2');
    });

    it('should ignore Cosmos-specific fields', () => {
      const firestoreDoc = { field1: 'value1' };
      const cosmosDoc = { field1: 'value1', _partitionKey: 'pk', _migrated: {} };
      
      const differences = (migrationService as any).compareDocuments(firestoreDoc, cosmosDoc);
      expect(differences).toHaveLength(0);
    });

    it('should handle date comparisons', () => {
      const date = new Date('2023-01-01');
      const doc1 = { timestamp: date };
      const doc2 = { timestamp: new Date(date.getTime()) };
      
      const isEqual = (migrationService as any).deepEqual(doc1.timestamp, doc2.timestamp);
      expect(isEqual).toBe(true);
    });
  });

  describe('Rollback', () => {
    beforeEach(() => {
      azureCosmosService.queryDocuments = jest.fn().mockResolvedValue([
        {
          id: 'doc-1',
          field1: 'value1',
          _partitionKey: 'user-123',
          _migrated: { from: 'firestore' }
        },
        {
          id: 'doc-2',
          field1: 'value2',
          _partitionKey: 'user-456',
          _migrated: { from: 'firestore' }
        }
      ]);

      mockBatch.commit.mockResolvedValue(undefined);
    });

    it('should rollback migrated documents', async () => {
      await migrationService.rollbackCollection('interviews');
      
      expect(azureCosmosService.queryDocuments).toHaveBeenCalledWith(
        'interviews',
        'SELECT * FROM c WHERE c._migrated.from = "firestore"',
        []
      );

      expect(mockBatch.set).toHaveBeenCalledTimes(2);
      expect(mockBatch.commit).toHaveBeenCalled();
    });

    it('should handle large rollbacks in batches', async () => {
      // Mock 1000 documents
      const largeBatch = Array(1000).fill(null).map((_, index) => ({
        id: `doc-${index}`,
        field1: `value${index}`,
        _partitionKey: `user-${index}`,
        _migrated: { from: 'firestore' }
      }));

      azureCosmosService.queryDocuments = jest.fn().mockResolvedValue(largeBatch);

      await migrationService.rollbackCollection('interviews');
      
      // Should commit twice (500 + 500)
      expect(mockBatch.commit).toHaveBeenCalledTimes(2);
    });
  });
});

describe('DualWriteService', () => {
  let dualWriteService: DualWriteService;

  beforeAll(() => {
    jest.clearAllMocks();
  });

  beforeEach(() => {
    dualWriteService = new DualWriteService({
      readPreference: 'firestore-first',
      writeMode: 'dual',
      validateWrites: false,
      failOnWriteError: false,
      migrationProgress: {}
    });

    // Reset mocks
    mockDoc.set.mockResolvedValue(undefined);
    azureCosmosService.createDocument = jest.fn().mockResolvedValue(undefined);
    azureCosmosService.updateDocument = jest.fn().mockResolvedValue(undefined);
    azureCosmosService.deleteDocument = jest.fn().mockResolvedValue(undefined);
  });

  describe('Configuration', () => {
    it('should initialize with default configuration', () => {
      const service = new DualWriteService();
      const config = service.getConfig();
      
      expect(config.readPreference).toBe('firestore-first');
      expect(config.writeMode).toBe('dual');
      expect(config.validateWrites).toBe(false);
    });

    it('should accept custom configuration', () => {
      const service = new DualWriteService({
        readPreference: 'cosmos',
        writeMode: 'cosmos-only'
      });
      
      const config = service.getConfig();
      expect(config.readPreference).toBe('cosmos');
      expect(config.writeMode).toBe('cosmos-only');
    });

    it('should update configuration', () => {
      dualWriteService.updateConfig({
        readPreference: 'cosmos-first'
      });
      
      expect(dualWriteService.getConfig().readPreference).toBe('cosmos-first');
    });
  });

  describe('Dual Write Operations', () => {
    it('should write to both databases in dual mode', async () => {
      const testData = { userId: 'user-123', content: 'test' };
      
      const result = await dualWriteService.createDocument('interviews', testData, 'doc-123');
      
      expect(result.success).toBe(true);
      expect(result.firestore?.success).toBe(true);
      expect(result.cosmos?.success).toBe(true);
      
      expect(mockDoc.set).toHaveBeenCalledWith(testData);
      expect(azureCosmosService.createDocument).toHaveBeenCalled();
    });

    it('should handle Firestore write failure', async () => {
      mockDoc.set.mockRejectedValueOnce(new Error('Firestore error'));
      
      const result = await dualWriteService.createDocument('interviews', { userId: 'user-123' });
      
      expect(result.firestore?.success).toBe(false);
      expect(result.firestore?.error).toBe('Firestore error');
      expect(result.cosmos?.success).toBe(true);
    });

    it('should handle Cosmos write failure', async () => {
      azureCosmosService.createDocument = jest.fn().mockRejectedValueOnce(new Error('Cosmos error'));
      
      const result = await dualWriteService.createDocument('interviews', { userId: 'user-123' });
      
      expect(result.firestore?.success).toBe(true);
      expect(result.cosmos?.success).toBe(false);
      expect(result.cosmos?.error).toBe('Cosmos error');
    });

    it('should determine primary database based on migration progress', async () => {
      // Collection with 25% migration progress - Firestore should be primary
      dualWriteService.updateConfig({
        migrationProgress: { interviews: 25 }
      });
      
      const result = await dualWriteService.createDocument('interviews', { userId: 'user-123' });
      expect(result.primarySuccess).toBe(result.firestore?.success);
      
      // Collection with 75% migration progress - Cosmos should be primary
      dualWriteService.updateConfig({
        migrationProgress: { interviews: 75 }
      });
      
      const result2 = await dualWriteService.createDocument('interviews', { userId: 'user-123' });
      expect(result2.primarySuccess).toBe(result2.cosmos?.success);
    });
  });

  describe('Read Operations', () => {
    beforeEach(() => {
      mockDoc.exists = true;
      mockDoc.data.mockReturnValue({ userId: 'user-123', content: 'test' });
      azureCosmosService.getDocument = jest.fn().mockResolvedValue({
        id: 'doc-123',
        userId: 'user-123',
        content: 'test',
        _partitionKey: 'user-123'
      });
    });

    it('should read from Firestore first', async () => {
      dualWriteService.updateConfig({ readPreference: 'firestore-first' });
      
      const doc = await dualWriteService.getDocument('interviews', 'doc-123');
      
      expect(doc).toEqual({
        id: 'doc-123',
        userId: 'user-123',
        content: 'test'
      });
      
      expect(mockDoc.get).toHaveBeenCalled();
      expect(azureCosmosService.getDocument).not.toHaveBeenCalled();
    });

    it('should fallback to Cosmos on Firestore failure', async () => {
      dualWriteService.updateConfig({ readPreference: 'firestore-first' });
      mockDoc.get.mockRejectedValueOnce(new Error('Firestore error'));
      
      const doc = await dualWriteService.getDocument('interviews', 'doc-123');
      
      expect(doc).toEqual({
        id: 'doc-123',
        userId: 'user-123',
        content: 'test'
      });
      
      expect(azureCosmosService.getDocument).toHaveBeenCalled();
    });

    it('should read from Cosmos first', async () => {
      dualWriteService.updateConfig({ readPreference: 'cosmos-first' });
      
      const doc = await dualWriteService.getDocument('interviews', 'doc-123', 'user-123');
      
      expect(doc).toEqual({
        id: 'doc-123',
        userId: 'user-123',
        content: 'test'
      });
      
      expect(azureCosmosService.getDocument).toHaveBeenCalled();
    });
  });

  describe('Health Check', () => {
    it('should check both database health', async () => {
      const health = await dualWriteService.healthCheck();
      
      expect(health).toEqual({
        firestore: true,
        cosmos: true,
        config: expect.any(Object)
      });
    });

    it('should handle database failures in health check', async () => {
      azureCosmosService.initialize = jest.fn().mockRejectedValueOnce(new Error('Cosmos offline'));
      
      const health = await dualWriteService.healthCheck();
      
      expect(health.firestore).toBe(true);
      expect(health.cosmos).toBe(false);
    });
  });
});

describe('Integration Tests', () => {
  describe('End-to-End Migration Workflow', () => {
    let migrationService: DatabaseMigrationService;
    let dualWriteService: DualWriteService;

    beforeEach(() => {
      migrationService = new DatabaseMigrationService();
      dualWriteService = new DualWriteService();
      
      // Setup comprehensive mocks for integration testing
      mockSnapshot.data.mockReturnValue({ count: 2 });
      mockSnapshot.docs = [
        {
          id: 'interview-1',
          data: () => ({ ...sampleInterviewDoc, id: 'interview-1' })
        },
        {
          id: 'interview-2', 
          data: () => ({ ...sampleInterviewDoc, id: 'interview-2', userId: 'user-789' })
        }
      ];

      azureCosmosService.initialize = jest.fn().mockResolvedValue(undefined);
      azureCosmosService.createDocument = jest.fn().mockResolvedValue(undefined);
      azureCosmosService.queryDocuments = jest.fn().mockResolvedValue([2]);
    });

    it('should complete full migration workflow', async () => {
      // Step 1: Validate pre-migration state
      const preValidation = await migrationService.validateMigration('interviews');
      expect(preValidation.counts.firestore).toBe(2);
      expect(preValidation.counts.cosmos).toBe(2);

      // Step 2: Perform migration
      const migrationResult = await migrationService.migrateCollection('interviews', {
        batchSize: 10
      });

      expect(migrationResult.migrated).toBe(2);
      expect(migrationResult.failed).toBe(0);

      // Step 3: Validate post-migration state
      azureCosmosService.queryDocuments = jest.fn().mockResolvedValue([2]); // Same count
      const postValidation = await migrationService.validateMigration('interviews');
      expect(postValidation.isValid).toBe(true);
    });

    it('should handle partial migration and dual-write setup', async () => {
      // Simulate partial migration (1 success, 1 failure)
      azureCosmosService.createDocument = jest.fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Cosmos error'));

      const result = await migrationService.migrateCollection('interviews');
      
      expect(result.migrated).toBe(1);
      expect(result.failed).toBe(1);

      // Setup dual-write with 50% progress
      dualWriteService.updateConfig({
        migrationProgress: { interviews: 50 }
      });

      // New writes should go to both systems
      const writeResult = await dualWriteService.createDocument('interviews', {
        userId: 'user-new',
        content: 'new interview'
      });

      expect(writeResult.success).toBe(true);
    });
  });

  describe('Error Recovery Scenarios', () => {
    it('should handle network failures during migration', async () => {
      const migrationService = new DatabaseMigrationService();
      
      // Simulate intermittent failures
      let callCount = 0;
      azureCosmosService.createDocument = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          throw new Error('Network timeout');
        }
        return Promise.resolve();
      });

      mockSnapshot.docs = Array(3).fill(null).map((_, index) => ({
        id: `doc-${index}`,
        data: () => ({ ...sampleInterviewDoc, id: `doc-${index}` })
      }));

      const result = await migrationService.migrateCollection('interviews');
      
      expect(result.migrated).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.errors[0].error).toBe('Network timeout');
    });

    it('should maintain data consistency during dual-write failures', async () => {
      const dualWriteService = new DualWriteService({
        failOnWriteError: false
      });

      // Simulate Cosmos failure
      azureCosmosService.createDocument = jest.fn().mockRejectedValue(new Error('Cosmos down'));

      const result = await dualWriteService.createDocument('interviews', {
        userId: 'user-123',
        content: 'test'
      });

      // Should still succeed because Firestore write succeeded
      expect(result.success).toBe(true);
      expect(result.primarySuccess).toBe(true); // Firestore is primary
      expect(result.cosmos?.success).toBe(false);
    });
  });

  describe('Performance Tests', () => {
    it('should handle large batch migrations efficiently', async () => {
      const migrationService = new DatabaseMigrationService();
      
      // Mock large dataset (1000 documents)
      const largeBatch = Array(1000).fill(null).map((_, index) => ({
        id: `doc-${index}`,
        data: () => ({ ...sampleInterviewDoc, id: `doc-${index}` })
      }));

      mockSnapshot.data.mockReturnValue({ count: 1000 });
      mockSnapshot.docs = largeBatch;
      mockCollection.orderBy.mockReturnValue(mockCollection);
      mockCollection.limit.mockReturnValue(mockCollection);
      mockCollection.get.mockResolvedValue(mockSnapshot);

      const startTime = Date.now();
      const result = await migrationService.migrateCollection('interviews', {
        batchSize: 100,
        dryRun: true // Don't actually create documents
      });
      const duration = Date.now() - startTime;

      expect(result.migrated).toBe(1000);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds for dry run
    });
  });
});

describe('Data Integrity Tests', () => {
  describe('Field Validation', () => {
    it('should preserve all original fields during transformation', async () => {
      const migrationService = new DatabaseMigrationService();
      const originalDoc = {
        id: 'test-doc',
        data: () => ({
          stringField: 'test',
          numberField: 42,
          booleanField: true,
          dateField: new Date('2023-01-01'),
          arrayField: ['item1', 'item2'],
          objectField: { nested: 'value' },
          nullField: null,
          undefinedField: undefined
        })
      };

      const transformed = await (migrationService as any).transformDocumentForCosmos(
        originalDoc,
        'interviews'
      );

      const { _partitionKey, _migrated, ...dataFields } = transformed;
      const originalData = originalDoc.data();

      // All original fields should be preserved
      for (const [key, value] of Object.entries(originalData)) {
        if (value !== undefined) { // undefined fields are not preserved in JSON
          expect(dataFields[key]).toEqual(value);
        }
      }
    });
  });

  describe('Checksum Validation', () => {
    it('should detect data corruption through checksum mismatch', async () => {
      const migrationService = new DatabaseMigrationService();
      const originalData = { field1: 'value1', field2: 'value2' };
      const corruptedData = { field1: 'corrupted', field2: 'value2' };

      const originalChecksum = (migrationService as any).calculateChecksum(originalData);
      const corruptedChecksum = (migrationService as any).calculateChecksum(corruptedData);

      expect(originalChecksum).not.toBe(corruptedChecksum);
    });

    it('should handle special characters and unicode in checksum calculation', () => {
      const migrationService = new DatabaseMigrationService();
      const dataWithUnicode = {
        emoji: '🚀 🎉 ✅',
        chinese: '你好世界',
        special: '!@#$%^&*()_+-=[]{}|;:,.<>?'
      };

      const checksum = (migrationService as any).calculateChecksum(dataWithUnicode);
      expect(checksum).toMatch(/^[a-f0-9]{64}$/); // Valid SHA-256 hex
    });
  });
});
