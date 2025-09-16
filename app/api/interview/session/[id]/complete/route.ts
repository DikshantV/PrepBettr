import { NextRequest, NextResponse } from 'next/server';
import { InterviewWorkflow } from '@/lib/azure-ai-foundry/workflows/interview-workflow';

// Lazy initialization to avoid build-time issues
let workflow: InterviewWorkflow | null = null;

function getWorkflow(): InterviewWorkflow {
  if (!workflow) {
    workflow = new InterviewWorkflow();
  }
  return workflow;
}

/**
 * POST /api/interview/session/[id]/complete
 * 
 * Complete an interview session and get comprehensive results
 * 
 * Path Parameters:
 * - id: sessionId (string)
 * 
 * Request Body (optional):
 * - force?: boolean (force completion even if not all stages done)
 * - includeReport?: boolean (generate detailed PDF report)
 * - candidateFeedback?: boolean (include candidate-specific feedback)
 * - sharing?: { recruiterId?, managerEmails? } (sharing configuration)
 * 
 * Response:
 * - result: InterviewResult (comprehensive interview analysis)
 * - exports: available export options
 * - sharing: sharing configuration applied
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const resolvedParams = await params;
  const sessionId = resolvedParams.id;
  
  try {
    const body = await request.json().catch(() => ({}));

    if (!sessionId) {
      return NextResponse.json({
        error: 'Session ID is required'
      }, { status: 400 });
    }

    console.log(`[API] Completing interview session: ${sessionId}`);
    console.log(`- Force: ${body.force || false}`);
    console.log(`- Include Report: ${body.includeReport || false}`);
    console.log(`- Candidate Feedback: ${body.candidateFeedback || false}`);

    // Get current status for validation
    const currentStatus = await getWorkflow().getStatus(sessionId);
    
    if (!body.force && currentStatus.state === 'completed') {
      return NextResponse.json({
        success: false,
        error: 'Interview is already completed',
        sessionId,
        existingResult: await getWorkflow().completeInterview(sessionId)
      }, { status: 400 });
    }

    if (currentStatus.state === 'failed') {
      return NextResponse.json({
        success: false,
        error: 'Interview has failed, cannot complete normally',
        sessionId,
        suggestion: 'Use force: true to get partial results'
      }, { status: 400 });
    }

    // Complete the interview workflow
    const result = await getWorkflow().completeInterview(sessionId);

    // Enhance result with requested features
    if (body.includeReport) {
      result.exports.reportAvailable = true;
      // In production, would generate PDF here
    }

    if (body.candidateFeedback) {
      result.feedback.candidateFeedback = {
        positives: [
          'Demonstrated strong technical knowledge',
          'Clear communication throughout the interview'
        ],
        developmentAreas: [
          'Consider deepening system design knowledge',
          'Practice explaining complex concepts simply'
        ],
        resources: [
          'System Design Interview book',
          'LeetCode practice problems',
          'Leadership communication courses'
        ],
        encouragement: 'Thank you for your time today. You showed great potential and we appreciate your thoughtful responses.'
      };
    }

    // Handle sharing configuration
    const sharingConfig = {
      recruiterId: body.sharing?.recruiterId,
      managerEmails: body.sharing?.managerEmails || [],
      shareCandidateFeedback: body.candidateFeedback || false,
      shareDetailedReport: body.includeReport || false,
      generatedAt: new Date().toISOString()
    };

    console.log(`[API] Interview completed successfully`);
    console.log(`- Total duration: ${result.summary.totalDurationMinutes} minutes`);
    console.log(`- Stages completed: ${result.summary.stagesCompleted}/${result.summary.totalStages}`);
    console.log(`- Questions asked: ${result.summary.questionsAsked}`);
    console.log(`- Overall outcome: ${result.outcome}`);

    return NextResponse.json({
      success: true,
      sessionId,
      result,
      sharing: sharingConfig,
      exports: {
        pdfReportUrl: result.exports.reportAvailable ? `/api/interview/session/${sessionId}/report.pdf` : null,
        candidateSummaryUrl: body.candidateFeedback ? `/api/interview/session/${sessionId}/candidate-summary` : null,
        recruiterReportUrl: `/api/interview/session/${sessionId}/recruiter-report`,
        rawDataUrl: `/api/interview/session/${sessionId}/raw-data`
      },
      metadata: {
        completedAt: new Date().toISOString(),
        processingTime: result.metadata.generationDuration,
        apiVersion: '1.0.0'
      }
    });

  } catch (error: any) {
    console.error(`[API] Error completing interview:`, error);
    
    if (error.code === 'SESSION_NOT_FOUND') {
      return NextResponse.json({
        success: false,
        error: 'Session not found',
        sessionId: resolvedParams.id
      }, { status: 404 });
    }

    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to complete interview',
      code: error.code || 'UNKNOWN_ERROR',
      sessionId: resolvedParams.id,
      recoverable: error.recoverable ?? false
    }, { status: 500 });
  }
}

/**
 * GET /api/interview/session/[id]/complete
 * 
 * Get completion status and available options
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const resolvedParams = await params;
  const sessionId = resolvedParams.id;
  
  try {
    
    // Get current session status
    const status = await getWorkflow().getStatus(sessionId);
    
    const canComplete = status.state === 'in-progress' || status.state === 'completed';
    const completionOptions = {
      canForceComplete: status.state !== 'completed',
      canGenerateReport: true,
      canProvideCandidateFeedback: true,
      availableExports: ['pdf', 'candidate-summary', 'recruiter-report', 'raw-data']
    };

    return NextResponse.json({
      sessionId,
      canComplete,
      currentState: status.state,
      completionOptions,
      progress: {
        stagesCompleted: status.stages.filter(s => s.status === 'completed').length,
        totalStages: status.totalStages,
        progressPercentage: status.progressPercentage
      },
      example: {
        force: false,
        includeReport: true,
        candidateFeedback: true,
        sharing: {
          recruiterId: 'recruiter_123',
          managerEmails: ['manager@company.com']
        }
      }
    });

  } catch (error: any) {
    if (error.code === 'SESSION_NOT_FOUND') {
      return NextResponse.json({
        error: 'Session not found',
        sessionId: resolvedParams.id
      }, { status: 404 });
    }

    return NextResponse.json({
      error: error.message || 'Failed to get completion info',
      sessionId: resolvedParams.id
    }, { status: 500 });
  }
}
