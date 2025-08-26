/**
 * Error handling utilities to centralize try-catch patterns
 * Reduces duplicate error handling code throughout the application
 */

import { logger } from './logger';

export interface ErrorContext {
  [key: string]: any;
}

/**
 * Standardized error reporting with context
 */
export const reportError = (
  error: Error | unknown,
  context: string,
  additionalContext?: ErrorContext
): Error => {
  const err = error instanceof Error ? error : new Error(String(error));
  logger.error(`${context}: ${err.message}`, err, additionalContext);
  return err;
};

/**
 * Wrap async functions with standardized error handling
 */
export const handleAsyncError = async <T>(
  fn: () => Promise<T>,
  context: string,
  fallback?: T,
  additionalContext?: ErrorContext
): Promise<T | undefined> => {
  try {
    return await fn();
  } catch (error) {
    reportError(error, context, additionalContext);
    return fallback;
  }
};

/**
 * Retry wrapper with exponential backoff
 */
export const withRetry = async <T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  context: string = 'Operation',
  baseDelay: number = 1000
): Promise<T> => {
  let attempt = 0;
  
  while (attempt < maxAttempts) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      
      if (attempt >= maxAttempts) {
        throw reportError(error, `${context} failed after ${maxAttempts} attempts`);
      }
      
      const delay = Math.pow(2, attempt) * baseDelay;
      logger.warn(`${context} attempt ${attempt} failed, retrying in ${delay}ms`, { error });
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error(`${context}: Exhausted all retry attempts`);
};

/**
 * Timeout wrapper for promises
 */
export const withTimeout = <T>(
  promise: Promise<T>,
  timeoutMs: number,
  context: string = 'Operation'
): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`${context} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    })
  ]);
};

/**
 * Safe JSON parsing with error handling
 */
export const safeJsonParse = <T>(
  jsonString: string,
  fallback: T,
  context: string = 'JSON parse'
): T => {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    reportError(error, `${context} failed`, { jsonString: jsonString.slice(0, 100) });
    return fallback;
  }
};

/**
 * Network request error handler with user-friendly messages
 */
export const handleApiError = (
  response: Response,
  context: string = 'API request'
): Error => {
  const friendlyMessages: Record<number, string> = {
    400: 'Invalid request. Please check your input and try again.',
    401: 'Authentication failed. Please sign in again.',
    403: 'Access denied. You may not have permission for this action.',
    404: 'The requested resource was not found.',
    429: 'Too many requests. Please wait a moment before trying again.',
    500: 'Server error. Please try again later.',
    502: 'Service temporarily unavailable. Please try again later.',
    503: 'Service temporarily unavailable. Please try again later.'
  };
  
  const friendlyMessage = friendlyMessages[response.status] || 'An unexpected error occurred.';
  const technicalMessage = `${context}: HTTP ${response.status} ${response.statusText}`;
  
  const error = new Error(friendlyMessage);
  (error as any).technicalMessage = technicalMessage;
  (error as any).status = response.status;
  
  return error;
};

/**
 * Show user-friendly error notification (replace alert() calls)
 * This will hook into the app's existing toast system
 */
export const showErrorNotification = (
  error: Error | string,
  context?: string
): void => {
  const message = typeof error === 'string' ? error : error.message;
  const fullMessage = context ? `${context}: ${message}` : message;
  
  // Use console.warn for user notifications to reduce error noise
  logger.warn('User notification: ' + fullMessage);
  
  // TODO: Replace with actual toast notification system
  // toast.error(fullMessage);
};

/**
 * Validation error for form/input validation
 */
export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Audio processing specific error
 */
export class AudioError extends Error {
  constructor(message: string, public audioContext?: any) {
    super(message);
    this.name = 'AudioError';
  }
}
