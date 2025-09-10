/**
 * Unit Tests for FoundryModelManager
 * 
 * Comprehensive test suite covering model selection, cost estimation,
 * usage tracking, performance metrics, and health monitoring.
 * 
 * @version 2.0.0
 */

import { jest } from '@jest/globals';
import { FoundryModelManager, ModelSelectionCriteria } from '@/lib/azure-ai-foundry/managers/model-manager';
import { 
  MOCK_FOUNDRY_CONFIG,
  MOCK_MODEL_CONFIGS,
  createMockUsageEntry,
  createMockTokenUsage,
  PERFORMANCE_THRESHOLDS,
  TEST_ENV_SETUP
} from '../../utils/foundry-fixtures';
import { ModelConfig } from '@/lib/azure-ai-foundry/config/foundry-config';

// Mock the foundry config module
jest.mock('@/lib/azure-ai-foundry/config/foundry-config', () => ({
  getFoundryConfig: jest.fn(),
  validateFoundryConfig: jest.fn(),
  getModelConfig: jest.fn(),
  getDefaultModel: jest.fn(),
  clearFoundryConfigCache: jest.fn()
}));

// Mock the base client
jest.mock('@/lib/azure-ai-foundry/clients/foundry-client', () => ({
  FoundryClientBase: class MockFoundryClientBase {
    protected config = MOCK_FOUNDRY_CONFIG;
    async init() { return Promise.resolve(); }
    protected async request(path: string, options?: any) {
      if (path.includes('health-check')) {
        return { status: 200, data: { status: 'healthy' }, raw: '{"status": "healthy"}' };
      }
      throw new Error('Unexpected request in test');
    }
  }
}));

const mockGetFoundryConfig = jest.mocked(require('@/lib/azure-ai-foundry/config/foundry-config').getFoundryConfig);
const mockValidateFoundryConfig = jest.mocked(require('@/lib/azure-ai-foundry/config/foundry-config').validateFoundryConfig);
const mockGetModelConfig = jest.mocked(require('@/lib/azure-ai-foundry/config/foundry-config').getModelConfig);
const mockGetDefaultModel = jest.mocked(require('@/lib/azure-ai-foundry/config/foundry-config').getDefaultModel);

describe('FoundryModelManager', () => {
  let manager: FoundryModelManager;

  beforeAll(() => {
    TEST_ENV_SETUP.setupMockEnvironment();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Setup default mocks
    mockGetFoundryConfig.mockResolvedValue(MOCK_FOUNDRY_CONFIG);
    mockValidateFoundryConfig.mockReturnValue({ isValid: true, errors: [] });
    mockGetModelConfig.mockImplementation((modelName: string) => MOCK_MODEL_CONFIGS[modelName] || null);
    mockGetDefaultModel.mockReturnValue(MOCK_MODEL_CONFIGS['test-gpt-4o']);
    
    manager = new FoundryModelManager();
    await manager.init();
  });

  afterAll(() => {
    TEST_ENV_SETUP.cleanupMockEnvironment();
  });

  describe('Initialization', () => {
    it('should initialize successfully with valid configuration', async () => {
      const newManager = new FoundryModelManager();
      await expect(newManager.init()).resolves.not.toThrow();
    });

    it('should inherit from FoundryClientBase and have access to config', () => {
      const availableModels = manager.getAvailableModels();
      expect(availableModels).toEqual(MOCK_MODEL_CONFIGS);
    });
  });

  describe('Model Configuration Access', () => {
    it('should get all available models', () => {
      const models = manager.getAvailableModels();
      
      expect(models).toEqual(MOCK_MODEL_CONFIGS);
      expect(Object.keys(models)).toContain('test-gpt-4o');
      expect(Object.keys(models)).toContain('test-phi-4');
    });

    it('should get specific model by name', () => {
      const model = manager.getModel('test-gpt-4o');
      
      expect(model).toEqual(MOCK_MODEL_CONFIGS['test-gpt-4o']);
    });

    it('should return null for non-existent model', () => {
      const model = manager.getModel('non-existent-model');
      
      expect(model).toBeNull();
    });

    it('should get default model configuration', () => {
      const defaultModel = manager.getDefaultModelConfig();
      
      expect(defaultModel).toEqual(MOCK_MODEL_CONFIGS['test-gpt-4o']);
      expect(defaultModel.isDefault).toBe(true);
    });
  });

  describe('Model Selection Logic', () => {
    it('should select preferred model when available and meets criteria', () => {
      const criteria: ModelSelectionCriteria = {
        preferredModel: 'test-gpt-4o',
        maxCost: 0.01
      };

      const selected = manager.selectModel(criteria);
      
      expect(selected.modelName).toBe('test-gpt-4o');
    });

    it('should reject preferred model if it exceeds cost limit', () => {
      const criteria: ModelSelectionCriteria = {
        preferredModel: 'test-gpt-4o',
        maxCost: 0.001 // Lower than gpt-4o cost (0.005)
      };

      const selected = manager.selectModel(criteria);
      
      expect(selected.modelName).toBe('test-phi-4'); // Should select cheaper model
    });

    it('should select model with required capabilities', () => {
      const criteria: ModelSelectionCriteria = {
        requiredCapabilities: ['text-generation', 'coding']
      };

      const selected = manager.selectModel(criteria);
      
      expect(selected.capabilities).toContain('text-generation');
      expect(selected.capabilities).toContain('coding');
    });

    it('should fall back to default model when no criteria match', () => {
      const criteria: ModelSelectionCriteria = {
        requiredCapabilities: ['non-existent-capability']
      };

      const selected = manager.selectModel(criteria);
      
      expect(selected).toEqual(MOCK_MODEL_CONFIGS['test-gpt-4o']); // Default model
    });

    it('should use fallback models in order', () => {
      const criteria: ModelSelectionCriteria = {
        preferredModel: 'non-existent-model',
        fallbackModels: ['test-phi-4', 'test-gpt-4o'],
        maxCost: 0.002
      };

      const selected = manager.selectModel(criteria);
      
      expect(selected.modelName).toBe('test-phi-4'); // First fallback that meets criteria
    });

    it('should sort candidates by cost then capabilities', () => {
      const criteria: ModelSelectionCriteria = {
        requiredCapabilities: ['text-generation']
      };

      const selected = manager.selectModel(criteria);
      
      // Should select phi-4 (cheaper) over gpt-4o
      expect(selected.modelName).toBe('test-phi-4');
      expect(selected.costPerToken).toBe(0.001);
    });
  });

  describe('Usage Tracking', () => {
    beforeEach(() => {
      manager.clearUsageHistory();
    });

    it('should track successful usage', () => {
      const tokenUsage = createMockTokenUsage({
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150
      });

      manager.trackUsage({
        modelName: 'test-gpt-4o',
        tokenUsage,
        latency: 1200,
        success: true
      });

      const history = manager.exportUsageHistory();
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({
        modelName: 'test-gpt-4o',
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        cost: 0.75, // 150 tokens * 0.005 cost per token
        latency: 1200,
        success: true
      });
    });

    it('should track failed usage with error code', () => {
      const tokenUsage = createMockTokenUsage();

      manager.trackUsage({
        modelName: 'test-gpt-4o',
        tokenUsage,
        latency: 800,
        success: false,
        errorCode: 'rate_limited'
      });

      const history = manager.exportUsageHistory();
      expect(history[0]).toMatchObject({
        success: false,
        errorCode: 'rate_limited'
      });
    });

    it('should handle unknown model gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const tokenUsage = createMockTokenUsage();

      manager.trackUsage({
        modelName: 'unknown-model',
        tokenUsage,
        latency: 1000,
        success: true
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        '[ModelManager] Unknown model for usage tracking: unknown-model'
      );

      const history = manager.exportUsageHistory();
      expect(history).toHaveLength(0);

      consoleSpy.mockRestore();
    });

    it('should limit usage history to 1000 entries', () => {
      const tokenUsage = createMockTokenUsage();

      // Add 1100 entries
      for (let i = 0; i < 1100; i++) {
        manager.trackUsage({
          modelName: 'test-gpt-4o',
          tokenUsage,
          latency: 1000,
          success: true
        });
      }

      const history = manager.exportUsageHistory();
      expect(history).toHaveLength(1000);
    });
  });

  describe('Performance Metrics', () => {
    beforeEach(() => {
      manager.clearUsageHistory();
    });

    it('should calculate correct metrics for successful requests', () => {
      const baseTime = Date.now();
      
      // Add multiple usage entries
      const usageEntries = [
        createMockUsageEntry({
          modelName: 'test-gpt-4o',
          latency: 1000,
          totalTokens: 100,
          cost: 0.5,
          success: true,
          timestamp: new Date(baseTime - 1000).toISOString()
        }),
        createMockUsageEntry({
          modelName: 'test-gpt-4o',
          latency: 1500,
          totalTokens: 200,
          cost: 1.0,
          success: true,
          timestamp: new Date(baseTime - 500).toISOString()
        })
      ];

      usageEntries.forEach(entry => {
        manager.trackUsage({
          modelName: entry.modelName,
          tokenUsage: {
            prompt_tokens: entry.promptTokens,
            completion_tokens: entry.completionTokens,
            total_tokens: entry.totalTokens
          },
          latency: entry.latency,
          success: entry.success
        });
      });

      const metrics = manager.getModelMetrics('test-gpt-4o');

      expect(metrics).toMatchObject({
        averageLatency: 1250, // (1000 + 1500) / 2
        successRate: 1.0,
        totalCost: 1.5,
        totalTokens: 300,
        requestCount: 2,
        costPerToken: 5.0, // (1.5 / 300) * 1000
        tokensPerSecond: expect.any(Number)
      });
    });

    it('should handle mixed success/failure requests', () => {
      const usageEntries = [
        createMockUsageEntry({ success: true, latency: 1000 }),
        createMockUsageEntry({ success: false, latency: 800 }),
        createMockUsageEntry({ success: true, latency: 1200 })
      ];

      usageEntries.forEach(entry => {
        manager.trackUsage({
          modelName: entry.modelName,
          tokenUsage: {
            prompt_tokens: entry.promptTokens,
            completion_tokens: entry.completionTokens,
            total_tokens: entry.totalTokens
          },
          latency: entry.latency,
          success: entry.success
        });
      });

      const metrics = manager.getModelMetrics('test-gpt-4o');

      expect(metrics.successRate).toBe(2/3); // 2 successes out of 3 requests
      expect(metrics.requestCount).toBe(3);
    });

    it('should return empty metrics for model with no usage', () => {
      const metrics = manager.getModelMetrics('test-phi-4');

      expect(metrics).toEqual({
        averageLatency: 0,
        successRate: 0,
        totalCost: 0,
        totalTokens: 0,
        requestCount: 0,
        costPerToken: 0,
        tokensPerSecond: 0
      });
    });

    it('should filter metrics by time range', () => {
      const oldTime = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
      const recentTime = Date.now() - (1 * 60 * 60 * 1000); // 1 hour ago

      // Add old entry
      manager.trackUsage({
        modelName: 'test-gpt-4o',
        tokenUsage: createMockTokenUsage({ total_tokens: 100 }),
        latency: 1000,
        success: true
      });
      
      // Manually set timestamp to old time
      const history = manager.exportUsageHistory();
      history[0].timestamp = new Date(oldTime).toISOString();

      // Add recent entry
      manager.trackUsage({
        modelName: 'test-gpt-4o',
        tokenUsage: createMockTokenUsage({ total_tokens: 200 }),
        latency: 1500,
        success: true
      });

      // Get metrics for last 24 hours (should only include recent entry)
      const metrics = manager.getModelMetrics('test-gpt-4o', 24);

      expect(metrics.requestCount).toBe(1);
      expect(metrics.totalTokens).toBe(200);
    });
  });

  describe('Usage Statistics', () => {
    beforeEach(() => {
      manager.clearUsageHistory();
    });

    it('should calculate overall statistics', () => {
      // Add usage for multiple models
      manager.trackUsage({
        modelName: 'test-gpt-4o',
        tokenUsage: createMockTokenUsage({ total_tokens: 150 }),
        latency: 1200,
        success: true
      });

      manager.trackUsage({
        modelName: 'test-phi-4',
        tokenUsage: createMockTokenUsage({ total_tokens: 100 }),
        latency: 800,
        success: false
      });

      const stats = manager.getUsageStatistics();

      expect(stats).toMatchObject({
        totalRequests: 2,
        totalTokens: 250,
        averageLatency: 1000, // (1200 + 800) / 2
        errorRate: 0.5, // 1 error out of 2 requests
        timeRange: {
          start: expect.any(String),
          end: expect.any(String)
        },
        breakdown: {
          'test-gpt-4o': {
            requests: 1,
            tokens: 150,
            errors: 0
          },
          'test-phi-4': {
            requests: 1,
            tokens: 100,
            errors: 1
          }
        }
      });
    });

    it('should handle empty statistics', () => {
      const stats = manager.getUsageStatistics();

      expect(stats).toMatchObject({
        totalRequests: 0,
        totalTokens: 0,
        averageLatency: 0,
        errorRate: 0,
        breakdown: {}
      });
    });
  });

  describe('Cost Estimation', () => {
    it('should estimate cost correctly for known model', () => {
      const cost = manager.estimateCost('test-gpt-4o', 1000);
      
      expect(cost).toBe(0.005); // 1000 tokens * (0.005 / 1000)
    });

    it('should estimate cost for different token amounts', () => {
      const smallCost = manager.estimateCost('test-phi-4', 500);
      const largeCost = manager.estimateCost('test-phi-4', 5000);
      
      expect(smallCost).toBe(0.0005); // 500 * (0.001 / 1000)
      expect(largeCost).toBe(0.005);  // 5000 * (0.001 / 1000)
    });

    it('should handle unknown model gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const cost = manager.estimateCost('unknown-model', 1000);
      
      expect(cost).toBe(0);
      expect(consoleSpy).toHaveBeenCalledWith(
        '[ModelManager] Unknown model for cost estimation: unknown-model'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Model Utility Methods', () => {
    it('should sort models by cost efficiency', () => {
      const sortedModels = manager.getModelsByCostEfficiency();
      
      expect(sortedModels[0].modelName).toBe('test-phi-4'); // Cheapest first
      expect(sortedModels[1].modelName).toBe('test-gpt-4o');
      expect(sortedModels[0].costPerToken).toBeLessThan(sortedModels[1].costPerToken);
    });

    it('should filter models by capability', () => {
      const codingModels = manager.getModelsByCapability('coding');
      const reasoningModels = manager.getModelsByCapability('reasoning');
      
      expect(codingModels.map(m => m.modelName)).toContain('test-gpt-4o');
      expect(codingModels.map(m => m.modelName)).not.toContain('test-phi-4');
      
      expect(reasoningModels.map(m => m.modelName)).toContain('test-gpt-4o');
      expect(reasoningModels.map(m => m.modelName)).toContain('test-phi-4');
    });

    it('should clear usage history', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      // Add some usage
      manager.trackUsage({
        modelName: 'test-gpt-4o',
        tokenUsage: createMockTokenUsage(),
        latency: 1000,
        success: true
      });

      expect(manager.exportUsageHistory()).toHaveLength(1);

      manager.clearUsageHistory();

      expect(manager.exportUsageHistory()).toHaveLength(0);
      expect(consoleSpy).toHaveBeenCalledWith('[ModelManager] Usage history cleared');

      consoleSpy.mockRestore();
    });

    it('should export usage history as copy', () => {
      manager.trackUsage({
        modelName: 'test-gpt-4o',
        tokenUsage: createMockTokenUsage(),
        latency: 1000,
        success: true
      });

      const exported = manager.exportUsageHistory();
      const directAccess = (manager as any).usageHistory;

      expect(exported).toEqual(directAccess);
      expect(exported).not.toBe(directAccess); // Should be a copy, not reference
    });
  });

  describe('Recommended Model Selection', () => {
    it('should recommend model for interview use case', () => {
      const model = manager.getRecommendedModel('interview');
      
      expect(model.capabilities).toContain('text-generation');
      expect(model.capabilities).toContain('reasoning');
      expect(model.costPerToken).toBeLessThanOrEqual(0.01);
    });

    it('should recommend model for code generation', () => {
      const model = manager.getRecommendedModel('code-generation');
      
      expect(model.modelName).toBe('test-gpt-4o'); // Only model with coding capability
      expect(model.capabilities).toContain('coding');
    });

    it('should recommend model for reasoning tasks', () => {
      const model = manager.getRecommendedModel('reasoning');
      
      expect(model.capabilities).toContain('reasoning');
    });

    it('should recommend lightweight model for simple tasks', () => {
      const model = manager.getRecommendedModel('lightweight');
      
      expect(model.modelName).toBe('test-phi-4'); // Cheapest model
      expect(model.costPerToken).toBeLessThanOrEqual(0.002);
    });
  });

  describe('Health Checks', () => {
    it('should perform health check for valid model', async () => {
      const health = await manager.checkModelHealth('test-gpt-4o');
      
      expect(health).toEqual({
        available: true,
        latency: expect.any(Number)
      });
    });

    it('should handle unknown model in health check', async () => {
      const health = await manager.checkModelHealth('unknown-model');
      
      expect(health).toEqual({
        available: false,
        error: 'Model not found in configuration'
      });
    });

    it('should handle health check request failures', async () => {
      // Mock the request method to throw an error
      const requestSpy = jest.spyOn(manager as any, 'request').mockRejectedValue(
        new Error('Service unavailable')
      );

      const health = await manager.checkModelHealth('test-gpt-4o');
      
      expect(health).toEqual({
        available: false,
        error: 'Service unavailable'
      });

      requestSpy.mockRestore();
    });

    it('should measure latency during health check', async () => {
      const startTime = Date.now();
      const health = await manager.checkModelHealth('test-gpt-4o');
      const endTime = Date.now();
      
      expect(health.available).toBe(true);
      expect(health.latency).toBeGreaterThanOrEqual(0);
      expect(health.latency).toBeLessThan(endTime - startTime + 100); // Allow some buffer
    });
  });

  describe('Performance Thresholds', () => {
    it('should complete model selection within performance threshold', () => {
      const startTime = performance.now();
      
      manager.selectModel({
        requiredCapabilities: ['text-generation'],
        maxCost: 0.01
      });
      
      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.MODEL_MANAGER.MODEL_SELECTION_TIME);
    });

    it('should complete cost estimation within performance threshold', () => {
      const startTime = performance.now();
      
      manager.estimateCost('test-gpt-4o', 1000);
      
      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(50); // Should be very fast
    });
  });
});
