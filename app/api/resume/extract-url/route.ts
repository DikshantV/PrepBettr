import { NextRequest, NextResponse } from 'next/server';
import { azureOpenAIService } from '@/lib/services/azure-openai-service';
import { firebaseVerification } from '@/lib/services/firebase-verification';
import { extract } from '@extractus/article-extractor';
import fetch from 'node-fetch';
import { 
  createErrorResponse, 
  logServerError, 
  mapErrorToResponse,
  ServerErrorContext 
} from '@/lib/errors';

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

    const rawText = extract(html)?.text || '';

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
