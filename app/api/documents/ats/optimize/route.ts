/**
 * ATS Optimization API - App Router Endpoint
 * 
 * POST /api/documents/ats/optimize
 * 
 * Provides ATS optimization analysis for resumes including:
 * - ATS compatibility scoring
 * - Job matching with semantic similarity
 * - Keyword analysis and optimization
 * - Skills normalization using industry taxonomies
 * - Detailed recommendations for improvement
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/firebase/admin';
import { atsOptimizationService, type ATSAnalysisResult, type JobMatchResult } from '@/lib/services/ats-optimization-service';
import { azureFormRecognizer } from '@/lib/services/azure-form-recognizer';
import { logServerError } from '@/lib/errors';

export const runtime = 'nodejs';

interface ATSOptimizeRequest {
  file?: File;
  resumeData?: any;
  jobDescription?: string;
  options?: {
    targetRole?: string;
    companyName?: string;
    targetIndustry?: string;
    experienceLevel?: 'entry' | 'mid' | 'senior' | 'executive';
    includeSkillsNormalization?: boolean;
    includeRecommendations?: boolean;
  };
}

interface ATSOptimizeResponse {
  success: boolean;
  data?: {
    atsAnalysis: ATSAnalysisResult;
    jobMatchAnalysis?: JobMatchResult;
    skillsNormalization?: any;
    resumeData?: any;
    processingTime: number;
    analysisTimestamp: string;
    recommendations: {
      immediate: Array<{
        category: string;
        priority: 'high' | 'medium' | 'low';
        action: string;
        expectedImpact: string;
        timeToImplement: string;
      }>;
      longTerm: Array<{
        category: string;
        skill: string;
        reasoning: string;
        learningResources: string[];
        timeframe: string;
      }>;
    };
  };
  error?: string;
  message?: string;
}

/**
 * POST /api/documents/ats/optimize
 * ATS optimization analysis for resume improvement
 */
export async function POST(request: NextRequest): Promise<NextResponse<ATSOptimizeResponse>> {
  const startTime = Date.now();
  
  try {
    console.log('🎯 ATS optimization API called');

    // Handle authentication
    const authHeader = request.headers.get('authorization');
    let userId: string;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const idToken = authHeader.split(' ')[1];
      const verificationResult = await verifyIdToken(idToken);
      
      if (!verificationResult.valid || !verificationResult.user) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized - Invalid token' },
          { status: 401 }
        );
      }
      userId = verificationResult.user.uid;
    } else if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - No token provided' },
        { status: 401 }
      );
    } else {
      console.warn('⚠️ Development mode: Using mock user ID');
      userId = 'dev-user-ats-001';
    }

    // Parse request data
    const contentType = request.headers.get('content-type') || '';
    let file: File | undefined;
    let resumeData: any;
    let jobDescription: string | undefined;
    let options: any = {};

    if (contentType.includes('multipart/form-data')) {
      // Handle file upload with form data
      const formData = await request.formData();
      file = formData.get('file') as File;
      jobDescription = formData.get('jobDescription') as string || undefined;
      const optionsJson = formData.get('options') as string;
      
      if (optionsJson) {
        try {
          options = JSON.parse(optionsJson);
        } catch (parseError) {
          console.warn('⚠️ Failed to parse options JSON:', parseError);
        }
      }
    } else {
      // Handle JSON request with existing resume data
      const body = await request.json();
      resumeData = body.resumeData;
      jobDescription = body.jobDescription;
      options = body.options || {};
    }

    // Validate input - need either file or resume data
    if (!file && !resumeData) {
      return NextResponse.json(
        { success: false, error: 'Either file or resumeData is required' },
        { status: 400 }
      );
    }

    // Extract resume data if file provided
    if (file && !resumeData) {
      console.log('📄 Extracting resume data from file...');
      
      // Validate file type
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
      ];

      if (!allowedTypes.includes(file.type)) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Unsupported file type. Please upload PDF, DOCX, DOC, or TXT files.' 
          },
          { status: 400 }
        );
      }

      // Validate file size
      const maxFileSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxFileSize) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'File size exceeds 10MB limit.' 
          },
          { status: 400 }
        );
      }

      try {
        const fileBuffer = Buffer.from(await file.arrayBuffer());
        resumeData = await azureFormRecognizer.extractResumeData(fileBuffer, file.type);
      } catch (extractionError) {
        console.error('❌ Resume data extraction failed:', extractionError);
        return NextResponse.json(
          { 
            success: false, 
            error: 'Failed to extract resume data from file' 
          },
          { status: 500 }
        );
      }
    }

    console.log('🔍 Starting ATS analysis with options:', {
      hasJobDescription: !!jobDescription,
      targetRole: options.targetRole,
      targetIndustry: options.targetIndustry,
      experienceLevel: options.experienceLevel
    });

    // Perform ATS analysis
    const atsAnalysis = await atsOptimizationService.analyzeATS(
      resumeData,
      jobDescription,
      options.targetIndustry
    );

    console.log(`✅ ATS analysis completed with score: ${atsAnalysis.atsScore}/100`);

    // Perform job matching if job description provided
    let jobMatchAnalysis: JobMatchResult | undefined;
    if (jobDescription) {
      console.log('🎯 Performing job matching analysis...');
      try {
        jobMatchAnalysis = await atsOptimizationService.analyzeJobMatch(
          resumeData,
          jobDescription,
          options.targetRole,
          options.experienceLevel
        );
        console.log(`✅ Job matching completed with score: ${jobMatchAnalysis.overallMatchScore}/100`);
      } catch (matchError) {
        console.warn('⚠️ Job matching analysis failed:', matchError);
      }
    }

    // Perform skills normalization if requested
    let skillsNormalization: any;
    if (options.includeSkillsNormalization && resumeData.skills) {
      console.log('🔧 Performing skills normalization...');
      try {
        const skillsList = Array.isArray(resumeData.skills) 
          ? resumeData.skills.map((s: any) => typeof s === 'string' ? s : s.skill || s.name)
          : [resumeData.skills];
        
        skillsNormalization = await atsOptimizationService.normalizeSkills(
          skillsList,
          options.targetIndustry,
          options.experienceLevel
        );
        console.log(`✅ Skills normalization completed for ${skillsList.length} skills`);
      } catch (skillsError) {
        console.warn('⚠️ Skills normalization failed:', skillsError);
      }
    }

    // Generate comprehensive recommendations
    const recommendations = generateRecommendations(
      atsAnalysis,
      jobMatchAnalysis,
      skillsNormalization
    );

    const processingTime = Date.now() - startTime;
    console.log(`✅ ATS optimization analysis completed in ${processingTime}ms`);

    return NextResponse.json({
      success: true,
      data: {
        atsAnalysis,
        jobMatchAnalysis,
        skillsNormalization,
        resumeData: file ? resumeData : undefined, // Include resume data only if extracted from file
        processingTime,
        analysisTimestamp: new Date().toISOString(),
        recommendations
      },
      message: `ATS analysis completed with score ${atsAnalysis.atsScore}/100`
    });

  } catch (error: unknown) {
    const processingTime = Date.now() - startTime;
    console.error(`❌ ATS optimization API error (${processingTime}ms):`, error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    logServerError(error as Error, {
      service: 'ats-optimization-api',
      action: 'optimize'
    }, {
      processingTime
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to perform ATS optimization analysis',
        message: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * Generate comprehensive recommendations from analysis results
 */
function generateRecommendations(
  atsAnalysis: ATSAnalysisResult,
  jobMatchAnalysis?: JobMatchResult,
  skillsNormalization?: any
): {
  immediate: Array<any>;
  longTerm: Array<any>;
} {
  const immediate: Array<any> = [];
  const longTerm: Array<any> = [];

  // Extract immediate recommendations from ATS analysis
  if (atsAnalysis.prioritizedRecommendations) {
    atsAnalysis.prioritizedRecommendations
      .filter(rec => rec.priority === 'high' || rec.priority === 'medium')
      .forEach(rec => {
        immediate.push({
          category: rec.category,
          priority: rec.priority,
          action: rec.recommendation,
          expectedImpact: rec.expectedImpact,
          timeToImplement: rec.timeToImplement
        });
      });
  }

  // Extract long-term recommendations from job matching
  if (jobMatchAnalysis?.recommendations) {
    jobMatchAnalysis.recommendations
      .filter(rec => rec.category === 'skills' && rec.priority === 'high')
      .forEach(rec => {
        longTerm.push({
          category: rec.category,
          skill: rec.recommendation,
          reasoning: rec.reasoning,
          learningResources: rec.resources,
          timeframe: rec.timeframe
        });
      });
  }

  // Extract skill development recommendations
  if (skillsNormalization?.industryAlignment?.recommendations) {
    skillsNormalization.industryAlignment.recommendations.forEach((rec: string) => {
      longTerm.push({
        category: 'skills',
        skill: 'Industry alignment',
        reasoning: rec,
        learningResources: ['Online courses', 'Industry certifications'],
        timeframe: '2-6 months'
      });
    });
  }

  return { immediate, longTerm };
}

/**
 * OPTIONS handler for CORS
 */
export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
