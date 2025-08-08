import { NextRequest, NextResponse } from 'next/server';
import { firebaseVerification } from '@/lib/services/firebase-verification';
import { 
  createApiErrorResponse, 
  logServerError, 
  mapErrorToResponse,
  ServerErrorContext 
} from '@/lib/errors';
import { tailorResume } from '@/lib/ai';

// Legacy Azure OpenAI service for fallback if needed
// import { azureOpenAIService } from '@/lib/services/azure-openai-service';
// let azureInitialized = false;
// const initializeAzure = async () => {
//   if (!azureInitialized) {
//     azureInitialized = await azureOpenAIService.initialize();
//   }
//   return azureInitialized;
// };

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

    // Use the new AI service layer for resume tailoring
    const aiResponse = await tailorResume(resumeText, jobDescription);
    
    if (!aiResponse.success) {
      throw new Error(aiResponse.error || 'Failed to tailor resume');
    }

    return NextResponse.json({ 
      tailoredResume: aiResponse.data,
      success: true,
      provider: aiResponse.provider
    });

  } catch (error: any) {
    const context: ServerErrorContext = { 
      userId: verificationResult?.decodedToken?.uid || 'unknown', 
      url: request.url,
      method: request.method,
      timestamp: new Date().toISOString()
    };
    logServerError(error, context);
    
    // Handle Azure OpenAI specific errors
    if (error.status) {
      switch (error.status) {
        case 401:
          return createApiErrorResponse('Authentication failed with Azure OpenAI service.', 401);
        case 400:
          return createApiErrorResponse('Invalid request format. Please check your input and try again.', 400);
        case 429:
          return createApiErrorResponse('Service temporarily unavailable due to usage limits. Please try again later.', 429);
        case 500:
        case 502:
        case 503:
        case 504:
          return createApiErrorResponse('Azure OpenAI service is temporarily unavailable. Please try again later.', 500);
      }
    }
    
    // Handle general error scenarios
    if (error instanceof Error) {
      if (error.message.includes('not initialized')) {
        return createApiErrorResponse('Service is not properly configured. Please contact support.', 500);
      }
      if (error.message.includes('API key') || error.message.includes('credentials')) {
        return createApiErrorResponse('API configuration error. Please contact support.', 500);
      }
      if (error.message.includes('quota') || error.message.includes('limit') || error.message.includes('rate')) {
        return createApiErrorResponse('Service temporarily unavailable due to usage limits. Please try again later.', 429);
      }
    }

    return createApiErrorResponse('Failed to generate tailored resume. Please try again.', 500);
  }
}
