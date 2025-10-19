// Test Setup for Data Layer Testing
// Configures test environment with mocks and utilities for data layer tests

import { jest } from '@jest/globals';

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.AZURE_COSMOS_CONNECTION_STRING = 'AccountEndpoint=https://test.documents.azure.com:443/;AccountKey=test-key==;';
process.env.AZURE_COSMOS_DATABASE_ID = 'prepbettr-test';
process.env.AZURE_STORAGE_CONNECTION_STRING = 'DefaultEndpointsProtocol=https;AccountName=test;AccountKey=test==;EndpointSuffix=core.windows.net';
process.env.FIREBASE_PROJECT_ID = 'prepbettr-test';
process.env.FIREBASE_CLIENT_EMAIL = 'test@prepbettr-test.iam.gserviceaccount.com';
process.env.FIREBASE_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\ntest-key\n-----END PRIVATE KEY-----\n';

// Mock external services
jest.mock('@azure/cosmos', () => ({
  CosmosClient: jest.fn().mockImplementation(() => ({
    database: jest.fn().mockReturnValue({
      container: jest.fn().mockReturnValue({
        items: {
          create: jest.fn(),
          query: jest.fn().mockReturnValue({
            fetchAll: jest.fn().mockResolvedValue({ resources: [] })
          })
        },
        item: jest.fn().mockReturnValue({
          read: jest.fn(),
          replace: jest.fn(),
          delete: jest.fn()
        })
      })
    })
  }))
}));

jest.mock('@azure/storage-blob', () => ({
  BlobServiceClient: {
    fromConnectionString: jest.fn().mockImplementation(() => ({
      getContainerClient: jest.fn().mockReturnValue({
        getBlobClient: jest.fn().mockReturnValue({
          getBlockBlobClient: jest.fn().mockReturnValue({
            upload: jest.fn().mockResolvedValue({ etag: 'test-etag' })
          }),
          download: jest.fn(),
          delete: jest.fn(),
          url: 'https://test.blob.core.windows.net/container/blob'
        }),
        createIfNotExists: jest.fn(),
        listBlobsFlat: jest.fn().mockReturnValue([])
      }),
      listContainers: jest.fn().mockReturnValue([])
    }))
  }
}));

jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  getApps: jest.fn().mockReturnValue([]),
  credential: {
    cert: jest.fn()
  }
}));

jest.mock('firebase-admin/firestore', () => ({
  getFirestore: jest.fn().mockReturnValue({
    collection: jest.fn().mockReturnValue({
      doc: jest.fn().mockReturnValue({
        get: jest.fn(),
        set: jest.fn(),
        update: jest.fn(),
        delete: jest.fn()
      }),
      get: jest.fn().mockReturnValue({
        empty: true,
        docs: []
      }),
      count: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue({
          data: jest.fn().mockReturnValue({ count: 0 })
        })
      }),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      startAfter: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis()
    })
  })
}));

// Global test utilities
global.testUtils = {
  // Mock data generators
  generateMockResumeDocument: () => ({
    id: 'test-resume-123',
    userId: 'test-user-123',
    fileName: 'test-resume.pdf',
    filePath: 'user/test-resume.pdf',
    fileUrl: 'https://storage.test/file.pdf',
    fileSize: 1024,
    mimeType: 'application/pdf',
    uploadDate: new Date(),
    lastModified: new Date(),
    extractedText: 'Test resume content',
    extractedData: {},
    interviewQuestions: ['Question 1', 'Question 2'],
    processingMethod: 'azure-form-recognizer' as const,
    processingTime: 1000,
    confidence: 0.8,
    atsScore: 85,
    processorVersion: '2.0.0',
    createdAt: new Date(),
    updatedAt: new Date()
  }),

  generateMockUsageDocument: () => ({
    id: 'test-user-123',
    userId: 'test-user-123',
    planType: 'free' as const,
    interviewsThisMonth: 1,
    resumeProcessingThisMonth: 2,
    totalInterviews: 5,
    totalResumeProcessing: 10,
    lastReset: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  }),

  // Mock repository result
  createMockRepositoryResult: <T>(data: T, success = true) => ({
    success,
    data: success ? data : undefined,
    error: success ? undefined : 'Mock error'
  }),

  // Async delay utility
  delay: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

  // Mock configuration service
  mockUnifiedConfigService: {
    get: jest.fn().mockImplementation((key: string, defaultValue: any) => {
      const mockConfig: any = {
        'migration.dualWriteEnabled': true,
        'migration.readFallbackEnabled': true,
        'migration.consistencyCheckEnabled': false,
        'quotas.freeInterviews': 3,
        'quotas.freeResumes': 5,
        'quotas.premiumInterviews': 50,
        'quotas.premiumResumes': 100,
        'features.foundryResumeProcessing': false
      };
      return Promise.resolve(mockConfig[key] ?? defaultValue);
    }),
    set: jest.fn().mockResolvedValue(true)
  }
};

// Mock the unified config service
jest.mock('@/lib/services/unified-config-service', () => ({
  unifiedConfigService: global.testUtils.mockUnifiedConfigService
}));

// Enhanced matchers for testing
expect.extend({
  toBeRepositoryResult(received, expectedSuccess = true) {
    const pass = typeof received === 'object' && 
                 received !== null &&
                 typeof received.success === 'boolean' &&
                 received.success === expectedSuccess &&
                 (expectedSuccess ? received.data !== undefined : received.error !== undefined);

    if (pass) {
      return {
        message: () => `expected ${JSON.stringify(received)} not to be a valid repository result`,
        pass: true
      };
    } else {
      return {
        message: () => `expected ${JSON.stringify(received)} to be a valid repository result with success=${expectedSuccess}`,
        pass: false
      };
    }
  },

  toHaveValidDocumentId(received) {
    const pass = typeof received === 'string' && 
                 received.length > 0 && 
                 !received.includes(' ');

    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid document ID`,
        pass: true
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid document ID`,
        pass: false
      };
    }
  }
});

// Cleanup after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Cleanup after all tests
afterAll(() => {
  jest.restoreAllMocks();
});

// Type declarations for global utilities
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeRepositoryResult(expectedSuccess?: boolean): R;
      toHaveValidDocumentId(): R;
    }
  }

  var testUtils: {
    generateMockResumeDocument: () => any;
    generateMockUsageDocument: () => any;
    createMockRepositoryResult: <T>(data: T, success?: boolean) => any;
    delay: (ms: number) => Promise<void>;
    mockUnifiedConfigService: any;
  };
}