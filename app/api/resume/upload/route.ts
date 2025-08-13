import { NextRequest, NextResponse } from 'next/server';
import { firebaseVerification } from '@/lib/services/firebase-verification';
import { resumeProcessingService } from '@/lib/services/resume-processing-service';
import { 
  createErrorResponse, 
  logServerError, 
  mapErrorToResponse,
  ServerErrorContext 
} from '@/lib/errors';
import { telemetry } from '@/lib/utils/telemetry';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain'
];

export async function POST(request: NextRequest) {
  const requestUrl = request.url;
  const userAgent = request.headers.get('user-agent') || undefined;
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined;
  let userId: string | undefined;
  const startTime = Date.now();

  try {
    // Verify authentication
    const sessionCookie = request.cookies.get('session')?.value;

    if (!sessionCookie) {
      const errorResponse = createErrorResponse('Authentication required', 401);
      return NextResponse.json(errorResponse, { status: errorResponse.status });
    }

    const verificationResult = await firebaseVerification.verifyIdToken(sessionCookie);

    if (!verificationResult.success || !verificationResult.decodedToken) {
      const errorResponse = createErrorResponse('Invalid session', 401);
      return NextResponse.json(errorResponse, { status: errorResponse.status });
    }

    userId = verificationResult.decodedToken.uid;

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const generateQuestions = formData.get('generateQuestions') !== 'false'; // Default to true

    if (!file) {
      const errorResponse = createErrorResponse('No file uploaded', 400);
      return NextResponse.json(errorResponse, { status: errorResponse.status });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      const errorResponse = createErrorResponse('File size exceeds 10MB limit', 413);
      return NextResponse.json(errorResponse, { status: errorResponse.status });
    }

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      const errorResponse = createErrorResponse(
        'Invalid file type. Only PDF, DOC, DOCX, and TXT files are allowed.', 
        422
      );
      return NextResponse.json(errorResponse, { status: errorResponse.status });
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // Process the resume
    console.log(`📄 Processing resume upload for user ${userId}: ${file.name}`);
    
    // Track resume upload attempt
    await telemetry.trackUserAction({
      action: 'resume_upload_api_start',
      feature: 'resume_processing',
      userId: userId!,
      properties: {
        fileName: file.name,
        fileSize: file.size.toString(),
        mimeType: file.type,
        generateQuestions: generateQuestions.toString()
      }
    });
    
    const result = await resumeProcessingService.processResume(
      userId!,
      fileBuffer,
      file.name,
      file.type,
      file.size,
      {
        generateQuestions,
        maxQuestions: 10
      }
    );

    if (!result.success) {
      const errorResponse = createErrorResponse(
        result.error || 'Failed to process resume',
        500
      );
      return NextResponse.json(errorResponse, { status: errorResponse.status });
    }

    // Track successful resume processing
    const processingTime = Date.now() - startTime;
    await telemetry.trackResumeUpload(
      userId!,
      file.size,
      file.type,
      processingTime
    );
    
    await telemetry.trackUserAction({
      action: 'resume_upload_api_success',
      feature: 'resume_processing',
      userId: userId!,
      properties: {
        fileName: file.name,
        resumeId: result.data!.resumeId,
        questionsGenerated: result.data!.interviewQuestions?.length.toString() || '0',
        processingTimeMs: processingTime.toString(),
        storageProvider: result.data!.storageProvider
      }
    });
    
    await telemetry.trackBusinessMetric(
      'ResumeProcessingSuccess',
      1,
      userId!,
      {
        fileType: file.type,
        fileSize: Math.round(file.size / 1024).toString() + 'KB',
        processingTimeSeconds: Math.round(processingTime / 1000).toString()
      }
    );

    // Return success response
    return NextResponse.json({
      success: true,
      data: {
        message: 'Resume uploaded and processed successfully',
        resumeId: result.data!.resumeId,
        extractedData: {
          personalInfo: result.data!.extractedData.personalInfo,
          summary: result.data!.extractedData.summary,
          skills: result.data!.extractedData.skills,
          experience: result.data!.extractedData.experience,
          education: result.data!.extractedData.education,
          projects: result.data!.extractedData.projects,
          certifications: result.data!.extractedData.certifications,
          languages: result.data!.extractedData.languages
        },
        interviewQuestions: result.data!.interviewQuestions,
        storageProvider: result.data!.storageProvider,
        fileInfo: {
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          fileUrl: result.data!.fileUrl,
          ...(result.data!.sasUrl && { sasUrl: result.data!.sasUrl })
        }
      }
    });

  } catch (error: any) {
    // Track error
    await telemetry.trackError({
      error: error instanceof Error ? error : new Error(error.message || 'Unknown error'),
      userId,
      context: {
        endpoint: 'resume-upload',
        method: 'POST',
        url: requestUrl,
        userAgent: userAgent || 'unknown',
        processingTimeMs: (Date.now() - startTime).toString()
      }
    });
    
    // Create server error context for logging
    const context: ServerErrorContext = {
      userId,
      url: requestUrl,
      method: 'POST',
      timestamp: new Date().toISOString(),
      userAgent,
      ip
    };

    // Log the server error with context
    logServerError(error, context, { 
      endpoint: 'resume-upload',
      fileSize: error.fileInfo?.size,
      mimeType: error.fileInfo?.type
    });

    // Map error to standardized response
    const errorResponse = mapErrorToResponse(error);
    return NextResponse.json(errorResponse, { status: errorResponse.status });
  }
}

// Export other HTTP methods with error responses
export async function GET() {
  const errorResponse = createErrorResponse('Method not allowed', 405);
  return NextResponse.json(errorResponse, { status: errorResponse.status });
}

export async function PUT() {
  const errorResponse = createErrorResponse('Method not allowed', 405);
  return NextResponse.json(errorResponse, { status: errorResponse.status });
}

export async function DELETE() {
  const errorResponse = createErrorResponse('Method not allowed', 405);
  return NextResponse.json(errorResponse, { status: errorResponse.status });
}
