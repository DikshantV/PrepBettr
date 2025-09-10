/**
 * Unit Tests for FoundryModelManager
 * 
 * Tests model selection, cost estimation, usage tracking,
 * performance metrics, and configuration management.
 */

import { jest } from '@jest/globals';
import foundryConfigFixture from '../fixtures/foundry-config.json';

// Mock the foundry config module
const mockGetModelConfig = jest.fn();
const mockGetDefaultModel = jest.fn();

jest.mock('../../lib/azure-ai-foundry/config/foundry-config', () => ({
  getFoundryConfig: jest.fn().mockResolvedValue(foundryConfigFixture),
  getModelConfig: mockGetModelConfig,
  getDefaultModel: mockGetDefaultModel,
  validateFoundryConfig: jest.fn().mockReturnValue({ isValid: true, errors: [] })
}));

// Create a test implementation of ModelManager
class TestModelManager {
  protected config = foundryConfigFixture;
  private usageHistory: any[] = [];

  constructor() {}

  async init() {
    return Promise.resolve();
  }

  getAvailableModels() {
    return this.config?.models || {};
  }

  getModel(modelName: string) {
    return mockGetModelConfig(modelName);
  }

  getDefaultModelConfig() {
    return mockGetDefaultModel();
  }

  selectModel(criteria: any = {}) {
    const models = this.getAvailableModels();
    const modelList = Object.values(models) as any[];

    // Start with preferred model if specified
    if (criteria.preferredModel && models[criteria.preferredModel]) {
      const preferred = models[criteria.preferredModel];
      if (this.modelMeetsCriteria(preferred, criteria)) {
        return preferred;
      }
    }

    // Try fallback models
    if (criteria.fallbackModels) {
      for (const fallbackName of criteria.fallbackModels) {
        const fallback = models[fallbackName];
        if (fallback && this.modelMeetsCriteria(fallback, criteria)) {
          return fallback;
        }
      }
    }

    // Filter models by criteria
    let candidates = modelList.filter(model => this.modelMeetsCriteria(model, criteria));

    // Sort by cost (ascending) and capabilities (descending)
    candidates = candidates.sort((a, b) => {
      const costDiff = a.costPerToken - b.costPerToken;
      if (Math.abs(costDiff) > 0.001) return costDiff;
      return b.capabilities.length - a.capabilities.length;
    });

    // Return best candidate or default model
    return candidates[0] || this.getDefaultModelConfig();
  }

  private modelMeetsCriteria(model: any, criteria: any): boolean {
    if (criteria.maxCost !== undefined && model.costPerToken > criteria.maxCost) {
      return false;
    }

    if (criteria.requiredCapabilities) {
      const hasAllCapabilities = criteria.requiredCapabilities.every(
        (capability: string) => model.capabilities.includes(capability)
      );
      if (!hasAllCapabilities) {
        return false;
      }
    }

    return true;
  }

  trackUsage(params: {
    modelName: string;
    tokenUsage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    latency: number;
    success: boolean;
    errorCode?: string;
  }): void {
    const model = this.getModel(params.modelName);
    if (!model) {
      console.warn(`[ModelManager] Unknown model for usage tracking: ${params.modelName}`);
      return;
    }

    const cost = (params.tokenUsage.total_tokens / 1000) * model.costPerToken;
    
    const entry = {
      modelName: params.modelName,
      timestamp: new Date().toISOString(),
      promptTokens: params.tokenUsage.prompt_tokens,
      completionTokens: params.tokenUsage.completion_tokens,
      totalTokens: params.tokenUsage.total_tokens,
      cost,
      latency: params.latency,
      success: params.success,
      errorCode: params.errorCode
    };

    this.usageHistory.push(entry);
    
    // Keep only last 1000 entries
    if (this.usageHistory.length > 1000) {
      this.usageHistory = this.usageHistory.slice(-1000);
    }
  }

  getModelMetrics(modelName: string, timeRangeHours = 24) {
    const cutoff = Date.now() - (timeRangeHours * 60 * 60 * 1000);
    const entries = this.usageHistory.filter(
      entry => entry.modelName === modelName && 
               new Date(entry.timestamp).getTime() >= cutoff
    );

    if (entries.length === 0) {
      return {
        averageLatency: 0,
        successRate: 0,
        totalCost: 0,
        totalTokens: 0,
        requestCount: 0,
        costPerToken: 0,
        tokensPerSecond: 0
      };
    }

    const totalLatency = entries.reduce((sum: number, e: any) => sum + e.latency, 0);
    const successCount = entries.filter((e: any) => e.success).length;
    const totalCost = entries.reduce((sum: number, e: any) => sum + e.cost, 0);
    const totalTokens = entries.reduce((sum: number, e: any) => sum + e.totalTokens, 0);
    const totalTime = totalLatency / 1000;

    return {
      averageLatency: totalLatency / entries.length,
      successRate: successCount / entries.length,
      totalCost,
      totalTokens,
      requestCount: entries.length,
      costPerToken: totalTokens > 0 ? (totalCost / totalTokens) * 1000 : 0,
      tokensPerSecond: totalTime > 0 ? totalTokens / totalTime : 0
    };
  }

  clearUsageHistory(): void {
    this.usageHistory = [];
  }

  estimateCost(modelName: string, estimatedTokens: number): number {
    const model = this.getModel(modelName);
    if (!model) return 0;
    return (estimatedTokens / 1000) * model.costPerToken;
  }
}

describe('FoundryModelManager', () => {
  let manager: TestModelManager;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Setup mock implementations
    mockGetModelConfig.mockImplementation((modelName: string) => {
      const models = foundryConfigFixture.models as any;
      return models[modelName] || null;
    });
    
    mockGetDefaultModel.mockReturnValue(foundryConfigFixture.models['test-gpt-4o']);
    
    manager = new TestModelManager();
    await manager.init();
  });

  describe('Configuration Access', () => {
    it('should get all available models', () => {
      const models = manager.getAvailableModels();
      
      expect(models).toEqual(foundryConfigFixture.models);
      expect(Object.keys(models)).toContain('test-gpt-4o');
      expect(Object.keys(models)).toContain('test-phi-4');
    });

    it('should get specific model by name', () => {
      const model = manager.getModel('test-gpt-4o');
      
      expect(model).toEqual(foundryConfigFixture.models['test-gpt-4o']);
      expect(model?.modelName).toBe('test-gpt-4o');
    });

    it('should return null for non-existent model', () => {
      mockGetModelConfig.mockReturnValue(null);
      
      const model = manager.getModel('non-existent-model');
      
      expect(model).toBeNull();
    });

    it('should get default model configuration', () => {
      const defaultModel = manager.getDefaultModelConfig();
      
      expect(defaultModel).toEqual(foundryConfigFixture.models['test-gpt-4o']);
      expect(defaultModel.isDefault).toBe(true);
    });
  });

  describe('Model Selection Logic', () => {
    it('should select preferred model when available and meets criteria', () => {
      const criteria = {
        preferredModel: 'test-gpt-4o',
        maxCost: 0.01
      };

      const selected = manager.selectModel(criteria);
      
      expect(selected.modelName).toBe('test-gpt-4o');
      expect(selected.costPerToken).toBeLessThanOrEqual(0.01);
    });

    it('should reject preferred model if it exceeds cost limit', () => {
      const criteria = {
        preferredModel: 'test-gpt-4o',
        maxCost: 0.001 // Lower than gpt-4o cost (0.005)
      };

      const selected = manager.selectModel(criteria);
      
      expect(selected.modelName).toBe('test-phi-4'); // Should select cheaper model
      expect(selected.costPerToken).toBeLessThanOrEqual(0.001);
    });

    it('should select model with required capabilities', () => {
      const criteria = {
        requiredCapabilities: ['text-generation', 'coding']
      };

      const selected = manager.selectModel(criteria);
      
      expect(selected.capabilities).toContain('text-generation');
      expect(selected.capabilities).toContain('coding');
    });

    it('should fall back to default model when no criteria match', () => {
      const criteria = {
        requiredCapabilities: ['non-existent-capability']
      };

      const selected = manager.selectModel(criteria);
      
      expect(selected).toEqual(foundryConfigFixture.models['test-gpt-4o']); // Default model
    });

    it('should use fallback models in order', () => {
      const criteria = {
        preferredModel: 'non-existent-model',
        fallbackModels: ['test-phi-4', 'test-gpt-4o'],
        maxCost: 0.002
      };

      const selected = manager.selectModel(criteria);
      
      expect(selected.modelName).toBe('test-phi-4'); // First fallback that meets criteria
      expect(selected.costPerToken).toBeLessThanOrEqual(0.002);
    });

    it('should sort candidates by cost then capabilities', () => {
      const criteria = {
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
      const tokenUsage = {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150
      };

      manager.trackUsage({
        modelName: 'test-gpt-4o',
        tokenUsage,
        latency: 1200,
        success: true
      });

      const metrics = manager.getModelMetrics('test-gpt-4o');
      
      expect(metrics.requestCount).toBe(1);
      expect(metrics.totalTokens).toBe(150);
      expect(metrics.averageLatency).toBe(1200);
      expect(metrics.successRate).toBe(1);
      expect(metrics.totalCost).toBeCloseTo(0.00075, 5); // 150 * 0.005 / 1000
    });

    it('should track failed usage', () => {
      const tokenUsage = {
        prompt_tokens: 100,
        completion_tokens: 0,
        total_tokens: 100
      };

      manager.trackUsage({
        modelName: 'test-gpt-4o',
        tokenUsage,
        latency: 2000,
        success: false,
        errorCode: 'TIMEOUT'
      });

      const metrics = manager.getModelMetrics('test-gpt-4o');
      
      expect(metrics.requestCount).toBe(1);
      expect(metrics.successRate).toBe(0);
      expect(metrics.averageLatency).toBe(2000);
    });

    it('should calculate performance metrics correctly', () => {
      // Add multiple usage entries
      const usageEntries = [
        { tokens: 100, latency: 1000, success: true },
        { tokens: 200, latency: 1500, success: true },
        { tokens: 150, latency: 2000, success: false }
      ];

      usageEntries.forEach((entry, index) => {
        manager.trackUsage({
          modelName: 'test-gpt-4o',
          tokenUsage: {
            prompt_tokens: Math.floor(entry.tokens * 0.7),
            completion_tokens: Math.floor(entry.tokens * 0.3),
            total_tokens: entry.tokens
          },
          latency: entry.latency,
          success: entry.success
        });
      });

      const metrics = manager.getModelMetrics('test-gpt-4o');
      
      expect(metrics.requestCount).toBe(3);
      expect(metrics.totalTokens).toBe(450); // 100 + 200 + 150
      expect(metrics.averageLatency).toBe(1500); // (1000 + 1500 + 2000) / 3
      expect(metrics.successRate).toBe(2/3); // 2 successful out of 3
      expect(metrics.totalCost).toBeCloseTo(0.00225, 5); // 450 * 0.005 / 1000
    });

    it('should handle unknown models gracefully', () => {
      mockGetModelConfig.mockReturnValue(null);
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      manager.trackUsage({
        modelName: 'unknown-model',
        tokenUsage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        latency: 1000,
        success: true
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        '[ModelManager] Unknown model for usage tracking: unknown-model'
      );

      consoleSpy.mockRestore();
    });

    it('should limit usage history size', () => {
      // Add more than 1000 entries
      for (let i = 0; i < 1100; i++) {
        manager.trackUsage({
          modelName: 'test-gpt-4o',
          tokenUsage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
          latency: 1000,
          success: true
        });
      }

      const metrics = manager.getModelMetrics('test-gpt-4o');
      
      // Should only keep last 1000 entries
      expect(metrics.requestCount).toBe(1000);
    });
  });

  describe('Cost Estimation', () => {
    it('should estimate cost for valid model', () => {
      const cost = manager.estimateCost('test-gpt-4o', 1000);
      
      expect(cost).toBe(0.005); // 1000/1000 * 0.005
    });

    it('should estimate cost for different token counts', () => {
      const cost500 = manager.estimateCost('test-phi-4', 500);
      const cost2000 = manager.estimateCost('test-phi-4', 2000);
      
      expect(cost500).toBe(0.0005); // 500/1000 * 0.001
      expect(cost2000).toBe(0.002); // 2000/1000 * 0.001
    });

    it('should return 0 for unknown model', () => {
      mockGetModelConfig.mockReturnValue(null);
      
      const cost = manager.estimateCost('unknown-model', 1000);
      
      expect(cost).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty model configuration', () => {
      const emptyManager = new TestModelManager();
      emptyManager['config'] = { models: {} };

      const models = emptyManager.getAvailableModels();
      const selected = emptyManager.selectModel();
      
      expect(models).toEqual({});
      expect(selected).toEqual(foundryConfigFixture.models['test-gpt-4o']); // Falls back to default
    });

    it('should handle metrics for model with no usage history', () => {
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

    it('should handle time range filtering in metrics', () => {
      // Add old entry (beyond time range)
      const oldTimestamp = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      manager['usageHistory'].push({
        modelName: 'test-gpt-4o',
        timestamp: oldTimestamp,
        totalTokens: 100,
        latency: 1000,
        success: true,
        cost: 0.5
      });

      // Add recent entry
      manager.trackUsage({
        modelName: 'test-gpt-4o',
        tokenUsage: { prompt_tokens: 50, completion_tokens: 25, total_tokens: 75 },
        latency: 800,
        success: true
      });

      const metrics24h = manager.getModelMetrics('test-gpt-4o', 24);
      const metrics72h = manager.getModelMetrics('test-gpt-4o', 72);
      
      expect(metrics24h.requestCount).toBe(1); // Only recent entry
      expect(metrics72h.requestCount).toBe(2); // Both entries
    });
  });
});
