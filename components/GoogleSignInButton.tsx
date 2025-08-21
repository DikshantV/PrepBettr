"use client";

import { auth } from "@/firebase/client";
import { signInWithPopup } from "firebase/auth";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { googleProvider } from "@/firebase/client";

export default function GoogleSignInButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [signInSuccess, setSignInSuccess] = useState(false);

  // Handle redirect on successful sign-in
  useEffect(() => {
    if (signInSuccess) {
      console.log('GoogleSignInButton: Attempting router.replace to /dashboard');
      try {
        router.replace('/dashboard');
      } catch (error) {
        console.error('Router.replace failed:', error);
        console.log('GoogleSignInButton: Fallback to window.location.replace');
        if (typeof window !== 'undefined') {
          window.location.replace('/dashboard');
        }
      }
    }
  }, [signInSuccess, router]);

  const handleGoogleSignIn = async () => {
    if (isLoading) return; // Prevent multiple clicks
    setIsLoading(true);
    console.log('Starting Google Sign In...');
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
      console.log('Got ID token, attempting sign in...');
      
      try {
        // First, try to sign in
        const signInResponse = await fetch('/api/auth/signin', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ idToken }),
        });

        console.log('Sign in response status:', signInResponse.status);
        
        if (signInResponse.ok) {
          console.log('GoogleSignInButton: First sign in successful, redirecting to dashboard');
          toast.success('Signed in successfully!');
          
          // Add small delay to ensure session cookie is set before redirect
          setTimeout(() => {
            setSignInSuccess(true);
          }, 100);
          return;
        }

        console.log('Sign in failed, checking if user needs to be created...');
        // If sign in fails with 404, try to create the user first
        if (signInResponse.status === 404) {
          console.log('Creating new user...');
          const createUserResponse = await fetch('/api/auth/signup', {
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

          console.log('Create user response status:', createUserResponse.status);
          const createUserData = await createUserResponse.json().catch(() => ({}));
          console.log('Create user response data:', createUserData);

          if (!createUserResponse.ok) {
            const error = new Error(`Failed to create user: ${createUserData.error || 'Unknown error'}`);
            console.error(error);
            throw error;
          }

          console.log('User created, attempting to sign in again...');
          // After creating user, try to sign in again
          const retrySignIn = await fetch('/api/auth/signin', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ idToken }),
          });

          console.log('Retry sign in status:', retrySignIn.status);

          if (retrySignIn.ok) {
            console.log('GoogleSignInButton: Second sign in successful, redirecting to dashboard');
            toast.success('Signed in successfully!');
            
            // Add small delay to ensure session cookie is set before redirect
            setTimeout(() => {
              setSignInSuccess(true);
            }, 100);
            return;
          }

          const retryData = await retrySignIn.json().catch(() => ({}));
          const error = new Error(`Failed to sign in after user creation: ${retryData.error || 'Unknown error'}`);
          console.error(error);
          throw error;
        } else {
          const errorData = await signInResponse.json().catch(() => ({}));
          const error = new Error(`Failed to sign in: ${errorData.error || 'Unknown error'}`);
          console.error(error);
          throw error;
        }
      } catch (error) {
        console.error('Authentication error:', error);
        throw error;
      }
      
    } catch (error) {
      console.error("Google Sign-In Error:", error);
      toast.error("Failed to sign in with Google");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button 
      variant="outline" 
      type="button" 
      className="w-full flex items-center justify-center gap-3 !bg-dark-200 hover:!bg-dark-200/80 !text-light-100 !border-white/20 hover:!border-white/30 !rounded-full !min-h-12"
      onClick={handleGoogleSignIn}
      disabled={isLoading}
    >
      {isLoading ? (
        <>
          <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-gray-400"></div>
          <span>Signing in...</span>
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
          <span>Google</span>
        </>
      )}
    </Button>
  );
}
