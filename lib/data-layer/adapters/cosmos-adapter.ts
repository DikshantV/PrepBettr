/**
 * Azure Cosmos DB Data Adapter
 * 
 * Implements the unified data layer interface for Azure Cosmos DB.
 * Follows SOLID principles with dependency injection and proper error handling.
 */

import { CosmosClient, Container, Database } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
import { 
  IDataStoreProvider,
  IResumeRepository,
  IInterviewRepository,
  IUsageRepository,
  IUserConsentRepository,
  IAuditLogRepository,
  INotificationRepository,
  IPaymentRepository,
  QuerySpec,
  DataStoreConfig,
  DataStoreError,
  DocumentNotFoundError,
  ConflictError,
  ResumeDocument,
  InterviewDocument,
  UsageDocument,
  UserConsentDocument,
  AuditLogDocument,
  NotificationEventDocument,
  PaymentDocument,
  BaseDocument
} from '../interfaces';
import { unifiedConfigService } from '@/lib/services/unified-config-service';
import { logServerError } from '@/lib/errors';

// =============================================================================
// Base Repository Implementation
// =============================================================================

abstract class BaseCosmosRepository<T extends BaseDocument> {
  constructor(
    protected container: Container,
    protected containerName: string
  ) {}

  async create(data: Omit<T, 'id' | '_partitionKey'>): Promise<string> {
    try {
      const id = this.generateId();
      const document: T = {
        id,
        ...data,
        _partitionKey: (data as any).userId,
        createdAt: new Date(),
        updatedAt: new Date()
      } as T;

      const { resource } = await this.container.items.create(document);
      return resource!.id;
    } catch (error: any) {
      if (error.code === 409) {
        throw new ConflictError(id, this.containerName);
      }
      throw new DataStoreError(
        `Failed to create document in ${this.containerName}`,
        'CREATE_FAILED',
        { error: error.message },
        this.isRetryableError(error)
      );
    }
  }

  async get(id: string, partitionKey: string): Promise<T | null> {
    try {
      const { resource } = await this.container.item(id, partitionKey).read<T>();
      return resource || null;
    } catch (error: any) {
      if (error.code === 404) {
        return null;
      }
      throw new DataStoreError(
        `Failed to get document ${id} from ${this.containerName}`,
        'GET_FAILED',
        { error: error.message },
        this.isRetryableError(error)
      );
    }
  }

  async update(id: string, partitionKey: string, updates: Partial<T>): Promise<void> {
    try {
      const { resource: existing } = await this.container.item(id, partitionKey).read<T>();
      if (!existing) {
        throw new DocumentNotFoundError(id, this.containerName);
      }

      const updated = {
        ...existing,
        ...updates,
        updatedAt: new Date(),
        _partitionKey: partitionKey
      };

      await this.container.item(id, partitionKey).replace(updated);
    } catch (error: any) {
      if (error.code === 404) {
        throw new DocumentNotFoundError(id, this.containerName);
      }
      throw new DataStoreError(
        `Failed to update document ${id} in ${this.containerName}`,
        'UPDATE_FAILED',
        { error: error.message },
        this.isRetryableError(error)
      );
    }
  }

  async delete(id: string, partitionKey: string): Promise<void> {
    try {
      await this.container.item(id, partitionKey).delete();
    } catch (error: any) {
      if (error.code === 404) {
        // Document already deleted, ignore
        return;
      }
      throw new DataStoreError(
        `Failed to delete document ${id} from ${this.containerName}`,
        'DELETE_FAILED',
        { error: error.message },
        this.isRetryableError(error)
      );
    }
  }

  async query(querySpec: QuerySpec, partitionKey?: string): Promise<T[]> {
    try {
      const options = partitionKey ? { partitionKey } : {};
      const { resources } = await this.container.items
        .query<T>(querySpec, options)
        .fetchAll();
      return resources;
    } catch (error: any) {
      throw new DataStoreError(
        `Failed to query documents from ${this.containerName}`,
        'QUERY_FAILED',
        { error: error.message, query: querySpec.query },
        this.isRetryableError(error)
      );
    }
  }

  async batchCreate(documents: Omit<T, '_partitionKey'>[]): Promise<void> {
    const batchSize = 25; // Cosmos DB batch limit
    
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      const promises = batch.map(doc => this.create(doc as Omit<T, 'id' | '_partitionKey'>));
      await Promise.all(promises);
    }
  }

  async batchDelete(ids: Array<{ id: string; partitionKey: string }>): Promise<void> {
    const batchSize = 25;
    
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      const promises = batch.map(({ id, partitionKey }) => 
        this.delete(id, partitionKey)
      );
      await Promise.all(promises);
    }
  }

  protected generateId(): string {
    return `${this.containerName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  protected isRetryableError(error: any): boolean {
    // Cosmos DB error codes that are retryable
    const retryableCodes = [429, 503, 408, 410, 500, 502, 503, 504];
    return retryableCodes.includes(error.code);
  }
}

// =============================================================================
// Repository Implementations
// =============================================================================

class CosmosResumeRepository extends BaseCosmosRepository<ResumeDocument> implements IResumeRepository {
  async getUserResumes(userId: string): Promise<ResumeDocument[]> {
    const querySpec: QuerySpec = {
      query: 'SELECT * FROM c WHERE c.userId = @userId ORDER BY c.uploadDate DESC',
      parameters: [{ name: '@userId', value: userId }]
    };
    return this.query(querySpec, userId);
  }

  async getUserLatestResume(userId: string): Promise<ResumeDocument | null> {
    const querySpec: QuerySpec = {
      query: 'SELECT * FROM c WHERE c.userId = @userId ORDER BY c.uploadDate DESC OFFSET 0 LIMIT 1',
      parameters: [{ name: '@userId', value: userId }]
    };
    const results = await this.query(querySpec, userId);
    return results[0] || null;
  }

  async getResumesByProcessor(processorVersion: 'foundry-v1' | 'legacy-v1'): Promise<ResumeDocument[]> {
    const querySpec: QuerySpec = {
      query: 'SELECT * FROM c WHERE c.processorVersion = @version ORDER BY c.uploadDate DESC',
      parameters: [{ name: '@version', value: processorVersion }]
    };
    return this.query(querySpec);
  }

  async searchBySkills(skills: string[]): Promise<ResumeDocument[]> {
    const skillParams = skills.map((skill, index) => ({ name: `@skill${index}`, value: skill }));
    const skillConditions = skills.map((_, index) => `ARRAY_CONTAINS(c.extractedData.skills, @skill${index})`);
    
    const querySpec: QuerySpec = {
      query: `SELECT * FROM c WHERE ${skillConditions.join(' OR ')} ORDER BY c.atsScore DESC`,
      parameters: skillParams
    };
    return this.query(querySpec);
  }

  async getHighAtsScores(minScore: number): Promise<ResumeDocument[]> {
    const querySpec: QuerySpec = {
      query: 'SELECT * FROM c WHERE c.atsScore >= @minScore ORDER BY c.atsScore DESC',
      parameters: [{ name: '@minScore', value: minScore }]
    };
    return this.query(querySpec);
  }
}

class CosmosInterviewRepository extends BaseCosmosRepository<InterviewDocument> implements IInterviewRepository {
  async getUserInterviews(userId: string): Promise<InterviewDocument[]> {
    const querySpec: QuerySpec = {
      query: 'SELECT * FROM c WHERE c.userId = @userId ORDER BY c.createdAt DESC',
      parameters: [{ name: '@userId', value: userId }]
    };
    return this.query(querySpec, userId);
  }

  async getPublicInterviews(userId: string, limit: number = 20): Promise<InterviewDocument[]> {
    const querySpec: QuerySpec = {
      query: 'SELECT * FROM c WHERE c.userId = @userId AND c.finalized = true ORDER BY c.createdAt DESC OFFSET 0 LIMIT @limit',
      parameters: [
        { name: '@userId', value: userId },
        { name: '@limit', value: limit }
      ]
    };
    return this.query(querySpec, userId);
  }

  async getInterviewsByCompany(company: string): Promise<InterviewDocument[]> {
    const querySpec: QuerySpec = {
      query: 'SELECT * FROM c WHERE c.company = @company AND c.finalized = true ORDER BY c.createdAt DESC',
      parameters: [{ name: '@company', value: company }]
    };
    return this.query(querySpec);
  }

  async getFinalizedInterviews(userId: string): Promise<InterviewDocument[]> {
    const querySpec: QuerySpec = {
      query: 'SELECT * FROM c WHERE c.userId = @userId AND c.finalized = true ORDER BY c.createdAt DESC',
      parameters: [{ name: '@userId', value: userId }]
    };
    return this.query(querySpec, userId);
  }

  async searchByJobTitle(jobTitle: string): Promise<InterviewDocument[]> {
    const querySpec: QuerySpec = {
      query: 'SELECT * FROM c WHERE CONTAINS(c.jobTitle, @jobTitle) AND c.finalized = true ORDER BY c.createdAt DESC',
      parameters: [{ name: '@jobTitle', value: jobTitle }]
    };
    return this.query(querySpec);
  }
}

class CosmosUsageRepository extends BaseCosmosRepository<UsageDocument> implements IUsageRepository {
  async getUserUsage(userId: string): Promise<UsageDocument | null> {
    return this.get(userId, userId);
  }

  async initializeUserUsage(userId: string, plan: 'free' | 'premium'): Promise<void> {
    const limits = plan === 'free' ? { interviews: 3, resumes: 2 } : { interviews: 50, resumes: 10 };
    
    const usageData: Omit<UsageDocument, 'id' | '_partitionKey'> = {
      userId,
      interviews: { count: 0, limit: limits.interviews },
      resumes: { count: 0, limit: limits.resumes },
      plan,
      resetSchedule: plan === 'free' ? 'monthly' : 'never',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.create(usageData);
  }

  async incrementUsage(userId: string, type: 'interviews' | 'resumes'): Promise<void> {
    const existing = await this.get(userId, userId);
    if (!existing) {
      throw new DocumentNotFoundError(userId, 'usage');
    }

    const updates = {
      [type]: {
        ...existing[type],
        count: existing[type].count + 1
      }
    };

    await this.update(userId, userId, updates);
  }

  async checkUsageLimit(userId: string, type: 'interviews' | 'resumes'): Promise<boolean> {
    const usage = await this.getUserUsage(userId);
    if (!usage) {
      return false;
    }
    return usage[type].count < usage[type].limit;
  }

  async resetUsageCounters(userId: string): Promise<void> {
    const existing = await this.get(userId, userId);
    if (!existing) {
      return;
    }

    const updates = {
      interviews: { ...existing.interviews, count: 0, lastReset: new Date() },
      resumes: { ...existing.resumes, count: 0, lastReset: new Date() }
    };

    await this.update(userId, userId, updates);
  }

  async getUsersNearLimit(type: 'interviews' | 'resumes', threshold: number): Promise<UsageDocument[]> {
    const querySpec: QuerySpec = {
      query: `SELECT * FROM c WHERE (c.${type}.count / c.${type}.limit) >= @threshold`,
      parameters: [{ name: '@threshold', value: threshold }]
    };
    return this.query(querySpec);
  }
}

// Additional repository implementations for UserConsent, AuditLog, Notification, and Payment
// would follow the same pattern...

// =============================================================================
// Main Cosmos DB Data Store Provider
// =============================================================================

export class CosmosDataStoreProvider implements IDataStoreProvider {
  private client: CosmosClient | null = null;
  private database: Database | null = null;
  private containers: Map<string, Container> = new Map();
  private initialized = false;

  constructor(private config: DataStoreConfig) {}

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      console.log('🔧 Initializing Cosmos DB Data Store Provider...');

      // Get connection string from configuration or Key Vault
      let connectionString = this.config.connectionString;
      if (!connectionString) {
        connectionString = await this.getConnectionStringFromConfig();
      }

      if (!connectionString) {
        throw new Error('Cosmos DB connection string not available');
      }

      // Initialize Cosmos client
      this.client = new CosmosClient(connectionString);

      // Create or get database
      const { database } = await this.client.databases.createIfNotExists({
        id: this.config.databaseName || 'prepbettr'
      });
      this.database = database;

      // Initialize containers
      await this.initializeContainers();

      this.initialized = true;
      console.log('✅ Cosmos DB Data Store Provider initialized successfully');

    } catch (error) {
      console.error('❌ Failed to initialize Cosmos DB Data Store Provider:', error);
      throw new DataStoreError(
        'Failed to initialize Cosmos DB',
        'INITIALIZATION_FAILED',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  private async getConnectionStringFromConfig(): Promise<string | null> {
    try {
      // Try unified config service first
      return await unifiedConfigService.get('data.cosmos.connectionString', null);
    } catch (error) {
      // Fallback to environment variable
      return process.env.COSMOS_DB_CONNECTION_STRING || null;
    }
  }

  private async initializeContainers(): Promise<void> {
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    const containerDefinitions = [
      { id: 'resumes', partitionKey: '/userId' },
      { id: 'interviews', partitionKey: '/userId' },
      { id: 'usage', partitionKey: '/userId' },
      { id: 'userConsents', partitionKey: '/userId' },
      { id: 'auditLogs', partitionKey: '/userId', ttl: 7776000 }, // 90 days
      { id: 'notificationEvents', partitionKey: '/userId', ttl: 2592000 }, // 30 days
      { id: 'payments', partitionKey: '/userId' }
    ];

    for (const containerDef of containerDefinitions) {
      const options: any = {
        id: containerDef.id,
        partitionKey: containerDef.partitionKey
      };

      if (containerDef.ttl) {
        options.defaultTtl = containerDef.ttl;
      }

      const { container } = await this.database.containers.createIfNotExists(options);
      this.containers.set(containerDef.id, container);
    }
  }

  private getContainer(name: string): Container {
    const container = this.containers.get(name);
    if (!container) {
      throw new Error(`Container ${name} not found`);
    }
    return container;
  }

  // Repository factory methods
  getResumeRepository(): IResumeRepository {
    return new CosmosResumeRepository(this.getContainer('resumes'), 'resumes');
  }

  getInterviewRepository(): IInterviewRepository {
    return new CosmosInterviewRepository(this.getContainer('interviews'), 'interviews');
  }

  getUsageRepository(): IUsageRepository {
    return new CosmosUsageRepository(this.getContainer('usage'), 'usage');
  }

  getUserConsentRepository(): IUserConsentRepository {
    // Implementation would follow similar pattern
    throw new Error('Not implemented yet');
  }

  getAuditLogRepository(): IAuditLogRepository {
    // Implementation would follow similar pattern
    throw new Error('Not implemented yet');
  }

  getNotificationRepository(): INotificationRepository {
    // Implementation would follow similar pattern
    throw new Error('Not implemented yet');
  }

  getPaymentRepository(): IPaymentRepository {
    // Implementation would follow similar pattern
    throw new Error('Not implemented yet');
  }

  // Generic document operations
  async createDocument<T>(containerName: string, document: T): Promise<string> {
    const container = this.getContainer(containerName);
    const { resource } = await container.items.create(document);
    return resource!.id;
  }

  async getDocument<T>(containerName: string, id: string, partitionKey: string): Promise<T | null> {
    try {
      const container = this.getContainer(containerName);
      const { resource } = await container.item(id, partitionKey).read<T>();
      return resource || null;
    } catch (error: any) {
      if (error.code === 404) {
        return null;
      }
      throw error;
    }
  }

  async updateDocument<T>(containerName: string, id: string, partitionKey: string, updates: Partial<T>): Promise<void> {
    const container = this.getContainer(containerName);
    const { resource: existing } = await container.item(id, partitionKey).read();
    if (!existing) {
      throw new DocumentNotFoundError(id, containerName);
    }

    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date()
    };

    await container.item(id, partitionKey).replace(updated);
  }

  async deleteDocument(containerName: string, id: string, partitionKey: string): Promise<void> {
    const container = this.getContainer(containerName);
    await container.item(id, partitionKey).delete();
  }

  async queryDocuments<T>(containerName: string, querySpec: QuerySpec, partitionKey?: string): Promise<T[]> {
    const container = this.getContainer(containerName);
    const options = partitionKey ? { partitionKey } : {};
    const { resources } = await container.items.query<T>(querySpec, options).fetchAll();
    return resources;
  }

  // GDPR operations
  async deleteAllUserData(userId: string): Promise<string[]> {
    const deletedContainers: string[] = [];

    for (const [containerName] of this.containers) {
      try {
        // For usage container, delete direct user document
        if (containerName === 'usage') {
          await this.deleteDocument(containerName, userId, userId);
          deletedContainers.push(containerName);
          continue;
        }

        // For other containers, query and delete all user documents
        const querySpec: QuerySpec = {
          query: 'SELECT c.id FROM c WHERE c.userId = @userId',
          parameters: [{ name: '@userId', value: userId }]
        };

        const documents = await this.queryDocuments(containerName, querySpec, userId);
        
        if (documents.length > 0) {
          const deletePromises = documents.map((doc: any) => 
            this.deleteDocument(containerName, doc.id, userId)
          );
          await Promise.all(deletePromises);
          deletedContainers.push(containerName);
        }
      } catch (error) {
        console.error(`Failed to delete user data from ${containerName}:`, error);
        logServerError(error as Error, {
          action: 'deleteAllUserData',
          containerName,
          userId
        });
      }
    }

    return deletedContainers;
  }

  async healthCheck(): Promise<{ healthy: boolean; details: Record<string, any> }> {
    const details: Record<string, any> = {};
    let healthy = true;

    try {
      if (!this.initialized) {
        await this.initialize();
      }

      // Test database connectivity
      const querySpec: QuerySpec = {
        query: 'SELECT VALUE COUNT(1) FROM c',
        parameters: []
      };

      const testContainer = this.getContainer('usage');
      await testContainer.items.query(querySpec).fetchAll();
      
      details.cosmos = 'connected';
      details.containers = Array.from(this.containers.keys());
      details.database = this.config.databaseName || 'prepbettr';

    } catch (error) {
      healthy = false;
      details.cosmos = `error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }

    return { healthy, details };
  }

  async close(): Promise<void> {
    // Cosmos client doesn't require explicit closing
    this.initialized = false;
    this.containers.clear();
    this.client = null;
    this.database = null;
  }
}

// Export singleton factory
export const createCosmosDataStoreProvider = (config: DataStoreConfig): CosmosDataStoreProvider => {
  return new CosmosDataStoreProvider(config);
};