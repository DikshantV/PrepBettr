/**
 * Voice Telemetry Module
 * Comprehensive logging, error reporting, and performance metrics for voice interactions
 */

import { reportError } from '@/lib/utils/error-utils';

// ===== TELEMETRY EVENT TYPES =====

interface TelemetryEvent {
  eventType: string;
  timestamp: number;
  sessionId: string;
  data: Record<string, any>;
}

interface ClientCreationEvent {
  endpoint: string;
  deploymentId: string;
  voice: string;
}

interface ConnectionEvent {
  endpoint: string;
  attempt?: number;
  sessionId?: string;
}

interface ConnectionFailureEvent {
  reason: string;
  attempt: number;
}

interface ConnectionClosedEvent {
  code: number;
  reason: string;
  wasClean: boolean;
}

interface SessionEvent {
  sessionId: string;
  deploymentId?: string;
  voice?: string;
  temperature?: number;
  maxTokens?: number;
}

interface SessionReadyEvent {
  sessionId: string;
  azureSessionId: string;
  model: string;
  voice: string;
}

interface TranscriptEvent {
  sessionId: string;
  transcript: string;
  length: number;
  timestamp: number;
}

interface AudioEvent {
  sessionId: string;
  audioSize: number;
  timestamp: number;
}

interface SessionEndEvent {
  sessionId: string;
  duration: number;
  reason: string;
  closeCode?: number;
}

interface ConfigUpdateEvent {
  sessionId: string;
  changes: Record<string, any>;
}

interface ReconnectionEvent {
  attempt: number;
  delay: number;
  maxAttempts: number;
}

interface MessageEvent {
  type: string;
  sessionId: string;
  timestamp: number;
}

// ===== TELEMETRY COLLECTION CLASS =====

class VoiceTelemetryCollector {
  private events: TelemetryEvent[] = [];
  private sessionMetrics: Map<string, any> = new Map();
  private performanceMarkers: Map<string, number> = new Map();
  private errorCount = 0;
  private warningCount = 0;

  /**
   * Track client creation
   */
  trackClientCreation(event: ClientCreationEvent): void {
    this.addEvent('client_created', 'global', event);
    console.log('🎤 [VOICE] Client created', {
      endpoint: event.endpoint,
      deployment: event.deploymentId,
      voice: event.voice
    });
  }

  /**
   * Track connection attempts
   */
  trackConnectionAttempt(event: ConnectionEvent): void {
    this.addEvent('connection_attempt', event.sessionId || 'unknown', event);
    console.log('🔗 [VOICE] Connection attempt', {
      endpoint: event.endpoint,
      attempt: event.attempt
    });
  }

  /**
   * Track successful connections
   */
  trackConnectionSuccess(event: ConnectionEvent): void {
    this.addEvent('connection_success', event.sessionId || 'unknown', event);
    console.log('✅ [VOICE] Connected successfully', {
      endpoint: event.endpoint,
      sessionId: event.sessionId
    });
  }

  /**
   * Track connection failures
   */
  trackConnectionFailure(error: Error, context: ConnectionFailureEvent): void {
    this.errorCount++;
    this.addEvent('connection_failure', 'unknown', {
      error: error.message,
      ...context
    });
    
    console.error('❌ [VOICE] Connection failed', {
      error: error.message,
      reason: context.reason,
      attempt: context.attempt
    });

    // Report to application insights or external service
    reportError(error, {
      context: 'voice_connection',
      metadata: context
    });
  }

  /**
   * Track connection closures
   */
  trackConnectionClosed(event: ConnectionClosedEvent): void {
    this.addEvent('connection_closed', 'unknown', event);
    console.log('🔌 [VOICE] Connection closed', {
      code: event.code,
      reason: event.reason,
      wasClean: event.wasClean
    });
  }

  /**
   * Track session creation
   */
  trackSessionCreated(event: { sessionId: string; config: any }): void {
    this.sessionMetrics.set(event.sessionId, {
      createdAt: Date.now(),
      config: event.config,
      transcriptCount: 0,
      audioResponseCount: 0,
      errors: []
    });

    this.addEvent('session_created', event.sessionId, event.config);
    console.log('🎯 [VOICE] Session created', {
      sessionId: event.sessionId,
      config: event.config
    });
  }

  /**
   * Track session start
   */
  trackSessionStart(event: SessionEvent): void {
    this.addEvent('session_started', event.sessionId, event);
    this.updateSessionMetrics(event.sessionId, { startedAt: Date.now() });
    
    console.log('🚀 [VOICE] Session started', {
      sessionId: event.sessionId,
      voice: event.voice,
      deployment: event.deploymentId
    });
  }

  /**
   * Track session ready
   */
  trackSessionReady(event: SessionReadyEvent): void {
    this.addEvent('session_ready', event.sessionId, event);
    this.updateSessionMetrics(event.sessionId, { 
      readyAt: Date.now(),
      azureSessionId: event.azureSessionId,
      model: event.model
    });

    console.log('🔥 [VOICE] Session ready', {
      sessionId: event.sessionId,
      azureSessionId: event.azureSessionId,
      model: event.model,
      voice: event.voice
    });
  }

  /**
   * Track transcript events
   */
  trackTranscript(event: TranscriptEvent): void {
    this.addEvent('transcript_received', event.sessionId, event);
    this.updateSessionMetrics(event.sessionId, (metrics: any) => ({
      ...metrics,
      transcriptCount: (metrics.transcriptCount || 0) + 1,
      lastTranscriptAt: event.timestamp
    }));

    console.log('📝 [VOICE] Transcript received', {
      sessionId: event.sessionId,
      length: event.length,
      preview: event.transcript.substring(0, 50) + (event.length > 50 ? '...' : '')
    });
  }

  /**
   * Track audio responses
   */
  trackAudioResponse(event: AudioEvent): void {
    this.addEvent('audio_response_received', event.sessionId, event);
    this.updateSessionMetrics(event.sessionId, (metrics: any) => ({
      ...metrics,
      audioResponseCount: (metrics.audioResponseCount || 0) + 1,
      lastAudioAt: event.timestamp
    }));

    console.log('🎵 [VOICE] Audio response received', {
      sessionId: event.sessionId,
      audioSize: event.audioSize
    });
  }

  /**
   * Track audio sent
   */
  trackAudioSent(event: AudioEvent): void {
    this.addEvent('audio_sent', event.sessionId, event);
    console.log('📤 [VOICE] Audio sent', {
      sessionId: event.sessionId,
      audioSize: event.audioSize
    });
  }

  /**
   * Track text sent
   */
  trackTextSent(event: { sessionId: string; textLength: number; timestamp: number }): void {
    this.addEvent('text_sent', event.sessionId, event);
    console.log('💬 [VOICE] Text sent', {
      sessionId: event.sessionId,
      textLength: event.textLength
    });
  }

  /**
   * Track session end
   */
  trackSessionEnd(event: SessionEndEvent): void {
    this.addEvent('session_ended', event.sessionId, event);
    
    const metrics = this.sessionMetrics.get(event.sessionId);
    if (metrics) {
      metrics.endedAt = Date.now();
      metrics.duration = event.duration;
      metrics.endReason = event.reason;
    }

    console.log('🏁 [VOICE] Session ended', {
      sessionId: event.sessionId,
      duration: event.duration,
      reason: event.reason
    });
  }

  /**
   * Track configuration updates
   */
  trackConfigUpdate(event: ConfigUpdateEvent): void {
    this.addEvent('config_updated', event.sessionId, event);
    console.log('⚙️ [VOICE] Configuration updated', {
      sessionId: event.sessionId,
      changes: event.changes
    });
  }

  /**
   * Track reconnection attempts
   */
  trackReconnectionAttempt(event: ReconnectionEvent): void {
    this.addEvent('reconnection_attempt', 'unknown', event);
    console.log('🔄 [VOICE] Reconnection attempt', {
      attempt: event.attempt,
      delay: event.delay,
      maxAttempts: event.maxAttempts
    });
  }

  /**
   * Track messages received
   */
  trackMessageReceived(event: MessageEvent): void {
    this.addEvent('message_received', event.sessionId, event);
    // Only log non-routine message types to avoid spam
    if (!['response.audio.delta', 'input_audio_buffer.append'].includes(event.type)) {
      console.log('📨 [VOICE] Message received', {
        type: event.type,
        sessionId: event.sessionId
      });
    }
  }

  /**
   * Track performance latency
   */
  trackLatency(operation: string, duration: number): void {
    this.performanceMarkers.set(`${operation}_${Date.now()}`, duration);
    
    if (duration > 200) { // Log slow operations
      console.warn('⚠️ [VOICE] Slow operation detected', {
        operation,
        duration: Math.round(duration)
      });
    }
  }

  /**
   * Track errors with context
   */
  trackError(error: Error, category: string, context: Record<string, any> = {}): void {
    this.errorCount++;
    
    const errorData = {
      message: error.message,
      name: error.name,
      stack: error.stack,
      category,
      ...context
    };

    this.addEvent('error', context.sessionId || 'unknown', errorData);
    
    // Update session metrics
    if (context.sessionId) {
      this.updateSessionMetrics(context.sessionId, (metrics: any) => ({
        ...metrics,
        errors: [...(metrics.errors || []), errorData]
      }));
    }

    console.error('💥 [VOICE] Error tracked', {
      category,
      message: error.message,
      sessionId: context.sessionId
    });

    // Report to external error tracking service
    reportError(error, {
      context: `voice_${category}`,
      metadata: context
    });
  }

  /**
   * Get session metrics
   */
  getSessionMetrics(sessionId: string): any {
    return this.sessionMetrics.get(sessionId) || null;
  }

  /**
   * Get all session metrics
   */
  getAllSessionMetrics(): Record<string, any> {
    const result: Record<string, any> = {};
    this.sessionMetrics.forEach((metrics, sessionId) => {
      result[sessionId] = metrics;
    });
    return result;
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): any {
    const latencies = Array.from(this.performanceMarkers.values());
    
    return {
      totalSessions: this.sessionMetrics.size,
      totalEvents: this.events.length,
      errorCount: this.errorCount,
      warningCount: this.warningCount,
      averageLatency: latencies.length > 0 ? 
        latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
      maxLatency: Math.max(...latencies, 0),
      minLatency: latencies.length > 0 ? Math.min(...latencies) : 0
    };
  }

  /**
   * Export telemetry data for analysis
   */
  exportTelemetryData(): any {
    return {
      events: this.events,
      sessionMetrics: this.getAllSessionMetrics(),
      performance: this.getPerformanceSummary(),
      exportedAt: Date.now()
    };
  }

  /**
   * Clear old data to prevent memory leaks
   */
  cleanup(olderThanMs: number = 3600000): void { // Default 1 hour
    const cutoff = Date.now() - olderThanMs;
    
    // Remove old events
    this.events = this.events.filter(event => event.timestamp > cutoff);
    
    // Remove old session metrics
    this.sessionMetrics.forEach((metrics, sessionId) => {
      if (metrics.createdAt < cutoff) {
        this.sessionMetrics.delete(sessionId);
      }
    });
    
    // Clear old performance markers
    this.performanceMarkers.clear();
    
    console.log('🧹 [VOICE] Telemetry cleanup completed', {
      remainingEvents: this.events.length,
      remainingSessions: this.sessionMetrics.size
    });
  }

  // ===== PRIVATE METHODS =====

  private addEvent(eventType: string, sessionId: string, data: any): void {
    this.events.push({
      eventType,
      timestamp: Date.now(),
      sessionId,
      data
    });

    // Prevent memory leaks by limiting event history
    if (this.events.length > 1000) {
      this.events = this.events.slice(-500); // Keep last 500 events
    }
  }

  private updateSessionMetrics(sessionId: string, update: any | ((current: any) => any)): void {
    const current = this.sessionMetrics.get(sessionId) || {};
    const newMetrics = typeof update === 'function' ? update(current) : { ...current, ...update };
    this.sessionMetrics.set(sessionId, newMetrics);
  }
}

// ===== EXPORT SINGLETON INSTANCE =====

export const voiceTelemetry = new VoiceTelemetryCollector();

// ===== UTILITY FUNCTIONS =====

/**
 * Initialize telemetry cleanup interval
 */
export function initializeVoiceTelemetry(): void {
  // Clean up old data every 30 minutes
  setInterval(() => {
    voiceTelemetry.cleanup();
  }, 30 * 60 * 1000);

  console.log('📊 [VOICE] Telemetry system initialized');
}

/**
 * Get voice system health status
 */
export function getVoiceSystemHealth(): any {
  const summary = voiceTelemetry.getPerformanceSummary();
  
  return {
    status: summary.errorCount === 0 ? 'healthy' : 'degraded',
    activeSessions: summary.totalSessions,
    errorRate: summary.totalEvents > 0 ? summary.errorCount / summary.totalEvents : 0,
    averageLatency: summary.averageLatency,
    lastUpdated: Date.now()
  };
}
