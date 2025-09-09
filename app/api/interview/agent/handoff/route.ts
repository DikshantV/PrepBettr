import { NextRequest, NextResponse } from 'next/server';
import { InterviewWorkflow } from '@/src/lib/azure-ai-foundry/workflows/interview-workflow';
import type { AgentHandoff } from '@/src/lib/azure-ai-foundry/workflows/workflow-types';

const workflow = new InterviewWorkflow();

/**
 * POST /api/interview/agent/handoff
 * 
 * Trigger agent handoff and advance to next stage
 * 
 * Request Body:
 * - sessionId: string (required)
 * - fromAgent?: AgentType (current agent)
 * - toAgent?: AgentType (target agent, auto-determined if not provided)
 * - insights?: string[] (key insights to pass to next agent)
 * - focusAreas?: string[] (areas for next agent to focus on)
 * - instructions?: string (additional instructions for handoff)
 * - force?: boolean (force handoff even if current stage incomplete)
 * 
 * Response:
 * - success: boolean
 * - handoff: AgentHandoff information
 * - status: updated WorkflowStatus
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.sessionId) {
      return NextResponse.json({
        error: 'Session ID is required'
      }, { status: 400 });
    }

    const sessionId = body.sessionId;
    
    console.log(`[API] Agent handoff requested for session: ${sessionId}`);
    console.log(`- From: ${body.fromAgent || 'auto'}`);
    console.log(`- To: ${body.toAgent || 'auto'}`);
    console.log(`- Force: ${body.force || false}`);

    // Get current status to validate handoff
    const currentStatus = await workflow.getStatus(sessionId);
    
    // Validate that handoff is possible
    if (!body.force) {
      if (currentStatus.state === 'completed') {
        return NextResponse.json({
          success: false,
          error: 'Interview is already completed',
          code: 'INVALID_STATE'
        }, { status: 400 });
      }
      
      if (currentStatus.state === 'failed') {
        return NextResponse.json({
          success: false,
          error: 'Interview has failed, cannot perform handoff',
          code: 'INVALID_STATE'
        }, { status: 400 });
      }
      
      if (currentStatus.pendingAgents.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'No pending agents for handoff',
          code: 'INVALID_STATE'
        }, { status: 400 });
      }
    }

    // Determine agents for handoff
    const fromAgent = body.fromAgent || currentStatus.activeAgents[0];
    const toAgent = body.toAgent || currentStatus.pendingAgents[0];

    // Build handoff context
    const handoffContext: AgentHandoff = {
      sessionId,
      fromAgent,
      toAgent,
      context: {
        previousQuestions: [], // Would be populated from session state
        insights: body.insights || [
          `Completed ${currentStatus.currentStage} stage`,
          `Generated ${currentStatus.metrics.totalQuestionsGenerated} questions so far`
        ],
        focusAreas: body.focusAreas || [],
        instructions: body.instructions
      },
      timestamp: Date.now()
    };

    console.log(`[API] Executing handoff: ${fromAgent} → ${toAgent}`);

    // Trigger stage advancement (which handles the agent transition)
    await workflow.advanceStage(sessionId);
    
    // Get updated status
    const updatedStatus = await workflow.getStatus(sessionId);

    return NextResponse.json({
      success: true,
      sessionId,
      handoff: handoffContext,
      status: updatedStatus,
      message: `Agent handoff completed: ${fromAgent} → ${toAgent}`,
      timing: {
        handoffTimestamp: handoffContext.timestamp,
        nextStageStartTime: updatedStatus.stages[updatedStatus.currentStageIndex - 1]?.startTime
      }
    });

  } catch (error: any) {
    console.error('[API] Error during agent handoff:', error);
    
    if (error.code === 'SESSION_NOT_FOUND') {
      return NextResponse.json({
        success: false,
        error: 'Session not found',
        sessionId: body.sessionId
      }, { status: 404 });
    }

    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to execute agent handoff',
      code: error.code || 'UNKNOWN_ERROR',
      sessionId: body.sessionId,
      recoverable: error.recoverable ?? true
    }, { status: 500 });
  }
}

/**
 * GET /api/interview/agent/handoff
 * 
 * Get handoff API documentation
 */
export async function GET() {
  return NextResponse.json({
    endpoint: 'POST /api/interview/agent/handoff',
    description: 'Trigger agent handoff and advance to next interview stage',
    requiredFields: ['sessionId'],
    optionalFields: [
      'fromAgent',
      'toAgent',
      'insights',
      'focusAreas', 
      'instructions',
      'force'
    ],
    agentTypes: ['technical', 'behavioral', 'industry'],
    validTransitions: {
      technical: ['behavioral', 'industry'],
      behavioral: ['industry', 'wrap-up'],
      industry: ['wrap-up']
    },
    example: {
      sessionId: 'interview_abc123',
      fromAgent: 'technical',
      toAgent: 'behavioral',
      insights: [
        'Candidate shows strong algorithmic thinking',
        'Good understanding of system design principles'
      ],
      focusAreas: [
        'Leadership experience',
        'Team collaboration'
      ],
      instructions: 'Focus on senior-level behavioral scenarios'
    },
    notes: [
      'Agents are automatically determined based on stage progression if not specified',
      'Set force: true to skip validation checks',
      'Handoffs update session state and trigger next agent'
    ]
  });
}
