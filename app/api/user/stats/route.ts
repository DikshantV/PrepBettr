/**
 * User Stats API Route - Updated to use Data Layer
 * Provides user statistics and analytics using the data layer
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
    const detailed = url.searchParams.get('detailed') === 'true';

    // Get user stats
    const statsResult = await updatedResumeService.getUserStats(userId);

    if (!statsResult.success) {
      return NextResponse.json(statsResult, { status: 500 });
    }

    // Basic stats response
    let response = {
      success: true,
      data: {
        user: {
          id: userId,
          stats: statsResult.stats
        }
      }
    };

    // Add detailed information if requested
    if (detailed) {
      try {
        const resumesResult = await updatedResumeService.getUserResumes(userId);
        const healthResult = await updatedResumeService.getHealthStatus();

        response.data = {
          ...response.data,
          resumes: {
            total: resumesResult.data?.length || 0,
            items: resumesResult.data?.slice(0, 5).map(resume => ({
              id: resume.id,
              fileName: resume.fileName,
              uploadDate: resume.uploadDate,
              atsScore: resume.atsScore,
              skills: resume.skills?.slice(0, 5) || []
            })) || []
          },
          system: {
            dataLayerHealthy: healthResult.healthy,
            timestamp: new Date().toISOString()
          }
        };
      } catch (error) {
        console.warn('Failed to fetch detailed stats:', error);
        // Continue with basic stats only
      }
    }

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('User stats GET error:', error);
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
    const body = await request.json();
    const { action, data } = body;

    switch (action) {
      case 'refresh':
        // Force refresh of user stats
        const refreshedStats = await updatedResumeService.getUserStats(userId);
        return NextResponse.json(refreshedStats, { 
          status: refreshedStats.success ? 200 : 500 
        });

      case 'batch_upload':
        // Handle batch resume upload
        if (!data || !Array.isArray(data.files)) {
          return NextResponse.json(
            { success: false, error: 'Files array required' },
            { status: 400 }
          );
        }

        // Convert base64 files to buffers (simplified example)
        const files = data.files.map((file: any) => ({
          fileName: file.fileName,
          fileBuffer: Buffer.from(file.content, 'base64'),
          fileSize: file.fileSize,
          fileType: file.fileType
        }));

        const batchResult = await updatedResumeService.batchUploadResumes(userId, files);
        return NextResponse.json(batchResult, { 
          status: batchResult.success ? 201 : 400 
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Unknown action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('User stats POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}