"use server";

import { getAuthService } from "@/firebase/admin";

/**
 * A helper function to safely verify Firebase ID tokens without crashing on credential errors
 */
export async function safeVerifyIdToken(idToken: string) {
  try {
    // Try to verify the token
    const adminAuth = getAuthService();
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    return {
      success: true,
      decodedToken,
      error: null
    };
  } catch (error) {
    // Log detailed error information for debugging
    if (typeof window === 'undefined') { // Server-side only
      console.error("Error verifying Firebase ID token:", {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: (error as any)?.code,
        stack: error instanceof Error ? error.stack : undefined
      });
    }
    
    // Return the error but don't crash
    return {
      success: false,
      decodedToken: null,
      error
    };
  }
}

/**
 * Helper to extract user information from a verified ID token
 */
export async function getUserFromToken(decodedToken: any) {
  if (!decodedToken) return null;
  
  return {
    id: decodedToken.uid,
    email: decodedToken.email || '',
    name: decodedToken.name || decodedToken.email?.split('@')[0] || 'User',
    image: decodedToken.picture || '/default-avatar.svg'
  };
}
