/**
 * Secure Session Manager
 * 
 * Implements secure authentication session management with HttpOnly cookies.
 * Replaces localStorage-based token storage with secure server-side session cookies.
 * Includes CSRF protection, session validation, and automatic refresh.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { createHash, randomBytes } from 'crypto';
import { firebaseUserService, UserProfile } from '@/lib/services/firebase-user-service';
import { verifyIdToken, createCustomToken } from '@/lib/firebase/admin';
import { logServerError } from '@/lib/errors';

// =============================================================================
// Configuration and Constants
// =============================================================================

const SESSION_COOKIE_NAME = 'pb_session';
const CSRF_TOKEN_NAME = 'pb_csrf';
const REFRESH_TOKEN_NAME = 'pb_refresh';

const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
const REFRESH_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days
const CSRF_TOKEN_LENGTH = 32;

// JWT Secret (should be loaded from environment or Key Vault)
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'your-fallback-secret-key'
);

// =============================================================================
// Types and Interfaces
// =============================================================================

export interface SessionData {
  userId: string;
  email: string;
  displayName?: string;
  emailVerified: boolean;
  plan: 'free' | 'premium';
  issuedAt: number;
  expiresAt: number;
  sessionId: string;
  csrfToken: string;
}

export interface CreateSessionOptions {
  rememberMe?: boolean;
  userAgent?: string;
  ipAddress?: string;
  deviceFingerprint?: string;
}

export interface SessionValidationResult {
  valid: boolean;
  session?: SessionData;
  error?: string;
  requiresRefresh?: boolean;
}

export interface AuthenticationResult {
  success: boolean;
  user?: UserProfile;
  sessionData?: SessionData;
  error?: string;
}

// =============================================================================
// Secure Session Manager Implementation
// =============================================================================

class SecureSessionManager {
  private static instance: SecureSessionManager;
  private activeSessions: Map<string, SessionData> = new Map();

  private constructor() {}

  public static getInstance(): SecureSessionManager {
    if (!SecureSessionManager.instance) {
      SecureSessionManager.instance = new SecureSessionManager();
    }
    return SecureSessionManager.instance;
  }

  /**
   * Create a new secure session from Firebase ID token
   */
  async createSessionFromIdToken(
    idToken: string,
    options: CreateSessionOptions = {}
  ): Promise<AuthenticationResult> {
    try {
      console.log('🔐 Creating secure session from ID token...');

      // Verify Firebase ID token
      const verification = await verifyIdToken(idToken);
      if (!verification.valid || !verification.user) {
        return {
          success: false,
          error: 'Invalid ID token'
        };
      }

      const firebaseUser = verification.user;

      // Get or create user profile in Firestore
      let userProfile = await firebaseUserService.getUserProfile(firebaseUser.uid);
      if (!userProfile) {
        userProfile = await firebaseUserService.createUserProfile(firebaseUser.uid, {
          email: firebaseUser.email!,
          displayName: firebaseUser.name,
          emailVerified: firebaseUser.email_verified || false
        });
      }

      // Create session data
      const sessionData = await this.createSessionData(userProfile, options);

      // Store session in memory cache
      this.activeSessions.set(sessionData.sessionId, sessionData);

      console.log(`✅ Created secure session for user: ${userProfile.uid}`);

      return {
        success: true,
        user: userProfile,
        sessionData
      };

    } catch (error) {
      console.error('❌ Failed to create session from ID token:', error);
      logServerError(error as Error, { action: 'createSessionFromIdToken' });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Session creation failed'
      };
    }
  }

  /**
   * Create session from email/password authentication
   */
  async createSessionFromEmailPassword(
    email: string,
    password: string,
    options: CreateSessionOptions = {}
  ): Promise<AuthenticationResult> {
    try {
      console.log(`🔐 Creating secure session for email: ${email}`);

      // Authenticate with Firebase (this would need to be implemented)
      // For now, we'll get the user and create a custom token
      const authResult = await firebaseUserService.signInWithEmailAndPassword(email, password);
      const firebaseUser = authResult.user;

      // Get user profile
      let userProfile = await firebaseUserService.getUserProfile(firebaseUser.uid);
      if (!userProfile) {
        userProfile = await firebaseUserService.createUserProfile(firebaseUser.uid, {
          email: firebaseUser.email,
          displayName: firebaseUser.name,
          emailVerified: firebaseUser.email_verified
        });
      }

      // Create session data
      const sessionData = await this.createSessionData(userProfile, options);

      // Store session in memory cache
      this.activeSessions.set(sessionData.sessionId, sessionData);

      console.log(`✅ Created secure session for user: ${userProfile.uid}`);

      return {
        success: true,
        user: userProfile,
        sessionData
      };

    } catch (error) {
      console.error('❌ Failed to create session from email/password:', error);
      logServerError(error as Error, { action: 'createSessionFromEmailPassword', email });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      };
    }
  }

  /**
   * Validate session from request
   */
  async validateSession(request: NextRequest): Promise<SessionValidationResult> {
    try {
      // Get session cookie
      const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
      if (!sessionCookie) {
        return { valid: false, error: 'No session cookie found' };
      }

      // Verify JWT
      const { payload } = await jwtVerify(sessionCookie.value, JWT_SECRET);
      const sessionData = payload as unknown as SessionData;

      // Check expiration
      if (Date.now() > sessionData.expiresAt) {
        // Check if we can refresh
        const refreshCookie = request.cookies.get(REFRESH_TOKEN_NAME);
        if (refreshCookie) {
          return {
            valid: false,
            requiresRefresh: true,
            error: 'Session expired but refresh available'
          };
        }
        return { valid: false, error: 'Session expired' };
      }

      // Validate CSRF token for state-changing requests
      if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
        const csrfHeader = request.headers.get('x-csrf-token');
        const csrfCookie = request.cookies.get(CSRF_TOKEN_NAME);
        
        if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie.value) {
          return { valid: false, error: 'Invalid CSRF token' };
        }
      }

      // Check if session exists in memory cache
      const cachedSession = this.activeSessions.get(sessionData.sessionId);
      if (!cachedSession) {
        // Session not in cache, validate against database
        const userProfile = await firebaseUserService.getUserProfile(sessionData.userId);
        if (!userProfile) {
          return { valid: false, error: 'User not found' };
        }
      }

      return {
        valid: true,
        session: sessionData
      };

    } catch (error) {
      console.error('❌ Session validation failed:', error);
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Session validation failed'
      };
    }
  }

  /**
   * Set secure session cookies on response
   */
  setSessionCookies(response: NextResponse, sessionData: SessionData): void {
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      domain: process.env.NODE_ENV === 'production' ? '.prepbettr.com' : undefined
    };

    // Main session cookie
    response.cookies.set(SESSION_COOKIE_NAME, sessionData.sessionId, {
      ...cookieOptions,
      maxAge: SESSION_DURATION / 1000
    });

    // CSRF token cookie (readable by client)
    response.cookies.set(CSRF_TOKEN_NAME, sessionData.csrfToken, {
      ...cookieOptions,
      httpOnly: false, // Client needs to read this
      maxAge: SESSION_DURATION / 1000
    });

    // Refresh token cookie
    const refreshToken = this.generateRefreshToken(sessionData);
    response.cookies.set(REFRESH_TOKEN_NAME, refreshToken, {
      ...cookieOptions,
      maxAge: REFRESH_DURATION / 1000
    });
  }

  /**
   * Clear session cookies on logout
   */
  clearSessionCookies(response: NextResponse): void {
    const clearOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 0
    };

    response.cookies.set(SESSION_COOKIE_NAME, '', clearOptions);
    response.cookies.set(CSRF_TOKEN_NAME, '', { ...clearOptions, httpOnly: false });
    response.cookies.set(REFRESH_TOKEN_NAME, '', clearOptions);
  }

  /**
   * Refresh session if refresh token is valid
   */
  async refreshSession(request: NextRequest): Promise<AuthenticationResult> {
    try {
      const refreshCookie = request.cookies.get(REFRESH_TOKEN_NAME);
      if (!refreshCookie) {
        return { success: false, error: 'No refresh token found' };
      }

      // Verify refresh token
      const { payload } = await jwtVerify(refreshCookie.value, JWT_SECRET);
      const refreshData = payload as any;

      // Get current user profile
      const userProfile = await firebaseUserService.getUserProfile(refreshData.userId);
      if (!userProfile) {
        return { success: false, error: 'User not found' };
      }

      // Create new session
      const sessionData = await this.createSessionData(userProfile);
      this.activeSessions.set(sessionData.sessionId, sessionData);

      return {
        success: true,
        user: userProfile,
        sessionData
      };

    } catch (error) {
      console.error('❌ Session refresh failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Session refresh failed'
      };
    }
  }

  /**
   * Invalidate session
   */
  async invalidateSession(sessionId: string): Promise<void> {
    this.activeSessions.delete(sessionId);
    console.log(`🗑️ Invalidated session: ${sessionId}`);
  }

  /**
   * Get session data by session ID
   */
  getSession(sessionId: string): SessionData | null {
    return this.activeSessions.get(sessionId) || null;
  }

  /**
   * Create session data with JWT token
   */
  private async createSessionData(
    userProfile: UserProfile,
    options: CreateSessionOptions = {}
  ): Promise<SessionData> {
    const now = Date.now();
    const sessionId = this.generateSessionId();
    const csrfToken = this.generateCSRFToken();

    const sessionData: SessionData = {
      userId: userProfile.uid,
      email: userProfile.email,
      displayName: userProfile.displayName,
      emailVerified: userProfile.emailVerified,
      plan: userProfile.plan,
      issuedAt: now,
      expiresAt: now + SESSION_DURATION,
      sessionId,
      csrfToken
    };

    // Create JWT token
    const jwt = await new SignJWT(sessionData)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(now / 1000)
      .setExpirationTime((now + SESSION_DURATION) / 1000)
      .sign(JWT_SECRET);

    // Store JWT in session data for cookie
    (sessionData as any).jwt = jwt;

    return sessionData;
  }

  /**
   * Generate secure session ID
   */
  private generateSessionId(): string {
    return `sess_${Date.now()}_${randomBytes(16).toString('hex')}`;
  }

  /**
   * Generate CSRF token
   */
  private generateCSRFToken(): string {
    return randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
  }

  /**
   * Generate refresh token
   */
  private generateRefreshToken(sessionData: SessionData): string {
    const refreshPayload = {
      userId: sessionData.userId,
      sessionId: sessionData.sessionId,
      issuedAt: Date.now(),
      expiresAt: Date.now() + REFRESH_DURATION
    };

    return Buffer.from(JSON.stringify(refreshPayload)).toString('base64');
  }

  /**
   * Health check - return session statistics
   */
  getSessionStats(): {
    activeSessions: number;
    oldestSession?: number;
    newestSession?: number;
  } {
    const sessions = Array.from(this.activeSessions.values());
    
    return {
      activeSessions: sessions.length,
      oldestSession: sessions.length > 0 ? Math.min(...sessions.map(s => s.issuedAt)) : undefined,
      newestSession: sessions.length > 0 ? Math.max(...sessions.map(s => s.issuedAt)) : undefined
    };
  }

  /**
   * Cleanup expired sessions (called periodically)
   */
  cleanupExpiredSessions(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [sessionId, sessionData] of this.activeSessions) {
      if (now > sessionData.expiresAt) {
        this.activeSessions.delete(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} expired sessions`);
    }
  }
}

// =============================================================================
// Middleware Helper Functions
// =============================================================================

/**
 * Authentication middleware for API routes
 */
export async function withAuth<T extends NextRequest>(
  request: T,
  handler: (request: T, session: SessionData) => Promise<NextResponse>
): Promise<NextResponse> {
  const sessionManager = SecureSessionManager.getInstance();
  
  const validation = await sessionManager.validateSession(request);
  
  if (!validation.valid) {
    if (validation.requiresRefresh) {
      // Attempt session refresh
      const refreshResult = await sessionManager.refreshSession(request);
      
      if (refreshResult.success && refreshResult.sessionData) {
        const response = await handler(request, refreshResult.sessionData);
        sessionManager.setSessionCookies(response, refreshResult.sessionData);
        return response;
      }
    }
    
    return NextResponse.json(
      { error: 'Authentication required', details: validation.error },
      { status: 401 }
    );
  }

  return handler(request, validation.session!);
}

/**
 * CSRF protection middleware
 */
export function withCSRFProtection(request: NextRequest): boolean {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    return true; // CSRF not needed for safe methods
  }

  const csrfHeader = request.headers.get('x-csrf-token');
  const csrfCookie = request.cookies.get(CSRF_TOKEN_NAME);

  return !!(csrfHeader && csrfCookie && csrfHeader === csrfCookie.value);
}

/**
 * Rate limiting for authentication endpoints
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function checkAuthRateLimit(ipAddress: string, maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000): boolean {
  const now = Date.now();
  const key = `auth_${ipAddress}`;
  const current = rateLimitMap.get(key);

  if (!current || now > current.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (current.count >= maxAttempts) {
    return false;
  }

  current.count++;
  return true;
}

// =============================================================================
// Export Singleton and Utilities
// =============================================================================

export const secureSessionManager = SecureSessionManager.getInstance();

// Cleanup expired sessions every 5 minutes
if (typeof window === 'undefined') {
  setInterval(() => {
    secureSessionManager.cleanupExpiredSessions();
  }, 5 * 60 * 1000);
}

export default secureSessionManager;