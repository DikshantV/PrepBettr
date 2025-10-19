/**
 * Validation and Sanitization Utility
 * 
 * Centralized validation schemas and sanitization functions for API inputs.
 * Provides security-focused validation and PII redaction capabilities.
 */

import { z } from 'zod';

// ============================================================================
// SECURITY PATTERNS
// ============================================================================

/**
 * Malicious patterns to detect and reject in user input
 */
const MALICIOUS_PATTERNS = [
  /<script[^>]*>.*?<\/script>/gi,
  /<script[^>]*>/gi,
  /javascript:/gi,
  /onerror\s*=/gi,
  /onclick\s*=/gi,
  /onload\s*=/gi,
  /onmouseover\s*=/gi,
  /onfocus\s*=/gi,
  /data:text\/html/gi,
  /vbscript:/gi,
];

/**
 * Private IP ranges and localhost patterns to reject in URLs
 */
const PRIVATE_IP_PATTERNS = [
  /^https?:\/\/(localhost|127\.0\.0\.1)/i,
  /^https?:\/\/192\.168\./i,
  /^https?:\/\/10\./i,
  /^https?:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\./i,
  /^https?:\/\/\[::1\]/i, // IPv6 localhost
  /^https?:\/\/0\.0\.0\.0/i,
];

/**
 * PII patterns for logging sanitization
 */
const PII_PATTERNS = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  phone: [
    /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
    /\b\(\d{3}\)\s?\d{3}[-.]?\d{4}\b/g,
    /\b\+?1?[-.]?\(?\d{3}\)?[-.]?\d{3}[-.]?\d{4}\b/g,
  ],
  ssn: [
    /\b\d{3}-\d{2}-\d{4}\b/g,
    /\b\d{9}\b/g,
  ],
};

// ============================================================================
// ZOD VALIDATION SCHEMAS
// ============================================================================

/**
 * Schema for cover letter generation requests
 */
export const CoverLetterRequestSchema = z.object({
  resumeText: z.string()
    .min(50, 'Resume text must be at least 50 characters')
    .max(10000, 'Resume text must not exceed 10,000 characters')
    .refine((text) => !hasMaliciousContent(text), {
      message: 'Resume text contains potentially malicious content',
    }),
  jobDescription: z.string()
    .min(50, 'Job description must be at least 50 characters')
    .max(5000, 'Job description must not exceed 5,000 characters')
    .refine((text) => !hasMaliciousContent(text), {
      message: 'Job description contains potentially malicious content',
    }),
});

/**
 * Schema for job URL scraping requests
 */
export const JobUrlRequestSchema = z.object({
  jobUrl: z.string()
    .url('Invalid URL format')
    .refine((url) => validateUrl(url), {
      message: 'URL must use HTTP or HTTPS protocol and cannot be a private address',
    }),
});

/**
 * Schema for PDF file metadata validation
 */
export const ParsePdfRequestSchema = z.object({
  fileName: z.string()
    .min(1, 'File name is required')
    .refine((name) => name.toLowerCase().endsWith('.pdf'), {
      message: 'Only PDF files are allowed',
    }),
  fileSize: z.number()
    .max(10 * 1024 * 1024, 'File size must not exceed 10MB'),
  mimeType: z.string()
    .refine((type) => type === 'application/pdf', {
      message: 'Only PDF files are allowed',
    }),
});

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Check if text contains malicious patterns
 */
export function hasMaliciousContent(text: string): boolean {
  if (!text) return false;
  return MALICIOUS_PATTERNS.some(pattern => pattern.test(text));
}

/**
 * Validate URL format and protocol
 * Rejects non-HTTP(S) protocols and private IP addresses
 */
export function validateUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    
    // Only allow HTTP and HTTPS protocols
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return false;
    }
    
    // Reject private IP addresses and localhost
    const urlString = url.toLowerCase();
    if (PRIVATE_IP_PATTERNS.some(pattern => pattern.test(urlString))) {
      return false;
    }
    
    // Reject data URIs and javascript URIs
    if (urlString.startsWith('data:') || urlString.startsWith('javascript:')) {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// SANITIZATION FUNCTIONS
// ============================================================================

/**
 * Sanitize text by removing malicious patterns and normalizing whitespace
 */
export function sanitizeText(text: string): string {
  if (!text) return '';
  
  let sanitized = text;
  
  // Remove HTML tags
  sanitized = sanitized.replace(/<[^>]*>/g, '');
  
  // Remove malicious patterns (without replacement to avoid breaking content)
  MALICIOUS_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });
  
  // Normalize whitespace
  sanitized = sanitized
    .replace(/\t/g, ' ') // Convert tabs to spaces
    .replace(/\r\n/g, '\n') // Normalize line breaks
    .replace(/\r/g, '\n') // Normalize line breaks
    .replace(/ +/g, ' ') // Multiple spaces to single space
    .replace(/\n\s*\n\s*\n/g, '\n\n'); // Limit consecutive line breaks to 2
  
  // Trim leading and trailing whitespace
  sanitized = sanitized.trim();
  
  return sanitized;
}

/**
 * Sanitize text for logging by redacting PII
 */
export function sanitizeForLogging(text: string): string {
  if (!text) return text;
  
  let sanitized = text;
  
  // Redact email addresses
  sanitized = sanitized.replace(PII_PATTERNS.email, '[EMAIL]');
  
  // Redact phone numbers
  PII_PATTERNS.phone.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '[PHONE]');
  });
  
  // Redact SSN patterns
  PII_PATTERNS.ssn.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '[SSN]');
  });
  
  return sanitized;
}

/**
 * Sanitize filename by removing special characters
 */
export function sanitizeFilename(filename: string): string {
  if (!filename) return 'file';
  
  return filename
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-') // Replace special chars with hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
    .substring(0, 255); // Limit to reasonable length
}

// ============================================================================
// VALIDATION MIDDLEWARE HELPER
// ============================================================================

/**
 * Result of validation operation
 */
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: Array<{
    field: string;
    message: string;
  }>;
}

/**
 * Validate request data against a Zod schema
 * Returns structured validation result with detailed error messages
 */
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): ValidationResult<T> {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return {
      success: true,
      data: result.data,
    };
  }
  
  // Map Zod errors to structured format
  const errors = result.error.issues.map(issue => ({
    field: issue.path.join('.') || 'unknown',
    message: issue.message,
  }));
  
  return {
    success: false,
    errors,
  };
}

/**
 * Sanitize and validate text input
 * Combines sanitization with validation for text fields
 */
export function sanitizeAndValidate(
  text: string,
  minLength: number = 1,
  maxLength: number = 10000
): ValidationResult<string> {
  if (!text) {
    return {
      success: false,
      errors: [{ field: 'text', message: 'Text is required' }],
    };
  }
  
  // Sanitize first
  const sanitized = sanitizeText(text);
  
  // Check for malicious content
  if (hasMaliciousContent(sanitized)) {
    return {
      success: false,
      errors: [{ field: 'text', message: 'Text contains potentially malicious content' }],
    };
  }
  
  // Validate length
  if (sanitized.length < minLength) {
    return {
      success: false,
      errors: [{ field: 'text', message: `Text must be at least ${minLength} characters` }],
    };
  }
  
  if (sanitized.length > maxLength) {
    return {
      success: false,
      errors: [{ field: 'text', message: `Text must not exceed ${maxLength} characters` }],
    };
  }
  
  return {
    success: true,
    data: sanitized,
  };
}

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type CoverLetterRequest = z.infer<typeof CoverLetterRequestSchema>;
export type JobUrlRequest = z.infer<typeof JobUrlRequestSchema>;
export type ParsePdfRequest = z.infer<typeof ParsePdfRequestSchema>;
