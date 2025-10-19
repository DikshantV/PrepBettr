/**
 * Cosmos DB Resume Repository Implementation
 * Provides CRUD operations for resume documents in Azure Cosmos DB
 */

import { CosmosClient, Container, Database, ItemDefinition } from '@azure/cosmos';
import { IResumeRepository } from '../interfaces/IRepositories';
import { IResumeDocument } from '../interfaces/IDocuments';
import { RepositoryResult } from '../interfaces/RepositoryResult';
import { IQueryOptions } from '../interfaces/IRepositories';

export class CosmosResumeRepository implements IResumeRepository<IResumeDocument> {
  private client: CosmosClient;
  private database: Database;
  private container: Container;
  private databaseId: string;
  private containerId: string = 'resumes';

  constructor(client: CosmosClient, databaseId: string) {
    this.client = client;
    this.databaseId = databaseId;
    this.database = client.database(databaseId);
    this.container = this.database.container(this.containerId);
  }

  /**
   * Create a new resume document
   */
  async create(data: Omit<IResumeDocument, 'id'>): Promise<RepositoryResult<IResumeDocument>> {
    try {
      // Generate ID if not provided
      const documentToCreate: IResumeDocument = {
        id: this.generateId(),
        createdDate: new Date().toISOString(),
        updatedDate: new Date().toISOString(),
        ...data
      };

      // Validate required fields
      this.validateResumeDocument(documentToCreate);

      // Create document in Cosmos DB
      const { resource } = await this.container.items.create(documentToCreate);

      return {
        success: true,
        data: resource as IResumeDocument
      };
    } catch (error) {
      console.error('CosmosResumeRepository create error:', error);
      
      return {
        success: false,
        error: this.handleError(error),
        data: null
      };
    }
  }

  /**
   * Find a resume document by ID
   */
  async findById(id: string): Promise<RepositoryResult<IResumeDocument | null>> {
    try {
      // Extract userId from document for partition key
      // First try to get the document to find the userId
      const query = `SELECT * FROM c WHERE c.id = "${id}"`;
      const { resources } = await this.container.items.query(query).fetchAll();
      
      if (resources.length === 0) {
        return {
          success: true,
          data: null
        };
      }

      const document = resources[0] as IResumeDocument;
      
      return {
        success: true,
        data: document
      };
    } catch (error) {
      console.error('CosmosResumeRepository findById error:', error);
      
      return {
        success: false,
        error: this.handleError(error),
        data: null
      };
    }
  }

  /**
   * Find multiple resume documents with optional filtering and pagination
   */
  async findMany(
    conditions: Partial<IResumeDocument> = {},
    options: IQueryOptions = {}
  ): Promise<RepositoryResult<IResumeDocument[]>> {
    try {
      let query = 'SELECT * FROM c';
      const parameters: any[] = [];
      
      // Build WHERE clause from conditions
      if (Object.keys(conditions).length > 0) {
        const whereConditions: string[] = [];
        let paramIndex = 0;

        Object.entries(conditions).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            whereConditions.push(`c.${key} = @param${paramIndex}`);
            parameters.push({ name: `@param${paramIndex}`, value });
            paramIndex++;
          }
        });

        if (whereConditions.length > 0) {
          query += ` WHERE ${whereConditions.join(' AND ')}`;
        }
      }

      // Add ordering
      if (options.orderBy) {
        const direction = options.orderDirection === 'desc' ? 'DESC' : 'ASC';
        query += ` ORDER BY c.${options.orderBy} ${direction}`;
      }

      // Execute query with pagination
      const querySpec = {
        query,
        parameters
      };

      const queryOptions: any = {};
      if (options.limit) {
        queryOptions.maxItemCount = options.limit;
      }

      const { resources } = await this.container.items.query(querySpec, queryOptions).fetchAll();

      // Apply offset if specified
      let results = resources as IResumeDocument[];
      if (options.offset && options.offset > 0) {
        results = results.slice(options.offset);
      }

      // Apply limit after offset
      if (options.limit) {
        results = results.slice(0, options.limit);
      }

      return {
        success: true,
        data: results
      };
    } catch (error) {
      console.error('CosmosResumeRepository findMany error:', error);
      
      return {
        success: false,
        error: this.handleError(error),
        data: []
      };
    }
  }

  /**
   * Update a resume document
   */
  async update(id: string, updates: Partial<IResumeDocument>): Promise<RepositoryResult<IResumeDocument>> {
    try {
      // First get the existing document
      const existingResult = await this.findById(id);
      if (!existingResult.success || !existingResult.data) {
        return {
          success: false,
          error: 'Document not found',
          data: null
        };
      }

      const existingDocument = existingResult.data;
      
      // Merge updates
      const updatedDocument: IResumeDocument = {
        ...existingDocument,
        ...updates,
        id, // Ensure ID doesn't change
        updatedDate: new Date().toISOString()
      };

      // Validate the updated document
      this.validateResumeDocument(updatedDocument);

      // Replace the document
      const { resource } = await this.container.item(id, existingDocument.userId).replace(updatedDocument);

      return {
        success: true,
        data: resource as IResumeDocument
      };
    } catch (error) {
      console.error('CosmosResumeRepository update error:', error);
      
      if (error.code === 404) {
        return {
          success: false,
          error: 'Document not found',
          data: null
        };
      }

      if (error.code === 412) {
        return {
          success: false,
          error: 'Document was modified by another process',
          data: null
        };
      }

      return {
        success: false,
        error: this.handleError(error),
        data: null
      };
    }
  }

  /**
   * Delete a resume document
   */
  async delete(id: string): Promise<RepositoryResult<boolean>> {
    try {
      // First get the document to find the partition key
      const existingResult = await this.findById(id);
      if (!existingResult.success || !existingResult.data) {
        return {
          success: false,
          error: 'Document not found',
          data: false
        };
      }

      const existingDocument = existingResult.data;
      
      // Delete the document
      await this.container.item(id, existingDocument.userId).delete();

      return {
        success: true,
        data: true
      };
    } catch (error) {
      console.error('CosmosResumeRepository delete error:', error);
      
      if (error.code === 404) {
        return {
          success: false,
          error: 'Document not found',
          data: false
        };
      }

      return {
        success: false,
        error: this.handleError(error),
        data: false
      };
    }
  }

  /**
   * Count documents matching the given conditions
   */
  async count(conditions: Partial<IResumeDocument> = {}): Promise<RepositoryResult<number>> {
    try {
      let query = 'SELECT VALUE COUNT(1) FROM c';
      const parameters: any[] = [];

      // Build WHERE clause from conditions
      if (Object.keys(conditions).length > 0) {
        const whereConditions: string[] = [];
        let paramIndex = 0;

        Object.entries(conditions).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            whereConditions.push(`c.${key} = @param${paramIndex}`);
            parameters.push({ name: `@param${paramIndex}`, value });
            paramIndex++;
          }
        });

        if (whereConditions.length > 0) {
          query += ` WHERE ${whereConditions.join(' AND ')}`;
        }
      }

      const querySpec = {
        query,
        parameters
      };

      const { resources } = await this.container.items.query(querySpec).fetchAll();
      const count = resources[0] || 0;

      return {
        success: true,
        data: count
      };
    } catch (error) {
      console.error('CosmosResumeRepository count error:', error);
      
      return {
        success: false,
        error: this.handleError(error),
        data: 0
      };
    }
  }

  /**
   * Check if a document exists
   */
  async exists(id: string): Promise<RepositoryResult<boolean>> {
    try {
      const result = await this.findById(id);
      return {
        success: true,
        data: result.success && result.data !== null
      };
    } catch (error) {
      console.error('CosmosResumeRepository exists error:', error);
      
      return {
        success: false,
        error: this.handleError(error),
        data: false
      };
    }
  }

  /**
   * Validate resume document structure
   */
  private validateResumeDocument(document: IResumeDocument): void {
    if (!document.userId) {
      throw new Error('userId is required');
    }
    if (!document.fileName) {
      throw new Error('fileName is required');
    }
    if (!document.uploadDate) {
      throw new Error('uploadDate is required');
    }
  }

  /**
   * Generate a unique ID for new documents
   */
  private generateId(): string {
    return `resume_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Handle and format errors consistently
   */
  private handleError(error: any): string {
    if (error.code === 403) {
      return 'Access denied - check Cosmos DB permissions';
    }
    if (error.code === 429) {
      return 'Request rate too large - Cosmos DB throttling';
    }
    if (error.code === 408) {
      return 'Request timeout - Cosmos DB connection timeout';
    }
    
    return error.message || 'Unknown Cosmos DB error';
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<{
    totalDocuments: number;
    averageAtsScore: number;
    documentsByUser: Record<string, number>;
  }> {
    try {
      // Get total documents
      const totalResult = await this.count();
      const totalDocuments = totalResult.data || 0;

      // Get average ATS score
      const avgQuery = 'SELECT VALUE AVG(c.atsScore) FROM c WHERE IS_NUMBER(c.atsScore)';
      const { resources: avgResources } = await this.container.items.query(avgQuery).fetchAll();
      const averageAtsScore = avgResources[0] || 0;

      // Get documents by user
      const userQuery = 'SELECT c.userId, COUNT(1) as count FROM c GROUP BY c.userId';
      const { resources: userResources } = await this.container.items.query(userQuery).fetchAll();
      
      const documentsByUser: Record<string, number> = {};
      userResources.forEach((item: any) => {
        documentsByUser[item.userId] = item.count;
      });

      return {
        totalDocuments,
        averageAtsScore,
        documentsByUser
      };
    } catch (error) {
      console.error('CosmosResumeRepository getStats error:', error);
      return {
        totalDocuments: 0,
        averageAtsScore: 0,
        documentsByUser: {}
      };
    }
  }
}