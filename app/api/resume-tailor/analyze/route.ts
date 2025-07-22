import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getCurrentUser } from '@/lib/actions/auth.action';
import { withQuota } from '@/lib/middleware/quota-middleware';

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || '');

// Rate limiting map (in production, use Redis)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);
  
  if (!userLimit || now > userLimit.resetTime) {
    // Reset or create new limit
    rateLimitMap.set(userId, { count: 1, resetTime: now + 60 * 60 * 1000 }); // 1 hour
    return true;
  }
  
  if (userLimit.count >= 10) { // 10 requests per hour
    return false;
  }
  
  userLimit.count++;
  return true;
}

async function handleResumeAnalysis(request: NextRequest, context?: { userId: string }) {
  try {
    // Get user ID from context (passed by middleware) - try getCurrentUser as fallback in dev mode
    let userId = context?.userId;
    
    if (!userId && process.env.NODE_ENV !== 'production') {
      console.log('[DEV MODE] No userId in context, trying getCurrentUser fallback');
      try {
        const currentUser = await getCurrentUser();
        userId = currentUser?.id || 'dev-user-' + Date.now();
      } catch (error) {
        console.log('[DEV MODE] getCurrentUser failed, using mock ID');
        userId = 'dev-user-' + Date.now();
      }
    }
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID not available' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { resumeText, jobDescription, config } = body;

    // Validate input
    if (!resumeText || !jobDescription) {
      return NextResponse.json(
        { success: false, error: 'Resume text and job description are required' },
        { status: 400 }
      );
    }

    if (resumeText.length > 20000 || jobDescription.length > 10000) {
      return NextResponse.json(
        { success: false, error: 'Content too long. Please reduce the text length.' },
        { status: 400 }
      );
    }

    // Generate analysis and tailored resume
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
    
    const analysisPrompt = `You are an expert resume writer and ATS optimization specialist. Please analyze this resume against the job description and provide detailed feedback.

JOB DESCRIPTION:
${jobDescription}

CURRENT RESUME:
${resumeText}

Please provide a JSON response with the following structure:
{
  "matchScore": number (0-100),
  "keywordAnalysis": {
    "matched": ["keyword1", "keyword2"],
    "missing": ["keyword3", "keyword4"],
    "suggested": ["keyword5", "keyword6"]
  },
  "atsCompatibility": {
    "score": number (0-100),
    "issues": ["issue1", "issue2"],
    "recommendations": ["rec1", "rec2"]
  },
  "recommendations": [
    {
      "type": "add_keyword" | "improve_section" | "rewrite_bullet",
      "section": "experience" | "skills" | "summary",
      "priority": "high" | "medium" | "low",
      "description": "What needs to be changed",
      "suggestion": "Specific suggestion"
    }
  ],
  "tailoredResume": "The complete tailored resume content here"
}

Ensure the tailored resume:
1. Uses keywords from the job description naturally
2. Maintains professional ATS-friendly formatting
3. Uses strong action verbs and quantifiable achievements
4. Keeps the same overall structure and length
5. Optimizes for both human readers and ATS systems`;

    const result = await model.generateContent(analysisPrompt);
    const responseText = result.response.text();
    
    // Try to parse JSON response
    let analysisResult;
    try {
      // Clean the response to extract JSON
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      // Fallback: Create a structured response
      const tailoringPrompt = `You are an expert resume writer. Please tailor this resume to match the job description:

JOB DESCRIPTION:
${jobDescription}

RESUME:
${resumeText}

Please provide a tailored version that uses relevant keywords and highlights matching experiences. Return ONLY the tailored resume content.`;

      const tailoringResult = await model.generateContent(tailoringPrompt);
      const tailoredContent = tailoringResult.response.text();

      // Create fallback analysis
      analysisResult = {
        matchScore: 75,
        keywordAnalysis: {
          matched: [],
          missing: [],
          suggested: []
        },
        atsCompatibility: {
          score: 80,
          issues: [],
          recommendations: ['Use the AI-tailored version for better ATS compatibility']
        },
        recommendations: [
          {
            type: 'improve_section',
            section: 'overall',
            priority: 'high',
            description: 'Resume has been tailored using AI',
            suggestion: 'Review the tailored version and incorporate relevant changes'
          }
        ],
        tailoredResume: tailoredContent
      };
    }

    return NextResponse.json({
      success: true,
      data: {
        analysisId: `analysis_${Date.now()}_${userId}`,
        matchScore: analysisResult.matchScore || 75,
        keywordAnalysis: analysisResult.keywordAnalysis || {},
        atsCompatibility: analysisResult.atsCompatibility || { score: 80, issues: [], recommendations: [] },
        recommendations: analysisResult.recommendations || [],
        tailoredResume: analysisResult.tailoredResume || responseText,
        processingTime: Date.now()
      }
    });

  } catch (error) {
    console.error('Resume analysis error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to analyze resume. Please try again.'
      },
      { status: 500 }
    );
  }
}

// Apply quota middleware to the POST handler
export const POST = withQuota({
  featureKey: 'resumeTailor',
  limitFree: 2, // Free users can tailor 2 resumes
  usageDocId: undefined // Use the authenticated user's ID
})(handleResumeAnalysis);

// Handle preflight requests
export async function OPTIONS() {
  return NextResponse.json({ success: true }, { status: 200 });
}
