/**
 * Unit Tests for Unified Configuration Service
 * 
 * Tests for the unified configuration service including drift detection,
 * validation, caching, and synchronization capabilities.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { unifiedConfigService, CONFIG_SCHEMA, CONFIG_DEFAULTS } from '@/lib/services/unified-config-service';
import type { ConfigValue } from '@/lib/services/unified-config-service';

// ===== MOCKS =====

// Mock Azure App Configuration
jest.mock('@azure/app-configuration', () => {
  const mockSettings = new Map();
  
  return {
    AppConfigurationClient: jest.fn().mockImplementation(() => ({
      listConfigurationSettings: jest.fn().mockReturnValue({
        async *[Symbol.asyncIterator]() {
          for (const [key, value] of mockSettings) {
            yield {
              key,
              value: JSON.stringify(value),
              contentType: 'application/json',
              etag: 'mock-etag-' + Date.now(),
              tags: {
                syncToFirebase: 'true',
                version: '1.0.0',
                source: 'test'
              }
            };
          }
        }
      }),
      getConfigurationSetting: jest.fn().mockImplementation(({ key }) => {
        const value = mockSettings.get(key);
        if (!value) {
          const error = new Error('Not found');
          (error as any).statusCode = 404;
          throw error;
        }
        return {
          key,
          value: JSON.stringify(value),
          contentType: 'application/json',
          etag: 'mock-etag-' + Date.now(),
          tags: {
            syncToFirebase: 'true',
            version: '1.0.0'
          }
        };
      }),
      setConfigurationSetting: jest.fn().mockImplementation(({ key, value }) => {
        mockSettings.set(key, JSON.parse(value));
        return Promise.resolve();
      }),
      deleteConfigurationSetting: jest.fn().mockImplementation(({ key }) => {
        mockSettings.delete(key);
        return Promise.resolve();
      })
    })),
    mockSettings // Expose for test manipulation
  };
});

// Mock Azure Identity
jest.mock('@azure/identity', () => ({
  DefaultAzureCredential: jest.fn().mockImplementation(() => ({}))
}));

// Mock Firebase Remote Config
jest.mock('firebase/remote-config', () => ({
  getRemoteConfig: jest.fn().mockReturnValue({}),
  getValue: jest.fn().mockReturnValue({
    asString: () => 'false'
  })
}));

// Mock Firebase Client
jest.mock('@/firebase/client', () => ({
  app: () => ({})
}));

// Mock Cosmos DB Service
const mockCosmosService = {
  initialize: jest.fn().mockResolvedValue(undefined),
  createDocument: jest.fn().mockResolvedValue('mock-id'),
  queryDocuments: jest.fn().mockResolvedValue([]),
  healthCheck: jest.fn().mockResolvedValue({ status: 'healthy' })
};

jest.mock('@/lib/services/azure-cosmos-service', () => ({
  azureCosmosService: mockCosmosService
}));

// Mock Error Logging
jest.mock('@/lib/errors', () => ({
  logServerError: jest.fn()
}));

// ===== TEST DATA =====

const testConfigs = {
  'features.autoApplyAzure': true,
  'features.voiceInterview': false,
  'quotas.freeInterviews': 3,
  'quotas.freeResumes': 2,
  'core.app.environment': 'test',
  'core.app.debug': true
};

const invalidConfigs = {
  'quotas.freeInterviews': -1, // Negative number
  'core.app.environment': 'invalid-env', // Invalid enum
  'features.autoApplyAzure': 'not-boolean' // Wrong type
};

// ===== TEST SUITE =====

describe('UnifiedConfigService', () => {
  let mockAzureSettings: Map<string, any>;

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Get reference to mock settings
    const { mockSettings } = await import('@azure/app-configuration');
    mockAzureSettings = mockSettings as Map<string, any>;
    
    // Set up test data
    Object.entries(testConfigs).forEach(([key, value]) => {
      mockAzureSettings.set(key, value);
    });

    // Mock environment variables
    process.env.AZURE_APP_CONFIG_CONNECTION_STRING = 'test-connection-string';
    
    // Reset service state
    (unifiedConfigService as any).initialized = false;
    (unifiedConfigService as any).cache.clear();
    (unifiedConfigService as any).driftCache.clear();
  });

  afterEach(() => {
    jest.clearAllTimers();
    delete process.env.AZURE_APP_CONFIG_CONNECTION_STRING;
  });

  // ===== INITIALIZATION TESTS =====

  describe('Initialization', () => {
    it('should initialize with Azure App Configuration connection string', async () => {
      await unifiedConfigService.initialize();
      expect((unifiedConfigService as any).initialized).toBe(true);
    });

    it('should initialize with Azure endpoint and managed identity', async () => {
      delete process.env.AZURE_APP_CONFIG_CONNECTION_STRING;
      process.env.AZURE_APP_CONFIG_ENDPOINT = 'https://test.azconfig.io';
      
      await unifiedConfigService.initialize();
      expect((unifiedConfigService as any).initialized).toBe(true);
      
      delete process.env.AZURE_APP_CONFIG_ENDPOINT;
    });

    it('should handle initialization without Azure configuration', async () => {
      delete process.env.AZURE_APP_CONFIG_CONNECTION_STRING;
      
      await unifiedConfigService.initialize();
      expect((unifiedConfigService as any).initialized).toBe(true);
    });

    it('should handle initialization errors gracefully', async () => {
      const mockClient = (await import('@azure/app-configuration')).AppConfigurationClient;
      (mockClient as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Connection failed');
      });
      
      await unifiedConfigService.initialize();
      expect((unifiedConfigService as any).initialized).toBe(true);
    });
  });

  // ===== CONFIGURATION RETRIEVAL TESTS =====

  describe('Configuration Retrieval', () => {
    beforeEach(async () => {
      await unifiedConfigService.initialize();
    });

    it('should get configuration value from Azure', async () => {
      const value = await unifiedConfigService.get('features.autoApplyAzure');
      expect(value).toBe(true);
    });

    it('should return default value for missing keys', async () => {
      const value = await unifiedConfigService.get('non-existent-key', 'default');
      expect(value).toBe('default');
    });

    it('should return schema default for known keys', async () => {
      mockAzureSettings.clear();
      const value = await unifiedConfigService.get('features.autoApplyAzure');
      expect(value).toBe(false); // From CONFIG_DEFAULTS
    });

    it('should handle Azure service errors gracefully', async () => {
      const mockClient = (await import('@azure/app-configuration')).AppConfigurationClient;
      const mockInstance = new mockClient();
      mockInstance.getConfigurationSetting = jest.fn().mockRejectedValue(new Error('Service unavailable'));
      
      (unifiedConfigService as any).azureClient = mockInstance;
      
      const value = await unifiedConfigService.get('features.autoApplyAzure', 'fallback');
      expect(value).toBe('fallback');
    });

    it('should cache retrieved values', async () => {
      await unifiedConfigService.get('features.autoApplyAzure');
      
      const cache = (unifiedConfigService as any).cache;
      expect(cache.size).toBeGreaterThan(0);
    });

    it('should use cached values when available', async () => {
      // First call
      await unifiedConfigService.get('features.autoApplyAzure');
      
      // Clear mock Azure settings to verify cache is used
      mockAzureSettings.clear();
      
      // Second call should use cache
      const value = await unifiedConfigService.get('features.autoApplyAzure');
      expect(value).toBe(true);
    });

    it('should expire cached values after TTL', async () => {
      // Set a very short cache TTL for testing
      (unifiedConfigService as any).CACHE_TTL = 10; // 10ms
      
      await unifiedConfigService.get('features.autoApplyAzure');
      
      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 20));
      
      // Should fetch fresh value
      mockAzureSettings.set('features.autoApplyAzure', false);
      const value = await unifiedConfigService.get('features.autoApplyAzure');
      expect(value).toBe(false);
    });
  });

  // ===== CONFIGURATION SETTING TESTS =====

  describe('Configuration Setting', () => {
    beforeEach(async () => {
      await unifiedConfigService.initialize();
    });

    it('should set configuration value in Azure', async () => {
      await unifiedConfigService.set('features.newFeature', true, {
        environment: 'test',
        version: '1.0.0',
        changedBy: 'test-user'
      });

      expect(mockAzureSettings.get('features.newFeature')).toBe(true);
    });

    it('should validate configuration values', async () => {
      await expect(
        unifiedConfigService.set('quotas.freeInterviews', -1)
      ).rejects.toThrow('below minimum');
    });

    it('should record audit entries', async () => {
      await unifiedConfigService.set('features.testFlag', true);
      
      expect(mockCosmosService.createDocument).toHaveBeenCalledWith(
        'configAudit',
        expect.objectContaining({
          key: 'features.testFlag',
          newValue: true,
          source: 'unified'
        })
      );
    });

    it('should clear cache after setting values', async () => {
      // Get a value to populate cache
      await unifiedConfigService.get('features.autoApplyAzure');
      expect((unifiedConfigService as any).cache.size).toBeGreaterThan(0);
      
      // Set the same key
      await unifiedConfigService.set('features.autoApplyAzure', false);
      
      // Cache should be cleared for that key
      const cachedValue = (unifiedConfigService as any).getCachedValue('features.autoApplyAzure');
      expect(cachedValue).toBeNull();
    });

    it('should handle setting errors gracefully', async () => {
      const mockClient = (await import('@azure/app-configuration')).AppConfigurationClient;
      const mockInstance = new mockClient();
      mockInstance.setConfigurationSetting = jest.fn().mockRejectedValue(new Error('Write failed'));
      
      (unifiedConfigService as any).azureClient = mockInstance;
      
      await expect(
        unifiedConfigService.set('features.testFlag', true)
      ).rejects.toThrow('Write failed');
    });
  });

  // ===== BULK OPERATIONS TESTS =====

  describe('Bulk Operations', () => {
    beforeEach(async () => {
      await unifiedConfigService.initialize();
    });

    it('should get all configurations', async () => {
      const allConfigs = await unifiedConfigService.getAll();
      
      expect(allConfigs).toHaveProperty('features.autoApplyAzure', true);
      expect(allConfigs).toHaveProperty('quotas.freeInterviews', 3);
    });

    it('should get configurations with prefix filter', async () => {
      const featureConfigs = await unifiedConfigService.getAll('features.');
      
      expect(featureConfigs).toHaveProperty('features.autoApplyAzure');
      expect(featureConfigs).not.toHaveProperty('quotas.freeInterviews');
    });

    it('should include defaults for missing keys', async () => {
      mockAzureSettings.clear();
      
      const allConfigs = await unifiedConfigService.getAll();
      
      // Should include defaults
      expect(allConfigs).toHaveProperty('quotas.freeInterviews', 3);
      expect(allConfigs).toHaveProperty('quotas.freeResumes', 2);
    });

    it('should handle Azure service errors in bulk operations', async () => {
      const mockClient = (await import('@azure/app-configuration')).AppConfigurationClient;
      const mockInstance = new mockClient();
      mockInstance.listConfigurationSettings = jest.fn().mockImplementation(() => {
        throw new Error('Service unavailable');
      });
      
      (unifiedConfigService as any).azureClient = mockInstance;
      
      const allConfigs = await unifiedConfigService.getAll();
      
      // Should return defaults only
      expect(allConfigs).toHaveProperty('quotas.freeInterviews', 3);
    });
  });

  // ===== VALIDATION TESTS =====

  describe('Configuration Validation', () => {
    beforeEach(async () => {
      await unifiedConfigService.initialize();
    });

    it('should validate required fields', async () => {
      await expect(
        unifiedConfigService.set('core.app.environment', undefined)
      ).rejects.toThrow();
    });

    it('should validate type constraints', async () => {
      await expect(
        unifiedConfigService.set('features.autoApplyAzure', 'not-boolean')
      ).rejects.toThrow('expected type boolean');
    });

    it('should validate enum constraints', async () => {
      await expect(
        unifiedConfigService.set('core.app.environment', 'invalid-env')
      ).rejects.toThrow('must be one of');
    });

    it('should validate numeric ranges', async () => {
      await expect(
        unifiedConfigService.set('quotas.freeInterviews', -1)
      ).rejects.toThrow('below minimum');
      
      await expect(
        unifiedConfigService.set('quotas.freeInterviews', 1000)
      ).rejects.toThrow('above maximum');
    });

    it('should allow valid configurations', async () => {
      await expect(
        unifiedConfigService.set('features.autoApplyAzure', true)
      ).resolves.not.toThrow();
      
      await expect(
        unifiedConfigService.set('quotas.freeInterviews', 5)
      ).resolves.not.toThrow();
    });

    it('should skip validation for unknown keys', async () => {
      await expect(
        unifiedConfigService.set('unknown.key', 'any-value')
      ).resolves.not.toThrow();
    });
  });

  // ===== DRIFT DETECTION TESTS =====

  describe('Drift Detection', () => {
    beforeEach(async () => {
      await unifiedConfigService.initialize();
    });

    it('should detect configuration drift', async () => {
      // Mock Firebase returning different value
      const { getValue } = await import('firebase/remote-config');
      (getValue as jest.Mock).mockReturnValue({
        asString: () => 'true' // Different from Azure value
      });

      const driftResults = await unifiedConfigService.checkForDrift();
      
      expect(driftResults).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            key: expect.any(String),
            drifted: true
          })
        ])
      );
    });

    it('should record drift events in Cosmos DB', async () => {
      // Mock Firebase returning different value
      const { getValue } = await import('firebase/remote-config');
      (getValue as jest.Mock).mockReturnValue({
        asString: () => 'true'
      });

      await unifiedConfigService.checkForDrift();
      
      expect(mockCosmosService.createDocument).toHaveBeenCalledWith(
        'configDrift',
        expect.objectContaining({
          driftCount: expect.any(Number),
          keys: expect.any(Array)
        })
      );
    });

    it('should not detect drift when values match', async () => {
      // Mock Firebase returning same value as Azure
      const { getValue } = await import('firebase/remote-config');
      (getValue as jest.Mock).mockReturnValue({
        asString: () => 'false'
      });

      const driftResults = await unifiedConfigService.checkForDrift();
      
      const driftedItems = driftResults.filter(r => r.drifted);
      expect(driftedItems).toHaveLength(0);
    });
  });

  // ===== SUBSCRIPTION TESTS =====

  describe('Configuration Subscriptions', () => {
    beforeEach(async () => {
      await unifiedConfigService.initialize();
    });

    it('should subscribe to configuration changes', (done) => {
      let callCount = 0;
      
      const unsubscribe = unifiedConfigService.subscribe('features.autoApplyAzure', (value) => {
        callCount++;
        if (callCount === 1) {
          expect(value).toBe(true); // Initial value
        } else if (callCount === 2) {
          expect(value).toBe(false); // Changed value
          unsubscribe();
          done();
        }
      });

      // Change the value after subscription
      setTimeout(async () => {
        mockAzureSettings.set('features.autoApplyAzure', false);
        (unifiedConfigService as any).cache.clear(); // Clear cache to force refresh
      }, 50);
    });

    it('should handle subscription errors gracefully', (done) => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Mock get method to throw error
      const originalGet = unifiedConfigService.get;
      unifiedConfigService.get = jest.fn().mockRejectedValue(new Error('Test error'));
      
      const unsubscribe = unifiedConfigService.subscribe('test.key', () => {});
      
      setTimeout(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Config subscription error'),
          expect.any(Error)
        );
        
        // Restore original method
        unifiedConfigService.get = originalGet;
        consoleSpy.mockRestore();
        unsubscribe();
        done();
      }, 50);
    });

    it('should allow unsubscribing from changes', (done) => {
      let callCount = 0;
      
      const unsubscribe = unifiedConfigService.subscribe('features.autoApplyAzure', () => {
        callCount++;
      });

      // Unsubscribe immediately
      unsubscribe();

      // Change value after unsubscribe
      setTimeout(async () => {
        mockAzureSettings.set('features.autoApplyAzure', false);
        (unifiedConfigService as any).cache.clear();
      }, 50);

      // Verify no more calls after unsubscribe
      setTimeout(() => {
        expect(callCount).toBe(1); // Only initial call
        done();
      }, 100);
    });
  });

  // ===== ROLLBACK TESTS =====

  describe('Configuration Rollback', () => {
    beforeEach(async () => {
      await unifiedConfigService.initialize();
    });

    it('should rollback to previous configuration version', async () => {
      const versionId = 'test-version-123';
      
      // Mock audit entry
      mockCosmosService.queryDocuments.mockResolvedValueOnce([{
        id: 'audit-1',
        key: 'features.autoApplyAzure',
        oldValue: false,
        newValue: true,
        version: versionId,
        rollbackable: true,
        metadata: { syncToFirebase: true }
      }]);

      await unifiedConfigService.revert(versionId);
      
      expect(mockAzureSettings.get('features.autoApplyAzure')).toBe(false);
    });

    it('should reject rollback for non-existent versions', async () => {
      const versionId = 'non-existent-version';
      
      // Mock no audit entry found
      mockCosmosService.queryDocuments.mockResolvedValueOnce([]);

      await expect(
        unifiedConfigService.revert(versionId)
      ).rejects.toThrow('not found or not rollbackable');
    });

    it('should reject rollback for non-rollbackable versions', async () => {
      const versionId = 'test-version-123';
      
      // Mock non-rollbackable audit entry
      mockCosmosService.queryDocuments.mockResolvedValueOnce([{
        id: 'audit-1',
        key: 'features.autoApplyAzure',
        oldValue: false,
        newValue: true,
        version: versionId,
        rollbackable: false
      }]);

      await expect(
        unifiedConfigService.revert(versionId)
      ).rejects.toThrow('not found or not rollbackable');
    });
  });

  // ===== REFRESH TESTS =====

  describe('Configuration Refresh', () => {
    beforeEach(async () => {
      await unifiedConfigService.initialize();
    });

    it('should clear caches on refresh', async () => {
      // Populate caches
      await unifiedConfigService.get('features.autoApplyAzure');
      await unifiedConfigService.checkForDrift();
      
      expect((unifiedConfigService as any).cache.size).toBeGreaterThan(0);
      expect((unifiedConfigService as any).driftCache.size).toBeGreaterThan(0);
      
      await unifiedConfigService.refresh();
      
      expect((unifiedConfigService as any).cache.size).toBe(0);
      expect((unifiedConfigService as any).driftCache.size).toBe(0);
    });

    it('should perform drift check on refresh', async () => {
      const checkForDriftSpy = jest.spyOn(unifiedConfigService, 'checkForDrift');
      
      await unifiedConfigService.refresh();
      
      expect(checkForDriftSpy).toHaveBeenCalled();
    });
  });

  // ===== HEALTH CHECK TESTS =====

  describe('Health Check', () => {
    it('should return healthy status when Azure client is available', async () => {
      await unifiedConfigService.initialize();
      
      const health = await unifiedConfigService.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.details).toHaveProperty('cacheSize');
      expect(health.details).toHaveProperty('driftDetected');
    });

    it('should return unhealthy status when Azure client is not available', async () => {
      delete process.env.AZURE_APP_CONFIG_CONNECTION_STRING;
      (unifiedConfigService as any).initialized = false;
      
      await unifiedConfigService.initialize();
      
      const health = await unifiedConfigService.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.message).toContain('not available');
    });

    it('should handle health check errors', async () => {
      await unifiedConfigService.initialize();
      
      const mockClient = (await import('@azure/app-configuration')).AppConfigurationClient;
      const mockInstance = new mockClient();
      mockInstance.listConfigurationSettings = jest.fn().mockImplementation(() => {
        throw new Error('Health check failed');
      });
      
      (unifiedConfigService as any).azureClient = mockInstance;
      
      const health = await unifiedConfigService.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.message).toContain('Health check failed');
    });
  });

  // ===== UTILITY TESTS =====

  describe('Utility Functions', () => {
    it('should calculate consistent hashes', () => {
      const hash1 = (unifiedConfigService as any).calculateHash({ a: 1, b: 2 });
      const hash2 = (unifiedConfigService as any).calculateHash({ b: 2, a: 1 });
      const hash3 = (unifiedConfigService as any).calculateHash({ a: 1, b: 3 });
      
      expect(hash1).toBe(hash2); // Same content, different order
      expect(hash1).not.toBe(hash3); // Different content
    });

    it('should infer correct types', () => {
      const inferType = (unifiedConfigService as any).inferType;
      
      expect(inferType('string')).toBe('string');
      expect(inferType(123)).toBe('number');
      expect(inferType(true)).toBe('boolean');
      expect(inferType([])).toBe('array');
      expect(inferType({})).toBe('object');
    });

    it('should serialize values correctly', () => {
      const serializeValue = (unifiedConfigService as any).serializeValue;
      
      expect(serializeValue('string')).toBe('string');
      expect(serializeValue(123)).toBe('123');
      expect(serializeValue(true)).toBe('true');
      expect(serializeValue({ a: 1 })).toBe('{"a":1}');
    });

    it('should determine correct content types', () => {
      const getContentType = (unifiedConfigService as any).getContentType;
      
      expect(getContentType('string')).toBe('text/plain');
      expect(getContentType(123)).toBe('text/plain');
      expect(getContentType({})).toBe('application/json');
      expect(getContentType([])).toBe('application/json');
    });
  });

  // ===== INTEGRATION TESTS =====

  describe('Integration Scenarios', () => {
    beforeEach(async () => {
      await unifiedConfigService.initialize();
    });

    it('should handle complete configuration lifecycle', async () => {
      const key = 'integration.test.flag';
      const initialValue = true;
      const updatedValue = false;

      // Set initial value
      await unifiedConfigService.set(key, initialValue, {
        version: 'v1',
        changedBy: 'integration-test'
      });

      // Get and verify
      let currentValue = await unifiedConfigService.get(key);
      expect(currentValue).toBe(initialValue);

      // Update value
      await unifiedConfigService.set(key, updatedValue, {
        version: 'v2',
        changedBy: 'integration-test'
      });

      // Get updated value
      currentValue = await unifiedConfigService.get(key);
      expect(currentValue).toBe(updatedValue);

      // Verify audit entries were created
      expect(mockCosmosService.createDocument).toHaveBeenCalledWith(
        'configAudit',
        expect.objectContaining({
          key,
          oldValue: expect.any(Boolean),
          newValue: expect.any(Boolean)
        })
      );
    });

    it('should handle Azure service outage gracefully', async () => {
      // Simulate Azure service outage
      const mockClient = (await import('@azure/app-configuration')).AppConfigurationClient;
      const mockInstance = new mockClient();
      mockInstance.getConfigurationSetting = jest.fn().mockRejectedValue(new Error('Service outage'));
      mockInstance.listConfigurationSettings = jest.fn().mockImplementation(() => {
        throw new Error('Service outage');
      });
      
      (unifiedConfigService as any).azureClient = mockInstance;

      // Should fall back to defaults
      const value = await unifiedConfigService.get('quotas.freeInterviews');
      expect(value).toBe(3); // From CONFIG_DEFAULTS

      const allConfigs = await unifiedConfigService.getAll();
      expect(allConfigs).toHaveProperty('quotas.freeInterviews', 3);
      
      // Health check should report unhealthy
      const health = await unifiedConfigService.healthCheck();
      expect(health.healthy).toBe(false);
    });

    it('should maintain consistency during concurrent operations', async () => {
      const key = 'concurrent.test.counter';
      let counter = 0;

      // Simulate concurrent increment operations
      const incrementOperations = Array.from({ length: 10 }, async (_, i) => {
        const currentValue = await unifiedConfigService.get(key, 0);
        const newValue = currentValue + 1;
        await unifiedConfigService.set(key, newValue, {
          version: `concurrent-${i}`,
          changedBy: 'concurrent-test'
        });
        return newValue;
      });

      await Promise.all(incrementOperations);

      const finalValue = await unifiedConfigService.get(key);
      expect(typeof finalValue).toBe('number');
      expect(finalValue).toBeGreaterThan(0);
    });
  });
});

// ===== REACT HOOK TESTS =====

describe('useUnifiedConfig Hook', () => {
  // Note: These tests would require a React testing environment
  // For now, we'll test the hook logic conceptually
  
  it('should be defined', () => {
    const { useUnifiedConfig } = require('@/lib/services/unified-config-service');
    expect(typeof useUnifiedConfig).toBe('function');
  });

  // Additional React hook tests would go here with @testing-library/react-hooks
});

// ===== PERFORMANCE TESTS =====

describe('Performance Characteristics', () => {
  beforeEach(async () => {
    await unifiedConfigService.initialize();
  });

  it('should handle large configuration sets efficiently', async () => {
    // Add many configurations
    const largeConfigSet: Record<string, any> = {};
    for (let i = 0; i < 1000; i++) {
      largeConfigSet[`perf.test.key.${i}`] = `value-${i}`;
      mockAzureSettings.set(`perf.test.key.${i}`, `value-${i}`);
    }

    const startTime = Date.now();
    const allConfigs = await unifiedConfigService.getAll('perf.test.');
    const endTime = Date.now();

    expect(Object.keys(allConfigs).length).toBeGreaterThanOrEqual(1000);
    expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
  });

  it('should cache frequently accessed values', async () => {
    const key = 'perf.frequently.accessed';
    
    // First access
    const start1 = Date.now();
    await unifiedConfigService.get(key, 'default');
    const time1 = Date.now() - start1;

    // Second access (should use cache)
    const start2 = Date.now();
    await unifiedConfigService.get(key, 'default');
    const time2 = Date.now() - start2;

    // Cached access should be significantly faster
    expect(time2).toBeLessThan(time1);
  });
});
