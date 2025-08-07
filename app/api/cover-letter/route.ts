
import { NextRequest, NextResponse } from 'next/server';
import { firebaseVerification } from '@/lib/services/firebase-verification';
import { 
  createErrorResponse, 
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
      return createErrorResponse('Authentication required', 401);
    }
    
    // Verify the session token
    verificationResult = await firebaseVerification.verifyIdToken(sessionCookie);
    
    if (!verificationResult.success || !verificationResult.decodedToken) {
      return createErrorResponse('Invalid session', 401);
    }
    
    const { resumeText, jobDescription } = await request.json();

    // Validate input
    if (!resumeText || !jobDescription) {
      return createErrorResponse('Both resume text and job description are required', 400);
    }

    // Check for reasonable length limits
    if (resumeText.length > 50000 || jobDescription.length > 50000) {
      return createErrorResponse('Text length exceeds maximum limit (50,000 characters)', 400);
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
      url: request.url 
    };
    logServerError('Cover letter generation API error', error, context);
    
    // Return appropriate error messages
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return createErrorResponse('API configuration error. Please contact support.', 500);
      }
      if (error.message.includes('quota') || error.message.includes('limit')) {
        return createErrorResponse('Service temporarily unavailable due to usage limits. Please try again later.', 429);
      }
    }

    return createErrorResponse('Failed to generate cover letter. Please try again.', 500);
  }
}

