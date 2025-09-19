/**
 * React Testing Setup
 * 
 * Setup for React component testing with jsdom environment
 */

import '@testing-library/jest-dom';

// Mock next/navigation for all tests
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(),
    getAll: jest.fn(),
    has: jest.fn(),
  }),
  usePathname: () => '/',
}));

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  debug: jest.fn(),
  log: process.env.NODE_ENV === 'test' ? jest.fn() : console.log,
  info: process.env.NODE_ENV === 'test' ? jest.fn() : console.info,
  warn: process.env.NODE_ENV === 'test' ? jest.fn() : console.warn,
  error: process.env.NODE_ENV === 'test' ? jest.fn() : console.error,
};

// Setup window globals for jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock sessionStorage
Object.defineProperty(window, 'sessionStorage', {
  value: localStorageMock
});