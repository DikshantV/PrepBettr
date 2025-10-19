// Unit Tests for Cosmos DB Repository
// Tests the Azure Cosmos DB repository implementation

import { CosmosResumeRepository } from '@/lib/data-layer/adapters/cosmos/cosmos-resume-repository';
import { IResumeDocument } from '@/lib/data-layer/interfaces/IDocuments';
import { CosmosClient, Container, Database } from '@azure/cosmos';

// Mock Cosmos DB
const mockContainer = {
  items: {
    create: jest.fn(),
    query: jest.fn().mockReturnValue({
      fetchAll: jest.fn()
    })
  },
  item: jest.fn().mockReturnValue({
    read: jest.fn(),
    replace: jest.fn(),
    delete: jest.fn()
  })
};

const mockDatabase = {
  container: jest.fn().mockReturnValue(mockContainer)
};

const mockCosmosClient = {
  database: jest.fn().mockReturnValue(mockDatabase)
};

jest.mock('@azure/cosmos');

describe('CosmosResumeRepository', () => {
  let repository: CosmosResumeRepository;
  let mockResumeDoc: IResumeDocument;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create repository instance
    repository = new CosmosResumeRepository(
      mockCosmosClient as unknown as CosmosClient,
      'test-database',
      'resumes'
    );

    // Generate mock document
    mockResumeDoc = testUtils.generateMockResumeDocument();
  });

  describe('create', () => {
    it('should create a new resume document successfully', async () => {
      // Arrange
      const createData = { ...mockResumeDoc };
      delete (createData as any).id; // Remove ID for creation
      
      mockContainer.items.create.mockResolvedValue({
        resource: mockResumeDoc,
        statusCode: 201
      });

      // Act
      const result = await repository.create(createData);

      // Assert
      expect(result).toBeRepositoryResult(true);
      expect(result.data).toEqual(mockResumeDoc);
      expect(mockContainer.items.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockResumeDoc.userId,
          fileName: mockResumeDoc.fileName
        })
      );
    });

    it('should handle creation errors gracefully', async () => {
      // Arrange
      const createData = { ...mockResumeDoc };
      delete (createData as any).id;
      
      mockContainer.items.create.mockRejectedValue(
        new Error('Cosmos DB creation failed')
      );

      // Act
      const result = await repository.create(createData);

      // Assert
      expect(result).toBeRepositoryResult(false);
      expect(result.error).toContain('Cosmos DB creation failed');
    });

    it('should generate a valid document ID during creation', async () => {
      // Arrange
      const createData = { ...mockResumeDoc };
      delete (createData as any).id;
      
      mockContainer.items.create.mockResolvedValue({
        resource: { ...mockResumeDoc, id: 'generated-id-123' },
        statusCode: 201
      });

      // Act
      const result = await repository.create(createData);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.id).toHaveValidDocumentId();
      expect(mockContainer.items.create).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String)
        })
      );
    });
  });

  describe('findById', () => {
    it('should find a document by ID successfully', async () => {
      // Arrange
      const documentId = 'test-resume-123';
      
      mockContainer.item.mockReturnValue({
        read: jest.fn().mockResolvedValue({
          resource: mockResumeDoc,
          statusCode: 200
        })
      });

      // Act
      const result = await repository.findById(documentId);

      // Assert
      expect(result).toBeRepositoryResult(true);
      expect(result.data).toEqual(mockResumeDoc);
      expect(mockContainer.item).toHaveBeenCalledWith(
        documentId,
        mockResumeDoc.userId
      );
    });

    it('should return null when document not found', async () => {
      // Arrange
      const documentId = 'non-existent-id';
      
      mockContainer.item.mockReturnValue({
        read: jest.fn().mockResolvedValue({
          resource: undefined,
          statusCode: 404
        })
      });

      // Act
      const result = await repository.findById(documentId);

      // Assert
      expect(result).toBeRepositoryResult(true);
      expect(result.data).toBeNull();
    });

    it('should handle read errors gracefully', async () => {
      // Arrange
      const documentId = 'test-resume-123';
      
      mockContainer.item.mockReturnValue({
        read: jest.fn().mockRejectedValue(
          new Error('Read operation failed')
        )
      });

      // Act
      const result = await repository.findById(documentId);

      // Assert
      expect(result).toBeRepositoryResult(false);
      expect(result.error).toContain('Read operation failed');
    });
  });

  describe('findMany', () => {
    it('should find multiple documents with query options', async () => {
      // Arrange
      const queryOptions = {
        where: { userId: 'test-user-123' },
        limit: 10,
        orderBy: { createdAt: 'desc' as const }
      };
      
      const mockDocuments = [mockResumeDoc, { ...mockResumeDoc, id: 'doc-2' }];
      
      mockContainer.items.query.mockReturnValue({
        fetchAll: jest.fn().mockResolvedValue({
          resources: mockDocuments
        })
      });

      // Act
      const result = await repository.findMany(queryOptions);

      // Assert
      expect(result).toBeRepositoryResult(true);
      expect(result.data).toEqual(mockDocuments);
      expect(result.data).toHaveLength(2);
      expect(mockContainer.items.query).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.stringContaining('WHERE')
        })
      );
    });

    it('should handle empty query results', async () => {
      // Arrange
      mockContainer.items.query.mockReturnValue({
        fetchAll: jest.fn().mockResolvedValue({
          resources: []
        })
      });

      // Act
      const result = await repository.findMany({});

      // Assert
      expect(result).toBeRepositoryResult(true);
      expect(result.data).toEqual([]);
    });

    it('should build correct SQL query for complex conditions', async () => {
      // Arrange
      const queryOptions = {
        where: { 
          userId: 'test-user-123',
          processingMethod: 'azure-form-recognizer'
        },
        limit: 5,
        orderBy: { uploadDate: 'asc' as const }
      };
      
      mockContainer.items.query.mockReturnValue({
        fetchAll: jest.fn().mockResolvedValue({
          resources: [mockResumeDoc]
        })
      });

      // Act
      const result = await repository.findMany(queryOptions);

      // Assert
      expect(mockContainer.items.query).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.stringMatching(/WHERE.*userId.*AND.*processingMethod.*ORDER BY.*uploadDate.*ASC.*TOP 5/)
        })
      );
    });
  });

  describe('update', () => {
    it('should update a document successfully', async () => {
      // Arrange
      const documentId = 'test-resume-123';
      const updates = {
        atsScore: 90,
        processingTime: 1500,
        updatedAt: new Date()
      };
      
      const updatedDoc = { ...mockResumeDoc, ...updates };
      
      mockContainer.item.mockReturnValue({
        read: jest.fn().mockResolvedValue({
          resource: mockResumeDoc,
          statusCode: 200
        }),
        replace: jest.fn().mockResolvedValue({
          resource: updatedDoc,
          statusCode: 200
        })
      });

      // Act
      const result = await repository.update(documentId, updates);

      // Assert
      expect(result).toBeRepositoryResult(true);
      expect(result.data).toEqual(updatedDoc);
      expect(result.data?.atsScore).toBe(90);
      expect(result.data?.processingTime).toBe(1500);
    });

    it('should return error when document not found for update', async () => {
      // Arrange
      const documentId = 'non-existent-id';
      
      mockContainer.item.mockReturnValue({
        read: jest.fn().mockResolvedValue({
          resource: undefined,
          statusCode: 404
        })
      });

      // Act
      const result = await repository.update(documentId, { atsScore: 90 });

      // Assert
      expect(result).toBeRepositoryResult(false);
      expect(result.error).toContain('not found');
    });

    it('should handle update conflicts gracefully', async () => {
      // Arrange
      const documentId = 'test-resume-123';
      
      mockContainer.item.mockReturnValue({
        read: jest.fn().mockResolvedValue({
          resource: mockResumeDoc,
          statusCode: 200
        }),
        replace: jest.fn().mockRejectedValue(
          new Error('Conflict: Document was modified')
        )
      });

      // Act
      const result = await repository.update(documentId, { atsScore: 90 });

      // Assert
      expect(result).toBeRepositoryResult(false);
      expect(result.error).toContain('Conflict: Document was modified');
    });
  });

  describe('delete', () => {
    it('should delete a document successfully', async () => {
      // Arrange
      const documentId = 'test-resume-123';
      
      mockContainer.item.mockReturnValue({
        read: jest.fn().mockResolvedValue({
          resource: mockResumeDoc,
          statusCode: 200
        }),
        delete: jest.fn().mockResolvedValue({
          statusCode: 204
        })
      });

      // Act
      const result = await repository.delete(documentId);

      // Assert
      expect(result).toBeRepositoryResult(true);
      expect(result.data).toBe(true);
    });

    it('should return false when document not found for deletion', async () => {
      // Arrange
      const documentId = 'non-existent-id';
      
      mockContainer.item.mockReturnValue({
        read: jest.fn().mockResolvedValue({
          resource: undefined,
          statusCode: 404
        })
      });

      // Act
      const result = await repository.delete(documentId);

      // Assert
      expect(result).toBeRepositoryResult(true);
      expect(result.data).toBe(false);
    });

    it('should handle deletion errors gracefully', async () => {
      // Arrange
      const documentId = 'test-resume-123';
      
      mockContainer.item.mockReturnValue({
        read: jest.fn().mockResolvedValue({
          resource: mockResumeDoc,
          statusCode: 200
        }),
        delete: jest.fn().mockRejectedValue(
          new Error('Deletion failed')
        )
      });

      // Act
      const result = await repository.delete(documentId);

      // Assert
      expect(result).toBeRepositoryResult(false);
      expect(result.error).toContain('Deletion failed');
    });
  });

  describe('count', () => {
    it('should count documents with query conditions', async () => {
      // Arrange
      const queryOptions = {
        where: { userId: 'test-user-123' }
      };
      
      mockContainer.items.query.mockReturnValue({
        fetchAll: jest.fn().mockResolvedValue({
          resources: [{ $1: 5 }]
        })
      });

      // Act
      const result = await repository.count(queryOptions);

      // Assert
      expect(result).toBeRepositoryResult(true);
      expect(result.data).toBe(5);
      expect(mockContainer.items.query).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.stringContaining('SELECT VALUE COUNT(1)')
        })
      );
    });

    it('should count all documents when no conditions provided', async () => {
      // Arrange
      mockContainer.items.query.mockReturnValue({
        fetchAll: jest.fn().mockResolvedValue({
          resources: [{ $1: 10 }]
        })
      });

      // Act
      const result = await repository.count();

      // Assert
      expect(result).toBeRepositoryResult(true);
      expect(result.data).toBe(10);
    });
  });

  describe('exists', () => {
    it('should return true when document exists', async () => {
      // Arrange
      const documentId = 'test-resume-123';
      
      mockContainer.item.mockReturnValue({
        read: jest.fn().mockResolvedValue({
          resource: mockResumeDoc,
          statusCode: 200
        })
      });

      // Act
      const result = await repository.exists(documentId);

      // Assert
      expect(result).toBeRepositoryResult(true);
      expect(result.data).toBe(true);
    });

    it('should return false when document does not exist', async () => {
      // Arrange
      const documentId = 'non-existent-id';
      
      mockContainer.item.mockReturnValue({
        read: jest.fn().mockResolvedValue({
          resource: undefined,
          statusCode: 404
        })
      });

      // Act
      const result = await repository.exists(documentId);

      // Assert
      expect(result).toBeRepositoryResult(true);
      expect(result.data).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      // Arrange
      mockContainer.items.create.mockRejectedValue(
        new Error('Network error: Connection timeout')
      );

      // Act
      const result = await repository.create(testUtils.generateMockResumeDocument());

      // Assert
      expect(result).toBeRepositoryResult(false);
      expect(result.error).toContain('Network error');
    });

    it('should handle Cosmos DB specific errors', async () => {
      // Arrange
      const cosmosError = new Error('RequestRateTooLarge');
      (cosmosError as any).code = 429;
      
      mockContainer.items.create.mockRejectedValue(cosmosError);

      // Act
      const result = await repository.create(testUtils.generateMockResumeDocument());

      // Assert
      expect(result).toBeRepositoryResult(false);
      expect(result.error).toContain('RequestRateTooLarge');
    });
  });

  describe('performance optimization', () => {
    it('should use partition key for optimal queries', async () => {
      // Arrange
      const userId = 'test-user-123';
      
      mockContainer.items.query.mockReturnValue({
        fetchAll: jest.fn().mockResolvedValue({
          resources: [mockResumeDoc]
        })
      });

      // Act
      await repository.findMany({
        where: { userId },
        limit: 10
      });

      // Assert
      expect(mockContainer.items.query).toHaveBeenCalledWith(
        expect.objectContaining({
          partitionKey: userId
        })
      );
    });

    it('should limit query results to prevent large responses', async () => {
      // Act
      await repository.findMany({
        limit: 1000 // Large limit
      });

      // Assert
      expect(mockContainer.items.query).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.stringContaining('TOP 100') // Should be capped
        })
      );
    });
  });
});