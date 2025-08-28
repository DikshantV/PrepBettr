const { jest } = require('@jest/globals');

// Extend Jest matchers with custom matchers for this project
expect.extend({
  toBeValidApplicationId(received) {
    const pass = typeof received === 'string' && received.startsWith('app-');
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid application ID`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid application ID (should start with "app-")`,
        pass: false,
      };
    }
  },

  toBeValidUserId(received) {
    const pass = typeof received === 'string' && received.startsWith('user-');
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid user ID`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid user ID (should start with "user-")`,
        pass: false,
      };
    }
  },

  toBeValidJobId(received) {
    const pass = typeof received === 'string' && received.startsWith('job-');
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid job ID`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid job ID (should start with "job-")`,
        pass: false,
      };
    }
  },

  toBeValidApplicationStatus(received) {
    const validStatuses = ['pending', 'applied', 'rejected', 'interview_scheduled', 'pending_manual'];
    const pass = validStatuses.includes(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid application status`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid application status. Valid values: ${validStatuses.join(', ')}`,
        pass: false,
      };
    }
  },

  toHaveValidTimestamp(received, fieldName = 'timestamp') {
    const timestamp = received[fieldName];
    const pass = timestamp && !isNaN(Date.parse(timestamp));
    if (pass) {
      return {
        message: () => `expected ${received} not to have a valid ${fieldName}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to have a valid ${fieldName} (ISO 8601 format)`,
        pass: false,
      };
    }
  },

  toHaveAutomationDetails(received) {
    const automationDetails = received.automationDetails;
    const hasRequiredFields = automationDetails &&
      typeof automationDetails.duration === 'number' &&
      typeof automationDetails.attempts === 'number' &&
      (automationDetails.success === true || automationDetails.success === false);

    if (hasRequiredFields) {
      return {
        message: () => `expected ${received} not to have valid automation details`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to have valid automation details with duration, attempts, and success fields`,
        pass: false,
      };
    }
  },

  toBeWithinTimeRange(received, start, end) {
    const timestamp = Date.parse(received);
    const startTime = Date.parse(start);
    const endTime = Date.parse(end);
    
    const pass = timestamp >= startTime && timestamp <= endTime;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within time range ${start} to ${end}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within time range ${start} to ${end}`,
        pass: false,
      };
    }
  }
});

// Global test utilities
global.testUtils = {
  // Generate test data
  createMockApplication: (overrides = {}) => ({
    id: 'app-test-123',
    userId: 'user-test-456',
    jobId: 'job-test-789',
    status: 'applied',
    applicationMethod: 'headless_automation',
    jobTitle: 'Software Engineer',
    companyName: 'Test Corp',
    appliedAt: new Date().toISOString(),
    automationDetails: {
      duration: 5000,
      attempts: 1,
      success: true,
      formData: {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com'
      }
    },
    _partitionKey: 'user-test-456',
    ...overrides
  }),

  createMockUserProfile: (overrides = {}) => ({
    id: 'user-test-123',
    firstName: 'John',
    lastName: 'Doe',
    name: 'John Doe',
    email: 'john.doe@example.com',
    phone: '+1234567890',
    skills: ['JavaScript', 'React', 'Node.js'],
    experienceYears: 5,
    workAuthorization: 'Yes',
    expectedSalary: '$100,000',
    resume: 'Mock resume content here...',
    ...overrides
  }),

  createMockJobListing: (overrides = {}) => ({
    id: 'job-test-123',
    title: 'Software Engineer',
    company: 'Test Corp',
    final_url: 'https://example.com/job/123',
    easy_apply: true,
    requirements: ['JavaScript', 'React'],
    jobPortal: { name: 'LinkedIn' },
    ...overrides
  }),

  // Time utilities
  getTimeAgo: (minutes) => {
    const date = new Date();
    date.setMinutes(date.getMinutes() - minutes);
    return date.toISOString();
  },

  getTimeFromNow: (minutes) => {
    const date = new Date();
    date.setMinutes(date.getMinutes() + minutes);
    return date.toISOString();
  },

  // Async utilities
  sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  // Mock utilities
  createMockPlaywrightPage: () => ({
    goto: jest.fn(),
    $: jest.fn(),
    $$: jest.fn(),
    title: jest.fn().mockResolvedValue('Test Page'),
    url: jest.fn().mockReturnValue('https://example.com'),
    screenshot: jest.fn(),
    on: jest.fn(),
    setDefaultTimeout: jest.fn(),
    setDefaultNavigationTimeout: jest.fn(),
    waitForTimeout: jest.fn(),
    textContent: jest.fn(),
    fill: jest.fn(),
    click: jest.fn()
  }),

  createMockPlaywrightBrowser: () => ({
    newPage: jest.fn(),
    close: jest.fn()
  }),

  // Azure Cosmos DB mock utilities
  createMockCosmosResponse: (resource, statusCode = 200) => ({
    resource,
    statusCode,
    requestCharge: 2.5,
    activityId: 'mock-activity-id'
  }),

  createMockQueryIterator: (resources) => ({
    fetchAll: jest.fn().mockResolvedValue({ resources }),
    hasMoreResults: jest.fn().mockReturnValue(false),
    executeNext: jest.fn().mockResolvedValue({ resources })
  })
};

// Console override for cleaner test output
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.error = (...args) => {
  // Suppress known test warnings/errors
  const message = args[0];
  if (typeof message === 'string') {
    // Suppress specific messages that are expected during testing
    if (message.includes('Warning: ') ||
        message.includes('playwright') ||
        message.includes('azure-cosmos') ||
        message.includes('bottleneck')) {
      return;
    }
  }
  originalConsoleError(...args);
};

console.warn = (...args) => {
  // Suppress known test warnings
  const message = args[0];
  if (typeof message === 'string') {
    if (message.includes('deprecated') ||
        message.includes('Warning: ')) {
      return;
    }
  }
  originalConsoleWarn(...args);
};

// Set up default timeouts for async operations
jest.setTimeout(30000);

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.AZURE_COSMOS_ENDPOINT = 'https://test-cosmos.documents.azure.com:443/';
process.env.AZURE_COSMOS_DATABASE_ID = 'test-db';
process.env.AZURE_OPENAI_ENDPOINT = 'https://test-openai.openai.azure.com/';
process.env.AZURE_OPENAI_API_VERSION = '2024-02-15-preview';
