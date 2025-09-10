/**
 * Azure AI Foundry Model Manager
 * 
 * Handles model configurations, deployments, cost tracking, and model selection logic.
 * Provides utilities for managing multiple models and their configurations.
 */

import {
  getFoundryConfig,
  getModelConfig,
  getDefaultModel,
  type ModelConfig
} from '../config/foundry-config';
import { FoundryClientBase } from '../clients/foundry-client';
import type {
  ModelDeployment,
  UsageStatistics,
  TokenUsage,
  FoundryError
} from '../types/foundry-types';

/**
 * Model usage tracking entry
 */
export interface ModelUsageEntry {
  modelName: string;
  timestamp: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number; // in USD
  latency: number; // in milliseconds
  success: boolean;
  errorCode?: string;
}

/**
 * Model performance metrics
 */
export interface ModelPerformanceMetrics {
  averageLatency: number;
  successRate: number;
  totalCost: number;
  totalTokens: number;
  requestCount: number;
  costPerToken: number;
  tokensPerSecond: number;
}

/**
 * Model selection criteria
 */
export interface ModelSelectionCriteria {
  maxCost?: number; // maximum cost per 1K tokens
  maxLatency?: number; // maximum acceptable latency in ms
  requiredCapabilities?: string[];
  preferredModel?: string;
  fallbackModels?: string[];
}

/**
 * FoundryModelManager class for managing model configurations and usage
 */
export class FoundryModelManager extends FoundryClientBase {
  private usageHistory: ModelUsageEntry[] = [];
  private deployments: Map<string, ModelDeployment> = new Map();

  constructor() {
    super();
  }

  /**
   * Get all available model configurations
   */
  getAvailableModels(): Record<string, ModelConfig> {
    return this.config?.models || {};
  }

  /**
   * Get model configuration by name with fallback
   */
  getModel(modelName: string): ModelConfig | null {
    return getModelConfig(modelName);
  }

  /**
   * Get the default model configuration
   */
  getDefaultModelConfig(): ModelConfig {
    return getDefaultModel();
  }

  /**
   * Select best model based on criteria
   */
  selectModel(criteria: ModelSelectionCriteria = {}): ModelConfig {
    const models = this.getAvailableModels();
    const modelList = Object.values(models);

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
      // Primary sort: cost
      const costDiff = a.costPerToken - b.costPerToken;
      if (Math.abs(costDiff) > 0.001) return costDiff;
      
      // Secondary sort: capabilities (more is better)
      return b.capabilities.length - a.capabilities.length;
    });

    // Return best candidate or default model
    return candidates[0] || this.getDefaultModelConfig();
  }

  /**
   * Check if model meets selection criteria
   */
  private modelMeetsCriteria(model: ModelConfig, criteria: ModelSelectionCriteria): boolean {
    // Check cost constraint
    if (criteria.maxCost !== undefined && model.costPerToken > criteria.maxCost) {
      return false;
    }

    // Check capabilities
    if (criteria.requiredCapabilities) {
      const hasAllCapabilities = criteria.requiredCapabilities.every(
        capability => model.capabilities.includes(capability)
      );
      if (!hasAllCapabilities) {
        return false;
      }
    }

    // Note: maxLatency check would require historical performance data
    // This could be implemented by tracking actual response times

    return true;
  }

  /**
   * Track usage for a model request
   */
  trackUsage({
    modelName,
    tokenUsage,
    latency,
    success,
    errorCode
  }: {
    modelName: string;
    tokenUsage: TokenUsage;
    latency: number;
    success: boolean;
    errorCode?: string;
  }): void {
    const model = this.getModel(modelName);
    if (!model) {
      console.warn(`[ModelManager] Unknown model for usage tracking: ${modelName}`);
      return;
    }

    const cost = (tokenUsage.total_tokens / 1000) * model.costPerToken;
    
    const entry: ModelUsageEntry = {
      modelName,
      timestamp: new Date().toISOString(),
      promptTokens: tokenUsage.prompt_tokens,
      completionTokens: tokenUsage.completion_tokens,
      totalTokens: tokenUsage.total_tokens,
      cost,
      latency,
      success,
      errorCode
    };

    this.usageHistory.push(entry);
    
    // Keep only last 1000 entries to prevent memory bloat
    if (this.usageHistory.length > 1000) {
      this.usageHistory = this.usageHistory.slice(-1000);
    }
  }

  /**
   * Get performance metrics for a specific model
   */
  getModelMetrics(modelName: string, timeRangeHours = 24): ModelPerformanceMetrics {
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

    const totalLatency = entries.reduce((sum, e) => sum + e.latency, 0);
    const successCount = entries.filter(e => e.success).length;
    const totalCost = entries.reduce((sum, e) => sum + e.cost, 0);
    const totalTokens = entries.reduce((sum, e) => sum + e.totalTokens, 0);
    const totalTime = totalLatency / 1000; // convert to seconds

    return {
      averageLatency: totalLatency / entries.length,
      successRate: successCount / entries.length,
      totalCost,
      totalTokens,
      requestCount: entries.length,
      costPerToken: totalTokens > 0 ? (totalCost / totalTokens) * 1000 : 0, // per 1K tokens
      tokensPerSecond: totalTime > 0 ? totalTokens / totalTime : 0
    };
  }

  /**
   * Get usage statistics for all models
   */
  getUsageStatistics(timeRangeHours = 24): UsageStatistics {
    const cutoff = Date.now() - (timeRangeHours * 60 * 60 * 1000);
    const entries = this.usageHistory.filter(
      entry => new Date(entry.timestamp).getTime() >= cutoff
    );

    const breakdown: UsageStatistics['breakdown'] = {};
    const modelStats = new Map<string, { requests: number; tokens: number; errors: number; latency: number }>();

    entries.forEach(entry => {
      const stats = modelStats.get(entry.modelName) || { requests: 0, tokens: 0, errors: 0, latency: 0 };
      stats.requests += 1;
      stats.tokens += entry.totalTokens;
      stats.errors += entry.success ? 0 : 1;
      stats.latency += entry.latency;
      modelStats.set(entry.modelName, stats);
    });

    modelStats.forEach((stats, modelName) => {
      breakdown[modelName] = {
        requests: stats.requests,
        tokens: stats.tokens,
        errors: stats.errors
      };
    });

    const totalRequests = entries.length;
    const totalTokens = entries.reduce((sum, e) => sum + e.totalTokens, 0);
    const totalErrors = entries.filter(e => !e.success).length;
    const totalLatency = entries.reduce((sum, e) => sum + e.latency, 0);

    return {
      totalRequests,
      totalTokens,
      averageLatency: totalRequests > 0 ? totalLatency / totalRequests : 0,
      errorRate: totalRequests > 0 ? totalErrors / totalRequests : 0,
      timeRange: {
        start: new Date(cutoff).toISOString(),
        end: new Date().toISOString()
      },
      breakdown
    };
  }

  /**
   * Get cost estimate for a request
   */
  estimateCost(modelName: string, estimatedTokens: number): number {
    const model = this.getModel(modelName);
    if (!model) {
      console.warn(`[ModelManager] Unknown model for cost estimation: ${modelName}`);
      return 0;
    }

    return (estimatedTokens / 1000) * model.costPerToken;
  }

  /**
   * List models sorted by cost efficiency
   */
  getModelsByCostEfficiency(): ModelConfig[] {
    const models = Object.values(this.getAvailableModels());
    return models.sort((a, b) => a.costPerToken - b.costPerToken);
  }

  /**
   * Get models by capability
   */
  getModelsByCapability(capability: string): ModelConfig[] {
    const models = Object.values(this.getAvailableModels());
    return models.filter(model => model.capabilities.includes(capability));
  }

  /**
   * Clear usage history (for testing or privacy)
   */
  clearUsageHistory(): void {
    this.usageHistory = [];
    console.log('[ModelManager] Usage history cleared');
  }

  /**
   * Export usage history for external analysis
   */
  exportUsageHistory(): ModelUsageEntry[] {
    return [...this.usageHistory]; // Return copy
  }

  /**
   * Get recommended model for specific use case
   */
  getRecommendedModel(useCase: 'interview' | 'code-generation' | 'reasoning' | 'lightweight'): ModelConfig {
    const useCaseMap: Record<string, ModelSelectionCriteria> = {
      interview: {
        requiredCapabilities: ['text-generation', 'reasoning'],
        maxCost: 0.01, // Max $10 per 1K tokens
        preferredModel: 'gpt-4o'
      },
      'code-generation': {
        requiredCapabilities: ['code-generation', 'reasoning'],
        preferredModel: 'gpt-4-turbo'
      },
      reasoning: {
        requiredCapabilities: ['reasoning'],
        preferredModel: 'gpt-4o'
      },
      lightweight: {
        maxCost: 0.002, // Max $2 per 1K tokens
        preferredModel: 'phi-4',
        fallbackModels: ['gpt-4o']
      }
    };

    const criteria = useCaseMap[useCase] || {};
    return this.selectModel(criteria);
  }

  /**
   * Health check for model availability
   */
  async checkModelHealth(modelName: string): Promise<{ available: boolean; latency?: number; error?: string }> {
    const model = this.getModel(modelName);
    if (!model) {
      return { available: false, error: 'Model not found in configuration' };
    }

    try {
      const start = Date.now();
      // Simple health check with minimal prompt
      await this.request('/models/health-check', {
        method: 'POST',
        body: {
          model: model.deploymentName,
          prompt: 'test',
          max_tokens: 1
        }
      });
      const latency = Date.now() - start;
      return { available: true, latency };
    } catch (error: any) {
      return { 
        available: false, 
        error: error.message || 'Health check failed' 
      };
    }
  }
}
