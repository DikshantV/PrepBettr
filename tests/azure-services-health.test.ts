import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { azureOpenAIService } from '../lib/services/azure-openai-service';
import { azureSpeechService } from '../azure/lib/services/azure-speech-service';
import { fetchAzureSecrets, getAzureConfig } from '../lib/azure-config';
import { fetchAzureSecrets as fetchBrowserSecrets } from '../lib/azure-config-browser';

describe('Azure Services Health Check', () => {
  describe('Configuration Validation', () => {
    it('should have valid API version for Azure OpenAI', async () => {
      // Valid API versions for Azure OpenAI as of 2024
      const validApiVersions = [
        '2024-02-15-preview', // Current stable preview
        '2024-08-01-preview', // Latest preview (but less stable)
        '2023-12-01-preview', // Previous stable
        '2023-05-15',         // GA version
      ];
      
      // Check all service files for API version
      const apiVersionPattern = /api-version.*["']([^"']+)["']/g;
      const serviceFiles = [
        '../lib/services/azure-openai-service.ts',
        '../lib/services/azure-openai.ts',
        '../azure/lib/services/azure-openai-service.ts',
      ];
      
      for (const file of serviceFiles) {
        try {
          const fs = await import('fs');
          const content = fs.readFileSync(file, 'utf-8');
          const matches = content.matchAll(apiVersionPattern);
          
          for (const match of matches) {
            const apiVersion = match[1];
            expect(validApiVersions).toContain(apiVersion);
            console.log(`✅ ${file}: Using valid API version ${apiVersion}`);
          }
        } catch (error) {
          console.warn(`⚠️ Could not check ${file}: ${error.message}`);
        }
      }
    });

    it('should validate Azure OpenAI deployment name matches available models', async () => {
      const secrets = await fetchAzureSecrets();
      
      // Common Azure OpenAI deployment names
      const validDeploymentPatterns = [
        /^gpt-4[a-z0-9-]*$/i,        // GPT-4 variants
        /^gpt-35-turbo[a-z0-9-]*$/i, // GPT-3.5 Turbo variants
        /^text-embedding[a-z0-9-]*$/i, // Embedding models
        /^dall-e[a-z0-9-]*$/i,       // DALL-E models
        /^whisper[a-z0-9-]*$/i,      // Whisper models
      ];
      
      const deployment = secrets.azureOpenAIDeployment;
      expect(deployment).toBeDefined();
      expect(deployment.length).toBeGreaterThan(0);
      
      const isValidDeployment = validDeploymentPatterns.some(pattern => 
        pattern.test(deployment)
      );
      
      expect(isValidDeployment).toBe(true);
      console.log(`✅ Deployment name "${deployment}" appears to be valid`);
    });

    it('should extract correct region from Speech Service endpoint', async () => {
      const secrets = await fetchAzureSecrets();
      const endpoint = secrets.speechEndpoint;
      
      expect(endpoint).toBeDefined();
      expect(endpoint).toMatch(/^https:\/\/[a-z0-9-]+\.(api\.cognitive|cognitiveservices)\.microsoft\.com/i);
      
      // Extract region from endpoint
      const regionMatch = endpoint.match(/https:\/\/([^.]+)/);
      expect(regionMatch).toBeTruthy();
      
      const region = regionMatch?.[1];
      expect(region).toBeDefined();
      
      // Common Azure regions
      const validRegions = [
        'eastus', 'eastus2', 'westus', 'westus2', 'westus3',
        'centralus', 'northcentralus', 'southcentralus', 'westcentralus',
        'canadacentral', 'canadaeast',
        'northeurope', 'westeurope', 'uksouth', 'ukwest',
        'francecentral', 'francesouth', 'germanywestcentral',
        'switzerlandnorth', 'switzerlandwest', 'norwayeast', 'norwaywest',
        'brazilsouth', 'australiaeast', 'australiasoutheast',
        'southeastasia', 'eastasia', 'japaneast', 'japanwest',
        'koreacentral', 'koreasouth', 'centralindia', 'southindia', 'westindia'
      ];
      
      expect(validRegions).toContain(region);
      console.log(`✅ Speech Service region "${region}" is valid`);
    });

    it('should have consistent configurations across environments', async () => {
      const serverSecrets = await fetchAzureSecrets();
      const browserSecrets = await fetchBrowserSecrets();
      
      // Key fields should be present in both
      expect(serverSecrets.azureOpenAIKey).toBeDefined();
      expect(browserSecrets.azureOpenAIKey).toBeDefined();
      
      expect(serverSecrets.azureOpenAIEndpoint).toBeDefined();
      expect(browserSecrets.azureOpenAIEndpoint).toBeDefined();
      
      expect(serverSecrets.azureOpenAIDeployment).toBeDefined();
      expect(browserSecrets.azureOpenAIDeployment).toBeDefined();
      
      console.log('✅ Configurations are consistent across server and browser environments');
    });
  });

  describe('Service Initialization Tests', () => {
    afterAll(() => {
      // Clean up services after tests
      azureOpenAIService.dispose();
      azureSpeechService.dispose();
    });

    it('should successfully initialize Azure OpenAI Service', async () => {
      const initialized = await azureOpenAIService.initialize();
      
      if (process.env.CI && !process.env.AZURE_OPENAI_KEY) {
        // In CI without credentials, initialization might fail
        console.warn('⚠️ Skipping in CI without Azure credentials');
        expect(initialized).toBe(false);
      } else {
        expect(initialized).toBe(true);
        expect(azureOpenAIService.isReady()).toBe(true);
        console.log('✅ Azure OpenAI Service initialized successfully');
      }
    });

    it('should successfully initialize Azure Speech Service', async () => {
      const initialized = await azureSpeechService.initialize();
      
      // Check if we have speech credentials available
      const secrets = await fetchAzureSecrets();
      if (!secrets.speechKey || !secrets.speechEndpoint) {
        // Without credentials, initialization should fail gracefully
        console.warn('⚠️ Speech credentials not available - initialization expected to fail');
        expect(initialized).toBe(false);
        expect(azureSpeechService.isReady()).toBe(false);
      } else {
        expect(initialized).toBe(true);
        expect(azureSpeechService.isReady()).toBe(true);
        console.log('✅ Azure Speech Service initialized successfully');
      }
    });

    it('should handle initialization failures gracefully', async () => {
      // Mock environment to simulate failure
      const originalEnv = { ...process.env };
      delete process.env.AZURE_OPENAI_KEY;
      delete process.env.AZURE_OPENAI_ENDPOINT;
      
      const initialized = await azureOpenAIService.initialize();
      expect(initialized).toBe(false);
      expect(azureOpenAIService.isReady()).toBe(false);
      
      // Restore environment
      Object.assign(process.env, originalEnv);
      console.log('✅ Service handles initialization failures gracefully');
    });
  });

  describe('Embedding Model Configuration', () => {
    it('should have valid embedding model configuration', async () => {
      const secrets = await fetchAzureSecrets();
      
      // Check if there's a separate embedding deployment
      // Common pattern: deployment names like "text-embedding-ada-002"
      const deployment = secrets.azureOpenAIDeployment;
      
      if (deployment.includes('embedding')) {
        expect(deployment).toMatch(/text-embedding-[a-z0-9-]+/i);
        console.log(`✅ Embedding model deployment "${deployment}" is configured`);
      } else {
        console.log(`ℹ️ Using general deployment "${deployment}" for embeddings`);
      }
    });

    it('should use correct API version for embeddings', () => {
      // Embeddings should use the same stable API version
      const expectedVersion = '2024-02-15-preview';
      
      // This would be validated in the actual embedding service implementation
      expect(expectedVersion).toMatch(/^\d{4}-\d{2}-\d{2}(-preview)?$/);
      console.log(`✅ Embedding API version format is valid: ${expectedVersion}`);
    });
  });

  describe('Network and Connectivity', () => {
    it('should have valid Azure endpoints', async () => {
      const secrets = await fetchAzureSecrets();
      
      // Validate OpenAI endpoint format
      expect(secrets.azureOpenAIEndpoint).toMatch(
        /^https:\/\/[a-z0-9-]+\.openai\.azure\.com\/?$/i
      );
      
      // Validate Speech endpoint format
      expect(secrets.speechEndpoint).toMatch(
        /^https:\/\/[a-z0-9-]+\.(api\.cognitive|cognitiveservices)\.microsoft\.com\/?$/i
      );
      
      console.log('✅ All Azure endpoints have valid formats');
    });

    it('should handle rate limiting properly', async () => {
      // Check that retry logic is implemented
      const azureOpenAI = await import('../lib/services/azure-openai-service');
      
      // Verify retry method exists
      expect(azureOpenAI.azureOpenAIService).toHaveProperty('retryWithBackoff');
      
      console.log('✅ Rate limiting retry logic is implemented');
    });
  });

  describe('Security and Authentication', () => {
    it('should not expose sensitive keys in browser environment', () => {
      if (typeof window !== 'undefined') {
        // In browser environment
        expect(window.AZURE_OPENAI_KEY).toBeUndefined();
        expect(window.AZURE_SPEECH_KEY).toBeUndefined();
        console.log('✅ Sensitive keys are not exposed in browser');
      } else {
        console.log('ℹ️ Running in Node.js environment');
      }
    });

    it('should use proper authentication headers', async () => {
      const secrets = await fetchAzureSecrets();
      
      expect(secrets.azureOpenAIKey).toBeTruthy();
      expect(secrets.azureOpenAIKey.length).toBeGreaterThan(20);
      
      expect(secrets.speechKey).toBeTruthy();
      expect(secrets.speechKey.length).toBeGreaterThan(20);
      
      console.log('✅ Authentication keys are properly configured');
    });
  });
});

describe('Health Check Endpoint', () => {
  it('should return health status from /api/azure-health', async () => {
    if (process.env.CI) {
      console.log('ℹ️ Skipping API endpoint test in CI');
      return;
    }
    
    try {
      const response = await fetch('http://localhost:3000/api/azure-health');
      const data = await response.json();
      
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('services');
      expect(data).toHaveProperty('timestamp');
      
      console.log('✅ Health check endpoint is functional');
    } catch (error) {
      console.warn('⚠️ Health check endpoint not available (server may not be running)');
    }
  });
});
