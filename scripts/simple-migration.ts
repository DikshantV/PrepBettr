#!/usr/bin/env tsx

/**
 * Simplified Database Migration Script
 * 
 * A streamlined version that bypasses progress tracking container
 * and focuses on core migration functionality.
 */

import { azureCosmosService } from '../lib/services/azure-cosmos-service';
import { getAdminFirestore } from '../lib/firebase/admin';
import * as crypto from 'crypto';

interface MigrationStats {
  collection: string;
  total: number;
  migrated: number;
  failed: number;
  errors: string[];
  startTime: Date;
  endTime?: Date;
  dryRun: boolean;
}

class SimpleMigrationService {
  private firestore!: Awaited<ReturnType<typeof getAdminFirestore>>;
  private initialized = false;
  
  private async initializeFirestore(): Promise<void> {
    if (this.initialized) {
      return;
    }
    
    this.firestore = await getAdminFirestore();
    this.initialized = true;
  }
  
  private collectionMappings: { [key: string]: string } = {
    'interviews': 'interviews',
    'feedback': 'feedback',
    'resumes': 'resumes', 
    'usage': 'usage',
    'autoApplySettings': 'autoApplySettings',
    'applications': 'applications',
    'jobListings': 'jobListings',
    'automationLogs': 'automationLogs',
    'subscription_events': 'subscriptionEvents'
  };

  async migrateCollection(
    collection: string, 
    options: { batchSize?: number; dryRun?: boolean } = {}
  ): Promise<MigrationStats> {
    const { batchSize = 50, dryRun = false } = options;
    const cosmosContainer = this.collectionMappings[collection];
    
    if (!cosmosContainer) {
      throw new Error(`No mapping found for collection: ${collection}`);
    }

    console.log(`🚀 Starting ${dryRun ? 'DRY RUN' : 'MIGRATION'}: ${collection} -> ${cosmosContainer}`);
    
    const stats: MigrationStats = {
      collection,
      total: 0,
      migrated: 0,
      failed: 0,
      errors: [],
      startTime: new Date(),
      dryRun
    };

    try {
      // Initialize services
      await this.initializeFirestore();
      await azureCosmosService.initialize();
      console.log('✅ Services initialized');

      // Get total document count (using regular query since count() not available in mock)
      const countSnapshot = await this.firestore.collection(collection).get();
      stats.total = countSnapshot.docs?.length || 0;
      console.log(`📊 Found ${stats.total} documents to ${dryRun ? 'preview' : 'migrate'}`);

      if (stats.total === 0) {
        console.log('ℹ️  No documents to migrate');
        stats.endTime = new Date();
        return stats;
      }

      // Process all documents (since mock doesn't support orderBy/limit, we'll process all at once)
      const allDocs = countSnapshot.docs || [];
      
      console.log(`📝 Processing ${allDocs.length} documents...`);
      
      let processed = 0;
      
      // Process each document
      for (const doc of (allDocs as any[])) {
          try {
            if (!dryRun) {
              // Transform document for Cosmos DB
              const transformedDoc = this.transformDocument(doc, collection);
              
              // Create document in Cosmos DB
              await azureCosmosService.createDocument(cosmosContainer, transformedDoc);
            }
            
            stats.migrated++;
            processed++;
            
          } catch (error) {
            stats.failed++;
            stats.errors.push(`${doc.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            console.error(`❌ Failed to process ${doc.id}:`, error instanceof Error ? error.message : error);
            processed++;
          }
        }
        
        // Final progress update
        console.log(`📈 Progress: ${processed}/${stats.total} (100%)`);

      stats.endTime = new Date();
      const duration = stats.endTime.getTime() - stats.startTime.getTime();
      
      console.log(`\n🎉 ${dryRun ? 'DRY RUN' : 'MIGRATION'} completed in ${Math.round(duration / 1000)}s`);
      console.log(`📊 Results: ${stats.migrated} successful, ${stats.failed} failed`);
      
      if (stats.errors.length > 0) {
        console.log(`\n❌ Errors (first 5):`);
        stats.errors.slice(0, 5).forEach(error => console.log(`  - ${error}`));
        if (stats.errors.length > 5) {
          console.log(`  ... and ${stats.errors.length - 5} more`);
        }
      }

      return stats;
      
    } catch (error) {
      console.error(`💥 Migration failed:`, error);
      throw error;
    }
  }

  private transformDocument(doc: any, collection: string): any {
    const data = doc.data();
    const partitionKey = this.getPartitionKey(data, collection);
    
    const transformed = {
      id: doc.id,
      ...data,
      _partitionKey: partitionKey,
      _migrated: {
        from: 'firestore',
        timestamp: new Date(),
        originalId: doc.id,
        checksum: this.calculateChecksum(data)
      }
    };

    // Collection-specific transformations
    switch (collection) {
      case 'interviews':
        return this.transformInterview(transformed);
      case 'feedback':
        return this.transformFeedback(transformed);
      case 'resumes':
        return this.transformResume(transformed);
      case 'usage':
        return this.transformUsage(transformed);
      default:
        return transformed;
    }
  }

  private transformInterview(doc: any): any {
    return {
      ...doc,
      status: doc.status || (doc.finalized ? 'completed' : 'active'),
      metadata: {
        ...doc.metadata,
        migratedFrom: 'firestore'
      }
    };
  }

  private transformFeedback(doc: any): any {
    return {
      ...doc,
      overallScore: doc.overallScore || 0,
      strengths: Array.isArray(doc.strengths) ? doc.strengths : [],
      improvements: Array.isArray(doc.improvements) ? doc.improvements : []
    };
  }

  private transformResume(doc: any): any {
    return {
      ...doc,
      metadata: {
        fileSize: doc.metadata?.fileSize || 0,
        uploadDate: doc.metadata?.uploadDate || doc.createdAt,
        lastModified: doc.metadata?.lastModified || doc.updatedAt,
        mimeType: doc.metadata?.mimeType || 'application/pdf',
        storageProvider: doc.metadata?.storageProvider || 'firebase',
        ...doc.metadata
      },
      extractedData: doc.extractedData || {
        skills: [],
        experience: [],
        education: []
      },
      interviewQuestions: doc.interviewQuestions || []
    };
  }

  private transformUsage(doc: any): any {
    return {
      ...doc,
      interviews: {
        count: doc.interviews?.count || 0,
        limit: doc.interviews?.limit || 3,
        lastReset: doc.interviews?.lastReset
      },
      resumes: {
        count: doc.resumes?.count || 0,
        limit: doc.resumes?.limit || 2,
        lastReset: doc.resumes?.lastReset
      }
    };
  }

  private getPartitionKey(data: any, collection: string): string {
    switch (collection) {
      case 'jobListings':
      case 'subscription_events':
        return data.id || 'default';
      default:
        return data.userId || data.uid || 'default';
    }
  }

  private calculateChecksum(data: any): string {
    const normalized = JSON.stringify(data, Object.keys(data).sort());
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }

  async validateMigration(collection: string): Promise<{isValid: boolean, details: any}> {
    try {
      const cosmosContainer = this.collectionMappings[collection];
      if (!cosmosContainer) {
        throw new Error(`No mapping found for collection: ${collection}`);
      }

      console.log(`🔍 Validating migration for: ${collection}`);

      // Initialize Firestore
      await this.initializeFirestore();
      
      // Get Firestore count (using regular query since count() not available in mock)
      const firestoreSnapshot = await this.firestore.collection(collection).get();
      const firestoreCount = firestoreSnapshot.docs?.length || 0;

      // Get Cosmos count
      await azureCosmosService.initialize();
      const cosmosResults = await azureCosmosService.queryDocuments(
        cosmosContainer,
        'SELECT VALUE COUNT(1) FROM c',
        []
      );
      const cosmosCount = Number(cosmosResults[0]) || 0;

      const isValid = firestoreCount === cosmosCount;
      const details = {
        firestore: firestoreCount,
        cosmos: cosmosCount,
        difference: firestoreCount - cosmosCount
      };

      console.log(`📊 Validation results:`);
      console.log(`  Firestore: ${details.firestore}`);
      console.log(`  Cosmos DB: ${details.cosmos}`);
      console.log(`  Status: ${isValid ? '✅ VALID' : '❌ MISMATCH'}`);

      return { isValid, details };
      
    } catch (error) {
      console.error(`❌ Validation failed for ${collection}:`, error);
      return { isValid: false, details: { error: error instanceof Error ? error.message : 'Unknown error' } };
    }
  }
}

// CLI execution
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (!command) {
    console.log('Usage:');
    console.log('  npm run simple-migrate <command> [options]');
    console.log('');
    console.log('Commands:');
    console.log('  migrate <collection> [--dry-run] [--batch-size=N]');
    console.log('  validate <collection>');
    console.log('  validate-all');
    return;
  }

  const service = new SimpleMigrationService();

  try {
    if (command === 'migrate') {
      const collection = args[1];
      if (!collection) {
        console.error('❌ Collection name required');
        return;
      }

      const dryRun = args.includes('--dry-run');
      const batchSizeArg = args.find(arg => arg.startsWith('--batch-size='));
      const batchSize = batchSizeArg ? parseInt(batchSizeArg.split('=')[1]) : 50;

      await service.migrateCollection(collection, { dryRun, batchSize });
      
    } else if (command === 'validate') {
      const collection = args[1];
      if (!collection) {
        console.error('❌ Collection name required');
        return;
      }
      
      await service.validateMigration(collection);
      
    } else if (command === 'validate-all') {
      const collections = ['usage', 'interviews', 'resumes', 'feedback'];
      
      console.log('🔍 Validating all collections...\n');
      for (const collection of collections) {
        await service.validateMigration(collection);
        console.log('');
      }
      
    } else {
      console.error(`❌ Unknown command: ${command}`);
    }
    
  } catch (error) {
    console.error('💥 Command failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { SimpleMigrationService };
