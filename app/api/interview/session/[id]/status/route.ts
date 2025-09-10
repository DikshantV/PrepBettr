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
 * GET /api/interview/session/[id]/status
 * 
 * Get current status of an interview session
 * 
 * Path Parameters:
 * - id: sessionId (string)
 * 
 * Query Parameters:
 * - refresh?: boolean (force refresh timing data)
 * 
 * Response:
 * - status: WorkflowStatus (complete status object)
 * - timing: real-time timing information
 * - progress: percentage and stage information
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const sessionId = resolvedParams.id;
  
  try {
    const { searchParams } = new URL(request.url);
    const refresh = searchParams.get('refresh') === 'true';

    if (!sessionId) {
      return NextResponse.json({
        error: 'Session ID is required'
      }, { status: 400 });
    }

    console.log(`[API] Getting status for session: ${sessionId}${refresh ? ' (refresh)' : ''}`);

    // Get current workflow status
    const status = await getWorkflow().getStatus(sessionId);

    return NextResponse.json({
      success: true,
      sessionId,
      status,
      timestamp: Date.now(),
      // Additional computed fields for convenience
      computed: {
        isActive: status.state === 'in-progress',
        isCompleted: status.state === 'completed',
        canAdvance: status.currentStageIndex < status.totalStages && status.state !== 'failed',
        currentStageName: status.currentStage ? 
          status.stages.find(s => s.stage.id === status.currentStage)?.stage.name : 
          null,
        nextStageName: status.currentStageIndex < status.totalStages ? 
          status.stages[status.currentStageIndex]?.stage.name : 
          null,
        estimatedCompletionTime: new Date(status.timing.startTime + status.timing.totalEstimatedMinutes * 60000).toISOString(),
        healthStatus: status.error ? 'error' : status.state === 'failed' ? 'failed' : 'healthy'
      }
    });

  } catch (error: any) {
    console.error(`[API] Error getting session status:`, error);
    
    if (error.code === 'SESSION_NOT_FOUND') {
      return NextResponse.json({
        success: false,
        error: 'Session not found',
        sessionId: resolvedParams.id
      }, { status: 404 });
    }

    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to get session status',
      code: error.code || 'UNKNOWN_ERROR',
      sessionId: resolvedParams.id
    }, { status: 500 });
  }
}
