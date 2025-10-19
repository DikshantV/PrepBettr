/**
 * Cosmos DB Usage Repository Implementation
 * Provides CRUD operations for usage tracking documents in Azure Cosmos DB
 */

import { CosmosClient, Container, Database } from '@azure/cosmos';
import { IUsageRepository } from '../interfaces/IRepositories';
import { IUsageDocument } from '../interfaces/IDocuments';
import { RepositoryResult } from '../interfaces/RepositoryResult';
import { IQueryOptions } from '../interfaces/IRepositories';

export class CosmosUsageRepository implements IUsageRepository<IUsageDocument> {
  private client: CosmosClient;
  private database: Database;
  private container: Container;
  private databaseId: string;
  private containerId: string = 'usage';

  constructor(client: CosmosClient, databaseId: string) {
    this.client = client;
    this.databaseId = databaseId;
    this.database = client.database(databaseId);
    this.container = this.database.container(this.containerId);
  }

  /**
   * Create a new usage document
   */
  async create(data: Omit<IUsageDocument, 'id'>): Promise<RepositoryResult<IUsageDocument>> {
    try {
      // Generate ID if not provided
      const documentToCreate: IUsageDocument = {
        ...data,
        id: this.generateId(),
        createdDate: new Date().toISOString(),
        updatedDate: new Date().toISOString()
      };

      // Validate required fields
      this.validateUsageDocument(documentToCreate);

      // Create document in Cosmos DB
      const { resource } = await this.container.items.create(documentToCreate);

      return {
        success: true,
        data: resource as IUsageDocument
      };
    } catch (error) {
      console.error('CosmosUsageRepository create error:', error);
      
      return {
        success: false,
        error: this.handleError(error),
        data: null
      };
    }
  }

  /**
   * Find a usage document by ID
   */
  async findById(id: string): Promise<RepositoryResult<IUsageDocument | null>> {
    try {
      const query = `SELECT * FROM c WHERE c.id = "${id}"`;
      const { resources } = await this.container.items.query(query).fetchAll();
      
      if (resources.length === 0) {
        return {
          success: true,
          data: null
        };
      }

      const document = resources[0] as IUsageDocument;
      
      return {
        success: true,
        data: document
      };
    } catch (error) {
      console.error('CosmosUsageRepository findById error:', error);
      
      return {
        success: false,
        error: this.handleError(error),
        data: null
      };
    }
  }

  /**
   * Find multiple usage documents with optional filtering and pagination
   */
  async findMany(
    conditions: Partial<IUsageDocument> = {},
    options: IQueryOptions = {}
  ): Promise<RepositoryResult<IUsageDocument[]>> {
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
      let results = resources as IUsageDocument[];
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
      console.error('CosmosUsageRepository findMany error:', error);
      
      return {
        success: false,
        error: this.handleError(error),
        data: []
      };
    }
  }

  /**
   * Update a usage document
   */
  async update(id: string, updates: Partial<IUsageDocument>): Promise<RepositoryResult<IUsageDocument>> {
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
      const updatedDocument: IUsageDocument = {
        ...existingDocument,
        ...updates,
        id, // Ensure ID doesn't change
        updatedDate: new Date().toISOString()
      };

      // Validate the updated document
      this.validateUsageDocument(updatedDocument);

      // Replace the document
      const { resource } = await this.container.item(id, existingDocument.userId).replace(updatedDocument);

      return {
        success: true,
        data: resource as IUsageDocument
      };
    } catch (error) {
      console.error('CosmosUsageRepository update error:', error);
      
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
   * Delete a usage document
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
      console.error('CosmosUsageRepository delete error:', error);
      
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
  async count(conditions: Partial<IUsageDocument> = {}): Promise<RepositoryResult<number>> {
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
      console.error('CosmosUsageRepository count error:', error);
      
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
      console.error('CosmosUsageRepository exists error:', error);
      
      return {
        success: false,
        error: this.handleError(error),
        data: false
      };
    }
  }

  /**
   * Get usage statistics for a user
   */
  async getUserUsageStats(userId: string): Promise<{
    totalUsage: number;
    usageByFeature: Record<string, number>;
    usageByDate: Record<string, number>;
    averageUsagePerDay: number;
  }> {
    try {
      // Get total usage for user
      const totalResult = await this.count({ userId });
      const totalUsage = totalResult.data || 0;

      // Get usage by feature
      const featureQuery = `
        SELECT c.feature, SUM(c.count) as total 
        FROM c 
        WHERE c.userId = @userId 
        GROUP BY c.feature
      `;
      const { resources: featureResources } = await this.container.items.query({
        query: featureQuery,
        parameters: [{ name: '@userId', value: userId }]
      }).fetchAll();

      const usageByFeature: Record<string, number> = {};
      featureResources.forEach((item: any) => {
        usageByFeature[item.feature] = item.total;
      });

      // Get usage by date (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const dateQuery = `
        SELECT c.date, SUM(c.count) as total 
        FROM c 
        WHERE c.userId = @userId AND c.createdAt >= @thirtyDaysAgo
        GROUP BY c.date
      `;
      const { resources: dateResources } = await this.container.items.query({
        query: dateQuery,
        parameters: [
          { name: '@userId', value: userId },
          { name: '@thirtyDaysAgo', value: thirtyDaysAgo.toISOString() }
        ]
      }).fetchAll();

      const usageByDate: Record<string, number> = {};
      dateResources.forEach((item: any) => {
        usageByDate[item.date] = item.total;
      });

      const averageUsagePerDay = Object.keys(usageByDate).length > 0 
        ? Object.values(usageByDate).reduce((sum, count) => sum + count, 0) / Object.keys(usageByDate).length
        : 0;

      return {
        totalUsage,
        usageByFeature,
        usageByDate,
        averageUsagePerDay
      };
    } catch (error) {
      console.error('CosmosUsageRepository getUserUsageStats error:', error);
      return {
        totalUsage: 0,
        usageByFeature: {},
        usageByDate: {},
        averageUsagePerDay: 0
      };
    }
  }

  /**
   * Increment usage count for a user and feature
   */
  async incrementUsage(userId: string, feature: string, count: number = 1): Promise<RepositoryResult<IUsageDocument>> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Try to find existing usage record for today
      const existingUsageQuery = `
        SELECT * FROM c 
        WHERE c.userId = @userId AND c.feature = @feature AND c.date = @date
      `;
      const { resources } = await this.container.items.query({
        query: existingUsageQuery,
        parameters: [
          { name: '@userId', value: userId },
          { name: '@feature', value: feature },
          { name: '@date', value: today }
        ]
      }).fetchAll();

      if (resources.length > 0) {
        // Update existing record
        const existingDocument = resources[0] as IUsageDocument;
        return await this.update(existingDocument.id, {
          count: existingDocument.count + count
        });
      } else {
        // Create new usage record
        return await this.create({
          userId,
          feature,
          date: today,
          count,
          metadata: {},
          createdDate: new Date().toISOString(),
          updatedDate: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('CosmosUsageRepository incrementUsage error:', error);
      
      return {
        success: false,
        error: this.handleError(error),
        data: null
      };
    }
  }

  /**
   * Validate usage document structure
   */
  private validateUsageDocument(document: IUsageDocument): void {
    if (!document.userId) {
      throw new Error('userId is required');
    }
    if (!document.feature) {
      throw new Error('feature is required');
    }
    if (!document.date) {
      throw new Error('date is required');
    }
    if (typeof document.count !== 'number' || document.count < 0) {
      throw new Error('count must be a non-negative number');
    }
  }

  /**
   * Generate a unique ID for new documents
   */
  private generateId(): string {
    return `usage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
}