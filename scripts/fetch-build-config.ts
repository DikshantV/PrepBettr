#!/usr/bin/env node

/**
 * Build-Time Configuration Fetcher for Azure App Configuration
 * 
 * This script fetches configuration values from Azure App Configuration
 * at build time and creates environment files for Next.js production builds.
 * 
 * Usage: npm run build:fetch-config
 */

import { AppConfigurationClient, ConfigurationSetting } from '@azure/app-configuration';
import { DefaultAzureCredential } from '@azure/identity';
import * as fs from 'fs';
import * as path from 'path';

interface BuildConfig {
  environment: string;
  publicConfig: Record<string, string>;
  serverConfig: Record<string, string>;
  featureFlags: Record<string, any>;
}

class BuildTimeConfigFetcher {
  private client: AppConfigurationClient;
  private label: string;
  
  constructor(connectionString?: string, label: string = 'production') {
    this.label = label;
    
    const connStr = connectionString || process.env.AZURE_APPCONFIG_CONNECTION_STRING;
    
    if (!connStr) {
      throw new Error('AZURE_APPCONFIG_CONNECTION_STRING environment variable is required');
    }
    
    // Initialize client
    if (connStr.startsWith('Endpoint=')) {
      this.client = new AppConfigurationClient(connStr);
    } else {
      // Use managed identity with endpoint
      this.client = new AppConfigurationClient(connStr, new DefaultAzureCredential());
    }
  }
  
  /**
   * Fetch all configuration values from Azure App Configuration
   */
  async fetchConfiguration(): Promise<BuildConfig> {
    console.log(`🔄 Fetching configuration from Azure App Configuration (label: ${this.label})...`);
    
    const publicConfig: Record<string, string> = {};
    const serverConfig: Record<string, string> = {};
    const featureFlags: Record<string, any> = {};
    let environment = 'production';
    
    try {
      const settings = this.client.listConfigurationSettings({ 
        labelFilter: this.label 
      });
      
      for await (const setting of settings) {
        if (!setting.key || setting.value === undefined) continue;
        
        if (setting.key.startsWith('.appconfig.featureflag/')) {
          // Handle feature flags
          const flagName = setting.key.replace('.appconfig.featureflag/', '');
          try {
            const flagData = JSON.parse(setting.value);
            featureFlags[flagName] = {
              enabled: flagData.enabled,
              description: flagData.description,
              conditions: flagData.conditions
            };
            console.log(`  ✅ Feature flag ${flagName}: ${flagData.enabled ? 'enabled' : 'disabled'}`);
          } catch (error) {
            console.warn(`  ⚠️ Failed to parse feature flag ${flagName}:`, error);
          }
        } else {
          // Handle regular configuration
          if (setting.key.startsWith('NEXT_PUBLIC_')) {
            // Public configuration (exposed to client-side)
            publicConfig[setting.key] = setting.value;
            console.log(`  ✅ Public config ${setting.key}`);
          } else {
            // Server-only configuration
            serverConfig[setting.key] = setting.value;
            console.log(`  ✅ Server config ${setting.key}`);
          }
          
          // Set environment from config
          if (setting.key === 'ENVIRONMENT') {
            environment = setting.value;
          }
        }
      }
      
      return {
        environment,
        publicConfig,
        serverConfig,
        featureFlags
      };
      
    } catch (error) {
      console.error('❌ Failed to fetch configuration:', error);
      throw error;
    }
  }
  
  /**
   * Create .env.production file for Next.js
   */
  createProductionEnvFile(config: BuildConfig): void {
    console.log('📝 Creating .env.production file...');
    
    const envLines: string[] = [
      '# Auto-generated from Azure App Configuration',
      `# Generated at: ${new Date().toISOString()}`,
      `# Label: ${this.label}`,
      '',
      '# Environment',
      `ENVIRONMENT=${config.environment}`,
      `NODE_ENV=production`,
      ''
    ];
    
    // Add public configuration
    if (Object.keys(config.publicConfig).length > 0) {
      envLines.push('# Public Configuration (Client-side accessible)');
      Object.entries(config.publicConfig).forEach(([key, value]) => {
        envLines.push(`${key}=${value}`);
      });
      envLines.push('');
    }
    
    // Add server configuration
    if (Object.keys(config.serverConfig).length > 0) {
      envLines.push('# Server Configuration (Server-side only)');
      Object.entries(config.serverConfig).forEach(([key, value]) => {
        envLines.push(`${key}=${value}`);
      });
      envLines.push('');
    }
    
    // Write to .env.production
    const envFilePath = path.join(process.cwd(), '.env.production');
    fs.writeFileSync(envFilePath, envLines.join('\n'));
    
    console.log(`  ✅ Created ${envFilePath}`);
  }
  
  /**
   * Create feature flags configuration file
   */
  createFeatureFlagsFile(config: BuildConfig): void {
    console.log('🚩 Creating feature flags configuration...');
    
    const flagsConfig = {
      generated: new Date().toISOString(),
      label: this.label,
      flags: config.featureFlags
    };
    
    // Create feature flags JSON file
    const flagsFilePath = path.join(process.cwd(), 'config/feature-flags.json');
    
    // Ensure config directory exists
    const configDir = path.dirname(flagsFilePath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    fs.writeFileSync(flagsFilePath, JSON.stringify(flagsConfig, null, 2));
    console.log(`  ✅ Created ${flagsFilePath}`);
    
    // Create TypeScript interface file for type safety
    const flagsTypesPath = path.join(process.cwd(), 'types/feature-flags.ts');
    const typesDir = path.dirname(flagsTypesPath);
    if (!fs.existsSync(typesDir)) {
      fs.mkdirSync(typesDir, { recursive: true });
    }
    
    const flagNames = Object.keys(config.featureFlags);
    const typeContent = `// Auto-generated feature flags types
// Generated at: ${new Date().toISOString()}

export type FeatureFlagName = ${flagNames.map(name => `'${name}'`).join(' | ')};

export interface FeatureFlag {
  enabled: boolean;
  description: string;
  conditions?: {
    client_filters: Array<{
      name: string;
      parameters: Record<string, any>;
    }>;
  };
}

export interface FeatureFlagsConfig {
  generated: string;
  label: string;
  flags: Record<FeatureFlagName, FeatureFlag>;
}

// Feature flag constants
export const FEATURE_FLAGS = {
${flagNames.map(name => `  ${name.toUpperCase()}: '${name}' as const`).join(',\n')}
} as const;
`;
    
    fs.writeFileSync(flagsTypesPath, typeContent);
    console.log(`  ✅ Created ${flagsTypesPath}`);
  }
  
  /**
   * Create configuration summary report
   */
  createConfigReport(config: BuildConfig): void {
    console.log('📊 Creating configuration report...');
    
    const report = {
      timestamp: new Date().toISOString(),
      label: this.label,
      environment: config.environment,
      summary: {
        publicConfigCount: Object.keys(config.publicConfig).length,
        serverConfigCount: Object.keys(config.serverConfig).length,
        featureFlagsCount: Object.keys(config.featureFlags).length,
        enabledFeatureFlags: Object.entries(config.featureFlags)
          .filter(([, flag]) => flag.enabled)
          .map(([name]) => name)
      },
      configuration: {
        public: config.publicConfig,
        server: Object.fromEntries(
          Object.entries(config.serverConfig).map(([key, value]) => [
            key, 
            key.toLowerCase().includes('secret') || key.toLowerCase().includes('key') 
              ? '[REDACTED]' 
              : value
          ])
        ),
        featureFlags: config.featureFlags
      }
    };
    
    const reportPath = path.join(process.cwd(), 'build-config-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`  ✅ Created ${reportPath}`);
  }
}

/**
 * Fallback configuration for when Azure App Configuration is not available
 */
function createFallbackConfiguration(): BuildConfig {
  console.log('⚠️ Using fallback configuration...');
  
  return {
    environment: process.env.ENVIRONMENT || 'production',
    publicConfig: {
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'prepbettr',
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'prepbettr.firebaseapp.com',
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'prepbettr.firebasestorage.app',
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '660242808945',
      NEXT_PUBLIC_FIREBASE_APP_ID: '1:660242808945:web:4edbaac82ed140f4d05bd0',
      NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: 'G-LF6KN9F2HY',
      NEXT_PUBLIC_BASE_URL: 'https://www.prepbettr.com',
      NEXT_PUBLIC_API_BASE_URL: 'https://www.prepbettr.com/api'
    },
    serverConfig: {
      BUILD_STANDALONE: 'true',
      FREE_TIER_INTERVIEWS_LIMIT: '5',
      FREE_TIER_RESUMES_LIMIT: '3',
      PREMIUM_TIER_INTERVIEWS_LIMIT: '100',
      PREMIUM_TIER_RESUMES_LIMIT: '50'
    },
    featureFlags: {
      voiceInterviews: {
        enabled: true,
        description: 'Enable voice interview functionality'
      },
      premiumFeatures: {
        enabled: true,
        description: 'Enable premium subscription features'
      },
      autoApplyAzure: {
        enabled: false,
        description: 'Enable Azure OpenAI-powered automatic job application feature'
      },
      portalIntegration: {
        enabled: false,
        description: 'Enable enhanced job portal integration features'
      },
      maintenanceMode: {
        enabled: false,
        description: 'Global maintenance mode flag'
      }
    }
  };
}

/**
 * Main build-time configuration fetch function
 */
async function fetchBuildTimeConfiguration(): Promise<void> {
  console.log('🚀 Fetching Build-Time Configuration');
  console.log('=' .repeat(40));
  console.log();
  
  try {
    const environment = process.env.ENVIRONMENT || 'production';
    const label = environment === 'staging' ? 'staging' : 'production';
    
    let config: BuildConfig;
    
    if (process.env.AZURE_APPCONFIG_CONNECTION_STRING) {
      // Fetch from Azure App Configuration
      const fetcher = new BuildTimeConfigFetcher(undefined, label);
      config = await fetcher.fetchConfiguration();
    } else {
      // Use fallback configuration
      console.log('⚠️ AZURE_APPCONFIG_CONNECTION_STRING not set, using fallback configuration');
      config = createFallbackConfiguration();
    }
    
    const fetcher = new BuildTimeConfigFetcher(process.env.AZURE_APPCONFIG_CONNECTION_STRING, label);
    
    // Create configuration files
    fetcher.createProductionEnvFile(config);
    fetcher.createFeatureFlagsFile(config);
    fetcher.createConfigReport(config);
    
    console.log('\n✅ Build-time configuration setup complete!');
    console.log(`\n📊 Summary:`);
    console.log(`   Environment: ${config.environment}`);
    console.log(`   Public config values: ${Object.keys(config.publicConfig).length}`);
    console.log(`   Server config values: ${Object.keys(config.serverConfig).length}`);
    console.log(`   Feature flags: ${Object.keys(config.featureFlags).length}`);
    
    const enabledFlags = Object.entries(config.featureFlags)
      .filter(([, flag]) => flag.enabled)
      .map(([name]) => name);
    
    if (enabledFlags.length > 0) {
      console.log(`   Enabled features: ${enabledFlags.join(', ')}`);
    }
    
  } catch (error) {
    console.error('❌ Failed to fetch build-time configuration:', error);
    
    // Create fallback configuration as last resort
    console.log('\n🔄 Creating fallback configuration as last resort...');
    const config = createFallbackConfiguration();
    const fetcher = new BuildTimeConfigFetcher('fallback', 'production');
    
    try {
      fetcher.createProductionEnvFile(config);
      fetcher.createFeatureFlagsFile(config);
      console.log('✅ Fallback configuration created successfully');
    } catch (fallbackError) {
      console.error('❌ Failed to create fallback configuration:', fallbackError);
      process.exit(1);
    }
  }
}

// Export for use in other scripts
export { BuildTimeConfigFetcher };
export type { BuildConfig };

// Run the script if executed directly
if (require.main === module) {
  fetchBuildTimeConfiguration().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
