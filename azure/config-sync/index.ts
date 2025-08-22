/**
 * Azure Function: Config Sync
 * 
 * Automatically synchronizes Azure App Configuration to Firebase Remote Config
 * to eliminate configuration drift between platforms.
 * 
 * Triggers:
 * - Timer: Every 5 minutes
 * - HTTP: Manual trigger with optional dry-run and rollback
 */

import { Context, HttpRequest } from "@azure/functions";
import { AppConfigurationClient } from '@azure/app-configuration';
import { DefaultAzureCredential } from '@azure/identity';
import { getAdminFirestore, getAdminRemoteConfig } from '../lib/firebase/admin';
import { azureCosmosService } from '../lib/shared/azure-cosmos-service';
import { logServerError } from '../lib/shared/error-handling';

// Application Insights setup
const appInsights = require('applicationinsights');
if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
  appInsights.setup(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING)
    .setAutoCollectRequests(true)
    .setAutoCollectPerformance(true)
    .setAutoCollectExceptions(true)
    .setAutoCollectDependencies(true)
    .start();
}

// ===== INTERFACES =====

interface SyncOptions {
  dryRun?: boolean;
  version?: string;
  forceSync?: boolean;
  rollback?: boolean;
  environment?: string;
}

interface SyncResult {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  driftDetected: number;
  details: SyncDetail[];
  errors: string[];
  timestamp: Date;
  version: string;
}

interface SyncDetail {
  key: string;
  action: 'synced' | 'no_change' | 'failed' | 'drift_detected';
  azureValue?: any;
  firebaseValue?: any;
  error?: string;
}

interface ConfigAuditEntry {
  id: string;
  key: string;
  oldValue: any;
  newValue: any;
  version: string;
  source: 'config-sync';
  changedBy: string;
  timestamp: Date;
  environment: string;
  syncResult: boolean;
}

// ===== CONFIG SYNC SERVICE =====

class ConfigSyncService {
  private azureClient: AppConfigurationClient | null = null;
  private remoteConfig: any = null;
  private firestore: any = null;

  constructor(private context: Context) {}

  async initialize(): Promise<void> {
    try {
      // Initialize Azure App Configuration
      const connectionString = process.env.AZURE_APP_CONFIG_CONNECTION_STRING;
      const endpoint = process.env.AZURE_APP_CONFIG_ENDPOINT;

      if (connectionString) {
        this.azureClient = new AppConfigurationClient(connectionString);
      } else if (endpoint) {
        const credential = new DefaultAzureCredential();
        this.azureClient = new AppConfigurationClient(endpoint, credential);
      } else {
        throw new Error('Azure App Configuration not configured');
      }

      // Initialize Firebase Admin
      this.remoteConfig = getAdminRemoteConfig();
      this.firestore = getAdminFirestore();

      // Initialize Cosmos DB for audit logging
      await azureCosmosService.initialize();

      this.context.log('✅ Config Sync Service initialized');
    } catch (error) {
      this.context.log.error('❌ Failed to initialize Config Sync Service:', error);
      throw error;
    }
  }

  async syncConfigurations(options: SyncOptions = {}): Promise<SyncResult> {
    const {
      dryRun = false,
      version = `sync_${Date.now()}`,
      forceSync = false,
      rollback = false,
      environment = 'production'
    } = options;

    const result: SyncResult = {
      success: false,
      syncedCount: 0,
      failedCount: 0,
      driftDetected: 0,
      details: [],
      errors: [],
      timestamp: new Date(),
      version
    };

    try {
      await this.initialize();

      if (rollback) {
        return await this.performRollback(version, result);
      }

      // Get all Azure App Configuration settings that should sync to Firebase
      const azureConfigs = await this.getAzureConfigsToSync();
      
      if (azureConfigs.length === 0) {
        this.context.log('ℹ️ No configurations marked for Firebase sync');
        result.success = true;
        return result;
      }

      // Get current Firebase Remote Config template
      const firebaseTemplate = await this.remoteConfig.getTemplate();
      let templateModified = false;

      this.context.log(`📦 Processing ${azureConfigs.length} configurations for sync`);

      // Process each configuration
      for (const azureConfig of azureConfigs) {
        try {
          const detail = await this.syncSingleConfiguration(
            azureConfig,
            firebaseTemplate,
            { dryRun, forceSync }
          );

          result.details.push(detail);

          switch (detail.action) {
            case 'synced':
              result.syncedCount++;
              templateModified = true;
              break;
            case 'drift_detected':
              result.driftDetected++;
              break;
            case 'failed':
              result.failedCount++;
              break;
          }

        } catch (error) {
          const errorMsg = `Failed to sync ${azureConfig.key}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          result.errors.push(errorMsg);
          result.failedCount++;

          result.details.push({
            key: azureConfig.key!,
            action: 'failed',
            error: errorMsg
          });

          this.context.log.error(`❌ ${errorMsg}`);
        }
      }

      // Publish updated template to Firebase if changes were made
      if (templateModified && !dryRun) {
        try {
          await this.publishFirebaseTemplate(firebaseTemplate, version);
          this.context.log(`✅ Published Firebase Remote Config template (version: ${version})`);
        } catch (error) {
          const errorMsg = `Failed to publish Firebase template: ${error instanceof Error ? error.message : 'Unknown error'}`;
          result.errors.push(errorMsg);
          this.context.log.error(`❌ ${errorMsg}`);
        }
      }

      // Record sync operation in audit log
      if (!dryRun) {
        await this.recordSyncAudit(result, environment);
      }

      // Send Application Insights telemetry
      this.sendTelemetry(result);

      // Determine overall success
      result.success = result.failedCount === 0;

      this.context.log(`${result.success ? '✅' : '⚠️'} Sync completed: ${result.syncedCount} synced, ${result.failedCount} failed, ${result.driftDetected} drift detected`);

      if (dryRun) {
        this.context.log('🧪 DRY RUN: No changes were actually made');
      }

      return result;

    } catch (error) {
      const errorMsg = `Sync operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      result.errors.push(errorMsg);
      result.success = false;
      
      this.context.log.error(`❌ ${errorMsg}`);
      logServerError(error as Error, { service: 'config-sync', action: 'sync' });

      return result;
    }
  }

  private async getAzureConfigsToSync(): Promise<any[]> {
    if (!this.azureClient) throw new Error('Azure client not initialized');

    const configs: any[] = [];

    try {
      const settingsIterable = this.azureClient.listConfigurationSettings();

      for await (const setting of settingsIterable) {
        // Only sync settings tagged for Firebase sync
        if (setting.tags?.syncToFirebase === 'true') {
          configs.push(setting);
        }
      }

      return configs;
    } catch (error) {
      this.context.log.error('Failed to get Azure configs:', error);
      throw error;
    }
  }

  private async syncSingleConfiguration(
    azureConfig: any,
    firebaseTemplate: any,
    options: { dryRun: boolean; forceSync: boolean }
  ): Promise<SyncDetail> {
    const { key, value: azureValue, tags } = azureConfig;
    const { dryRun, forceSync } = options;

    // Get current Firebase value
    const currentFirebaseParam = firebaseTemplate.parameters?.[key];
    const currentFirebaseValue = currentFirebaseParam?.defaultValue?.value;

    // Calculate hashes for drift detection
    const azureHash = this.calculateHash(azureValue);
    const firebaseHash = this.calculateHash(currentFirebaseValue);

    // Check if values are already in sync
    if (!forceSync && azureHash === firebaseHash) {
      return {
        key,
        action: 'no_change',
        azureValue,
        firebaseValue: currentFirebaseValue
      };
    }

    // Detect drift
    if (currentFirebaseValue !== undefined && azureHash !== firebaseHash) {
      this.context.log.warn(`⚠️ Drift detected for ${key}: Azure=${azureValue}, Firebase=${currentFirebaseValue}`);
    }

    if (dryRun) {
      return {
        key,
        action: azureHash !== firebaseHash ? 'drift_detected' : 'synced',
        azureValue,
        firebaseValue: currentFirebaseValue
      };
    }

    // Update Firebase template
    try {
      if (!firebaseTemplate.parameters) {
        firebaseTemplate.parameters = {};
      }

      firebaseTemplate.parameters[key] = {
        defaultValue: { value: azureValue },
        description: `Synced from Azure App Configuration - Version: ${tags?.version || 'unknown'}`,
        conditionalValues: currentFirebaseParam?.conditionalValues || {}
      };

      this.context.log(`🔄 Synced ${key}: ${azureValue}`);

      return {
        key,
        action: 'synced',
        azureValue,
        firebaseValue: currentFirebaseValue
      };

    } catch (error) {
      throw new Error(`Failed to update Firebase template for ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async publishFirebaseTemplate(template: any, version: string): Promise<void> {
    try {
      // Add version information
      template.version = {
        versionNumber: version,
        updateTime: new Date().toISOString(),
        updateUser: { email: 'config-sync@prepbettr.com' },
        updateOrigin: 'ADMIN_SDK_NODE',
        updateType: 'INCREMENTAL_UPDATE'
      };

      // Validate template before publishing
      await this.remoteConfig.validateTemplate(template);

      // Publish the template
      const publishedTemplate = await this.remoteConfig.publishTemplate(template);
      
      this.context.log(`✅ Firebase template published successfully (version: ${publishedTemplate.version.versionNumber})`);
    } catch (error) {
      throw new Error(`Template publication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async performRollback(versionId: string, result: SyncResult): Promise<SyncResult> {
    try {
      this.context.log(`🔄 Starting rollback to version ${versionId}`);

      // Get rollback template from Firebase version history
      const versionHistory = await this.remoteConfig.listVersions({ pageSize: 100 });
      const targetVersion = versionHistory.versions?.find((v: any) => v.versionNumber === versionId);

      if (!targetVersion) {
        throw new Error(`Version ${versionId} not found in Firebase Remote Config history`);
      }

      // Get the template for the target version
      const rollbackTemplate = await this.remoteConfig.getTemplate(versionId);

      // Publish the rollback template
      await this.publishFirebaseTemplate(rollbackTemplate, `rollback_${versionId}_${Date.now()}`);

      result.success = true;
      result.syncedCount = Object.keys(rollbackTemplate.parameters || {}).length;
      
      this.context.log(`✅ Successfully rolled back to version ${versionId}`);

      return result;

    } catch (error) {
      const errorMsg = `Rollback failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      result.errors.push(errorMsg);
      result.success = false;

      this.context.log.error(`❌ ${errorMsg}`);
      throw error;
    }
  }

  private async recordSyncAudit(result: SyncResult, environment: string): Promise<void> {
    try {
      const auditEntry = {
        id: `sync_audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        version: result.version,
        environment,
        success: result.success,
        syncedCount: result.syncedCount,
        failedCount: result.failedCount,
        driftDetected: result.driftDetected,
        details: result.details,
        errors: result.errors,
        source: 'config-sync-function',
        _partitionKey: 'sync-audit'
      };

      await azureCosmosService.createDocument('configSyncAudit', auditEntry);

      // Also record individual config changes
      for (const detail of result.details) {
        if (detail.action === 'synced') {
          const configAudit: ConfigAuditEntry = {
            id: `config_audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            key: detail.key,
            oldValue: detail.firebaseValue,
            newValue: detail.azureValue,
            version: result.version,
            source: 'config-sync',
            changedBy: 'azure-function',
            timestamp: new Date(),
            environment,
            syncResult: true
          };

          await azureCosmosService.createDocument('configAudit', {
            ...configAudit,
            _partitionKey: detail.key
          });
        }
      }

      this.context.log('📝 Recorded sync audit entries');
    } catch (error) {
      this.context.log.error('Failed to record sync audit:', error);
    }
  }

  private async sendTelemetry(result: SyncResult): Promise<void> {
    try {
      const telemetryData = {
        operationType: 'config-sync',
        success: result.success,
        syncedCount: result.syncedCount,
        failedCount: result.failedCount,
        driftDetected: result.driftDetected,
        version: result.version,
        timestamp: result.timestamp,
        duration: Date.now() - result.timestamp.getTime()
      };

      // Send custom event to Application Insights
      this.context.log.info('📊 Config sync telemetry', telemetryData);

      // If drift was detected, log as warning
      if (result.driftDetected > 0) {
        this.context.log.warn(`⚠️ Configuration drift detected in ${result.driftDetected} keys`);
      }

    } catch (error) {
      this.context.log.error('Failed to send telemetry:', error);
    }
  }

  private calculateHash(value: any): string {
    const crypto = require('crypto');
    const normalized = JSON.stringify(value, Object.keys(value || {}).sort());
    return crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 16);
  }
}

// ===== AZURE FUNCTION HANDLERS =====

const timerTrigger = async function (context: Context, myTimer: any): Promise<void> {
  context.log('🕐 Timer trigger: Starting scheduled config sync');

  const syncService = new ConfigSyncService(context);

  try {
    const result = await syncService.syncConfigurations({
      environment: process.env.ENVIRONMENT || 'production',
      version: `scheduled_${Date.now()}`
    });

    if (result.success) {
      context.log('✅ Scheduled sync completed successfully');
    } else {
      context.log.error('❌ Scheduled sync completed with errors');
    }

    // Set response for monitoring
    context.res = {
      status: result.success ? 200 : 500,
      body: {
        message: 'Scheduled sync completed',
        result
      }
    };

  } catch (error) {
    context.log.error('❌ Scheduled sync failed:', error);
    
    context.res = {
      status: 500,
      body: {
        error: 'Sync operation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
};

const httpTrigger = async function (context: Context, req: HttpRequest): Promise<void> {
  context.log('🌐 HTTP trigger: Manual config sync requested');

  const {
    dryRun = false,
    version,
    forceSync = false,
    rollback = false,
    environment = 'production'
  } = req.query;

  const syncService = new ConfigSyncService(context);

  try {
    const options: SyncOptions = {
      dryRun: dryRun === 'true',
      version: version || `manual_${Date.now()}`,
      forceSync: forceSync === 'true',
      rollback: rollback === 'true',
      environment: environment as string
    };

    const result = await syncService.syncConfigurations(options);

    context.res = {
      status: result.success ? 200 : 400,
      headers: { 'Content-Type': 'application/json' },
      body: {
        message: options.rollback ? 'Rollback completed' : 'Manual sync completed',
        result,
        options
      }
    };

    context.log(`${result.success ? '✅' : '❌'} Manual sync completed`);

  } catch (error) {
    context.log.error('❌ Manual sync failed:', error);

    context.res = {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: {
        error: 'Manual sync failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
};

// ===== EXPORTS =====

export default timerTrigger;
export { httpTrigger };
