/**
 * Voice Agent Bridge React Hook
 * 
 * Integrates Azure AI Foundry voice system with existing agent state management.
 * Provides a seamless bridge between real-time voice interactions and React state.
 */

import { useReducer, useEffect, useCallback, useRef, useState } from 'react';
import { VoiceAgentBridge } from './voice-agent-bridge';
import { VoiceSession } from './voice-session';
import { voiceInsights } from './voice-insights';
import type {
  VoiceSessionTelemetry,
  VoiceErrorTelemetry,
  VoiceMetricsTelemetry,
  VoiceUsageTelemetry
} from './voice-insights';
import { logger } from '@/lib/utils/logger';
import { showErrorNotification } from '@/lib/utils/error-utils';

// Import existing agent state management
import {
  AgentState,
  InterviewState,
  agentReducer,
  initialAgentState,
  createStartInterviewAction,
  createEndInterviewAction,
  createAddUserMessageAction,
  createAddAIMessageAction,
  createUserSpokeAction,
  selectIsRecording,
  selectIsProcessing,
  selectIsSpeaking,
  selectIsWaiting,
  selectIsInterviewActive,
  selectIsInterviewFinished,
  selectShouldShowFeedback,
} from '@/lib/voice/agent-state';

import type {
  VoiceEventTypes,
  TranscriptEntry,
  VoiceSettings,
  AgentBridgeConfig,
  BridgeState,
  SentimentAnalysis,
  ConfigOptions
} from './types';

// ===== VOICE BRIDGE STATE =====

interface VoiceBridgeState {
  bridge: VoiceAgentBridge | null;
  voiceSession: VoiceSession | null;
  sessionId: string | null;
  connectionState: 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';
  lastError: string | null;
  retryCount: number;
  isInitializing: boolean;
}

const initialVoiceBridgeState: VoiceBridgeState = {
  bridge: null,
  voiceSession: null,
  sessionId: null,
  connectionState: 'idle',
  lastError: null,
  retryCount: 0,
  isInitializing: false,
};

type VoiceBridgeAction =
  | { type: 'BRIDGE_INITIALIZING' }
  | { type: 'BRIDGE_CREATED'; payload: { bridge: VoiceAgentBridge; voiceSession: VoiceSession; sessionId: string } }
  | { type: 'CONNECTION_STATE_CHANGED'; payload: 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error' }
  | { type: 'ERROR_OCCURRED'; payload: string }
  | { type: 'RETRY_ATTEMPTED' }
  | { type: 'BRIDGE_DESTROYED' };

function voiceBridgeReducer(state: VoiceBridgeState, action: VoiceBridgeAction): VoiceBridgeState {
  switch (action.type) {
    case 'BRIDGE_INITIALIZING':
      return {
        ...state,
        isInitializing: true,
        lastError: null,
        connectionState: 'connecting',
      };

    case 'BRIDGE_CREATED':
      return {
        ...state,
        bridge: action.payload.bridge,
        voiceSession: action.payload.voiceSession,
        sessionId: action.payload.sessionId,
        connectionState: 'connected',
        isInitializing: false,
        lastError: null,
        retryCount: 0,
      };

    case 'CONNECTION_STATE_CHANGED':
      return {
        ...state,
        connectionState: action.payload,
      };

    case 'ERROR_OCCURRED':
      return {
        ...state,
        lastError: action.payload,
        connectionState: 'error',
        isInitializing: false,
      };

    case 'RETRY_ATTEMPTED':
      return {
        ...state,
        retryCount: state.retryCount + 1,
        connectionState: 'connecting',
        lastError: null,
      };

    case 'BRIDGE_DESTROYED':
      return {
        ...initialVoiceBridgeState,
      };

    default:
      return state;
  }
}

// ===== HOOK CONFIGURATION =====

export interface UseVoiceAgentBridgeConfig {
  // Agent Configuration
  userName: string;
  userId: string;
  interviewId?: string;
  feedbackId?: string;
  type: string;
  questions?: string[];
  resumeInfo?: any;
  resumeQuestions?: string[];

  // Voice Configuration
  voiceSettings?: Partial<VoiceSettings>;
  bridgeConfig?: Partial<AgentBridgeConfig>;

  // Callbacks
  onTranscriptReceived?: (entry: TranscriptEntry) => void;
  onSentimentAnalysis?: (sentiment: SentimentAnalysis) => void;
  onAgentResponse?: (response: { agent: string; text: string; audioData?: string }) => void;
  onSessionError?: (error: Error) => void;
}

export interface VoiceAgentBridgeResult {
  // Agent State (existing compatibility)
  state: AgentState;
  dispatch: React.Dispatch<any>;

  // Voice Bridge State
  voiceBridge: VoiceBridgeState;
  
  // Session Controls
  startVoiceSession: () => Promise<void>;
  stopVoiceSession: () => Promise<void>;
  retryConnection: () => Promise<void>;

  // Recording Controls  
  startRecording: () => void;
  stopRecording: () => void;

  // Agent Controls
  handoffToAgent: (agentName: string, context?: any) => Promise<void>;
  sendResponse: (text: string, audioData?: string) => Promise<void>;

  // State Selectors (existing compatibility)
  isRecording: boolean;
  isProcessing: boolean;
  isSpeaking: boolean;
  isWaiting: boolean;
  isInterviewActive: boolean;
  isInterviewFinished: boolean;
  shouldShowFeedback: boolean;
  
  // Voice-specific State
  isVoiceConnected: boolean;
  canStartRecording: boolean;
  sessionMetrics: {
    connectionLatency: number;
    audioLatency: number;
    transcriptionAccuracy: number;
  } | null;
}

// ===== MAIN HOOK IMPLEMENTATION =====

export function useVoiceAgentBridge(config: UseVoiceAgentBridgeConfig): VoiceAgentBridgeResult {
  // Existing agent state management
  const [agentState, agentDispatch] = useReducer(agentReducer, initialAgentState);
  
  // Voice bridge state management
  const [voiceBridgeState, voiceBridgeDispatch] = useReducer(voiceBridgeReducer, initialVoiceBridgeState);
  
  // Session metrics tracking with Application Insights integration
  const [sessionMetrics, setSessionMetrics] = useState<{
    connectionLatency: number;
    audioLatency: number;
    transcriptionAccuracy: number;
  } | null>(null);
  
  // Initialize voice insights with user context
  useEffect(() => {
    if (config.userId) {
      voiceInsights.setUser(config.userId, config.interviewId);
    }
    return () => {
      voiceInsights.clearUser();
    };
  }, [config.userId, config.interviewId]);

  // Refs for cleanup and avoiding stale closures
  const bridgeRef = useRef<VoiceAgentBridge | null>(null);
  const voiceSessionRef = useRef<VoiceSession | null>(null);
  const configRef = useRef(config);
  
  // Update config ref when config changes
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  // ===== VOICE SESSION MANAGEMENT =====

  const createVoiceSession = useCallback(async (): Promise<{ bridge: VoiceAgentBridge; voiceSession: VoiceSession; sessionId: string }> => {
    const currentConfig = configRef.current;
    
    try {
      logger.info('🚀 [Voice Bridge Hook] Creating voice session', {
        userId: currentConfig.userId,
        type: currentConfig.type
      });

      // Create voice session via API
      const response = await fetch('/api/voice/session/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          voiceName: currentConfig.voiceSettings?.voice || 'en-US-AriaNeural',
          locale: currentConfig.voiceSettings?.language || 'en-US',
          speakingRate: 1.0,
          emotionalTone: currentConfig.voiceSettings?.personality || 'professional',
          audioSettings: {
            noiseSuppression: true,
            echoCancellation: true,
            interruptionDetection: true,
            sampleRate: currentConfig.voiceSettings?.inputSampleRate || 16000
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create voice session');
      }

      const sessionData = await response.json();
      const sessionId = sessionData.sessionId;

      // Create VoiceLiveClient instance
      const { VoiceLiveClient } = await import('./voice-live-client');
      const voiceClient = new VoiceLiveClient();
      await voiceClient.init();
      
      // Create session metadata from API response
      const sessionMetadata = {
        sessionId,
        wsUrl: sessionData.wsUrl || sessionData.endpoint,
        options: {
          voiceName: currentConfig.voiceSettings?.voice || 'neural-hd-professional',
          locale: currentConfig.voiceSettings?.language || 'en-US',
          speakingPace: currentConfig.voiceSettings?.speakingPace || 'normal',
          emotionalTone: currentConfig.voiceSettings?.personality || 'professional',
          audioSettings: {
            noiseSuppression: true,
            echoCancellation: true,
            interruptionDetection: true,
            sampleRate: currentConfig.voiceSettings?.inputSampleRate || 16000
          }
        },
        createdAt: new Date()
      };

      // Create VoiceSession wrapper with client and metadata
      const voiceSession = new VoiceSession(voiceClient, sessionMetadata);

      // Create mock agent orchestrator for now
      const mockAgentOrchestrator = {
        handleInput: async (transcript: string, context: any) => {
          // This would normally route to the actual agent system
          // For now, we'll use the existing conversation processing
          logger.info('🤖 [Voice Bridge Hook] Processing agent input', {
            transcriptLength: transcript.length,
            sessionId: context.sessionId
          });
          
          // Add user message to agent state
          agentDispatch(createAddUserMessageAction(transcript));
          
          // Generate a simple response for now
          // In a real implementation, this would call the existing conversation system
          const aiResponse = `Thank you for your response. Let me ask you another question about your experience.`;
          
          return {
            text: aiResponse,
            audioData: undefined // Will be synthesized by Azure
          };
        },
        handoff: async (agentName: string, context: any) => {
          logger.info('🔄 [Voice Bridge Hook] Agent handoff requested', {
            agentName,
            sessionId: context.sessionId
          });
          // Handle agent switching logic here
        }
      };

      // Create voice agent bridge
      const bridge = new VoiceAgentBridge(
        voiceSession,
        mockAgentOrchestrator,
        {
          sessionTimeout: 1800000, // 30 minutes
          maxRetries: 3,
          errorRecoveryMode: 'graceful',
          sentimentMonitoring: true,
          recordingEnabled: true,
          transcriptStorage: 'both',
          ...currentConfig.bridgeConfig
        }
      );

      // Set up bridge event handlers
      setupBridgeEventHandlers(bridge, agentDispatch, currentConfig);

      logger.success('✅ [Voice Bridge Hook] Voice session created', {
        sessionId,
        agentType: currentConfig.type
      });

      return { bridge, voiceSession, sessionId };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create voice session';
      logger.error('❌ [Voice Bridge Hook] Failed to create voice session', error);
      
      // Note: VoiceTelemetry.trackError expects sessionId as second param
      const sessionId = 'creation_failed_' + Date.now();
      // Import VoiceTelemetry directly from voice-telemetry
      const { VoiceTelemetry } = await import('./voice-telemetry');
      VoiceTelemetry.trackError(
        error instanceof Error ? error : new Error(errorMessage),
        sessionId,
        'SESSION_CREATION_FAILED',
        false // don't notify user - this will be handled by the caller
      );

      throw new Error(errorMessage);
    }
  }, []);

  // ===== BRIDGE EVENT HANDLERS =====

  const setupBridgeEventHandlers = useCallback((
    bridge: VoiceAgentBridge,
    dispatch: React.Dispatch<any>,
    currentConfig: UseVoiceAgentBridgeConfig
  ) => {
    // Transcript events
    bridge.on('transcript:final', (event) => {
      logger.info('📝 [Voice Bridge Hook] Transcript received', {
        speaker: event.entry.speaker,
        textLength: event.entry.text.length,
        confidence: event.entry.confidence
      });

      if (event.entry.speaker === 'user') {
        // Mark user as having spoken if first speech detected
        if (!agentState.hasUserSpoken) {
          dispatch(createUserSpokeAction());
        }
        
        dispatch(createAddUserMessageAction(event.entry.text));
        dispatch({ type: 'STOP_RECORDING' });
        dispatch({ type: 'START_PROCESSING' });
      }

      // Call user callback if provided
      currentConfig.onTranscriptReceived?.(event.entry);
    });

    // Agent response events
    bridge.on('agent:response', (event) => {
      logger.info('🗣️ [Voice Bridge Hook] Agent response received', {
        agent: event.agent,
        textLength: event.text.length,
        hasAudio: !!event.audioData
      });

      dispatch(createAddAIMessageAction(event.text));
      dispatch({ type: 'START_SPEAKING' });

      // Call user callback if provided
      currentConfig.onAgentResponse?.(event);

      // Auto-transition back to waiting after response
      setTimeout(() => {
        dispatch({ type: 'RESET_TO_WAITING' });
        
        // Auto-start recording for next user input if interview is still active
        if (agentState.interviewState === InterviewState.ACTIVE) {
          setTimeout(() => {
            if (voiceBridgeState.connectionState === 'connected') {
              dispatch({ type: 'START_RECORDING' });
            }
          }, 1000);
        }
      }, 2000);
    });

    // Session events
    bridge.on('session:started', (event) => {
      logger.info('🎙️ [Voice Bridge Hook] Voice session started', {
        sessionId: event.sessionId,
        agent: event.agent
      });
      
      voiceBridgeDispatch({ type: 'CONNECTION_STATE_CHANGED', payload: 'connected' });
    });

    bridge.on('session:ended', (event) => {
      logger.info('🏁 [Voice Bridge Hook] Voice session ended', {
        sessionId: event.sessionId,
        reason: event.reason
      });
      
      voiceBridgeDispatch({ type: 'CONNECTION_STATE_CHANGED', payload: 'disconnected' });
    });

    bridge.on('session:error', (event) => {
      logger.error('💥 [Voice Bridge Hook] Voice session error', event.error);
      
      voiceBridgeDispatch({
        type: 'ERROR_OCCURRED',
        payload: event.error.message
      });

      // Call user callback if provided
      currentConfig.onSessionError?.(event.error);
      
      showErrorNotification(event.error);
    });

    // Sentiment analysis events
    bridge.on('sentiment:analysis', (event) => {
      logger.info('💭 [Voice Bridge Hook] Sentiment analysis', {
        sessionId: event.sessionId,
        sentiment: event.sentiment.label,
        score: event.sentiment.score
      });

      // Update session metrics
      setSessionMetrics(prev => ({
        connectionLatency: prev?.connectionLatency || 0,
        audioLatency: prev?.audioLatency || 0,
        transcriptionAccuracy: event.sentiment.confidence,
      }));

      // Call user callback if provided
      currentConfig.onSentimentAnalysis?.(event.sentiment);
    });

    // Audio synthesis events
    bridge.on('audio:synthesis:complete', (event) => {
      logger.info('🎵 [Voice Bridge Hook] Audio synthesis complete', {
        sessionId: event.sessionId,
        hasAudioData: !!event.audioData
      });
    });

  }, [agentState.hasUserSpoken, agentState.interviewState, voiceBridgeState.connectionState]);

  // ===== SESSION CONTROL FUNCTIONS =====

  const startVoiceSession = useCallback(async (): Promise<void> => {
    if (voiceBridgeState.isInitializing) {
      logger.warn('⚠️ [Voice Bridge Hook] Session creation already in progress');
      return;
    }

    try {
      voiceBridgeDispatch({ type: 'BRIDGE_INITIALIZING' });

      const { bridge, voiceSession, sessionId } = await createVoiceSession();

      // Store references
      bridgeRef.current = bridge;
      voiceSessionRef.current = voiceSession;

      // Start the bridge
      await bridge.start();

      voiceBridgeDispatch({
        type: 'BRIDGE_CREATED',
        payload: { bridge, voiceSession, sessionId }
      });

      // Start the interview in agent state
      agentDispatch(createStartInterviewAction());

      logger.success('✅ [Voice Bridge Hook] Voice session started successfully');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start voice session';
      voiceBridgeDispatch({
        type: 'ERROR_OCCURRED',
        payload: errorMessage
      });
      throw error;
    }
  }, [voiceBridgeState.isInitializing, createVoiceSession]);

  const stopVoiceSession = useCallback(async (): Promise<void> => {
    try {
      if (bridgeRef.current) {
        bridgeRef.current.stop();
        bridgeRef.current = null;
      }

      if (voiceSessionRef.current) {
        voiceSessionRef.current.stop();
        voiceSessionRef.current = null;
      }

      voiceBridgeDispatch({ type: 'BRIDGE_DESTROYED' });
      agentDispatch(createEndInterviewAction());

      logger.success('✅ [Voice Bridge Hook] Voice session stopped successfully');

    } catch (error) {
      logger.error('❌ [Voice Bridge Hook] Failed to stop voice session', error);
      throw error;
    }
  }, []);

  const retryConnection = useCallback(async (): Promise<void> => {
    logger.info('🔄 [Voice Bridge Hook] Retrying connection');
    
    voiceBridgeDispatch({ type: 'RETRY_ATTEMPTED' });
    
    try {
      // Stop existing session if any
      if (bridgeRef.current) {
        bridgeRef.current.stop();
      }
      
      // Wait a bit before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Start new session
      await startVoiceSession();
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Retry failed';
      voiceBridgeDispatch({
        type: 'ERROR_OCCURRED',
        payload: errorMessage
      });
      throw error;
    }
  }, [startVoiceSession]);

  // ===== RECORDING CONTROLS =====

  const startRecording = useCallback(() => {
    if (voiceBridgeState.connectionState === 'connected' && bridgeRef.current) {
      agentDispatch({ type: 'START_RECORDING' });
      logger.audio.record('🎤 [Voice Bridge Hook] Started recording via bridge');
    }
  }, [voiceBridgeState.connectionState]);

  const stopRecording = useCallback(() => {
    if (voiceBridgeState.connectionState === 'connected' && bridgeRef.current) {
      agentDispatch({ type: 'STOP_RECORDING' });
      logger.audio.record('⏹️ [Voice Bridge Hook] Stopped recording via bridge');
    }
  }, [voiceBridgeState.connectionState]);

  // ===== AGENT CONTROLS =====

  const handoffToAgent = useCallback(async (agentName: string, context?: any): Promise<void> => {
    if (bridgeRef.current) {
      await bridgeRef.current.handoffToAgent(agentName, context);
    }
  }, []);

  const sendResponse = useCallback(async (text: string, audioData?: string): Promise<void> => {
    if (bridgeRef.current) {
      await bridgeRef.current.sendAudioResponse(text, audioData);
    }
  }, []);

  // ===== CLEANUP ON UNMOUNT =====

  useEffect(() => {
    return () => {
      if (bridgeRef.current) {
        bridgeRef.current.stop();
      }
      if (voiceSessionRef.current) {
        voiceSessionRef.current.stop();
      }
    };
  }, []);

  // ===== DERIVED STATE SELECTORS =====

  const isRecording = selectIsRecording(agentState);
  const isProcessing = selectIsProcessing(agentState);
  const isSpeaking = selectIsSpeaking(agentState);
  const isWaiting = selectIsWaiting(agentState);
  const isInterviewActive = selectIsInterviewActive(agentState);
  const isInterviewFinished = selectIsInterviewFinished(agentState);
  const shouldShowFeedback = selectShouldShowFeedback(agentState);

  const isVoiceConnected = voiceBridgeState.connectionState === 'connected';
  const canStartRecording = isVoiceConnected && !isRecording && (isWaiting || isInterviewActive);

  // ===== RETURN HOOK RESULT =====

  return {
    // Agent State (existing compatibility)
    state: agentState,
    dispatch: agentDispatch,

    // Voice Bridge State
    voiceBridge: voiceBridgeState,

    // Session Controls
    startVoiceSession,
    stopVoiceSession,
    retryConnection,

    // Recording Controls
    startRecording,
    stopRecording,

    // Agent Controls
    handoffToAgent,
    sendResponse,

    // State Selectors (existing compatibility)
    isRecording,
    isProcessing,
    isSpeaking,
    isWaiting,
    isInterviewActive,
    isInterviewFinished,
    shouldShowFeedback,

    // Voice-specific State
    isVoiceConnected,
    canStartRecording,
    sessionMetrics,
  };
}

export default useVoiceAgentBridge;
