import { NextRequest, NextResponse } from 'next/server';
import { azureOpenAIService } from '@/lib/services/azure-openai-service';
import { firebaseVerification } from '@/lib/services/firebase-verification';

// Initialize Azure OpenAI service
let azureInitialized = false;
const initializeAzure = async () => {
  if (!azureInitialized) {
    azureInitialized = await azureOpenAIService.initialize();
  }
  return azureInitialized;
};

export async function POST(request: NextRequest) {
  try {
    // Extract session cookie and verify user authentication
    const sessionCookie = request.cookies.get('session')?.value;
    
    if (!sessionCookie) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Verify the session token
    const verificationResult = await firebaseVerification.verifyIdToken(sessionCookie);
    
    if (!verificationResult.success || !verificationResult.decodedToken) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      );
    }
    
    const { resumeText, jobDescription } = await request.json();

    // Validate input
    if (!resumeText || !jobDescription) {
      return NextResponse.json(
        { error: 'Both resume text and job description are required' },
        { status: 400 }
      );
    }

    // Check for reasonable length limits
    if (resumeText.length > 50000 || jobDescription.length > 50000) {
      return NextResponse.json(
        { error: 'Text length exceeds maximum limit (50,000 characters)' },
        { status: 400 }
      );
    }

    // Initialize Azure OpenAI service
    const isAzureReady = await initializeAzure();
    if (!isAzureReady) {
      return NextResponse.json(
        { error: 'Azure OpenAI service is not available. Please try again later.' },
        { status: 503 }
      );
    }

    // Generate tailored resume using Azure OpenAI
    const tailoredContent = await azureOpenAIService.tailorResume(resumeText, jobDescription);

    return NextResponse.json({ 
      tailoredResume: tailoredContent,
      success: true 
    });

  } catch (error: any) {
    console.error('Resume tailoring API error:', error);
    
    // Handle Azure OpenAI specific errors
    if (error.status) {
      switch (error.status) {
        case 401:
          return NextResponse.json(
            { error: 'Authentication failed with Azure OpenAI service.' },
            { status: 401 }
          );
        case 400:
          return NextResponse.json(
            { error: 'Invalid request format. Please check your input and try again.' },
            { status: 400 }
          );
        case 429:
          return NextResponse.json(
            { error: 'Service temporarily unavailable due to usage limits. Please try again later.' },
            { status: 429 }
          );
        case 500:
        case 502:
        case 503:
        case 504:
          return NextResponse.json(
            { error: 'Azure OpenAI service is temporarily unavailable. Please try again later.' },
            { status: 500 }
          );
      }
    }
    
    // Handle general error scenarios
    if (error instanceof Error) {
      if (error.message.includes('not initialized')) {
        return NextResponse.json(
          { error: 'Service is not properly configured. Please contact support.' },
          { status: 500 }
        );
      }
      if (error.message.includes('API key') || error.message.includes('credentials')) {
        return NextResponse.json(
          { error: 'API configuration error. Please contact support.' },
          { status: 500 }
        );
      }
      if (error.message.includes('quota') || error.message.includes('limit') || error.message.includes('rate')) {
        return NextResponse.json(
          { error: 'Service temporarily unavailable due to usage limits. Please try again later.' },
          { status: 429 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to generate tailored resume. Please try again.' },
      { status: 500 }
    );
  }
}
