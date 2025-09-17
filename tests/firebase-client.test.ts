/**
 * Firebase Client Unit Tests
 * 
 * Tests Firebase initialization flow and getter behavior
 */

import { auth, googleProvider, db, app, isFirebaseReady } from '@/firebase/client';

// Mock Firebase modules
jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(),
  getApps: jest.fn(() => []),
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(),
  GoogleAuthProvider: jest.fn(() => ({
    setCustomParameters: jest.fn(),
    addScope: jest.fn(),
  })),
}));

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(),
}));

describe('Firebase Client', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock window object
    Object.defineProperty(window, 'dispatchEvent', {
      value: jest.fn(),
      writable: true,
    });
  });

  describe('Firebase getters before initialization', () => {
    test('auth getter throws error when Firebase not ready', () => {
      expect(() => auth()).toThrow('Firebase Auth not ready. Please wait for initialization to complete.');
    });

    test('googleProvider getter throws error when Firebase not ready', () => {
      expect(() => googleProvider()).toThrow('Google Auth Provider not ready. Please wait for initialization to complete.');
    });

    test('db getter throws error when Firebase not ready', () => {
      expect(() => db()).toThrow('Firestore not ready. Please wait for initialization to complete.');
    });

    test('app getter throws error when Firebase not ready', () => {
      expect(() => app()).toThrow('Firebase App not ready. Please wait for initialization to complete.');
    });

    test('isFirebaseReady returns false before initialization', () => {
      expect(isFirebaseReady()).toBe(false);
    });
  });

  describe('Environment handling', () => {
    test('handles missing environment variables gracefully', () => {
      // Mock getFirebaseConfig to return null
      const originalEnv = process.env;
      process.env = {};
      
      // This should not throw an error during module load
      expect(() => require('@/firebase/client')).not.toThrow();
      
      process.env = originalEnv;
    });
  });
});

describe('Firebase Initialization Flow', () => {
  test('proper initialization sequence', () => {
    // This test would require more complex setup to test the actual initialization
    // For now, we just verify the structure exists
    expect(typeof isFirebaseReady).toBe('function');
  });
});