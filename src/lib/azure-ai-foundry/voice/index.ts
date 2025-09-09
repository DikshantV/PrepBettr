/**
 * Azure AI Foundry Voice Module
 * 
 * Provides real-time voice streaming capabilities using Azure AI Foundry services.
 * This module includes WebSocket-based audio streaming, session management, and
 * transcript handling with automatic cleanup and error recovery.
 */

// Core client and session management
export {
  VoiceLiveClient,
  getVoiceLiveClient,
  type VoiceSessionOptions,
  type VoiceSession,
  type VoiceSettings,
  type ConnectionState,
  type VoiceWebSocketMessage,
  type AudioFrame
} from './voice-live-client';

// Session lifecycle management
export {
  VoiceSession as VoiceSessionClient,
  type TranscriptEvent,
  type AudioResponseEvent,
  type SessionState
} from './voice-session';

// Configuration and environment
export {
  getEnv,
  clearVoiceConfigCache,
  validateVoiceConfig,
  type VoiceEnvironmentConfig
} from './foundry-environment';

// Transcript storage utilities (for API endpoints)
export {
  addTranscriptEntry,
  clearTranscriptStorage
} from '../../app/api/voice/session/[id]/transcript/route';

/**
 * Quick start example:
 * 
 * ```typescript
 * import { getVoiceLiveClient, VoiceSessionClient } from '@/src/lib/azure-ai-foundry/voice';
 * 
 * // Create voice session
 * const client = getVoiceLiveClient();
 * const sessionMeta = await client.createSession({
 *   voiceName: 'neural-hd-professional',
 *   locale: 'en-US'
 * });
 * 
 * // Start streaming session
 * const session = new VoiceSessionClient(client, sessionMeta);
 * 
 * session.onTranscript((event) => {
 *   console.log('User said:', event.text);
 * });
 * 
 * session.onResponse((event) => {
 *   console.log('AI responded with audio');
 * });
 * 
 * await session.start();
 * ```
 */
