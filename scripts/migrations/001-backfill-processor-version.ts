/**
 * Migration Script: Backfill Processor Version
 * 
 * This migration adds the `processorVersion` field to all existing resume documents
 * in Firestore, setting them to 'legacy-v1' to maintain backward compatibility.
 * 
 * Usage:
 *   npm run migration:backfill-processor-version
 *   npm run migration:backfill-processor-version -- --dry-run
 *   npm run migration:backfill-processor-version -- --batch-size=50
 */

import { getAdminFirestore } from '@/lib/firebase/admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { 
  MigrationRecord, 
  DEFAULT_ENHANCED_FIELDS,
  FIRESTORE_PATHS,
  validateResumeDocument 
} from '@/lib/firebase/schema/resume-schema';

interface MigrationOptions {
  dryRun?: boolean;
  batchSize?: number;
  continueOnError?: boolean;
  maxRetries?: number;
  logLevel?: 'info' | 'debug' | 'error';
}

interface MigrationStats {
  totalDocuments: number;
  processedDocuments: number;
  updatedDocuments: number;
  skippedDocuments: number;
  failedDocuments: number;
  errors: Array<{
    documentId: string;
    error: string;
    timestamp: Date;
  }>;
}

class ProcessorVersionMigration {
  private db = getAdminFirestore();
  private migrationId = 'migration-001-processor-version';
  private version = '1.0.0';
  private description = 'Backfill processorVersion field for existing resume documents';

  /**
   * Execute the migration
   */
  async execute(options: MigrationOptions = {}): Promise<MigrationStats> {
    const {
      dryRun = false,
      batchSize = 100,
      continueOnError = true,
      maxRetries = 3,
      logLevel = 'info'
    } = options;

    console.log(`🚀 Starting migration: ${this.description}`);
    console.log(`📋 Options:`, {
      dryRun,
      batchSize,
      continueOnError,
      maxRetries,
      logLevel
    });

    const startTime = Date.now();
    const stats: MigrationStats = {
      totalDocuments: 0,
      processedDocuments: 0,
      updatedDocuments: 0,
      skippedDocuments: 0,
      failedDocuments: 0,
      errors: []
    };

    try {
      // Create migration record
      const migrationRecord = await this.createMigrationRecord(dryRun);
      
      // Get all profile documents (where resume data is stored)
      const profilesCollection = this.db.collection(FIRESTORE_PATHS.PROFILES);
      const snapshot = await profilesCollection.get();
      
      stats.totalDocuments = snapshot.size;
      console.log(`📊 Found ${stats.totalDocuments} documents to process`);

      if (stats.totalDocuments === 0) {
        console.log('ℹ️ No documents found to migrate');
        await this.completeMigrationRecord(migrationRecord.id, stats, Date.now() - startTime);
        return stats;
      }

      // Process documents in batches
      const batches = this.createBatches(snapshot.docs, batchSize);
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(`🔄 Processing batch ${i + 1}/${batches.length} (${batch.length} documents)`);
        
        const batchStats = await this.processBatch(batch, dryRun, maxRetries, continueOnError);
        
        // Accumulate stats
        stats.processedDocuments += batchStats.processedDocuments;
        stats.updatedDocuments += batchStats.updatedDocuments;
        stats.skippedDocuments += batchStats.skippedDocuments;
        stats.failedDocuments += batchStats.failedDocuments;
        stats.errors.push(...batchStats.errors);

        // Log progress
        const progressPercent = Math.round(((i + 1) / batches.length) * 100);
        console.log(`📈 Progress: ${progressPercent}% (${stats.processedDocuments}/${stats.totalDocuments})`);
      }

      const duration = Date.now() - startTime;
      
      // Update migration record with final results
      await this.completeMigrationRecord(migrationRecord.id, stats, duration);
      
      // Summary
      console.log(`\n✅ Migration completed in ${duration}ms`);
      console.log(`📊 Final Statistics:`);
      console.log(`   Total documents: ${stats.totalDocuments}`);
      console.log(`   Processed: ${stats.processedDocuments}`);
      console.log(`   Updated: ${stats.updatedDocuments}`);
      console.log(`   Skipped: ${stats.skippedDocuments}`);
      console.log(`   Failed: ${stats.failedDocuments}`);
      
      if (stats.errors.length > 0) {
        console.log(`\n❌ Errors (${stats.errors.length}):`);
        stats.errors.slice(0, 10).forEach(error => {
          console.log(`   ${error.documentId}: ${error.error}`);
        });
        if (stats.errors.length > 10) {
          console.log(`   ... and ${stats.errors.length - 10} more errors`);
        }
      }

      if (dryRun) {
        console.log(`\n🔍 DRY RUN: No changes were actually made to the database`);
      }

      return stats;

    } catch (error) {
      console.error(`❌ Migration failed:`, error);
      throw error;
    }
  }

  /**
   * Process a batch of documents
   */
  private async processBatch(
    docs: FirebaseFirestore.QueryDocumentSnapshot[],
    dryRun: boolean,
    maxRetries: number,
    continueOnError: boolean
  ): Promise<Omit<MigrationStats, 'totalDocuments'>> {
    const stats = {
      processedDocuments: 0,
      updatedDocuments: 0,
      skippedDocuments: 0,
      failedDocuments: 0,
      errors: [] as Array<{
        documentId: string;
        error: string;
        timestamp: Date;
      }>
    };

    const writeBatch = this.db.batch();
    const updates: { docRef: FirebaseFirestore.DocumentReference; data: any }[] = [];

    for (const doc of docs) {
      try {
        stats.processedDocuments++;
        const docData = doc.data();

        // Check if document needs migration
        const needsMigration = this.needsMigration(docData);
        
        if (!needsMigration) {
          stats.skippedDocuments++;
          continue;
        }

        // Prepare update data
        const updateData = this.prepareUpdateData(docData);
        
        // Validate the updated document
        const validation = validateResumeDocument({ ...docData, ...updateData });
        if (!validation.valid) {
          throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
        }

        if (!dryRun) {
          updates.push({
            docRef: doc.ref,
            data: updateData
          });
        }

        stats.updatedDocuments++;

      } catch (error) {
        stats.failedDocuments++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        stats.errors.push({
          documentId: doc.id,
          error: errorMessage,
          timestamp: new Date()
        });

        console.error(`❌ Failed to process document ${doc.id}:`, errorMessage);

        if (!continueOnError) {
          throw error;
        }
      }
    }

    // Execute batch updates
    if (!dryRun && updates.length > 0) {
      try {
        // Add updates to batch (max 500 operations per batch)
        const batchChunks = this.chunkArray(updates, 500);
        
        for (const chunk of batchChunks) {
          const chunkBatch = this.db.batch();
          
          for (const update of chunk) {
            chunkBatch.update(update.docRef, update.data);
          }
          
          await chunkBatch.commit();
        }
        
        console.log(`✅ Batch update completed: ${updates.length} documents updated`);
      } catch (error) {
        console.error(`❌ Batch update failed:`, error);
        throw error;
      }
    }

    return stats;
  }

  /**
   * Check if a document needs migration
   */
  private needsMigration(docData: any): boolean {
    // Document needs migration if it has resume data but no processorVersion
    return docData.extractedData && 
           docData.interviewQuestions && 
           !docData.processorVersion;
  }

  /**
   * Prepare update data for a document
   */
  private prepareUpdateData(docData: any): any {
    const updateData: any = {
      ...DEFAULT_ENHANCED_FIELDS,
      lastModified: FieldValue.serverTimestamp()
    };

    // Set processor version to legacy since these are existing documents
    updateData.processorVersion = 'legacy-v1';

    // Add metadata if not present
    if (!docData.metadata) {
      updateData.metadata = {
        processingMethod: docData.processingMethod || 'unknown',
        processingTime: docData.processingTime || 0,
        confidence: docData.confidence || 0.8
      };
    }

    // Ensure arrays are properly initialized
    if (!docData.missingKeywords) {
      updateData.missingKeywords = [];
    }

    return updateData;
  }

  /**
   * Create migration record
   */
  private async createMigrationRecord(dryRun: boolean): Promise<{ id: string }> {
    const migrationRecord: MigrationRecord = {
      migrationId: this.migrationId,
      version: this.version,
      description: dryRun ? `${this.description} (DRY RUN)` : this.description,
      executedAt: Timestamp.now(),
      executedBy: 'migration-script',
      recordsProcessed: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
      status: 'running'
    };

    const docRef = await this.db.collection('migrations').add(migrationRecord);
    console.log(`📝 Created migration record: ${docRef.id}`);
    
    return { id: docRef.id };
  }

  /**
   * Complete migration record
   */
  private async completeMigrationRecord(
    recordId: string, 
    stats: MigrationStats, 
    durationMs: number
  ): Promise<void> {
    await this.db.collection('migrations').doc(recordId).update({
      recordsProcessed: stats.processedDocuments,
      recordsUpdated: stats.updatedDocuments,
      recordsFailed: stats.failedDocuments,
      errors: stats.errors.map(error => ({
        documentId: error.documentId,
        error: error.error,
        timestamp: Timestamp.fromDate(error.timestamp)
      })),
      status: stats.failedDocuments > 0 ? 'completed' : 'completed',
      durationMs,
      completedAt: Timestamp.now()
    });
  }

  /**
   * Create batches from array
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Chunk array into smaller arrays
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Verify migration results
   */
  async verify(): Promise<{
    totalDocuments: number;
    migratedDocuments: number;
    unmigatedDocuments: number;
    invalidDocuments: number;
  }> {
    console.log('🔍 Verifying migration results...');
    
    const profilesCollection = this.db.collection(FIRESTORE_PATHS.PROFILES);
    const snapshot = await profilesCollection.get();
    
    let migratedDocuments = 0;
    let unmigatedDocuments = 0;
    let invalidDocuments = 0;
    
    for (const doc of snapshot.docs) {
      const docData = doc.data();
      
      // Check if it's a resume document
      if (docData.extractedData && docData.interviewQuestions) {
        if (docData.processorVersion) {
          migratedDocuments++;
        } else {
          unmigatedDocuments++;
        }
        
        // Validate structure
        const validation = validateResumeDocument(docData);
        if (!validation.valid) {
          invalidDocuments++;
          console.warn(`⚠️ Invalid document ${doc.id}:`, validation.errors);
        }
      }
    }
    
    const results = {
      totalDocuments: snapshot.size,
      migratedDocuments,
      unmigatedDocuments,
      invalidDocuments
    };
    
    console.log('📊 Verification Results:');
    console.log(`   Total documents: ${results.totalDocuments}`);
    console.log(`   Migrated: ${results.migratedDocuments}`);
    console.log(`   Unmigrated: ${results.unmigatedDocuments}`);
    console.log(`   Invalid: ${results.invalidDocuments}`);
    
    return results;
  }
}

/**
 * Main execution function
 */
async function main() {
  const args = process.argv.slice(2);
  const options: MigrationOptions = {};
  
  // Parse command line arguments
  args.forEach(arg => {
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg.startsWith('--batch-size=')) {
      options.batchSize = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--continue-on-error') {
      options.continueOnError = true;
    } else if (arg === '--stop-on-error') {
      options.continueOnError = false;
    } else if (arg.startsWith('--max-retries=')) {
      options.maxRetries = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--log-level=')) {
      options.logLevel = arg.split('=')[1] as 'info' | 'debug' | 'error';
    } else if (arg === '--verify') {
      // Verify migration results
      const migration = new ProcessorVersionMigration();
      await migration.verify();
      return;
    }
  });

  try {
    const migration = new ProcessorVersionMigration();
    const stats = await migration.execute(options);
    
    // Exit with error code if there were failures
    if (stats.failedDocuments > 0) {
      console.error(`❌ Migration completed with ${stats.failedDocuments} failures`);
      process.exit(1);
    }
    
    console.log('✅ Migration completed successfully');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Export for use in tests or other scripts
export { ProcessorVersionMigration };

// Run if this script is executed directly
if (require.main === module) {
  main().catch(console.error);
}
