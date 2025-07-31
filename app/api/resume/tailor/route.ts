import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { firebaseVerification } from '@/lib/services/firebase-verification';

// Initialize Google Generative AI with server-side environment variable
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '');

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

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
    const prompt = `You are an expert resume writer and ATS optimization specialist. Please tailor this resume to better match the following job description for maximum ATS compatibility and relevance.

JOB DESCRIPTION:
${jobDescription}

CURRENT RESUME:
${resumeText}

Please provide a tailored version of the resume that:
1. Uses keywords and phrases directly from the job description
2. Highlights relevant skills and experiences that match the job requirements
3. Maintains professional formatting and ATS-friendly structure
4. Uses strong action verbs and quantifiable achievements
5. Keeps the same overall length and format structure
6. Optimizes for Applicant Tracking Systems (ATS)
7. Ensures keyword density without keyword stuffing

Return ONLY the tailored resume content with no additional commentary or explanations.`;

    const result = await model.generateContent(prompt);
    const tailoredContent = result.response.text();

    return NextResponse.json({ 
      tailoredResume: tailoredContent,
      success: true 
    });

  } catch (error) {
    console.error('Resume tailoring API error:', error);
    
    // Return appropriate error messages
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return NextResponse.json(
          { error: 'API configuration error. Please contact support.' },
          { status: 500 }
        );
      }
      if (error.message.includes('quota') || error.message.includes('limit')) {
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
