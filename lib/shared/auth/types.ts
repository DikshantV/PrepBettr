/**
 * Unified Authentication Types
 * 
 * Common type definitions for all authentication implementations
 */

// ===== USER TYPES =====

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
  email_verified: boolean;
  firebase?: any;
  custom_claims?: Record<string, any>;
  provider?: 'firebase' | 'azure' | 'custom';
}

export interface UserSession {
  userId: string;
  email?: string;
  verified: boolean;
  expiresAt?: Date;
  refreshToken?: string;
}

// ===== AUTHENTICATION RESULT TYPES =====

export interface AuthResult {
  success: boolean;
  user: AuthenticatedUser | null;
  error?: string;
  errorCode?: AuthErrorCode;
}

export interface TokenVerificationResult {
  valid: boolean;
  user?: AuthenticatedUser;
  error?: string;
  errorCode?: AuthErrorCode;
  expiresAt?: Date;
}

// ===== ERROR TYPES =====

export enum AuthErrorCode {
  MISSING_TOKEN = 'MISSING_TOKEN',
  INVALID_TOKEN = 'INVALID_TOKEN',
  EXPIRED_TOKEN = 'EXPIRED_TOKEN',
  MALFORMED_TOKEN = 'MALFORMED_TOKEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  FIREBASE_ERROR = 'FIREBASE_ERROR',
  AZURE_ERROR = 'AZURE_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface AuthError extends Error {
  code: AuthErrorCode;
  details?: Record<string, any>;
  statusCode?: number;
}

// ===== CONFIGURATION TYPES =====

export interface AuthConfig {
  firebase?: {
    projectId: string;
    clientEmail: string;
    privateKey: string;
  };
  azure?: {
    tenantId: string;
    clientId: string;
    clientSecret: string;
  };
  security?: {
    enableTokenRefresh: boolean;
    tokenExpiryMinutes: number;
    maxRetryAttempts: number;
    retryDelayMs: number;
  };
  logging?: {
    enabled: boolean;
    level: 'debug' | 'info' | 'warn' | 'error';
    includeTokenDetails: boolean;
  };
}

// ===== MIDDLEWARE TYPES =====

export interface AuthMiddlewareOptions {
  requiredRoles?: string[];
  skipAuth?: boolean;
  allowAnonymous?: boolean;
  customValidator?: (user: AuthenticatedUser) => Promise<boolean>;
}

export interface AuthMiddlewareResult<TResponse = any> {
  success: boolean;
  user: AuthenticatedUser | null;
  response?: TResponse;
  error?: string;
  errorCode?: AuthErrorCode;
}

// ===== PLATFORM-SPECIFIC TYPES =====

// Next.js specific
export interface NextAuthRequest {
  headers: {
    get(name: string): string | null;
  };
}

export interface NextAuthResponse {
  json(data: any, init?: { status?: number }): any;
}

// Azure Functions specific
export interface AzureContext {
  log: {
    info: (message: string) => void;
    warn: (message: string) => void;
    error: (message: string) => void;
  };
  res?: any;
}

export interface AzureRequest {
  headers: Record<string, string>;
  body?: any;
  query?: Record<string, string>;
}

// Express.js specific
export interface ExpressRequest {
  headers: Record<string, string>;
  user?: AuthenticatedUser;
}

export interface ExpressResponse {
  status(code: number): ExpressResponse;
  json(data: any): ExpressResponse;
}

export interface ExpressNext {
  (error?: any): void;
}

// ===== UTILITY TYPES =====

export type TokenProvider = 'firebase' | 'azure' | 'jwt' | 'custom';

export interface TokenInfo {
  provider: TokenProvider;
  value: string;
  expiresAt?: Date;
  userId?: string;
  claims?: Record<string, any>;
}

export interface AuthMetrics {
  totalRequests: number;
  successfulAuth: number;
  failedAuth: number;
  averageVerificationTime: number;
  errorsByCode: Partial<Record<AuthErrorCode, number>>;
}

// ===== TYPE GUARDS =====

export function isAuthenticatedUser(obj: any): obj is AuthenticatedUser {
  return obj && typeof obj === 'object' && typeof obj.uid === 'string';
}

export function isAuthError(error: any): error is AuthError {
  return error instanceof Error && 'code' in error && Object.values(AuthErrorCode).includes(error.code as AuthErrorCode);
}

export function isTokenInfo(obj: any): obj is TokenInfo {
  return obj && typeof obj === 'object' && typeof obj.provider === 'string' && typeof obj.value === 'string';
}
