import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, createOperationalError } from '@/lib/middleware/error-handler';
import { retryWithExponentialBackoff } from '@/lib/utils/retry-with-backoff';

/**
 * Example API route demonstrating observability, error handling, and retry logic
 * 
 * This endpoint shows how to:
 * 1. Use global error handling middleware
 * 2. Implement retry logic with exponential backoff
 * 3. Emit structured logs with userId, jobId, and action context
 * 4. Handle different types of errors appropriately
 */

interface ExampleRequest {
  userId: string;
  jobId?: string;
  operation: 'ai_generation' | 'portal_search' | 'data_processing';
  simulateError?: 'network' | 'rate_limit' | 'validation' | 'programming';
}

// Mock external service calls for demonstration
async function mockAIService(operation: string): Promise<string> {
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
  
  // Randomly simulate failures for testing
  if (Math.random() < 0.2) { // 20% failure rate
    throw new Error('Azure OpenAI service temporarily unavailable');
  }
  
  return `AI result for ${operation}`;
}

async function mockPortalService(operation: string): Promise<any[]> {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
  
  // Randomly simulate rate limiting
  if (Math.random() < 0.15) { // 15% rate limit
    const error = new Error('Rate limit exceeded');
    (error as any).statusCode = 429;
    throw error;
  }
  
  return [
    { id: '1', title: `Job result for ${operation}`, company: 'Example Corp' },
    { id: '2', title: `Another job for ${operation}`, company: 'Demo Inc' }
  ];
}

// Main handler with error handling middleware
export const POST = withErrorHandler(async (req: NextRequest) => {
  const startTime = Date.now();
  
  // Parse request body
  const body: ExampleRequest = await req.json();
  const { userId, jobId, operation, simulateError } = body;
  
  // Validation
  if (!userId || !operation) {
    throw createOperationalError(
      'Missing required fields: userId and operation are required',
      400,
      'VALIDATION_ERROR'
    );
  }
  
  if (!['ai_generation', 'portal_search', 'data_processing'].includes(operation)) {
    throw createOperationalError(
      'Invalid operation. Must be one of: ai_generation, portal_search, data_processing',
      400,
      'INVALID_OPERATION'
    );
  }
  
  // Simulate different error types for testing
  if (simulateError) {
    switch (simulateError) {
      case 'network':
        const networkError = new Error('Network connection failed');
        (networkError as any).code = 'ECONNRESET';
        throw networkError;
        
      case 'rate_limit':
        const rateLimitError = new Error('Rate limit exceeded');
        (rateLimitError as any).statusCode = 429;
        throw rateLimitError;
        
      case 'validation':
        throw createOperationalError('Invalid data format', 400, 'VALIDATION_ERROR');
        
      case 'programming':
        // This will be caught as an unexpected error
        throw new Error('Undefined variable: someUndefinedVariable');
        
      default:
        break;
    }
  }
  
  let result: any;
  
  try {
    // Execute operation with retry logic based on type
    switch (operation) {
      case 'ai_generation':
        console.log('API_OPERATION', JSON.stringify({
          level: 'info',
          message: 'Starting AI generation operation',
          properties: {
            userId,
            jobId,
            action: 'ai_generation',
            operation: 'start',
            timestamp: new Date().toISOString()
          }
        }));
        
        result = await retryWithExponentialBackoff(
          () => mockAIService(operation),
          'ai_generation',
          userId,
          {
            maxRetries: 3,
            baseDelay: 2000,
            maxDelay: 60000,
            jitter: true
          }
        );
        break;
        
      case 'portal_search':
        console.log('API_OPERATION', JSON.stringify({
          level: 'info',
          message: 'Starting portal search operation',
          properties: {
            userId,
            jobId,
            action: 'portal_search',
            operation: 'start',
            timestamp: new Date().toISOString()
          }
        }));
        
        result = await retryWithExponentialBackoff(
          () => mockPortalService(operation),
          'portal_search',
          userId,
          {
            maxRetries: 2,
            baseDelay: 3000,
            maxDelay: 30000,
            jitter: true
          }
        );
        break;
        
      case 'data_processing':
        console.log('API_OPERATION', JSON.stringify({
          level: 'info',
          message: 'Starting data processing operation',
          properties: {
            userId,
            jobId,
            action: 'data_processing',
            operation: 'start',
            timestamp: new Date().toISOString()
          }
        }));
        
        result = await retryWithExponentialBackoff(
          async () => {
            // Simulate data processing
            await new Promise(resolve => setTimeout(resolve, 500));
            return { processed: true, items: 42 };
          },
          'data_processing',
          userId,
          {
            maxRetries: 1,
            baseDelay: 1000,
            maxDelay: 10000
          }
        );
        break;
    }
    
    const duration = Date.now() - startTime;
    
    // Log successful operation
    console.log('API_SUCCESS', JSON.stringify({
      level: 'info',
      message: `Operation ${operation} completed successfully`,
      properties: {
        userId,
        jobId,
        action: operation,
        duration,
        resultSize: Array.isArray(result) ? result.length : 1,
        timestamp: new Date().toISOString()
      }
    }));
    
    // Return successful response
    return NextResponse.json({
      success: true,
      operation,
      result,
      metadata: {
        userId,
        jobId,
        duration,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    // Error will be handled by the global error middleware
    // Just re-throw to let middleware handle it
    throw error;
  }
});

// GET endpoint for testing
export const GET = withErrorHandler(async (req: NextRequest) => {
  const url = new URL(req.url);
  const operation = url.searchParams.get('operation') || 'health_check';
  
  console.log('HEALTH_CHECK', JSON.stringify({
    level: 'info',
    message: 'Health check endpoint called',
    properties: {
      operation,
      timestamp: new Date().toISOString(),
      userAgent: req.headers.get('user-agent')
    }
  }));
  
  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    operation,
    observability: {
      retryLogic: 'enabled',
      errorHandling: 'enabled',
      structuredLogging: 'enabled',
      applicationInsights: process.env.NEXT_PUBLIC_APP_INSIGHTS_INSTRUMENTATION_KEY ? 'enabled' : 'disabled'
    }
  });
});
