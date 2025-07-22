// Jest setup file
// Global test setup and mocks

// Mock NextRequest and NextResponse
jest.mock('next/server', () => ({
  NextRequest: jest.fn(),
  NextResponse: {
    json: jest.fn((data, init) => ({
      status: init?.status || 200,
      json: () => Promise.resolve(data),
      body: JSON.stringify(data),
      headers: new Map(),
    })),
    next: jest.fn(() => ({ status: 200 })),
  },
}));

// Mock Firebase services
jest.mock('@/lib/services/firebase-verification', () => ({
  firebaseVerification: {
    verifyIdToken: jest.fn(),
  },
}));

jest.mock('@/lib/services/subscription-service', () => ({
  subscriptionService: {
    getUserSubscription: jest.fn(),
    getUserUsage: jest.fn(),
    initializeUsageCounters: jest.fn(),
    incrementUsage: jest.fn(),
  },
}));

// Set test environment
process.env.NODE_ENV = 'test';
