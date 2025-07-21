/**
 * Edge-compatible Firebase verification service
 * This version works in Next.js middleware (Edge Runtime)
 * Only uses REST API - no Node.js specific APIs or Firebase Admin SDK
 */

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

/**
 * Edge-compatible Firebase verification service
 * Uses only Web APIs that work in Edge Runtime
 */
class FirebaseVerificationEdgeService {
  private readonly FIREBASE_AUTH_URL = 'https://identitytoolkit.googleapis.com/v1/accounts:lookup';
  private readonly FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
  private readonly FIREBASE_WEB_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_CLIENT_KEY;

  /**
   * Verify token using Firebase REST API (Edge Runtime compatible)
   */
  async verifyIdToken(idToken: string): Promise<VerificationResult> {
    if (!idToken) {
      return {
        success: false,
        decodedToken: null,
        method: 'rest-api-edge',
        error: 'No token provided'
      };
    }

    if (!this.FIREBASE_WEB_API_KEY) {
      return {
        success: false,
        decodedToken: null,
        method: 'rest-api-edge',
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
        const errorMessage = errorData.error?.message || 'Token verification failed';
        
        // Don't log INVALID_ID_TOKEN as an error - it's expected for invalid/expired tokens
        if (errorMessage !== 'INVALID_ID_TOKEN') {
          console.error('Firebase REST API unexpected error:', errorMessage);
        }
        
        throw new Error(errorMessage);
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
        method: 'rest-api-edge',
        error: null
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Only log unexpected errors, not invalid tokens (which are normal)
      if (errorMessage !== 'INVALID_ID_TOKEN') {
        console.error('Firebase REST API verification failed:', error);
      }
      
      return {
        success: false,
        decodedToken: null,
        method: 'rest-api-edge',
        error: errorMessage
      };
    }
  }

  /**
   * Additional server-side token validation checks (Edge Runtime compatible)
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
}

// Export singleton instance
export const firebaseVerificationEdge = new FirebaseVerificationEdgeService();

// Helper functions for convenience
export async function verifyFirebaseTokenEdge(idToken: string): Promise<VerificationResult> {
  return await firebaseVerificationEdge.verifyIdToken(idToken);
}
