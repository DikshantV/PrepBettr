// Unused helper functions moved from lib/services/firebase-verification.ts

// Helper functions for backward compatibility
export async function verifyFirebaseToken(idToken: string): Promise<VerificationResult> {
  return await firebaseVerification.verifyIdToken(idToken);
}

export async function createFirebaseSessionCookie(idToken: string): Promise<SessionCookieResult> {
  return await firebaseVerification.createSessionCookie(idToken);
}

export async function verifyFirebaseSessionCookie(sessionCookie: string): Promise<VerificationResult> {
  return await firebaseVerification.verifySessionCookie(sessionCookie);
}

// Types that would be needed
interface VerificationResult {
  success: boolean;
  decodedToken: any | null;
  method: string;
  error: string | null;
}

interface SessionCookieResult {
  success: boolean;
  sessionCookie: string | null;
  error: string | null;
}

// Note: firebaseVerification would need to be imported
declare const firebaseVerification: any;
