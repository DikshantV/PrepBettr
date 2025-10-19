/**
 * Resume API Route - Updated to use Data Layer
 * Provides RESTful API for resume operations with dual-write support
 */

import { NextRequest, NextResponse } from 'next/server';
import { updatedResumeService } from '@/lib/services/updated-resume-service';
import { authMiddleware } from '@/lib/middleware/auth';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await authMiddleware(request);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: 401 }
      );
    }

    const userId = authResult.user!.uid;
    const url = new URL(request.url);
    const resumeId = url.searchParams.get('id');
    const limit = url.searchParams.get('limit');

    // Get specific resume
    if (resumeId) {
      const result = await updatedResumeService.getResume(resumeId);
      
      // Verify user owns this resume
      if (result.success && result.resume && result.resume.userId !== userId) {
        return NextResponse.json(
          { success: false, error: 'Access denied' },
          { status: 403 }
        );
      }

      return NextResponse.json(result, { status: result.success ? 200 : 404 });
    }

    // Get user's resumes
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    const result = await updatedResumeService.getUserResumes(userId, limitNum);

    return NextResponse.json(result, { status: result.success ? 200 : 500 });

  } catch (error) {
    console.error('Resume GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await authMiddleware(request);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: 401 }
      );
    }

    const userId = authResult.user!.uid;

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    
    // Process resume
    const result = await updatedResumeService.uploadResume(
      userId,
      file.name,
      fileBuffer,
      file.size,
      file.type.split('/')[1] || 'pdf'
    );

    return NextResponse.json(result, { 
      status: result.success ? 201 : 400 
    });

  } catch (error) {
    console.error('Resume POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await authMiddleware(request);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: 401 }
      );
    }

    const userId = authResult.user!.uid;
    const body = await request.json();
    const { resumeId, updates } = body;

    if (!resumeId) {
      return NextResponse.json(
        { success: false, error: 'Resume ID required' },
        { status: 400 }
      );
    }

    // Verify ownership
    const existingResult = await updatedResumeService.getResume(resumeId);
    if (!existingResult.success || !existingResult.resume) {
      return NextResponse.json(
        { success: false, error: 'Resume not found' },
        { status: 404 }
      );
    }

    if (existingResult.resume.userId !== userId) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    // Update resume
    const result = await updatedResumeService.updateResume(resumeId, updates);

    return NextResponse.json(result, { 
      status: result.success ? 200 : 400 
    });

  } catch (error) {
    console.error('Resume PUT error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await authMiddleware(request);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: 401 }
      );
    }

    const userId = authResult.user!.uid;
    const url = new URL(request.url);
    const resumeId = url.searchParams.get('id');

    if (!resumeId) {
      return NextResponse.json(
        { success: false, error: 'Resume ID required' },
        { status: 400 }
      );
    }

    // Verify ownership
    const existingResult = await updatedResumeService.getResume(resumeId);
    if (!existingResult.success || !existingResult.resume) {
      return NextResponse.json(
        { success: false, error: 'Resume not found' },
        { status: 404 }
      );
    }

    if (existingResult.resume.userId !== userId) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    // Delete resume
    const result = await updatedResumeService.deleteResume(resumeId);

    return NextResponse.json(result, { 
      status: result.success ? 200 : 400 
    });

  } catch (error) {
    console.error('Resume DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}