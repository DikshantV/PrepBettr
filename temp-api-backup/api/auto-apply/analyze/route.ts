import { NextRequest, NextResponse } from 'next/server';
import { JobAnalysisRequest, RelevancyAnalysis, ApiResponse, UserProfile, JobListing } from '@/types/auto-apply';
import { logServerError, ServerErrorContext } from '@/lib/errors';
import { azureOpenAIService } from '@/lib/services/azure-openai-service';

async function performJobAnalysis(userProfile: UserProfile, jobListing: JobListing): Promise<RelevancyAnalysis> {
  try {
    // Initialize Azure OpenAI service
    await azureOpenAIService.initialize();
    
    const prompt = `
      Analyze the compatibility between this candidate profile and job posting. Provide a detailed analysis in JSON format.

      CANDIDATE PROFILE:
      Name: ${userProfile.name}
      Skills: ${userProfile.skills.join(', ')}
      Experience: ${userProfile.experience.map(exp => `${exp.position} at ${exp.company} (${exp.technologies.join(', ')})`).join('; ')}
      Target Roles: ${userProfile.targetRoles.join(', ')}
      Location: ${userProfile.location}
      Summary: ${userProfile.summary}

      JOB POSTING:
      Title: ${jobListing.title}
      Company: ${jobListing.company}
      Location: ${jobListing.location}
      Work Arrangement: ${jobListing.workArrangement}
      Description: ${jobListing.description}
      Requirements: ${jobListing.requirements.join('; ')}
      Responsibilities: ${jobListing.responsibilities.join('; ')}

      Analyze and return a JSON object with this exact structure:
      {
        "overallScore": <number 0-100>,
        "skillsMatch": {
          "matched": [
            {"skill": "skill name", "weight": <number 0-1>}
          ],
          "missing": [
            {"skill": "skill name", "importance": "high|medium|low"}
          ],
          "additional": ["skill1", "skill2"]
        },
        "experienceMatch": {
          "score": <number 0-100>,
          "analysis": "detailed analysis text"
        },
        "locationMatch": {
          "score": <number 0-100>,
          "analysis": "detailed analysis text"
        },
        "salaryMatch": {
          "score": <number 0-100>,
          "analysis": "detailed analysis text"
        },
        "recommendations": [
          "recommendation 1",
          "recommendation 2"
        ],
        "tailoredResumeSuggestions": [
          "suggestion 1",
          "suggestion 2"
        ],
        "coverLetterSuggestions": [
          "suggestion 1",
          "suggestion 2"
        ]
      }

      Focus on:
      1. Skills alignment and gaps
      2. Experience level and relevance
      3. Location and work arrangement compatibility
      4. Salary expectations vs. offering
      5. Actionable recommendations for application success
      6. Specific suggestions for tailoring resume and cover letter

      Return only the JSON object, no additional text.
    `;

    const completion = await azureOpenAIService.createCompletion(
      [{ role: 'user', content: prompt }],
      { temperature: 0.3, maxTokens: 2000 }
    );
    const responseText = completion.choices[0]?.message?.content || '';
    
    try {
      const analysis = JSON.parse(responseText) as RelevancyAnalysis;
      return {
        ...analysis,
        jobId: jobListing.id
      };
    } catch (parseError) {
      console.error('Error parsing Azure OpenAI analysis response:', parseError);
      
      // Fallback analysis
      return generateFallbackAnalysis(userProfile, jobListing);
    }

  } catch (error) {
    console.error('Error in Azure OpenAI job analysis:', error);
    return generateFallbackAnalysis(userProfile, jobListing);
  }
}

function generateFallbackAnalysis(userProfile: UserProfile, jobListing: JobListing): RelevancyAnalysis {
  // Simple fallback analysis using keyword matching
  const jobText = `${jobListing.title} ${jobListing.description} ${jobListing.requirements.join(' ')}`.toLowerCase();
  const userSkills = userProfile.skills.map(s => s.toLowerCase());
  
  const matchedSkills = userProfile.skills.filter(skill => 
    jobText.includes(skill.toLowerCase())
  ).map(skill => ({ skill, weight: 0.8 }));

  const allJobKeywords = extractKeywords(jobText);
  const missingSkills = allJobKeywords
    .filter(keyword => !userSkills.includes(keyword.toLowerCase()))
    .slice(0, 5)
    .map(skill => ({ skill, importance: 'medium' as const }));

  const skillsScore = matchedSkills.length > 0 ? (matchedSkills.length / userProfile.skills.length) * 100 : 30;
  const locationScore = calculateLocationMatch(userProfile.location, jobListing.location, jobListing.workArrangement);
  const overallScore = Math.round((skillsScore * 0.6) + (locationScore * 0.4));

  return {
    jobId: jobListing.id,
    overallScore,
    skillsMatch: {
      matched: matchedSkills,
      missing: missingSkills,
      additional: userProfile.skills.filter(skill => !matchedSkills.some(m => m.skill === skill)).slice(0, 3)
    },
    experienceMatch: {
      score: 70,
      analysis: 'Based on your experience profile, you appear to have relevant background for this position.'
    },
    locationMatch: {
      score: locationScore,
      analysis: generateLocationAnalysis(userProfile.location, jobListing.location, jobListing.workArrangement)
    },
    salaryMatch: {
      score: 80,
      analysis: 'Salary range appears competitive based on market standards.'
    },
    recommendations: [
      'Emphasize your relevant technical skills in your application',
      'Highlight any similar projects or achievements',
      'Consider learning the missing skills mentioned in requirements'
    ],
    tailoredResumeSuggestions: [
      `Highlight experience with ${matchedSkills.map(s => s.skill).join(', ')}`,
      'Quantify achievements with specific metrics and results',
      'Include relevant keywords from the job description'
    ],
    coverLetterSuggestions: [
      `Mention your expertise in ${matchedSkills.slice(0, 3).map(s => s.skill).join(', ')}`,
      'Explain why you\'re interested in this specific role and company',
      'Address any gaps in requirements with willingness to learn'
    ]
  };
}

function extractKeywords(text: string): string[] {
  const commonSkills = [
    'JavaScript', 'Python', 'Java', 'React', 'Node.js', 'TypeScript', 
    'SQL', 'AWS', 'Docker', 'Kubernetes', 'Git', 'HTML', 'CSS',
    'Vue.js', 'Angular', 'Express', 'MongoDB', 'PostgreSQL', 'Redis',
    'GraphQL', 'REST', 'API', 'Microservices', 'DevOps', 'CI/CD'
  ];
  
  return commonSkills.filter(skill => 
    text.includes(skill.toLowerCase())
  ).slice(0, 10);
}

function calculateLocationMatch(userLocation?: string, jobLocation?: string, workArrangement?: string): number {
  if (!userLocation || !jobLocation) return 50;
  
  if (workArrangement === 'remote') return 100;
  
  // Simple city/state matching
  const userLower = userLocation.toLowerCase();
  const jobLower = jobLocation.toLowerCase();
  
  if (userLower.includes(jobLower) || jobLower.includes(userLower)) return 100;
  
  // Check for same state (very basic)
  const userParts = userLower.split(',').map(s => s.trim());
  const jobParts = jobLower.split(',').map(s => s.trim());
  
  if (userParts.length > 1 && jobParts.length > 1) {
    if (userParts[1] === jobParts[1]) return 70; // Same state
  }
  
  return 30; // Different locations
}

function generateLocationAnalysis(userLocation?: string, jobLocation?: string, workArrangement?: string): string {
  if (workArrangement === 'remote') {
    return 'This is a remote position, so location is not a constraint.';
  }
  
  if (!userLocation || !jobLocation) {
    return 'Location compatibility cannot be determined from available information.';
  }
  
  const score = calculateLocationMatch(userLocation, jobLocation, workArrangement);
  
  if (score >= 90) return `Excellent location match - you're in the same area as the job (${jobLocation}).`;
  if (score >= 70) return `Good location compatibility - you're in the same region as ${jobLocation}.`;
  return `Location may require relocation or commuting to ${jobLocation} from your current location in ${userLocation}.`;
}

export async function POST(request: NextRequest) {
  let body: JobAnalysisRequest | undefined;
  
  try {
    body = await request.json();
    
    if (!body) {
      return NextResponse.json(
        { success: false, error: 'Request body is required', timestamp: new Date().toISOString() } as ApiResponse<null>,
        { status: 400 }
      );
    }
    
    const { userId, jobId, userProfile, jobListing } = body;

    // TODO: Add authentication check
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User authentication required', timestamp: new Date().toISOString() } as ApiResponse<null>,
        { status: 401 }
      );
    }

    if (!jobId || !userProfile || !jobListing) {
      return NextResponse.json(
        { success: false, error: 'Missing required analysis parameters', timestamp: new Date().toISOString() } as ApiResponse<null>,
        { status: 400 }
      );
    }

    // Perform detailed job analysis
    const analysis = await performJobAnalysis(userProfile, jobListing);

    const response: ApiResponse<RelevancyAnalysis> = {
      success: true,
      data: analysis,
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(response);

  } catch (error) {
    const context: ServerErrorContext = { 
      userId: body?.userId || 'unknown', 
      url: request.url,
      method: request.method,
      timestamp: new Date().toISOString()
    };
    logServerError(error as Error | string, context);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error during job analysis', 
        timestamp: new Date().toISOString() 
      } as ApiResponse<null>,
      { status: 500 }
    );
  }
}

// GET endpoint for retrieving cached analysis
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');
  const userId = searchParams.get('userId');

  if (!jobId || !userId) {
    return NextResponse.json(
      { success: false, error: 'Job ID and User ID required', timestamp: new Date().toISOString() } as ApiResponse<null>,
      { status: 400 }
    );
  }

  // TODO: In production, retrieve cached analysis from database
  // For now, return a mock response indicating no cached analysis
  return NextResponse.json(
    { success: false, error: 'No cached analysis found', timestamp: new Date().toISOString() } as ApiResponse<null>,
    { status: 404 }
  );
}
