const { nanoid } = require('nanoid');

/**
 * Error details for Azure Functions
 */
class FunctionErrorDetails {
  constructor(error, context, req) {
    this.errorId = nanoid();
    this.timestamp = new Date().toISOString();
    this.functionName = context?.functionName || 'unknown';
    this.invocationId = context?.invocationId || nanoid();
    this.executionId = context?.executionContext?.invocationId || this.invocationId;
    
    // Extract request details if available
    if (req) {
      this.method = req.method;
      this.url = req.url;
      this.userId = this.extractUserId(req);
      this.jobId = this.extractJobId(req);
      this.userAgent = req.headers['user-agent'];
      this.requestId = req.headers['x-request-id'] || this.errorId;
    }

    // Error details
    this.errorName = error.name || 'UnknownError';
    this.errorMessage = error.message || 'An unknown error occurred';
    this.errorCode = error.code;
    this.statusCode = error.statusCode || 500;
    this.stack = error.stack;
    this.isOperational = error.isOperational || false;
  }

  extractUserId(req) {
    // Try to extract from headers, query params, or body
    return req.headers['x-user-id'] || 
           req.query?.userId || 
           req.body?.userId ||
           'anonymous';
  }

  extractJobId(req) {
    // Try to extract from different sources
    const pathMatch = req.url?.match(/\/jobs\/([^\/\?]+)/);
    if (pathMatch) return pathMatch[1];
    
    return req.query?.jobId || 
           req.body?.jobId ||
           req.headers['x-job-id'];
  }
}

/**
 * Azure Function Error Handler
 */
class FunctionErrorHandler {
  
  /**
   * Wrap Azure Function handler with error handling
   */
  static withErrorHandler(handler) {
    return async (context, req) => {
      const startTime = Date.now();
      let result;
      
      try {
        // Add request ID if not present
        if (req && !req.headers['x-request-id']) {
          req.headers['x-request-id'] = nanoid();
        }

        // Execute the handler
        result = await handler(context, req);
        
        // Log successful execution
        this.logSuccess(context, req, Date.now() - startTime);
        
        return result;
      } catch (error) {
        // Handle the error
        const errorDetails = new FunctionErrorDetails(error, context, req);
        
        // Log the error
        this.logError(errorDetails);
        
        // Create appropriate response
        const response = this.createErrorResponse(errorDetails);
        
        // Set the response on the context
        context.res = response;
        
        return response;
      }
    };
  }

  /**
   * Log successful function execution
   */
  static logSuccess(context, req, duration) {
    const logData = {
      level: 'info',
      message: `Function ${context.functionName} completed successfully`,
      properties: {
        functionName: context.functionName,
        invocationId: context.invocationId,
        duration,
        method: req?.method,
        url: req?.url,
        statusCode: context.res?.status || 200,
        timestamp: new Date().toISOString()
      }
    };

    console.log('FUNCTION_SUCCESS', JSON.stringify(logData));

    // Send to Application Insights if available
    if (process.env.APPINSIGHTS_INSTRUMENTATIONKEY) {
      this.sendToApplicationInsights('success', logData);
    }
  }

  /**
   * Log error with structured logging
   */
  static logError(errorDetails) {
    const logData = {
      level: 'error',
      message: `Function ${errorDetails.functionName} failed: ${errorDetails.errorMessage}`,
      properties: {
        errorId: errorDetails.errorId,
        functionName: errorDetails.functionName,
        invocationId: errorDetails.invocationId,
        executionId: errorDetails.executionId,
        errorName: errorDetails.errorName,
        errorCode: errorDetails.errorCode,
        statusCode: errorDetails.statusCode,
        isOperational: errorDetails.isOperational,
        userId: errorDetails.userId,
        jobId: errorDetails.jobId,
        method: errorDetails.method,
        url: errorDetails.url,
        userAgent: errorDetails.userAgent,
        requestId: errorDetails.requestId,
        timestamp: errorDetails.timestamp
      },
      exception: {
        message: errorDetails.errorMessage,
        stack: errorDetails.stack,
        name: errorDetails.errorName
      }
    };

    // Log to console with structured format
    console.error('FUNCTION_ERROR', JSON.stringify(logData));

    // Send to Application Insights if available
    if (process.env.APPINSIGHTS_INSTRUMENTATIONKEY) {
      this.sendToApplicationInsights('error', logData, errorDetails);
    }
  }

  /**
   * Send log data to Application Insights
   */
  static sendToApplicationInsights(type, logData, errorDetails = null) {
    try {
      // Use console methods that Application Insights captures
      if (type === 'error' && errorDetails) {
        const telemetry = {
          name: 'FunctionError',
          properties: logData.properties,
          measurements: {
            errorCount: 1,
            statusCode: errorDetails.statusCode
          },
          timestamp: errorDetails.timestamp
        };
        
        console.error('TELEMETRY_ERROR', JSON.stringify(telemetry));
      } else {
        const telemetry = {
          name: 'FunctionExecution',
          properties: logData.properties,
          measurements: {
            duration: logData.properties.duration || 0,
            statusCode: logData.properties.statusCode || 200
          },
          timestamp: logData.properties.timestamp
        };
        
        console.log('TELEMETRY_SUCCESS', JSON.stringify(telemetry));
      }
    } catch (telemetryError) {
      console.error('Failed to send telemetry:', telemetryError);
    }
  }

  /**
   * Create appropriate error response
   */
  static createErrorResponse(errorDetails) {
    const isProduction = process.env.NODE_ENV === 'production';
    
    const response = {
      status: errorDetails.statusCode,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': errorDetails.requestId,
        'X-Error-ID': errorDetails.errorId
      },
      body: {
        error: {
          message: errorDetails.isOperational || !isProduction 
            ? errorDetails.errorMessage 
            : 'An internal server error occurred',
          code: errorDetails.errorCode || 'FUNCTION_ERROR',
          timestamp: errorDetails.timestamp,
          requestId: errorDetails.requestId,
          errorId: errorDetails.errorId
        }
      }
    };

    // Include debug info in non-production environments
    if (!isProduction && !errorDetails.isOperational) {
      response.body.error.debug = {
        functionName: errorDetails.functionName,
        invocationId: errorDetails.invocationId,
        stack: errorDetails.stack,
        originalMessage: errorDetails.errorMessage
      };
    }

    return response;
  }

  /**
   * Create an operational error (expected errors)
   */
  static createOperationalError(message, statusCode = 400, code = 'OPERATIONAL_ERROR') {
    const error = new Error(message);
    error.statusCode = statusCode;
    error.code = code;
    error.isOperational = true;
    return error;
  }

  /**
   * Create a programming error (unexpected errors)
   */
  static createProgrammingError(message, originalError = null) {
    const error = new Error(message);
    error.statusCode = 500;
    error.code = 'PROGRAMMING_ERROR';
    error.isOperational = false;
    
    if (originalError) {
      error.stack = originalError.stack;
      error.originalError = originalError;
    }
    
    return error;
  }

  /**
   * Normalize different error types
   */
  static normalizeError(error) {
    // Already normalized
    if (error.isOperational !== undefined) {
      return error;
    }

    // Network errors
    if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return this.createOperationalError(
        'Network connection failed',
        503,
        error.code
      );
    }

    // HTTP errors from external services
    if (error.response && error.response.status) {
      const status = error.response.status;
      if (status >= 400 && status < 500) {
        return this.createOperationalError(
          error.message || `HTTP ${status} error`,
          status,
          'HTTP_CLIENT_ERROR'
        );
      } else if (status >= 500) {
        return this.createOperationalError(
          'External service error',
          502,
          'HTTP_SERVER_ERROR'
        );
      }
    }

    // Azure OpenAI specific errors
    if (error.message && (
      error.message.includes('rate limit') ||
      error.message.includes('throttled') ||
      error.message.includes('quota exceeded')
    )) {
      return this.createOperationalError(
        'AI service rate limit exceeded',
        429,
        'RATE_LIMIT_ERROR'
      );
    }

    // Validation errors
    if (error.name === 'ValidationError' || 
        error.message && error.message.includes('validation')) {
      return this.createOperationalError(
        error.message || 'Validation failed',
        400,
        'VALIDATION_ERROR'
      );
    }

    // Authentication errors
    if (error.message && (
      error.message.includes('unauthorized') ||
      error.message.includes('authentication') ||
      error.message.includes('token')
    )) {
      return this.createOperationalError(
        'Authentication failed',
        401,
        'AUTH_ERROR'
      );
    }

    // Default to programming error
    return this.createProgrammingError(
      error.message || 'An unexpected error occurred',
      error
    );
  }
}

module.exports = {
  FunctionErrorHandler,
  FunctionErrorDetails,
  withFunctionErrorHandler: FunctionErrorHandler.withErrorHandler.bind(FunctionErrorHandler),
  createOperationalError: FunctionErrorHandler.createOperationalError.bind(FunctionErrorHandler),
  createProgrammingError: FunctionErrorHandler.createProgrammingError.bind(FunctionErrorHandler),
  normalizeError: FunctionErrorHandler.normalizeError.bind(FunctionErrorHandler)
};
