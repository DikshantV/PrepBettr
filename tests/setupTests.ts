/**
 * Jest Test Setup
 * 
 * Global test environment configuration for Azure AI Foundry tests
 */

import 'whatwg-fetch';
import { server } from './mocks/msw-server';

// Establish API mocking before all tests
beforeAll(() => {
  server.listen({
    onUnhandledRequest: 'warn'
  });
});

// Reset any request handlers that we may add during the tests,
// so they don't affect other tests
afterEach(() => {
  server.resetHandlers();
});

// Clean up after the tests are finished
afterAll(() => {
  server.close();
});

// Mock environment variables for tests
process.env.AZURE_FOUNDRY_ENDPOINT = 'https://test-foundry.cognitiveservices.azure.com';
process.env.AZURE_FOUNDRY_API_KEY = 'test-api-key-12345';
process.env.AZURE_FOUNDRY_PROJECT_ID = 'test-project-id';

// Mock console methods to reduce test noise
const originalConsole = { ...console };
global.console = {
  ...console,
  // Keep errors and warns visible
  warn: originalConsole.warn,
  error: originalConsole.error,
  // Reduce info/log noise in tests
  info: jest.fn(),
  log: jest.fn(),
  debug: jest.fn(),
};
