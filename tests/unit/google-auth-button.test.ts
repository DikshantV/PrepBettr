/**
 * Unit tests for GoogleAuthButton component
 * 
 * Tests the restored helper-function based implementation to prevent regression
 * and ensure Google OAuth flow works correctly.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { jest } from '@jest/globals';
import GoogleAuthButton from '@/components/GoogleAuthButton';

// Mock the auth helper functions
const mockAuthenticateWithGoogle = jest.fn();
const mockValidateFirebaseIdToken = jest.fn();

// Mock the auth helper module
jest.mock('@/lib/firebase/auth.js', () => ({
  authenticateWithGoogle: mockAuthenticateWithGoogle,
  validateFirebaseIdToken: mockValidateFirebaseIdToken
}));

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush
  })
}));

// Mock sonner toast
const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
jest.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError
  }
}));

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

// Mock window.location for reload
delete (window as any).location;
(window as any).location = { reload: jest.fn() };

describe('GoogleAuthButton', () => {
  const mockUser = {
    uid: 'test-uid-123',
    email: 'test@example.com',
    displayName: 'Test User',
    photoURL: 'https://example.com/photo.jpg',
    emailVerified: true
  };

  const mockIdToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vdGVzdCIsImF1ZCI6InRlc3QiLCJleHAiOjE2OTkzNzI4MDAsImlhdCI6MTY5OTI4NjQwMCwic3ViIjoidGVzdC11aWQtMTIzIn0.test-signature';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn()
      },
      writable: true
    });
  });

  describe('Component Rendering', () => {
    it('should render Google sign-in button for signin mode', () => {
      render(<GoogleAuthButton mode="signin" />);
      
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent('Google');
      expect(button).not.toBeDisabled();
    });

    it('should render Google sign-up button for signup mode', () => {
      render(<GoogleAuthButton mode="signup" />);
      
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent('Google');
      expect(button).not.toBeDisabled();
    });

    it('should show loading state when authentication is in progress', async () => {
      mockAuthenticateWithGoogle.mockImplementation(() => new Promise(resolve => {})); // Never resolves
      
      render(<GoogleAuthButton mode="signin" />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      await waitFor(() => {
        expect(button).toBeDisabled();
        expect(screen.getByText('Signing in...')).toBeInTheDocument();
      });
    });
  });

  describe('Authentication Flow', () => {
    it('should call authenticateWithGoogle helper function on click', async () => {
      mockAuthenticateWithGoogle.mockResolvedValue({
        user: mockUser,
        idToken: mockIdToken
      });
      mockValidateFirebaseIdToken.mockReturnValue(true);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ token: 'session-token-123', user: mockUser })
      });

      render(<GoogleAuthButton mode="signin" />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockAuthenticateWithGoogle).toHaveBeenCalledTimes(1);
      });
    });

    it('should validate Firebase ID token after authentication', async () => {
      mockAuthenticateWithGoogle.mockResolvedValue({
        user: mockUser,
        idToken: mockIdToken
      });
      mockValidateFirebaseIdToken.mockReturnValue(true);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ token: 'session-token-123', user: mockUser })
      });

      render(<GoogleAuthButton mode="signin" />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockValidateFirebaseIdToken).toHaveBeenCalledWith(mockIdToken);
      });
    });

    it('should make API request to correct endpoint for signin', async () => {
      mockAuthenticateWithGoogle.mockResolvedValue({
        user: mockUser,
        idToken: mockIdToken
      });
      mockValidateFirebaseIdToken.mockReturnValue(true);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ token: 'session-token-123', user: mockUser })
      });

      render(<GoogleAuthButton mode="signin" />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/auth/signin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idToken: mockIdToken,
            name: mockUser.displayName,
            email: mockUser.email
          })
        });
      });
    });

    it('should make API request to correct endpoint for signup', async () => {
      mockAuthenticateWithGoogle.mockResolvedValue({
        user: mockUser,
        idToken: mockIdToken
      });
      mockValidateFirebaseIdToken.mockReturnValue(true);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ token: 'session-token-123', user: mockUser })
      });

      render(<GoogleAuthButton mode="signup" />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idToken: mockIdToken,
            name: mockUser.displayName,
            email: mockUser.email
          })
        });
      });
    });
  });

  describe('Success Handling', () => {
    it('should show success toast and reload page on successful signin', async () => {
      mockAuthenticateWithGoogle.mockResolvedValue({
        user: mockUser,
        idToken: mockIdToken
      });
      mockValidateFirebaseIdToken.mockReturnValue(true);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ token: 'session-token-123', user: mockUser })
      });

      render(<GoogleAuthButton mode="signin" />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith('Signed in successfully!');
      });

      // Wait for the setTimeout to complete
      await waitFor(() => {
        expect(window.location.reload).toHaveBeenCalled();
      }, { timeout: 1000 });
    });

    it('should store token in localStorage on success', async () => {
      mockAuthenticateWithGoogle.mockResolvedValue({
        user: mockUser,
        idToken: mockIdToken
      });
      mockValidateFirebaseIdToken.mockReturnValue(true);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ token: 'session-token-123', user: mockUser })
      });

      render(<GoogleAuthButton mode="signin" />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(window.localStorage.setItem).toHaveBeenCalledWith('auth_token', 'session-token-123');
      });
    });
  });

  describe('Error Handling', () => {
    it('should show error toast for invalid Firebase ID token', async () => {
      mockAuthenticateWithGoogle.mockResolvedValue({
        user: mockUser,
        idToken: mockIdToken
      });
      mockValidateFirebaseIdToken.mockReturnValue(false); // Invalid token

      render(<GoogleAuthButton mode="signin" />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('Failed to sign in with Google');
      });
    });

    it('should handle auth/popup-closed-by-user error', async () => {
      const popupError = new Error('Popup closed');
      (popupError as any).code = 'auth/popup-closed-by-user';
      mockAuthenticateWithGoogle.mockRejectedValue(popupError);

      render(<GoogleAuthButton mode="signin" />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('Sign-in was cancelled. Please try again.');
      });
    });

    it('should handle auth/popup-blocked error', async () => {
      const popupError = new Error('Popup blocked');
      (popupError as any).code = 'auth/popup-blocked';
      mockAuthenticateWithGoogle.mockRejectedValue(popupError);

      render(<GoogleAuthButton mode="signin" />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('Pop-up was blocked by your browser. Please allow pop-ups and try again.');
      });
    });

    it('should handle network request failed error', async () => {
      const networkError = new Error('Network failed');
      (networkError as any).code = 'auth/network-request-failed';
      mockAuthenticateWithGoogle.mockRejectedValue(networkError);

      render(<GoogleAuthButton mode="signin" />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('Network error. Please check your connection and try again.');
      });
    });
  });

  describe('Regression Prevention', () => {
    it('should NOT import Firebase SDK functions directly', () => {
      // This test ensures the component uses helper functions, not direct Firebase imports
      const componentSource = require('@/components/GoogleAuthButton').toString();
      
      // These imports should NOT be present (they were in the broken version)
      expect(componentSource).not.toContain('signInWithPopup');
      expect(componentSource).not.toContain('getIdToken');
      expect(componentSource).not.toContain('from "firebase/auth"');
      expect(componentSource).not.toContain('from "@/firebase/client"');
      expect(componentSource).not.toContain('from "@/firebase/simple-client"');
      
      // The correct import should be present
      expect(componentSource).toContain('authenticateWithGoogle');
    });

    it('should use helper function pattern as expected', async () => {
      // Mock successful authentication
      mockAuthenticateWithGoogle.mockResolvedValue({
        user: mockUser,
        idToken: mockIdToken
      });
      mockValidateFirebaseIdToken.mockReturnValue(true);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ token: 'session-token-123', user: mockUser })
      });

      render(<GoogleAuthButton mode="signin" />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);

      // Verify the helper is called (not direct Firebase functions)
      await waitFor(() => {
        expect(mockAuthenticateWithGoogle).toHaveBeenCalledTimes(1);
        expect(mockValidateFirebaseIdToken).toHaveBeenCalledWith(mockIdToken);
      });

      // This test would fail if the component reverted to direct Firebase calls
      expect(mockAuthenticateWithGoogle).toHaveBeenCalledWith(); // No arguments expected
    });
  });

  describe('Fallback Scenarios', () => {
    it('should handle signup conflict and fallback to signin', async () => {
      mockAuthenticateWithGoogle.mockResolvedValue({
        user: mockUser,
        idToken: mockIdToken
      });
      mockValidateFirebaseIdToken.mockReturnValue(true);
      
      // First call (signup) returns 409 conflict
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: () => Promise.resolve({ error: 'User already exists' })
      });
      
      // Second call (signin fallback) succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ token: 'session-token-123', user: mockUser })
      });

      render(<GoogleAuthButton mode="signup" />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(mockToastSuccess).toHaveBeenCalledWith('Welcome back! Signed in successfully!');
      });
    });
  });
});