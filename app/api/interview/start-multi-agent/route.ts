import { NextRequest, NextResponse } from 'next/server';
import { InterviewWorkflow } from '@/src/lib/azure-ai-foundry/workflows/interview-workflow';
import type { InterviewConfig } from '@/src/lib/azure-ai-foundry/workflows/workflow-types';
import { nanoid } from 'nanoid';

const workflow = new InterviewWorkflow();

/**
 * POST /api/interview/start-multi-agent
 * 
 * Start a new multi-agent interview session
 * 
 * Request Body:
 * - role: string (required)
 * - experienceLevel: 'entry' | 'mid' | 'senior' | 'executive' (required)  
 * - industry?: string
 * - candidateProfile: { name, skills, ... } (required)
 * - companyInfo?: { name, industry, size, culture }
 * - customization?: { enabledStages, stageDurations, ... }
 * - metadata?: { source, recruiterId, ... }
 * 
 * Response: 
 * - sessionId: string
 * - status: WorkflowStatus
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.role || !body.experienceLevel || !body.candidateProfile?.name || !body.candidateProfile?.skills) {
      return NextResponse.json({
        error: 'Missing required fields',
        required: ['role', 'experienceLevel', 'candidateProfile.name', 'candidateProfile.skills']
      }, { status: 400 });
    }

    // Generate session ID if not provided
    const sessionId = body.sessionId || `interview_${nanoid(12)}`;

    // Build interview configuration
    const config: InterviewConfig = {
      sessionId,
      role: body.role,
      experienceLevel: body.experienceLevel,
      industry: body.industry,
      roleType: body.roleType,
      candidateProfile: {
        name: body.candidateProfile.name,
        email: body.candidateProfile.email,
        skills: body.candidateProfile.skills || [],
        previousRoles: body.candidateProfile.previousRoles || [],
        yearsExperience: body.candidateProfile.yearsExperience,
        education: body.candidateProfile.education,
        certifications: body.candidateProfile.certifications || []
      },
      companyInfo: body.companyInfo,
      customization: {
        enabledStages: body.customization?.enabledStages,
        stageDurations: body.customization?.stageDurations,
        maxDurationMinutes: body.customization?.maxDurationMinutes || 45,
        customInstructions: body.customization?.customInstructions,
        agentOverrides: body.customization?.agentOverrides,
        questionsPerStage: body.customization?.questionsPerStage,
        focusAreas: body.customization?.focusAreas
      },
      metadata: {
        source: body.metadata?.source || 'api',
        recruiterId: body.metadata?.recruiterId,
        jobPostingId: body.metadata?.jobPostingId,
        interviewType: body.metadata?.interviewType || 'screening',
        scheduledAt: body.metadata?.scheduledAt || new Date().toISOString(),
        tags: body.metadata?.tags || []
      }
    };

    console.log(`[API] Starting multi-agent interview for ${config.candidateProfile.name} - Role: ${config.role}`);

    // Start the interview workflow
    const startedSessionId = await workflow.startMultiAgentInterview(config);
    
    // Get initial status
    const status = await workflow.getStatus(startedSessionId);

    return NextResponse.json({
      success: true,
      sessionId: startedSessionId,
      status,
      message: 'Multi-agent interview started successfully'
    }, { status: 201 });

  } catch (error: any) {
    console.error('[API] Error starting multi-agent interview:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to start interview',
      code: error.code || 'UNKNOWN_ERROR',
      recoverable: error.recoverable ?? true
    }, { status: error.code === 'CONFIGURATION_ERROR' ? 400 : 500 });
  }
}

/**
 * GET /api/interview/start-multi-agent
 * 
 * Get API documentation and requirements
 */
export async function GET() {
  return NextResponse.json({
    endpoint: 'POST /api/interview/start-multi-agent',
    description: 'Start a new multi-agent interview session',
    requiredFields: [
      'role',
      'experienceLevel', 
      'candidateProfile.name',
      'candidateProfile.skills'
    ],
    optionalFields: [
      'sessionId',
      'industry',
      'roleType',
      'companyInfo',
      'customization',
      'metadata'
    ],
    experienceLevels: ['entry', 'mid', 'senior', 'executive'],
    defaultStages: ['technical', 'behavioral', 'industry', 'wrap-up'],
    defaultDurations: {
      technical: 15,
      behavioral: 10,
      industry: 10,
      'wrap-up': 5
    },
    example: {
      role: 'Senior Frontend Developer',
      experienceLevel: 'senior',
      candidateProfile: {
        name: 'John Doe',
        skills: ['React', 'TypeScript', 'Node.js'],
        yearsExperience: 5
      },
      companyInfo: {
        name: 'Tech Corp',
        industry: 'technology',
        size: 'medium'
      },
      customization: {
        enabledStages: ['technical', 'behavioral'],
        stageDurations: { technical: 20 }
      }
    }
  });
}
