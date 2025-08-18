import { NextRequest, NextResponse } from 'next/server';
import { azureOpenAIService } from '@/lib/services/azure-openai-service';
import { firebaseVerification } from '@/lib/services/firebase-verification';
// Custom HTML text extraction without external dependencies
import fetch from 'node-fetch';
import { 
  createErrorResponse, 
  logServerError, 
  mapErrorToResponse,
  ServerErrorContext 
} from '@/lib/errors';

/**
 * Extract readable text from HTML content using pure regex approach
 * @param html - HTML string to extract text from
 * @returns Clean text content
 */
function extractTextFromHtml(html: string): string {
  return html
    // Remove script tags and their content
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    // Remove style tags and their content
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    // Remove noscript tags and their content
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
    // Remove comments
    .replace(/<!--[\s\S]*?-->/gi, '')
    // Remove all remaining HTML tags but preserve their spacing
    .replace(/<[^>]*>/g, ' ')
    // Decode common HTML entities
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Remove excessive newlines
    .replace(/\n\s*\n/g, '\n')
    // Trim the result
    .trim();
}

export async function POST(request: NextRequest) {
  const requestUrl = request.url;
  const userAgent = request.headers.get('user-agent') || undefined;
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined;
  let userId: string | undefined;

  try {
    const sessionCookie = request.cookies.get('session')?.value;

    if (!sessionCookie) {
      const errorResponse = createErrorResponse('Authentication required', 401);
      return NextResponse.json(errorResponse, { status: errorResponse.status });
    }

    const verificationResult = await firebaseVerification.verifyIdToken(sessionCookie);

    if (!verificationResult.success || !verificationResult.decodedToken) {
      const errorResponse = createErrorResponse('Invalid session', 401);
      return NextResponse.json(errorResponse, { status: errorResponse.status });
    }

    userId = verificationResult.decodedToken.uid;
    const { url } = await request.json();

    if (!/^https?:\/\//i.test(url)) {
      const errorResponse = createErrorResponse('Invalid URL. Only HTTP(S) URLs are allowed.', 422);
      return NextResponse.json(errorResponse, { status: errorResponse.status });
    }

    const response = await fetch(url);

    if (!response.ok) {
      const errorResponse = createErrorResponse('Could not fetch job description from the provided URL.', 502);
      return NextResponse.json(errorResponse, { status: errorResponse.status });
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('text/html')) {
      const errorResponse = createErrorResponse('URL does not point to an HTML resource', 422);
      return NextResponse.json(errorResponse, { status: errorResponse.status });
    }

    const html = await response.text();

    if (html.length > 256000) {
      const errorResponse = createErrorResponse('Content size exceeds 256 kB', 400);
      return NextResponse.json(errorResponse, { status: errorResponse.status });
    }

    const rawText = extractTextFromHtml(html);

    if (!azureOpenAIService.isReady()) {
      const errorResponse = createErrorResponse('Service temporarily unavailable. Please try again later.', 503);
      return NextResponse.json(errorResponse, { status: errorResponse.status });
    }

    const prompt = `You are an ATS analyst. From the following page text extract: job title, company, location, full description, requirements list, key skills (≤25). Return JSON with these keys.`;
    const responseText = await azureOpenAIService.processUserResponse(`${prompt} ${rawText}`);

    let structuredFields;
    try {
      structuredFields = JSON.parse(responseText.content);
    } catch {
      const errorResponse = createErrorResponse('Failed to process job description data', 500);
      return NextResponse.json(errorResponse, { status: errorResponse.status });
    }

    return NextResponse.json({
      success: true,
      data: { ...structuredFields, rawText }
    });

  } catch (error: any) {
    // Create server error context for logging
    const context: ServerErrorContext = {
      userId,
      url: requestUrl,
      method: 'POST',
      timestamp: new Date().toISOString(),
      userAgent,
      ip
    };

    // Log the server error with context but no sensitive info
    logServerError(error, context, { endpoint: 'extract-url', inputUrl: typeof error === 'object' ? '[URL hidden for privacy]' : undefined });

    // Map error to standardized response
    const errorResponse = mapErrorToResponse(error);
    return NextResponse.json(errorResponse, { status: errorResponse.status });
  }
}
