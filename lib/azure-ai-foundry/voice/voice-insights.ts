/**
 * Voice Insights - Application Insights integration for voice system
 * 
 * Provides structured logging, metrics collection, and error tracking
 * for the Azure AI Foundry voice interview system.
 */

import { ApplicationInsights } from '@azure/application-insights-web';
import { logger } from '@/lib/utils/logger';

// Voice-specific telemetry events
export interface VoiceSessionTelemetry {
  sessionId: string;
  userId?: string;
  interviewType?: string;
  connectionState: 'connecting' | 'connected' | 'disconnected' | 'error';
  duration?: number;
  audioLatency?: number;
  transcriptionAccuracy?: number;
  errorCount?: number;
  retryAttempts?: number;
}

export interface VoiceErrorTelemetry {
  sessionId: string;
  errorType: 'connection' | 'audio' | 'transcription' | 'synthesis' | 'bridge';
  errorCode?: string;
  errorMessage: string;
  isRecoverable: boolean;
  stackTrace?: string;
  context?: Record<string, any>;
}

export interface VoiceMetricsTelemetry {
  sessionId: string;
  metricName: 'stt_latency' | 'tts_latency' | 'connection_latency' | 'audio_quality' | 'transcript_accuracy';
  value: number;
  unit: 'ms' | 'percentage' | 'ratio' | 'count';
  timestamp: number;
  tags?: Record<string, string>;
}

export interface VoiceUsageTelemetry {
  sessionId: string;
  userId: string;
  featureUsed: 'voice_interview' | 'agent_handoff' | 'sentiment_analysis' | 'recording';
  interactionCount: number;
  duration: number;
  quotaUsed?: number;
  quotaRemaining?: number;
}

class VoiceInsights {
  private appInsights: ApplicationInsights | null = null;
  private isInitialized = false;
  private instrumentationKey: string | null = null;
  private sessionBuffer: Map<string, any[]> = new Map();
  private maxBufferSize = 100;

  /**
   * Initialize Application Insights for voice telemetry
   */
  public initialize(connectionString?: string): void {
    try {
      // Get connection string from environment or parameter
      const insightsConnectionString = connectionString || 
        process.env.NEXT_PUBLIC_APPLICATIONINSIGHTS_CONNECTION_STRING ||
        process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;

      if (!insightsConnectionString) {
        logger.warn('[Voice Insights] Application Insights connection string not provided, using console fallback');
        this.isInitialized = true; // Still mark as initialized for local development
        return;
      }

      this.appInsights = new ApplicationInsights({
        config: {
          connectionString: insightsConnectionString,
          // Voice-specific configuration
          disableFetchTracking: false,
          disableAjaxTracking: false,
          disableExceptionTracking: false,
          enableAutoRouteTracking: true,
          enableCorsCorrelation: true,
          enableRequestHeaderTracking: true,
          enableResponseHeaderTracking: true,
          // Performance optimizations
          samplingPercentage: process.env.NODE_ENV === 'production' ? 10 : 100,
          maxBatchInterval: 2000, // 2 seconds
          maxBatchSizeInBytes: 64000,
          // Custom properties
          tags: {
            'ai.component': 'voice-interview-system',
            'ai.version': process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0'
          }
        }
      });

      this.appInsights.loadAppInsights();
      this.setupCustomTelemetryProcessor();
      this.isInitialized = true;

      logger.success('[Voice Insights] Application Insights initialized successfully');

      // Track initialization
      this.trackEvent('voice_insights_initialized', {
        environment: process.env.NODE_ENV || 'development',
        version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0'
      });

    } catch (error) {
      logger.error('[Voice Insights] Failed to initialize Application Insights', error);
      this.isInitialized = true; // Fallback to console logging
    }
  }

  /**
   * Set up custom telemetry processor for voice-specific data
   */
  private setupCustomTelemetryProcessor(): void {
    if (!this.appInsights) return;

    this.appInsights.addTelemetryProcessor((envelope) => {
      // Add voice system context to all telemetry
      if (envelope.data && envelope.data.baseData) {
        envelope.data.baseData.properties = {
          ...envelope.data.baseData.properties,
          system: 'voice-interview',
          timestamp: new Date().toISOString()
        };
      }
      
      return true;
    });
  }

  /**
   * Track voice session lifecycle events
   */
  public trackVoiceSession(event: 'session_created' | 'session_started' | 'session_ended' | 'session_error', data: VoiceSessionTelemetry): void {
    const eventName = `voice_${event}`;
    
    const properties = {
      sessionId: data.sessionId,
      userId: data.userId || 'anonymous',
      interviewType: data.interviewType || 'general',
      connectionState: data.connectionState,
      duration: data.duration?.toString(),
      audioLatency: data.audioLatency?.toString(),
      transcriptionAccuracy: data.transcriptionAccuracy?.toString(),
      errorCount: data.errorCount?.toString(),
      retryAttempts: data.retryAttempts?.toString()
    };

    const measurements = {
      duration: data.duration || 0,
      audioLatency: data.audioLatency || 0,
      transcriptionAccuracy: data.transcriptionAccuracy || 0,
      errorCount: data.errorCount || 0,
      retryAttempts: data.retryAttempts || 0
    };

    this.trackEvent(eventName, properties, measurements);

    // Log for development
    logger.info(`[Voice Insights] ${eventName}`, {
      sessionId: data.sessionId,
      state: data.connectionState,
      duration: data.duration
    });
  }

  /**
   * Track voice system errors with detailed context
   */
  public trackVoiceError(error: VoiceErrorTelemetry): void {
    const properties = {
      sessionId: error.sessionId,
      errorType: error.errorType,
      errorCode: error.errorCode || 'unknown',
      errorMessage: error.errorMessage,
      isRecoverable: error.isRecoverable.toString(),
      stackTrace: error.stackTrace,
      ...error.context
    };

    // Track as both event and exception
    this.trackEvent('voice_error', properties);
    
    if (this.appInsights && error.stackTrace) {
      this.appInsights.trackException({
        exception: new Error(error.errorMessage),
        properties,
        severityLevel: error.isRecoverable ? 1 : 3 // Warning vs Error
      });
    }

    logger.error(`[Voice Insights] Voice error - ${error.errorType}`, {
      sessionId: error.sessionId,
      errorCode: error.errorCode,
      message: error.errorMessage,
      recoverable: error.isRecoverable
    });
  }

  /**
   * Track voice performance metrics
   */
  public trackVoiceMetric(metric: VoiceMetricsTelemetry): void {
    const properties = {
      sessionId: metric.sessionId,
      metricName: metric.metricName,
      unit: metric.unit,
      timestamp: metric.timestamp.toString(),
      ...metric.tags
    };

    const measurements = {
      [metric.metricName]: metric.value
    };

    this.trackEvent('voice_metric', properties, measurements);

    // Track as custom metric if available
    if (this.appInsights) {
      this.appInsights.trackMetric({
        name: `voice_${metric.metricName}`,
        average: metric.value
      }, properties);
    }

    // Log significant metrics
    if (metric.metricName === 'stt_latency' && metric.value > 1000) {
      logger.warn('[Voice Insights] High STT latency detected', {
        sessionId: metric.sessionId,
        latency: metric.value
      });
    }
  }

  /**
   * Track feature usage for quota and analytics
   */
  public trackVoiceUsage(usage: VoiceUsageTelemetry): void {
    const properties = {
      sessionId: usage.sessionId,
      userId: usage.userId,
      featureUsed: usage.featureUsed,
      interactionCount: usage.interactionCount.toString(),
      duration: usage.duration.toString(),
      quotaUsed: usage.quotaUsed?.toString(),
      quotaRemaining: usage.quotaRemaining?.toString()
    };

    const measurements = {
      interactionCount: usage.interactionCount,
      duration: usage.duration,
      quotaUsed: usage.quotaUsed || 0,
      quotaRemaining: usage.quotaRemaining || 0
    };

    this.trackEvent('voice_usage', properties, measurements);

    logger.info('[Voice Insights] Feature usage tracked', {
      feature: usage.featureUsed,
      user: usage.userId,
      interactions: usage.interactionCount
    });
  }

  /**
   * Track custom voice events
   */
  public trackVoiceEvent(eventName: string, properties?: Record<string, any>, measurements?: Record<string, number>): void {
    this.trackEvent(`voice_${eventName}`, properties, measurements);
  }

  /**
   * Batch track multiple events for performance
   */
  public batchTrackEvents(sessionId: string, events: Array<{
    name: string;
    properties?: Record<string, any>;
    measurements?: Record<string, number>;
  }>): void {
    if (!this.isInitialized) return;

    // Add to session buffer
    if (!this.sessionBuffer.has(sessionId)) {
      this.sessionBuffer.set(sessionId, []);
    }

    const buffer = this.sessionBuffer.get(sessionId)!;
    buffer.push(...events);

    // Flush if buffer is full
    if (buffer.length >= this.maxBufferSize) {
      this.flushSessionBuffer(sessionId);
    }
  }

  /**
   * Flush buffered events for a session
   */
  public flushSessionBuffer(sessionId: string): void {
    const buffer = this.sessionBuffer.get(sessionId);
    if (!buffer || buffer.length === 0) return;

    logger.info('[Voice Insights] Flushing session buffer', {
      sessionId,
      eventCount: buffer.length
    });

    // Track all buffered events
    for (const event of buffer) {
      this.trackEvent(event.name, event.properties, event.measurements);
    }

    // Clear buffer
    this.sessionBuffer.delete(sessionId);
  }

  /**
   * Generic event tracking with fallback
   */
  private trackEvent(eventName: string, properties?: Record<string, any>, measurements?: Record<string, number>): void {
    if (!this.isInitialized) {
      logger.info(`[Voice Insights] ${eventName}`, { properties, measurements });
      return;
    }

    try {
      if (this.appInsights) {
        this.appInsights.trackEvent({
          name: eventName,
          properties: properties || {},
          measurements: measurements || {}
        });
      } else {
        // Fallback to console logging
        logger.info(`[Voice Insights] ${eventName}`, { properties, measurements });
      }
    } catch (error) {
      logger.error('[Voice Insights] Failed to track event', error);
    }
  }

  /**
   * Set user context for telemetry correlation
   */
  public setUser(userId: string, accountId?: string): void {
    if (!this.appInsights) return;

    this.appInsights.setAuthenticatedUserContext(userId, accountId);
    
    logger.info('[Voice Insights] User context set', { userId, accountId });
  }

  /**
   * Clear user context
   */
  public clearUser(): void {
    if (!this.appInsights) return;

    this.appInsights.clearAuthenticatedUserContext();
    
    logger.info('[Voice Insights] User context cleared');
  }

  /**
   * Force flush all pending telemetry
   */
  public flush(): void {
    if (!this.appInsights) return;

    this.appInsights.flush();
    
    // Flush all session buffers
    for (const sessionId of this.sessionBuffer.keys()) {
      this.flushSessionBuffer(sessionId);
    }

    logger.info('[Voice Insights] Telemetry flushed');
  }

  /**
   * Get initialization status
   */
  public get initialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Get Application Insights instance
   */
  public get instance(): ApplicationInsights | null {
    return this.appInsights;
  }
}

// Export singleton instance
export const voiceInsights = new VoiceInsights();

// Auto-initialize with environment variables
if (typeof window !== 'undefined') {
  voiceInsights.initialize();
}

export default voiceInsights;
