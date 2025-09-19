// lib/subscription-security.js

import { NextResponse } from 'next/server';
import { ratelimit } from '@/lib/upstash';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';
import crypto from 'crypto';
import { sandboxConfig } from '@/lib/paypal-sandbox-config';
import { PAYPAL_PLANS } from '@/lib/paypal-config';

/**
 * Subscription Security Layer
 * Provides authentication, validation, rate limiting, and security features
 * for subscription-related API endpoints
 */

// Rate limiting configurations
const RATE_LIMITS = {
  subscription_create: { requests: 3, window: '1 h' },
  subscription_update: { requests: 10, window: '1 h' },
  webhook: { requests: 1000, window: '1 m' },
  management: { requests: 30, window: '1 m' }
};

// Validation schemas
export const subscriptionSchemas = {
  createSubscription: z.object({
    planId: z.enum(['INDIVIDUAL_MONTHLY', 'INDIVIDUAL_YEARLY', 'ENTERPRISE_MONTHLY', 'ENTERPRISE_YEARLY']),
    billingCycle: z.enum(['monthly', 'yearly']),
    returnUrl: z.string().url().optional(),
    cancelUrl: z.string().url().optional(),
    metadata: z.record(z.any()).optional()
  }),

  updateSubscription: z.object({
    subscriptionId: z.string().min(1),
    action: z.enum(['cancel', 'suspend', 'activate', 'change_plan']),
    newPlanId: z.string().optional(),
    reason: z.string().optional(),
    effectiveDate: z.string().datetime().optional()
  }),

  planChange: z.object({
    currentPlan: z.string(),
    newPlan: z.string(),
    prorationMode: z.enum(['immediate', 'end_of_period']).default('immediate')
  }),

  webhook: z.object({
    id: z.string(),
    event_type: z.string(),
    resource_type: z.string(),
    resource: z.record(z.any()),
    create_time: z.string(),
    event_version: z.string().optional()
  })
};

/**
 * Authentication middleware for subscription APIs
 */
export async function requireAuth(request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return {
        authenticated: false,
        error: 'Authentication required',
        response: NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        )
      };
    }

    // Check if user has verified email (required for subscriptions)
    if (!session.user.emailVerified) {
      return {
        authenticated: false,
        error: 'Email verification required',
        response: NextResponse.json(
          { error: 'Please verify your email before creating a subscription' },
          { status: 403 }
        )
      };
    }

    return {
      authenticated: true,
      user: session.user,
      userId: session.user.id
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return {
      authenticated: false,
      error: 'Authentication failed',
      response: NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      )
    };
  }
}

/**
 * Rate limiting middleware
 */
export async function applyRateLimit(identifier, limitType = 'management') {
  try {
    if (!ratelimit) {
      console.warn('Rate limiting not configured');
      return { success: true };
    }

    const limit = RATE_LIMITS[limitType];
    const { success, limit: rateLimitInfo, reset, remaining } = await ratelimit.limit(
      `subscription_${limitType}:${identifier}`,
      limit.requests,
      limit.window
    );

    if (!success) {
      return {
        success: false,
        error: 'Rate limit exceeded',
        response: NextResponse.json(
          { 
            error: 'Too many requests',
            retryAfter: Math.round((reset - Date.now()) / 1000)
          },
          { 
            status: 429,
            headers: {
              'X-RateLimit-Limit': rateLimitInfo.toString(),
              'X-RateLimit-Remaining': remaining.toString(),
              'X-RateLimit-Reset': reset.toString()
            }
          }
        )
      };
    }

    return {
      success: true,
      remaining,
      reset
    };
  } catch (error) {
    console.error('Rate limiting error:', error);
    // Allow request to proceed if rate limiting fails
    return { success: true };
  }
}

/**
 * Input validation middleware
 */
export function validateSubscriptionInput(data, schema) {
  try {
    const validated = schema.parse(data);
    return {
      valid: true,
      data: validated
    };
  } catch (error) {
    console.error('Validation error:', error);
    
    const errorDetails = error.errors?.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code
    })) || [];

    return {
      valid: false,
      errors: errorDetails,
      response: NextResponse.json(
        { 
          error: 'Invalid input',
          details: errorDetails
        },
        { status: 400 }
      )
    };
  }
}

/**
 * Enhanced webhook signature validation
 */
export async function validateWebhookSignature(request, webhookId) {
  try {
    // Skip validation in test environment
    if (process.env.NODE_ENV === 'test' && !webhookId) {
      console.log('Skipping webhook signature validation in test environment');
      return { valid: true };
    }

    const headers = request.headers;
    const body = await request.text();

    // Required PayPal webhook headers
    const requiredHeaders = [
      'paypal-transmission-id',
      'paypal-cert-id', 
      'paypal-auth-algo',
      'paypal-transmission-sig',
      'paypal-transmission-time'
    ];

    const missingHeaders = requiredHeaders.filter(header => !headers.get(header));
    if (missingHeaders.length > 0) {
      return {
        valid: false,
        error: `Missing required headers: ${missingHeaders.join(', ')}`,
        response: NextResponse.json(
          { error: 'Invalid webhook signature - missing headers' },
          { status: 401 }
        )
      };
    }

    // Verify signature using PayPal client
    const mockRequest = {
      headers: Object.fromEntries(headers.entries()),
      body: JSON.parse(body)
    };

    const paypalClient = await import('@/lib/paypal-client');
    const isValid = await paypalClient.default.verifyWebhookSignature(mockRequest, webhookId);

    if (!isValid) {
      return {
        valid: false,
        error: 'Invalid webhook signature',
        response: NextResponse.json(
          { error: 'Invalid webhook signature' },
          { status: 401 }
        )
      };
    }

    return {
      valid: true,
      body: JSON.parse(body)
    };
  } catch (error) {
    console.error('Webhook signature validation error:', error);
    return {
      valid: false,
      error: 'Signature validation failed',
      response: NextResponse.json(
        { error: 'Webhook signature validation failed' },
        { status: 401 }
      )
    };
  }
}

/**
 * Subscription plan validation
 */
export function validateSubscriptionPlan(planId, billingCycle) {
  try {
    // Check if plan exists in configuration
    const planConfig = PAYPAL_PLANS[planId];
    if (!planConfig) {
      return {
        valid: false,
        error: `Invalid plan ID: ${planId}`,
        response: NextResponse.json(
          { error: `Invalid subscription plan: ${planId}` },
          { status: 400 }
        )
      };
    }

    // Validate billing cycle matches plan
    const expectedCycle = planConfig.billing_cycle.toLowerCase();
    if (billingCycle !== expectedCycle) {
      return {
        valid: false,
        error: `Billing cycle mismatch: expected ${expectedCycle}, got ${billingCycle}`,
        response: NextResponse.json(
          { error: `Invalid billing cycle for plan ${planId}` },
          { status: 400 }
        )
      };
    }

    // Check if plan is active/available
    if (planConfig.status === 'INACTIVE') {
      return {
        valid: false,
        error: `Plan ${planId} is not available`,
        response: NextResponse.json(
          { error: `Subscription plan ${planId} is currently unavailable` },
          { status: 400 }
        )
      };
    }

    return {
      valid: true,
      plan: planConfig
    };
  } catch (error) {
    console.error('Plan validation error:', error);
    return {
      valid: false,
      error: 'Plan validation failed',
      response: NextResponse.json(
        { error: 'Invalid subscription plan configuration' },
        { status: 500 }
      )
    };
  }
}

/**
 * User subscription eligibility check
 */
export async function checkSubscriptionEligibility(userId) {
  try {
    // TODO: Check against your user database
    // For now, return basic eligibility check
    
    // Check if user already has active subscription
    // const existingSubscription = await getUserActiveSubscription(userId);
    // if (existingSubscription) {
    //   return {
    //     eligible: false,
    //     error: 'User already has an active subscription',
    //     response: NextResponse.json(
    //       { error: 'You already have an active subscription. Please cancel it first to create a new one.' },
    //       { status: 409 }
    //     )
    //   };
    // }

    return {
      eligible: true
    };
  } catch (error) {
    console.error('Eligibility check error:', error);
    return {
      eligible: false,
      error: 'Eligibility check failed',
      response: NextResponse.json(
        { error: 'Unable to verify subscription eligibility' },
        { status: 500 }
      )
    };
  }
}

/**
 * Security headers middleware
 */
export function addSecurityHeaders(response) {
  // Add security headers to response
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Add CORS headers for subscription endpoints
  response.headers.set('Access-Control-Allow-Origin', process.env.NEXT_PUBLIC_APP_URL || 'https://prepbettr.com');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  return response;
}

/**
 * Input sanitization
 */
export function sanitizeInput(data) {
  if (typeof data === 'string') {
    // Remove potential XSS vectors
    return data
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+=/gi, '')
      .trim();
  }
  
  if (typeof data === 'object' && data !== null) {
    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[sanitizeInput(key)] = sanitizeInput(value);
    }
    return sanitized;
  }
  
  return data;
}

/**
 * Comprehensive security middleware wrapper
 */
export function withSubscriptionSecurity(handler, options = {}) {
  return async function securedHandler(request) {
    try {
      const startTime = Date.now();
      
      // Apply rate limiting
      const userId = request.nextUrl.searchParams.get('userId') || 
                    request.headers.get('x-user-id') ||
                    'anonymous';
      
      const rateLimitResult = await applyRateLimit(userId, options.limitType);
      if (!rateLimitResult.success) {
        return rateLimitResult.response;
      }

      // Require authentication (unless webhook)
      if (options.requireAuth !== false) {
        const authResult = await requireAuth(request);
        if (!authResult.authenticated) {
          return authResult.response;
        }
        request.user = authResult.user;
        request.userId = authResult.userId;
      }

      // Validate input if schema provided
      if (options.schema) {
        const body = await request.json().catch(() => ({}));
        const sanitizedBody = sanitizeInput(body);
        const validationResult = validateSubscriptionInput(sanitizedBody, options.schema);
        
        if (!validationResult.valid) {
          return validationResult.response;
        }
        
        request.validatedBody = validationResult.data;
      }

      // Additional security checks
      if (options.validatePlan && request.validatedBody) {
        const { planId, billingCycle } = request.validatedBody;
        if (planId) {
          const planValidation = validateSubscriptionPlan(planId, billingCycle);
          if (!planValidation.valid) {
            return planValidation.response;
          }
          request.planConfig = planValidation.plan;
        }
      }

      // Check subscription eligibility
      if (options.checkEligibility && request.userId) {
        const eligibilityResult = await checkSubscriptionEligibility(request.userId);
        if (!eligibilityResult.eligible) {
          return eligibilityResult.response;
        }
      }

      // Call the actual handler
      const response = await handler(request);
      
      // Add security headers
      const securedResponse = addSecurityHeaders(response);
      
      // Add performance timing header
      const duration = Date.now() - startTime;
      securedResponse.headers.set('X-Response-Time', `${duration}ms`);
      
      return securedResponse;
      
    } catch (error) {
      console.error('Security middleware error:', error);
      return NextResponse.json(
        { error: 'Security validation failed' },
        { status: 500 }
      );
    }
  };
}

/**
 * Webhook-specific security middleware
 */
export function withWebhookSecurity(handler) {
  return async function securedWebhookHandler(request) {
    try {
      const startTime = Date.now();
      
      // Apply webhook rate limiting
      const clientIp = request.headers.get('x-forwarded-for') || 'unknown';
      const rateLimitResult = await applyRateLimit(clientIp, 'webhook');
      if (!rateLimitResult.success) {
        return rateLimitResult.response;
      }

      // Validate webhook signature
      const webhookId = sandboxConfig.webhookId;
      if (webhookId) {
        const signatureResult = await validateWebhookSignature(request, webhookId);
        if (!signatureResult.valid) {
          return signatureResult.response;
        }
        request.webhookBody = signatureResult.body;
      } else {
        // In development without webhook ID, parse body manually
        const body = await request.text();
        request.webhookBody = JSON.parse(body);
      }

      // Validate webhook payload structure
      const validationResult = validateSubscriptionInput(
        request.webhookBody, 
        subscriptionSchemas.webhook
      );
      if (!validationResult.valid) {
        return validationResult.response;
      }

      // Call the actual webhook handler
      const response = await handler(request);
      
      // Add security headers and timing
      const securedResponse = addSecurityHeaders(response);
      const duration = Date.now() - startTime;
      securedResponse.headers.set('X-Response-Time', `${duration}ms`);
      
      return securedResponse;
      
    } catch (error) {
      console.error('Webhook security middleware error:', error);
      return NextResponse.json(
        { error: 'Webhook security validation failed' },
        { status: 500 }
      );
    }
  };
}

// Export schemas for use in other modules
export { subscriptionSchemas as schemas };

export default {
  withSubscriptionSecurity,
  withWebhookSecurity,
  requireAuth,
  applyRateLimit,
  validateSubscriptionInput,
  validateWebhookSignature,
  validateSubscriptionPlan,
  checkSubscriptionEligibility,
  sanitizeInput,
  addSecurityHeaders,
  schemas: subscriptionSchemas
};