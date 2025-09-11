/**
 * Simplified Jest Configuration for Basic Testing
 */

import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  // Test environment and setup
  preset: 'ts-jest',
  testEnvironment: 'node',
  
  // File patterns
  testMatch: [
    '<rootDir>/tests/**/*.test.ts',
    '<rootDir>/tests/**/*.test.js',
    '<rootDir>/azure/**/__tests__/**/*.test.ts',
    '<rootDir>/lib/**/__tests__/**/*.test.ts'
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

  // Test timeout
  testTimeout: 30000,

  // Clear mocks between tests
  clearMocks: true,
  resetMocks: false,
  restoreMocks: true,

  // Verbose output for debugging
  verbose: true,

  // Disable coverage for simple testing
  collectCoverage: false,

  // Basic globals
  globals: {
    'ts-jest': {
      isolatedModules: true
    }
  }
};

export default config;
