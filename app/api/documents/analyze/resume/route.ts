/**
 * Enhanced Resume Analysis API - App Router Endpoint
 * 
 * POST /api/documents/analyze/resume
 * 
 * Enhanced resume upload and analysis using Azure AI Foundry Document Intelligence.
 * Provides backward compatibility with existing upload endpoints while adding
 * advanced capabilities like ATS optimization and job matching.
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  enhancedResumeProcessingService,
  EnhancedResumeProcessingOptions
} from '@/lib/services/enhanced-resume-processing-service';
import { verifyIdToken } from '@/lib/firebase/admin';
import { logServerError } from '@/lib/errors';

export const runtime = 'nodejs';

interface AnalyzeResumeRequest {
  file: File;
  jobDescription?: string;
  options?: {
    generateQuestions?: boolean;
    maxQuestions?: number;
    includeAtsAnalysis?: boolean;
    includeJobMatching?: boolean;
    forceFoundryProcessing?: boolean;
  };
}

interface AnalyzeResumeResponse {
  success: boolean;
  data?: {
    resumeId: string;
    fileUrl: string;
    sasUrl?: string;
    extractedData: any;
    interviewQuestions: string[];
    storageProvider: string;
    // Enhanced fields
    atsScore?: number;
    jobMatchScore?: number;
    missingKeywords?: string[];
    processingMethod: string;
    processingTime: number;
    confidence?: number;
    recommendations?: Array<{
      category: string;
      priority: string;
      suggestion: string;
      impact: string;
    }>;
  };
  error?: string;
  message?: string;
}

/**
 * POST /api/documents/analyze/resume
 * Enhanced resume analysis with Azure AI Foundry Document Intelligence
 */
export async function POST(request: NextRequest): Promise<NextResponse<AnalyzeResumeResponse>> {
  const startTime = Date.now();
  
  try {
    console.log('📄 Enhanced resume analysis API called');

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
      userId = 'dev-user-enhanced-001';
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const jobDescription = formData.get('jobDescription') as string || undefined;
    const optionsJson = formData.get('options') as string;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file uploaded' },
        { status: 400 }
      );
    }

    // Validate file type and size
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

    const maxFileSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxFileSize) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'File size exceeds 10MB limit. Please use a smaller file.' 
        },
        { status: 400 }
      );
    }

    // Parse options
    let options: EnhancedResumeProcessingOptions = {
      generateQuestions: true,
      maxQuestions: 10,
      includeAtsAnalysis: true,
      includeJobMatching: !!jobDescription
    };

    if (optionsJson) {
      try {
        const parsedOptions = JSON.parse(optionsJson);
        options = { ...options, ...parsedOptions };
      } catch (parseError) {
        console.warn('⚠️ Failed to parse options JSON:', parseError);
      }
    }

    if (jobDescription) {
      options.jobDescription = jobDescription;
    }

    console.log(`📋 Processing options:`, {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      hasJobDescription: !!jobDescription,
      ...options
    });

    // Convert File to Buffer
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // Initialize and process resume using enhanced service
    const result = await enhancedResumeProcessingService.processResume(
      userId,
      fileBuffer,
      file.name,
      file.type,
      file.size,
      options
    );

    const totalTime = Date.now() - startTime;

    if (result.success && result.data) {
      console.log(`✅ Enhanced resume analysis completed in ${totalTime}ms`);
      
      // Extract recommendations from ATS analysis if available
      let recommendations: any[] = [];
      if (result.data.extractedData && 'atsAnalysis' in result.data.extractedData) {
        const atsAnalysis = (result.data.extractedData as any).atsAnalysis;
        if (atsAnalysis && atsAnalysis.recommendations) {
          recommendations = atsAnalysis.recommendations.map((rec: string) => ({
            category: 'ats-optimization',
            priority: 'medium',
            suggestion: rec,
            impact: 'Improve ATS compatibility and keyword matching'
          }));
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          ...result.data,
          recommendations
        },
        message: `Resume analyzed successfully using ${result.data.processingMethod}`
      });

    } else {
      console.error(`❌ Enhanced resume analysis failed in ${totalTime}ms:`, result.error);
      
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to analyze resume'
        },
        { status: 500 }
      );
    }

  } catch (error: unknown) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ Enhanced resume analysis API error (${totalTime}ms):`, error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    logServerError(error as Error, {
      service: 'enhanced-resume-analysis-api',
      action: 'analyze'
    }, {
      processingTime: totalTime
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to analyze resume',
        message: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    );
  }
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
