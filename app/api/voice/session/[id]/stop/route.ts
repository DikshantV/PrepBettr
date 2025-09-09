/**
 * POST /api/voice/session/[id]/stop
 * 
 * Stops an active Azure AI Foundry voice session and cleans up resources.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getVoiceLiveClient } from '@/src/lib/azure-ai-foundry/voice/voice-live-client';
import { VoiceSession } from '@/src/lib/azure-ai-foundry/voice/voice-session';

/**
 * Request body schema
 */
interface StopSessionRequest {
  graceful?: boolean;
}

/**
 * Response schema
 */
interface StopSessionResponse {
  success: boolean;
  sessionId: string;
  message: string;
  error?: string;
  stoppedAt: string;
}

/**
 * Route parameters
 */
interface RouteParams {
  id: string;
}

/**
 * Validate session ID format
 */
function validateSessionId(sessionId: string): { isValid: boolean; error?: string } {
  if (!sessionId || typeof sessionId !== 'string') {
    return { isValid: false, error: 'Session ID is required' };
  }

  if (sessionId.length < 10 || sessionId.length > 100) {
    return { isValid: false, error: 'Invalid session ID format' };
  }

  // Basic format validation (adjust as needed for Azure session IDs)
  if (!/^[a-zA-Z0-9\-_]+$/.test(sessionId)) {
    return { isValid: false, error: 'Session ID contains invalid characters' };
  }

  return { isValid: true };
}

/**
 * POST handler for stopping voice sessions
 */
export async function POST(
  request: NextRequest,
  { params }: { params: RouteParams }
): Promise<NextResponse<StopSessionResponse>> {
  try {
    const sessionId = params.id;
    console.log(`🛑 [API] Stopping voice session: ${sessionId}`);

    // Validate session ID
    const sessionValidation = validateSessionId(sessionId);
    if (!sessionValidation.isValid) {
      console.error('❌ [API] Invalid session ID:', sessionValidation.error);
      return NextResponse.json({
        success: false,
        sessionId,
        message: 'Failed to stop session',
        error: sessionValidation.error,
        stoppedAt: new Date().toISOString()
      }, { status: 400 });
    }

    // Parse request body
    let body: StopSessionRequest = {};
    try {
      const requestBody = await request.text();
      if (requestBody.trim()) {
        body = JSON.parse(requestBody);
      }
    } catch (error) {
      console.warn('⚠️ [API] Invalid JSON in request body, using defaults:', error);
      // Continue with defaults if JSON is invalid
    }

    const graceful = body.graceful ?? true;

    // Get voice client and find session
    const voiceClient = getVoiceLiveClient();
    const sessionMeta = voiceClient.getSession(sessionId);

    if (!sessionMeta) {
      console.warn(`⚠️ [API] Session not found: ${sessionId}`);
      return NextResponse.json({
        success: false,
        sessionId,
        message: 'Session not found',
        error: 'Session does not exist or has already been stopped',
        stoppedAt: new Date().toISOString()
      }, { status: 404 });
    }

    // Create VoiceSession instance and stop it
    const voiceSession = new VoiceSession(voiceClient, sessionMeta);
    
    try {
      await voiceSession.stop(graceful);
      
      console.log(`✅ [API] Voice session stopped: ${sessionId}`);
      
      return NextResponse.json({
        success: true,
        sessionId,
        message: graceful ? 'Session stopped gracefully' : 'Session force stopped',
        stoppedAt: new Date().toISOString()
      }, { status: 200 });

    } catch (stopError) {
      console.error(`❌ [API] Error stopping session ${sessionId}:`, stopError);
      
      // Even if stopping failed, remove from client's active sessions
      voiceClient.removeSession(sessionId);
      
      return NextResponse.json({
        success: false,
        sessionId,
        message: 'Session stopped with errors',
        error: stopError instanceof Error ? stopError.message : 'Unknown error during stop',
        stoppedAt: new Date().toISOString()
      }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ [API] Failed to stop voice session:', error);
    
    const sessionId = params.id || 'unknown';
    
    return NextResponse.json({
      success: false,
      sessionId,
      message: 'Failed to stop session',
      error: error instanceof Error ? error.message : 'Internal server error',
      stoppedAt: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * GET handler for session status check
 */
export async function GET(
  request: NextRequest,
  { params }: { params: RouteParams }
): Promise<NextResponse> {
  const sessionId = params.id;
  
  // Validate session ID
  const sessionValidation = validateSessionId(sessionId);
  if (!sessionValidation.isValid) {
    return NextResponse.json({
      error: sessionValidation.error
    }, { status: 400 });
  }

  // Get voice client and check session status
  const voiceClient = getVoiceLiveClient();
  const sessionMeta = voiceClient.getSession(sessionId);

  if (!sessionMeta) {
    return NextResponse.json({
      sessionId,
      exists: false,
      message: 'Session not found'
    }, { status: 404 });
  }

  return NextResponse.json({
    sessionId,
    exists: true,
    createdAt: sessionMeta.createdAt.toISOString(),
    options: sessionMeta.options,
    message: 'Session is active'
  });
}
