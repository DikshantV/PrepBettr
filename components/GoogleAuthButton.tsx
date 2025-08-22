"use client";

import { auth, googleProvider } from "@/firebase/client";
import { signInWithPopup } from "firebase/auth";
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

  // Handle redirect on successful authentication
  useEffect(() => {
    if (authSuccess) {
      console.log(`GoogleAuthButton: Successful Google ${mode}, preparing redirect to /dashboard`);
      
      const currentPath = typeof window !== 'undefined' ? window.location.pathname : `/${mode}`;
      const targetPath = '/dashboard';
      
      // Check if redirect is allowed
      if (!RedirectGuard.canRedirect(targetPath)) {
        console.error('GoogleAuthButton: Redirect blocked by RedirectGuard - potential loop detected');
        toast.error('Authentication successful, but unable to redirect. Please navigate to dashboard manually.');
        return;
      }
      
      // Record the redirect attempt
      RedirectGuard.recordRedirect(currentPath, targetPath);
      
      // Add a delay to ensure cookie propagation
      const redirectTimer = setTimeout(() => {
        console.log('GoogleAuthButton: Executing redirect to /dashboard');
        
        // Use window.location.href for reliable full page navigation
        if (typeof window !== 'undefined') {
          window.location.href = '/dashboard';
        }
      }, 500);
      
      // Cleanup timer if component unmounts
      return () => clearTimeout(redirectTimer);
    }
  }, [authSuccess, mode]);

  const handleGoogleAuth = async () => {
    if (isLoading) return; // Prevent multiple clicks
    setIsLoading(true);
    console.log(`Starting Google ${mode === 'signup' ? 'Sign Up' : 'Sign In'}...`);
    
    // Defensive checks for Firebase initialization
    if (!auth) {
      console.error('Firebase Auth not initialized');
      toast.error('Authentication service not available. Please check your configuration.');
      setIsLoading(false);
      return;
    }
    
    if (!googleProvider) {
      console.error('Google Auth Provider not initialized');
      toast.error('Google authentication not available. Please check your configuration.');
      setIsLoading(false);
      return;
    }
    
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      console.log('Firebase auth successful, user:', user.uid);
      
      if (!user.email) {
        const error = new Error("No email provided by Google");
        console.error(error);
        throw error;
      }

      // Get the ID token
      const idToken = await user.getIdToken();
      console.log(`Got ID token, attempting ${mode}...`);
      
      // Determine endpoint based on mode
      const endpoint = mode === 'signup' ? '/api/auth/signup' : '/api/auth/signin';
      
      try {
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

        console.log(`${mode} response status:`, authResponse.status);
        
        if (authResponse.ok) {
          const responseData = await authResponse.json();
          console.log(`GoogleAuthButton: ${mode} successful, redirecting to dashboard`);
          
          // Store token in localStorage if provided
          if (responseData.token) {
            localStorage.setItem('auth_token', responseData.token);
          }
          
          toast.success(mode === 'signup' ? 'Account created successfully!' : 'Signed in successfully!');
          
          // Add small delay to ensure session cookie is set before redirect
          setTimeout(() => {
            setAuthSuccess(true);
          }, 100);
          return;
        }

        // Handle specific error cases
        const errorData = await authResponse.json().catch(() => ({}));
        
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
            
            console.log('GoogleAuthButton: Sign in after signup conflict successful');
            toast.success('Welcome back! Signed in successfully.');
            
            setTimeout(() => {
              setAuthSuccess(true);
            }, 100);
            return;
          }
        }
        
        if (mode === 'signin' && authResponse.status === 401) {
          // For sign-in, if user doesn't exist, suggest sign-up
          console.log('User not found, suggesting sign up...');
          toast.error('Account not found. Please sign up first or try with a different Google account.');
          return;
        }
        
        // Generic error handling
        const error = new Error(`Failed to ${mode}: ${errorData.error || 'Unknown error'}`);
        console.error(error);
        throw error;
        
      } catch (error) {
        console.error(`${mode} error:`, error);
        throw error;
      }
      
    } catch (error) {
      console.error(`Google ${mode} Error:`, error);
      toast.error(`Failed to ${mode === 'signup' ? 'sign up' : 'sign in'} with Google`);
    } finally {
      setIsLoading(false);
    }
  };

  const buttonText = mode === 'signup' ? 'Sign up with Google' : 'Continue with Google';
  const loadingText = mode === 'signup' ? 'Creating account...' : 'Signing in...';

  return (
    <Button 
      variant="outline" 
      type="button" 
      className="w-full flex items-center justify-center gap-3 !bg-dark-200 hover:!bg-dark-200/80 !text-light-100 !border-white/20 hover:!border-white/30 !rounded-full !min-h-12"
      onClick={handleGoogleAuth}
      disabled={isLoading}
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
}
