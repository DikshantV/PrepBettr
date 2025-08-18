#!/usr/bin/env node

/**
 * Azure App Configuration Production Setup Script
 * 
 * This script sets up Azure App Configuration with production variables
 * and non-secret configuration values for the PrepBettr application.
 * 
 * Usage: npm run setup:azure-app-config:production
 */

import { AppConfigurationClient } from '@azure/app-configuration';
import { DefaultAzureCredential } from '@azure/identity';

// Production Configuration Values (Non-Secret)
const PRODUCTION_CONFIG = {
  // Environment
  ENVIRONMENT: 'production',
  
  // Firebase Client Configuration (Public)
  NEXT_PUBLIC_FIREBASE_CLIENT_KEY: process.env.NEXT_PUBLIC_FIREBASE_CLIENT_KEY || '',
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'prepbettr.firebasestorage.app',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'prepbettr',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'prepbettr.firebaseapp.com',
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '660242808945',
  NEXT_PUBLIC_FIREBASE_APP_ID: '1:660242808945:web:4edbaac82ed140f4d05bd0',
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: 'G-LF6KN9F2HY',
  
  // Application Configuration
  NODE_ENV: 'production',
  BUILD_STANDALONE: 'true',
  
  // Feature Flags Config
  FEATURE_FLAGS_ENABLED: 'true',
  
  // Quotas and Limits
  FREE_TIER_INTERVIEWS_LIMIT: '5',
  FREE_TIER_RESUMES_LIMIT: '3',
  PREMIUM_TIER_INTERVIEWS_LIMIT: '100',
  PREMIUM_TIER_RESUMES_LIMIT: '50',
  VOICE_INTERVIEW_MAX_DURATION_MINUTES: '30',
  
  // Rate Limiting
  API_RATE_LIMIT_REQUESTS_PER_MINUTE: '60',
  API_RATE_LIMIT_REQUESTS_PER_HOUR: '1000',
  
  // Application URLs
  NEXT_PUBLIC_BASE_URL: 'https://www.prepbettr.com',
  NEXT_PUBLIC_API_BASE_URL: 'https://www.prepbettr.com/api',
  
  // Azure Services Configuration
  AZURE_REGION: 'East US',
  
  // Content Security
  CONTENT_MAX_FILE_SIZE_MB: '10',
  ALLOWED_FILE_TYPES: 'pdf,doc,docx,txt',
  
  // Performance Settings
  CACHE_TTL_SECONDS: '3600',
  SESSION_TIMEOUT_MINUTES: '480',
  
  // Monitoring and Observability
  ENABLE_TELEMETRY: 'true',
  LOG_LEVEL: 'info',
  
  // CORS Settings
  ALLOWED_ORIGINS: 'https://www.prepbettr.com,https://prepbettr.com'
};

// Feature Flags for Production
const PRODUCTION_FEATURE_FLAGS = {
  autoApplyAzure: {
    enabled: false,
    description: 'Enable Azure OpenAI-powered automatic job application feature',
    rolloutPercentage: 10
  },
  portalIntegration: {
    enabled: false, 
    description: 'Enable enhanced job portal integration features',
    rolloutPercentage: 10
  },
  voiceInterviews: {
    enabled: true,
    description: 'Enable voice interview functionality',
    rolloutPercentage: 100
  },
  premiumFeatures: {
    enabled: true,
    description: 'Enable premium subscription features',
    rolloutPercentage: 100
  },
  maintenanceMode: {
    enabled: false,
    description: 'Global maintenance mode flag',
    rolloutPercentage: 0
  }
};

interface ConfigSetting {
  key: string;
  value: string;
  label?: string;
  contentType?: string;
  description?: string;
}

class AzureAppConfigManager {
  private client: AppConfigurationClient;
  private connectionString: string;
  
  constructor(connectionString?: string) {
    this.connectionString = connectionString || process.env.AZURE_APPCONFIG_CONNECTION_STRING || '';
    
    if (!this.connectionString) {
      throw new Error('AZURE_APPCONFIG_CONNECTION_STRING environment variable is required');
    }
    
    // Initialize client with connection string or managed identity
    if (this.connectionString.startsWith('Endpoint=')) {
      this.client = new AppConfigurationClient(this.connectionString);
    } else {
      // Use managed identity with endpoint
      this.client = new AppConfigurationClient(this.connectionString, new DefaultAzureCredential());
    }
  }
  
  /**
   * Set configuration values in Azure App Configuration
   */
  async setConfigValues(config: Record<string, string>, label: string = 'production'): Promise<void> {
    console.log(`🔧 Setting ${Object.keys(config).length} configuration values with label: ${label}`);
    
    for (const [key, value] of Object.entries(config)) {
      try {
        await this.client.setConfigurationSetting({
          key,
          value,
          label,
          contentType: 'text/plain'
        });
        console.log(`  ✅ Set ${key}`);
      } catch (error) {
        console.error(`  ❌ Failed to set ${key}:`, error);
      }
    }
  }
  
  /**
   * Set feature flags in Azure App Configuration
   */
  async setFeatureFlags(flags: Record<string, any>, label: string = 'production'): Promise<void> {
    console.log(`🚩 Setting ${Object.keys(flags).length} feature flags with label: ${label}`);
    
    for (const [flagName, flagConfig] of Object.entries(flags)) {
      try {
        const featureFlagValue = {
          id: flagName,
          description: flagConfig.description,
          enabled: flagConfig.enabled,
          conditions: {
            client_filters: flagConfig.rolloutPercentage < 100 ? [
              {
                name: 'Microsoft.Percentage',
                parameters: {
                  Value: flagConfig.rolloutPercentage.toString()
                }
              }
            ] : []
          }
        };
        
        await this.client.setConfigurationSetting({
          key: `.appconfig.featureflag/${flagName}`,
          value: JSON.stringify(featureFlagValue),
          label,
          contentType: 'application/vnd.microsoft.appconfig.ff+json;charset=utf-8'
        });
        
        console.log(`  ✅ Set feature flag ${flagName} (${flagConfig.enabled ? 'enabled' : 'disabled'}, ${flagConfig.rolloutPercentage}% rollout)`);
      } catch (error) {
        console.error(`  ❌ Failed to set feature flag ${flagName}:`, error);
      }
    }
  }
  
  /**
   * Verify configuration by reading back some values
   */
  async verifyConfiguration(): Promise<void> {
    console.log('🔍 Verifying configuration...');
    
    try {
      // Test reading a few key values
      const testKeys = ['ENVIRONMENT', 'NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'FREE_TIER_INTERVIEWS_LIMIT'];
      
      for (const key of testKeys) {
        const setting = await this.client.getConfigurationSetting({ key, label: 'production' });
        console.log(`  ✅ ${key} = ${setting.value}`);
      }
      
      // Test reading a feature flag
      const featureFlag = await this.client.getConfigurationSetting({ 
        key: '.appconfig.featureflag/voiceInterviews', 
        label: 'production' 
      });
      const flagData = JSON.parse(featureFlag.value || '{}');
      console.log(`  ✅ Feature flag voiceInterviews = ${flagData.enabled ? 'enabled' : 'disabled'}`);
      
    } catch (error) {
      console.error('❌ Verification failed:', error);
    }
  }
  
  /**
   * List all configuration settings
   */
  async listAllSettings(): Promise<void> {
    console.log('📋 Listing all configuration settings:');
    
    try {
      const settings = this.client.listConfigurationSettings({ labelFilter: 'production' });
      
      for await (const setting of settings) {
        if (setting.key?.startsWith('.appconfig.featureflag/')) {
          const flagName = setting.key.replace('.appconfig.featureflag/', '');
          const flagData = JSON.parse(setting.value || '{}');
          console.log(`  🚩 ${flagName}: ${flagData.enabled ? 'enabled' : 'disabled'} (${flagData.description})`);
        } else {
          console.log(`  ⚙️  ${setting.key}: ${setting.value}`);
        }
      }
    } catch (error) {
      console.error('❌ Failed to list settings:', error);
    }
  }
}

/**
 * Generate Azure CLI commands for manual setup
 */
function generateManualSetupCommands(): void {
  console.log('\n🔧 Manual Setup Commands (Alternative):');
  console.log('=' .repeat(60));
  console.log();
  
  console.log('# Set environment variables first:');
  console.log('export AZURE_APPCONFIG_CONNECTION_STRING="your-connection-string"');
  console.log();
  
  console.log('# Configuration values:');
  Object.entries(PRODUCTION_CONFIG).forEach(([key, value]) => {
    console.log(`az appconfig kv set --connection-string "$AZURE_APPCONFIG_CONNECTION_STRING" --key "${key}" --value "${value}" --label "production"`);
  });
  
  console.log('\n# Feature flags:');
  Object.entries(PRODUCTION_FEATURE_FLAGS).forEach(([flagName, flagConfig]) => {
    console.log(`az appconfig feature set --connection-string "$AZURE_APPCONFIG_CONNECTION_STRING" --feature "${flagName}" --label "production" --enabled ${flagConfig.enabled} --description "${flagConfig.description}"`);
  });
}

/**
 * Main setup function
 */
async function setupProductionConfiguration(): Promise<void> {
  console.log('🚀 Azure App Configuration Production Setup');
  console.log('=' .repeat(50));
  console.log();
  
  try {
    // Check for connection string
    if (!process.env.AZURE_APPCONFIG_CONNECTION_STRING) {
      console.error('❌ AZURE_APPCONFIG_CONNECTION_STRING environment variable is required');
      console.log('\n💡 Set it with:');
      console.log('export AZURE_APPCONFIG_CONNECTION_STRING="Endpoint=https://your-appconfig.azconfig.io;Id=...;Secret=..."');
      console.log('\nOr use the manual setup commands below:');
      generateManualSetupCommands();
      return;
    }
    
    const manager = new AzureAppConfigManager();
    
    // Set configuration values
    await manager.setConfigValues(PRODUCTION_CONFIG, 'production');
    
    // Set feature flags
    await manager.setFeatureFlags(PRODUCTION_FEATURE_FLAGS, 'production');
    
    // Verify setup
    await manager.verifyConfiguration();
    
    console.log('\n✅ Production configuration setup complete!');
    console.log('\n📋 Next Steps:');
    console.log('1. Add AZURE_APPCONFIG_CONNECTION_STRING to your Azure Function App settings');
    console.log('2. Update your Next.js build process to fetch config at build time');
    console.log('3. Test the configuration in your staging environment first');
    console.log('4. Monitor feature flag rollouts and adjust percentages as needed');
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
    console.log('\nTrying manual setup commands instead:');
    generateManualSetupCommands();
  }
}

/**
 * Export configuration for use in other scripts
 */
export { PRODUCTION_CONFIG, PRODUCTION_FEATURE_FLAGS, AzureAppConfigManager };

// Run the setup if this script is executed directly
if (require.main === module) {
  setupProductionConfiguration().catch(console.error);
}
