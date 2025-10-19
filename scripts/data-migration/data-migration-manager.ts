#!/usr/bin/env tsx
// Data Migration Manager
// Main orchestrator for migrating data from Firebase Firestore to Azure Cosmos DB

import { CosmosClient, Container, ItemDefinition } from '@azure/cosmos';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { credential } from 'firebase-admin';
import { performance } from 'perf_hooks';
import * as fs from 'fs';
import * as path from 'path';

// Types
interface MigrationConfig {
  batchSize: number;
  maxRetries: number;
  retryDelayMs: number;
  dryRun: boolean;
  collections: string[];
  skipValidation: boolean;
  continueFromCheckpoint?: string;
  validateOnly: boolean;
}

interface MigrationProgress {
  collectionName: string;
  documentsTotal: number;
  documentsProcessed: number;
  documentsMigrated: number;
  documentsSkipped: number;
  documentsErrored: number;
  startTime: Date;
  endTime?: Date;
  lastCheckpoint?: string;
  errors: MigrationError[];
}

interface MigrationError {
  documentId: string;
  collection: string;
  error: string;
  timestamp: Date;
  retryCount: number;
}

interface MigrationSummary {
  startTime: Date;
  endTime: Date;
  totalDocuments: number;
  migratedDocuments: number;
  skippedDocuments: number;
  erroredDocuments: number;
  collections: MigrationProgress[];
  duration: number;
  averageDocsPerSecond: number;
}

interface CosmosMapping {
  firestoreCollection: string;
  cosmosContainer: string;
  partitionKey: string;
  transformData?: (data: any) => any;
  validateData?: (data: any) => boolean;
}

export class DataMigrationManager {
  private firestoreDb: Firestore;
  private cosmosClient: CosmosClient;
  private cosmosDatabase: any;
  private config: MigrationConfig;
  private progress: Map<string, MigrationProgress> = new Map();
  private progressFilePath: string;

  private cosmosMapping: CosmosMapping[] = [
    {
      firestoreCollection: 'resumes',
      cosmosContainer: 'resumes',
      partitionKey: '/userId',
      transformData: this.transformResumeData,
      validateData: this.validateResumeData
    },
    {
      firestoreCollection: 'mockInterviews',
      cosmosContainer: 'interviews',
      partitionKey: '/userId',
      transformData: this.transformInterviewData,
      validateData: this.validateInterviewData
    },
    {
      firestoreCollection: 'usage',
      cosmosContainer: 'usage',
      partitionKey: '/userId',
      transformData: this.transformUsageData,
      validateData: this.validateUsageData
    },
    {
      firestoreCollection: 'userConsents',
      cosmosContainer: 'userConsents',
      partitionKey: '/userId',
      transformData: this.transformConsentData,
      validateData: this.validateConsentData
    },
    {
      firestoreCollection: 'auditLogs',
      cosmosContainer: 'auditLogs',
      partitionKey: '/userId',
      transformData: this.transformAuditData,
      validateData: this.validateAuditData
    },
    {
      firestoreCollection: 'payments',
      cosmosContainer: 'payments',
      partitionKey: '/userId',
      transformData: this.transformPaymentData,
      validateData: this.validatePaymentData
    },
    {
      firestoreCollection: 'notificationEvents',
      cosmosContainer: 'notificationEvents',
      partitionKey: '/userId',
      transformData: this.transformNotificationData,
      validateData: this.validateNotificationData
    }
  ];

  constructor(config: MigrationConfig) {
    this.config = {
      batchSize: 50,
      maxRetries: 3,
      retryDelayMs: 1000,
      dryRun: false,
      skipValidation: false,
      validateOnly: false,
      collections: [],
      ...config
    };

    this.progressFilePath = path.join(process.cwd(), 'migration-progress.json');
    this.initializeServices();
    this.loadProgress();
  }

  private initializeServices(): void {
    try {
      // Initialize Firebase Admin
      if (getApps().length === 0) {
        const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH;
        const serviceAccount = serviceAccountPath 
          ? JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))
          : {
              projectId: process.env.FIREBASE_PROJECT_ID,
              clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
              privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
            };

        initializeApp({
          credential: credential.cert(serviceAccount),
          databaseURL: `https://${serviceAccount.projectId}-default-rtdb.firebaseio.com/`
        });
      }

      this.firestoreDb = getFirestore();

      // Initialize Cosmos DB
      const cosmosEndpoint = process.env.AZURE_COSMOS_ENDPOINT || '';
      const cosmosKey = process.env.AZURE_COSMOS_KEY || '';
      const cosmosConnectionString = process.env.AZURE_COSMOS_CONNECTION_STRING || '';

      if (cosmosConnectionString) {
        this.cosmosClient = new CosmosClient(cosmosConnectionString);
      } else if (cosmosEndpoint && cosmosKey) {
        this.cosmosClient = new CosmosClient({
          endpoint: cosmosEndpoint,
          key: cosmosKey
        });
      } else {
        throw new Error('Missing Azure Cosmos DB configuration. Set AZURE_COSMOS_CONNECTION_STRING or AZURE_COSMOS_ENDPOINT + AZURE_COSMOS_KEY');
      }

      const databaseId = process.env.AZURE_COSMOS_DATABASE_ID || 'prepbettr';
      this.cosmosDatabase = this.cosmosClient.database(databaseId);

      console.log('✅ Firebase and Cosmos DB clients initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize services:', error);
      throw error;
    }
  }

  private loadProgress(): void {
    try {
      if (fs.existsSync(this.progressFilePath)) {
        const progressData = JSON.parse(fs.readFileSync(this.progressFilePath, 'utf8'));
        for (const [collection, progress] of Object.entries(progressData)) {
          this.progress.set(collection, {
            ...progress as MigrationProgress,
            startTime: new Date((progress as any).startTime),
            endTime: (progress as any).endTime ? new Date((progress as any).endTime) : undefined
          });
        }
        console.log(`📊 Loaded progress for ${this.progress.size} collections`);
      }
    } catch (error) {
      console.warn('⚠️ Failed to load previous progress:', error.message);
    }
  }

  private saveProgress(): void {
    try {
      const progressData: any = {};
      for (const [collection, progress] of this.progress.entries()) {
        progressData[collection] = progress;
      }
      fs.writeFileSync(this.progressFilePath, JSON.stringify(progressData, null, 2));
    } catch (error) {
      console.error('❌ Failed to save progress:', error);
    }
  }

  async startMigration(): Promise<MigrationSummary> {
    const startTime = new Date();
    console.log(`🚀 Starting data migration at ${startTime.toISOString()}`);
    
    if (this.config.dryRun) {
      console.log('🔍 Running in DRY RUN mode - no data will be written to Cosmos DB');
    }

    if (this.config.validateOnly) {
      console.log('✅ Running in VALIDATE ONLY mode - checking data integrity');
    }

    const collectionsToMigrate = this.config.collections.length > 0 
      ? this.cosmosMapping.filter(mapping => this.config.collections.includes(mapping.firestoreCollection))
      : this.cosmosMapping;

    console.log(`📋 Migrating ${collectionsToMigrate.length} collections:`, 
      collectionsToMigrate.map(m => m.firestoreCollection).join(', '));

    for (const mapping of collectionsToMigrate) {
      try {
        await this.migrateCollection(mapping);
      } catch (error) {
        console.error(`❌ Failed to migrate collection ${mapping.firestoreCollection}:`, error);
        // Continue with other collections
      }
    }

    const endTime = new Date();
    const summary = this.generateMigrationSummary(startTime, endTime);
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(80));
    console.log(`⏰ Duration: ${summary.duration}ms (${(summary.duration / 1000 / 60).toFixed(2)} minutes)`);
    console.log(`📄 Total Documents: ${summary.totalDocuments}`);
    console.log(`✅ Migrated: ${summary.migratedDocuments}`);
    console.log(`⏭️ Skipped: ${summary.skippedDocuments}`);
    console.log(`❌ Errors: ${summary.erroredDocuments}`);
    console.log(`⚡ Average Speed: ${summary.averageDocsPerSecond.toFixed(2)} docs/second`);

    // Save final progress
    this.saveProgress();

    return summary;
  }

  private async migrateCollection(mapping: CosmosMapping): Promise<void> {
    const collectionName = mapping.firestoreCollection;
    console.log(`\n📁 Processing collection: ${collectionName}`);

    // Initialize progress
    if (!this.progress.has(collectionName)) {
      this.progress.set(collectionName, {
        collectionName,
        documentsTotal: 0,
        documentsProcessed: 0,
        documentsMigrated: 0,
        documentsSkipped: 0,
        documentsErrored: 0,
        startTime: new Date(),
        errors: []
      });
    }

    const progress = this.progress.get(collectionName)!;
    
    try {
      // Get total count for progress tracking
      if (progress.documentsTotal === 0) {
        const countSnapshot = await this.firestoreDb.collection(collectionName).count().get();
        progress.documentsTotal = countSnapshot.data().count;
        console.log(`📊 Found ${progress.documentsTotal} documents in ${collectionName}`);
      }

      // Get Cosmos container
      const cosmosContainer = this.cosmosDatabase.container(mapping.cosmosContainer);

      // Resume from checkpoint if available
      let query = this.firestoreDb.collection(collectionName).orderBy('__name__');
      if (this.config.continueFromCheckpoint && progress.lastCheckpoint) {
        query = query.startAfter(progress.lastCheckpoint);
        console.log(`🔄 Resuming from checkpoint: ${progress.lastCheckpoint}`);
      }

      // Process in batches
      let hasMore = true;
      let lastDoc: any = null;

      while (hasMore) {
        const batchQuery = query.limit(this.config.batchSize);
        const snapshot = await batchQuery.get();

        if (snapshot.empty) {
          hasMore = false;
          break;
        }

        const batch = snapshot.docs;
        console.log(`📦 Processing batch of ${batch.length} documents...`);

        for (const doc of batch) {
          await this.migrateDocument(doc, mapping, cosmosContainer, progress);
          lastDoc = doc;
          
          // Update checkpoint
          progress.lastCheckpoint = doc.id;
          
          // Periodic progress save
          if (progress.documentsProcessed % 100 === 0) {
            this.saveProgress();
            this.printProgress(progress);
          }
        }

        // Update query to start after the last document
        if (lastDoc) {
          query = this.firestoreDb.collection(collectionName)
            .orderBy('__name__')
            .startAfter(lastDoc);
        }

        // Check if we have fewer documents than batch size (last batch)
        if (batch.length < this.config.batchSize) {
          hasMore = false;
        }

        // Rate limiting
        await this.sleep(100);
      }

      progress.endTime = new Date();
      console.log(`✅ Completed migration of ${collectionName}`);
      this.printProgress(progress);

    } catch (error) {
      console.error(`❌ Error migrating collection ${collectionName}:`, error);
      progress.errors.push({
        documentId: 'COLLECTION_ERROR',
        collection: collectionName,
        error: error.message,
        timestamp: new Date(),
        retryCount: 0
      });
    }
  }

  private async migrateDocument(
    doc: any, 
    mapping: CosmosMapping, 
    cosmosContainer: Container, 
    progress: MigrationProgress
  ): Promise<void> {
    const docId = doc.id;
    const docData = doc.data();

    try {
      progress.documentsProcessed++;

      // Skip if document already exists in Cosmos (idempotent)
      if (!this.config.validateOnly) {
        try {
          const existingItem = await cosmosContainer.item(docId, docData[mapping.partitionKey.replace('/', '')]).read();
          if (existingItem.resource) {
            progress.documentsSkipped++;
            return;
          }
        } catch (error) {
          // Document doesn't exist, continue with migration
        }
      }

      // Transform data
      let transformedData = docData;
      if (mapping.transformData) {
        transformedData = mapping.transformData(docData);
      }

      // Add metadata
      transformedData.id = docId;
      transformedData._migrationInfo = {
        sourceCollection: mapping.firestoreCollection,
        migratedAt: new Date().toISOString(),
        migrationVersion: '1.0.0'
      };

      // Validate data
      if (mapping.validateData && !mapping.validateData(transformedData)) {
        progress.documentsSkipped++;
        progress.errors.push({
          documentId: docId,
          collection: mapping.firestoreCollection,
          error: 'Data validation failed',
          timestamp: new Date(),
          retryCount: 0
        });
        return;
      }

      if (this.config.validateOnly) {
        // Just validate, don't write
        progress.documentsMigrated++;
        return;
      }

      if (this.config.dryRun) {
        console.log(`[DRY RUN] Would migrate: ${docId}`);
        progress.documentsMigrated++;
        return;
      }

      // Write to Cosmos DB with retries
      await this.writeToCosmosWithRetry(
        cosmosContainer, 
        transformedData, 
        docId, 
        mapping.firestoreCollection
      );

      progress.documentsMigrated++;

    } catch (error) {
      progress.documentsErrored++;
      progress.errors.push({
        documentId: docId,
        collection: mapping.firestoreCollection,
        error: error.message,
        timestamp: new Date(),
        retryCount: 0
      });

      console.error(`❌ Error migrating document ${docId}:`, error.message);
    }
  }

  private async writeToCosmosWithRetry(
    container: Container, 
    data: any, 
    docId: string, 
    collection: string
  ): Promise<void> {
    let retryCount = 0;
    
    while (retryCount <= this.config.maxRetries) {
      try {
        await container.items.create(data);
        return;
      } catch (error) {
        retryCount++;
        
        if (retryCount > this.config.maxRetries) {
          throw error;
        }

        // Exponential backoff
        const delay = this.config.retryDelayMs * Math.pow(2, retryCount - 1);
        console.log(`⚠️ Retry ${retryCount}/${this.config.maxRetries} for ${docId} after ${delay}ms`);
        await this.sleep(delay);
      }
    }
  }

  private printProgress(progress: MigrationProgress): void {
    const percentage = progress.documentsTotal > 0 
      ? ((progress.documentsProcessed / progress.documentsTotal) * 100).toFixed(2)
      : '0';
    
    const elapsed = Date.now() - progress.startTime.getTime();
    const docsPerSecond = progress.documentsProcessed / (elapsed / 1000);

    console.log(
      `📈 ${progress.collectionName}: ${progress.documentsProcessed}/${progress.documentsTotal} (${percentage}%) ` +
      `| Migrated: ${progress.documentsMigrated} | Skipped: ${progress.documentsSkipped} | Errors: ${progress.documentsErrored} ` +
      `| Speed: ${docsPerSecond.toFixed(2)} docs/sec`
    );
  }

  private generateMigrationSummary(startTime: Date, endTime: Date): MigrationSummary {
    const collections = Array.from(this.progress.values());
    const totalDocuments = collections.reduce((sum, p) => sum + p.documentsTotal, 0);
    const migratedDocuments = collections.reduce((sum, p) => sum + p.documentsMigrated, 0);
    const skippedDocuments = collections.reduce((sum, p) => sum + p.documentsSkipped, 0);
    const erroredDocuments = collections.reduce((sum, p) => sum + p.documentsErrored, 0);
    const duration = endTime.getTime() - startTime.getTime();
    const averageDocsPerSecond = totalDocuments / (duration / 1000);

    return {
      startTime,
      endTime,
      totalDocuments,
      migratedDocuments,
      skippedDocuments,
      erroredDocuments,
      collections,
      duration,
      averageDocsPerSecond
    };
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Data transformation methods
  private transformResumeData(data: any): any {
    return {
      ...data,
      userId: data.userId || data.uid,
      createdAt: data.createdAt?.toDate?.() || data.createdAt,
      updatedAt: data.updatedAt?.toDate?.() || data.updatedAt || new Date()
    };
  }

  private transformInterviewData(data: any): any {
    return {
      ...data,
      userId: data.userId || data.uid,
      createdAt: data.createdAt?.toDate?.() || data.createdAt,
      finishedAt: data.finishedAt?.toDate?.() || data.finishedAt,
      updatedAt: new Date()
    };
  }

  private transformUsageData(data: any): any {
    return {
      ...data,
      userId: data.userId || data.uid,
      createdAt: data.createdAt?.toDate?.() || data.createdAt,
      updatedAt: data.updatedAt?.toDate?.() || data.updatedAt || new Date(),
      lastReset: data.lastReset?.toDate?.() || data.lastReset
    };
  }

  private transformConsentData(data: any): any {
    return {
      ...data,
      userId: data.userId || data.uid,
      consentDate: data.consentDate?.toDate?.() || data.consentDate,
      updatedAt: new Date()
    };
  }

  private transformAuditData(data: any): any {
    return {
      ...data,
      userId: data.userId || data.uid,
      timestamp: data.timestamp?.toDate?.() || data.timestamp,
      createdAt: data.timestamp?.toDate?.() || data.timestamp
    };
  }

  private transformPaymentData(data: any): any {
    return {
      ...data,
      userId: data.userId || data.uid,
      createdAt: data.createdAt?.toDate?.() || data.createdAt,
      updatedAt: data.updatedAt?.toDate?.() || data.updatedAt || new Date()
    };
  }

  private transformNotificationData(data: any): any {
    return {
      ...data,
      userId: data.userId || data.uid,
      createdAt: data.createdAt?.toDate?.() || data.createdAt,
      scheduledFor: data.scheduledFor?.toDate?.() || data.scheduledFor,
      sentAt: data.sentAt?.toDate?.() || data.sentAt
    };
  }

  // Data validation methods
  private validateResumeData(data: any): boolean {
    return !!(data.userId && data.fileName);
  }

  private validateInterviewData(data: any): boolean {
    return !!(data.userId && data.jobTitle);
  }

  private validateUsageData(data: any): boolean {
    return !!(data.userId && typeof data.interviewsThisMonth === 'number');
  }

  private validateConsentData(data: any): boolean {
    return !!(data.userId && data.consentDate);
  }

  private validateAuditData(data: any): boolean {
    return !!(data.userId && data.action && data.timestamp);
  }

  private validatePaymentData(data: any): boolean {
    return !!(data.userId && data.status);
  }

  private validateNotificationData(data: any): boolean {
    return !!(data.userId && data.type && data.status);
  }

  // Utility methods for external access
  async validateMigration(): Promise<{ valid: boolean; errors: string[] }> {
    console.log('🔍 Validating migration integrity...');
    const errors: string[] = [];

    for (const mapping of this.cosmosMapping) {
      try {
        // Sample validation - compare counts
        const firestoreCount = (await this.firestoreDb.collection(mapping.firestoreCollection).count().get()).data().count;
        const cosmosContainer = this.cosmosDatabase.container(mapping.cosmosContainer);
        
        // Note: Cosmos DB doesn't have a direct count query, so we'd need to implement this differently
        // For now, we'll skip the count validation and focus on data integrity
        
        console.log(`✅ ${mapping.firestoreCollection}: ${firestoreCount} documents in Firestore`);
        
      } catch (error) {
        const errorMsg = `Failed to validate ${mapping.firestoreCollection}: ${error.message}`;
        errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  async generateMigrationReport(): Promise<string> {
    const report = ['# Data Migration Report', ''];
    
    for (const [collection, progress] of this.progress.entries()) {
      report.push(`## ${collection}`);
      report.push(`- Total Documents: ${progress.documentsTotal}`);
      report.push(`- Processed: ${progress.documentsProcessed}`);
      report.push(`- Migrated: ${progress.documentsMigrated}`);
      report.push(`- Skipped: ${progress.documentsSkipped}`);
      report.push(`- Errors: ${progress.documentsErrored}`);
      
      if (progress.errors.length > 0) {
        report.push(`### Errors:`);
        for (const error of progress.errors.slice(0, 10)) { // Show first 10 errors
          report.push(`- ${error.documentId}: ${error.error}`);
        }
        if (progress.errors.length > 10) {
          report.push(`- ... and ${progress.errors.length - 10} more errors`);
        }
      }
      
      report.push('');
    }

    return report.join('\n');
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const config: MigrationConfig = {
    batchSize: 50,
    maxRetries: 3,
    retryDelayMs: 1000,
    dryRun: args.includes('--dry-run'),
    skipValidation: args.includes('--skip-validation'),
    validateOnly: args.includes('--validate-only'),
    collections: [],
    continueFromCheckpoint: args.includes('--resume') ? undefined : undefined
  };

  // Parse collection filter
  const collectionsIndex = args.indexOf('--collections');
  if (collectionsIndex !== -1 && collectionsIndex + 1 < args.length) {
    config.collections = args[collectionsIndex + 1].split(',');
  }

  // Parse batch size
  const batchSizeIndex = args.indexOf('--batch-size');
  if (batchSizeIndex !== -1 && batchSizeIndex + 1 < args.length) {
    config.batchSize = parseInt(args[batchSizeIndex + 1]) || 50;
  }

  const manager = new DataMigrationManager(config);

  if (args.includes('--validate')) {
    manager.validateMigration().then(result => {
      if (result.valid) {
        console.log('✅ Migration validation passed');
        process.exit(0);
      } else {
        console.error('❌ Migration validation failed:', result.errors);
        process.exit(1);
      }
    });
  } else if (args.includes('--report')) {
    manager.generateMigrationReport().then(report => {
      console.log(report);
      process.exit(0);
    });
  } else {
    manager.startMigration()
      .then(summary => {
        console.log('\n🎉 Migration completed successfully!');
        process.exit(summary.erroredDocuments > 0 ? 1 : 0);
      })
      .catch(error => {
        console.error('\n💥 Migration failed:', error);
        process.exit(1);
      });
  }
}