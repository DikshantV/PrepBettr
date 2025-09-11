/**
 * Global Jest Setup for PrepBettr Testing Suite
 * 
 * Sets up global test environment, mocks, and shared utilities
 * that are needed across all test files.
 */

// import 'jest-extended';

// Mock Next.js environment variables
process.env.NODE_ENV = 'test';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
process.env.NEXT_PUBLIC_ENVIRONMENT = 'test';

// Mock Azure environment variables
process.env.AZURE_OPENAI_KEY = 'test-azure-openai-key';
process.env.AZURE_OPENAI_ENDPOINT = 'https://test-openai.openai.azure.com';
process.env.AZURE_OPENAI_DEPLOYMENT = 'test-deployment';
process.env.AZURE_SPEECH_KEY = 'test-speech-key';
process.env.AZURE_SPEECH_REGION = 'eastus';
process.env.AZURE_KEY_VAULT_URI = 'https://test-keyvault.vault.azure.net/';

// Mock Firebase environment variables
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'test-project';
process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'test-api-key';
process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = 'test-project.firebaseapp.com';
process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = 'test-project.appspot.com';
process.env.FIREBASE_ADMIN_PRIVATE_KEY = 'test-private-key';
process.env.FIREBASE_ADMIN_CLIENT_EMAIL = 'test@test-project.iam.gserviceaccount.com';

// Mock Dodo Payments
process.env.DODO_API_KEY = 'test-dodo-api-key';

// Suppress console warnings in tests
const originalWarn = console.warn;
const originalError = console.error;

beforeAll(() => {
  console.warn = jest.fn((message) => {
    // Only suppress specific warnings we expect in tests
    if (
      typeof message === 'string' && (
        message.includes('Warning: ReactDOM.render is deprecated') ||
        message.includes('Warning: componentWillReceiveProps') ||
        message.includes('gRPC') ||
        message.includes('FIRESTORE_PREFER_REST')
      )
    ) {
      return;
    }
    originalWarn(message);
  });

  console.error = jest.fn((message) => {
    // Only suppress specific errors we expect in tests
    if (
      typeof message === 'string' && (
        message.includes('Firebase Admin SDK') ||
        message.includes('GRPC_VERBOSITY')
      )
    ) {
      return;
    }
    originalError(message);
  });
});

afterAll(() => {
  console.warn = originalWarn;
  console.error = originalError;
});

// Mock WebSocket for voice tests
global.WebSocket = jest.fn().mockImplementation(() => ({
  readyState: 1,
  send: jest.fn(),
  close: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
}));

// Mock MediaDevices API for audio tests
global.navigator = global.navigator || {};
Object.defineProperty(global.navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: jest.fn().mockResolvedValue({
      getAudioTracks: () => [{
        stop: jest.fn(),
        enabled: true
      }],
      getTracks: () => [{
        stop: jest.fn(),
        enabled: true
      }]
    })
  }
});

// Mock AudioContext
global.AudioContext = jest.fn().mockImplementation(() => ({
  createAnalyser: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    fftSize: 256,
    frequencyBinCount: 128,
    getByteFrequencyData: jest.fn(),
    getFloatFrequencyData: jest.fn(),
  })),
  createGain: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    gain: { value: 1 }
  })),
  createMediaStreamSource: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn()
  })),
  destination: {},
  close: jest.fn().mockResolvedValue(undefined),
  state: 'running'
}));

// Mock performance API
Object.defineProperty(global, 'performance', {
  writable: true,
  value: {
    now: jest.fn(() => Date.now()),
    mark: jest.fn(),
    measure: jest.fn(),
    getEntriesByName: jest.fn(() => []),
    getEntriesByType: jest.fn(() => []),
  }
});

// Setup global fetch mock
global.fetch = jest.fn();

export {};
