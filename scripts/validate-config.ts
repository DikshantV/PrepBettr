#!/usr/bin/env tsx

/**
 * Configuration Validation and Drift Detection CLI
 * 
 * Validates configuration consistency across Azure App Configuration 
 * and Firebase Remote Config, ensuring 100% sync compliance.
 * 
 * Usage:
 *   npm run config:validate                    # Full validation
 *   npm run config:validate --drift-only      # Drift detection only
 *   npm run config:validate --cosmos-check    # Include Cosmos DB config check
 *   npm run config:validate --ci              # CI mode with exit codes
 */

import { Command } from 'commander';
import { unifiedConfigService, CONFIG_SCHEMA, CONFIG_DEFAULTS } from '@/lib/services/unified-config-service';
import { azureAppConfigService } from '@/lib/services/azure-app-config-service';
// Firebase Remote Config service import removed - using unified config service instead
import { azureCosmosService } from '@/lib/services/azure-cosmos-service';

// ===== INTERFACES =====

interface ValidationResult {
  overall: 'valid' | 'drift' | 'error';
  timestamp: Date;
  summary: {
    totalKeys: number;
    validKeys: number;
    driftedKeys: number;
    errorKeys: number;
    missingKeys: number;
  };
  details: ValidationDetail[];
  cosmosDbCheck?: CosmosConfigCheck;
  schemaValidation: SchemaValidationResult;
}

interface ValidationDetail {
  key: string;
  status: 'valid' | 'drift' | 'error' | 'missing_azure' | 'missing_firebase' | 'schema_violation';
  azureValue?: any;
  firebaseValue?: any;
  azureHash?: string;
  firebaseHash?: string;
  expectedType?: string;
  actualType?: string;
  error?: string;
  lastChecked: Date;
}

interface CosmosConfigCheck {
  connectionValid: boolean;
  configurationKeys: {
    present: string[];
    missing: string[];
    invalid: string[];
  };
  containerAccess: boolean;
  throughputSettings?: {
    current: number;
    configured: number;
    match: boolean;
  };
}

interface SchemaValidationResult {
  valid: boolean;
  requiredKeysMissing: string[];
  typeViolations: string[];
  enumViolations: string[];
  rangeViolations: string[];
}

// ===== CONFIGURATION VALIDATOR =====

class ConfigurationValidator {
  private results: ValidationResult;
  
  constructor(
    private options: {
      driftOnly?: boolean;
      cosmosCheck?: boolean;
      ciMode?: boolean;
      verbose?: boolean;
    } = {}
  ) {
    this.results = {
      overall: 'valid',
      timestamp: new Date(),
      summary: {
        totalKeys: 0,
        validKeys: 0,
        driftedKeys: 0,
        errorKeys: 0,
        missingKeys: 0
      },
      details: [],
      schemaValidation: {
        valid: true,
        requiredKeysMissing: [],
        typeViolations: [],
        enumViolations: [],
        rangeViolations: []
      }
    };
  }

  /**
   * Main validation orchestrator
   */
  async validate(): Promise<ValidationResult> {
    try {
      console.log('🔍 Starting configuration validation...');
      
      // Initialize services
      await this.initializeServices();
      
      // Schema validation
      if (!this.options.driftOnly) {
        await this.validateConfigurationSchema();
      }
      
      // Drift detection
      await this.detectConfigurationDrift();
      
      // Cosmos DB configuration check
      if (this.options.cosmosCheck) {
        await this.validateCosmosConfiguration();
      }
      
      // Determine overall status
      this.determineOverallStatus();
      
      console.log('✅ Validation completed');
      return this.results;
      
    } catch (error) {
      console.error('❌ Validation failed:', error);
      this.results.overall = 'error';
      this.results.details.push({
        key: 'SYSTEM_ERROR',
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        lastChecked: new Date()
      });
      
      return this.results;
    }
  }

  private async initializeServices(): Promise<void> {
    console.log('🚀 Initializing services...');
    
    try {
      await Promise.all([
        unifiedConfigService.initialize(),
        azureCosmosService.initialize()
      ]);
      
      console.log('✅ Services initialized');
    } catch (error) {
      console.error('❌ Service initialization failed:', error);
      throw error;
    }
  }

  /**
   * Validate against configuration schema
   */
  private async validateConfigurationSchema(): Promise<void> {
    console.log('📋 Validating configuration schema...');
    
    try {
      // Get all configurations
      const allConfigs = await unifiedConfigService.getAll();
      
      // Check required keys
      for (const [key, rule] of Object.entries(CONFIG_SCHEMA)) {
        if (rule.required && allConfigs[key] === undefined) {
          this.results.schemaValidation.requiredKeysMissing.push(key);
          this.results.details.push({
            key,
            status: 'schema_violation',
            error: 'Required key is missing',
            lastChecked: new Date()
          });
        }
      }
      
      // Type and constraint validation
      for (const [key, value] of Object.entries(allConfigs)) {
        const rule = CONFIG_SCHEMA[key];
        if (!rule) continue; // Skip unknown keys
        
        const violation = this.validateSingleConfigValue(key, value, rule);
        if (violation) {
          this.results.details.push({
            key,
            status: 'schema_violation',
            azureValue: value,
            expectedType: rule.type,
            actualType: typeof value,
            error: violation,
            lastChecked: new Date()
          });
          
          if (violation.includes('type')) {
            this.results.schemaValidation.typeViolations.push(key);
          } else if (violation.includes('enum')) {
            this.results.schemaValidation.enumViolations.push(key);
          } else if (violation.includes('range')) {
            this.results.schemaValidation.rangeViolations.push(key);
          }
        }
      }
      
      // Update schema validation status
      this.results.schemaValidation.valid = 
        this.results.schemaValidation.requiredKeysMissing.length === 0 &&
        this.results.schemaValidation.typeViolations.length === 0 &&
        this.results.schemaValidation.enumViolations.length === 0 &&
        this.results.schemaValidation.rangeViolations.length === 0;
        
      console.log(`${this.results.schemaValidation.valid ? '✅' : '⚠️'} Schema validation completed`);
      
    } catch (error) {
      console.error('❌ Schema validation failed:', error);
      throw error;
    }
  }

  private validateSingleConfigValue(key: string, value: any, rule: any): string | null {
    // Type validation
    const expectedType = rule.type;
    const actualType = Array.isArray(value) ? 'array' : 
                      typeof value === 'object' ? 'object' : 
                      typeof value;
    
    if (expectedType !== actualType) {
      return `Type mismatch: expected ${expectedType}, got ${actualType}`;
    }
    
    // Enum validation
    if (rule.enum && !rule.enum.includes(value)) {
      return `Enum violation: value must be one of ${rule.enum.join(', ')}`;
    }
    
    // Range validation for numbers
    if (rule.type === 'number') {
      if (rule.min !== undefined && value < rule.min) {
        return `Range violation: value ${value} is below minimum ${rule.min}`;
      }
      if (rule.max !== undefined && value > rule.max) {
        return `Range violation: value ${value} is above maximum ${rule.max}`;
      }
    }
    
    // Pattern validation for strings
    if (rule.type === 'string' && rule.pattern && !rule.pattern.test(value)) {
      return `Pattern violation: value does not match required pattern`;
    }
    
    return null;
  }

  /**
   * Detect drift between Azure and Firebase configurations
   */
  private async detectConfigurationDrift(): Promise<void> {
    console.log('🔍 Detecting configuration drift...');
    
    try {
      // Get configurations that should be synced
      const syncKeys = Object.keys(CONFIG_DEFAULTS).filter(key => 
        CONFIG_DEFAULTS[key].metadata?.syncToFirebase
      );
      
      console.log(`📊 Checking ${syncKeys.length} keys for drift`);
      
      const driftPromises = syncKeys.map(async (key) => {
        return await this.checkSingleKeyForDrift(key);
      });
      
      const driftResults = await Promise.all(driftPromises);
      this.results.details.push(...driftResults);
      
      // Update summary counts
      this.updateSummaryCounts();
      
      const driftedCount = driftResults.filter(r => r.status === 'drift').length;
      console.log(`${driftedCount === 0 ? '✅' : '⚠️'} Drift detection completed: ${driftedCount} drifted keys`);
      
    } catch (error) {
      console.error('❌ Drift detection failed:', error);
      throw error;
    }
  }

  private async checkSingleKeyForDrift(key: string): Promise<ValidationDetail> {
    try {
      // Get values from both sources
      const [azureValue, firebaseValue] = await Promise.all([
        this.getAzureValue(key),
        this.getFirebaseValue(key)
      ]);
      
      // Calculate hashes
      const azureHash = this.calculateHash(azureValue);
      const firebaseHash = this.calculateHash(firebaseValue);
      
      // Determine status
      let status: ValidationDetail['status'];
      if (azureValue === null && firebaseValue === null) {
        status = 'valid'; // Both missing is valid
      } else if (azureValue === null) {
        status = 'missing_azure';
        this.results.summary.missingKeys++;
      } else if (firebaseValue === null) {
        status = 'missing_firebase';
        this.results.summary.missingKeys++;
      } else if (azureHash === firebaseHash) {
        status = 'valid';
        this.results.summary.validKeys++;
      } else {
        status = 'drift';
        this.results.summary.driftedKeys++;
      }
      
      return {
        key,
        status,
        azureValue,
        firebaseValue,
        azureHash,
        firebaseHash,
        lastChecked: new Date()
      };
      
    } catch (error) {
      this.results.summary.errorKeys++;
      return {
        key,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        lastChecked: new Date()
      };
    }
  }

  private async getAzureValue(key: string): Promise<any> {
    try {
      return await azureAppConfigService.getConfigValue(key);
    } catch (error) {
      return null;
    }
  }

  private async getFirebaseValue(key: string): Promise<any> {
    try {
      // Firebase values are now accessed through the unified config service
      return await unifiedConfigService.get(key, { source: 'firebase' });
    } catch (error) {
      return null;
    }
  }

  /**
   * Validate Cosmos DB configuration
   */
  private async validateCosmosConfiguration(): Promise<void> {
    console.log('🗄️ Validating Cosmos DB configuration...');
    
    try {
      const cosmosCheck: CosmosConfigCheck = {
        connectionValid: false,
        configurationKeys: {
          present: [],
          missing: [],
          invalid: []
        },
        containerAccess: false
      };
      
      // Test connection
      const healthCheck = await azureCosmosService.healthCheck();
      cosmosCheck.connectionValid = healthCheck.status === 'healthy';
      
      if (cosmosCheck.connectionValid) {
        // Check container access
        try {
          await azureCosmosService.queryDocuments('users', 'SELECT VALUE COUNT(1) FROM c', []);
          cosmosCheck.containerAccess = true;
        } catch (error) {
          cosmosCheck.containerAccess = false;
        }
        
        // Check Cosmos-related configuration keys
        const cosmosKeys = Object.keys(CONFIG_SCHEMA).filter(key => key.startsWith('data.cosmos'));
        
        for (const key of cosmosKeys) {
          try {
            const value = await unifiedConfigService.get(key);
            if (value !== undefined) {
              cosmosCheck.configurationKeys.present.push(key);
            } else {
              cosmosCheck.configurationKeys.missing.push(key);
            }
          } catch (error) {
            cosmosCheck.configurationKeys.invalid.push(key);
          }
        }
      }
      
      this.results.cosmosDbCheck = cosmosCheck;
      
      console.log(`${cosmosCheck.connectionValid ? '✅' : '❌'} Cosmos DB validation completed`);
      
    } catch (error) {
      console.error('❌ Cosmos DB validation failed:', error);
      this.results.cosmosDbCheck = {
        connectionValid: false,
        configurationKeys: { present: [], missing: [], invalid: [] },
        containerAccess: false
      };
    }
  }

  private updateSummaryCounts(): void {
    this.results.summary.totalKeys = this.results.details.length;
    this.results.summary.validKeys = this.results.details.filter(d => d.status === 'valid').length;
    this.results.summary.driftedKeys = this.results.details.filter(d => d.status === 'drift').length;
    this.results.summary.errorKeys = this.results.details.filter(d => d.status === 'error').length;
    this.results.summary.missingKeys = this.results.details.filter(d => 
      d.status === 'missing_azure' || d.status === 'missing_firebase'
    ).length;
  }

  private determineOverallStatus(): void {
    if (this.results.summary.errorKeys > 0 || !this.results.schemaValidation.valid) {
      this.results.overall = 'error';
    } else if (this.results.summary.driftedKeys > 0 || this.results.summary.missingKeys > 0) {
      this.results.overall = 'drift';
    } else {
      this.results.overall = 'valid';
    }
  }

  private calculateHash(value: any): string {
    const crypto = require('crypto');
    const normalized = JSON.stringify(value, Object.keys(value || {}).sort());
    return crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 16);
  }

  /**
   * Output results in various formats
   */
  outputResults(): void {
    if (this.options.ciMode) {
      this.outputForCI();
    } else {
      this.outputForHumans();
    }
  }

  private outputForCI(): void {
    // JSON output for CI processing
    console.log(JSON.stringify(this.results, null, 2));
  }

  private outputForHumans(): void {
    console.log('\n🎯 CONFIGURATION VALIDATION REPORT');
    console.log('='.repeat(50));
    
    // Summary
    console.log(`Overall Status: ${this.getStatusEmoji(this.results.overall)} ${this.results.overall.toUpperCase()}`);
    console.log(`Timestamp: ${this.results.timestamp.toISOString()}`);
    console.log('');
    
    console.log('📊 SUMMARY:');
    console.log(`  Total Keys: ${this.results.summary.totalKeys}`);
    console.log(`  Valid: ${this.results.summary.validKeys}`);
    console.log(`  Drifted: ${this.results.summary.driftedKeys}`);
    console.log(`  Missing: ${this.results.summary.missingKeys}`);
    console.log(`  Errors: ${this.results.summary.errorKeys}`);
    console.log('');
    
    // Schema validation
    if (!this.options.driftOnly) {
      console.log(`📋 SCHEMA VALIDATION: ${this.results.schemaValidation.valid ? '✅ VALID' : '❌ INVALID'}`);
      if (this.results.schemaValidation.requiredKeysMissing.length > 0) {
        console.log(`  Missing Required: ${this.results.schemaValidation.requiredKeysMissing.join(', ')}`);
      }
      if (this.results.schemaValidation.typeViolations.length > 0) {
        console.log(`  Type Violations: ${this.results.schemaValidation.typeViolations.join(', ')}`);
      }
      if (this.results.schemaValidation.enumViolations.length > 0) {
        console.log(`  Enum Violations: ${this.results.schemaValidation.enumViolations.join(', ')}`);
      }
      if (this.results.schemaValidation.rangeViolations.length > 0) {
        console.log(`  Range Violations: ${this.results.schemaValidation.rangeViolations.join(', ')}`);
      }
      console.log('');
    }
    
    // Drift details
    const driftedKeys = this.results.details.filter(d => d.status === 'drift');
    if (driftedKeys.length > 0) {
      console.log('⚠️ DRIFT DETECTED:');
      driftedKeys.forEach(detail => {
        console.log(`  ${detail.key}:`);
        console.log(`    Azure: ${JSON.stringify(detail.azureValue)}`);
        console.log(`    Firebase: ${JSON.stringify(detail.firebaseValue)}`);
      });
      console.log('');
    }
    
    // Error details
    const errorKeys = this.results.details.filter(d => d.status === 'error');
    if (errorKeys.length > 0) {
      console.log('❌ ERRORS:');
      errorKeys.forEach(detail => {
        console.log(`  ${detail.key}: ${detail.error}`);
      });
      console.log('');
    }
    
    // Cosmos DB check
    if (this.results.cosmosDbCheck) {
      console.log(`🗄️ COSMOS DB CHECK: ${this.results.cosmosDbCheck.connectionValid ? '✅ CONNECTED' : '❌ DISCONNECTED'}`);
      if (this.results.cosmosDbCheck.configurationKeys.missing.length > 0) {
        console.log(`  Missing Config: ${this.results.cosmosDbCheck.configurationKeys.missing.join(', ')}`);
      }
      console.log('');
    }
    
    if (this.options.verbose) {
      console.log('📋 DETAILED RESULTS:');
      console.log(JSON.stringify(this.results, null, 2));
    }
  }

  private getStatusEmoji(status: string): string {
    switch (status) {
      case 'valid': return '✅';
      case 'drift': return '⚠️';
      case 'error': return '❌';
      default: return '❓';
    }
  }

  getExitCode(): number {
    if (this.results.overall === 'error') return 2;
    if (this.results.overall === 'drift') return 1;
    return 0;
  }
}

// ===== CLI SETUP =====

const program = new Command();

program
  .name('validate-config')
  .description('Validate configuration consistency and detect drift')
  .version('1.0.0');

program
  .option('--drift-only', 'Only perform drift detection, skip schema validation')
  .option('--cosmos-check', 'Include Cosmos DB configuration validation')
  .option('--ci', 'CI mode - JSON output and exit codes')
  .option('--verbose', 'Verbose output with full details')
  .action(async (options) => {
    const validator = new ConfigurationValidator(options);
    
    try {
      await validator.validate();
      validator.outputResults();
      
      if (options.ci) {
        process.exit(validator.getExitCode());
      }
      
    } catch (error) {
      console.error('💥 Validation failed:', error);
      process.exit(2);
    }
  });

program
  .command('fix-drift')
  .description('Automatically fix detected drift by syncing Azure to Firebase')
  .option('--dry-run', 'Preview fixes without applying them')
  .action(async (options) => {
    console.log('🔧 Auto-fixing configuration drift...');
    
    try {
      // Call the config sync function
      const response = await fetch(
        process.env.AZURE_FUNCTION_CONFIG_SYNC_URL || 'http://localhost:7071/api/config-sync',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dryRun: options.dryRun, forceSync: true })
        }
      );
      
      const result = await response.json();
      
      if (result.result?.success) {
        console.log(`✅ Fixed ${result.result.syncedCount} drifted configurations`);
      } else {
        console.error('❌ Fix failed:', result.result?.errors || ['Unknown error']);
        process.exit(1);
      }
      
    } catch (error) {
      console.error('💥 Auto-fix failed:', error);
      process.exit(2);
    }
  });

// Run CLI if called directly
if (require.main === module) {
  program.parse();
}

export { ConfigurationValidator };
export type { ValidationResult };
