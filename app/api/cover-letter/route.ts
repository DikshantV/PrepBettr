/**
 * Cover Letter Generation API - App Router Endpoint
 * 
 * POST /api/cover-letter
 * 
 * Generates a cover letter based on resume text and job description using Azure OpenAI.
 * Includes authentication, rate limiting, input validation, and sanitization.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import * as DOMPurify from 'isomorphic-dompurify';
import { verifyIdToken } from '@/lib/firebase/admin';
import { generateCoverLetter } from '@/lib/ai/index';
import { rateLimiter, getRateLimitHeaders } from '@/lib/middleware/rate-limit';

export const runtime = 'nodejs';

// Type definitions
interface RequestBody {
  resumeText: string;
  jobDescription: string;
}

interface ValidationError {
  field: string;
  message: string;
}

interface SuccessResponse {
  success: true;
  coverLetter: string;
  provider: string;
}

interface ErrorResponse {
  success: false;
  error: string;
  validationErrors?: ValidationError[];
  retryAfter?: number;
}

type ApiResponse = SuccessResponse | ErrorResponse;

// Security patterns
const MALICIOUS_PATTERNS = [
  /<script/i,
  /javascript:/i,
  /onerror\s*=/i,
  /onclick\s*=/i,
  /onload\s*=/i,
];

// Validation schema
const requestSchema = z.object({
  resumeText: z.string()
    .min(50, 'Resume text must be at least 50 characters')
    .max(10000, 'Resume text must not exceed 10,000 characters'),
  jobDescription: z.string()
    .min(50, 'Job description must be at least 50 characters')
    .max(5000, 'Job description must not exceed 5,000 characters'),
});

/**
 * Sanitize user input using DOMPurify
 */
function sanitizeInput(input: string): string {
  const sanitized = DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });
  return sanitized.trim();
}

/**
 * Check for malicious patterns in input
 */
function hasMaliciousContent(input: string): boolean {
  return MALICIOUS_PATTERNS.some(pattern => pattern.test(input));
}

/**
 * POST /api/cover-letter
 * Generate a cover letter from resume and job description
 */
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    console.log('📝 Cover letter generation API called');

    // 1. Authenticate user
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const idToken = authHeader.substring(7); // Remove 'Bearer ' prefix
    const verificationResult = await verifyIdToken(idToken);

    if (!verificationResult.valid || !verificationResult.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Invalid token' },
        { status: 401 }
      );
    }

    const userId = verificationResult.user.uid;
    console.log(`✅ User authenticated: ${userId}`);

    // 2. Check rate limit
    const rateLimitResult = await rateLimiter.checkLimit(userId, '/api/cover-letter');
    
    if (!rateLimitResult.allowed) {
      console.warn(`⚠️ Rate limit exceeded for user: ${userId}`);
      const rateLimitHeaders = getRateLimitHeaders(rateLimitResult);
      
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded. Try again later.',
          retryAfter: rateLimitResult.retryAfter,
        },
        {
          status: 429,
          headers: rateLimitHeaders,
        }
      );
    }

    // 3. Parse and validate request body
    let body: RequestBody;
    
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON in request body',
        },
        { status: 400 }
      );
    }

    // 4. Sanitize inputs
    const sanitizedResumeText = sanitizeInput(body.resumeText || '');
    const sanitizedJobDescription = sanitizeInput(body.jobDescription || '');

    // 5. Check for malicious content
    const validationErrors: ValidationError[] = [];

    if (hasMaliciousContent(sanitizedResumeText)) {
      validationErrors.push({
        field: 'resumeText',
        message: 'Resume text contains potentially malicious content',
      });
    }

    if (hasMaliciousContent(sanitizedJobDescription)) {
      validationErrors.push({
        field: 'jobDescription',
        message: 'Job description contains potentially malicious content',
      });
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Input contains invalid content',
          validationErrors,
        },
        { status: 400 }
      );
    }

    // 6. Validate input length and format
    const validationResult = requestSchema.safeParse({
      resumeText: sanitizedResumeText,
      jobDescription: sanitizedJobDescription,
    });

    if (!validationResult.success) {
      const errors: ValidationError[] = validationResult.error.issues.map(issue => ({
        field: issue.path[0]?.toString() || 'unknown',
        message: issue.message,
      }));

      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          validationErrors: errors,
        },
        { status: 400 }
      );
    }

    console.log(`📋 Generating cover letter for user: ${userId}`);

    // 7. Generate cover letter using AI service
    const result = await generateCoverLetter(
      sanitizedResumeText,
      sanitizedJobDescription
    );

    // 8. Handle AI service response
    if (result.success && result.data) {
      console.log(`✅ Cover letter generated successfully using ${result.provider}`);
      
      const rateLimitHeaders = getRateLimitHeaders(rateLimitResult);
      
      return NextResponse.json(
        {
          success: true,
          coverLetter: result.data,
          provider: result.provider || 'unknown',
        },
        { headers: rateLimitHeaders }
      );
    } else {
      console.error(`❌ Cover letter generation failed: ${result.error}`);
      
      return NextResponse.json(
        {
          success: false,
          error: 'A cover letter could not be generated at this time. Please try again.',
        },
        { status: 500 }
      );
    }

  } catch (error) {
    // Safe error logging without PII
    console.error('❌ Cover letter API error:', {
      route: '/api/cover-letter',
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred. Please try again later.',
      },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS /api/cover-letter
 * Handle CORS preflight requests
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    },
  });
}
