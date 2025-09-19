"use client";

import { authenticateWithGoogleFallback, handleRedirectResult } from "@/lib/firebase/simple-auth";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import RedirectGuard from "@/lib/utils/redirect-guard";

interface GoogleAuthButtonProps {
  mode: 'signin' | 'signup';
}

export default function GoogleAuthButton({ mode }: GoogleAuthButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [authSuccess, setAuthSuccess] = useState(false);

  // Check for redirect result on component mount
  useEffect(() => {
    const checkRedirectResult = async () => {
      try {
        const result = await handleRedirectResult();
        if (result) {
          console.log('🔐 Found redirect result, processing authentication...');
          await processAuthenticationResult(result);
        }
      } catch (error) {
        console.error('🔐 Error handling redirect result:', error);
      }
    };
    
    checkRedirectResult();
  }, []);

  const processAuthenticationResult = async (authResult: any) => {
    const { user, idToken } = authResult;
    
    console.log('🔐 Processing authentication result:', {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      emailVerified: user.emailVerified
    });
    
    if (!user.email) {
      const error = new Error("No email provided by Google");
      console.error(error);
      throw error;
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
      console.log(`🚀 GoogleAuthButton: ${mode} API call successful!`, {
        status: authResponse.status,
        hasToken: !!responseData.token,
        hasUser: !!responseData.user,
        responseKeys: Object.keys(responseData)
      });
      
      // Store token in localStorage if provided
      if (responseData.token) {
        localStorage.setItem('auth_token', responseData.token);
        console.log('🚀 Token stored in localStorage');
      }
      
      console.log('🚀 About to show success toast and trigger redirect...');
      toast.success(mode === 'signup' ? 'Account created successfully!' : 'Signed in successfully!');
      
      // Authentication successful! Let the middleware handle the redirect
      console.log('🚀 Authentication successful! Cookie set, page will refresh to trigger middleware redirect...');
      
      // Just refresh the current page - the middleware will see the session cookie 
      // and redirect authenticated users from /sign-in to /dashboard
      setTimeout(() => {
        console.log('🚀 Refreshing page to allow middleware to handle redirect...');
        window.location.reload();
      }, 500);
    } else {
      // Handle errors...
      const errorData = await authResponse.json().catch(() => ({}));
      throw new Error(`Failed to ${mode}: ${errorData.error || 'Unknown error'}`);
    }
  };

  const handleGoogleAuth = async () => {
    if (isLoading) return; // Prevent multiple clicks
    
    setIsLoading(true);
    console.log(`Starting Google ${mode === 'signup' ? 'Sign Up' : 'Sign In'}...`);
    
    try {
      console.log('🔐 Starting fallback Google authentication...');
      const result = await authenticateWithGoogleFallback();
      
      // Check if user was redirected
      if (result && (result as any).redirected) {
        console.log('🔐 User was redirected for authentication');
        // Don't set loading to false - user will come back from redirect
        return;
      }
      
      // If we got a result without redirect, process it
      if (result && (result as any).user && (result as any).idToken) {
        await processAuthenticationResult(result);
      } else if (!result || !(result as any).redirected) {
        throw new Error('Authentication failed - no result received');
      }
      
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
      } else if (error.code === 'auth/popup-closed-by-user') {
        toast.error('Sign-in was cancelled. Please try again.');
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

  // Show loading state when signing in
  const isButtonDisabled = isLoading;
  const buttonText = isLoading ? (mode === 'signup' ? 'Creating account...' : 'Signing in...') : 'Google';

  return (
    <Button 
      variant="outline" 
      type="button" 
      className="w-full flex items-center justify-center gap-3 !bg-dark-200 hover:!bg-dark-200/80 !text-light-100 !border-white/20 hover:!border-white/30 !rounded-full !min-h-12"
      onClick={handleGoogleAuth}
      disabled={isButtonDisabled}
    >
      {isLoading ? (
        <>
          <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-gray-400"></div>
          <span>{buttonText}</span>
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
}
