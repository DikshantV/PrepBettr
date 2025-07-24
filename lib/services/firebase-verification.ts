import { getAuthService } from "@/firebase/admin";

/**
 * Firebase REST API verification service
 * This provides a fallback when Firebase Admin SDK has SSL/gRPC issues
 */
class FirebaseVerificationService {
  private readonly FIREBASE_AUTH_URL = 'https://identitytoolkit.googleapis.com/v1/accounts:lookup';
  private readonly FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
  private readonly FIREBASE_WEB_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_CLIENT_KEY;

  /**
   * Verify token using Firebase Admin SDK (primary method)
   */
  async verifyWithAdminSDK(idToken: string): Promise<VerificationResult> {
    try {
      const adminAuth = getAuthService();
      
      // Add timeout to avoid hanging on SSL issues
      const verificationPromise = adminAuth.verifyIdToken(idToken, true);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Verification timeout')), 5000)
      );
      
      const decodedToken = await Promise.race([verificationPromise, timeoutPromise]) as any;
      
      return {
        success: true,
        decodedToken,
        method: 'admin-sdk',
        error: null
      };
    } catch (error) {
      // Check if this is the specific OpenSSL error
      const isSSLError = error instanceof Error && (
        error.message.includes('DECODER routines::unsupported') ||
        error.message.includes('SSL') ||
        error.message.includes('GRPC') ||
        error.message.includes('Getting metadata from plugin failed')
      );
      
      // Only log the error once per session to reduce noise
      if (!process.env.FIREBASE_SDK_ERROR_LOGGED) {
        if (isSSLError) {
          console.warn('Firebase Admin SDK has OpenSSL/gRPC compatibility issues, using REST API fallback');
        } else {
          console.warn('Firebase Admin SDK verification failed:', 
                      error instanceof Error ? error.message.split(':')[0] : 'Unknown error');
        }
        process.env.FIREBASE_SDK_ERROR_LOGGED = 'true';
      }
      
      return {
        success: false,
        decodedToken: null,
        method: 'admin-sdk',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Verify token using Firebase REST API (fallback method)
   */
  async verifyWithRESTAPI(idToken: string): Promise<VerificationResult> {
    if (!this.FIREBASE_WEB_API_KEY) {
      return {
        success: false,
        decodedToken: null,
        method: 'rest-api',
        error: 'Firebase Web API key not configured'
      };
    }

    try {
      const response = await fetch(`${this.FIREBASE_AUTH_URL}?key=${this.FIREBASE_WEB_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          idToken: idToken
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Token verification failed');
      }

      const data = await response.json();
      const user = data.users?.[0];
      
      if (!user) {
        throw new Error('User not found');
      }

      // Convert REST API response to Admin SDK format
      const decodedToken = {
        uid: user.localId,
        email: user.email,
        email_verified: user.emailVerified === 'true',
        name: user.displayName || user.email?.split('@')[0],
        picture: user.photoUrl,
        iss: `https://securetoken.google.com/${this.FIREBASE_PROJECT_ID}`,
        aud: this.FIREBASE_PROJECT_ID,
        auth_time: parseInt(user.lastLoginAt) / 1000,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        firebase: {
          identities: {
            email: [user.email]
          },
          sign_in_provider: user.providerUserInfo?.[0]?.providerId || 'password'
        }
      };

      return {
        success: true,
        decodedToken,
        method: 'rest-api',
        error: null
      };
    } catch (error) {
      console.error('Firebase REST API verification failed:', error);
      return {
        success: false,
        decodedToken: null,
        method: 'rest-api',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Comprehensive token verification with fallback strategy
   */
  async verifyIdToken(idToken: string): Promise<VerificationResult> {
    if (!idToken) {
      return {
        success: false,
        decodedToken: null,
        method: 'none',
        error: 'No token provided'
      };
    }

    // Try Admin SDK first (more secure and feature-complete)
    const adminResult = await this.verifyWithAdminSDK(idToken);
    if (adminResult.success) {
      return adminResult;
    }

    // Fallback to REST API if Admin SDK fails (silent fallback)
    return await this.verifyWithRESTAPI(idToken);
  }

  /**
   * Additional server-side token validation checks
   */
  async validateTokenClaims(decodedToken: any): Promise<ValidationResult> {
    const now = Math.floor(Date.now() / 1000);
    
    // Check token expiration
    if (decodedToken.exp && decodedToken.exp < now) {
      return {
        isValid: false,
        errors: ['Token has expired']
      };
    }

    // Check issued at time (not in future)
    if (decodedToken.iat && decodedToken.iat > now + 60) { // 60 second clock skew allowance
      return {
        isValid: false,
        errors: ['Token issued in the future']
      };
    }

    // Check audience (should match project ID)
    if (decodedToken.aud && decodedToken.aud !== this.FIREBASE_PROJECT_ID) {
      return {
        isValid: false,
        errors: ['Invalid token audience']
      };
    }

    // Check issuer
    const expectedIssuer = `https://securetoken.google.com/${this.FIREBASE_PROJECT_ID}`;
    if (decodedToken.iss && decodedToken.iss !== expectedIssuer) {
      return {
        isValid: false,
        errors: ['Invalid token issuer']
      };
    }

    // Check required fields
    const requiredFields = ['uid', 'email'];
    const missingFields = requiredFields.filter(field => !decodedToken[field]);
    if (missingFields.length > 0) {
      return {
        isValid: false,
        errors: [`Missing required fields: ${missingFields.join(', ')}`]
      };
    }

    return {
      isValid: true,
      errors: []
    };
  }

  /**
   * Create session cookie using Firebase Admin SDK
   */
  async createSessionCookie(idToken: string, expiresIn: number = 5 * 24 * 60 * 60 * 1000): Promise<SessionCookieResult> {
    try {
      const adminAuth = getAuthService();
      const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });
      
      return {
        success: true,
        sessionCookie,
        error: null
      };
    } catch (error) {
      // Only log session cookie creation errors once per session
      if (!process.env.SESSION_COOKIE_ERROR_LOGGED) {
        console.warn('Failed to create session cookie, using ID token instead:', 
                    error instanceof Error ? error.message.split(':')[0] : 'Unknown error');
        process.env.SESSION_COOKIE_ERROR_LOGGED = 'true';
      }
      return {
        success: false,
        sessionCookie: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Verify session cookie
   */
  async verifySessionCookie(sessionCookie: string): Promise<VerificationResult> {
    try {
      const adminAuth = getAuthService();
      const decodedToken = await adminAuth.verifySessionCookie(sessionCookie, true);
      
      return {
        success: true,
        decodedToken,
        method: 'session-cookie',
        error: null
      };
    } catch (error) {
      console.error('Session cookie verification failed:', error);
      return {
        success: false,
        decodedToken: null,
        method: 'session-cookie',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Types
interface VerificationResult {
  success: boolean;
  decodedToken: any | null;
  method: string;
  error: string | null;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

interface SessionCookieResult {
  success: boolean;
  sessionCookie: string | null;
  error: string | null;
}

// Export singleton instance
export const firebaseVerification = new FirebaseVerificationService();

