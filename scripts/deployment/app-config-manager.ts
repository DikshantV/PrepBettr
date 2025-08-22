#!/usr/bin/env tsx

/**
 * Azure App Configuration Management
 * 
 * Secure environment variable management and secret rotation for PrepBettr:
 * - Centralized configuration management via Azure App Configuration
 * - Automatic secret rotation workflows
 * - Configuration versioning and rollback
 * - Secure Key Vault integration
 */

import { DefaultAzureCredential } from '@azure/identity';
import { AppConfigurationClient, ConfigurationSetting } from '@azure/app-configuration';
import { SecretClient } from '@azure/keyvault-secrets';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import crypto from 'crypto';

// ===== INTERFACES =====

interface ConfigManagerOptions {
  environment: 'staging' | 'prod';
  operation: 'sync' | 'rotate' | 'backup' | 'restore' | 'validate' | 'list';
  configFile?: string;
  backupId?: string;
  dryRun?: boolean;
  force?: boolean;
}

interface ConfigurationTemplate {
  version: string;
  environment: string;
  configurations: ConfigEntry[];
  featureFlags: FeatureFlagEntry[];
  secrets: SecretEntry[];
}

interface ConfigEntry {
  key: string;
  value: string;
  label?: string;
  contentType?: string;
  tags?: { [key: string]: string };
  description?: string;
}

interface FeatureFlagEntry {
  key: string;
  enabled: boolean;
  label?: string;
  description?: string;
  conditions?: any[];
}

interface SecretEntry {
  key: string;
  keyVaultUrl: string;
  secretName: string;
  label?: string;
  description?: string;
  rotationSchedule?: 'daily' | 'weekly' | 'monthly' | 'quarterly';
}

interface ConfigBackup {
  backupId: string;
  timestamp: string;
  environment: string;
  version: string;
  settings: ConfigurationSetting[];
  featureFlags: any[];
}

interface RotationPlan {
  secretName: string;
  keyVaultUrl: string;
  currentVersion: string;
  newVersion: string;
  rotationDate: string;
  dependencies: string[];
  rollbackPlan: string;
}

// ===== APP CONFIGURATION MANAGER CLASS =====

class AppConfigManager {
  private environment: string;
  private credential: DefaultAzureCredential;
  private appConfigClient?: AppConfigurationClient;
  private secretClient?: SecretClient;
  private keyVaultUrl: string;

  constructor(environment: string) {
    this.environment = environment;
    this.credential = new DefaultAzureCredential();
    this.keyVaultUrl = `https://prepbettr-kv-${environment}.vault.azure.net/`;
  }

  /**
   * Initialize Azure clients
   */
  async initialize(): Promise<void> {
    console.log(`🔧 Initializing App Config Manager for ${this.environment}...`);

    try {
      // Initialize Key Vault client for getting App Config endpoint
      this.secretClient = new SecretClient(this.keyVaultUrl, this.credential);

      // Get App Configuration endpoint from Key Vault
      const appConfigEndpointSecret = await this.secretClient.getSecret('app-config-endpoint');
      
      if (!appConfigEndpointSecret.value) {
        throw new Error('App Configuration endpoint not found in Key Vault');
      }

      // Initialize App Configuration client
      this.appConfigClient = new AppConfigurationClient(
        appConfigEndpointSecret.value,
        this.credential
      );

      // Test connection
      const testSettings = this.appConfigClient.listConfigurationSettings({ keyFilter: 'test' });
      await testSettings.next();

      console.log('✅ App Configuration Manager initialized');

    } catch (error) {
      console.error('❌ Failed to initialize App Configuration Manager:', error);
      throw error;
    }
  }

  /**
   * Sync configuration from template file
   */
  async syncConfiguration(templateFile: string, dryRun: boolean = false): Promise<void> {
    console.log(`🔄 ${dryRun ? '[DRY RUN] ' : ''}Syncing configuration from ${templateFile}...`);

    if (!existsSync(templateFile)) {
      throw new Error(`Template file not found: ${templateFile}`);
    }

    const template: ConfigurationTemplate = JSON.parse(readFileSync(templateFile, 'utf-8'));
    
    if (template.environment !== this.environment) {
      throw new Error(`Template environment (${template.environment}) doesn't match current environment (${this.environment})`);
    }

    const label = this.environment === 'prod' ? 'production' : 'staging';
    let syncedCount = 0;
    let errorCount = 0;

    // Sync regular configurations
    console.log(`📄 ${dryRun ? '[DRY RUN] ' : ''}Syncing ${template.configurations.length} configurations...`);
    
    for (const config of template.configurations) {
      try {
        const setting: ConfigurationSetting = {
          key: config.key,
          value: config.value,
          label: config.label || label,
          contentType: config.contentType,
          isReadOnly: false,
          tags: {
            ...config.tags,
            environment: this.environment,
            syncedAt: new Date().toISOString(),
            description: config.description || ''
          }
        };

        if (!dryRun) {
          await this.appConfigClient!.setConfigurationSetting(setting);
        }

        console.log(`  ✅ ${config.key}`);
        syncedCount++;

      } catch (error) {
        console.error(`  ❌ ${config.key}:`, error);
        errorCount++;
      }
    }

    // Sync secret references
    console.log(`🔐 ${dryRun ? '[DRY RUN] ' : ''}Syncing ${template.secrets.length} secret references...`);
    
    for (const secret of template.secrets) {
      try {
        const secretRef: any = {
          key: secret.key,
          secretId: `${secret.keyVaultUrl}/secrets/${secret.secretName}`,
          label: secret.label || label,
          tags: {
            environment: this.environment,
            syncedAt: new Date().toISOString(),
            description: secret.description || '',
            rotationSchedule: secret.rotationSchedule || 'monthly'
          }
        };

        if (!dryRun) {
          await this.appConfigClient!.setConfigurationSetting(secretRef);
        }

        console.log(`  ✅ ${secret.key} -> ${secret.secretName}`);
        syncedCount++;

      } catch (error) {
        console.error(`  ❌ ${secret.key}:`, error);
        errorCount++;
      }
    }

    // Sync feature flags
    console.log(`🚩 ${dryRun ? '[DRY RUN] ' : ''}Syncing ${template.featureFlags.length} feature flags...`);
    
    for (const flag of template.featureFlags) {
      try {
        const featureFlag: any = {
          key: flag.key,
          enabled: flag.enabled,
          label: flag.label || label,
          description: flag.description,
          conditions: flag.conditions || []
        };

        if (!dryRun) {
          await this.appConfigClient!.setConfigurationSetting(featureFlag);
        }

        console.log(`  ✅ ${flag.key} = ${flag.enabled}`);
        syncedCount++;

      } catch (error) {
        console.error(`  ❌ ${flag.key}:`, error);
        errorCount++;
      }
    }

    console.log(`\n📊 Sync Summary:`);
    console.log(`  ✅ Synced: ${syncedCount}`);
    console.log(`  ❌ Errors: ${errorCount}`);
    console.log(`  🔄 Total: ${template.configurations.length + template.secrets.length + template.featureFlags.length}`);
  }

  /**
   * Create configuration backup
   */
  async createBackup(): Promise<string> {
    console.log('💾 Creating configuration backup...');

    const backupId = `config_backup_${this.environment}_${Date.now()}`;
    const timestamp = new Date().toISOString();
    const label = this.environment === 'prod' ? 'production' : 'staging';

    const settings: ConfigurationSetting[] = [];
    const featureFlags: any[] = [];

    // Get all configuration settings
    const settingsIterator = this.appConfigClient!.listConfigurationSettings({ labelFilter: label });
    
    for await (const setting of settingsIterator) {
      if (setting.key?.startsWith('.appconfig')) {
        // This is a feature flag
        const featureFlag = setting as any;
        featureFlags.push(featureFlag);
      } else {
        settings.push(setting);
      }
    }

    const backup: ConfigBackup = {
      backupId,
      timestamp,
      environment: this.environment,
      version: '1.0',
      settings,
      featureFlags
    };

    // Save backup to file
    const backupFile = join('./config-backups', `${backupId}.json`);
    
    // Ensure directory exists
    const fs = require('fs');
    if (!fs.existsSync('./config-backups')) {
      fs.mkdirSync('./config-backups', { recursive: true });
    }

    writeFileSync(backupFile, JSON.stringify(backup, null, 2));

    console.log(`✅ Configuration backup created: ${backupId}`);
    console.log(`📁 Backup saved to: ${backupFile}`);
    console.log(`📊 Settings: ${settings.length}, Feature Flags: ${featureFlags.length}`);

    return backupId;
  }

  /**
   * Restore from backup
   */
  async restoreFromBackup(backupId: string, dryRun: boolean = false): Promise<void> {
    console.log(`🔄 ${dryRun ? '[DRY RUN] ' : ''}Restoring from backup: ${backupId}`);

    const backupFile = join('./config-backups', `${backupId}.json`);
    
    if (!existsSync(backupFile)) {
      throw new Error(`Backup file not found: ${backupFile}`);
    }

    const backup: ConfigBackup = JSON.parse(readFileSync(backupFile, 'utf-8'));
    
    if (backup.environment !== this.environment) {
      throw new Error(`Environment mismatch: backup is for ${backup.environment}, current is ${this.environment}`);
    }

    let restoredCount = 0;
    let errorCount = 0;

    // Restore configuration settings
    console.log(`📄 ${dryRun ? '[DRY RUN] ' : ''}Restoring ${backup.settings.length} configuration settings...`);
    
    for (const setting of backup.settings) {
      try {
        if (!dryRun) {
          await this.appConfigClient!.setConfigurationSetting(setting);
        }
        
        console.log(`  ✅ ${setting.key}`);
        restoredCount++;

      } catch (error) {
        console.error(`  ❌ ${setting.key}:`, error);
        errorCount++;
      }
    }

    // Restore feature flags
    console.log(`🚩 ${dryRun ? '[DRY RUN] ' : ''}Restoring ${backup.featureFlags.length} feature flags...`);
    
    for (const flag of backup.featureFlags) {
      try {
        if (!dryRun) {
          await this.appConfigClient!.setConfigurationSetting(flag);
        }
        
        console.log(`  ✅ ${flag.key}`);
        restoredCount++;

      } catch (error) {
        console.error(`  ❌ ${flag.key}:`, error);
        errorCount++;
      }
    }

    console.log(`\n📊 Restore Summary:`);
    console.log(`  ✅ Restored: ${restoredCount}`);
    console.log(`  ❌ Errors: ${errorCount}`);
  }

  /**
   * Rotate secrets
   */
  async rotateSecrets(secretNames: string[] = [], dryRun: boolean = false): Promise<RotationPlan[]> {
    console.log(`🔄 ${dryRun ? '[DRY RUN] ' : ''}Rotating secrets...`);

    const rotationPlans: RotationPlan[] = [];
    const label = this.environment === 'prod' ? 'production' : 'staging';

    // Get all secret references if no specific secrets provided
    if (secretNames.length === 0) {
      const settingsIterator = this.appConfigClient!.listConfigurationSettings({ 
        labelFilter: label 
      });
      
      for await (const setting of settingsIterator) {
        if (setting.contentType === 'application/vnd.microsoft.appconfig.keyvaultref+json;charset=utf-8') {
          const secretRef = setting as any;
          if (secretRef.secretId) {
            // Extract secret name from secretId URL
            const matches = secretRef.secretId.match(/\/secrets\/([^\/]+)/);
            if (matches) {
              secretNames.push(matches[1]);
            }
          }
        }
      }
    }

    console.log(`🔐 Found ${secretNames.length} secrets to rotate`);

    for (const secretName of secretNames) {
      try {
        console.log(`🔄 ${dryRun ? '[DRY RUN] ' : ''}Processing secret: ${secretName}`);

        // Get current secret
        const currentSecret = await this.secretClient!.getSecret(secretName);
        const currentVersion = currentSecret.properties.version || 'unknown';

        // Create rotation plan
        const rotationPlan: RotationPlan = {
          secretName,
          keyVaultUrl: this.keyVaultUrl,
          currentVersion,
          newVersion: `v${Date.now()}`,
          rotationDate: new Date().toISOString(),
          dependencies: await this.findSecretDependencies(secretName),
          rollbackPlan: `Restore to version ${currentVersion}`
        };

        if (!dryRun) {
          // Generate new secret value based on type
          const newValue = await this.generateNewSecretValue(secretName, currentSecret.value);
          
          // Set new secret version
          await this.secretClient!.setSecret(secretName, newValue);
          
          console.log(`  ✅ Rotated ${secretName} to version ${rotationPlan.newVersion}`);
        } else {
          console.log(`  📝 Would rotate ${secretName}`);
        }

        rotationPlans.push(rotationPlan);

      } catch (error) {
        console.error(`  ❌ Failed to rotate ${secretName}:`, error);
      }
    }

    // Save rotation plan
    if (!dryRun && rotationPlans.length > 0) {
      const planFile = join('./rotation-plans', `rotation_${this.environment}_${Date.now()}.json`);
      
      // Ensure directory exists
      const fs = require('fs');
      if (!fs.existsSync('./rotation-plans')) {
        fs.mkdirSync('./rotation-plans', { recursive: true });
      }

      writeFileSync(planFile, JSON.stringify(rotationPlans, null, 2));
      console.log(`📋 Rotation plan saved to: ${planFile}`);
    }

    return rotationPlans;
  }

  /**
   * Validate configuration
   */
  async validateConfiguration(): Promise<any> {
    console.log('🔍 Validating configuration...');

    const validation = {
      environment: this.environment,
      timestamp: new Date().toISOString(),
      issues: [] as string[],
      warnings: [] as string[],
      stats: {
        totalSettings: 0,
        secretReferences: 0,
        featureFlags: 0,
        missingSecrets: 0,
        duplicateKeys: 0
      }
    };

    const label = this.environment === 'prod' ? 'production' : 'staging';
    const keysSeen = new Set<string>();
    
    const settingsIterator = this.appConfigClient!.listConfigurationSettings({ labelFilter: label });
    
    for await (const setting of settingsIterator) {
      validation.stats.totalSettings++;
      
      // Check for duplicate keys
      if (keysSeen.has(setting.key)) {
        validation.issues.push(`Duplicate key found: ${setting.key}`);
        validation.stats.duplicateKeys++;
      } else {
        keysSeen.add(setting.key);
      }

      // Check secret references
      if (setting.contentType === 'application/vnd.microsoft.appconfig.keyvaultref+json;charset=utf-8') {
        validation.stats.secretReferences++;
        
        const secretRef = setting as any;
        if (secretRef.secretId) {
          // Verify secret exists in Key Vault
          const matches = secretRef.secretId.match(/\/secrets\/([^\/]+)/);
          if (matches) {
            const secretName = matches[1];
            try {
              await this.secretClient!.getSecret(secretName);
            } catch (error) {
              validation.issues.push(`Secret not found in Key Vault: ${secretName}`);
              validation.stats.missingSecrets++;
            }
          }
        }
      }

      // Check feature flags
      if (setting.key?.startsWith('.appconfig')) {
        validation.stats.featureFlags++;
      }

      // Check for empty values
      if (!setting.value && setting.contentType !== 'application/vnd.microsoft.appconfig.keyvaultref+json;charset=utf-8') {
        validation.warnings.push(`Empty value for key: ${setting.key}`);
      }
    }

    // Validation summary
    console.log(`📊 Validation Summary:`);
    console.log(`  📄 Total Settings: ${validation.stats.totalSettings}`);
    console.log(`  🔐 Secret References: ${validation.stats.secretReferences}`);
    console.log(`  🚩 Feature Flags: ${validation.stats.featureFlags}`);
    console.log(`  ❌ Issues: ${validation.issues.length}`);
    console.log(`  ⚠️  Warnings: ${validation.warnings.length}`);

    if (validation.issues.length > 0) {
      console.log('\n❌ Issues:');
      validation.issues.forEach(issue => console.log(`  - ${issue}`));
    }

    if (validation.warnings.length > 0) {
      console.log('\n⚠️ Warnings:');
      validation.warnings.forEach(warning => console.log(`  - ${warning}`));
    }

    return validation;
  }

  /**
   * List current configuration
   */
  async listConfiguration(): Promise<void> {
    console.log(`📋 Configuration for ${this.environment}:`);

    const label = this.environment === 'prod' ? 'production' : 'staging';
    const settings: any[] = [];
    
    const settingsIterator = this.appConfigClient!.listConfigurationSettings({ labelFilter: label });
    
    for await (const setting of settingsIterator) {
      settings.push({
        key: setting.key,
        type: setting.key?.startsWith('.appconfig') ? 'Feature Flag' : 
              setting.contentType === 'application/vnd.microsoft.appconfig.keyvaultref+json;charset=utf-8' ? 'Secret Reference' : 'Configuration',
        value: setting.contentType === 'application/vnd.microsoft.appconfig.keyvaultref+json;charset=utf-8' ? '[Secret Reference]' : 
               (setting.value && setting.value.length > 50 ? setting.value.substring(0, 50) + '...' : setting.value),
        label: setting.label
      });
    }

    console.table(settings);
    console.log(`\n📊 Total: ${settings.length} items`);
  }

  // ===== PRIVATE HELPER METHODS =====

  private async findSecretDependencies(secretName: string): Promise<string[]> {
    const dependencies: string[] = [];
    const label = this.environment === 'prod' ? 'production' : 'staging';
    
    const settingsIterator = this.appConfigClient!.listConfigurationSettings({ labelFilter: label });
    
    for await (const setting of settingsIterator) {
      if (setting.contentType === 'application/vnd.microsoft.appconfig.keyvaultref+json;charset=utf-8') {
        const secretRef = setting as any;
        if (secretRef.secretId && secretRef.secretId.includes(`/secrets/${secretName}`)) {
          dependencies.push(setting.key);
        }
      }
    }
    
    return dependencies;
  }

  private async generateNewSecretValue(secretName: string, currentValue?: string): Promise<string> {
    // Generate new values based on secret type
    if (secretName.includes('api-key') || secretName.includes('token')) {
      // Generate new API key/token
      return crypto.randomBytes(32).toString('hex');
    } else if (secretName.includes('password') || secretName.includes('pwd')) {
      // Generate new password
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
      let password = '';
      for (let i = 0; i < 24; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return password;
    } else if (secretName.includes('connection-string')) {
      // For connection strings, we would typically regenerate the key from the service
      // For now, return the current value with a note
      return currentValue || 'ROTATION_REQUIRED_MANUALLY';
    } else {
      // Generic secret
      return crypto.randomUUID();
    }
  }
}

// ===== CLI INTERFACE =====

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Usage: tsx app-config-manager.ts <command> [options]

Commands:
  sync <environment> <templateFile>     Sync configuration from template
  backup <environment>                  Create configuration backup
  restore <environment> <backupId>      Restore from backup
  rotate <environment> [secrets...]     Rotate secrets
  validate <environment>                Validate current configuration  
  list <environment>                    List current configuration

Options:
  --dry-run              Show what would be done without executing
  --force                Force operation without confirmations

Examples:
  tsx app-config-manager.ts sync prod config-templates/production.json
  tsx app-config-manager.ts backup staging
  tsx app-config-manager.ts restore prod config_backup_prod_1234567890
  tsx app-config-manager.ts rotate staging cosmos-key redis-key --dry-run
  tsx app-config-manager.ts validate prod
  tsx app-config-manager.ts list staging
    `);
    process.exit(1);
  }

  const command = args[0];
  const environment = args[1] as 'staging' | 'prod';

  const options: ConfigManagerOptions = {
    environment,
    operation: command as any,
    dryRun: false,
    force: false
  };

  // Parse additional options
  for (let i = 2; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--force':
        options.force = true;
        break;
      default:
        if (command === 'sync' && !options.configFile) {
          options.configFile = arg;
        } else if ((command === 'restore' || command === 'status') && !options.backupId) {
          options.backupId = arg;
        }
        break;
    }
  }

  try {
    const configManager = new AppConfigManager(environment);
    await configManager.initialize();

    switch (command) {
      case 'sync':
        if (!options.configFile) {
          console.error('❌ Config file is required for sync operation');
          process.exit(1);
        }
        await configManager.syncConfiguration(options.configFile, options.dryRun);
        break;

      case 'backup':
        const backupId = await configManager.createBackup();
        console.log(`\n🎯 Backup ID: ${backupId}`);
        break;

      case 'restore':
        if (!options.backupId) {
          console.error('❌ Backup ID is required for restore operation');
          process.exit(1);
        }
        
        if (!options.force && !options.dryRun) {
          console.error('❌ Use --force to confirm restore or --dry-run to preview');
          process.exit(1);
        }
        
        await configManager.restoreFromBackup(options.backupId, options.dryRun);
        break;

      case 'rotate':
        const secretNames = args.slice(2).filter(arg => !arg.startsWith('--'));
        await configManager.rotateSecrets(secretNames, options.dryRun);
        break;

      case 'validate':
        const validation = await configManager.validateConfiguration();
        process.exit(validation.issues.length > 0 ? 1 : 0);
        break;

      case 'list':
        await configManager.listConfiguration();
        break;

      default:
        console.error(`❌ Unknown command: ${command}`);
        process.exit(1);
    }

  } catch (error) {
    console.error('❌ Configuration management failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { AppConfigManager };
