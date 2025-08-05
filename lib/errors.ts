// lib/errors.ts

export interface StandardErrorResponse {
  error: string;
  status: number;
}

export interface ServerErrorContext {
  userId?: string;
  url: string;
  method: string;
  timestamp: string;
  userAgent?: string;
  ip?: string;
}

/**
 * Creates a standardized error response
 */
export function createErrorResponse(
  error: string,
  status: number
): StandardErrorResponse {
  return {
    error,
    status
  };
}

/**
 * Logs server errors with context but never exposes sensitive information
 */
export function logServerError(
  error: Error | string,
  context: ServerErrorContext,
  additionalContext?: Record<string, any>
): void {
  const errorMessage = error instanceof Error ? error.message : error;
  const errorStack = error instanceof Error ? error.stack : undefined;
  
  // Create safe logging context (no sensitive data)
  const safeContext = {
    timestamp: context.timestamp || new Date().toISOString(),
    url: context.url,
    method: context.method,
    userId: context.userId ? `user_${context.userId.slice(-8)}` : 'anonymous', // Only last 8 chars for privacy
    userAgent: context.userAgent ? context.userAgent.slice(0, 100) : undefined, // Truncate UA
    ip: context.ip ? context.ip.replace(/\d+$/, 'xxx') : undefined, // Mask last IP octet
    ...additionalContext
  };

  console.error('Server Error:', {
    message: errorMessage,
    context: safeContext,
    stack: errorStack
  });

  // In production, you might want to send this to a logging service
  // like DataDog, Sentry, etc.
  if (process.env.NODE_ENV === 'production') {
    // Example: Send to external logging service
    // logger.error(errorMessage, safeContext);
  }
}

/**
 * Determines if an error should be retried
 */
export function isRetryableError(status: number): boolean {
  // Retry for 5xx errors and specific 4xx errors
  return status >= 500 || status === 408 || status === 429;
}

/**
 * Maps common error types to standard error responses
 */
export function mapErrorToResponse(error: any): StandardErrorResponse {
  // Network/Connection errors
  if (error.name === 'AbortError' || error.code === 'ECONNABORTED') {
    return createErrorResponse('Request timeout. Please try again.', 408);
  }
  
  if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
    return createErrorResponse('Network error. Please check your connection.', 503);
  }

  // Azure OpenAI specific errors
  if (error.status) {
    switch (error.status) {
      case 401:
        return createErrorResponse('Service authentication failed. Please try again later.', 500);
      case 429:
        return createErrorResponse('Service temporarily unavailable due to high demand. Please try again later.', 429);
      case 400:
        return createErrorResponse('Invalid request format. Please check your input.', 400);
      default:
        if (error.status >= 500) {
          return createErrorResponse('Service temporarily unavailable. Please try again later.', 500);
        }
    }
  }

  // Generic API errors
  if (error.message) {
    if (error.message.includes('API key') || error.message.includes('credentials')) {
      return createErrorResponse('Service configuration error. Please contact support.', 500);
    }
    if (error.message.includes('quota') || error.message.includes('limit') || error.message.includes('rate')) {
      return createErrorResponse('Service temporarily unavailable due to usage limits. Please try again later.', 429);
    }
    if (error.message.includes('not initialized')) {
      return createErrorResponse('Service is not properly configured. Please contact support.', 500);
    }
  }

  // Default error response
  return createErrorResponse('An unexpected error occurred. Please try again.', 500);
}

/**
 * Standard fallback message for network failures
 */
export const NETWORK_FAILURE_MESSAGE = "Could not fetch job description from the provided URL.";

/**
 * Gets user-friendly error message for frontend display
 */
export function getUserFriendlyErrorMessage(error: any, context?: string): string {
  if (error?.error) {
    return error.error;
  }
  
  if (context === 'url_extraction') {
    return NETWORK_FAILURE_MESSAGE;
  }
  
  if (error?.message) {
    // Don't expose internal error messages to users
    if (error.message.includes('API key') || 
        error.message.includes('credentials') ||
        error.message.includes('internal') ||
        error.message.includes('database')) {
      return 'Service temporarily unavailable. Please try again later.';
    }
    return error.message;
  }

  return 'An unexpected error occurred. Please try again.';
}
