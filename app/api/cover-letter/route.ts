
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { firebaseVerification } from '@/lib/services/firebase-verification';
import { 
  createErrorResponse, 
  logServerError, 
  ServerErrorContext 
} from '@/lib/errors';

// Initialize Google Generative AI with server-side environment variable
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '');

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

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
    const prompt = `You are an expert career coach and professional writer. Please generate a compelling cover letter based on the provided resume and job description.

JOB DESCRIPTION:
${jobDescription}

RESUME:
${resumeText}

Please generate a cover letter that:
1.  Is tailored to the specific job description.
2.  Highlights the most relevant skills and experiences from the resume.
3.  Has a professional and engaging tone.
4.  Is well-structured and easy to read.
5.  Is approximately 3-4 paragraphs long.

Return ONLY the cover letter content with no additional commentary or explanations.`;

    const result = await model.generateContent(prompt);
    const coverLetter = result.response.text();

    return NextResponse.json({ 
      coverLetter,
      success: true 
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

