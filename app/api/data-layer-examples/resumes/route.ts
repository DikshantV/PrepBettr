/**
 * Resume Management API Routes
 * Examples of how to integrate the data layer with Next.js API routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDataLayerRepositories, measureOperation, metricsCollector } from '@/lib/data-layer/utils/integration';
import { IResumeDocument } from '@/lib/data-layer/interfaces/IDocuments';
import { nanoid } from 'nanoid';

/**
 * GET /api/data-layer-examples/resumes
 * Get user's resumes with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const minAtsScore = searchParams.get('minAtsScore');
    const maxAtsScore = searchParams.get('maxAtsScore');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const { resumeRepository } = await getDataLayerRepositories();

    // Measure the operation for performance tracking
    const result = await measureOperation(
      'get_user_resumes',
      async () => {
        // If ATS score filtering is requested
        if (minAtsScore && maxAtsScore) {
          return await resumeRepository.getResumesByAtsScore(
            parseInt(minAtsScore),
            parseInt(maxAtsScore)
          );
        }

        // If search terms are provided
        if (search) {
          const searchTerms = search.split(',').map(term => term.trim());
          return await resumeRepository.searchResumes(searchTerms);
        }

        // Default: get all user resumes
        return await resumeRepository.getResumesByUser(userId);
      },
      { userId, filters: { minAtsScore, maxAtsScore, search } }
    );

    if (!result.success) {
      console.error('Failed to get resumes:', result.error);
      return NextResponse.json(
        { error: result.error || 'Failed to retrieve resumes' },
        { status: 500 }
      );
    }

    // Apply pagination if needed
    let resumes = result.data || [];
    const total = resumes.length;

    if (limit > 0) {
      resumes = resumes.slice(offset, offset + limit);
    }

    return NextResponse.json({
      success: true,
      data: resumes,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      },
      // Include dual write information if available
      ...(('inconsistencyDetected' in result) && {
        dataIntegrity: {
          inconsistencyDetected: result.inconsistencyDetected,
          inconsistencyDetails: result.inconsistencyDetails
        }
      })
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/data-layer-examples/resumes
 * Create a new resume
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, fileName, fileContent, skills, experience } = body;

    if (!userId || !fileName) {
      return NextResponse.json(
        { error: 'userId and fileName are required' },
        { status: 400 }
      );
    }

    const { resumeRepository } = await getDataLayerRepositories();

    // Create resume document
    const resumeDocument: IResumeDocument = {
      id: nanoid(),
      userId,
      fileName,
      uploadDate: new Date().toISOString(),
      fileSize: fileContent ? Buffer.from(fileContent).length : 0,
      fileType: fileName.split('.').pop()?.toLowerCase() || 'unknown',
      skills: skills || [],
      experience: experience || [],
      // These would typically be calculated by AI processing
      atsScore: Math.floor(Math.random() * 100), // Placeholder
      parsedContent: fileContent ? 'Sample parsed content' : undefined,
      createdDate: new Date().toISOString(),
      updatedDate: new Date().toISOString()
    };

    const result = await measureOperation(
      'create_resume',
      () => resumeRepository.create(resumeDocument),
      { userId, fileName, fileSize: resumeDocument.fileSize }
    );

    if (!result.success) {
      console.error('Failed to create resume:', result.error);
      return NextResponse.json(
        { error: result.error || 'Failed to create resume' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      // Include dual write status if available
      ...(('primaryResult' in result && 'secondaryResult' in result) && {
        dualWriteStatus: {
          primarySuccess: result.primaryResult?.success,
          secondarySuccess: result.secondaryResult?.success,
          inconsistencyDetected: result.inconsistencyDetected
        }
      })
    }, { status: 201 });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/data-layer-examples/resumes/[id]
 * Update an existing resume
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { fileName, skills, experience, atsScore } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Resume ID is required' },
        { status: 400 }
      );
    }

    const { resumeRepository } = await getDataLayerRepositories();

    // Check if resume exists first
    const existsResult = await resumeRepository.exists(id);
    if (!existsResult.success || !existsResult.data) {
      return NextResponse.json(
        { error: 'Resume not found' },
        { status: 404 }
      );
    }

    // Prepare updates
    const updates: Partial<IResumeDocument> = {
      updatedDate: new Date().toISOString()
    };

    if (fileName !== undefined) updates.fileName = fileName;
    if (skills !== undefined) updates.skills = skills;
    if (experience !== undefined) updates.experience = experience;
    if (atsScore !== undefined) updates.atsScore = atsScore;

    const result = await measureOperation(
      'update_resume',
      () => resumeRepository.update(id, updates),
      { resumeId: id, updatedFields: Object.keys(updates) }
    );

    if (!result.success) {
      console.error('Failed to update resume:', result.error);
      return NextResponse.json(
        { error: result.error || 'Failed to update resume' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      // Include dual write information if available
      ...(('inconsistencyDetected' in result) && {
        dataIntegrity: {
          inconsistencyDetected: result.inconsistencyDetected,
          inconsistencyDetails: result.inconsistencyDetails
        }
      })
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/data-layer-examples/resumes/[id]
 * Delete a resume
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: 'Resume ID is required' },
        { status: 400 }
      );
    }

    const { resumeRepository } = await getDataLayerRepositories();

    const result = await measureOperation(
      'delete_resume',
      () => resumeRepository.delete(id),
      { resumeId: id }
    );

    if (!result.success) {
      console.error('Failed to delete resume:', result.error);
      return NextResponse.json(
        { error: result.error || 'Failed to delete resume' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Resume deleted successfully',
      // Include dual write status if available
      ...(('primaryResult' in result && 'secondaryResult' in result) && {
        dualWriteStatus: {
          primarySuccess: result.primaryResult?.success,
          secondarySuccess: result.secondaryResult?.success
        }
      })
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}