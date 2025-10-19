/**
 * Job URL Scraping API - App Router Endpoint
 * 
 * POST /api/scrape-job
 * 
 * Scrapes job description content from a provided URL using Puppeteer and Cheerio.
 * Includes authentication, rate limiting, URL validation, and intelligent content extraction.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import puppeteer, { Browser, Page } from 'puppeteer';
import * as cheerio from 'cheerio';
import { verifyIdToken } from '@/lib/firebase/admin';
import { rateLimiter, getRateLimitHeaders } from '@/lib/middleware/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds max for serverless function

// Type definitions
interface RequestBody {
  jobUrl: string;
}

interface SuccessResponse {
  success: true;
  jobDescription: string;
  sourceUrl: string;
}

interface ErrorResponse {
  success: false;
  error: string;
  retryAfter?: number;
}

type ApiResponse = SuccessResponse | ErrorResponse;

// Puppeteer configuration
const PUPPETEER_TIMEOUT = 30000; // 30 seconds
const PUPPETEER_ARGS = ['--no-sandbox', '--disable-setuid-sandbox'];

// Job description selectors (ordered by priority)
const JOB_DESCRIPTION_SELECTORS = [
  'div[class*="description"]',
  'div[id*="description"]',
  '.job-description',
  '#job-description',
  'article',
  'main',
  '[data-testid*="description"]',
  '[class*="job-details"]',
  '[class*="jobDetails"]',
];

// Elements to remove from scraped content
const ELEMENTS_TO_REMOVE = ['script', 'style', 'nav', 'footer', 'header', 'iframe', 'noscript'];

// Validation schema
const requestSchema = z.object({
  jobUrl: z.string()
    .url('Invalid URL format')
    .regex(/^https?:\/\//, 'URL must use HTTP or HTTPS protocol')
    .refine((url) => {
      const lower = url.toLowerCase();
      return !lower.startsWith('data:') && 
             !lower.startsWith('javascript:') && 
             !lower.startsWith('file:');
    }, 'Invalid URL protocol'),
});

/**
 * Extract job description text from HTML using Cheerio
 */
function extractJobDescription(html: string): string {
  const $ = cheerio.load(html);

  // Remove unwanted elements
  ELEMENTS_TO_REMOVE.forEach(selector => {
    $(selector).remove();
  });

  // Try each selector in order of priority
  for (const selector of JOB_DESCRIPTION_SELECTORS) {
    const element = $(selector).first();
    if (element.length > 0) {
      const text = element.text();
      if (text.trim().length > 100) { // Ensure we got meaningful content
        return cleanText(text);
      }
    }
  }

  // Fallback: try to get body text if specific selectors fail
  const bodyText = $('body').text();
  if (bodyText.trim().length > 100) {
    return cleanText(bodyText);
  }

  return '';
}

/**
 * Clean extracted text: normalize whitespace and line breaks
 */
function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/\n\s*\n/g, '\n') // Remove empty lines
    .trim()
    .substring(0, 10000); // Limit to 10,000 characters
}

/**
 * Scrape job description from URL using Puppeteer
 */
async function scrapeJobUrl(url: string): Promise<string> {
  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    console.log(`🔍 Launching Puppeteer for URL: ${url}`);
    
    browser = await puppeteer.launch({
      headless: true,
      args: PUPPETEER_ARGS,
      timeout: PUPPETEER_TIMEOUT,
    });

    page = await browser.newPage();
    
    // Set a reasonable viewport
    await page.setViewport({ width: 1280, height: 800 });
    
    // Set user agent to avoid bot detection
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    console.log(`📄 Navigating to URL...`);
    
    // Navigate to the URL with timeout
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: PUPPETEER_TIMEOUT,
    });

    console.log(`✅ Page loaded successfully`);

    // Get the page HTML
    const html = await page.content();

    // Extract job description using Cheerio
    const jobDescription = extractJobDescription(html);

    if (!jobDescription || jobDescription.length < 50) {
      throw new Error('No job description found');
    }

    console.log(`✅ Extracted ${jobDescription.length} characters`);

    return jobDescription;

  } catch (error) {
    console.error('❌ Scraping error:', error instanceof Error ? error.message : 'Unknown error');
    
    if (error instanceof Error) {
      if (error.message.includes('timeout') || error.message.includes('Navigation timeout')) {
        throw new Error('Unable to load page - request timed out');
      }
      if (error.message.includes('net::ERR_')) {
        throw new Error('Unable to access the URL - network error');
      }
      if (error.message.includes('No job description found')) {
        throw new Error('No job description found on this page');
      }
    }
    
    throw new Error('Failed to scrape job description');

  } finally {
    // Always close browser and page to prevent memory leaks
    if (page) {
      try {
        await page.close();
      } catch (closeError) {
        console.error('Error closing page:', closeError);
      }
    }
    
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('Error closing browser:', closeError);
      }
    }
  }
}

/**
 * POST /api/scrape-job
 * Scrape job description from a URL
 */
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    console.log('🌐 Job scraping API called');

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
    const rateLimitResult = await rateLimiter.checkLimit(userId, '/api/scrape-job');
    
    if (!rateLimitResult.allowed) {
      console.warn(`⚠️ Rate limit exceeded for user: ${userId}`);
      const rateLimitHeaders = getRateLimitHeaders(rateLimitResult);
      
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded. Please try again later.',
          retryAfter: rateLimitResult.retryAfter,
        },
        {
          status: 429,
          headers: rateLimitHeaders,
        }
      );
    }

    // 3. Parse request body
    let body: RequestBody;
    
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // 4. Validate URL
    const validationResult = requestSchema.safeParse(body);

    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0];
      return NextResponse.json(
        {
          success: false,
          error: firstError?.message || 'Invalid URL format',
        },
        { status: 400 }
      );
    }

    const { jobUrl } = validationResult.data;
    console.log(`🔗 Scraping job from: ${jobUrl}`);

    // 5. Scrape the job URL
    try {
      const jobDescription = await scrapeJobUrl(jobUrl);

      console.log(`✅ Successfully scraped job description`);
      
      const rateLimitHeaders = getRateLimitHeaders(rateLimitResult);
      
      return NextResponse.json(
        {
          success: true,
          jobDescription,
          sourceUrl: jobUrl,
        },
        { headers: rateLimitHeaders }
      );

    } catch (scrapeError) {
      const errorMessage = scrapeError instanceof Error 
        ? scrapeError.message 
        : 'Failed to scrape job description';

      console.error(`❌ Scraping failed: ${errorMessage}`);

      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 500 }
      );
    }

  } catch (error) {
    // Safe error logging without PII
    console.error('❌ Job scraping API error:', {
      route: '/api/scrape-job',
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
 * OPTIONS /api/scrape-job
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
