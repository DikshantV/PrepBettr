/**
 * Standardized Error Handling for PrepBettr
 * 
 * This replaces the scattered try-catch blocks and inconsistent error handling
 * throughout the codebase with a unified approach.
 * 
 * Benefits:
 * - Consistent error logging and user messaging
 * - Type-safe error handling
 * - Centralized error classification
 * - Better debugging and monitoring
 */

export abstract class AppError extends Error {
  public readonly timestamp: Date;
  public readonly correlationId: string;

  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly userMessage?: string,
    public readonly context?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date();
    this.correlationId = this.generateCorrelationId();
    
    // Ensure stack trace is captured
    Error.captureStackTrace(this, this.constructor);
  }

  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get sanitized error for client response
   */
  public toClientSafe() {
    return {
      code: this.code,
      message: this.userMessage || 'An error occurred',
      correlationId: this.correlationId,
      timestamp: this.timestamp
    };
  }

  /**
   * Get full error details for logging
   */
  public toLogEntry() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      userMessage: this.userMessage,
      statusCode: this.statusCode,
      correlationId: this.correlationId,
      timestamp: this.timestamp,
      context: this.context,
      stack: this.stack
    };
  }
}

/**
 * Authentication and authorization errors
 */
export class AuthError extends AppError {
  constructor(
    message: string, 
    userMessage = 'Authentication failed. Please sign in again.',
    context?: Record<string, any>
  ) {
    super(message, 'AUTH_ERROR', 401, userMessage, context);
  }
}

export class AuthorizationError extends AppError {
  constructor(
    resource: string,
    action: string,
    userMessage = 'You do not have permission to perform this action.'
  ) {
    super(
      `Access denied for ${action} on ${resource}`,
      'AUTHORIZATION_ERROR',
      403,
      userMessage,
      { resource, action }
    );
  }
}

/**
 * Input validation errors
 */
export class ValidationError extends AppError {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly value?: any
  ) {
    super(
      message,
      'VALIDATION_ERROR',
      400,
      'Invalid input provided. Please check your data and try again.',
      { field, value }
    );
  }
}

export class BusinessRuleError extends AppError {
  constructor(
    rule: string,
    message: string,
    userMessage?: string
  ) {
    super(
      `Business rule violation: ${rule} - ${message}`,
      'BUSINESS_RULE_ERROR',
      422,
      userMessage || 'This action violates a business rule.',
      { rule }
    );
  }
}

/**
 * External service integration errors
 */
export class ExternalServiceError extends AppError {
  constructor(
    service: string,
    operation: string,
    message: string,
    public readonly originalError?: Error,
    statusCode: number = 502
  ) {
    super(
      `${service} ${operation} failed: ${message}`,
      'EXTERNAL_SERVICE_ERROR',
      statusCode,
      'A required service is temporarily unavailable. Please try again later.',
      { service, operation, originalError: originalError?.message }
    );
  }
}

export class AzureServiceError extends ExternalServiceError {
  constructor(
    service: string,
    operation: string,
    message: string,
    originalError?: Error
  ) {
    super(`Azure ${service}`, operation, message, originalError);
    this.code = 'AZURE_SERVICE_ERROR';
  }
}

export class FirebaseServiceError extends ExternalServiceError {
  constructor(
    service: string,
    operation: string,
    message: string,
    originalError?: Error
  ) {
    super(`Firebase ${service}`, operation, message, originalError);
    this.code = 'FIREBASE_SERVICE_ERROR';
  }
}

/**
 * Resource not found errors
 */
export class NotFoundError extends AppError {
  constructor(
    resource: string,
    identifier: string | number,
    userMessage?: string
  ) {
    super(
      `${resource} with ID ${identifier} not found`,
      'NOT_FOUND_ERROR',
      404,
      userMessage || `The requested ${resource.toLowerCase()} was not found.`,
      { resource, identifier }
    );
  }
}

/**
 * Rate limiting and quota errors
 */
export class RateLimitError extends AppError {
  constructor(
    operation: string,
    limit: number,
    resetTime?: Date,
    userMessage?: string
  ) {
    super(
      `Rate limit exceeded for ${operation}: ${limit} requests`,
      'RATE_LIMIT_ERROR',
      429,
      userMessage || 'Too many requests. Please wait before trying again.',
      { operation, limit, resetTime }
    );
  }
}

export class QuotaExceededError extends AppError {
  constructor(
    resource: string,
    current: number,
    limit: number,
    userMessage?: string
  ) {
    super(
      `Quota exceeded for ${resource}: ${current}/${limit}`,
      'QUOTA_EXCEEDED_ERROR',
      429,
      userMessage || `You have reached your ${resource} limit. Please upgrade to continue.`,
      { resource, current, limit }
    );
  }
}

/**
 * Processing and workflow errors
 */
export class ProcessingError extends AppError {
  constructor(
    operation: string,
    message: string,
    userMessage?: string,
    context?: Record<string, any>
  ) {
    super(
      `Processing failed for ${operation}: ${message}`,
      'PROCESSING_ERROR',
      422,
      userMessage || 'Processing failed. Please try again.',
      { operation, ...context }
    );
  }
}

export class InterviewError extends ProcessingError {
  constructor(
    message: string,
    userMessage?: string,
    context?: Record<string, any>
  ) {
    super('interview', message, userMessage, context);
    this.code = 'INTERVIEW_ERROR';
  }
}

export class ResumeProcessingError extends ProcessingError {
  constructor(
    message: string,
    userMessage?: string,
    context?: Record<string, any>
  ) {
    super('resume processing', message, userMessage, context);
    this.code = 'RESUME_PROCESSING_ERROR';
  }
}

/**
 * Configuration and environment errors
 */
export class ConfigurationError extends AppError {
  constructor(
    setting: string,
    message: string
  ) {
    super(
      `Configuration error for ${setting}: ${message}`,
      'CONFIGURATION_ERROR',
      500,
      'Service configuration error. Please contact support.',
      { setting }
    );
  }
}

/**
 * Database and persistence errors
 */
export class DatabaseError extends AppError {
  constructor(
    operation: string,
    message: string,
    originalError?: Error
  ) {
    super(
      `Database ${operation} failed: ${message}`,
      'DATABASE_ERROR',
      500,
      'Database operation failed. Please try again.',
      { operation, originalError: originalError?.message }
    );
  }
}

/**
 * Error factory for wrapping unknown errors
 */
export class ErrorFactory {
  static wrap(error: unknown, context?: string): AppError {
    // Already an AppError
    if (error instanceof AppError) {
      return error;
    }

    // Standard Error object
    if (error instanceof Error) {
      return new ProcessingError(
        context || 'unknown operation',
        error.message,
        undefined,
        { originalError: error.message, stack: error.stack }
      );
    }

    // String error
    if (typeof error === 'string') {
      return new ProcessingError(
        context || 'unknown operation',
        error
      );
    }

    // Unknown error type
    return new ProcessingError(
      context || 'unknown operation',
      'An unknown error occurred',
      undefined,
      { originalError: String(error) }
    );
  }

  static createFromHttpStatus(
    status: number,
    message: string,
    context?: Record<string, any>
  ): AppError {
    switch (status) {
      case 400:
        return new ValidationError(message);
      case 401:
        return new AuthError(message);
      case 403:
        return new AuthorizationError(
          context?.resource || 'resource',
          context?.action || 'action'
        );
      case 404:
        return new NotFoundError(
          context?.resource || 'resource',
          context?.identifier || 'unknown'
        );
      case 429:
        return new RateLimitError(
          context?.operation || 'operation',
          context?.limit || 100
        );
      case 500:
      default:
        return new ProcessingError(
          context?.operation || 'operation',
          message
        );
    }
  }
}