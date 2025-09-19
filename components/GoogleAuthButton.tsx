"use client";

import { authenticateWithGoogle, validateFirebaseIdToken } from "@/lib/firebase/auth.js";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { useFirebaseReady } from "./FirebaseClientInit";

interface GoogleAuthButtonProps {
  mode: 'signin' | 'signup';
}

export default function GoogleAuthButton({ mode }: GoogleAuthButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [redirectChecked, setRedirectChecked] = useState(false);
  const { ready: firebaseReady, error: firebaseError } = useFirebaseReady();
  
  // Check for redirect result on component mount
  useEffect(() => {
    if (redirectChecked) return; // Prevent multiple checks
    
    async function checkRedirectResult() {
      try {
        console.log('🔐 Checking for redirect authentication result...');
        // Check if we're returning from a redirect authentication
        const { handleRedirectResult } = await import('@/firebase/client');
        const result = await handleRedirectResult();
        
        if (result) {
          console.log('🔐 Redirect authentication successful:', result.user.email);
          setIsLoading(true); // Show loading state
          
          // Handle successful redirect authentication
          try {
            await handleSuccessfulAuthInternal(result.idToken, result.user);
          } catch (error) {
            console.error('🔐 Error processing redirect authentication:', error);
            toast.error('Authentication failed. Please try again.');
            setIsLoading(false);
          }
        } else {
          console.log('🔐 No redirect authentication result found');
        }
      } catch (error) {
        console.error('🔐 Redirect result check failed:', error);
      } finally {
        setRedirectChecked(true);
      }
    }
    
    checkRedirectResult();
  }, [redirectChecked, mode]); // Add dependencies but prevent infinite loops

  // Helper function to handle successful authentication (both popup and redirect)
  const handleSuccessfulAuthInternal = async (idToken: string, user: any) => {
    const timestamp = new Date().toISOString();
    console.log(`🔐 [${timestamp}] Processing successful authentication for: ${user.email}`);
    
    // Validate the Firebase ID token
    if (!validateFirebaseIdToken(idToken)) {
      throw new Error('Invalid Firebase ID token received');
    }
    
    console.log('🔐 Firebase ID token validated successfully');
    console.log(`🔐 Attempting ${mode} with Firebase ID token...`);
    
    if (!user.email) {
      throw new Error("No email provided by Google");
    }
    
    // Determine endpoint based on mode
    const endpoint = mode === 'signup' ? '/api/auth/signup' : '/api/auth/signin';
    
    const authResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        idToken,
        name: user.displayName || user.email?.split('@')[0] || 'User',
        email: user.email,
      }),
    });

    console.log(`🔐 ${mode} response status:`, authResponse.status);
    
    if (authResponse.ok) {
      const responseData = await authResponse.json();
      console.log(`🚀 ${mode} API call successful!`, {
        status: authResponse.status,
        hasToken: !!responseData.token,
        hasUser: !!responseData.user
      });
      
      // Store token in localStorage if provided
      if (responseData.token) {
        localStorage.setItem('auth_token', responseData.token);
        console.log('🚀 Token stored in localStorage');
      }
      
      console.log(`🚀 [${timestamp}] About to show success toast and reload page...`);
      toast.success(mode === 'signup' ? 'Account created successfully!' : 'Signed in successfully!');
      
      // Authentication successful! Let the middleware handle the redirect
      setTimeout(() => {
        console.log(`🚀 [${timestamp}] Refreshing page to allow middleware to handle redirect...`);
        window.location.reload();
      }, 500);
      
      return;
    }
    
    // Handle API errors
    const errorData = await authResponse.json().catch(() => ({}));
    
    // Handle specific error cases
    if (mode === 'signup' && authResponse.status === 409) {
      // User already exists, try signing in instead
      console.log('User already exists, attempting sign in...');
      
      const signInResponse = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idToken }),
      });

      if (signInResponse.ok) {
        const signInData = await signInResponse.json();
        if (signInData.token) {
          localStorage.setItem('auth_token', signInData.token);
        }
        
        console.log('Sign in after signup conflict successful');
        toast.success('Welcome back! Signed in successfully!');
        
        // Let middleware handle redirect after successful fallback sign-in
        setTimeout(() => {
          console.log('🚀 Refreshing page to allow middleware redirect after signup conflict resolution...');
          window.location.reload();
        }, 500);
        return;
      }
    }
    
    if (mode === 'signin' && authResponse.status === 401) {
      // For sign-in, if user doesn't exist, suggest sign-up
      console.log('User not found, suggesting sign up...');
      toast.error('Account not found. Please sign up first or try with a different Google account.');
      return;
    }
    
    throw new Error(`Failed to ${mode}: ${errorData.error || 'Unknown error'}`);
  };

  // Note: Redirect is now handled by middleware after successful authentication
  // The middleware will detect the session cookie and redirect authenticated users from /sign-in to /dashboard


  const handleGoogleAuth = async () => {
    const timestamp = new Date().toISOString();
    console.log(`🚀 [${timestamp}] handleGoogleAuth called - mode: ${mode}`);
    
    if (isLoading) {
      console.log(`⚠️ [${timestamp}] Google auth already in progress, ignoring click`);
      return; // Prevent multiple clicks
    }
    
    // Check if Firebase is ready
    if (!firebaseReady) {
      console.log(`⚠️ [${timestamp}] Firebase not ready yet, cannot start authentication`);
      toast.error('Authentication service is initializing. Please wait a moment and try again.');
      return;
    }
    
    if (firebaseError) {
      console.error(`⚠️ [${timestamp}] Firebase initialization error:`, firebaseError);
      toast.error('Authentication service unavailable. Please refresh the page.');
      return;
    }
    
    console.log(`🚀 [${timestamp}] Starting Google ${mode === 'signup' ? 'Sign Up' : 'Sign In'}...`);
    setIsLoading(true);
    
    // Use the Firebase auth helper for better error handling
    
    try {
      console.log('🔐 Starting Google authentication using Firebase helper...');
      const { user, idToken } = await authenticateWithGoogle();
      
      console.log('🔐 Firebase authentication successful:', {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        emailVerified: user.emailVerified
      });
      
      // Use the helper function to handle successful authentication
      await handleSuccessfulAuthInternal(idToken, user);
      
    } catch (error: any) {
      console.error(`Google ${mode} Error:`, error);
      
      // Handle specific Firebase Auth errors
      if (error.code === 'auth/account-exists-with-different-credential') {
        toast.error(
          'An account already exists with this email but different sign-in method. Please try signing in with email/password instead.',
          {
            duration: 8000,
            action: {
              label: 'Sign In',
              onClick: () => router.push('/sign-in')
            }
          }
        );
      } else if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
        console.log('⚠️ Popup closed by user, attempting redirect sign-in...');
        try {
          const { signInWithRedirect, auth, googleProvider } = await import('@/firebase/client');
          await signInWithRedirect(auth, googleProvider);
          console.log('🔀 Redirect initiated successfully - page will redirect');
          // Don't set loading to false here - the page will redirect
          toast.info('Redirecting for authentication...');
          return; // Important: return here to prevent setIsLoading(false)
        } catch (redirectError: any) {
          console.error('❌ Redirect sign-in also failed:', redirectError);
          toast.error('Authentication failed. Please try again.');
          // Only set loading to false if redirect also failed
        }
      } else if (error.code === 'auth/popup-blocked') {
        toast.error('Pop-up was blocked by your browser. Please allow pop-ups and try again.');
      } else if (error.code === 'auth/network-request-failed') {
        toast.error('Network error. Please check your connection and try again.');
      } else {
        toast.error(`Failed to ${mode === 'signup' ? 'sign up' : 'sign in'} with Google`);
      }
    } finally {
      setIsLoading(false);
    }
  };


  const buttonText = firebaseError ? 'Service Unavailable' : (!firebaseReady ? 'Initializing...' : 'Google');
  const loadingText = mode === 'signup' ? 'Creating account...' : 'Signing in...';

  return (
    <Button 
      variant="outline" 
      type="button" 
      className="w-full flex items-center justify-center gap-3 !bg-dark-200 hover:!bg-dark-200/80 !text-light-100 !border-white/20 hover:!border-white/30 !rounded-full !min-h-12"
      onClick={handleGoogleAuth}
      disabled={isLoading || !firebaseReady || !!firebaseError}
    >
      {isLoading ? (
        <>
          <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-gray-400"></div>
          <span>{loadingText}</span>
        </>
      ) : (
        <>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.28-1.93-6.14-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.86 14.09c-.26-.77-.41-1.6-.41-2.45 0-.85.15-1.68.41-2.45V6.35H2.18C1.42 7.8 1 9.39 1 11s.42 3.2 1.18 4.65l3.68-2.84.01.01z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 6.35l3.68 2.84c.86-2.6 3.28-4.53 6.14-4.53z" fill="#EA4335"/>
            <path d="M1 1h22v22H1z" fill="none"/>
          </svg>
          <span>{buttonText}</span>
        </>
      )}
    </Button>
  );
};
