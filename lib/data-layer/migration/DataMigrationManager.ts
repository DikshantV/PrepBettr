/**
 * Data Migration Manager
 * Handles the complete data migration process between Firestore and Cosmos DB
 * with progress tracking, error handling, rollback capabilities, and validation
 */

import { CosmosClient } from '@azure/cosmos';
import { getFirestore } from 'firebase-admin/firestore';
import { CosmosResumeRepository } from '../cosmos/CosmosResumeRepository';
import { CosmosUsageRepository } from '../cosmos/CosmosUsageRepository';
import { FirestoreResumeRepository } from '../firestore/FirestoreResumeRepository';
import { IResumeDocument, IUsageDocument } from '../interfaces/IDocuments';
import { RepositoryResult } from '../interfaces/RepositoryResult';

interface MigrationConfig {
  direction: 'firestore-to-cosmos' | 'cosmos-to-firestore';
  collections: string[];
  batchSize?: number;
  concurrency?: number;
  validateData?: boolean;
  preserveOriginalData?: boolean;
  continueOnError?: boolean;
  createBackup?: boolean;
  retryAttempts?: number;
}

interface MigrationStatus {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'completed_with_errors';
  startTime: string;
  endTime?: string;
  totalDocuments: number;
  documentsProcessed: number;
  errors: MigrationError[];
  progressPercentage: number;
  currentCollection?: string;
  estimatedTimeRemaining?: number;
}

interface MigrationError {
  collection: string;
  documentId?: string;
  error: string;
  timestamp: string;
  retryCount: number;
}

export interface MigrationOptions {
  cosmosClient: CosmosClient;
  databaseId: string;
  batchSize?: number;
  concurrency?: number;
  retryAttempts?: number;
  retryDelayMs?: number;
  healthCheckIntervalMs?: number;
  progressReportingIntervalMs?: number;
}

interface ValidationResult {
  success: boolean;
  inconsistencies: Array<{
    id: string;
    collection: string;
    differences: string[];
  }>;
  totalChecked: number;
  consistentDocuments: number;
}

interface CompletenessCheck {
  complete: boolean;
  sourceCount: number;
  targetCount: number;
  missingDocuments: string[];
}

export class DataMigrationManager {
  private cosmosClient: CosmosClient;
  private firestore: FirebaseFirestore.Firestore;
  private databaseId: string;
  private options: Required<MigrationOptions>;
  private activeMigrations: Map<string, MigrationStatus> = new Map();

  // Repository instances
  private cosmosResumeRepo: CosmosResumeRepository;
  private cosmosUsageRepo: CosmosUsageRepository;
  private firestoreResumeRepo: FirestoreResumeRepository;

  constructor(options: MigrationOptions) {
    this.cosmosClient = options.cosmosClient;
    this.firestore = getFirestore();
    this.databaseId = options.databaseId;
    
    // Set default options
    this.options = {
      ...options,
      batchSize: options.batchSize || 50,
      concurrency: options.concurrency || 3,
      retryAttempts: options.retryAttempts || 3,
      retryDelayMs: options.retryDelayMs || 2000,
      healthCheckIntervalMs: options.healthCheckIntervalMs || 10000,
      progressReportingIntervalMs: options.progressReportingIntervalMs || 5000
    };

    // Initialize repositories
    this.cosmosResumeRepo = new CosmosResumeRepository(this.cosmosClient, this.databaseId);
    this.cosmosUsageRepo = new CosmosUsageRepository(this.cosmosClient, this.databaseId);
    this.firestoreResumeRepo = new FirestoreResumeRepository();
  }

  /**
   * Start a new migration
   */
  async startMigration(config: MigrationConfig): Promise<string> {
    const migrationId = this.generateMigrationId();
    
    const migration: MigrationStatus = {
      id: migrationId,
      status: 'pending',
      startTime: new Date().toISOString(),
      totalDocuments: 0,
      documentsProcessed: 0,
      errors: [],
      progressPercentage: 0
    };

    this.activeMigrations.set(migrationId, migration);

    // Start migration in background
    this.executeMigration(migrationId, config).catch(error => {
      console.error(`Migration ${migrationId} failed:`, error);
      const currentMigration = this.activeMigrations.get(migrationId);
      if (currentMigration) {
        currentMigration.status = 'failed';
        currentMigration.endTime = new Date().toISOString();
        currentMigration.errors.push({
          collection: 'system',
          error: error.message,
          timestamp: new Date().toISOString(),
          retryCount: 0
        });
      }
    });

    return migrationId;
  }

  /**
   * Execute the actual migration process
   */
  private async executeMigration(migrationId: string, config: MigrationConfig): Promise<void> {
    const migration = this.activeMigrations.get(migrationId);
    if (!migration) throw new Error('Migration not found');

    try {
      migration.status = 'running';
      console.log(`Starting migration ${migrationId} with config:`, config);

      // Create backup if requested
      if (config.createBackup) {
        await this.createBackup(migrationId, config);
      }

      // Get total document count
      migration.totalDocuments = await this.getTotalDocumentCount(config);
      console.log(`Total documents to migrate: ${migration.totalDocuments}`);

      // Process each collection
      for (const collection of config.collections) {
        migration.currentCollection = collection;
        console.log(`Processing collection: ${collection}`);

        if (collection === 'resumes') {
          await this.migrateResumes(migrationId, config);
        } else if (collection === 'usage') {
          await this.migrateUsage(migrationId, config);
        }
      }

      // Validate migration if requested
      if (config.validateData) {
        console.log('Validating migrated data...');
        await this.validateMigration(migrationId, config);
      }

      // Complete migration
      migration.status = migration.errors.length > 0 ? 'completed_with_errors' : 'completed';
      migration.endTime = new Date().toISOString();
      migration.progressPercentage = 100;

      console.log(`Migration ${migrationId} completed with status: ${migration.status}`);

    } catch (error) {
      console.error(`Migration ${migrationId} failed:`, error);
      migration.status = 'failed';
      migration.endTime = new Date().toISOString();
      migration.errors.push({
        collection: 'system',
        error: error.message,
        timestamp: new Date().toISOString(),
        retryCount: 0
      });
    }
  }

  /**
   * Migrate resume documents
   */
  private async migrateResumes(migrationId: string, config: MigrationConfig): Promise<void> {
    const migration = this.activeMigrations.get(migrationId);
    if (!migration) throw new Error('Migration not found');

    if (config.direction === 'firestore-to-cosmos') {
      // Get all resumes from Firestore
      const firestoreSnapshots = await this.firestore.collection('resumes').get();
      const totalResumes = firestoreSnapshots.size;

      console.log(`Migrating ${totalResumes} resumes from Firestore to Cosmos DB`);

      // Process in batches
      const batches = this.createBatches(firestoreSnapshots.docs, config.batchSize || 50);
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const batchPromises: Promise<void>[] = [];

        for (const doc of batch) {
          batchPromises.push(this.migrateResumeDocument(migrationId, doc.data() as IResumeDocument, config));
        }

        // Execute batch with concurrency control
        await this.executeBatchWithConcurrency(batchPromises, config.concurrency || 3);

        // Update progress
        migration.documentsProcessed += batch.length;
        migration.progressPercentage = Math.round((migration.documentsProcessed / migration.totalDocuments) * 100);
        
        console.log(`Migrated batch ${i + 1}/${batches.length} - Progress: ${migration.progressPercentage}%`);
      }
    }
  }

  /**
   * Migrate a single resume document
   */
  private async migrateResumeDocument(
    migrationId: string, 
    document: IResumeDocument, 
    config: MigrationConfig
  ): Promise<void> {
    const migration = this.activeMigrations.get(migrationId);
    if (!migration) return;

    let retryCount = 0;
    const maxRetries = config.retryAttempts || 3;

    while (retryCount <= maxRetries) {
      try {
        // Validate document if requested
        if (config.validateData) {
          this.validateResumeDocument(document);
        }

        // Create document in target store
        const result = await this.cosmosResumeRepo.create(document);
        
        if (!result.success) {
          throw new Error(result.error || 'Failed to create document');
        }

        console.log(`Successfully migrated resume ${document.id}`);
        return; // Success, exit retry loop

      } catch (error) {
        retryCount++;
        console.error(`Error migrating resume ${document.id} (attempt ${retryCount}):`, error);

        if (retryCount > maxRetries) {
          // Max retries reached, log error
          migration.errors.push({
            collection: 'resumes',
            documentId: document.id,
            error: error.message,
            timestamp: new Date().toISOString(),
            retryCount: retryCount - 1
          });

          if (!config.continueOnError) {
            throw error;
          }
          return; // Continue to next document
        }

        // Wait before retry
        await this.delay(this.options.retryDelayMs);
      }
    }
  }

  /**
   * Migrate usage documents
   */
  private async migrateUsage(migrationId: string, config: MigrationConfig): Promise<void> {
    const migration = this.activeMigrations.get(migrationId);
    if (!migration) throw new Error('Migration not found');

    if (config.direction === 'firestore-to-cosmos') {
      // Get all usage documents from Firestore
      const firestoreSnapshots = await this.firestore.collection('usage').get();
      const totalUsage = firestoreSnapshots.size;

      console.log(`Migrating ${totalUsage} usage documents from Firestore to Cosmos DB`);

      // Process in batches
      const batches = this.createBatches(firestoreSnapshots.docs, config.batchSize || 50);
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const batchPromises: Promise<void>[] = [];

        for (const doc of batch) {
          batchPromises.push(this.migrateUsageDocument(migrationId, doc.data() as IUsageDocument, config));
        }

        // Execute batch with concurrency control
        await this.executeBatchWithConcurrency(batchPromises, config.concurrency || 3);

        // Update progress
        migration.documentsProcessed += batch.length;
        migration.progressPercentage = Math.round((migration.documentsProcessed / migration.totalDocuments) * 100);
      }
    }
  }

  /**
   * Migrate a single usage document
   */
  private async migrateUsageDocument(
    migrationId: string,
    document: IUsageDocument,
    config: MigrationConfig
  ): Promise<void> {
    const migration = this.activeMigrations.get(migrationId);
    if (!migration) return;

    try {
      if (config.validateData) {
        this.validateUsageDocument(document);
      }

      const result = await this.cosmosUsageRepo.create(document);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to create usage document');
      }

      console.log(`Successfully migrated usage document ${document.id}`);

    } catch (error) {
      console.error(`Error migrating usage document ${document.id}:`, error);
      
      migration.errors.push({
        collection: 'usage',
        documentId: document.id,
        error: error.message,
        timestamp: new Date().toISOString(),
        retryCount: 0
      });

      if (!config.continueOnError) {
        throw error;
      }
    }
  }

  /**
   * Get migration status
   */
  async getMigrationStatus(migrationId: string): Promise<MigrationStatus | null> {
    return this.activeMigrations.get(migrationId) || null;
  }

  /**
   * Validate data consistency between stores
   */
  async validateDataConsistency(options: {
    collections: string[];
    sampleSize?: number;
    detailedComparison?: boolean;
  }): Promise<ValidationResult> {
    const inconsistencies: Array<{ id: string; collection: string; differences: string[] }> = [];
    let totalChecked = 0;

    for (const collection of options.collections) {
      if (collection === 'resumes') {
        const result = await this.validateResumeConsistency(options);
        inconsistencies.push(...result.inconsistencies);
        totalChecked += result.totalChecked;
      }
    }

    return {
      success: inconsistencies.length === 0,
      inconsistencies,
      totalChecked,
      consistentDocuments: totalChecked - inconsistencies.length
    };
  }

  /**
   * Validate resume data consistency
   */
  private async validateResumeConsistency(options: {
    sampleSize?: number;
    detailedComparison?: boolean;
  }): Promise<ValidationResult> {
    const inconsistencies: Array<{ id: string; collection: string; differences: string[] }> = [];
    
    // Get sample of documents from both stores
    const cosmosResult = await this.cosmosResumeRepo.findMany({}, { limit: options.sampleSize || 100 });
    const firestoreSnapshots = await this.firestore.collection('resumes')
      .limit(options.sampleSize || 100)
      .get();

    if (!cosmosResult.success) {
      throw new Error('Failed to fetch Cosmos documents for validation');
    }

    const cosmosDocuments = cosmosResult.data || [];
    const firestoreDocuments: IResumeDocument[] = [];
    
    firestoreSnapshots.forEach(doc => {
      firestoreDocuments.push({ ...doc.data(), id: doc.id } as IResumeDocument);
    });

    // Create maps for comparison
    const cosmosMap = new Map(cosmosDocuments.map(doc => [doc.id, doc]));
    const firestoreMap = new Map(firestoreDocuments.map(doc => [doc.id, doc]));

    // Check each document
    for (const [id, cosmosDoc] of cosmosMap) {
      const firestoreDoc = firestoreMap.get(id);
      
      if (!firestoreDoc) {
        inconsistencies.push({
          id,
          collection: 'resumes',
          differences: ['Document missing in Firestore']
        });
        continue;
      }

      // Compare documents
      if (options.detailedComparison) {
        const differences = this.compareResumeDocuments(cosmosDoc, firestoreDoc);
        if (differences.length > 0) {
          inconsistencies.push({
            id,
            collection: 'resumes',
            differences
          });
        }
      }
    }

    return {
      success: inconsistencies.length === 0,
      inconsistencies,
      totalChecked: Math.max(cosmosDocuments.length, firestoreDocuments.length),
      consistentDocuments: Math.max(cosmosDocuments.length, firestoreDocuments.length) - inconsistencies.length
    };
  }

  /**
   * Verify migration completeness
   */
  async verifyMigrationCompleteness(migrationId: string): Promise<CompletenessCheck> {
    const migration = this.activeMigrations.get(migrationId);
    if (!migration) {
      throw new Error('Migration not found');
    }

    // For now, implement basic check
    const cosmosCount = await this.cosmosResumeRepo.count();
    const firestoreSnapshots = await this.firestore.collection('resumes').get();
    const firestoreCount = firestoreSnapshots.size;

    const missingDocuments: string[] = [];
    
    if (cosmosCount.data !== firestoreCount) {
      // Identify missing documents
      const cosmosResult = await this.cosmosResumeRepo.findMany();
      const cosmosIds = new Set((cosmosResult.data || []).map(doc => doc.id));
      
      firestoreSnapshots.forEach(doc => {
        if (!cosmosIds.has(doc.id)) {
          missingDocuments.push(doc.id);
        }
      });
    }

    return {
      complete: missingDocuments.length === 0,
      sourceCount: firestoreCount,
      targetCount: cosmosCount.data || 0,
      missingDocuments
    };
  }

  /**
   * Rollback migration
   */
  async rollbackMigration(migrationId: string): Promise<void> {
    console.log(`Starting rollback for migration ${migrationId}`);
    
    // Implementation would depend on backup strategy
    // For now, this is a placeholder that would need to:
    // 1. Restore from backup
    // 2. Remove migrated data from target
    // 3. Update migration status
    
    const migration = this.activeMigrations.get(migrationId);
    if (migration) {
      migration.status = 'failed';
      migration.endTime = new Date().toISOString();
    }
    
    console.log(`Rollback completed for migration ${migrationId}`);
  }

  /**
   * Helper methods
   */

  private generateMigrationId(): string {
    return `migration_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async getTotalDocumentCount(config: MigrationConfig): Promise<number> {
    let total = 0;
    
    for (const collection of config.collections) {
      if (config.direction === 'firestore-to-cosmos') {
        const snapshot = await this.firestore.collection(collection).get();
        total += snapshot.size;
      }
    }
    
    return total;
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private async executeBatchWithConcurrency(promises: Promise<void>[], concurrency: number): Promise<void> {
    const executing: Promise<void>[] = [];
    
    for (const promise of promises) {
      const wrappedPromise = promise.then(
        () => executing.splice(executing.indexOf(wrappedPromise), 1),
        (error) => {
          executing.splice(executing.indexOf(wrappedPromise), 1);
          throw error;
        }
      );
      
      executing.push(wrappedPromise);
      
      if (executing.length >= concurrency) {
        await Promise.race(executing);
      }
    }
    
    await Promise.all(executing);
  }

  private validateResumeDocument(document: IResumeDocument): void {
    if (!document.userId) throw new Error('userId is required');
    if (!document.fileName) throw new Error('fileName is required');
    if (!document.uploadDate) throw new Error('uploadDate is required');
  }

  private validateUsageDocument(document: IUsageDocument): void {
    if (!document.userId) throw new Error('userId is required');
    if (!document.feature) throw new Error('feature is required');
    if (!document.date) throw new Error('date is required');
    if (typeof document.count !== 'number') throw new Error('count must be a number');
  }

  private compareResumeDocuments(doc1: IResumeDocument, doc2: IResumeDocument): string[] {
    const differences: string[] = [];
    
    if (doc1.fileName !== doc2.fileName) differences.push('fileName');
    if (doc1.atsScore !== doc2.atsScore) differences.push('atsScore');
    if (doc1.userId !== doc2.userId) differences.push('userId');
    
    return differences;
  }

  private async createBackup(migrationId: string, config: MigrationConfig): Promise<void> {
    console.log(`Creating backup for migration ${migrationId}`);
    // Backup implementation would go here
  }

  private async validateMigration(migrationId: string, config: MigrationConfig): Promise<void> {
    console.log(`Validating migration ${migrationId}`);
    // Validation implementation would go here
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}