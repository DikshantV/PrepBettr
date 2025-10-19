// Unit Tests for Dual-Write Repository Decorator
// Tests the dual-write functionality for gradual migration

import { DualWriteRepositoryDecorator } from '@/lib/data-layer/dual-write-decorator';
import { IDocumentRepository } from '@/lib/data-layer/interfaces/IDocumentRepository';
import { IResumeDocument } from '@/lib/data-layer/interfaces/IDocuments';

// Mock repositories
const createMockRepository = (): jest.Mocked<IDocumentRepository<IResumeDocument>> => ({
  create: jest.fn(),
  findById: jest.fn(),
  findMany: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  count: jest.fn(),
  exists: jest.fn()
});

describe('DualWriteRepositoryDecorator', () => {
  let primaryRepo: jest.Mocked<IDocumentRepository<IResumeDocument>>;
  let secondaryRepo: jest.Mocked<IDocumentRepository<IResumeDocument>>;
  let dualWriteRepo: DualWriteRepositoryDecorator<IResumeDocument>;
  let mockDocument: IResumeDocument;

  beforeEach(() => {
    jest.clearAllMocks();
    
    primaryRepo = createMockRepository();
    secondaryRepo = createMockRepository();
    mockDocument = testUtils.generateMockResumeDocument();

    // Create dual-write repository with test configuration
    dualWriteRepo = new DualWriteRepositoryDecorator(
      primaryRepo,
      secondaryRepo,
      {
        primaryProvider: 'cosmos',
        secondaryProvider: 'firestore',
        enableDualWrite: true,
        enableDualRead: false,
        readFallbackEnabled: true,
        writeConsistencyCheck: false,
        syncDelayMs: 0,
        maxRetries: 2
      }
    );
  });

  describe('create', () => {
    it('should write to both primary and secondary repositories', async () => {
      // Arrange
      const createData = { ...mockDocument };
      delete (createData as any).id;

      const primaryResult = testUtils.createMockRepositoryResult(mockDocument);
      const secondaryResult = testUtils.createMockRepositoryResult(mockDocument);

      primaryRepo.create.mockResolvedValue(primaryResult);
      secondaryRepo.create.mockResolvedValue(secondaryResult);

      // Act
      const result = await dualWriteRepo.create(createData);

      // Assert
      expect(result).toBeRepositoryResult(true);
      expect(result.data).toEqual(mockDocument);
      expect(primaryRepo.create).toHaveBeenCalledWith(createData);
      expect(secondaryRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ...createData,
          id: mockDocument.id
        })
      );
    });

    it('should succeed even if secondary write fails', async () => {
      // Arrange
      const createData = { ...mockDocument };
      delete (createData as any).id;

      const primaryResult = testUtils.createMockRepositoryResult(mockDocument);
      primaryRepo.create.mockResolvedValue(primaryResult);
      secondaryRepo.create.mockRejectedValue(new Error('Secondary write failed'));

      // Act
      const result = await dualWriteRepo.create(createData);

      // Assert
      expect(result).toBeRepositoryResult(true);
      expect(result.data).toEqual(mockDocument);
      expect(primaryRepo.create).toHaveBeenCalled();
      expect(secondaryRepo.create).toHaveBeenCalled();
    });

    it('should fail if primary write fails', async () => {
      // Arrange
      const createData = { ...mockDocument };
      delete (createData as any).id;

      const primaryResult = testUtils.createMockRepositoryResult(null, false);
      primaryRepo.create.mockResolvedValue(primaryResult);

      // Act
      const result = await dualWriteRepo.create(createData);

      // Assert
      expect(result).toBeRepositoryResult(false);
      expect(primaryRepo.create).toHaveBeenCalled();
      expect(secondaryRepo.create).not.toHaveBeenCalled();
    });

    it('should skip dual write when disabled', async () => {
      // Arrange
      const createData = { ...mockDocument };
      delete (createData as any).id;

      // Create dual-write repository with dual-write disabled
      const singleWriteRepo = new DualWriteRepositoryDecorator(
        primaryRepo,
        secondaryRepo,
        { enableDualWrite: false }
      );

      const primaryResult = testUtils.createMockRepositoryResult(mockDocument);
      primaryRepo.create.mockResolvedValue(primaryResult);

      // Act
      const result = await singleWriteRepo.create(createData);

      // Assert
      expect(result).toBeRepositoryResult(true);
      expect(primaryRepo.create).toHaveBeenCalled();
      expect(secondaryRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should read from primary repository first', async () => {
      // Arrange
      const documentId = 'test-id';
      const primaryResult = testUtils.createMockRepositoryResult(mockDocument);
      primaryRepo.findById.mockResolvedValue(primaryResult);

      // Act
      const result = await dualWriteRepo.findById(documentId);

      // Assert
      expect(result).toBeRepositoryResult(true);
      expect(result.data).toEqual(mockDocument);
      expect(primaryRepo.findById).toHaveBeenCalledWith(documentId);
      expect(secondaryRepo.findById).not.toHaveBeenCalled();
    });

    it('should fallback to secondary repository when primary returns null', async () => {
      // Arrange
      const documentId = 'test-id';
      const primaryResult = testUtils.createMockRepositoryResult(null);
      const secondaryResult = testUtils.createMockRepositoryResult(mockDocument);

      primaryRepo.findById.mockResolvedValue(primaryResult);
      secondaryRepo.findById.mockResolvedValue(secondaryResult);

      // Act
      const result = await dualWriteRepo.findById(documentId);

      // Assert
      expect(result).toBeRepositoryResult(true);
      expect(result.data).toEqual(mockDocument);
      expect(primaryRepo.findById).toHaveBeenCalledWith(documentId);
      expect(secondaryRepo.findById).toHaveBeenCalledWith(documentId);
    });

    it('should not fallback when fallback is disabled', async () => {
      // Arrange
      const documentId = 'test-id';
      
      // Create dual-write repository with fallback disabled
      const noFallbackRepo = new DualWriteRepositoryDecorator(
        primaryRepo,
        secondaryRepo,
        { readFallbackEnabled: false }
      );

      const primaryResult = testUtils.createMockRepositoryResult(null);
      primaryRepo.findById.mockResolvedValue(primaryResult);

      // Act
      const result = await noFallbackRepo.findById(documentId);

      // Assert
      expect(result).toBeRepositoryResult(true);
      expect(result.data).toBeNull();
      expect(primaryRepo.findById).toHaveBeenCalled();
      expect(secondaryRepo.findById).not.toHaveBeenCalled();
    });

    it('should handle fallback errors gracefully', async () => {
      // Arrange
      const documentId = 'test-id';
      const primaryResult = testUtils.createMockRepositoryResult(null);
      
      primaryRepo.findById.mockResolvedValue(primaryResult);
      secondaryRepo.findById.mockRejectedValue(new Error('Fallback failed'));

      // Act
      const result = await dualWriteRepo.findById(documentId);

      // Assert
      expect(result).toBeRepositoryResult(true);
      expect(result.data).toBeNull();
    });
  });

  describe('update', () => {
    it('should update both primary and secondary repositories', async () => {
      // Arrange
      const documentId = 'test-id';
      const updates = { atsScore: 95 };
      const updatedDocument = { ...mockDocument, atsScore: 95 };

      const primaryResult = testUtils.createMockRepositoryResult(updatedDocument);
      const secondaryResult = testUtils.createMockRepositoryResult(updatedDocument);

      primaryRepo.update.mockResolvedValue(primaryResult);
      secondaryRepo.update.mockResolvedValue(secondaryResult);

      // Act
      const result = await dualWriteRepo.update(documentId, updates);

      // Assert
      expect(result).toBeRepositoryResult(true);
      expect(result.data).toEqual(updatedDocument);
      expect(primaryRepo.update).toHaveBeenCalledWith(documentId, updates);
      expect(secondaryRepo.update).toHaveBeenCalledWith(documentId, updates);
    });

    it('should succeed even if secondary update fails', async () => {
      // Arrange
      const documentId = 'test-id';
      const updates = { atsScore: 95 };
      const updatedDocument = { ...mockDocument, atsScore: 95 };

      const primaryResult = testUtils.createMockRepositoryResult(updatedDocument);
      primaryRepo.update.mockResolvedValue(primaryResult);
      secondaryRepo.update.mockRejectedValue(new Error('Secondary update failed'));

      // Act
      const result = await dualWriteRepo.update(documentId, updates);

      // Assert
      expect(result).toBeRepositoryResult(true);
      expect(result.data).toEqual(updatedDocument);
    });
  });

  describe('delete', () => {
    it('should delete from both primary and secondary repositories', async () => {
      // Arrange
      const documentId = 'test-id';

      const primaryResult = testUtils.createMockRepositoryResult(true);
      const secondaryResult = testUtils.createMockRepositoryResult(true);

      primaryRepo.delete.mockResolvedValue(primaryResult);
      secondaryRepo.delete.mockResolvedValue(secondaryResult);

      // Act
      const result = await dualWriteRepo.delete(documentId);

      // Assert
      expect(result).toBeRepositoryResult(true);
      expect(result.data).toBe(true);
      expect(primaryRepo.delete).toHaveBeenCalledWith(documentId);
      expect(secondaryRepo.delete).toHaveBeenCalledWith(documentId);
    });
  });

  describe('metrics tracking', () => {
    it('should track write metrics correctly', async () => {
      // Arrange
      const createData = { ...mockDocument };
      delete (createData as any).id;

      const primaryResult = testUtils.createMockRepositoryResult(mockDocument);
      primaryRepo.create.mockResolvedValue(primaryResult);
      secondaryRepo.create.mockResolvedValue(primaryResult);

      // Act
      await dualWriteRepo.create(createData);
      const metrics = dualWriteRepo.getMetrics();

      // Assert
      expect(metrics.primaryWrites).toBe(1);
      expect(metrics.secondaryWrites).toBe(1);
      expect(metrics.writeSuccesses).toBe(1);
      expect(metrics.writeFailures).toBe(0);
    });

    it('should track read metrics correctly', async () => {
      // Arrange
      const documentId = 'test-id';
      const primaryResult = testUtils.createMockRepositoryResult(mockDocument);
      primaryRepo.findById.mockResolvedValue(primaryResult);

      // Act
      await dualWriteRepo.findById(documentId);
      const metrics = dualWriteRepo.getMetrics();

      // Assert
      expect(metrics.readHits).toBe(1);
      expect(metrics.readMisses).toBe(0);
      expect(metrics.fallbackReads).toBe(0);
    });

    it('should track fallback reads correctly', async () => {
      // Arrange
      const documentId = 'test-id';
      const primaryResult = testUtils.createMockRepositoryResult(null);
      const secondaryResult = testUtils.createMockRepositoryResult(mockDocument);

      primaryRepo.findById.mockResolvedValue(primaryResult);
      secondaryRepo.findById.mockResolvedValue(secondaryResult);

      // Act
      await dualWriteRepo.findById(documentId);
      const metrics = dualWriteRepo.getMetrics();

      // Assert
      expect(metrics.readMisses).toBe(1);
      expect(metrics.fallbackReads).toBe(1);
    });

    it('should track write failures correctly', async () => {
      // Arrange
      const createData = { ...mockDocument };
      delete (createData as any).id;

      const primaryResult = testUtils.createMockRepositoryResult(null, false);
      primaryRepo.create.mockResolvedValue(primaryResult);

      // Act
      await dualWriteRepo.create(createData);
      const metrics = dualWriteRepo.getMetrics();

      // Assert
      expect(metrics.writeFailures).toBe(1);
      expect(metrics.writeSuccesses).toBe(0);
    });
  });

  describe('health status', () => {
    it('should report healthy status when operations succeed', async () => {
      // Arrange
      const createData = { ...mockDocument };
      delete (createData as any).id;

      const primaryResult = testUtils.createMockRepositoryResult(mockDocument);
      primaryRepo.create.mockResolvedValue(primaryResult);
      secondaryRepo.create.mockResolvedValue(primaryResult);

      // Act
      await dualWriteRepo.create(createData);
      const health = dualWriteRepo.getHealthStatus();

      // Assert
      expect(health.healthy).toBe(true);
      expect(health.writeSuccessRate).toBe(100);
      expect(health.issues).toHaveLength(0);
    });

    it('should report unhealthy status when write success rate is low', async () => {
      // Arrange - simulate multiple failures
      const createData = { ...mockDocument };
      delete (createData as any).id;

      const failureResult = testUtils.createMockRepositoryResult(null, false);
      primaryRepo.create.mockResolvedValue(failureResult);

      // Act - perform multiple operations to establish a pattern
      for (let i = 0; i < 10; i++) {
        await dualWriteRepo.create(createData);
      }

      const health = dualWriteRepo.getHealthStatus();

      // Assert
      expect(health.healthy).toBe(false);
      expect(health.writeSuccessRate).toBe(0);
      expect(health.issues).toContain(expect.stringContaining('Low write success rate'));
    });
  });

  describe('migration phase control', () => {
    it('should configure Phase 1: Dual writes, primary reads', async () => {
      // Act
      await dualWriteRepo.enterPhase1();

      // Verify configuration by testing behavior
      const createData = { ...mockDocument };
      delete (createData as any).id;

      const primaryResult = testUtils.createMockRepositoryResult(mockDocument);
      primaryRepo.create.mockResolvedValue(primaryResult);
      secondaryRepo.create.mockResolvedValue(primaryResult);

      await dualWriteRepo.create(createData);

      // Assert
      expect(primaryRepo.create).toHaveBeenCalled();
      expect(secondaryRepo.create).toHaveBeenCalled(); // Dual write enabled
    });

    it('should configure Phase 4: Single system operation', async () => {
      // Act
      await dualWriteRepo.enterPhase4();

      // Verify configuration by testing behavior
      const createData = { ...mockDocument };
      delete (createData as any).id;

      const primaryResult = testUtils.createMockRepositoryResult(mockDocument);
      primaryRepo.create.mockResolvedValue(primaryResult);

      await dualWriteRepo.create(createData);

      // Assert
      expect(primaryRepo.create).toHaveBeenCalled();
      expect(secondaryRepo.create).not.toHaveBeenCalled(); // Dual write disabled
    });
  });

  describe('retry mechanism', () => {
    it('should retry failed secondary operations', async () => {
      // Arrange
      const createData = { ...mockDocument };
      delete (createData as any).id;

      const primaryResult = testUtils.createMockRepositoryResult(mockDocument);
      primaryRepo.create.mockResolvedValue(primaryResult);

      // First call fails, second succeeds
      secondaryRepo.create
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValue(testUtils.createMockRepositoryResult(mockDocument));

      // Act
      const result = await dualWriteRepo.create(createData);

      // Assert
      expect(result).toBeRepositoryResult(true);
      expect(secondaryRepo.create).toHaveBeenCalledTimes(2); // Initial + 1 retry
    });

    it('should give up after max retries', async () => {
      // Arrange
      const createData = { ...mockDocument };
      delete (createData as any).id;

      const primaryResult = testUtils.createMockRepositoryResult(mockDocument);
      primaryRepo.create.mockResolvedValue(primaryResult);

      // Always fail
      secondaryRepo.create.mockRejectedValue(new Error('Persistent failure'));

      // Act
      const result = await dualWriteRepo.create(createData);

      // Assert
      expect(result).toBeRepositoryResult(true); // Primary still succeeded
      expect(secondaryRepo.create).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('consistency checking', () => {
    it('should perform consistency checks when enabled', async () => {
      // Arrange - Create dual-write repository with consistency checking enabled
      const consistencyRepo = new DualWriteRepositoryDecorator(
        primaryRepo,
        secondaryRepo,
        {
          writeConsistencyCheck: true,
          syncDelayMs: 0
        }
      );

      const createData = { ...mockDocument };
      delete (createData as any).id;

      const primaryResult = testUtils.createMockRepositoryResult(mockDocument);
      const secondaryResult = testUtils.createMockRepositoryResult(mockDocument);

      primaryRepo.create.mockResolvedValue(primaryResult);
      secondaryRepo.create.mockResolvedValue(secondaryResult);
      
      // Mock the findById calls for consistency check
      primaryRepo.findById.mockResolvedValue(primaryResult);
      secondaryRepo.findById.mockResolvedValue(secondaryResult);

      // Act
      await consistencyRepo.create(createData);

      // Allow async consistency check to complete
      await testUtils.delay(100);

      // Assert - consistency check should have triggered findById calls
      expect(primaryRepo.findById).toHaveBeenCalled();
      expect(secondaryRepo.findById).toHaveBeenCalled();
    });

    it('should detect consistency errors', async () => {
      // Arrange
      const consistencyRepo = new DualWriteRepositoryDecorator(
        primaryRepo,
        secondaryRepo,
        {
          writeConsistencyCheck: true,
          syncDelayMs: 0
        }
      );

      const createData = { ...mockDocument };
      delete (createData as any).id;

      const primaryResult = testUtils.createMockRepositoryResult(mockDocument);
      const inconsistentDocument = { ...mockDocument, atsScore: 99 }; // Different data
      const secondaryResult = testUtils.createMockRepositoryResult(inconsistentDocument);

      primaryRepo.create.mockResolvedValue(primaryResult);
      secondaryRepo.create.mockResolvedValue(secondaryResult);
      primaryRepo.findById.mockResolvedValue(primaryResult);
      secondaryRepo.findById.mockResolvedValue(secondaryResult);

      // Act
      await consistencyRepo.create(createData);

      // Allow async consistency check to complete
      await testUtils.delay(100);

      // Assert - should track consistency error
      const metrics = consistencyRepo.getMetrics();
      expect(metrics.consistencyErrors).toBeGreaterThan(0);
    });
  });

  describe('error handling', () => {
    it('should handle exceptions in primary repository gracefully', async () => {
      // Arrange
      const createData = { ...mockDocument };
      delete (createData as any).id;

      primaryRepo.create.mockRejectedValue(new Error('Primary repository error'));

      // Act
      const result = await dualWriteRepo.create(createData);

      // Assert
      expect(result).toBeRepositoryResult(false);
      expect(result.error).toContain('Primary repository error');
    });

    it('should continue operation when secondary repository throws', async () => {
      // Arrange
      const createData = { ...mockDocument };
      delete (createData as any).id;

      const primaryResult = testUtils.createMockRepositoryResult(mockDocument);
      primaryRepo.create.mockResolvedValue(primaryResult);
      secondaryRepo.create.mockRejectedValue(new Error('Secondary repository error'));

      // Act
      const result = await dualWriteRepo.create(createData);

      // Assert
      expect(result).toBeRepositoryResult(true);
      expect(result.data).toEqual(mockDocument);
    });
  });
});