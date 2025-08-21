import { NextRequest, NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/firebase/admin';

/**
 * Firebase Authentication Middleware for Next.js API Routes
 * 
 * This middleware validates Firebase ID tokens and ensures only authenticated users
 * can access protected API endpoints.
 */

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
  email_verified: boolean;
  firebase: any;
  custom_claims?: Record<string, any>;
}

export interface AuthResult {
  success: boolean;
  user: AuthenticatedUser | null;
  error?: string;
}

export interface AuthRequest extends NextRequest {
  user?: AuthenticatedUser;
}

/**
 * Extract Bearer token from Authorization header
 */
function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Verify Firebase ID token
 */
export async function verifyFirebaseToken(idToken: string): Promise<AuthResult> {
  try {
    const decodedToken = await verifyIdToken(idToken);
    
    if (!decodedToken) {
      return {
        success: false,
        user: null,
        error: 'Invalid or expired token'
      };
    }
    
    return {
      success: true,
      user: {
        uid: decodedToken.uid,
        email: decodedToken.email,
        name: decodedToken.name || decodedToken.email?.split('@')[0],
        picture: decodedToken.picture,
        email_verified: decodedToken.email_verified || false,
        firebase: decodedToken.firebase,
        custom_claims: decodedToken.custom_claims || {}
      }
    };
  } catch (error) {
    console.error('Token verification failed:', error);
    return {
      success: false,
      user: null,
      error: error instanceof Error ? error.message : 'Token verification failed'
    };
  }
}

/**
 * Authentication middleware for Next.js API routes
 * 
 * Usage:
 * import { authMiddleware } from '@/lib/middleware/authMiddleware';
 * 
 * export async function GET(request: NextRequest) {
 *   const authResult = await authMiddleware(request);
 *   if (!authResult.success) {
 *     return authResult.response;
 *   }
 *   
 *   const user = authResult.user;
 *   // Your protected API logic here
 * }
 */
export async function authMiddleware(request: NextRequest): Promise<{
  success: boolean;
  user: AuthenticatedUser | null;
  response?: NextResponse;
}> {
  try {
    // Extract token from Authorization header
    const authHeader = request.headers.get('authorization');
    const token = extractBearerToken(authHeader);

    if (!token) {
      return {
        success: false,
        user: null,
        response: NextResponse.json(
          {
            error: 'Missing or invalid Authorization header',
            message: 'Please provide a valid Bearer token in the Authorization header'
          },
          { status: 401 }
        )
      };
    }

    // Verify the Firebase token
    const verificationResult = await verifyFirebaseToken(token);

    if (!verificationResult.success) {
      return {
        success: false,
        user: null,
        response: NextResponse.json(
          {
            error: 'Token verification failed',
            message: verificationResult.error
          },
          { status: 401 }
        )
      };
    }

    console.log(`Authenticated user: ${verificationResult.user?.uid} (${verificationResult.user?.email})`);

    return {
      success: true,
      user: verificationResult.user!
    };

  } catch (error) {
    console.error('Authentication middleware error:', error);
    
    return {
      success: false,
      user: null,
      response: NextResponse.json(
        {
          error: 'Authentication system error',
          message: 'Please try again later'
        },
        { status: 500 }
      )
    };
  }
}

/**
 * Role-based authorization middleware
 * 
 * Checks if user has required permissions/roles
 */
export async function roleMiddleware(
  request: NextRequest, 
  requiredRoles: string[] = []
): Promise<{
  success: boolean;
  user: AuthenticatedUser | null;
  response?: NextResponse;
}> {
  const authResult = await authMiddleware(request);
  
  if (!authResult.success) {
    return authResult;
  }

  const user = authResult.user!;
  
  // Check roles if specified
  if (requiredRoles.length > 0) {
    const userRoles = user.custom_claims?.roles || [];
    const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));
    
    if (!hasRequiredRole) {
      return {
        success: false,
        user: null,
        response: NextResponse.json(
          {
            error: 'Insufficient permissions',
            message: `Required roles: ${requiredRoles.join(', ')}`
          },
          { status: 403 }
        )
      };
    }
  }

  return authResult;
}

/**
 * Admin-only middleware
 */
export function adminMiddleware(request: NextRequest) {
  return roleMiddleware(request, ['admin']);
}

/**
 * Higher-order function to create authenticated API handlers
 * 
 * Usage:
 * import { withAuth } from '@/lib/middleware/authMiddleware';
 * 
 * export const GET = withAuth(async (request: NextRequest, user: AuthenticatedUser) => {
 *   // Your protected API logic here
 *   return NextResponse.json({ message: `Hello ${user.email}` });
 * });
 */
export function withAuth<T extends any[]>(
  handler: (request: NextRequest, user: AuthenticatedUser, ...args: T) => Promise<NextResponse>,
  options: { requiredRoles?: string[]; skipAuth?: boolean } = {}
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    const { requiredRoles = [], skipAuth = false } = options;
    
    if (skipAuth) {
      return await handler(request, null as any, ...args);
    }

    const authResult = requiredRoles.length > 0 
      ? await roleMiddleware(request, requiredRoles)
      : await authMiddleware(request);

    if (!authResult.success || !authResult.user) {
      return authResult.response!;
    }

    // Call the actual handler with the authenticated user
    return await handler(request, authResult.user, ...args);
  };
}

/**
 * Admin-only handler wrapper
 */
export function withAdminAuth<T extends any[]>(
  handler: (request: NextRequest, user: AuthenticatedUser, ...args: T) => Promise<NextResponse>
) {
  return withAuth(handler, { requiredRoles: ['admin'] });
}

/**
 * Utility function to get user from session cookie (for server components)
 */
export async function getUserFromSessionCookie(sessionCookie: string): Promise<AuthResult> {
  try {
    // Note: Session cookie verification needs direct Firebase Admin auth access
    const { getAdminAuth } = await import('@/lib/firebase/admin');
    const adminAuth = getAdminAuth();
    const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
    
    return {
      success: true,
      user: {
        uid: decodedClaims.uid,
        email: decodedClaims.email,
        name: decodedClaims.name || decodedClaims.email?.split('@')[0],
        picture: decodedClaims.picture,
        email_verified: decodedClaims.email_verified || false,
        firebase: decodedClaims.firebase,
        custom_claims: decodedClaims.custom_claims || {}
      }
    };
  } catch (error) {
    console.error('Session cookie verification failed:', error);
    return {
      success: false,
      user: null,
      error: error instanceof Error ? error.message : 'Session verification failed'
    };
  }
}

/**
 * Middleware for API routes that need to handle both authenticated and anonymous users
 */
export async function optionalAuth(request: NextRequest): Promise<{
  user: AuthenticatedUser | null;
  isAuthenticated: boolean;
}> {
  const authHeader = request.headers.get('authorization');
  const token = extractBearerToken(authHeader);

  if (!token) {
    return {
      user: null,
      isAuthenticated: false
    };
  }

  const verificationResult = await verifyFirebaseToken(token);
  
  return {
    user: verificationResult.user,
    isAuthenticated: verificationResult.success
  };
}

/**
 * Health check utility (no auth required)
 */
export function createHealthCheckResponse() {
  return NextResponse.json(
    {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'Next.js API Auth Middleware'
    },
    { status: 200 }
  );
}

// Types already exported as interfaces above
