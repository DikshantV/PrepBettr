// Jest Configuration for Data Layer Testing
// Specialized configuration for testing data layer abstractions and migration components

module.exports = {
  displayName: 'Data Layer Tests',
  preset: 'ts-jest',
  testEnvironment: 'node',
  
  // Test file patterns
  testMatch: [
    '<rootDir>/tests/unit/data-layer/**/*.test.ts',
    '<rootDir>/tests/integration/data-layer/**/*.test.ts'
  ],
  
  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup/data-layer-setup.ts'
  ],
  
  // Module name mapping
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@lib/(.*)$': '<rootDir>/lib/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  },
  
  // Coverage configuration
  collectCoverageFrom: [
    'lib/data-layer/**/*.{ts,tsx}',
    'lib/services/**/*-v2.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/tests/**'
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  
  // Transform configuration
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.json'
    }]
  },
  
  // Test timeout for integration tests
  testTimeout: 30000,
  
  // Clear mocks between tests
  clearMocks: true,
  resetMocks: false,
  restoreMocks: true,
  
  // Verbose output
  verbose: true
};
