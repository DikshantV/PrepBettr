/**
 * Azure Cosmos DB Service Implementation
 * 
 * Replaces Firebase Firestore with Azure Cosmos DB
 * Implements IDocumentService interface for provider-agnostic usage
 */

import { CosmosClient, Database, Container, FeedOptions, SqlQuerySpec } from '@azure/cosmos';
import { 
  IDocumentService, 
  DatabaseDocument, 
  QueryOptions, 
  QueryFilter 
} from '../../shared/interfaces';
import { BaseDocumentService } from '../../shared/interfaces/base-services';
import { getConfigManager } from '../../config/unified-config';

interface CosmosDocument {
  id: string;
  [key: string]: any;
  _ts?: number; // Cosmos DB timestamp
  _etag?: string; // Cosmos DB etag
}

export class CosmosDBService extends BaseDocumentService {
  private client?: CosmosClient;
  private database?: Database;
  private containers: Map<string, Container> = new Map();
  
  constructor() {
    super('azure');
  }
  
  /**
   * Initialize Cosmos DB client and database
   */
  protected async initialize(): Promise<void> {
    try {
      const configManager = await getConfigManager();
      const cosmosConfig = configManager.getServiceConfig('cosmosdb', 'azure');
      
      if (!cosmosConfig.enabled) {
        throw new Error('Cosmos DB service is not enabled');
      }
      
      const { endpoint, key, databaseName, consistencyLevel } = cosmosConfig.config;
      
      if (!endpoint || !key) {
        throw new Error('Cosmos DB endpoint and key are required');
      }
      
      // Initialize Cosmos client
      this.client = new CosmosClient({
        endpoint,
        key,
        connectionPolicy: {
          requestTimeout: 30000,
          retryOptions: {
            maxRetryAttemptCount: 3,
            fixedRetryIntervalInMilliseconds: 1000
          }
        },
        consistencyLevel: consistencyLevel || 'Session'
      });
      
      // Create database if it doesn't exist
      const { database } = await this.client.databases.createIfNotExists({
        id: databaseName || 'prepbettr'
      });
      
      this.database = database;
      
      this.logSuccess('initialize', { 
        endpoint: endpoint.replace(/\/\/[^\/]+/, '//***'), 
        database: databaseName 
      });
    } catch (error) {
      this.handleError(error, 'initialize');
    }
  }
  
  /**
   * Get container instance, create if not exists
   */
  private async getContainer(collectionName: string): Promise<Container> {
    await this.ensureInitialized();
    
    if (!this.database) {
      throw new Error('Database not initialized');
    }
    
    if (this.containers.has(collectionName)) {
      return this.containers.get(collectionName)!;
    }
    
    try {
      // Create container with partition key /userId for most collections
      const partitionKey = this.getPartitionKey(collectionName);
      
      const { container } = await this.database.containers.createIfNotExists({
        id: collectionName,
        partitionKey: { paths: [partitionKey] },
        indexingPolicy: {
          automatic: true,
          includedPaths: [{ path: "/*" }],
          excludedPaths: [{ path: "/\"_etag\"/?" }]
        }
      });
      
      this.containers.set(collectionName, container);
      return container;
    } catch (error) {
      this.handleError(error, 'getContainer', { collection: collectionName });
    }
  }
  
  /**
   * Determine partition key based on collection name
   */
  private getPartitionKey(collectionName: string): string {
    // Map collections to appropriate partition keys
    switch (collectionName) {
      case 'users':
      case 'interviews':
      case 'resumes':
      case 'applications':
        return '/userId';
      case 'community-interviews':
      case 'public-data':
        return '/id';
      default:
        return '/userId'; // Default partition key
    }
  }
  
  /**
   * Get single document
   */
  async get(collection: string, documentId: string): Promise<DatabaseDocument | null> {
    try {
      this.validateNames(collection, documentId);
      const container = await this.getContainer(collection);
      
      const { resource } = await container.item(documentId, this.getPartitionKeyValue(documentId)).read();
      
      if (!resource) {
        return null;
      }
      
      return this.convertToStandardDocument(resource);
    } catch (error: any) {
      if (error.code === 404) {
        return null;
      }
      this.handleError(error, 'get', { collection, documentId });
    }
  }
  
  /**
   * Create new document
   */
  async create(collection: string, data: Record<string, any>, documentId?: string): Promise<string> {
    try {
      this.validateNames(collection, documentId);
      const container = await this.getContainer(collection);
      
      const id = documentId || this.generateDocumentId();
      const documentData = {
        id,
        ...this.addMetadata(data, false),
        // Add partition key value if not present
        ...(this.needsPartitionKeyValue(collection, data) && { 
          userId: data.userId || id 
        })
      };
      
      const { resource } = await container.items.create(documentData);
      
      this.logSuccess('create', { collection, documentId: id });
      return resource!.id;
    } catch (error) {
      this.handleError(error, 'create', { collection, documentId });
    }
  }
  
  /**
   * Update existing document
   */
  async update(collection: string, documentId: string, data: Record<string, any>): Promise<void> {
    try {
      this.validateNames(collection, documentId);
      const container = await this.getContainer(collection);
      
      // Get existing document first
      const { resource: existingDoc } = await container.item(documentId, this.getPartitionKeyValue(documentId)).read();
      
      if (!existingDoc) {
        throw new Error('Document not found');
      }
      
      // Merge with existing data
      const updatedData = {
        ...existingDoc,
        ...this.addMetadata(data, true)
      };
      
      await container.item(documentId, this.getPartitionKeyValue(documentId)).replace(updatedData);
      
      this.logSuccess('update', { collection, documentId });
    } catch (error) {
      this.handleError(error, 'update', { collection, documentId });
    }
  }
  
  /**
   * Delete document
   */
  async delete(collection: string, documentId: string): Promise<void> {
    try {
      this.validateNames(collection, documentId);
      const container = await this.getContainer(collection);
      
      await container.item(documentId, this.getPartitionKeyValue(documentId)).delete();
      
      this.logSuccess('delete', { collection, documentId });
    } catch (error: any) {
      if (error.code !== 404) { // Ignore not found errors
        this.handleError(error, 'delete', { collection, documentId });
      }
    }
  }
  
  /**
   * Query documents with filters
   */
  async query(collection: string, options?: QueryOptions): Promise<DatabaseDocument[]> {
    try {
      this.validateNames(collection);
      const container = await this.getContainer(collection);
      
      const querySpec = this.buildSqlQuery(collection, options);
      const feedOptions: FeedOptions = {
        maxItemCount: options?.limit || -1
      };
      
      const { resources } = await container.items.query(querySpec, feedOptions).fetchAll();
      
      return resources.map(doc => this.convertToStandardDocument(doc));
    } catch (error) {
      this.handleError(error, 'query', { collection, options });
    }
  }
  
  /**
   * Subscribe to document changes (using polling - Cosmos DB doesn't have real-time like Firestore)
   */
  subscribe(
    collection: string, 
    documentId: string,
    callback: (doc: DatabaseDocument | null) => void
  ): () => void {
    let polling = true;
    let lastEtag: string | undefined;
    
    const poll = async () => {
      if (!polling) return;
      
      try {
        const container = await this.getContainer(collection);
        const { resource, headers } = await container.item(documentId, this.getPartitionKeyValue(documentId)).read();
        
        const currentEtag = headers.etag as string;
        if (currentEtag !== lastEtag) {
          lastEtag = currentEtag;
          callback(resource ? this.convertToStandardDocument(resource) : null);
        }
      } catch (error: any) {
        if (error.code === 404) {
          callback(null);
        } else {
          console.error('Subscription polling error:', error);
        }
      }
      
      // Poll every 2 seconds (adjust as needed)
      setTimeout(poll, 2000);
    };
    
    poll();
    
    // Return unsubscribe function
    return () => {
      polling = false;
    };
  }
  
  /**
   * Subscribe to query changes (using polling)
   */
  subscribeToQuery(
    collection: string,
    options: QueryOptions,
    callback: (docs: DatabaseDocument[]) => void
  ): () => void {
    let polling = true;
    let lastResults: string | undefined;
    
    const poll = async () => {
      if (!polling) return;
      
      try {
        const docs = await this.query(collection, options);
        const resultsHash = JSON.stringify(docs.map(d => ({ id: d.id, updatedAt: d.updatedAt })));
        
        if (resultsHash !== lastResults) {
          lastResults = resultsHash;
          callback(docs);
        }
      } catch (error) {
        console.error('Query subscription polling error:', error);
      }
      
      // Poll every 5 seconds for queries
      setTimeout(poll, 5000);
    };
    
    poll();
    
    return () => {
      polling = false;
    };
  }
  
  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      await this.ensureInitialized();
      
      if (!this.database) {
        return { healthy: false, message: 'Database not initialized' };
      }
      
      // Simple read operation to test connectivity
      await this.database.read();
      
      return { healthy: true };
    } catch (error) {
      return { 
        healthy: false, 
        message: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
  
  // ===== PRIVATE HELPER METHODS =====
  
  /**
   * Convert Cosmos document to standard format
   */
  protected convertToStandardDocument(cosmosDoc: CosmosDocument): DatabaseDocument {
    const { id, _ts, _etag, ...data } = cosmosDoc;
    
    return {
      id,
      data,
      createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
      updatedAt: data.updatedAt ? new Date(data.updatedAt) : (_ts ? new Date(_ts * 1000) : undefined)
    };
  }
  
  /**
   * Build SQL query from QueryOptions
   */
  private buildSqlQuery(collection: string, options?: QueryOptions): SqlQuerySpec {
    let query = `SELECT * FROM c`;
    const parameters: any[] = [];
    
    if (options?.filters && options.filters.length > 0) {
      const whereConditions = options.filters.map((filter, index) => {
        const paramName = `@param${index}`;
        parameters.push({ name: paramName, value: filter.value });
        
        return `c.${filter.field} ${this.mapOperator(filter.operator)} ${paramName}`;
      });
      
      query += ` WHERE ${whereConditions.join(' AND ')}`;
    }
    
    if (options?.orderBy && options.orderBy.length > 0) {
      const orderClauses = options.orderBy.map(order => 
        `c.${order.field} ${order.direction.toUpperCase()}`
      );
      query += ` ORDER BY ${orderClauses.join(', ')}`;
    }
    
    if (options?.limit) {
      query += ` OFFSET ${options.offset || 0} LIMIT ${options.limit}`;
    }
    
    return { query, parameters };
  }
  
  /**
   * Map Firebase operators to Cosmos DB SQL operators
   */
  private mapOperator(operator: string): string {
    switch (operator) {
      case '==': return '=';
      case '!=': return '!=';
      case '>': return '>';
      case '>=': return '>=';
      case '<': return '<';
      case '<=': return '<=';
      case 'in': return 'IN';
      case 'array-contains': return 'ARRAY_CONTAINS(c.{field}, @value)'; // Needs special handling
      default: return '=';
    }
  }
  
  /**
   * Generate document ID
   */
  private generateDocumentId(): string {
    return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Get partition key value for document operations
   */
  private getPartitionKeyValue(documentId: string): string {
    // For simplicity, use documentId as partition key value
    // In production, you'd use actual userId or appropriate partition value
    return documentId;
  }
  
  /**
   * Check if document needs partition key value added
   */
  private needsPartitionKeyValue(collection: string, data: Record<string, any>): boolean {
    const partitionKey = this.getPartitionKey(collection).replace('/', '');
    return !data[partitionKey];
  }
}

// ===== COSMOS DB MIGRATION UTILITIES =====

export class CosmosDBMigrationUtils {
  /**
   * Migrate Firestore collection to Cosmos DB
   */
  static async migrateCollection(
    firestoreService: IDocumentService,
    cosmosService: CosmosDBService,
    collectionName: string,
    options: {
      batchSize?: number;
      dryRun?: boolean;
      onProgress?: (processed: number, total: number) => void;
    } = {}
  ): Promise<{ success: boolean; migrated: number; errors: string[] }> {
    const { batchSize = 100, dryRun = false, onProgress } = options;
    
    try {
      console.log(`📦 Starting migration of collection: ${collectionName} (dryRun: ${dryRun})`);
      
      // Get all documents from Firestore
      const documents = await firestoreService.query(collectionName);
      const total = documents.length;
      let processed = 0;
      const errors: string[] = [];
      
      console.log(`📊 Found ${total} documents to migrate`);
      
      if (dryRun) {
        console.log(`🧪 DRY RUN: Would migrate ${total} documents`);
        return { success: true, migrated: 0, errors: [] };
      }
      
      // Process in batches
      for (let i = 0; i < documents.length; i += batchSize) {
        const batch = documents.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (doc) => {
          try {
            await cosmosService.create(collectionName, doc.data, doc.id);
            processed++;
            
            if (processed % 50 === 0) {
              console.log(`📈 Progress: ${processed}/${total} documents migrated`);
            }
          } catch (error) {
            const errorMsg = `Document ${doc.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
            errors.push(errorMsg);
            console.error(`❌ Migration error:`, errorMsg);
          }
        });
        
        await Promise.all(batchPromises);
        
        if (onProgress) {
          onProgress(processed, total);
        }
        
        // Small delay between batches to avoid overwhelming Cosmos DB
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const success = errors.length === 0;
      console.log(`${success ? '✅' : '⚠️'} Migration completed: ${processed}/${total} documents migrated, ${errors.length} errors`);
      
      return { success, migrated: processed, errors };
    } catch (error) {
      console.error(`❌ Collection migration failed:`, error);
      return { 
        success: false, 
        migrated: 0, 
        errors: [error instanceof Error ? error.message : 'Unknown error'] 
      };
    }
  }
  
  /**
   * Validate migration by comparing document counts and sample data
   */
  static async validateMigration(
    firestoreService: IDocumentService,
    cosmosService: CosmosDBService,
    collectionName: string,
    sampleSize: number = 10
  ): Promise<{ valid: boolean; details: Record<string, any> }> {
    try {
      const [firestoreDocs, cosmosDocs] = await Promise.all([
        firestoreService.query(collectionName),
        cosmosService.query(collectionName)
      ]);
      
      const firestoreCount = firestoreDocs.length;
      const cosmosCount = cosmosDocs.length;
      
      // Check document counts
      const countMatches = firestoreCount === cosmosCount;
      
      // Sample document comparison
      const sampleComparisons: any[] = [];
      const sampleDocs = firestoreDocs.slice(0, Math.min(sampleSize, firestoreDocs.length));
      
      for (const firestoreDoc of sampleDocs) {
        const cosmosDoc = cosmosDocs.find(d => d.id === firestoreDoc.id);
        
        if (!cosmosDoc) {
          sampleComparisons.push({
            id: firestoreDoc.id,
            status: 'missing_in_cosmos'
          });
        } else {
          // Simple data comparison (exclude timestamps)
          const { createdAt, updatedAt, ...firestoreData } = firestoreDoc.data;
          const { createdAt: cosmosCreated, updatedAt: cosmosUpdated, ...cosmosData } = cosmosDoc.data;
          
          const dataMatches = JSON.stringify(firestoreData) === JSON.stringify(cosmosData);
          
          sampleComparisons.push({
            id: firestoreDoc.id,
            status: dataMatches ? 'match' : 'data_mismatch',
            ...(dataMatches ? {} : { 
              firestore_keys: Object.keys(firestoreData).length,
              cosmos_keys: Object.keys(cosmosData).length 
            })
          });
        }
      }
      
      const allSamplesMatch = sampleComparisons.every(c => c.status === 'match');
      
      return {
        valid: countMatches && allSamplesMatch,
        details: {
          counts: { firestore: firestoreCount, cosmos: cosmosCount, match: countMatches },
          sampleComparisons,
          sampleSize: sampleComparisons.length
        }
      };
    } catch (error) {
      return {
        valid: false,
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }
}
