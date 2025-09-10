/**
 * Feature Flag Configuration for Azure AI Foundry Resume Processing
 * 
 * This script manages the feature flag rollout for the enhanced resume processing
 * pipeline using Azure AI Foundry Document Intelligence.
 */

import { unifiedConfigService } from '@/lib/services/unified-config-service';

interface FoundryResumeProcessingFlags {
  // Main feature flag
  'features.foundryResumeProcessing': boolean;
  
  // Sub-feature flags
  'features.foundryATSOptimization': boolean;
  'features.foundryJobMatching': boolean;
  'features.foundrySkillsNormalization': boolean;
  'features.foundryEnhancedExtraction': boolean;
  
  // Rollout controls
  'foundry.rollout.percentage': number;
  'foundry.rollout.whitelistUsers': string[];
  'foundry.rollout.enabledEnvironments': string[];
  
  // Performance and quality controls
  'foundry.processing.timeoutMs': number;
  'foundry.processing.maxRetries': number;
  'foundry.processing.fallbackToLegacy': boolean;
  'foundry.processing.requireMinConfidence': number;
  
  // Cost controls
  'foundry.costs.dailyTokenLimit': number;
  'foundry.costs.monthlyBudgetUSD': number;
  'foundry.costs.alertThresholdPercent': number;
  
  // Quality gates
  'foundry.quality.minATSScore': number;
  'foundry.quality.requireJobMatching': boolean;
  'foundry.quality.enableMonitoring': boolean;
}

/**
 * Default configuration for Foundry Resume Processing
 */
const DEFAULT_FOUNDRY_CONFIG: FoundryResumeProcessingFlags = {
  // Main feature - start disabled
  'features.foundryResumeProcessing': false,
  
  // Sub-features - all enabled once main feature is enabled
  'features.foundryATSOptimization': true,
  'features.foundryJobMatching': true,
  'features.foundrySkillsNormalization': true,
  'features.foundryEnhancedExtraction': true,
  
  // Rollout - start with 0% and specific environments
  'foundry.rollout.percentage': 0,
  'foundry.rollout.whitelistUsers': [],
  'foundry.rollout.enabledEnvironments': ['development', 'staging'],
  
  // Performance settings
  'foundry.processing.timeoutMs': 30000, // 30 seconds
  'foundry.processing.maxRetries': 3,
  'foundry.processing.fallbackToLegacy': true,
  'foundry.processing.requireMinConfidence': 0.7, // 70% confidence threshold
  
  // Cost controls - conservative limits
  'foundry.costs.dailyTokenLimit': 100000, // 100k tokens per day
  'foundry.costs.monthlyBudgetUSD': 500,   // $500/month budget
  'foundry.costs.alertThresholdPercent': 80, // Alert at 80% of budget
  
  // Quality gates
  'foundry.quality.minATSScore': 60,       // Minimum 60% ATS score
  'foundry.quality.requireJobMatching': false, // Don't require job descriptions initially
  'foundry.quality.enableMonitoring': true    // Always enable monitoring
};

/**
 * Staging configuration - more aggressive for testing
 */
const STAGING_FOUNDRY_CONFIG: Partial<FoundryResumeProcessingFlags> = {
  'features.foundryResumeProcessing': true,
  'foundry.rollout.percentage': 50, // 50% of staging users
  'foundry.processing.timeoutMs': 45000, // Longer timeout for testing
  'foundry.costs.dailyTokenLimit': 50000, // Lower limit for staging
  'foundry.quality.minATSScore': 50, // Lower threshold for testing
};

/**
 * Production configuration - gradual rollout
 */
const PRODUCTION_FOUNDRY_CONFIG: Partial<FoundryResumeProcessingFlags> = {
  'features.foundryResumeProcessing': false, // Start disabled
  'foundry.rollout.percentage': 5, // Start with 5% rollout when enabled
  'foundry.rollout.enabledEnvironments': ['production'],
  'foundry.processing.timeoutMs': 25000, // Shorter timeout for production
  'foundry.costs.dailyTokenLimit': 200000, // Higher limit for production
  'foundry.costs.monthlyBudgetUSD': 2000, // Higher budget for production
  'foundry.quality.minATSScore': 70, // Higher quality bar
  'foundry.quality.requireJobMatching': true, // Require job matching in prod
};

/**
 * Feature Flag Management Class
 */
class FoundryFeatureFlagManager {
  
  /**
   * Initialize feature flags for a specific environment
   */
  async initializeFlags(environment: 'development' | 'staging' | 'production'): Promise<void> {
    console.log(`🎛️ Initializing Foundry feature flags for ${environment}`);
    
    const baseConfig = DEFAULT_FOUNDRY_CONFIG;
    let envConfig: Partial<FoundryResumeProcessingFlags>;
    
    switch (environment) {
      case 'staging':
        envConfig = STAGING_FOUNDRY_CONFIG;
        break;
      case 'production':
        envConfig = PRODUCTION_FOUNDRY_CONFIG;
        break;
      default:
        envConfig = {}; // Use defaults for development
    }
    
    const finalConfig = { ...baseConfig, ...envConfig };
    
    // Set each configuration value
    for (const [key, value] of Object.entries(finalConfig)) {
      try {
        await unifiedConfigService.set(key, value, {
          environment,
          syncToFirebase: key.startsWith('features.'), // Sync feature flags to client
          version: '1.0.0',
          changedBy: 'foundry-feature-flag-manager'
        });
        
        console.log(`✅ Set ${key} = ${JSON.stringify(value)}`);
      } catch (error) {
        console.error(`❌ Failed to set ${key}:`, error);
      }
    }
    
    console.log(`✅ Foundry feature flags initialized for ${environment}`);
  }
  
  /**
   * Enable Foundry resume processing with gradual rollout
   */
  async enableFoundryProcessing(
    environment: 'development' | 'staging' | 'production', 
    percentage: number = 5
  ): Promise<void> {
    console.log(`🚀 Enabling Foundry resume processing in ${environment} at ${percentage}%`);
    
    await unifiedConfigService.set('features.foundryResumeProcessing', true, {
      environment,
      syncToFirebase: true,
      version: '1.0.0',
      changedBy: 'foundry-rollout-manager'
    });
    
    await unifiedConfigService.set('foundry.rollout.percentage', percentage, {
      environment,
      version: '1.0.0',
      changedBy: 'foundry-rollout-manager'
    });
    
    console.log(`✅ Foundry resume processing enabled at ${percentage}% in ${environment}`);
  }
  
  /**
   * Disable Foundry resume processing (emergency rollback)
   */
  async disableFoundryProcessing(environment: string): Promise<void> {
    console.log(`🛑 Emergency disable of Foundry resume processing in ${environment}`);
    
    await unifiedConfigService.set('features.foundryResumeProcessing', false, {
      environment,
      syncToFirebase: true,
      version: '1.0.0',
      changedBy: 'foundry-emergency-disable'
    });
    
    console.log(`✅ Foundry resume processing disabled in ${environment}`);
  }
  
  /**
   * Increase rollout percentage
   */
  async increaseRollout(
    environment: string, 
    newPercentage: number, 
    currentPercentage?: number
  ): Promise<void> {
    if (currentPercentage) {
      console.log(`📈 Increasing rollout from ${currentPercentage}% to ${newPercentage}% in ${environment}`);
    } else {
      console.log(`📈 Setting rollout to ${newPercentage}% in ${environment}`);
    }
    
    if (newPercentage > 100) {
      throw new Error('Rollout percentage cannot exceed 100%');
    }
    
    await unifiedConfigService.set('foundry.rollout.percentage', newPercentage, {
      environment,
      version: '1.0.0',
      changedBy: 'foundry-rollout-increase'
    });
    
    console.log(`✅ Rollout increased to ${newPercentage}% in ${environment}`);
  }
  
  /**
   * Add users to whitelist for early access
   */
  async addWhitelistUsers(environment: string, userIds: string[]): Promise<void> {
    console.log(`👥 Adding ${userIds.length} users to whitelist in ${environment}`);
    
    const currentWhitelist = await unifiedConfigService.get('foundry.rollout.whitelistUsers', []);
    const newWhitelist = [...new Set([...currentWhitelist, ...userIds])];
    
    await unifiedConfigService.set('foundry.rollout.whitelistUsers', newWhitelist, {
      environment,
      version: '1.0.0',
      changedBy: 'foundry-whitelist-manager'
    });
    
    console.log(`✅ Added users to whitelist. Total: ${newWhitelist.length}`);
  }
  
  /**
   * Get current configuration status
   */
  async getStatus(environment?: string): Promise<{
    enabled: boolean;
    rolloutPercentage: number;
    whitelistUsers: string[];
    subFeatures: {
      atsOptimization: boolean;
      jobMatching: boolean;
      skillsNormalization: boolean;
      enhancedExtraction: boolean;
    };
    costControls: {
      dailyTokenLimit: number;
      monthlyBudgetUSD: number;
      alertThreshold: number;
    };
    qualityGates: {
      minATSScore: number;
      requireJobMatching: boolean;
      monitoringEnabled: boolean;
    };
  }> {
    const enabled = await unifiedConfigService.get('features.foundryResumeProcessing', false);
    const rolloutPercentage = await unifiedConfigService.get('foundry.rollout.percentage', 0);
    const whitelistUsers = await unifiedConfigService.get('foundry.rollout.whitelistUsers', []);
    
    return {
      enabled,
      rolloutPercentage,
      whitelistUsers,
      subFeatures: {
        atsOptimization: await unifiedConfigService.get('features.foundryATSOptimization', true),
        jobMatching: await unifiedConfigService.get('features.foundryJobMatching', true),
        skillsNormalization: await unifiedConfigService.get('features.foundrySkillsNormalization', true),
        enhancedExtraction: await unifiedConfigService.get('features.foundryEnhancedExtraction', true),
      },
      costControls: {
        dailyTokenLimit: await unifiedConfigService.get('foundry.costs.dailyTokenLimit', 100000),
        monthlyBudgetUSD: await unifiedConfigService.get('foundry.costs.monthlyBudgetUSD', 500),
        alertThreshold: await unifiedConfigService.get('foundry.costs.alertThresholdPercent', 80),
      },
      qualityGates: {
        minATSScore: await unifiedConfigService.get('foundry.quality.minATSScore', 60),
        requireJobMatching: await unifiedConfigService.get('foundry.quality.requireJobMatching', false),
        monitoringEnabled: await unifiedConfigService.get('foundry.quality.enableMonitoring', true),
      }
    };
  }
  
  /**
   * Print status report
   */
  async printStatus(environment?: string): Promise<void> {
    console.log(`📊 Foundry Resume Processing Status ${environment ? `(${environment})` : ''}`);
    console.log(''.padStart(50, '='));
    
    const status = await this.getStatus(environment);
    
    console.log(`🎛️  Main Feature: ${status.enabled ? '✅ ENABLED' : '❌ DISABLED'}`);
    console.log(`📈 Rollout: ${status.rolloutPercentage}%`);
    console.log(`👥 Whitelist: ${status.whitelistUsers.length} users`);
    
    console.log('\n🔧 Sub-Features:');
    console.log(`   ATS Optimization: ${status.subFeatures.atsOptimization ? '✅' : '❌'}`);
    console.log(`   Job Matching: ${status.subFeatures.jobMatching ? '✅' : '❌'}`);
    console.log(`   Skills Normalization: ${status.subFeatures.skillsNormalization ? '✅' : '❌'}`);
    console.log(`   Enhanced Extraction: ${status.subFeatures.enhancedExtraction ? '✅' : '❌'}`);
    
    console.log('\n💰 Cost Controls:');
    console.log(`   Daily Token Limit: ${status.costControls.dailyTokenLimit.toLocaleString()}`);
    console.log(`   Monthly Budget: $${status.costControls.monthlyBudgetUSD}`);
    console.log(`   Alert Threshold: ${status.costControls.alertThreshold}%`);
    
    console.log('\n🎯 Quality Gates:');
    console.log(`   Min ATS Score: ${status.qualityGates.minATSScore}%`);
    console.log(`   Require Job Matching: ${status.qualityGates.requireJobMatching ? '✅' : '❌'}`);
    console.log(`   Monitoring: ${status.qualityGates.monitoringEnabled ? '✅' : '❌'}`);
  }
}

/**
 * Main execution function
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const environment = args[1] as 'development' | 'staging' | 'production';
  
  const manager = new FoundryFeatureFlagManager();
  
  try {
    switch (command) {
      case 'init':
        if (!environment) {
          throw new Error('Environment required: development, staging, or production');
        }
        await manager.initializeFlags(environment);
        break;
        
      case 'enable':
        if (!environment) {
          throw new Error('Environment required: staging or production');
        }
        const percentage = parseInt(args[2]) || 5;
        await manager.enableFoundryProcessing(environment, percentage);
        break;
        
      case 'disable':
        if (!environment) {
          throw new Error('Environment required');
        }
        await manager.disableFoundryProcessing(environment);
        break;
        
      case 'rollout':
        if (!environment) {
          throw new Error('Environment required');
        }
        const newPercentage = parseInt(args[2]);
        if (isNaN(newPercentage)) {
          throw new Error('Valid percentage required');
        }
        await manager.increaseRollout(environment, newPercentage);
        break;
        
      case 'whitelist':
        if (!environment) {
          throw new Error('Environment required');
        }
        const userIds = args.slice(2);
        if (userIds.length === 0) {
          throw new Error('User IDs required');
        }
        await manager.addWhitelistUsers(environment, userIds);
        break;
        
      case 'status':
        await manager.printStatus(environment);
        break;
        
      default:
        console.log('Usage:');
        console.log('  npm run foundry:flags init <environment>');
        console.log('  npm run foundry:flags enable <environment> [percentage]');
        console.log('  npm run foundry:flags disable <environment>');
        console.log('  npm run foundry:flags rollout <environment> <percentage>');
        console.log('  npm run foundry:flags whitelist <environment> <userId1> [userId2...]');
        console.log('  npm run foundry:flags status [environment]');
        console.log('');
        console.log('Examples:');
        console.log('  npm run foundry:flags init staging');
        console.log('  npm run foundry:flags enable production 5');
        console.log('  npm run foundry:flags rollout production 25');
        console.log('  npm run foundry:flags whitelist production user1 user2');
        console.log('  npm run foundry:flags status production');
        break;
    }
    
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Export for use in other modules
export { FoundryFeatureFlagManager, DEFAULT_FOUNDRY_CONFIG };

// Run if this script is executed directly
if (require.main === module) {
  main().catch(console.error);
}
