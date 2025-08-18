
import { NextRequest, NextResponse } from 'next/server';
import { firebaseVerification } from '@/lib/services/firebase-verification';
import { 
  createApiErrorResponse, 
  logServerError, 
  ServerErrorContext 
} from '@/lib/errors';
import { generateCoverLetter } from '@/lib/ai';


export async function POST(request: NextRequest) {
  let verificationResult: any = null;
  
  try {
    // Extract session cookie and verify user authentication
    const sessionCookie = request.cookies.get('session')?.value;
    
    if (!sessionCookie) {
      return createApiErrorResponse('Authentication required', 401);
    }
    
    // Verify the session token
    verificationResult = await firebaseVerification.verifyIdToken(sessionCookie);
    
    if (!verificationResult.success || !verificationResult.decodedToken) {
      return createApiErrorResponse('Invalid session', 401);
    }
    
    const { resumeText, jobDescription } = await request.json();

    // Validate input
    if (!resumeText || !jobDescription) {
      return createApiErrorResponse('Both resume text and job description are required', 400);
    }

    // Check for reasonable length limits
    if (resumeText.length > 50000 || jobDescription.length > 50000) {
      return createApiErrorResponse('Text length exceeds maximum limit (50,000 characters)', 400);
    }

    // Use the new AI service layer for cover letter generation
    const aiResponse = await generateCoverLetter(resumeText, jobDescription);
    
    if (!aiResponse.success) {
      throw new Error(aiResponse.error || 'Failed to generate cover letter');
    }

    return NextResponse.json({ 
      coverLetter: aiResponse.data,
      success: true,
      provider: aiResponse.provider
    });

  } catch (error) {
    const context: ServerErrorContext = { 
      userId: verificationResult?.decodedToken?.uid || 'unknown', 
      url: request.url,
      method: request.method,
      timestamp: new Date().toISOString()
    };
    logServerError(error as Error | string, context);
    
    // Return appropriate error messages
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return createApiErrorResponse('API configuration error. Please contact support.', 500);
      }
      if (error.message.includes('quota') || error.message.includes('limit')) {
        return createApiErrorResponse('Service temporarily unavailable due to usage limits. Please try again later.', 429);
      }
    }

    return createApiErrorResponse('Failed to generate cover letter. Please try again.', 500);
  }
}

