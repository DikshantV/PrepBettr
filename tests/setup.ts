// Jest setup file
// Global test setup and mocks

// Set test environment
(process.env as any).NODE_ENV = 'test';

// Mock console methods if needed
global.console = {
  ...console,
  // Uncomment to suppress console output during tests
  // log: jest.fn(),
  // error: jest.fn(),
  // warn: jest.fn(),
  // info: jest.fn(),
  // debug: jest.fn(),
};
