import { NextRequest, NextResponse } from 'next/server';
import { firebaseVerification } from '@/lib/services/firebase-verification';
import { resumeProcessingService } from '@/lib/services/resume-processing-service';
import { 
  createErrorResponse, 
  logServerError, 
  mapErrorToResponse,
  ServerErrorContext 
} from '@/lib/errors';

export async function GET(request: NextRequest) {
  const requestUrl = request.url;
  const userAgent = request.headers.get('user-agent') || undefined;
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined;
  let userId: string | undefined;

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

    // Get URL parameters
    const url = new URL(request.url);
    const includeRawData = url.searchParams.get('includeRaw') === 'true';
    const refreshSAS = url.searchParams.get('refreshSAS') === 'true';

    // Retrieve user resume data
    const resumeData = await resumeProcessingService.getUserResumeData(userId!);

    if (!resumeData) {
      const errorResponse = createErrorResponse('No resume found for user', 404);
      return NextResponse.json(errorResponse, { status: errorResponse.status });
    }

    // Refresh SAS URL if requested and user has Azure blob
    let sasUrl = resumeData.sasUrl;
    if (refreshSAS && resumeData.blobName) {
      const newSasUrl = await resumeProcessingService.generateNewSASUrl(userId!, 24);
      if (newSasUrl) {
        sasUrl = newSasUrl;
      }
    }

    // Prepare response data
    const responseData = {
      userId: resumeData.userId,
      fileName: resumeData.fileName,
      fileUrl: resumeData.fileUrl,
      ...(sasUrl && { sasUrl }),
      extractedData: {
        personalInfo: resumeData.extractedData?.personalInfo || {},
        summary: resumeData.extractedData?.summary,
        skills: resumeData.extractedData?.skills || [],
        experience: resumeData.extractedData?.experience || [],
        education: resumeData.extractedData?.education || [],
        projects: resumeData.extractedData?.projects || [],
        certifications: resumeData.extractedData?.certifications || [],
        languages: resumeData.extractedData?.languages || []
      },
      interviewQuestions: resumeData.interviewQuestions || [],
      metadata: {
        fileSize: resumeData.metadata?.fileSize,
        uploadDate: resumeData.metadata?.uploadDate,
        lastModified: resumeData.metadata?.lastModified,
        mimeType: resumeData.metadata?.mimeType,
        storageProvider: resumeData.metadata?.storageProvider
      }
    };

    // Include raw extraction data for GDPR export if requested
    if (includeRawData && resumeData.extractedData?.rawExtraction) {
      responseData.rawExtraction = resumeData.extractedData.rawExtraction;
    }

    return NextResponse.json({
      success: true,
      data: responseData
    });

  } catch (error: any) {
    // Create server error context for logging
    const context: ServerErrorContext = {
      userId,
      url: requestUrl,
      method: 'GET',
      timestamp: new Date().toISOString(),
      userAgent,
      ip
    };

    // Log the server error with context
    logServerError(error, context, { endpoint: 'resume-profile' });

    // Map error to standardized response
    const errorResponse = mapErrorToResponse(error);
    return NextResponse.json(errorResponse, { status: errorResponse.status });
  }
}

// Export other HTTP methods with error responses
export async function POST() {
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
