/** @type {import('jest').Config} */
module.exports = {
  displayName: 'Azure AI Foundry Voice Tests',
  rootDir: '../../..',
  testMatch: [
    '<rootDir>/tests/azure-ai-foundry/voice/**/*.test.ts'
  ],
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: [
    '<rootDir>/tests/azure-ai-foundry/voice/setup.ts'
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1'
  },
  preset: 'ts-jest',
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true
      },
      useESM: true
    }]
  },
  collectCoverageFrom: [
    '<rootDir>/lib/azure-ai-foundry/voice/**/*.{ts,tsx}',
    '<rootDir>/components/**/FoundryVoiceAgent.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  testTimeout: 30000
};
