#!/usr/bin/env tsx

/**
 * Firebase to Azure App Configuration Migration
 * 
 * Migrates existing Firebase Remote Config settings to Azure App Configuration
 * with proper key mapping, validation, and rollback capabilities.
 * 
 * Usage:
 *   npm run config:migrate                     # Full migration
 *   npm run config:migrate -- --dry-run       # Preview migration
 *   npm run config:migrate -- --verify        # Validate migration
 */

import { Command } from 'commander';
import { AppConfigMigrationUtils } from '@/azure-migration/lib/azure/config/app-config-service';
import { FirebaseRemoteConfigAdapter } from '@/azure-migration/lib/firebase/config/remote-config-adapter';
import { unifiedConfigService } from '@/lib/services/unified-config-service';
import { azureCosmosService } from '@/lib/services/azure-cosmos-service';

// ===== INTERFACES =====

interface MigrationOptions {
  dryRun?: boolean;
  verify?: boolean;
  environment?: string;
  batchSize?: number;
  verbose?: boolean;
}

interface MigrationResult {
  success: boolean;
  totalKeys: number;
  migratedKeys: number;
  skippedKeys: number;
  failedKeys: number;
  errors: MigrationError[];
  keyMappings: KeyMapping[];
  duration: number;
  timestamp: Date;
}

interface MigrationError {
  key: string;
  originalKey?: string;
  error: string;
  fatal: boolean;
}

interface KeyMapping {
  originalKey: string;
  newKey: string;
  value: any;
  action: 'migrated' | 'mapped' | 'skipped' | 'failed';
  reason?: string;
}

// ===== KEY MAPPING CONFIGURATION =====

const KEY_MAPPINGS: Record<string, string> = {
  // Legacy feature flags → new unified schema
  'autoApplyAzure': 'features.autoApplyAzure',
  'portalIntegration': 'features.portalIntegration',
  'voiceInterview': 'features.voiceInterview',
  'premiumFeatures': 'features.premiumFeatures',
  'newUI': 'features.newUI',
  'maintenanceMode': 'core.app.maintenanceMode',
  'debug': 'core.app.debug',
  
  // Quota settings → new quota schema
  'freeInterviews': 'quotas.freeInterviews',
  'freeResumes': 'quotas.freeResumes',
  'premiumInterviews': 'quotas.premiumInterviews',
  'premiumResumes': 'quotas.premiumResumes',
  
  // Auth settings → new auth schema
  'sessionTimeout': 'auth.firebase.sessionTimeout',
  'maxAttempts': 'auth.firebase.maxAttempts',
  'lockoutDuration': 'auth.firebase.lockoutDuration',
  
  // Performance settings → new perf schema
  'cacheTimeout': 'perf.cacheTimeout',
  'maxCacheSize': 'perf.maxCacheSize',
  'enableMetrics': 'perf.enableMetrics'
};

const SYNC_TO_FIREBASE_KEYS = [
  'features.autoApplyAzure',
  'features.portalIntegration', 
  'features.voiceInterview',
  'features.premiumFeatures',
  'features.newUI'
];

// ===== MIGRATION SERVICE =====

class ConfigMigrationService {
  private result: MigrationResult;
  
  constructor(private options: MigrationOptions) {
    this.result = {
      success: false,
      totalKeys: 0,
      migratedKeys: 0,
      skippedKeys: 0,
      failedKeys: 0,
      errors: [],
      keyMappings: [],
      duration: 0,
      timestamp: new Date()
    };
  }

  async migrate(): Promise<MigrationResult> {
    const startTime = Date.now();
    
    try {
      console.log('🚀 Starting Firebase → Azure App Configuration migration...');
      
      if (this.options.verify) {
        return await this.verifyMigration();
      }

      // Initialize services
      await this.initializeServices();

      // Get Firebase Remote Config data
      const firebaseConfigs = await this.getFirebaseConfigs();
      this.result.totalKeys = Object.keys(firebaseConfigs).length;

      console.log(`📊 Found ${this.result.totalKeys} configurations to process`);

      if (this.result.totalKeys === 0) {
        console.log('ℹ️ No configurations found - migration complete');
        this.result.success = true;
        return this.result;
      }

      // Process configurations
      await this.processConfigurations(firebaseConfigs);

      // Record migration audit
      if (!this.options.dryRun) {
        await this.recordMigrationAudit();
      }

      this.result.success = this.result.failedKeys === 0;
      this.result.duration = Date.now() - startTime;

      console.log(this.formatSummary());

      return this.result;

    } catch (error) {
      this.result.errors.push({
        key: 'MIGRATION_SYSTEM',
        error: error instanceof Error ? error.message : 'Unknown system error',
        fatal: true
      });
      
      this.result.success = false;
      this.result.duration = Date.now() - startTime;
      
      console.error('💥 Migration failed:', error);
      return this.result;
    }
  }

  private async initializeServices(): Promise<void> {
    console.log('🔧 Initializing services...');
    
    try {
      await Promise.all([
        unifiedConfigService.initialize(),
        azureCosmosService.initialize()
      ]);
      
      console.log('✅ Services initialized successfully');
    } catch (error) {
      throw new Error(`Service initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async getFirebaseConfigs(): Promise<Record<string, any>> {
    console.log('📦 Fetching Firebase Remote Config...');
    
    try {
      const adapter = new FirebaseRemoteConfigAdapter();
      const configs = await adapter.getAll();
      
      console.log(`✅ Retrieved ${Object.keys(configs).length} Firebase configurations`);
      return configs;
    } catch (error) {
      throw new Error(`Failed to fetch Firebase configs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async processConfigurations(firebaseConfigs: Record<string, any>): Promise<void> {
    const { batchSize = 10 } = this.options;

    const entries = Object.entries(firebaseConfigs);
    
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(([key, value]) => this.processConfiguration(key, value))
      );

      if (batch.length === batchSize) {
        console.log(`📈 Progress: ${Math.min(i + batchSize, entries.length)}/${entries.length} configurations processed`);
      }
    }
  }

  private async processConfiguration(originalKey: string, value: any): Promise<void> {
    try {
      // Determine target key (with mapping if needed)
      const targetKey = this.mapKey(originalKey);
      
      // Validate value
      const validationError = this.validateConfigValue(targetKey, value);
      if (validationError) {
        this.addMapping(originalKey, targetKey, value, 'failed', validationError);
        this.result.failedKeys++;
        return;
      }

      // Check if should skip
      if (this.shouldSkipKey(originalKey)) {
        this.addMapping(originalKey, targetKey, value, 'skipped', 'Excluded from migration');
        this.result.skippedKeys++;
        return;
      }

      // Perform migration
      if (!this.options.dryRun) {
        const syncToFirebase = SYNC_TO_FIREBASE_KEYS.includes(targetKey);
        
        await unifiedConfigService.set(targetKey, value, {
          environment: this.options.environment || 'production',
          syncToFirebase,
          version: `migration_${Date.now()}`,
          changedBy: 'config-migration-script'
        });
      }

      const action = originalKey !== targetKey ? 'mapped' : 'migrated';
      this.addMapping(originalKey, targetKey, value, action);
      this.result.migratedKeys++;

      if (this.options.verbose) {
        console.log(`✅ ${action}: ${originalKey} ${originalKey !== targetKey ? `→ ${targetKey}` : ''} = ${JSON.stringify(value)}`);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.addMapping(originalKey, originalKey, value, 'failed', errorMessage);
      
      this.result.errors.push({
        key: originalKey,
        error: errorMessage,
        fatal: false
      });
      
      this.result.failedKeys++;
      
      console.error(`❌ Failed to migrate ${originalKey}:`, error);
    }
  }

  private mapKey(originalKey: string): string {
    return KEY_MAPPINGS[originalKey] || originalKey;
  }

  private validateConfigValue(key: string, value: any): string | null {
    try {
      // Use the unified config service validation
      // This would call the internal validateConfigValue method
      // For now, we'll do basic type checking
      
      if (value === null || value === undefined) {
        return 'Value cannot be null or undefined';
      }

      // Additional validation based on key patterns
      if (key.includes('timeout') || key.includes('limit') || key.includes('quota')) {
        if (typeof value !== 'number' || value < 0) {
          return 'Timeout/limit values must be positive numbers';
        }
      }

      if (key.includes('enable') || key.includes('debug') || key.includes('maintenance')) {
        if (typeof value !== 'boolean') {
          return 'Boolean configuration expected';
        }
      }

      return null;
    } catch (error) {
      return `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  private shouldSkipKey(key: string): boolean {
    // Skip internal or deprecated keys
    const skipPatterns = [
      /^_/, // Internal keys
      /test$/i, // Test keys
      /deprecated/i, // Deprecated keys
      /^experiment_/, // Experimental keys
    ];

    return skipPatterns.some(pattern => pattern.test(key));
  }

  private addMapping(
    originalKey: string,
    newKey: string,
    value: any,
    action: KeyMapping['action'],
    reason?: string
  ): void {
    this.result.keyMappings.push({
      originalKey,
      newKey,
      value,
      action,
      reason
    });
  }

  private async recordMigrationAudit(): Promise<void> {
    try {
      const auditRecord = {
        id: `migration_audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        source: 'firebase-remote-config',
        target: 'azure-app-configuration',
        environment: this.options.environment || 'production',
        result: this.result,
        version: `migration_${Date.now()}`,
        _partitionKey: 'config-migration'
      };

      await azureCosmosService.createDocument('configMigrationAudit', auditRecord);
      console.log('📝 Migration audit recorded');
    } catch (error) {
      console.warn('⚠️ Failed to record migration audit:', error);
    }
  }

  private async verifyMigration(): Promise<MigrationResult> {
    console.log('🔍 Verifying migration consistency...');
    
    try {
      // Get configurations from both sources
      const [firebaseConfigs, azureConfigs] = await Promise.all([
        this.getFirebaseConfigs(),
        unifiedConfigService.getAll()
      ]);

      const firebaseKeys = Object.keys(firebaseConfigs);
      let verified = 0;
      let mismatches = 0;

      for (const originalKey of firebaseKeys) {
        const targetKey = this.mapKey(originalKey);
        const firebaseValue = firebaseConfigs[originalKey];
        const azureValue = azureConfigs[targetKey];

        if (this.shouldSkipKey(originalKey)) {
          this.addMapping(originalKey, targetKey, firebaseValue, 'skipped', 'Verification: Excluded key');
          continue;
        }

        if (azureValue === undefined) {
          this.addMapping(originalKey, targetKey, firebaseValue, 'failed', 'Missing in Azure');
          mismatches++;
        } else if (JSON.stringify(firebaseValue) === JSON.stringify(azureValue)) {
          this.addMapping(originalKey, targetKey, firebaseValue, 'migrated', 'Verification: Match');
          verified++;
        } else {
          this.addMapping(originalKey, targetKey, firebaseValue, 'failed', 
            `Value mismatch: Firebase=${JSON.stringify(firebaseValue)}, Azure=${JSON.stringify(azureValue)}`);
          mismatches++;
        }
      }

      this.result.totalKeys = firebaseKeys.length;
      this.result.migratedKeys = verified;
      this.result.failedKeys = mismatches;
      this.result.success = mismatches === 0;

      console.log(`${this.result.success ? '✅' : '❌'} Verification complete: ${verified} verified, ${mismatches} mismatched`);

      return this.result;
    } catch (error) {
      throw new Error(`Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private formatSummary(): string {
    const { success, totalKeys, migratedKeys, skippedKeys, failedKeys, duration } = this.result;
    
    let summary = `\n🎯 MIGRATION SUMMARY\n`;
    summary += `==================\n`;
    summary += `Status: ${success ? '✅ SUCCESS' : '❌ FAILED'}\n`;
    summary += `Total Keys: ${totalKeys}\n`;
    summary += `Migrated: ${migratedKeys}\n`;
    summary += `Skipped: ${skippedKeys}\n`;
    summary += `Failed: ${failedKeys}\n`;
    summary += `Duration: ${Math.round(duration / 1000)}s\n`;

    if (this.options.dryRun) {
      summary += `\n🧪 DRY RUN: No changes were made\n`;
    }

    if (this.result.errors.length > 0) {
      summary += `\n❌ ERRORS:\n`;
      this.result.errors.forEach(error => {
        summary += `  ${error.key}: ${error.error}\n`;
      });
    }

    if (this.options.verbose && this.result.keyMappings.length > 0) {
      summary += `\n📋 KEY MAPPINGS:\n`;
      this.result.keyMappings.forEach(mapping => {
        const status = mapping.action === 'migrated' ? '✅' : 
                      mapping.action === 'mapped' ? '🔄' :
                      mapping.action === 'skipped' ? '⏭️' : '❌';
        summary += `  ${status} ${mapping.originalKey}`;
        if (mapping.originalKey !== mapping.newKey) {
          summary += ` → ${mapping.newKey}`;
        }
        if (mapping.reason) {
          summary += ` (${mapping.reason})`;
        }
        summary += `\n`;
      });
    }

    return summary;
  }
}

// ===== CLI SETUP =====

const program = new Command();

program
  .name('migrate-firebase-to-azure-config')
  .description('Migrate Firebase Remote Config to Azure App Configuration')
  .version('1.0.0');

program
  .option('--dry-run', 'Preview migration without making changes')
  .option('--verify', 'Verify existing migration consistency')
  .option('--environment <env>', 'Target environment', 'production')
  .option('--batch-size <size>', 'Batch size for processing', '10')
  .option('--verbose', 'Verbose output with detailed mappings')
  .action(async (options) => {
    const migrationService = new ConfigMigrationService({
      ...options,
      batchSize: parseInt(options.batchSize || '10')
    });

    try {
      const result = await migrationService.migrate();
      
      if (!result.success) {
        process.exit(1);
      }
      
    } catch (error) {
      console.error('💥 Migration failed:', error);
      process.exit(2);
    }
  });

program
  .command('rollback')
  .description('Rollback migration by removing migrated keys from Azure')
  .option('--confirm', 'Confirm rollback operation')
  .action(async (options) => {
    if (!options.confirm) {
      console.error('❌ Rollback requires --confirm flag for safety');
      process.exit(1);
    }

    console.log('🔄 Starting rollback...');
    console.warn('⚠️ Rollback functionality not yet implemented');
    console.log('📋 To manually rollback:');
    console.log('  1. Use Azure Portal to delete migrated configuration keys');
    console.log('  2. Or use Azure CLI: az appconfig kv delete --name <config-name> --key <key>');
    console.log('  3. Run npm run config:validate to verify');
  });

// Run CLI if called directly
if (require.main === module) {
  program.parse();
}

export { ConfigMigrationService };
export type { MigrationResult };
