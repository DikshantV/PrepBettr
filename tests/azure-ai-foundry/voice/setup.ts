/**
 * Test setup for Azure AI Foundry voice tests
 * Configures mocks and global test environment
 */

// Basic test setup - no @testing-library/jest-dom needed for these unit tests

// Mock Web Audio API
class MockAudioContext {
  createScriptProcessor() {
    return {
      connect: jest.fn(),
      disconnect: jest.fn(),
      onaudioprocess: null
    };
  }
  
  createMediaStreamSource() {
    return { connect: jest.fn() };
  }
  
  get sampleRate() { return 16000; }
  get state() { return 'running'; }
  
  resume() { return Promise.resolve(); }
  close() { return Promise.resolve(); }
}

// Mock getUserMedia
const mockGetUserMedia = jest.fn().mockResolvedValue({
  getTracks: () => [{ stop: jest.fn(), kind: 'audio' }],
  getAudioTracks: () => [{ stop: jest.fn(), kind: 'audio' }]
});

// Mock MediaDevices
Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    getUserMedia: mockGetUserMedia,
    enumerateDevices: jest.fn().mockResolvedValue([
      { deviceId: 'default', kind: 'audioinput', label: 'Default - Test Microphone' }
    ])
  },
  writable: false
});

// Mock AudioContext globally
(global as any).AudioContext = MockAudioContext;
(global as any).webkitAudioContext = MockAudioContext;

// Mock crypto for uuid generation
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => `test-uuid-${Math.random().toString(36).substr(2, 9)}`,
    getRandomValues: (arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    }
  }
});

// Mock console methods to reduce test noise
const originalConsole = { ...console };
global.console = {
  ...console,
  // Keep errors and warns for debugging
  error: originalConsole.error,
  warn: originalConsole.warn,
  // Suppress info and debug logs in tests
  info: jest.fn(),
  debug: jest.fn(),
  log: jest.fn()
};

// Mock timers helper for WebSocket testing
export const mockTimerHelpers = {
  advanceByTime: (ms: number) => {
    jest.advanceTimersByTime(ms);
  },
  
  runAllTimers: () => {
    jest.runAllTimers();
  },
  
  clearAllTimers: () => {
    jest.clearAllTimers();
  }
};

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

// Mock sessionStorage
const mockSessionStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};

Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage
});

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  mockGetUserMedia.mockClear();
  mockLocalStorage.getItem.mockClear();
  mockLocalStorage.setItem.mockClear();
  mockSessionStorage.getItem.mockClear();
  mockSessionStorage.setItem.mockClear();
});

// Cleanup after each test
afterEach(() => {
  jest.restoreAllMocks();
  // Clear any remaining timers
  jest.clearAllTimers();
});
