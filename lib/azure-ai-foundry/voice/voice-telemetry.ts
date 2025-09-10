/**
 * Azure AI Foundry Voice Telemetry
 * 
 * Provides structured logging, error handling, and metrics collection
 * specifically for the voice system with Application Insights integration.
 */

import { logger } from '@/lib/utils/logger';
import { reportError, showErrorNotification } from '@/lib/utils/error-utils';

// Type definitions for telemetry events
export interface VoiceTelemetryEvent {
  name: string;
  timestamp: number;
  sessionId?: string;
  userId?: string;
  properties?: Record<string, any>;
  measurements?: Record<string, number>;
}

export interface ConnectionMetrics {
  connectionTime: number;
  retryCount: number;
  reconnectCount: number;
  disconnectionReason?: string;
  networkLatency?: number;
}

export interface AudioMetrics {
  sttLatency: number;      // Speech-to-text latency
  ttsLatency: number;      // Text-to-speech latency
  audioQuality: number;    // 0-1 quality score
  voiceActivity: number;   // Voice activity detection score
  bufferUnderruns: number; // Audio buffer issues
}

export interface SessionMetrics {
  sessionDuration: number;
  messageCount: number;
  transcriptAccuracy: number;
  errorCount: number;
  userSatisfaction?: number;
}

/**
 * Voice system specific errors with context
 */
export class VoiceConnectionError extends Error {
  constructor(
    message: string,
    public sessionId?: string,
    public retryCount?: number,
    public lastError?: Error
  ) {
    super(message);
    this.name = 'VoiceConnectionError';
  }
}

export class VoiceAudioError extends Error {
  constructor(
    message: string,
    public sessionId?: string,
    public audioContext?: any,
    public sampleRate?: number
  ) {
    super(message);
    this.name = 'VoiceAudioError';
  }
}

export class VoiceSessionError extends Error {
  constructor(
    message: string,
    public sessionId?: string,
    public sessionState?: string,
    public lastAction?: string
  ) {
    super(message);
    this.name = 'VoiceSessionError';
  }
}

/**
 * Voice Telemetry Service
 */
export class VoiceTelemetryService {
  private events: VoiceTelemetryEvent[] = [];
  private sessionStartTime: number = 0;
  private lastEventTime: number = 0;
  
  // Metrics aggregation
  private connectionMetrics: Partial<ConnectionMetrics> = {};
  private audioMetrics: Partial<AudioMetrics> = {};
  private sessionMetrics: Partial<SessionMetrics> = {};

  /**
   * Initialize telemetry for a session
   */
  startSession(sessionId: string, userId?: string): void {
    this.sessionStartTime = Date.now();
    this.lastEventTime = this.sessionStartTime;
    
    this.logEvent('voice_session_started', {
      sessionId,
      userId,
      userAgent: navigator.userAgent,
      timestamp: this.sessionStartTime
    });

    // Initialize metrics
    this.connectionMetrics = {};
    this.audioMetrics = { bufferUnderruns: 0 };
    this.sessionMetrics = { messageCount: 0, errorCount: 0 };
  }

  /**
   * Log connection events with metrics
   */
  logConnectionEvent(
    event: 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'failed',
    sessionId: string,
    metrics?: Partial<ConnectionMetrics>
  ): void {
    const now = Date.now();
    const latency = now - this.lastEventTime;

    this.logEvent(`voice_connection_${event}`, {
      sessionId,
      latency,
      ...metrics
    }, {
      connection_time: metrics?.connectionTime || 0,
      retry_count: metrics?.retryCount || 0,
      network_latency: metrics?.networkLatency || latency
    });

    // Update connection metrics
    Object.assign(this.connectionMetrics, metrics);

    // Log specific connection issues
    if (event === 'failed' || event === 'disconnected') {
      this.sessionMetrics.errorCount = (this.sessionMetrics.errorCount || 0) + 1;
      
      if (metrics?.disconnectionReason) {
        logger.warn(`Voice connection ${event}: ${metrics.disconnectionReason}`, {
          sessionId,
          retryCount: metrics.retryCount,
          ...metrics
        });
      }
    }

    this.lastEventTime = now;
  }

  /**
   * Log audio processing events with performance metrics
   */
  logAudioEvent(
    event: 'stt_start' | 'stt_complete' | 'tts_start' | 'tts_complete' | 'audio_error' | 'buffer_underrun',
    sessionId: string,
    metrics?: Partial<AudioMetrics>
  ): void {
    const now = Date.now();
    const eventLatency = now - this.lastEventTime;

    this.logEvent(`voice_audio_${event}`, {
      sessionId,
      eventLatency,
      ...metrics
    }, {
      stt_latency: metrics?.sttLatency || 0,
      tts_latency: metrics?.ttsLatency || 0,
      audio_quality: metrics?.audioQuality || 0,
      voice_activity: metrics?.voiceActivity || 0
    });

    // Update audio metrics
    Object.assign(this.audioMetrics, metrics);

    // Track buffer issues
    if (event === 'buffer_underrun') {
      this.audioMetrics.bufferUnderruns = (this.audioMetrics.bufferUnderruns || 0) + 1;
      logger.warn('Audio buffer underrun detected', { sessionId, ...metrics });
    }

    // Log performance warnings
    if (metrics?.sttLatency && metrics.sttLatency > 2000) {
      logger.warn('High STT latency detected', { 
        sessionId, 
        latency: metrics.sttLatency,
        threshold: 2000 
      });
    }

    if (metrics?.ttsLatency && metrics.ttsLatency > 1500) {
      logger.warn('High TTS latency detected', { 
        sessionId, 
        latency: metrics.ttsLatency,
        threshold: 1500 
      });
    }

    this.lastEventTime = now;
  }

  /**
   * Log transcript events with accuracy metrics
   */
  logTranscriptEvent(
    event: 'transcript_partial' | 'transcript_final' | 'transcript_error',
    sessionId: string,
    text: string,
    confidence?: number
  ): void {
    this.logEvent(`voice_${event}`, {
      sessionId,
      textLength: text.length,
      confidence,
      preview: text.substring(0, 50) + (text.length > 50 ? '...' : '')
    }, {
      text_length: text.length,
      confidence: confidence || 0
    });

    // Track message count and accuracy
    if (event === 'transcript_final') {
      this.sessionMetrics.messageCount = (this.sessionMetrics.messageCount || 0) + 1;
      
      if (confidence) {
        const currentAccuracy = this.sessionMetrics.transcriptAccuracy || 0;
        const messageCount = this.sessionMetrics.messageCount || 1;
        this.sessionMetrics.transcriptAccuracy = (currentAccuracy * (messageCount - 1) + confidence) / messageCount;
      }
    }

    // Log low confidence warnings
    if (confidence && confidence < 0.7) {
      logger.warn('Low transcript confidence', { 
        sessionId, 
        confidence, 
        text: text.substring(0, 100),
        threshold: 0.7 
      });
    }
  }

  /**
   * Log session lifecycle events
   */
  logSessionEvent(
    event: 'session_created' | 'session_active' | 'session_stopped' | 'session_error',
    sessionId: string,
    details?: Record<string, any>
  ): void {
    const now = Date.now();
    const sessionDuration = this.sessionStartTime ? now - this.sessionStartTime : 0;

    this.logEvent(`voice_${event}`, {
      sessionId,
      sessionDuration,
      ...details
    }, {
      session_duration: sessionDuration,
      message_count: this.sessionMetrics.messageCount || 0,
      error_count: this.sessionMetrics.errorCount || 0
    });

    // Update session metrics
    if (event === 'session_stopped') {
      this.sessionMetrics.sessionDuration = sessionDuration;
      this.generateSessionSummary(sessionId);
    }
  }

  /**
   * Handle and log voice system errors with context
   */
  logError(
    error: Error | VoiceConnectionError | VoiceAudioError | VoiceSessionError,
    sessionId?: string,
    context?: string,
    shouldNotifyUser = false
  ): void {
    const errorContext = {
      sessionId,
      context,
      errorType: error.constructor.name,
      ...(error as any).additionalContext
    };

    // Log structured error
    this.logEvent('voice_error', {
      sessionId,
      errorMessage: error.message,
      errorType: error.constructor.name,
      context,
      stack: error.stack?.substring(0, 500) // Truncate stack trace
    });

    // Report to centralized error handling
    reportError(error, context || 'Voice System Error', errorContext);

    // Update error count
    this.sessionMetrics.errorCount = (this.sessionMetrics.errorCount || 0) + 1;

    // Show user notification for critical errors
    if (shouldNotifyUser) {
      let userMessage = 'Voice system error occurred';
      
      if (error instanceof VoiceConnectionError) {
        userMessage = 'Connection to voice service lost. Attempting to reconnect...';
      } else if (error instanceof VoiceAudioError) {
        userMessage = 'Audio processing error. Please check your microphone permissions.';
      } else if (error instanceof VoiceSessionError) {
        userMessage = 'Voice session error. Please try restarting the interview.';
      }

      showErrorNotification(userMessage, context);
    }
  }

  /**
   * Log performance metrics
   */
  logPerformanceMetric(
    metricName: string,
    value: number,
    sessionId?: string,
    unit = 'ms'
  ): void {
    this.logEvent('voice_performance_metric', {
      sessionId,
      metricName,
      value,
      unit
    }, {
      [metricName]: value
    });

    // Log performance warnings
    const thresholds: Record<string, number> = {
      'connection_time': 3000,
      'stt_latency': 2000,
      'tts_latency': 1500,
      'session_init_time': 5000
    };

    if (thresholds[metricName] && value > thresholds[metricName]) {
      logger.warn(`Performance threshold exceeded: ${metricName}`, {
        sessionId,
        value,
        threshold: thresholds[metricName],
        unit
      });
    }
  }

  /**
   * Generate session summary for analytics
   */
  private generateSessionSummary(sessionId: string): void {
    const properties = {
      sessionId
    };
    
    const measurements = {
      duration: this.sessionMetrics.sessionDuration || 0,
      messageCount: this.sessionMetrics.messageCount || 0,
      errorCount: this.sessionMetrics.errorCount || 0,
      transcriptAccuracy: this.sessionMetrics.transcriptAccuracy || 0,
      connectionRetries: this.connectionMetrics.retryCount || 0,
      audioBufferIssues: this.audioMetrics.bufferUnderruns || 0,
      averageSttLatency: this.audioMetrics.sttLatency || 0,
      averageTtsLatency: this.audioMetrics.ttsLatency || 0
    };

    this.logEvent('voice_session_summary', properties, measurements);

    logger.info('Voice session summary', { ...properties, ...measurements });
  }

  /**
   * Core event logging with Application Insights integration
   */
  private logEvent(
    name: string,
    properties?: Record<string, any>,
    measurements?: Record<string, number>
  ): void {
    const event: VoiceTelemetryEvent = {
      name,
      timestamp: Date.now(),
      properties,
      measurements
    };

    // Store locally
    this.events.push(event);

    // Keep only last 100 events in memory
    if (this.events.length > 100) {
      this.events = this.events.slice(-100);
    }

    // Log to console for development
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔍 [VoiceTelemetry] ${name}`, properties, measurements);
    }

    // TODO: Integration with Azure Application Insights
    // if (window.appInsights) {
    //   window.appInsights.trackEvent({
    //     name: `voice_${name}`,
    //     properties,
    //     measurements
    //   });
    // }

    // Standard logging
    logger.info(`Voice telemetry: ${name}`, { properties, measurements });
  }

  /**
   * Get current session metrics
   */
  getMetrics(): {
    connection: ConnectionMetrics;
    audio: AudioMetrics;
    session: SessionMetrics;
  } {
    return {
      connection: this.connectionMetrics as ConnectionMetrics,
      audio: this.audioMetrics as AudioMetrics,
      session: this.sessionMetrics as SessionMetrics
    };
  }

  /**
   * Export telemetry data for analysis
   */
  exportTelemetryData(): VoiceTelemetryEvent[] {
    return [...this.events];
  }

  /**
   * Clear telemetry data
   */
  clearTelemetryData(): void {
    this.events = [];
    this.connectionMetrics = {};
    this.audioMetrics = { bufferUnderruns: 0 };
    this.sessionMetrics = { messageCount: 0, errorCount: 0 };
  }
}

// Singleton instance
let voiceTelemetryInstance: VoiceTelemetryService | null = null;

/**
 * Get shared VoiceTelemetryService instance
 */
export function getVoiceTelemetry(): VoiceTelemetryService {
  if (!voiceTelemetryInstance) {
    voiceTelemetryInstance = new VoiceTelemetryService();
  }
  return voiceTelemetryInstance;
}

/**
 * Utility functions for common voice telemetry operations
 */
export const VoiceTelemetry = {
  // Connection tracking
  trackConnection: (event: 'connecting' | 'connected' | 'disconnected', sessionId: string, metrics?: Partial<ConnectionMetrics>) => {
    getVoiceTelemetry().logConnectionEvent(event, sessionId, metrics);
  },

  // Audio performance tracking
  trackAudioLatency: (type: 'stt' | 'tts', latency: number, sessionId: string) => {
    const metrics = type === 'stt' ? { sttLatency: latency } : { ttsLatency: latency };
    getVoiceTelemetry().logAudioEvent(`${type}_complete`, sessionId, metrics);
  },

  // Error tracking with user notifications
  trackError: (error: Error, sessionId?: string, context?: string, notifyUser = false) => {
    getVoiceTelemetry().logError(error, sessionId, context, notifyUser);
  },

  // Performance monitoring
  trackPerformance: (metric: string, value: number, sessionId?: string) => {
    getVoiceTelemetry().logPerformanceMetric(metric, value, sessionId);
  },

  // Session lifecycle
  startSession: (sessionId: string, userId?: string) => {
    getVoiceTelemetry().startSession(sessionId, userId);
  },

  endSession: (sessionId: string) => {
    getVoiceTelemetry().logSessionEvent('session_stopped', sessionId);
  },

  // Singleton access methods
  getInstance: () => getVoiceTelemetry()
};

/**
 * Export singleton instance for convenience
 */
export const voiceTelemetry = getVoiceTelemetry();
