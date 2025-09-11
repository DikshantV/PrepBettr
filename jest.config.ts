/**
 * Jest Configuration for PrepBettr Azure Testing Suite
 * 
 * Comprehensive testing setup with Azure service mocks, performance monitoring,
 * and coverage reporting optimized for Azure-centric architecture.
 * 
 * @version 2.0.0
 */

import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  // Test environment and setup
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup/global-setup.ts',
    '<rootDir>/tests/setup/azure-mocks.ts',
    '<rootDir>/tests/setup/performance-baseline.ts'
  ],

  // File patterns
  testMatch: [
    '<rootDir>/tests/**/*.test.ts',
    '<rootDir>/tests/**/*.test.js',
    '<rootDir>/azure/**/__tests__/**/*.test.ts',
    '<rootDir>/lib/**/__tests__/**/*.test.ts'
  ],

  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html',
    'json-summary',
    'cobertura'
  ],

  // Coverage thresholds - Enforce 90% coverage on critical modules
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    },
    // Critical modules require higher coverage
    './azure/shared/core-auth/': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95
    },
    './lib/config/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    },
    './lib/services/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },

  // Files to collect coverage from
  collectCoverageFrom: [
    'azure/**/*.{ts,js}',
    'lib/**/*.{ts,js}',
    'app/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/coverage/**',
    '!**/tests/**',
    '!**/__tests__/**',
    '!**/dist/**',
    '!**/build/**'
  ],

  // Module name mapping for path aliases
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@lib/(.*)$': '<rootDir>/lib/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  },

  // Transform configuration
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.json'
    }]
  },

  // Test timeout for performance tests
  testTimeout: 30000,

  // Globals for Azure service testing
  globals: {
    // Azure service endpoints for testing
    AZURE_TEST_CONFIG: {
      cosmosEndpoint: 'https://test-cosmos.documents.azure.com:443/',
      blobEndpoint: 'https://teststorage.blob.core.windows.net/',
      speechEndpoint: 'https://test.api.cognitive.microsoft.com/',
      openaiEndpoint: 'https://test.openai.azure.com/',
      signalrEndpoint: 'https://test.service.signalr.net'
    }
  },

  // Performance monitoring
  reporters: [
    'default'
  ],

  // Clear mocks between tests
  clearMocks: true,
  resetMocks: false,
  restoreMocks: true,

  // Verbose output for debugging
  verbose: true,

  // Error handling
  errorOnDeprecated: true,

  // Parallel execution
  maxWorkers: '50%',

  // Cache configuration
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache',

  // Test result processor disabled for now
  // testResultsProcessor: '<rootDir>/tests/processors/results-processor.ts'
};

export default config;
