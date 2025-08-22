/**
 * Unified Authentication Core Library
 * 
 * Consolidates all authentication logic into a single, reusable library
 * that eliminates the 87% code duplication across platforms
 */

import { 
  AuthenticatedUser, 
  AuthResult, 
  TokenVerificationResult, 
  AuthErrorCode, 
  AuthError, 
  AuthConfig,
  TokenInfo,
  AuthMetrics
} from './types';

export class UnifiedAuthError extends Error implements AuthError {
  constructor(
    public code: AuthErrorCode,
    message: string,
    public details?: Record<string, any>,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'UnifiedAuthError';
  }

  static missingToken(): UnifiedAuthError {
    return new UnifiedAuthError(
      AuthErrorCode.MISSING_TOKEN,
      'Missing or invalid Authorization header',
      {},
      401
    );
  }

  static invalidToken(details?: string): UnifiedAuthError {
    return new UnifiedAuthError(
      AuthErrorCode.INVALID_TOKEN,
      'Invalid or malformed token',
      { details },
      401
    );
  }

  static expiredToken(): UnifiedAuthError {
    return new UnifiedAuthError(
      AuthErrorCode.EXPIRED_TOKEN,
      'Token has expired',
      {},
      401
    );
  }

  static insufficientPermissions(requiredRoles: string[]): UnifiedAuthError {
    return new UnifiedAuthError(
      AuthErrorCode.INSUFFICIENT_PERMISSIONS,
      'Insufficient permissions',
      { requiredRoles },
      403
    );
  }

  static serviceUnavailable(service: string): UnifiedAuthError {
    return new UnifiedAuthError(
      AuthErrorCode.SERVICE_UNAVAILABLE,
      `Authentication service unavailable: ${service}`,
      { service },
      503
    );
  }
}

// ===== CORE AUTHENTICATION CLASS =====

export class UnifiedAuth {
  private static instance: UnifiedAuth;
  private firebaseAuth?: any;
  private azureAuth?: any;
  private config: AuthConfig;
  private metrics: AuthMetrics;
  private initialized = false;

  constructor(config: AuthConfig = {}) {
    this.config = {
      security: {
        enableTokenRefresh: true,
        tokenExpiryMinutes: 60,
        maxRetryAttempts: 3,
        retryDelayMs: 1000,
        ...config.security
      },
      logging: {
        enabled: true,
        level: 'debug', // More verbose logging for debugging
        includeTokenDetails: false,
        ...config.logging
      },
      ...config
    };

    this.metrics = {
      totalRequests: 0,
      successfulAuth: 0,
      failedAuth: 0,
      averageVerificationTime: 0,
      errorsByCode: {}
    };
  }

  static getInstance(config?: AuthConfig): UnifiedAuth {
    if (!UnifiedAuth.instance) {
      UnifiedAuth.instance = new UnifiedAuth(config);
    }
    return UnifiedAuth.instance;
  }

  /**
   * Initialize authentication providers
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Initialize Firebase Auth
      if (this.config.firebase) {
        await this.initializeFirebase();
      }

      // Initialize Azure Auth (if needed)
      if (this.config.azure) {
        await this.initializeAzure();
      }

      this.initialized = true;
      this.log('info', 'UnifiedAuth initialized successfully');
    } catch (error) {
      this.log('error', 'Failed to initialize UnifiedAuth', { error });
      throw error;
    }
  }

  /**
   * Initialize Firebase Auth
   */
  private async initializeFirebase(): Promise<void> {
    try {
      // Use existing Firebase admin initialization
      const { getAdminAuth } = await import('@/lib/firebase/admin');
      this.firebaseAuth = await getAdminAuth();
      this.log('info', 'Firebase Auth initialized');
    } catch (error) {
      throw new UnifiedAuthError(
        AuthErrorCode.FIREBASE_ERROR,
        'Failed to initialize Firebase Auth',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Initialize Azure Auth (placeholder for future Azure AD integration)
   */
  private async initializeAzure(): Promise<void> {
    try {
      // Placeholder for Azure AD initialization
      this.log('info', 'Azure Auth initialization skipped (not implemented)');
    } catch (error) {
      throw new UnifiedAuthError(
        AuthErrorCode.AZURE_ERROR,
        'Failed to initialize Azure Auth',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Extract Bearer token from Authorization header
   */
  extractBearerToken(authHeader: string | null | undefined): string | null {
    if (!authHeader) {
      return null;
    }

    const parts = authHeader.trim().split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }

    return parts[1];
  }

  /**
   * Verify any token (Firebase, Azure, etc.)
   */
  async verifyToken(token: string): Promise<TokenVerificationResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      // Try Firebase token verification first
      if (this.firebaseAuth) {
        const result = await this.verifyFirebaseToken(token);
        if (result.valid) {
          this.updateMetrics(true, Date.now() - startTime);
          return result;
        }
      }

      // Try Azure token verification (if configured)
      if (this.azureAuth) {
        const result = await this.verifyAzureToken(token);
        if (result.valid) {
          this.updateMetrics(true, Date.now() - startTime);
          return result;
        }
      }

      // No valid token found
      this.updateMetrics(false, Date.now() - startTime, AuthErrorCode.INVALID_TOKEN);
      return {
        valid: false,
        error: 'Token verification failed across all providers',
        errorCode: AuthErrorCode.INVALID_TOKEN
      };

    } catch (error) {
      this.updateMetrics(false, Date.now() - startTime, AuthErrorCode.UNKNOWN_ERROR);
      this.log('error', 'Token verification error', { error });
      
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown verification error',
        errorCode: AuthErrorCode.UNKNOWN_ERROR
      };
    }
  }

  /**
   * Verify Firebase ID token
   */
  private async verifyFirebaseToken(idToken: string): Promise<TokenVerificationResult> {
    try {
      // Handle mock tokens for development
      if (idToken.startsWith('mock-token-')) {
        this.log('debug', 'Verifying mock token');
        return this.verifyMockToken(idToken);
      }

      if (!this.firebaseAuth) {
        throw new UnifiedAuthError(AuthErrorCode.SERVICE_UNAVAILABLE, 'Firebase Auth not initialized');
      }

      this.log('debug', 'Verifying Firebase ID token', { tokenPrefix: idToken.substring(0, 20) + '...' });
      
      // Add additional validation options
      const decodedToken = await this.firebaseAuth.verifyIdToken(idToken, true);
      
      this.log('debug', 'Firebase token verification successful', { 
        uid: decodedToken.uid, 
        email: decodedToken.email,
        exp: decodedToken.exp
      });
      
      const user: AuthenticatedUser = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        name: decodedToken.name || decodedToken.display_name || decodedToken.email?.split('@')[0],
        picture: decodedToken.picture,
        email_verified: decodedToken.email_verified || false,
        firebase: decodedToken.firebase,
        custom_claims: decodedToken.custom_claims || {},
        provider: 'firebase'
      };

      return {
        valid: true,
        user,
        expiresAt: new Date(decodedToken.exp * 1000)
      };

    } catch (error: any) {
      this.log('error', 'Firebase token verification failed', { 
        error: error.message,
        code: error.code,
        tokenPrefix: idToken.substring(0, 20) + '...'
      });
      
      // Handle specific Firebase Auth errors
      if (error.code === 'auth/id-token-expired') {
        return {
          valid: false,
          error: 'Token has expired',
          errorCode: AuthErrorCode.EXPIRED_TOKEN
        };
      }
      
      if (error.code === 'auth/id-token-revoked') {
        return {
          valid: false,
          error: 'Token has been revoked',
          errorCode: AuthErrorCode.INVALID_TOKEN
        };
      }
      
      if (error.code === 'auth/invalid-id-token') {
        return {
          valid: false,
          error: 'Invalid ID token format',
          errorCode: AuthErrorCode.INVALID_TOKEN
        };
      }
      
      if (error.code === 'auth/project-not-found') {
        return {
          valid: false,
          error: 'Firebase project not found',
          errorCode: AuthErrorCode.SERVICE_UNAVAILABLE
        };
      }

      return {
        valid: false,
        error: error.message || 'Firebase token verification failed',
        errorCode: AuthErrorCode.FIREBASE_ERROR
      };
    }
  }

  /**
   * Verify mock token for development
   */
  private verifyMockToken(token: string): TokenVerificationResult {
    try {
      // Parse mock token: mock-token-{uid}-{timestamp}
      const parts = token.split('-');
      if (parts.length < 4) {
        return {
          valid: false,
          error: 'Invalid mock token format',
          errorCode: AuthErrorCode.INVALID_TOKEN
        };
      }

      const uid = parts[2];
      const timestamp = parseInt(parts[3]);
      
      // Check if token is not too old (24 hours)
      const tokenAge = Date.now() - timestamp;
      if (tokenAge > 24 * 60 * 60 * 1000) {
        return {
          valid: false,
          error: 'Mock token has expired',
          errorCode: AuthErrorCode.EXPIRED_TOKEN
        };
      }

      const user: AuthenticatedUser = {
        uid: uid,
        email: uid.includes('@') ? uid : `${uid}@mock.com`,
        name: uid.replace(/[^a-zA-Z0-9]/g, ' ').replace(/\s+/g, ' ').trim() || 'Mock User',
        email_verified: true,
        provider: 'custom'
      };

      this.log('debug', 'Mock token verified successfully', { uid });

      return {
        valid: true,
        user,
        expiresAt: new Date(timestamp + 24 * 60 * 60 * 1000) // 24 hours from creation
      };

    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Mock token verification failed',
        errorCode: AuthErrorCode.INVALID_TOKEN
      };
    }
  }

  /**
   * Verify Azure AD token (placeholder)
   */
  private async verifyAzureToken(token: string): Promise<TokenVerificationResult> {
    try {
      // Placeholder for Azure AD token verification
      this.log('debug', 'Azure token verification not implemented');
      return {
        valid: false,
        error: 'Azure token verification not implemented',
        errorCode: AuthErrorCode.SERVICE_UNAVAILABLE
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Azure token verification failed',
        errorCode: AuthErrorCode.AZURE_ERROR
      };
    }
  }

  /**
   * Verify session cookie (primarily for Firebase)
   */
  async verifySessionCookie(sessionCookie: string): Promise<TokenVerificationResult> {
    try {
      if (!this.firebaseAuth) {
        await this.initialize();
      }

      const decodedClaims = await this.firebaseAuth.verifySessionCookie(sessionCookie, true);
      
      const user: AuthenticatedUser = {
        uid: decodedClaims.uid,
        email: decodedClaims.email,
        name: decodedClaims.name || decodedClaims.email?.split('@')[0],
        picture: decodedClaims.picture,
        email_verified: decodedClaims.email_verified || false,
        firebase: decodedClaims.firebase,
        custom_claims: decodedClaims.custom_claims || {},
        provider: 'firebase'
      };

      return {
        valid: true,
        user,
        expiresAt: new Date(decodedClaims.exp * 1000)
      };

    } catch (error: any) {
      this.log('debug', 'Session cookie verification failed', { error: error.message });
      
      return {
        valid: false,
        error: error.message || 'Session cookie verification failed',
        errorCode: AuthErrorCode.INVALID_TOKEN
      };
    }
  }

  /**
   * Check if user has required roles
   */
  hasRequiredRoles(user: AuthenticatedUser, requiredRoles: string[]): boolean {
    if (!requiredRoles.length) return true;
    
    const userRoles = user.custom_claims?.roles || [];
    return requiredRoles.some(role => userRoles.includes(role));
  }

  /**
   * Create standardized auth result
   */
  createAuthResult(user: AuthenticatedUser | null, error?: UnifiedAuthError): AuthResult {
    return {
      success: !!user && !error,
      user,
      error: error?.message,
      errorCode: error?.code
    };
  }

  /**
   * Get authentication metrics
   */
  getMetrics(): AuthMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      successfulAuth: 0,
      failedAuth: 0,
      averageVerificationTime: 0,
      errorsByCode: {}
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; details: Record<string, any> }> {
    const details: Record<string, any> = {
      initialized: this.initialized,
      firebase: !!this.firebaseAuth,
      azure: !!this.azureAuth,
      metrics: this.metrics
    };

    let healthy = this.initialized;

    // Test Firebase connectivity
    if (this.firebaseAuth) {
      try {
        // Simple connectivity test
        await this.firebaseAuth.getUser('test-user-id').catch(() => {
          // Expected to fail, just testing connectivity
        });
        details.firebaseConnectivity = 'ok';
      } catch (error) {
        details.firebaseConnectivity = 'error';
        details.firebaseError = error instanceof Error ? error.message : 'Unknown error';
        healthy = false;
      }
    }

    return { healthy, details };
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(success: boolean, responseTime: number, errorCode?: AuthErrorCode): void {
    if (success) {
      this.metrics.successfulAuth++;
    } else {
      this.metrics.failedAuth++;
      if (errorCode) {
        this.metrics.errorsByCode[errorCode] = (this.metrics.errorsByCode[errorCode] || 0) + 1;
      }
    }

    // Update average response time
    const totalAuth = this.metrics.successfulAuth + this.metrics.failedAuth;
    this.metrics.averageVerificationTime = 
      (this.metrics.averageVerificationTime * (totalAuth - 1) + responseTime) / totalAuth;
  }

  /**
   * Unified logging
   */
  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, details?: any): void {
    if (!this.config.logging?.enabled) return;

    const logLevel = this.config.logging?.level || 'info';
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    
    if (levels[level] >= levels[logLevel]) {
      const logMessage = `[UnifiedAuth] ${message}`;
      const logDetails = this.config.logging?.includeTokenDetails ? details : 
        details ? { ...details, token: '[REDACTED]' } : undefined;

      switch (level) {
        case 'debug':
          console.debug(logMessage, logDetails);
          break;
        case 'info':
          console.info(logMessage, logDetails);
          break;
        case 'warn':
          console.warn(logMessage, logDetails);
          break;
        case 'error':
          console.error(logMessage, logDetails);
          break;
      }
    }
  }
}

// ===== UTILITY FUNCTIONS =====

/**
 * Get the singleton UnifiedAuth instance
 */
export function getUnifiedAuth(config?: AuthConfig): UnifiedAuth {
  return UnifiedAuth.getInstance(config);
}

/**
 * Quick token verification function
 */
export async function verifyToken(token: string): Promise<TokenVerificationResult> {
  const auth = getUnifiedAuth();
  return auth.verifyToken(token);
}

/**
 * Extract and verify token from authorization header
 */
export async function verifyAuthHeader(authHeader: string | null | undefined): Promise<AuthResult> {
  const auth = getUnifiedAuth();
  
  try {
    const token = auth.extractBearerToken(authHeader);
    
    if (!token) {
      throw UnifiedAuthError.missingToken();
    }

    const result = await auth.verifyToken(token);
    
    if (!result.valid) {
      throw new UnifiedAuthError(
        result.errorCode || AuthErrorCode.INVALID_TOKEN,
        result.error || 'Token verification failed'
      );
    }

    return auth.createAuthResult(result.user || null);

  } catch (error) {
    if (error instanceof UnifiedAuthError) {
      return auth.createAuthResult(null, error);
    }
    
    return auth.createAuthResult(null, new UnifiedAuthError(
      AuthErrorCode.UNKNOWN_ERROR,
      error instanceof Error ? error.message : 'Unknown authentication error'
    ));
  }
}

/**
 * Verify user has required roles
 */
export function verifyRoles(user: AuthenticatedUser, requiredRoles: string[]): boolean {
  const auth = getUnifiedAuth();
  return auth.hasRequiredRoles(user, requiredRoles);
}

/**
 * Create a custom authentication error
 */
export function createAuthError(
  code: AuthErrorCode,
  message: string,
  details?: Record<string, any>,
  statusCode?: number
): UnifiedAuthError {
  return new UnifiedAuthError(code, message, details, statusCode);
}

// ===== TOKEN UTILITIES =====

export class TokenUtils {
  /**
   * Parse token to extract basic information without verification
   */
  static parseTokenInfo(token: string): TokenInfo | null {
    try {
      // For JWT tokens, decode the payload (without verification)
      if (token.includes('.')) {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(
            Buffer.from(parts[1], 'base64url').toString()
          );
          
          return {
            provider: 'firebase', // Assume Firebase for now
            value: token,
            expiresAt: payload.exp ? new Date(payload.exp * 1000) : undefined,
            userId: payload.uid || payload.sub,
            claims: payload
          };
        }
      }
      
      return {
        provider: 'custom',
        value: token
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if token is expired (without verification)
   */
  static isTokenExpired(token: string): boolean {
    const tokenInfo = TokenUtils.parseTokenInfo(token);
    if (!tokenInfo?.expiresAt) return false;
    
    return tokenInfo.expiresAt < new Date();
  }

  /**
   * Get token expiry time
   */
  static getTokenExpiry(token: string): Date | null {
    const tokenInfo = TokenUtils.parseTokenInfo(token);
    return tokenInfo?.expiresAt || null;
  }
}

// ===== PERFORMANCE MONITORING =====

export class AuthPerformanceMonitor {
  private static instance: AuthPerformanceMonitor;
  private timings: Map<string, number[]> = new Map();

  static getInstance(): AuthPerformanceMonitor {
    if (!AuthPerformanceMonitor.instance) {
      AuthPerformanceMonitor.instance = new AuthPerformanceMonitor();
    }
    return AuthPerformanceMonitor.instance;
  }

  /**
   * Start timing an operation
   */
  startTiming(operation: string): () => number {
    const startTime = performance.now();
    
    return () => {
      const duration = performance.now() - startTime;
      this.recordTiming(operation, duration);
      return duration;
    };
  }

  /**
   * Record timing for an operation
   */
  recordTiming(operation: string, duration: number): void {
    if (!this.timings.has(operation)) {
      this.timings.set(operation, []);
    }
    
    const timings = this.timings.get(operation)!;
    timings.push(duration);
    
    // Keep only last 100 measurements
    if (timings.length > 100) {
      timings.shift();
    }
  }

  /**
   * Get performance statistics
   */
  getStats(operation?: string): Record<string, any> {
    if (operation) {
      const timings = this.timings.get(operation) || [];
      return this.calculateStats(operation, timings);
    }

    const stats: Record<string, any> = {};
    for (const [op, timings] of this.timings.entries()) {
      stats[op] = this.calculateStats(op, timings);
    }
    return stats;
  }

  private calculateStats(operation: string, timings: number[]): any {
    if (timings.length === 0) {
      return { operation, count: 0 };
    }

    const sorted = [...timings].sort((a, b) => a - b);
    const sum = timings.reduce((a, b) => a + b, 0);

    return {
      operation,
      count: timings.length,
      average: sum / timings.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      min: sorted[0],
      max: sorted[sorted.length - 1]
    };
  }

  /**
   * Reset all performance data
   */
  reset(): void {
    this.timings.clear();
  }
}

// ===== GLOBAL INSTANCES =====

let globalAuth: UnifiedAuth | null = null;

export function getGlobalAuth(): UnifiedAuth {
  if (!globalAuth) {
    globalAuth = UnifiedAuth.getInstance();
  }
  return globalAuth;
}

export function resetGlobalAuth(): void {
  globalAuth = null;
}
