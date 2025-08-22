#!/usr/bin/env tsx

/**
 * Data Validation and Migration Integrity Scripts
 * 
 * Validates data integrity before and after deployments:
 * - Creates pre-deployment snapshots
 * - Compares Cosmos DB records
 * - Validates data consistency
 * - Generates integrity reports
 */

import { CosmosClient, Container } from '@azure/cosmos';
import { SecretClient } from '@azure/keyvault-secrets';
import { DefaultAzureCredential } from '@azure/identity';
import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import crypto from 'crypto';

// ===== INTERFACES =====

interface ValidationOptions {
  environment: 'staging' | 'prod';
  operation: 'snapshot' | 'validate' | 'compare';
  snapshotId?: string;
  containers?: string[];
  sampleSize?: number;
  outputDir?: string;
}

interface DataSnapshot {
  snapshotId: string;
  timestamp: string;
  environment: string;
  containers: ContainerSnapshot[];
  metadata: {
    totalDocuments: number;
    totalContainers: number;
    checksumOverall: string;
  };
}

interface ContainerSnapshot {
  name: string;
  documentCount: number;
  sampleDocuments: DocumentSample[];
  checksum: string;
  indexingPolicy?: any;
  partitionKeyPaths?: string[];
}

interface DocumentSample {
  id: string;
  checksum: string;
  timestamp?: string;
  size: number;
}

interface ValidationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  summary: {
    totalDocuments: number;
    validDocuments: number;
    invalidDocuments: number;
    missingDocuments: number;
    extraDocuments: number;
  };
  details: ContainerValidationResult[];
}

interface ContainerValidationResult {
  containerName: string;
  documentCountMatch: boolean;
  checksumMatch: boolean;
  sampleValidation: {
    matched: number;
    mismatched: number;
    missing: number;
  };
  issues: string[];
}

// ===== DATA VALIDATOR CLASS =====

class DataValidator {
  private cosmosClient!: CosmosClient;
  private database: any;
  private environment: string;
  private outputDir: string;

  constructor(environment: string, outputDir: string = './deployment-snapshots') {
    this.environment = environment;
    this.outputDir = outputDir;
  }

  /**
   * Initialize Cosmos DB connection
   */
  async initialize(): Promise<void> {
    console.log(`🔗 Initializing Cosmos DB connection for ${this.environment}...`);

    try {
      // Get connection details from Key Vault
      const credential = new DefaultAzureCredential();
      const keyVaultUrl = `https://prepbettr-kv-${this.environment}.vault.azure.net/`;
      const secretClient = new SecretClient(keyVaultUrl, credential);

      const cosmosEndpointSecret = await secretClient.getSecret('cosmos-endpoint');
      const cosmosKeySecret = await secretClient.getSecret('cosmos-key');

      if (!cosmosEndpointSecret.value || !cosmosKeySecret.value) {
        throw new Error('Failed to retrieve Cosmos DB credentials from Key Vault');
      }

      this.cosmosClient = new CosmosClient({
        endpoint: cosmosEndpointSecret.value,
        key: cosmosKeySecret.value
      });

      this.database = this.cosmosClient.database('prepbettr');

      // Test connection
      await this.database.read();
      console.log('✅ Cosmos DB connection established');

    } catch (error) {
      console.error('❌ Failed to initialize Cosmos DB connection:', error);
      throw error;
    }
  }

  /**
   * Create a data snapshot for validation
   */
  async createSnapshot(containers: string[] = [], sampleSize: number = 100): Promise<DataSnapshot> {
    console.log('📸 Creating data snapshot...');

    const snapshotId = `snapshot_${this.environment}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const timestamp = new Date().toISOString();

    // Get all containers if none specified
    if (containers.length === 0) {
      const { resources: containerList } = await this.database.containers.readAll().fetchAll();
      containers = containerList.map((c: any) => c.id);
    }

    const containerSnapshots: ContainerSnapshot[] = [];
    let totalDocuments = 0;

    for (const containerName of containers) {
      console.log(`📦 Processing container: ${containerName}`);
      
      try {
        const container = this.database.container(containerName);
        const containerSnapshot = await this.createContainerSnapshot(container, containerName, sampleSize);
        
        containerSnapshots.push(containerSnapshot);
        totalDocuments += containerSnapshot.documentCount;

      } catch (error) {
        console.warn(`⚠️ Failed to process container ${containerName}:`, error);
      }
    }

    // Calculate overall checksum
    const checksumOverall = this.calculateOverallChecksum(containerSnapshots);

    const snapshot: DataSnapshot = {
      snapshotId,
      timestamp,
      environment: this.environment,
      containers: containerSnapshots,
      metadata: {
        totalDocuments,
        totalContainers: containerSnapshots.length,
        checksumOverall
      }
    };

    // Save snapshot to file
    const snapshotFile = join(this.outputDir, `${snapshotId}.json`);
    writeFileSync(snapshotFile, JSON.stringify(snapshot, null, 2));

    console.log(`✅ Snapshot created: ${snapshotId}`);
    console.log(`📁 Snapshot saved to: ${snapshotFile}`);
    console.log(`📊 Total documents: ${totalDocuments}`);
    console.log(`📦 Containers processed: ${containerSnapshots.length}`);

    return snapshot;
  }

  /**
   * Create snapshot for a single container
   */
  private async createContainerSnapshot(container: Container, containerName: string, sampleSize: number): Promise<ContainerSnapshot> {
    // Get container metadata
    const containerResponse = await container.read();
    const indexingPolicy = containerResponse.resource?.indexingPolicy;
    const partitionKeyPaths = containerResponse.resource?.partitionKey?.paths;

    // Count total documents
    const countQuery = 'SELECT VALUE COUNT(1) FROM c';
    const { resources: countResult } = await container.items.query(countQuery).fetchAll();
    const documentCount = countResult[0] || 0;

    console.log(`  📊 ${containerName}: ${documentCount} documents`);

    // Get sample documents
    const sampleQuery = `SELECT c.id, c._ts, LENGTH(TOSTRING(c)) as size FROM c ORDER BY c._ts DESC OFFSET 0 LIMIT ${sampleSize}`;
    const { resources: sampleDocs } = await container.items.query(sampleQuery).fetchAll();

    const sampleDocuments: DocumentSample[] = [];
    
    for (const doc of sampleDocs) {
      // Get full document for checksum calculation
      const { resource: fullDoc } = await container.item(doc.id).read();
      
      if (fullDoc) {
        const docChecksum = this.calculateDocumentChecksum(fullDoc);
        
        sampleDocuments.push({
          id: doc.id,
          checksum: docChecksum,
          timestamp: doc._ts ? new Date(doc._ts * 1000).toISOString() : undefined,
          size: doc.size || 0
        });
      }
    }

    // Calculate container checksum
    const containerChecksum = this.calculateContainerChecksum(sampleDocuments);

    return {
      name: containerName,
      documentCount,
      sampleDocuments,
      checksum: containerChecksum,
      indexingPolicy,
      partitionKeyPaths
    };
  }

  /**
   * Validate current data against a snapshot
   */
  async validateAgainstSnapshot(snapshotId: string): Promise<ValidationResult> {
    console.log(`🔍 Validating data against snapshot: ${snapshotId}`);

    // Load snapshot
    const snapshotFile = join(this.outputDir, `${snapshotId}.json`);
    const snapshot: DataSnapshot = JSON.parse(readFileSync(snapshotFile, 'utf-8'));

    const validationResult: ValidationResult = {
      success: true,
      errors: [],
      warnings: [],
      summary: {
        totalDocuments: 0,
        validDocuments: 0,
        invalidDocuments: 0,
        missingDocuments: 0,
        extraDocuments: 0
      },
      details: []
    };

    // Validate each container
    for (const containerSnapshot of snapshot.containers) {
      console.log(`🔍 Validating container: ${containerSnapshot.name}`);
      
      try {
        const containerResult = await this.validateContainer(containerSnapshot);
        validationResult.details.push(containerResult);

        // Update summary
        validationResult.summary.totalDocuments += containerSnapshot.documentCount;
        
        if (!containerResult.documentCountMatch) {
          validationResult.errors.push(`Document count mismatch in ${containerSnapshot.name}`);
          validationResult.success = false;
        }

        if (!containerResult.checksumMatch) {
          validationResult.warnings.push(`Data checksum mismatch in ${containerSnapshot.name}`);
        }

        validationResult.summary.validDocuments += containerResult.sampleValidation.matched;
        validationResult.summary.invalidDocuments += containerResult.sampleValidation.mismatched;
        validationResult.summary.missingDocuments += containerResult.sampleValidation.missing;

      } catch (error) {
        const errorMsg = `Failed to validate container ${containerSnapshot.name}: ${error}`;
        validationResult.errors.push(errorMsg);
        validationResult.success = false;
      }
    }

    // Generate validation report
    const reportFile = join(this.outputDir, `validation-report-${Date.now()}.json`);
    writeFileSync(reportFile, JSON.stringify(validationResult, null, 2));

    console.log(`📋 Validation report saved to: ${reportFile}`);
    
    if (validationResult.success) {
      console.log('✅ Data validation passed');
    } else {
      console.log('❌ Data validation failed');
      console.log('Errors:', validationResult.errors);
    }

    return validationResult;
  }

  /**
   * Validate a single container against its snapshot
   */
  private async validateContainer(containerSnapshot: ContainerSnapshot): Promise<ContainerValidationResult> {
    const container = this.database.container(containerSnapshot.name);
    
    // Check document count
    const countQuery = 'SELECT VALUE COUNT(1) FROM c';
    const { resources: countResult } = await container.items.query(countQuery).fetchAll();
    const currentDocumentCount = countResult[0] || 0;
    
    const documentCountMatch = currentDocumentCount === containerSnapshot.documentCount;

    // Check sample documents
    let matched = 0;
    let mismatched = 0;
    let missing = 0;
    const issues: string[] = [];

    for (const sampleDoc of containerSnapshot.sampleDocuments) {
      try {
        const { resource: currentDoc } = await container.item(sampleDoc.id).read();
        
        if (!currentDoc) {
          missing++;
          issues.push(`Document ${sampleDoc.id} is missing`);
          continue;
        }

        const currentChecksum = this.calculateDocumentChecksum(currentDoc);
        
        if (currentChecksum === sampleDoc.checksum) {
          matched++;
        } else {
          mismatched++;
          issues.push(`Document ${sampleDoc.id} has changed (checksum mismatch)`);
        }

      } catch (error) {
        missing++;
        issues.push(`Document ${sampleDoc.id} could not be retrieved: ${error}`);
      }
    }

    // Recalculate container checksum
    const currentContainerChecksum = await this.getCurrentContainerChecksum(container, containerSnapshot.sampleDocuments.length);
    const checksumMatch = currentContainerChecksum === containerSnapshot.checksum;

    return {
      containerName: containerSnapshot.name,
      documentCountMatch,
      checksumMatch,
      sampleValidation: {
        matched,
        mismatched,
        missing
      },
      issues
    };
  }

  /**
   * Compare two snapshots
   */
  async compareSnapshots(snapshot1Id: string, snapshot2Id: string): Promise<any> {
    console.log(`🔄 Comparing snapshots: ${snapshot1Id} vs ${snapshot2Id}`);

    const snapshot1File = join(this.outputDir, `${snapshot1Id}.json`);
    const snapshot2File = join(this.outputDir, `${snapshot2Id}.json`);

    const snapshot1: DataSnapshot = JSON.parse(readFileSync(snapshot1File, 'utf-8'));
    const snapshot2: DataSnapshot = JSON.parse(readFileSync(snapshot2File, 'utf-8'));

    const comparison = {
      snapshot1: {
        id: snapshot1.snapshotId,
        timestamp: snapshot1.timestamp,
        totalDocuments: snapshot1.metadata.totalDocuments
      },
      snapshot2: {
        id: snapshot2.snapshotId,
        timestamp: snapshot2.timestamp,
        totalDocuments: snapshot2.metadata.totalDocuments
      },
      differences: {
        documentCountDiff: snapshot2.metadata.totalDocuments - snapshot1.metadata.totalDocuments,
        containerDifferences: [] as any[]
      }
    };

    // Compare each container
    for (const container1 of snapshot1.containers) {
      const container2 = snapshot2.containers.find(c => c.name === container1.name);
      
      if (!container2) {
        comparison.differences.containerDifferences.push({
          container: container1.name,
          status: 'removed',
          documentCountDiff: -container1.documentCount
        });
        continue;
      }

      const documentCountDiff = container2.documentCount - container1.documentCount;
      const checksumMatch = container1.checksum === container2.checksum;

      if (documentCountDiff !== 0 || !checksumMatch) {
        comparison.differences.containerDifferences.push({
          container: container1.name,
          documentCountDiff,
          checksumMatch,
          status: documentCountDiff === 0 ? 'modified' : 'changed'
        });
      }
    }

    // Check for new containers in snapshot2
    for (const container2 of snapshot2.containers) {
      const container1 = snapshot1.containers.find(c => c.name === container2.name);
      
      if (!container1) {
        comparison.differences.containerDifferences.push({
          container: container2.name,
          status: 'added',
          documentCountDiff: container2.documentCount
        });
      }
    }

    const comparisonFile = join(this.outputDir, `comparison-${Date.now()}.json`);
    writeFileSync(comparisonFile, JSON.stringify(comparison, null, 2));

    console.log(`📊 Comparison report saved to: ${comparisonFile}`);
    console.log(`📈 Document count difference: ${comparison.differences.documentCountDiff}`);

    return comparison;
  }

  // ===== UTILITY METHODS =====

  private calculateDocumentChecksum(document: any): string {
    // Remove system fields and calculate checksum
    const { _rid, _self, _etag, _attachments, _ts, ...cleanDoc } = document;
    const docString = JSON.stringify(cleanDoc, Object.keys(cleanDoc).sort());
    return crypto.createHash('md5').update(docString).digest('hex');
  }

  private calculateContainerChecksum(sampleDocuments: DocumentSample[]): string {
    const checksums = sampleDocuments.map(doc => doc.checksum).sort();
    const combinedChecksum = checksums.join('');
    return crypto.createHash('md5').update(combinedChecksum).digest('hex');
  }

  private calculateOverallChecksum(containerSnapshots: ContainerSnapshot[]): string {
    const containerChecksums = containerSnapshots.map(c => c.checksum).sort();
    const combinedChecksum = containerChecksums.join('');
    return crypto.createHash('md5').update(combinedChecksum).digest('hex');
  }

  private async getCurrentContainerChecksum(container: Container, sampleSize: number): Promise<string> {
    const sampleQuery = `SELECT c.id FROM c ORDER BY c._ts DESC OFFSET 0 LIMIT ${sampleSize}`;
    const { resources: sampleIds } = await container.items.query(sampleQuery).fetchAll();

    const sampleDocuments: DocumentSample[] = [];
    
    for (const docRef of sampleIds) {
      const { resource: doc } = await container.item(docRef.id).read();
      if (doc) {
        sampleDocuments.push({
          id: doc.id,
          checksum: this.calculateDocumentChecksum(doc),
          size: 0
        });
      }
    }

    return this.calculateContainerChecksum(sampleDocuments);
  }
}

// ===== CLI INTERFACE =====

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
Usage: tsx data-validation.ts <command> [options]

Commands:
  snapshot <environment>              Create a data snapshot
  validate <environment> <snapshotId> Validate current data against snapshot  
  compare <snapshot1Id> <snapshot2Id> Compare two snapshots

Options:
  --containers <list>    Comma-separated list of containers (optional)
  --sample-size <num>    Number of sample documents per container (default: 100)
  --output-dir <dir>     Output directory for snapshots (default: ./deployment-snapshots)

Examples:
  tsx data-validation.ts snapshot prod
  tsx data-validation.ts validate prod snapshot_prod_1234567890_abcd
  tsx data-validation.ts compare snapshot1_id snapshot2_id
  tsx data-validation.ts snapshot staging --containers users,interviews --sample-size 50
    `);
    process.exit(1);
  }

  const command = args[0];
  const options: ValidationOptions = {
    environment: args[1] as 'staging' | 'prod',
    operation: command as any,
    containers: [],
    sampleSize: 100,
    outputDir: './deployment-snapshots'
  };

  // Parse additional options
  for (let i = 2; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--containers':
        options.containers = args[++i]?.split(',') || [];
        break;
      case '--sample-size':
        options.sampleSize = parseInt(args[++i]) || 100;
        break;
      case '--output-dir':
        options.outputDir = args[++i] || './deployment-snapshots';
        break;
      default:
        if (!options.snapshotId && command === 'validate') {
          options.snapshotId = arg;
        }
        break;
    }
  }

  // Ensure output directory exists
  const fs = require('fs');
  if (!fs.existsSync(options.outputDir)) {
    fs.mkdirSync(options.outputDir, { recursive: true });
  }

  try {
    const validator = new DataValidator(options.environment, options.outputDir);
    await validator.initialize();

    switch (command) {
      case 'snapshot':
        await validator.createSnapshot(options.containers, options.sampleSize);
        break;

      case 'validate':
        if (!options.snapshotId) {
          console.error('❌ Snapshot ID is required for validation');
          process.exit(1);
        }
        const result = await validator.validateAgainstSnapshot(options.snapshotId);
        process.exit(result.success ? 0 : 1);
        break;

      case 'compare':
        if (args.length < 3) {
          console.error('❌ Two snapshot IDs are required for comparison');
          process.exit(1);
        }
        await validator.compareSnapshots(args[1], args[2]);
        break;

      default:
        console.error(`❌ Unknown command: ${command}`);
        process.exit(1);
    }

  } catch (error) {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { DataValidator };
export type { ValidationResult, DataSnapshot };
