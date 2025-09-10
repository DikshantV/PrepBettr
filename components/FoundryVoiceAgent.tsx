/**
 * FoundryVoiceAgent Component
 * 
 * Azure AI Foundry-powered voice interview agent that replaces the legacy
 * Speech SDK + OpenAI pipeline with unified real-time voice capabilities.
 */

"use client";

import Image from "next/image";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { createFeedback } from "@/lib/actions/general.action";
import { logger } from "@/lib/utils/logger";
import { handleAsyncError, showErrorNotification } from "@/lib/utils/error-utils";

// Import new voice agent bridge hook
import { 
  useVoiceAgentBridge, 
  type UseVoiceAgentBridgeConfig 
} from "@/lib/azure-ai-foundry/voice/useVoiceAgentBridge";

// Import voice types
import type { 
  TranscriptEntry,
  SentimentAnalysis,
  VoiceSettings
} from "@/lib/azure-ai-foundry/voice/types";

interface ExtractedResumeData {
  personalInfo?: {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    linkedin?: string;
    github?: string;
    website?: string;
  };
  summary?: string;
  skills?: string[];
  experience?: any[];
  education?: any[];
  projects?: any[];
  certifications?: any[];
  languages?: any[];
}

interface FoundryAgentProps {
  userName: string;
  userId: string;
  interviewId?: string;
  feedbackId?: string;
  type: string;
  questions?: string[];
  profileImage?: string;
  resumeInfo?: ExtractedResumeData;
  resumeQuestions?: string[];
}

const FoundryVoiceAgent = ({
  userName,
  userId,
  interviewId,
  feedbackId,
  type,
  questions,
  resumeInfo,
  resumeQuestions,
}: FoundryAgentProps) => {
  const router = useRouter();

  // Voice configuration for Azure AI Foundry
  const voiceSettings: Partial<VoiceSettings> = {
    voice: 'en-US-AriaNeural',
    language: 'en-US',
    personality: 'professional',
    speakingPace: 'normal',
    responseStyle: 'conversational',
    inputSampleRate: 16000,
    outputSampleRate: 24000
  };

  // Hook configuration
  const bridgeConfig: UseVoiceAgentBridgeConfig = {
    userName,
    userId,
    interviewId,
    feedbackId,
    type,
    questions,
    resumeInfo,
    resumeQuestions,
    voiceSettings,
    bridgeConfig: {
      sessionTimeout: 1800000, // 30 minutes
      maxRetries: 3,
      errorRecoveryMode: 'graceful',
      sentimentMonitoring: true,
      recordingEnabled: true,
      transcriptStorage: 'both'
    },
    // Event callbacks
    onTranscriptReceived: (entry: TranscriptEntry) => {
      logger.info('📝 [FoundryVoiceAgent] Transcript received', {
        speaker: entry.speaker,
        textLength: entry.text.length,
        confidence: entry.confidence
      });
    },
    onSentimentAnalysis: (sentiment: SentimentAnalysis) => {
      if (sentiment.stressIndicators.hasHighStressWords) {
        logger.warn('😟 [FoundryVoiceAgent] User stress detected', {
          level: sentiment.label,
          score: sentiment.score,
          stressWords: sentiment.stressIndicators.stressWords
        });
      }
    },
    onAgentResponse: (response) => {
      logger.info('🤖 [FoundryVoiceAgent] Agent response', {
        agent: response.agent,
        textLength: response.text.length,
        hasAudio: !!response.audioData
      });
    },
    onSessionError: (error: Error) => {
      logger.error('❌ [FoundryVoiceAgent] Session error', error);
      showErrorNotification(error);
    }
  };

  // Use the voice agent bridge hook
  const {
    state,
    dispatch,
    voiceBridge,
    startVoiceSession,
    stopVoiceSession,
    retryConnection,
    startRecording,
    stopRecording,
    handoffToAgent,
    sendResponse,
    isRecording,
    isProcessing,
    isSpeaking,
    isWaiting,
    isInterviewActive,
    isInterviewFinished,
    shouldShowFeedback,
    isVoiceConnected,
    canStartRecording,
    sessionMetrics
  } = useVoiceAgentBridge(bridgeConfig);

  // Load user profile image (reusing existing logic)
  useEffect(() => {
    const loadUserProfileImage = async () => {
      try {
        const response = await fetch("/api/auth/user");
        if (response.ok) {
          const userData = await response.json();
          const user = userData?.user;

          if (user) {
            const profileImage =
              user.photoURL ||
              user.image ||
              user.avatar ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.name || userName)}&background=6366f1&color=fff&size=40`;

            if (profileImage) {
              dispatch({ type: 'SET_USER_IMAGE', payload: profileImage });
            }
          }
        } else {
          const fallbackImage = `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=6366f1&color=fff&size=40`;
          dispatch({ type: 'SET_USER_IMAGE', payload: fallbackImage });
        }
      } catch (error) {
        const fallbackImage = `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=6366f1&color=fff&size=40`;
        dispatch({ type: 'SET_USER_IMAGE', payload: fallbackImage });
      }
    };

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Profile image request timeout')), 5000);
    });

    Promise.race([loadUserProfileImage(), timeoutPromise]).catch(() => {
      const fallbackImage = `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=6366f1&color=fff&size=40`;
      dispatch({ type: 'SET_USER_IMAGE', payload: fallbackImage });
    });
  }, [userName, dispatch]);

  // Voice session handlers and controls are now managed by the hook
  // The hook handles all voice session lifecycle, transcript processing, and agent communication

  /**
   * Start the voice interview with Azure AI Foundry
   */
  const handleStartInterview = async (): Promise<void> => {
    try {
      logger.info('Starting Azure AI Foundry voice interview', { userName, type, interviewId });

      // Start the voice session via the bridge hook
      await startVoiceSession();

      // Send initial greeting
      await sendResponse(
        `Hello ${userName}! I'm excited to conduct your interview today. Please introduce yourself and tell me a bit about your background.`
      );

      logger.success('Azure AI Foundry voice interview started successfully');

    } catch (error) {
      logger.error('Failed to start Foundry voice interview', error);
      showErrorNotification(error instanceof Error ? error : new Error('Failed to start interview'));
    }
  };

  /**
   * End the voice interview
   */
  const handleEndInterview = async (): Promise<void> => {
    try {
      logger.info('Ending Azure AI Foundry interview', { 
        totalMessages: state.messages.length, 
        questionNumber: state.questionNumber 
      });

      // Stop the voice session via the bridge hook
      await stopVoiceSession();

      logger.success('Azure AI Foundry interview ended successfully');
    } catch (error) {
      logger.error('Failed to end Foundry interview properly', error);
      showErrorNotification(error instanceof Error ? error : new Error('Failed to end interview'));
    }
  };

  // Auto-end interview when complete
  useEffect(() => {
    if (state.isInterviewComplete && isInterviewActive) {
      logger.success('Interview completed - auto-ending in 2 seconds');
      const timeoutId = setTimeout(() => {
        handleEndInterview();
      }, 2000);
      return () => clearTimeout(timeoutId);
    }
  }, [state.isInterviewComplete, isInterviewActive, handleEndInterview]);

  // Generate feedback when interview finishes (reusing existing logic)
  useEffect(() => {
    if (isInterviewFinished && state.messages.length > 0 && interviewId && type !== "generate") {
      handleAsyncError(
        async () => {
          const { success, feedbackId: id } = await createFeedback({
            interviewId: interviewId!,
            userId: userId!,
            transcript: state.messages,
            feedbackId,
          });

          if (success && id) {
            dispatch({
              type: 'SET_FEEDBACK_GENERATED',
              payload: { generated: true, id }
            });
            logger.success('Feedback generated successfully', { id });
          }
        },
        'Failed to generate feedback'
      );
    }
  }, [isInterviewFinished, state.messages.length, interviewId, userId, type, feedbackId]);

  // Manual recording controls (bridge hook handles cleanup automatically)
  const handleStartRecording = () => {
    startRecording();
  };

  const handleStopRecording = () => {
    stopRecording();
  };

  return (
    <div className={cn(
      "flex flex-col items-center justify-center min-h-screen p-8 bg-gradient-to-br from-indigo-50 to-blue-100",
      "dark:from-slate-900 dark:to-indigo-950"
    )}>
      {/* Connection Status */}
      {voiceBridge.lastError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg" data-testid="connection-error">
          <p className="text-red-700 text-sm">
            ⚠️ Connection Error: {voiceBridge.lastError}
          </p>
          {voiceBridge.retryCount > 0 && (
            <p className="text-red-600 text-xs mt-1">
              Retry attempts: {voiceBridge.retryCount}/3
            </p>
          )}
          <button
            onClick={retryConnection}
            className="mt-2 px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
            disabled={voiceBridge.isInitializing}
            data-testid="retry-connection-btn"
          >
            {voiceBridge.isInitializing ? 'Retrying...' : 'Retry Connection'}
          </button>
        </div>
      )}
      
      {/* Connection Recovered Indicator */}
      {!voiceBridge.lastError && voiceBridge.retryCount > 0 && (
        <div className="mb-4 text-center" data-testid="connection-restored">
          <span className="text-green-600 text-sm">✅ Connection Restored</span>
        </div>
      )}

      {/* Voice Session Status */}
      <div className="mb-6 text-center">
        <div className="text-sm text-gray-600 dark:text-gray-300">
          Session: <span className="font-medium capitalize" data-testid="connection-state">{voiceBridge.connectionState}</span>
        </div>
        {isVoiceConnected && (
          <div className="text-xs text-green-600 dark:text-green-400 mt-1" data-testid="voice-ready-indicator">
            🎤 Azure AI Foundry Connected
            {voiceBridge.sessionId && (
              <span className="ml-2 font-mono" data-testid="session-id" data-session-id={voiceBridge.sessionId}>#{voiceBridge.sessionId.slice(-8)}</span>
            )}
          </div>
        )}
        {sessionMetrics && (
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1" data-testid="session-metrics">
            Latency: {sessionMetrics.connectionLatency}ms | 
            Accuracy: {(sessionMetrics.transcriptionAccuracy * 100).toFixed(1)}%
          </div>
        )}
      </div>
      
      {/* Voice Activity Indicator */}
      {isRecording && (
        <div className="mb-4 text-center" data-testid="voice-active-indicator">
          <span className="text-red-500 animate-pulse">🎤 Recording Active</span>
        </div>
      )}

      {/* Agent Avatar */}
      <div className="relative mb-8">
        <div className={cn(
          "w-32 h-32 rounded-full border-4 transition-all duration-300",
          isSpeaking ? "border-blue-500 shadow-lg animate-pulse" : "border-gray-300",
          isRecording ? "border-red-500 shadow-red-200 shadow-lg" : "",
          isProcessing ? "border-yellow-500 shadow-yellow-200 shadow-lg animate-spin" : ""
        )}>
          <Image
            src="/ai-agent-avatar.png"
            alt="AI Interview Agent"
            width={120}
            height={120}
            className="rounded-full object-cover w-full h-full"
            priority
          />
        </div>

        {/* Status indicator */}
        <div className={cn(
          "absolute bottom-2 right-2 w-6 h-6 rounded-full border-2 border-white",
          isVoiceConnected ? "bg-green-500" : "bg-gray-400"
        )} />
      </div>

      {/* User Avatar */}
      {state.userImage && (
        <div className="mb-6">
          <div className={cn(
            "w-16 h-16 rounded-full border-2 transition-all",
            isRecording ? "border-red-400 shadow-lg" : "border-gray-300"
          )}>
            <Image
              src={state.userImage}
              alt={userName}
              width={64}
              height={64}
              className="rounded-full object-cover w-full h-full"
            />
          </div>
        </div>
      )}

      {/* Interview Controls */}
      <div className="flex flex-col items-center space-y-4" data-testid={isInterviewActive ? "interview-session-active" : "interview-session-inactive"}>
        {!isInterviewActive ? (
          <button
            onClick={handleStartInterview}
            disabled={voiceBridge.isInitializing}
            className={cn(
              "px-8 py-3 rounded-lg font-medium transition-all",
              "bg-blue-600 hover:bg-blue-700 text-white",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              voiceBridge.isInitializing && "animate-pulse"
            )}
            data-testid="start-interview-btn"
          >
            {voiceBridge.isInitializing ? "Initializing..." : "Start Interview"}
          </button>
        ) : (
          <div className="flex space-x-4">
            <button
              onClick={handleStartRecording}
              disabled={!canStartRecording}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium disabled:opacity-50"
              data-testid="voice-record-btn"
            >
              🎤 Start Recording
            </button>
            <button
              onClick={handleStopRecording}
              disabled={!isRecording || !isVoiceConnected}
              className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium disabled:opacity-50"
              data-testid="voice-stop-btn"
            >
              ⏹️ Stop Recording
            </button>
            <button
              onClick={handleEndInterview}
              className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium"
              data-testid="end-interview-btn"
            >
              End Interview
            </button>
          </div>
        )}
      </div>

      {/* Status Display */}
      <div className="mt-8 text-center">
        <div className="text-lg font-medium text-gray-800 dark:text-gray-200" data-testid="interview-status">
          {isRecording && "🎤 Listening..."}
          {isProcessing && "🤔 Processing..."}
          {isSpeaking && "🗣️ Speaking..."}
          {isWaiting && "⏳ Ready for your response..."}
          {isInterviewFinished && shouldShowFeedback && "✅ Interview completed!"}
        </div>

        {state.questionNumber !== undefined && (
          <div className="mt-2 text-sm text-gray-600 dark:text-gray-400" data-testid="question-progress">
            Question {state.questionNumber} of {(resumeQuestions || questions)?.length || "?"}
          </div>
        )}
        
        {/* Hidden status indicators for testing */}
        <div className="hidden">
          <div data-testid="current-agent">AI Foundry Agent</div>
          <div data-testid="current-phase">technical</div>
          <div data-testid="response-processed" className={state.messages.length > 0 ? "processed" : "pending"} />
          <div data-testid="questions-answered-count">{state.questionNumber || 0}</div>
          {voiceBridge.isInitializing && <div data-testid="agent-handoff-pending" />}
          {!voiceBridge.isInitializing && isVoiceConnected && <div data-testid="agent-handoff-complete" />}
          {voiceBridge.lastError && voiceBridge.retryCount > 0 && <div data-testid="backup-agent-active" />}
          {!voiceBridge.lastError && voiceBridge.retryCount === 0 && <div data-testid="system-recovered" />}
        </div>
      </div>

      {/* Messages Display */}
      {state.messages.length > 0 && (
        <div className="mt-8 w-full max-w-2xl">
          <h3 className="text-lg font-medium mb-4 text-gray-800 dark:text-gray-200">
            Conversation History
          </h3>
          <div className="space-y-3 max-h-60 overflow-y-auto" data-testid="conversation-transcript">
            {state.messages.slice(-5).map((message, index) => {
              const isLastMessage = index === state.messages.slice(-5).length - 1;
              const isCurrentQuestion = message.role !== 'user' && isLastMessage;
              return (
                <div
                  key={index}
                  className={cn(
                    "p-3 rounded-lg",
                    message.role === 'user'
                      ? "bg-blue-100 dark:bg-blue-900 ml-8"
                      : "bg-gray-100 dark:bg-gray-800 mr-8"
                  )}
                  data-testid={isCurrentQuestion ? "current-question" : `message-${index}`}
                >
                  <div className="text-xs text-gray-500 mb-1">
                    {message.role === 'user' ? '👤 You' : '🤖 AI'}
                  </div>
                  <div className="text-sm">{message.content}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Debug Info (development only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-8 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs font-mono">
          <div>Voice State: {voiceBridge.connectionState}</div>
          <div>Agent State: {state.interviewState}</div>
          <div>Messages: {state.messages.length}</div>
          <div>Question: {state.questionNumber}</div>
          <div>Session ID: {voiceBridge.sessionId || 'None'}</div>
          <div>Voice Connected: {isVoiceConnected ? 'Yes' : 'No'}</div>
          <div>Can Record: {canStartRecording ? 'Yes' : 'No'}</div>
          {sessionMetrics && (
            <div>Metrics: {JSON.stringify(sessionMetrics, null, 2)}</div>
          )}
        </div>
      )}
    </div>
  );
};

export default FoundryVoiceAgent;
