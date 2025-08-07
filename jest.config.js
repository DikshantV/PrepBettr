/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests', '<rootDir>/lib', '<rootDir>/services'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).ts',
    '**/?(*.)+(spec|test).js'
  ],
  globalSetup: '<rootDir>/tests/global-setup.ts',
  globalTeardown: '<rootDir>/tests/global-teardown.ts',
  projects: [
    {
      displayName: 'node',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/tests/**/*.ts',
        '<rootDir>/lib/**/*.test.ts',
        '<rootDir>/lib/**/*.test.js'
      ],
      setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
      transform: {
        '^.+\.tsx?$': ['ts-jest', {
          tsconfig: {
            jsx: 'react',
            esModuleInterop: true,
            allowSyntheticDefaultImports: true
          }
        }],
      },
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1'
      }
    },
    {
      displayName: 'jsdom',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/lib/**/__tests__/**/*.ts', '<rootDir>/lib/**/__tests__/**/*.js'],
      setupFilesAfterEnv: ['<rootDir>/lib/audio/__tests__/setup.js']
    }
  ],
  transform: {
    '^.+\.tsx?$': 'ts-jest',
  },
  collectCoverageFrom: [
    'lib/**/*.ts',
    'services/**/*.ts', 
    'app/api/**/*.ts',
    'functions/src/**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/__tests__/**',
    '!**/coverage/**',
    '!**/dist/**'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/$1'
  },
  testTimeout: 30000,
  maxWorkers: '50%'
};

module.exports = config;
