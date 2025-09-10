/**
 * Jest Configuration for Azure AI Foundry Tests
 * 
 * Simplified configuration focused on testing our new Azure AI Foundry modules
 */

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  
  // Test patterns for our new tests
  testMatch: [
    '<rootDir>/tests/unit/foundry-client-base.test.ts',
    '<rootDir>/tests/unit/base-agent.test.ts', 
    '<rootDir>/tests/unit/model-manager.test.ts',
    '<rootDir>/tests/integration/agent-workflow.test.ts',
    '<rootDir>/tests/api/interview-endpoints.test.ts'
  ],
  
  // Module name mapping
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1'
  },
  
  // Coverage configuration
  collectCoverage: false,
  
  // Transform configuration
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  
  // Timeout
  testTimeout: 30000,
  
  // Setup MSW server
  setupFilesAfterEnv: ['<rootDir>/tests/setupTests.ts'],
  
  // Clean mocks between tests
  clearMocks: true,
  resetMocks: false,
  restoreMocks: true,
  
  // Globals for ts-jest
  globals: {
    'ts-jest': {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        resolveJsonModule: true,
        skipLibCheck: true
      }
    }
  }
};
