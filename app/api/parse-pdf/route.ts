/**
 * PDF Parsing API - App Router Endpoint
 * 
 * POST /api/parse-pdf
 * 
 * Parses PDF files and extracts text content with comprehensive security validations.
 * Migrated from Pages Router to App Router (Next.js 15).
 */

import { NextRequest, NextResponse } from 'next/server';
import { rateLimiter, getRateLimitHeaders } from '@/lib/middleware/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds max for PDF parsing

// Security constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPE = 'application/pdf';
const PDF_MAGIC_BYTES = '%PDF';

/**
 * PII redaction utility - removes sensitive information from logs
 */
function sanitizeForLogging(text: string): string {
  if (!text) return text;
  
  return text
    // Email addresses
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]')
    // Phone numbers (various formats)
    .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE]')
    .replace(/\b\(\d{3}\)\s?\d{3}[-.]?\d{4}\b/g, '[PHONE]')
    .replace(/\b\+?1?[-.]?\(?\d{3}\)?[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE]')
    // SSN patterns
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]')
    .replace(/\b\d{9}\b/g, '[SSN]');
}

/**
 * Validate PDF magic bytes
 */
function validatePDFMagicBytes(buffer: Buffer): boolean {
  try {
    const header = buffer.toString('utf8', 0, 4);
    return header === PDF_MAGIC_BYTES;
  } catch (error) {
    console.error('Error validating magic bytes:', sanitizeForLogging(error instanceof Error ? error.message : 'Unknown error'));
    return false;
  }
}

/**
 * Parse PDF and extract text
 */
async function parsePDF(buffer: Buffer): Promise<string> {
  try {
    const { default: pdf } = await import('pdf-parse');
    const data = await pdf(buffer);
    
    // Basic sanitization: normalize whitespace and strip non-printable characters
    const sanitizedText = (data.text || '')
      .replace(/[\x00-\x09\x0B-\x1F\x7F]/g, ' ') // Remove control chars except \n
      .replace(/\s+\n/g, '\n') // Trim trailing spaces before newlines
      .replace(/\n{3,}/g, '\n\n') // Collapse excessive blank lines
      .trim();

    return sanitizedText;
  } catch (error) {
    console.error('Error parsing PDF:', sanitizeForLogging(error instanceof Error ? error.message : 'Unknown error'));
    throw new Error('Failed to extract text from PDF');
  }
}

/**
 * POST /api/parse-pdf
 * Parse PDF file and extract text content
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    console.log('📄 PDF parsing API called (App Router)');

    // Get user identifier (IP address for unauthenticated access)
    const userIdentifier = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
                          request.headers.get('x-real-ip') || 
                          'anonymous';

    // Check rate limit
    const rateLimitResult = await rateLimiter.checkLimit(userIdentifier, '/api/parse-pdf');
    
    if (!rateLimitResult.allowed) {
      console.warn(`⚠️ Rate limit exceeded for: ${userIdentifier}`);
      const rateLimitHeaders = getRateLimitHeaders(rateLimitResult);
      
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        {
          status: 429,
          headers: rateLimitHeaders,
        }
      );
    }

    // Parse multipart form data
    let formData: FormData;
    
    try {
      formData = await request.formData();
    } catch (error) {
      console.error('Failed to parse form data:', sanitizeForLogging(error instanceof Error ? error.message : 'Unknown error'));
      return NextResponse.json(
        { error: 'Invalid form data' },
        { status: 400 }
      );
    }

    // Get uploaded file
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }

    console.log('File received:', sanitizeForLogging(`name=${file.name}, size=${file.size}, type=${file.type}`));

    // Validate MIME type
    if (file.type !== ALLOWED_MIME_TYPE) {
      console.warn('Invalid MIME type:', sanitizeForLogging(file.type));
      return NextResponse.json(
        { error: 'Only PDF files are allowed' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      console.warn('File size exceeds limit:', sanitizeForLogging(`${file.size} bytes`));
      return NextResponse.json(
        { error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` },
        { status: 400 }
      );
    }

    // Validate file extension
    const filename = file.name.toLowerCase();
    if (!filename.endsWith('.pdf')) {
      console.warn('Invalid file extension:', sanitizeForLogging(file.name));
      return NextResponse.json(
        { error: 'Only PDF files are allowed' },
        { status: 400 }
      );
    }

    // Convert File to Buffer
    let buffer: Buffer;
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } catch (error) {
      console.error('Failed to read file buffer:', sanitizeForLogging(error instanceof Error ? error.message : 'Unknown error'));
      return NextResponse.json(
        { error: 'Failed to read file' },
        { status: 500 }
      );
    }

    // Validate PDF magic bytes
    const isValidPDF = validatePDFMagicBytes(buffer);
    
    if (!isValidPDF) {
      console.warn('Invalid PDF magic bytes for file:', sanitizeForLogging(file.name));
      return NextResponse.json(
        { error: 'File is not a valid PDF document' },
        { status: 400 }
      );
    }

    console.log('Processing valid PDF:', sanitizeForLogging(file.name));

    // Parse PDF and extract text
    try {
      const text = await parsePDF(buffer);

      if (!text.trim()) {
        return NextResponse.json(
          { error: 'Could not extract text from PDF' },
          { status: 400 }
        );
      }

      console.log('✅ Successfully extracted text from PDF');

      // Return response with security headers and rate limit info (maintaining backward compatibility)
      const rateLimitHeaders = getRateLimitHeaders(rateLimitResult);
      const response = NextResponse.json(
        { success: true, text },
        { status: 200 }
      );

      response.headers.set('X-Content-Type-Options', 'nosniff');
      
      // Add rate limit headers
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      
      return response;

    } catch (parseError) {
      const errorMessage = parseError instanceof Error ? parseError.message : 'Failed to process PDF';
      console.error('PDF parsing error:', sanitizeForLogging(errorMessage));
      
      return NextResponse.json(
        { error: 'Failed to process PDF', details: errorMessage },
        { status: 500 }
      );
    }

  } catch (error) {
    // Safe error logging without PII
    console.error('❌ PDF parsing API error:', sanitizeForLogging(error instanceof Error ? error.message : 'Unknown error occurred'));
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json(
      { error: 'Failed to process PDF', details: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS /api/parse-pdf
 * Handle CORS preflight requests
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
