/**
 * POST /api/voice/session/start
 * 
 * Creates a new Azure AI Foundry voice session for real-time streaming.
 * Returns session ID and WebSocket URL for client connection.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getVoiceLiveClient } from '@/lib/azure-ai-foundry/voice/voice-live-client';
import type { VoiceSessionOptions } from '@/lib/azure-ai-foundry/voice/voice-live-client';

/**
 * Request body schema
 */
interface StartSessionRequest {
  voiceName?: string;
  locale?: string;
  speakingRate?: number;
  emotionalTone?: string;
  audioSettings?: {
    noiseSuppression?: boolean;
    echoCancellation?: boolean;
    interruptionDetection?: boolean;
    sampleRate?: number;
  };
}

/**
 * Response schema
 */
interface StartSessionResponse {
  sessionId: string;
  wsUrl: string;
  options: VoiceSessionOptions;
  createdAt: string;
  success: boolean;
  error?: string;
}

/**
 * Validate request body
 */
function validateStartSessionRequest(body: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (body.voiceName && typeof body.voiceName !== 'string') {
    errors.push('voiceName must be a string');
  }

  if (body.locale && typeof body.locale !== 'string') {
    errors.push('locale must be a string');
  }

  if (body.speakingRate && (typeof body.speakingRate !== 'number' || body.speakingRate <= 0 || body.speakingRate > 3)) {
    errors.push('speakingRate must be a number between 0 and 3');
  }

  if (body.emotionalTone && typeof body.emotionalTone !== 'string') {
    errors.push('emotionalTone must be a string');
  }

  if (body.audioSettings) {
    if (typeof body.audioSettings !== 'object') {
      errors.push('audioSettings must be an object');
    } else {
      const { noiseSuppression, echoCancellation, interruptionDetection, sampleRate } = body.audioSettings;
      
      if (noiseSuppression !== undefined && typeof noiseSuppression !== 'boolean') {
        errors.push('audioSettings.noiseSuppression must be a boolean');
      }
      
      if (echoCancellation !== undefined && typeof echoCancellation !== 'boolean') {
        errors.push('audioSettings.echoCancellation must be a boolean');
      }
      
      if (interruptionDetection !== undefined && typeof interruptionDetection !== 'boolean') {
        errors.push('audioSettings.interruptionDetection must be a boolean');
      }
      
      if (sampleRate !== undefined && (typeof sampleRate !== 'number' || ![8000, 16000, 24000, 48000].includes(sampleRate))) {
        errors.push('audioSettings.sampleRate must be one of: 8000, 16000, 24000, 48000');
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * POST handler for starting voice sessions
 */
export async function POST(request: NextRequest): Promise<NextResponse<StartSessionResponse>> {
  try {
    console.log('🚀 [API] Starting voice session...');
    
    // Parse request body
    let body: StartSessionRequest;
    try {
      body = await request.json();
    } catch (error) {
      console.error('❌ [API] Invalid JSON in request body:', error);
      return NextResponse.json({
        success: false,
        error: 'Invalid JSON in request body',
        sessionId: '',
        wsUrl: '',
        options: {},
        createdAt: new Date().toISOString()
      }, { status: 400 });
    }

    // Validate request body
    const validation = validateStartSessionRequest(body);
    if (!validation.isValid) {
      console.error('❌ [API] Request validation failed:', validation.errors);
      return NextResponse.json({
        success: false,
        error: `Validation failed: ${validation.errors.join(', ')}`,
        sessionId: '',
        wsUrl: '',
        options: {},
        createdAt: new Date().toISOString()
      }, { status: 400 });
    }

    // Create voice session options
    const sessionOptions: VoiceSessionOptions = {
      voiceName: body.voiceName,
      locale: body.locale,
      speakingRate: body.speakingRate,
      emotionalTone: body.emotionalTone,
      audioSettings: body.audioSettings
    };

    // Get voice client and create session
    const voiceClient = getVoiceLiveClient();
    const session = await voiceClient.createSession(sessionOptions);

    console.log(`✅ [API] Voice session created: ${session.sessionId}`);

    // Return session details with proxy WebSocket URL
    const baseUrl = request.nextUrl.origin;
    const proxyWsUrl = `${baseUrl.replace(/^http/, 'ws')}/api/voice/session/${session.sessionId}/ws`;
    
    const response: StartSessionResponse = {
      success: true,
      sessionId: session.sessionId,
      wsUrl: proxyWsUrl,
      options: session.options,
      createdAt: session.createdAt.toISOString()
    };

    return NextResponse.json(response, { status: 201 });

  } catch (error) {
    console.error('❌ [API] Failed to create voice session:', error);
    
    // Determine error message and status code
    let errorMessage = 'Internal server error';
    let statusCode = 500;

    if (error instanceof Error) {
      errorMessage = error.message;
      
      // Handle specific error types
      if (error.message.includes('configuration')) {
        statusCode = 503; // Service Unavailable
        errorMessage = 'Voice service configuration error';
      } else if (error.message.includes('Session creation failed')) {
        statusCode = 502; // Bad Gateway  
        errorMessage = 'Failed to create session with Azure AI Foundry';
      }
    }

    return NextResponse.json({
      success: false,
      error: errorMessage,
      sessionId: '',
      wsUrl: '',
      options: {},
      createdAt: new Date().toISOString()
    }, { status: statusCode });
  }
}

/**
 * GET handler for health check
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    endpoint: '/api/voice/session/start',
    method: 'POST',
    description: 'Create a new Azure AI Foundry voice session',
    status: 'available'
  });
}
