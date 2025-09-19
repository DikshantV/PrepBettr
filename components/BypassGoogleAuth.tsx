"use client";

import { useState } from 'react';
import { Button } from './ui/button';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface BypassGoogleAuthProps {
  mode: 'signin' | 'signup';
}

export default function BypassGoogleAuth({ mode }: BypassGoogleAuthProps) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleBypassAuth = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    console.log(`🔒 Bypass: Starting ${mode} process...`);
    
    try {
      // Create a mock user for development
      const mockUser = {
        uid: `mock-user-${Date.now()}`,
        email: 'dev@prepbettr.com',
        displayName: 'Development User',
        emailVerified: true,
        photoURL: 'https://via.placeholder.com/150/2563eb/ffffff?text=DEV'
      };

      // Generate a mock Firebase-compatible JWT
      const header = {
        alg: 'none',
        typ: 'JWT'
      };

      const now = Math.floor(Date.now() / 1000);
      const payload = {
        iss: 'https://securetoken.google.com/prepbettr',
        aud: 'prepbettr',
        auth_time: now,
        user_id: mockUser.uid,
        uid: mockUser.uid,
        sub: mockUser.uid,
        iat: now,
        exp: now + (60 * 60), // 1 hour
        email: mockUser.email,
        email_verified: mockUser.emailVerified,
        name: mockUser.displayName,
        picture: mockUser.photoURL,
        firebase: {
          identities: {
            'google.com': [mockUser.uid],
            email: [mockUser.email]
          },
          sign_in_provider: 'google.com'
        }
      };

      // Create mock JWT
      const encodedHeader = btoa(JSON.stringify(header)).replace(/[+\/=]/g, (m) => ({ '+': '-', '/': '_', '=': '' })[m]);
      const encodedPayload = btoa(JSON.stringify(payload)).replace(/[+\/=]/g, (m) => ({ '+': '-', '/': '_', '=': '' })[m]);
      const mockToken = `${encodedHeader}.${encodedPayload}.dev-signature`;

      console.log('🔒 Bypass: Generated mock token');
      
      // Call the appropriate auth endpoint
      const endpoint = mode === 'signup' ? '/api/auth/signup' : '/api/auth/signin';
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          idToken: mockToken,
          name: mockUser.displayName,
          email: mockUser.email,
          bypass: true // Flag this as a bypass request
        }),
      });

      console.log(`🔒 Bypass: ${mode} response status:`, response.status);

      if (response.ok) {
        const responseData = await response.json();
        console.log(`🔒 Bypass: ${mode} successful!`, responseData);
        
        toast.success(`${mode === 'signup' ? 'Account created' : 'Signed in'} successfully! (Development Mode)`);
        
        // Redirect to dashboard
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 1000);
        
      } else if (mode === 'signup' && response.status === 409) {
        // User exists, try signin
        console.log('🔒 Bypass: User exists, trying signin...');
        
        const signinResponse = await fetch('/api/auth/signin', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            idToken: mockToken,
            email: mockUser.email,
            bypass: true
          }),
        });

        if (signinResponse.ok) {
          toast.success('Welcome back! Signed in successfully! (Development Mode)');
          setTimeout(() => {
            window.location.href = '/dashboard';
          }, 1000);
        } else {
          throw new Error('Failed to sign in after user conflict');
        }
        
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `${mode} failed`);
      }

    } catch (error) {
      console.error(`🔒 Bypass: ${mode} error:`, error);
      toast.error(`Failed to ${mode}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Development Warning */}
      <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4 text-center">
        <div className="text-yellow-400 text-sm font-medium mb-2">
          🚧 Development Mode - Firebase Auth Bypass
        </div>
        <div className="text-yellow-300 text-xs">
          Using mock authentication due to Firebase connection issues
        </div>
      </div>

      {/* Bypass Auth Button */}
      <Button 
        onClick={handleBypassAuth}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full min-h-12"
      >
        {isLoading ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
            <span>{mode === 'signup' ? 'Creating account...' : 'Signing in...'}</span>
          </>
        ) : (
          <>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.28-1.93-6.14-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.86 14.09c-.26-.77-.41-1.6-.41-2.45 0-.85.15-1.68.41-2.45V6.35H2.18C1.42 7.8 1 9.39 1 11s.42 3.2 1.18 4.65l3.68-2.84.01.01z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 6.35l3.68 2.84c.86-2.6 3.28-4.53 6.14-4.53z" fill="#EA4335"/>
            </svg>
            <span>{mode === 'signup' ? 'Create Account (Dev)' : 'Sign In (Dev)'}</span>
          </>
        )}
      </Button>

      {/* Instructions */}
      <div className="text-gray-400 text-xs text-center">
        This bypass creates a temporary development account.<br/>
        Remove this when Firebase authentication is fixed.
      </div>
    </div>
  );
}