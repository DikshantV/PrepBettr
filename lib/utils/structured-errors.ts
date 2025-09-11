/**
 * Structured Error System for PrepBettr
 * 
 * Provides consistent error handling with standardized error codes,
 * retry hints, and structured response formats across all API routes.
 * 
 * Features:
 * - Standardized error codes with categories
 * - Retry hints and backoff strategies
 * - Structured API response format
 * - Client-friendly error messages
 * - Logging integration
 * 
 * @version 1.0.0
 */

import { logServerError } from '@/lib/errors';

// ===== ERROR CATEGORIES =====

export enum ErrorCategory {
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION', 
  VALIDATION = 'VALIDATION',
  RATE_LIMIT = 'RATE_LIMIT',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  EXTERNAL_SERVICE = 'EXTERNAL_SERVICE',
  CONFIGURATION = 'CONFIGURATION',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  INTERNAL = 'INTERNAL'
}

// ===== ERROR CODES =====

export enum ErrorCode {
  // Authentication errors (4xx)
  AUTH_TOKEN_MISSING = 'AUTH_TOKEN_MISSING',
  AUTH_TOKEN_INVALID = 'AUTH_TOKEN_INVALID',
  AUTH_TOKEN_EXPIRED = 'AUTH_TOKEN_EXPIRED',
  AUTH_SESSION_EXPIRED = 'AUTH_SESSION_EXPIRED',
  
  // Authorization errors (4xx)
  ACCESS_DENIED = 'ACCESS_DENIED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  LICENSE_REQUIRED = 'LICENSE_REQUIRED',
  
  // Validation errors (4xx)
  INVALID_REQUEST = 'INVALID_REQUEST',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_PARAMETER = 'INVALID_PARAMETER',
  
  // Rate limiting (4xx)
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  CONCURRENT_REQUEST_LIMIT = 'CONCURRENT_REQUEST_LIMIT',
  
  // Resource errors (4xx)
  NOT_FOUND = 'NOT_FOUND',
  RESOURCE_CONFLICT = 'RESOURCE_CONFLICT',
  RESOURCE_LOCKED = 'RESOURCE_LOCKED',
  
  // Service errors (5xx)
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  SERVICE_TIMEOUT = 'SERVICE_TIMEOUT',
  SERVICE_OVERLOADED = 'SERVICE_OVERLOADED',
  
  // External service errors (5xx)
  AZURE_OPENAI_ERROR = 'AZURE_OPENAI_ERROR',
  AZURE_SPEECH_ERROR = 'AZURE_SPEECH_ERROR',
  FIREBASE_ERROR = 'FIREBASE_ERROR',
  STORAGE_ERROR = 'STORAGE_ERROR',
  
  // Configuration errors (5xx)
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  SERVICE_NOT_CONFIGURED = 'SERVICE_NOT_CONFIGURED',
  
  // Internal errors (5xx)
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  UNHANDLED_ERROR = 'UNHANDLED_ERROR'
}

// ===== RETRY STRATEGIES =====

export enum RetryStrategy {
  NONE = 'NONE',                    // Don't retry
  IMMEDIATE = 'IMMEDIATE',          // Retry immediately
  LINEAR = 'LINEAR',                // Linear backoff (1s, 2s, 3s...)
  EXPONENTIAL = 'EXPONENTIAL',      // Exponential backoff (1s, 2s, 4s, 8s...)
  EXPONENTIAL_JITTER = 'EXPONENTIAL_JITTER'  // Exponential with random jitter
}

// ===== TYPE DEFINITIONS =====

export interface StructuredError {
  code: ErrorCode;
  category: ErrorCategory;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
  requestId?: string;
  retryable: boolean;
  retryStrategy?: RetryStrategy;
  retryAfter?: number; // Seconds
  maxRetries?: number;
}

export interface APIErrorResponse {
  error: StructuredError;
  success: false;
  data: null;
}

export interface APISuccessResponse<T = any> {
  error: null;
  success: true;
  data: T;
}

export type APIResponse<T = any> = APISuccessResponse<T> | APIErrorResponse;

// ===== ERROR DEFINITIONS =====

const ERROR_DEFINITIONS: Record<ErrorCode, Omit<StructuredError, 'timestamp' | 'requestId'>> = {
  // Authentication errors
  [ErrorCode.AUTH_TOKEN_MISSING]: {
    code: ErrorCode.AUTH_TOKEN_MISSING,
    category: ErrorCategory.AUTHENTICATION,
    message: 'Authentication token is required but was not provided.',
    retryable: false
  },
  [ErrorCode.AUTH_TOKEN_INVALID]: {
    code: ErrorCode.AUTH_TOKEN_INVALID,
    category: ErrorCategory.AUTHENTICATION,
    message: 'The provided authentication token is invalid.',
    retryable: false
  },
  [ErrorCode.AUTH_TOKEN_EXPIRED]: {
    code: ErrorCode.AUTH_TOKEN_EXPIRED,
    category: ErrorCategory.AUTHENTICATION,
    message: 'Authentication token has expired. Please sign in again.',
    retryable: false
  },
  [ErrorCode.AUTH_SESSION_EXPIRED]: {
    code: ErrorCode.AUTH_SESSION_EXPIRED,
    category: ErrorCategory.AUTHENTICATION,
    message: 'Your session has expired. Please sign in again.',
    retryable: false
  },
  
  // Authorization errors
  [ErrorCode.ACCESS_DENIED]: {
    code: ErrorCode.ACCESS_DENIED,
    category: ErrorCategory.AUTHORIZATION,
    message: 'Access denied. You do not have permission to perform this action.',
    retryable: false
  },
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: {
    code: ErrorCode.INSUFFICIENT_PERMISSIONS,
    category: ErrorCategory.AUTHORIZATION,
    message: 'Insufficient permissions to access this resource.',
    retryable: false
  },
  [ErrorCode.QUOTA_EXCEEDED]: {
    code: ErrorCode.QUOTA_EXCEEDED,
    category: ErrorCategory.AUTHORIZATION,
    message: 'Usage quota exceeded. Please upgrade your plan or wait for quota reset.',
    retryable: false
  },
  [ErrorCode.LICENSE_REQUIRED]: {
    code: ErrorCode.LICENSE_REQUIRED,
    category: ErrorCategory.AUTHORIZATION,
    message: 'A valid license is required to access this feature.',
    retryable: false
  },
  
  // Validation errors
  [ErrorCode.INVALID_REQUEST]: {
    code: ErrorCode.INVALID_REQUEST,
    category: ErrorCategory.VALIDATION,
    message: 'The request is invalid or malformed.',
    retryable: false
  },
  [ErrorCode.MISSING_REQUIRED_FIELD]: {
    code: ErrorCode.MISSING_REQUIRED_FIELD,
    category: ErrorCategory.VALIDATION,
    message: 'Required field is missing from the request.',
    retryable: false
  },
  [ErrorCode.INVALID_FILE_TYPE]: {
    code: ErrorCode.INVALID_FILE_TYPE,
    category: ErrorCategory.VALIDATION,
    message: 'Invalid file type. Please upload a supported file format.',
    retryable: false
  },
  [ErrorCode.FILE_TOO_LARGE]: {
    code: ErrorCode.FILE_TOO_LARGE,
    category: ErrorCategory.VALIDATION,
    message: 'File size exceeds the maximum allowed limit.',
    retryable: false
  },
  [ErrorCode.INVALID_PARAMETER]: {
    code: ErrorCode.INVALID_PARAMETER,
    category: ErrorCategory.VALIDATION,
    message: 'One or more parameters are invalid.',
    retryable: false
  },
  
  // Rate limiting
  [ErrorCode.RATE_LIMIT_EXCEEDED]: {
    code: ErrorCode.RATE_LIMIT_EXCEEDED,
    category: ErrorCategory.RATE_LIMIT,
    message: 'Rate limit exceeded. Please try again later.',
    retryable: true,
    retryStrategy: RetryStrategy.EXPONENTIAL,
    retryAfter: 60,
    maxRetries: 3
  },
  [ErrorCode.CONCURRENT_REQUEST_LIMIT]: {
    code: ErrorCode.CONCURRENT_REQUEST_LIMIT,
    category: ErrorCategory.RATE_LIMIT,
    message: 'Too many concurrent requests. Please wait and try again.',
    retryable: true,
    retryStrategy: RetryStrategy.LINEAR,
    retryAfter: 5,
    maxRetries: 5
  },
  
  // Resource errors
  [ErrorCode.NOT_FOUND]: {
    code: ErrorCode.NOT_FOUND,
    category: ErrorCategory.NOT_FOUND,
    message: 'The requested resource was not found.',
    retryable: false
  },
  [ErrorCode.RESOURCE_CONFLICT]: {
    code: ErrorCode.RESOURCE_CONFLICT,
    category: ErrorCategory.CONFLICT,
    message: 'Resource conflict. The resource is in an inconsistent state.',
    retryable: true,
    retryStrategy: RetryStrategy.LINEAR,
    retryAfter: 2,
    maxRetries: 3
  },
  [ErrorCode.RESOURCE_LOCKED]: {
    code: ErrorCode.RESOURCE_LOCKED,
    category: ErrorCategory.CONFLICT,
    message: 'Resource is currently locked by another process.',
    retryable: true,
    retryStrategy: RetryStrategy.EXPONENTIAL,
    retryAfter: 5,
    maxRetries: 3
  },
  
  // Service errors
  [ErrorCode.SERVICE_UNAVAILABLE]: {
    code: ErrorCode.SERVICE_UNAVAILABLE,
    category: ErrorCategory.SERVICE_UNAVAILABLE,
    message: 'Service is temporarily unavailable. Please try again later.',
    retryable: true,
    retryStrategy: RetryStrategy.EXPONENTIAL,
    retryAfter: 30,
    maxRetries: 3
  },
  [ErrorCode.SERVICE_TIMEOUT]: {
    code: ErrorCode.SERVICE_TIMEOUT,
    category: ErrorCategory.SERVICE_UNAVAILABLE,
    message: 'Service request timed out. Please try again.',
    retryable: true,
    retryStrategy: RetryStrategy.LINEAR,
    retryAfter: 10,
    maxRetries: 2
  },
  [ErrorCode.SERVICE_OVERLOADED]: {
    code: ErrorCode.SERVICE_OVERLOADED,
    category: ErrorCategory.SERVICE_UNAVAILABLE,
    message: 'Service is currently overloaded. Please try again later.',
    retryable: true,
    retryStrategy: RetryStrategy.EXPONENTIAL_JITTER,
    retryAfter: 60,
    maxRetries: 3
  },
  
  // External service errors
  [ErrorCode.AZURE_OPENAI_ERROR]: {
    code: ErrorCode.AZURE_OPENAI_ERROR,
    category: ErrorCategory.EXTERNAL_SERVICE,
    message: 'Azure OpenAI service error. Please try again.',
    retryable: true,
    retryStrategy: RetryStrategy.EXPONENTIAL,
    retryAfter: 5,
    maxRetries: 3
  },
  [ErrorCode.AZURE_SPEECH_ERROR]: {
    code: ErrorCode.AZURE_SPEECH_ERROR,
    category: ErrorCategory.EXTERNAL_SERVICE,
    message: 'Azure Speech service error. Please try again.',
    retryable: true,
    retryStrategy: RetryStrategy.EXPONENTIAL,
    retryAfter: 5,
    maxRetries: 3
  },
  [ErrorCode.FIREBASE_ERROR]: {
    code: ErrorCode.FIREBASE_ERROR,
    category: ErrorCategory.EXTERNAL_SERVICE,
    message: 'Firebase service error. Please try again.',
    retryable: true,
    retryStrategy: RetryStrategy.LINEAR,
    retryAfter: 10,
    maxRetries: 2
  },
  [ErrorCode.STORAGE_ERROR]: {
    code: ErrorCode.STORAGE_ERROR,
    category: ErrorCategory.EXTERNAL_SERVICE,
    message: 'File storage error. Please try again.',
    retryable: true,
    retryStrategy: RetryStrategy.EXPONENTIAL,
    retryAfter: 15,
    maxRetries: 3
  },
  
  // Configuration errors
  [ErrorCode.CONFIGURATION_ERROR]: {
    code: ErrorCode.CONFIGURATION_ERROR,
    category: ErrorCategory.CONFIGURATION,
    message: 'Service configuration error. Please contact support.',
    retryable: false
  },
  [ErrorCode.SERVICE_NOT_CONFIGURED]: {
    code: ErrorCode.SERVICE_NOT_CONFIGURED,
    category: ErrorCategory.CONFIGURATION,
    message: 'Service is not properly configured. Please contact support.',
    retryable: false
  },
  
  // Internal errors
  [ErrorCode.INTERNAL_SERVER_ERROR]: {
    code: ErrorCode.INTERNAL_SERVER_ERROR,
    category: ErrorCategory.INTERNAL,
    message: 'An internal server error occurred. Please try again later.',
    retryable: true,
    retryStrategy: RetryStrategy.EXPONENTIAL,
    retryAfter: 30,
    maxRetries: 2
  },
  [ErrorCode.UNHANDLED_ERROR]: {
    code: ErrorCode.UNHANDLED_ERROR,
    category: ErrorCategory.INTERNAL,
    message: 'An unexpected error occurred. Please try again later.',
    retryable: true,
    retryStrategy: RetryStrategy.LINEAR,
    retryAfter: 10,
    maxRetries: 1
  }
};

// ===== ERROR FACTORY FUNCTIONS =====

/**
 * Create a structured error with optional details
 */
export function createStructuredError(
  code: ErrorCode,
  details?: Record<string, any>,
  customMessage?: string,
  requestId?: string
): StructuredError {
  const definition = ERROR_DEFINITIONS[code];
  
  return {
    ...definition,
    message: customMessage || definition.message,
    details,
    timestamp: new Date().toISOString(),
    requestId
  };
}

/**
 * Create an API error response
 */
export function createErrorResponse(
  code: ErrorCode,
  details?: Record<string, any>,
  customMessage?: string,
  requestId?: string
): APIErrorResponse {
  const error = createStructuredError(code, details, customMessage, requestId);
  
  // Log server errors for monitoring
  if (error.category === ErrorCategory.INTERNAL || 
      error.category === ErrorCategory.EXTERNAL_SERVICE ||
      error.category === ErrorCategory.CONFIGURATION) {
    logServerError(new Error(error.message), {
      errorCode: error.code,
      category: error.category,
      details: error.details,
      requestId: error.requestId
    });
  }
  
  return {
    error,
    success: false,
    data: null
  };
}

/**
 * Create a success API response
 */
export function createSuccessResponse<T>(data: T): APISuccessResponse<T> {
  return {
    error: null,
    success: true,
    data
  };
}

/**
 * Convert HTTP status to appropriate error code
 */
export function getErrorCodeFromHTTPStatus(status: number): ErrorCode {
  switch (status) {
    case 400: return ErrorCode.INVALID_REQUEST;
    case 401: return ErrorCode.AUTH_TOKEN_INVALID;
    case 403: return ErrorCode.ACCESS_DENIED;
    case 404: return ErrorCode.NOT_FOUND;
    case 409: return ErrorCode.RESOURCE_CONFLICT;
    case 413: return ErrorCode.FILE_TOO_LARGE;
    case 429: return ErrorCode.RATE_LIMIT_EXCEEDED;
    case 500: return ErrorCode.INTERNAL_SERVER_ERROR;
    case 502: return ErrorCode.SERVICE_UNAVAILABLE;
    case 503: return ErrorCode.SERVICE_OVERLOADED;
    case 504: return ErrorCode.SERVICE_TIMEOUT;
    default: return ErrorCode.UNHANDLED_ERROR;
  }
}

/**
 * Get HTTP status from error code
 */
export function getHTTPStatusFromErrorCode(code: ErrorCode): number {
  const error = ERROR_DEFINITIONS[code];
  
  switch (error.category) {
    case ErrorCategory.AUTHENTICATION:
      return 401;
    case ErrorCategory.AUTHORIZATION:
      return 403;
    case ErrorCategory.VALIDATION:
      return 400;
    case ErrorCategory.RATE_LIMIT:
      return 429;
    case ErrorCategory.NOT_FOUND:
      return 404;
    case ErrorCategory.CONFLICT:
      return 409;
    case ErrorCategory.SERVICE_UNAVAILABLE:
    case ErrorCategory.EXTERNAL_SERVICE:
      return 503;
    case ErrorCategory.CONFIGURATION:
    case ErrorCategory.INTERNAL:
    default:
      return 500;
  }
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: StructuredError): boolean {
  return error.retryable === true;
}

/**
 * Get retry delay in milliseconds based on attempt number
 */
export function getRetryDelay(
  error: StructuredError, 
  attemptNumber: number,
  baseDelay?: number
): number {
  const base = baseDelay || (error.retryAfter || 1) * 1000; // Convert to milliseconds
  
  switch (error.retryStrategy) {
    case RetryStrategy.IMMEDIATE:
      return 0;
    
    case RetryStrategy.LINEAR:
      return base * attemptNumber;
    
    case RetryStrategy.EXPONENTIAL:
      return base * Math.pow(2, attemptNumber - 1);
    
    case RetryStrategy.EXPONENTIAL_JITTER:
      const exponentialDelay = base * Math.pow(2, attemptNumber - 1);
      const jitter = Math.random() * 0.1 * exponentialDelay; // ±10% jitter
      return exponentialDelay + jitter;
    
    case RetryStrategy.NONE:
    default:
      return base;
  }
}

/**
 * Convert unknown error to structured error
 */
export function toStructuredError(
  error: unknown,
  defaultCode: ErrorCode = ErrorCode.UNHANDLED_ERROR,
  requestId?: string
): StructuredError {
  if (error && typeof error === 'object' && 'code' in error) {
    // Already a structured error
    return error as StructuredError;
  }
  
  if (error instanceof Error) {
    return createStructuredError(
      defaultCode,
      { originalMessage: error.message, stack: error.stack },
      error.message,
      requestId
    );
  }
  
  return createStructuredError(
    defaultCode,
    { originalError: String(error) },
    String(error),
    requestId
  );
}

// ===== NEXT.JS RESPONSE HELPERS =====

/**
 * Send a structured error response in Next.js API routes
 */
export function sendErrorResponse(
  res: any, // NextResponse or Response
  code: ErrorCode,
  details?: Record<string, any>,
  customMessage?: string,
  requestId?: string
) {
  const errorResponse = createErrorResponse(code, details, customMessage, requestId);
  const status = getHTTPStatusFromErrorCode(code);
  
  // Set retry headers if applicable
  if (errorResponse.error.retryable && errorResponse.error.retryAfter) {
    res.headers.set('X-Retry-After', String(errorResponse.error.retryAfter));
    res.headers.set('Retry-After', String(errorResponse.error.retryAfter));
  }
  
  return new Response(JSON.stringify(errorResponse), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...Object.fromEntries(res.headers || [])
    }
  });
}

/**
 * Send a structured success response in Next.js API routes
 */
export function sendSuccessResponse<T>(data: T, status: number = 200) {
  const successResponse = createSuccessResponse(data);
  
  return new Response(JSON.stringify(successResponse), {
    status,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}
