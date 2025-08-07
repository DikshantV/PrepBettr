import { NextRequest, NextResponse } from 'next/server';
import { ApplicationInsights } from '@microsoft/applicationinsights-web';

export interface ErrorDetails {
  userId?: string;
  jobId?: string;
  action?: string;
  requestId?: string;
  userAgent?: string;
  path?: string;
  method?: string;
  statusCode?: number;
  stack?: string;
  timestamp: string;
}

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  isOperational?: boolean;
}

export class ErrorHandler {
  private static appInsights?: ApplicationInsights;

  static initialize(instrumentationKey?: string) {
    if (instrumentationKey && typeof window !== 'undefined') {
      this.appInsights = new ApplicationInsights({
        config: {
          instrumentationKey,
          enableAutoRouteTracking: false,
        }
      });
      this.appInsights.loadAppInsights();
    }
  }

  /**
   * Global error handler middleware for Next.js API routes
   */
  static withErrorHandler(
    handler: (req: NextRequest) => Promise<NextResponse>
  ) {
    return async (req: NextRequest): Promise<NextResponse> => {
      try {
        return await handler(req);
      } catch (error) {
        return this.handleError(error, req);
      }
    };
  }

  /**
   * Handle and log errors with structured logging
   */
  static handleError(error: any, req?: NextRequest): NextResponse {
    const apiError = this.normalizeError(error);
    const errorDetails = this.extractErrorDetails(apiError, req);

    // Log the error
    this.logError(apiError, errorDetails);

    // Return appropriate response
    return this.createErrorResponse(apiError, errorDetails);
  }

  /**
   * Normalize different error types to ApiError
   */
  private static normalizeError(error: any): ApiError {
    // Already an ApiError
    if (error.statusCode && error.isOperational !== undefined) {
      return error;
    }

    // Network/HTTP errors
    if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND') {
      return {
        name: 'NetworkError',
        message: 'Network connection failed',
        statusCode: 503,
        code: error.code,
        isOperational: true,
        stack: error.stack
      };
    }

    // Validation errors
    if (error.name === 'ValidationError' || error.name === 'ZodError') {
      return {
        name: 'ValidationError',
        message: error.message || 'Validation failed',
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        isOperational: true,
        stack: error.stack
      };
    }

    // Authentication errors
    if (error.message?.includes('unauthorized') || error.message?.includes('token')) {
      return {
        name: 'AuthenticationError',
        message: 'Authentication failed',
        statusCode: 401,
        code: 'AUTH_ERROR',
        isOperational: true,
        stack: error.stack
      };
    }

    // Rate limiting errors
    if (error.message?.includes('rate limit') || error.message?.includes('throttled')) {
      return {
        name: 'RateLimitError',
        message: 'Rate limit exceeded',
        statusCode: 429,
        code: 'RATE_LIMIT_ERROR',
        isOperational: true,
        stack: error.stack
      };
    }

    // External service errors (Azure OpenAI, etc.)
    if (error.message?.includes('Azure OpenAI') || error.message?.includes('OpenAI')) {
      return {
        name: 'ExternalServiceError',
        message: 'External AI service error',
        statusCode: 502,
        code: 'AI_SERVICE_ERROR',
        isOperational: true,
        stack: error.stack
      };
    }

    // Default to internal server error
    return {
      name: error.name || 'InternalError',
      message: error.message || 'An internal server error occurred',
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      isOperational: false,
      stack: error.stack
    };
  }

  /**
   * Extract error details from request and error
   */
  private static extractErrorDetails(error: ApiError, req?: NextRequest): ErrorDetails {
    const url = req?.url ? new URL(req.url) : undefined;
    const headers = req?.headers;

    return {
      userId: this.extractUserId(req),
      jobId: this.extractJobId(req),
      action: url?.pathname || 'unknown',
      requestId: headers?.get('x-request-id') || undefined,
      userAgent: headers?.get('user-agent') || undefined,
      path: url?.pathname || undefined,
      method: req?.method || undefined,
      statusCode: error.statusCode || 500,
      stack: error.stack,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Extract user ID from request (cookies, headers, or body)
   */
  private static extractUserId(req?: NextRequest): string | undefined {
    if (!req) return undefined;

    // Try to get from cookies first
    const sessionCookie = req.cookies.get('session')?.value;
    if (sessionCookie) {
      try {
        // In a real implementation, you'd decode the session token
        // For now, we'll just note that there's a session
        return 'user_from_session';
      } catch {
        // Failed to decode session
      }
    }

    // Try to get from headers
    const userIdHeader = req.headers.get('x-user-id');
    if (userIdHeader) {
      return userIdHeader;
    }

    return undefined;
  }

  /**
   * Extract job ID from request path or body
   */
  private static extractJobId(req?: NextRequest): string | undefined {
    if (!req) return undefined;

    const url = req.url ? new URL(req.url) : undefined;
    
    // Try to extract from path
    const pathMatch = url?.pathname.match(/\/jobs\/([^\/]+)/);
    if (pathMatch) {
      return pathMatch[1];
    }

    // Try to extract from query parameters
    const jobId = url?.searchParams.get('jobId');
    if (jobId) {
      return jobId;
    }

    return undefined;
  }

  /**
   * Log error with structured logging
   */
  private static logError(error: ApiError, details: ErrorDetails): void {
    const logData = {
      level: 'error',
      message: `API Error: ${error.message}`,
      properties: {
        errorName: error.name,
        errorCode: error.code,
        statusCode: error.statusCode,
        isOperational: error.isOperational,
        userId: details.userId,
        jobId: details.jobId,
        action: details.action,
        requestId: details.requestId,
        userAgent: details.userAgent,
        path: details.path,
        method: details.method,
        timestamp: details.timestamp
      },
      exception: {
        message: error.message,
        stack: error.stack,
        name: error.name
      }
    };

    // Log to console with structured format
    console.error('API_ERROR', JSON.stringify(logData));

    // Send to Application Insights if available
    if (this.appInsights) {
      this.appInsights.trackException({
        exception: error,
        properties: logData.properties,
        severityLevel: error.isOperational ? 2 : 3 // Warning for operational, Error for programming errors
      });

      // Track custom metric for error rates
      this.appInsights.trackMetric({
        name: 'ApiError',
        average: 1,
        sampleCount: 1,
        properties: {
          errorCode: error.code || 'unknown',
          statusCode: error.statusCode?.toString() || '500',
          action: details.action || 'unknown'
        }
      });
    }
  }

  /**
   * Create appropriate error response
   */
  private static createErrorResponse(error: ApiError, details: ErrorDetails): NextResponse {
    const response = {
      error: {
        message: error.isOperational ? error.message : 'An internal server error occurred',
        code: error.code || 'INTERNAL_ERROR',
        timestamp: details.timestamp,
        requestId: details.requestId
      }
    };

    // Don't expose internal error details in production
    if (process.env.NODE_ENV !== 'production' && !error.isOperational) {
      response.error['details'] = {
        stack: error.stack,
        originalMessage: error.message
      };
    }

    return NextResponse.json(
      response,
      {
        status: error.statusCode || 500,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': details.requestId || 'unknown'
        }
      }
    );
  }

  /**
   * Create an operational error (expected errors)
   */
  static createOperationalError(message: string, statusCode: number = 400, code?: string): ApiError {
    return {
      name: 'OperationalError',
      message,
      statusCode,
      code: code || 'OPERATIONAL_ERROR',
      isOperational: true
    };
  }

  /**
   * Create a programming error (unexpected errors)
   */
  static createProgrammingError(message: string, originalError?: Error): ApiError {
    return {
      name: 'ProgrammingError',
      message,
      statusCode: 500,
      code: 'PROGRAMMING_ERROR',
      isOperational: false,
      stack: originalError?.stack
    };
  }
}

// Convenience function for wrapping API handlers
export function withErrorHandler(
  handler: (req: NextRequest) => Promise<NextResponse>
) {
  return ErrorHandler.withErrorHandler(handler);
}

// Convenience functions for creating errors
export const createOperationalError = ErrorHandler.createOperationalError;
export const createProgrammingError = ErrorHandler.createProgrammingError;
