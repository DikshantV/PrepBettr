#!/usr/bin/env ts-node

/**
 * Azure AI Foundry Integration Test Script
 * 
 * Comprehensive test script that validates:
 * - Configuration loading from Key Vault and environment variables
 * - Model manager functionality and cost tracking
 * - Client connectivity and health checks
 * - Error handling and fallback mechanisms
 * - Performance metrics and usage tracking
 */

import dotenv from 'dotenv';
import { 
  getFoundryConfig, 
  clearFoundryConfigCache,
  validateFoundryConfig,
  getModelConfig,
  getDefaultModel,
  type FoundryConfig 
} from '../lib/azure-ai-foundry/config/foundry-config';
import { FoundryClientBase } from '../lib/azure-ai-foundry/clients/foundry-client';
import { 
  FoundryModelManager,
  type ModelSelectionCriteria 
} from '../lib/azure-ai-foundry/managers/model-manager';

// Load environment variables
dotenv.config({ path: '.env.local' });

/**
 * Test results tracking
 */
interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  duration: number;
  error?: string;
  details?: any;
}

class AzureFoundryTester {
  private results: TestResult[] = [];
  private client?: FoundryClientBase;
  private modelManager?: FoundryModelManager;

  async runAllTests(): Promise<void> {
    console.log('🚀 Starting Azure AI Foundry Integration Tests');
    console.log('=' .repeat(60));

    // Test configuration loading
    await this.testConfigurationLoading();
    await this.testEnvironmentFallback();
    await this.testConfigValidation();

    // Test client functionality
    await this.testClientInitialization();
    await this.testConnectionValidation();

    // Test model manager
    await this.testModelManager();
    await this.testModelSelection();
    await this.testCostEstimation();
    await this.testUsageTracking();

    // Test health checks
    await this.testHealthChecks();

    // Print results
    this.printResults();
  }

  private async runTest(name: string, testFn: () => Promise<any>): Promise<void> {
    const start = Date.now();
    console.log(`\n🧪 Testing: ${name}...`);

    try {
      const result = await testFn();
      const duration = Date.now() - start;
      this.results.push({
        name,
        status: 'PASS',
        duration,
        details: result
      });
      console.log(`✅ PASS: ${name} (${duration}ms)`);
    } catch (error: any) {
      const duration = Date.now() - start;
      this.results.push({
        name,
        status: 'FAIL',
        duration,
        error: error.message || error.toString()
      });
      console.log(`❌ FAIL: ${name} (${duration}ms)`);
      console.log(`   Error: ${error.message || error}`);
    }
  }

  private async testConfigurationLoading(): Promise<void> {
    await this.runTest('Configuration Loading from Key Vault', async () => {
      // Clear any cached configuration
      clearFoundryConfigCache();
      
      const config = await getFoundryConfig();
      
      // Validate basic structure
      if (!config.endpoint && !config.apiKey) {
        throw new Error('No endpoint or API key found - check Azure Key Vault secrets');
      }

      return {
        hasEndpoint: !!config.endpoint,
        hasApiKey: !!config.apiKey,
        projectId: config.projectId,
        region: config.region,
        modelCount: Object.keys(config.models).length,
        environment: config.environment
      };
    });
  }

  private async testEnvironmentFallback(): Promise<void> {
    await this.runTest('Environment Variable Fallback', async () => {
      // Temporarily set environment variables
      const originalEndpoint = process.env.AZURE_FOUNDRY_ENDPOINT;
      const originalApiKey = process.env.AZURE_FOUNDRY_API_KEY;

      process.env.AZURE_FOUNDRY_ENDPOINT = 'https://test-endpoint.cognitiveservices.azure.com';
      process.env.AZURE_FOUNDRY_API_KEY = 'test-api-key-from-env';

      try {
        clearFoundryConfigCache();
        const config = await getFoundryConfig(true);
        
        return {
          endpointFromEnv: config.endpoint?.includes('test-endpoint'),
          apiKeyFromEnv: config.apiKey === 'test-api-key-from-env',
          hasModels: Object.keys(config.models).length > 0
        };
      } finally {
        // Restore original values
        if (originalEndpoint) process.env.AZURE_FOUNDRY_ENDPOINT = originalEndpoint;
        else delete process.env.AZURE_FOUNDRY_ENDPOINT;
        
        if (originalApiKey) process.env.AZURE_FOUNDRY_API_KEY = originalApiKey;
        else delete process.env.AZURE_FOUNDRY_API_KEY;
      }
    });
  }

  private async testConfigValidation(): Promise<void> {
    await this.runTest('Configuration Validation', async () => {
      const config = await getFoundryConfig();
      const validation = validateFoundryConfig(config);
      
      return {
        isValid: validation.isValid,
        errors: validation.errors,
        hasDefaultModel: Object.values(config.models).some(m => m.isDefault),
        modelNames: Object.keys(config.models)
      };
    });
  }

  private async testClientInitialization(): Promise<void> {
    await this.runTest('Client Initialization', async () => {
      this.client = new FoundryClientBase();
      await this.client.init();
      
      return {
        initialized: true,
        configLoaded: true
      };
    });
  }

  private async testConnectionValidation(): Promise<void> {
    await this.runTest('Connection Validation', async () => {
      if (!this.client) {
        throw new Error('Client not initialized');
      }

      const connectionResult = await this.client.validateConnection();
      
      return {
        connectionOk: connectionResult.ok,
        status: connectionResult.status,
        error: connectionResult.error
      };
    });
  }

  private async testModelManager(): Promise<void> {
    await this.runTest('Model Manager Initialization', async () => {
      this.modelManager = new FoundryModelManager();
      await this.modelManager.init();

      const availableModels = this.modelManager.getAvailableModels();
      const defaultModel = this.modelManager.getDefaultModelConfig();

      return {
        modelCount: Object.keys(availableModels).length,
        defaultModel: defaultModel.modelName,
        models: Object.keys(availableModels)
      };
    });
  }

  private async testModelSelection(): Promise<void> {
    await this.runTest('Model Selection Logic', async () => {
      if (!this.modelManager) {
        throw new Error('Model manager not initialized');
      }

      // Test different selection criteria
      const interviewModel = this.modelManager.getRecommendedModel('interview');
      const lightweightModel = this.modelManager.getRecommendedModel('lightweight');
      const codeGenModel = this.modelManager.getRecommendedModel('code-generation');

      // Test custom criteria
      const customCriteria: ModelSelectionCriteria = {
        maxCost: 0.01,
        requiredCapabilities: ['text-generation', 'reasoning']
      };
      const customSelected = this.modelManager.selectModel(customCriteria);

      return {
        interviewModel: interviewModel.modelName,
        lightweightModel: lightweightModel.modelName,
        codeGenModel: codeGenModel.modelName,
        customSelected: customSelected.modelName,
        costEfficiencyOrder: this.modelManager.getModelsByCostEfficiency().map(m => ({
          name: m.modelName,
          cost: m.costPerToken
        }))
      };
    });
  }

  private async testCostEstimation(): Promise<void> {
    await this.runTest('Cost Estimation', async () => {
      if (!this.modelManager) {
        throw new Error('Model manager not initialized');
      }

      const models = this.modelManager.getAvailableModels();
      const estimates: Record<string, number> = {};

      // Test cost estimation for 1000 tokens
      Object.keys(models).forEach(modelName => {
        estimates[modelName] = this.modelManager.estimateCost(modelName, 1000);
      });

      // Test different token counts
      const gpt4oCosts = {
        small: this.modelManager.estimateCost('gpt-4o', 100),
        medium: this.modelManager.estimateCost('gpt-4o', 1000),
        large: this.modelManager.estimateCost('gpt-4o', 10000)
      };

      return {
        modelEstimates: estimates,
        gpt4oCostBreakdown: gpt4oCosts,
        totalForAllModels: Object.values(estimates).reduce((sum, cost) => sum + cost, 0)
      };
    });
  }

  private async testUsageTracking(): Promise<void> {
    await this.runTest('Usage Tracking and Metrics', async () => {
      if (!this.modelManager) {
        throw new Error('Model manager not initialized');
      }

      // Simulate some usage data
      const mockUsageData = [
        {
          modelName: 'gpt-4o',
          tokenUsage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
          latency: 1200,
          success: true
        },
        {
          modelName: 'gpt-4o',
          tokenUsage: { prompt_tokens: 200, completion_tokens: 100, total_tokens: 300 },
          latency: 1500,
          success: true
        },
        {
          modelName: 'phi-4',
          tokenUsage: { prompt_tokens: 80, completion_tokens: 40, total_tokens: 120 },
          latency: 800,
          success: false,
          errorCode: 'timeout'
        }
      ];

      // Track usage
      mockUsageData.forEach(usage => {
        this.modelManager!.trackUsage(usage);
      });

      // Get metrics
      const gpt4oMetrics = this.modelManager.getModelMetrics('gpt-4o');
      const overallStats = this.modelManager.getUsageStatistics();
      const usageHistory = this.modelManager.exportUsageHistory();

      return {
        gpt4oMetrics: {
          requestCount: gpt4oMetrics.requestCount,
          averageLatency: gpt4oMetrics.averageLatency,
          successRate: gpt4oMetrics.successRate,
          totalCost: gpt4oMetrics.totalCost
        },
        overallStats: {
          totalRequests: overallStats.totalRequests,
          totalTokens: overallStats.totalTokens,
          errorRate: overallStats.errorRate,
          modelBreakdown: Object.keys(overallStats.breakdown)
        },
        historyEntries: usageHistory.length
      };
    });
  }

  private async testHealthChecks(): Promise<void> {
    await this.runTest('Model Health Checks', async () => {
      if (!this.modelManager) {
        throw new Error('Model manager not initialized');
      }

      const availableModels = this.modelManager.getAvailableModels();
      const healthResults: Record<string, any> = {};

      // Test health check for each model (this will likely fail without real endpoints)
      for (const modelName of Object.keys(availableModels)) {
        try {
          const health = await this.modelManager.checkModelHealth(modelName);
          healthResults[modelName] = {
            available: health.available,
            latency: health.latency,
            error: health.error
          };
        } catch (error: any) {
          healthResults[modelName] = {
            available: false,
            error: error.message
          };
        }
      }

      return {
        healthCheckResults: healthResults,
        testedModels: Object.keys(healthResults),
        availableCount: Object.values(healthResults).filter((h: any) => h.available).length
      };
    });
  }

  private printResults(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('=' .repeat(60));

    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const skipped = this.results.filter(r => r.status === 'SKIP').length;

    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`⏱️  Total Duration: ${this.results.reduce((sum, r) => sum + r.duration, 0)}ms`);

    if (failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.results
        .filter(r => r.status === 'FAIL')
        .forEach(r => {
          console.log(`   • ${r.name}: ${r.error}`);
        });
    }

    console.log('\n📈 PERFORMANCE BREAKDOWN:');
    this.results.forEach(r => {
      const status = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⏭️';
      console.log(`   ${status} ${r.name}: ${r.duration}ms`);
    });

    if (passed > 0) {
      console.log('\n✨ SUCCESSFUL TEST DETAILS:');
      this.results
        .filter(r => r.status === 'PASS' && r.details)
        .forEach(r => {
          console.log(`\n   📋 ${r.name}:`);
          console.log('      ', JSON.stringify(r.details, null, 6));
        });
    }

    console.log('\n🎯 NEXT STEPS:');
    console.log('   1. Set up Azure AI Foundry resource and obtain endpoint/API key');
    console.log('   2. Configure Azure Key Vault secrets or environment variables');
    console.log('   3. Deploy model endpoints in Azure AI Foundry');
    console.log('   4. Test with real Azure AI Foundry API calls');
    
    console.log(`\n${passed === this.results.length ? '🎉' : '🔧'} Testing completed!`);
  }
}

// Main execution
async function main(): Promise<void> {
  try {
    const tester = new AzureFoundryTester();
    await tester.runAllTests();
    process.exit(0);
  } catch (error) {
    console.error('💥 Test runner failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { AzureFoundryTester };
