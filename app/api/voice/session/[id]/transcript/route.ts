/**
 * GET /api/voice/session/[id]/transcript
 * 
 * Retrieves transcript events for an Azure AI Foundry voice session.
 * In future versions, this will use Redis or database for persistence.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getVoiceLiveClient } from '@/lib/azure-ai-foundry/voice/voice-live-client';

/**
 * Transcript entry structure
 */
interface TranscriptEntry {
  text: string;
  timestamp: number;
  confidence?: number;
  isFinal: boolean;
  source: 'user' | 'assistant';
  duration?: number;
}

/**
 * Response schema
 */
interface TranscriptResponse {
  success: boolean;
  sessionId: string;
  transcripts: TranscriptEntry[];
  totalEntries: number;
  error?: string;
  retrievedAt: string;
}

/**
 * Route parameters
 */
interface RouteParams {
  id: string;
}

/**
 * Query parameters
 */
interface QueryParams {
  limit?: string;
  offset?: string;
  final_only?: string;
  source?: string;
}

/**
 * In-memory storage for transcripts (replace with Redis/database in production)
 * Key: sessionId, Value: array of transcript entries
 */
const transcriptStorage = new Map<string, TranscriptEntry[]>();

/**
 * Add transcript entry to storage
 */
function addTranscriptEntry(sessionId: string, entry: TranscriptEntry): void {
  if (!transcriptStorage.has(sessionId)) {
    transcriptStorage.set(sessionId, []);
  }
  
  const transcripts = transcriptStorage.get(sessionId)!;
  transcripts.push(entry);
  
  // Limit storage to last 1000 entries per session to prevent memory issues
  if (transcripts.length > 1000) {
    transcripts.splice(0, transcripts.length - 1000);
  }
  
  console.log(`📝 [TranscriptStorage] Added entry for session ${sessionId}: "${entry.text.substring(0, 50)}..."`);
}

/**
 * Clear transcript storage for a session
 */
function clearTranscriptStorage(sessionId: string): void {
  transcriptStorage.delete(sessionId);
  console.log(`🗑️ [TranscriptStorage] Cleared storage for session ${sessionId}`);
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

  // Basic format validation
  if (!/^[a-zA-Z0-9\-_]+$/.test(sessionId)) {
    return { isValid: false, error: 'Session ID contains invalid characters' };
  }

  return { isValid: true };
}

/**
 * Parse and validate query parameters
 */
function parseQueryParams(searchParams: URLSearchParams): {
  limit: number;
  offset: number;
  finalOnly: boolean;
  source?: 'user' | 'assistant';
  isValid: boolean;
  error?: string;
} {
  let limit = 100; // Default limit
  let offset = 0;  // Default offset
  let finalOnly = false;
  let source: 'user' | 'assistant' | undefined;

  // Parse limit
  const limitParam = searchParams.get('limit');
  if (limitParam) {
    const parsedLimit = parseInt(limitParam, 10);
    if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 1000) {
      return { limit, offset, finalOnly, source, isValid: false, error: 'Limit must be between 1 and 1000' };
    }
    limit = parsedLimit;
  }

  // Parse offset
  const offsetParam = searchParams.get('offset');
  if (offsetParam) {
    const parsedOffset = parseInt(offsetParam, 10);
    if (isNaN(parsedOffset) || parsedOffset < 0) {
      return { limit, offset, finalOnly, source, isValid: false, error: 'Offset must be a non-negative number' };
    }
    offset = parsedOffset;
  }

  // Parse final_only
  const finalOnlyParam = searchParams.get('final_only');
  if (finalOnlyParam) {
    finalOnly = ['true', '1', 'yes'].includes(finalOnlyParam.toLowerCase());
  }

  // Parse source filter
  const sourceParam = searchParams.get('source');
  if (sourceParam) {
    if (!['user', 'assistant'].includes(sourceParam)) {
      return { limit, offset, finalOnly, source, isValid: false, error: 'Source must be either "user" or "assistant"' };
    }
    source = sourceParam as 'user' | 'assistant';
  }

  return { limit, offset, finalOnly, source, isValid: true };
}

/**
 * GET handler for retrieving session transcripts
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> }
): Promise<NextResponse<TranscriptResponse>> {
  try {
    const resolvedParams = await params;
    const sessionId = resolvedParams.id;
    console.log(`📖 [API] Retrieving transcripts for session: ${sessionId}`);

    // Validate session ID
    const sessionValidation = validateSessionId(sessionId);
    if (!sessionValidation.isValid) {
      console.error('❌ [API] Invalid session ID:', sessionValidation.error);
      return NextResponse.json({
        success: false,
        sessionId,
        transcripts: [],
        totalEntries: 0,
        error: sessionValidation.error,
        retrievedAt: new Date().toISOString()
      }, { status: 400 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const queryValidation = parseQueryParams(searchParams);
    if (!queryValidation.isValid) {
      console.error('❌ [API] Invalid query parameters:', queryValidation.error);
      return NextResponse.json({
        success: false,
        sessionId,
        transcripts: [],
        totalEntries: 0,
        error: queryValidation.error,
        retrievedAt: new Date().toISOString()
      }, { status: 400 });
    }

    const { limit, offset, finalOnly, source } = queryValidation;

    // Check if session exists in voice client
    const voiceClient = getVoiceLiveClient();
    const sessionMeta = voiceClient.getSession(sessionId);

    if (!sessionMeta) {
      console.warn(`⚠️ [API] Session not found in voice client: ${sessionId}`);
      // Still check transcript storage in case session was recently stopped
    }

    // Retrieve transcripts from storage
    let transcripts = transcriptStorage.get(sessionId) || [];

    // Apply filters
    if (finalOnly) {
      transcripts = transcripts.filter(entry => entry.isFinal);
    }

    if (source) {
      transcripts = transcripts.filter(entry => entry.source === source);
    }

    const totalEntries = transcripts.length;

    // Apply pagination
    const paginatedTranscripts = transcripts.slice(offset, offset + limit);

    console.log(`📖 [API] Retrieved ${paginatedTranscripts.length} transcripts (total: ${totalEntries}) for session ${sessionId}`);

    return NextResponse.json({
      success: true,
      sessionId,
      transcripts: paginatedTranscripts,
      totalEntries,
      retrievedAt: new Date().toISOString()
    }, { status: 200 });

  } catch (error) {
    console.error('❌ [API] Failed to retrieve transcripts:', error);
    
    const resolvedParams = await params;
    const sessionId = resolvedParams.id || 'unknown';
    
    return NextResponse.json({
      success: false,
      sessionId,
      transcripts: [],
      totalEntries: 0,
      error: error instanceof Error ? error.message : 'Internal server error',
      retrievedAt: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * DELETE handler for clearing session transcripts
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> }
): Promise<NextResponse> {
  try {
    const resolvedParams = await params;
    const sessionId = resolvedParams.id;
    console.log(`🗑️ [API] Clearing transcripts for session: ${sessionId}`);

    // Validate session ID
    const sessionValidation = validateSessionId(sessionId);
    if (!sessionValidation.isValid) {
      return NextResponse.json({
        error: sessionValidation.error
      }, { status: 400 });
    }

    // Clear transcript storage
    clearTranscriptStorage(sessionId);

    return NextResponse.json({
      success: true,
      sessionId,
      message: 'Transcripts cleared successfully',
      clearedAt: new Date().toISOString()
    }, { status: 200 });

  } catch (error) {
    console.error('❌ [API] Failed to clear transcripts:', error);
    
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}
