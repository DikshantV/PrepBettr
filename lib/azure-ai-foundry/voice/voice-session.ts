/**
 * Voice Session - High-level session management for Azure AI Foundry voice interactions
 * Manages session lifecycle, telemetry, and provides a clean API for voice operations
 */

import { VoiceLiveClient } from './voice-live-client';
import { ConfigOptions, VoiceSessionState, FoundryVoiceSession, FoundryVoiceError } from './types';
import { voiceTelemetry } from './voice-telemetry';

export class VoiceSession {
  private client: VoiceLiveClient;
  private config: ConfigOptions;
  private _sessionId: string;
  private _isActive = false;
  private startTime: number = 0;

  // Event handlers
  public onSessionReady: ((session: FoundryVoiceSession) => void) | null = null;
  public onTranscript: ((transcript: string) => void) | null = null;
  public onAudioResponse: ((audioData: string) => void) | null = null;
  public onTextResponse: ((text: string) => void) | null = null;
  public onError: ((error: FoundryVoiceError | Error) => void) | null = null;
  public onDisconnect: ((code: number, reason: string) => void) | null = null;

  constructor(config: ConfigOptions) {
    this.config = this.validateConfig(config);
    this._sessionId = this.generateSessionId();
    this.client = new VoiceLiveClient(config);
    this.setupClientHandlers();

    voiceTelemetry.trackSessionCreated({
      sessionId: this._sessionId,
      config: {
        voice: config.voice,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        deploymentId: config.deploymentId
      }
    });
  }

  private validateConfig(config: ConfigOptions): ConfigOptions {
    if (!config.apiKey || config.apiKey.trim() === '') {
      throw new Error('API key is required');
    }

    if (!config.endpoint || !config.endpoint.startsWith('wss://')) {
      throw new Error('Invalid endpoint format');
    }

    if (config.temperature < 0 || config.temperature > 1) {
      throw new Error('Temperature must be between 0 and 1');
    }

    if (config.maxTokens <= 0) {
      throw new Error('maxTokens must be greater than 0');
    }

    return config;
  }

  private generateSessionId(): string {
    return `voice-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupClientHandlers(): void {
    this.client.onSessionCreated = (session: FoundryVoiceSession) => {
      voiceTelemetry.trackSessionReady({
        sessionId: this._sessionId,
        azureSessionId: session.id,
        model: session.model,
        voice: session.voice
      });

      if (this.onSessionReady) {
        this.onSessionReady(session);
      }
    };

    this.client.onTranscript = (transcript: string) => {
      const startTime = performance.now();
      
      voiceTelemetry.trackTranscript({
        sessionId: this._sessionId,
        transcript,
        length: transcript.length,
        timestamp: Date.now()
      });

      if (this.onTranscript) {
        const endTime = performance.now();
        voiceTelemetry.trackLatency('transcript_processing', endTime - startTime);
        this.onTranscript(transcript);
      }
    };

    this.client.onAudioDelta = (audioData: string) => {
      const startTime = performance.now();
      
      voiceTelemetry.trackAudioResponse({
        sessionId: this._sessionId,
        audioSize: audioData.length,
        timestamp: Date.now()
      });

      if (this.onAudioResponse) {
        const endTime = performance.now();
        voiceTelemetry.trackLatency('audio_processing', endTime - startTime);
        this.onAudioResponse(audioData);
      }
    };

    this.client.onError = (error: FoundryVoiceError) => {
      const errorObj = new Error(error.message);
      errorObj.name = error.type;

      voiceTelemetry.trackError(errorObj, 'AZURE_API_ERROR', {
        sessionId: this._sessionId,
        errorCode: error.code,
        errorType: error.type
      });

      if (this.onError) {
        this.onError(error);
      }
    };

    this.client.onDisconnect = (code: number, reason: string) => {
      this._isActive = false;
      const duration = this.startTime > 0 ? Date.now() - this.startTime : 0;

      let disconnectReason: string;
      if (code === 1000) {
        disconnectReason = 'USER_STOPPED';
      } else if (code === 1006) {
        disconnectReason = 'CONNECTION_LOST';
      } else {
        disconnectReason = 'UNKNOWN';
      }

      voiceTelemetry.trackSessionEnd({
        sessionId: this._sessionId,
        duration,
        reason: disconnectReason,
        closeCode: code
      });

      if (this.onDisconnect) {
        this.onDisconnect(code, reason);
      }
    };
  }

  /**
   * Start the voice session
   */
  public async start(): Promise<void> {
    if (this._isActive) {
      console.warn('Session already active');
      return;
    }

    try {
      this.startTime = Date.now();

      voiceTelemetry.trackSessionStart({
        sessionId: this._sessionId,
        deploymentId: this.config.deploymentId,
        voice: this.config.voice,
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens
      });

      await this.client.connect();
      this._isActive = true;

    } catch (error) {
      const sessionError = error instanceof Error ? error : new Error('Failed to start session');
      
      voiceTelemetry.trackError(sessionError, 'SESSION_START_FAILED', {
        sessionId: this._sessionId
      });

      throw sessionError;
    }
  }

  /**
   * Stop the voice session
   */
  public stop(): void {
    if (!this._isActive) {
      return;
    }

    try {
      this.client.disconnect();
      this._isActive = false;

      const duration = this.startTime > 0 ? Date.now() - this.startTime : 0;
      voiceTelemetry.trackSessionEnd({
        sessionId: this._sessionId,
        duration,
        reason: 'USER_STOPPED'
      });

    } catch (error) {
      console.error('Error stopping voice session:', error);
    }
  }

  /**
   * Send audio data to the session
   */
  public sendAudio(audioData: ArrayBuffer): void {
    if (!this._isActive) {
      throw new Error('Session not started');
    }

    this.client.sendAudio(audioData);
  }

  /**
   * Commit audio buffer for processing
   */
  public commitAudio(): void {
    if (!this._isActive) {
      throw new Error('Session not started');
    }

    this.client.commitAudio();
  }

  /**
   * Clear audio buffer
   */
  public clearAudioBuffer(): void {
    if (!this._isActive) {
      throw new Error('Session not started');
    }

    this.client.clearAudioBuffer();
  }

  /**
   * Send text message to the session
   */
  public sendText(text: string): void {
    if (!this._isActive) {
      throw new Error('Session not started');
    }

    this.client.sendText(text);
  }

  /**
   * Update session settings
   */
  public updateSettings(settings: Partial<ConfigOptions>): void {
    if (!this._isActive) {
      throw new Error('Session not started');
    }

    voiceTelemetry.trackConfigUpdate({
      sessionId: this._sessionId,
      changes: settings
    });

    this.client.updateSession(settings);
  }

  /**
   * Get current session ID
   */
  public get sessionId(): string {
    return this._sessionId;
  }

  /**
   * Check if session is active
   */
  public get isActive(): boolean {
    return this._isActive;
  }

  /**
   * Get session configuration
   */
  public get configuration(): ConfigOptions {
    return { ...this.config };
  }

  /**
   * Get session state for monitoring
   */
  public getState(): Partial<VoiceSessionState> {
    return {
      sessionId: this._sessionId,
      status: this._isActive ? 'active' : 'ended',
      currentAgent: 'azure-foundry', // Will be updated when agents are integrated
      metrics: {
        connectionLatency: 0, // Will be populated by telemetry
        audioLatency: 0,
        transcriptionAccuracy: 0,
        responseTime: 0,
        totalSpeakingTime: this.startTime > 0 ? Date.now() - this.startTime : 0,
        silenceDuration: 0
      },
      errors: []
    };
  }

  /**
   * Enable auto-reconnection
   */
  public enableAutoReconnect(maxAttempts: number = 3): void {
    this.client.enableAutoReconnect = true;
    this.client.maxReconnectAttempts = maxAttempts;
  }

  /**
   * Disable auto-reconnection
   */
  public disableAutoReconnect(): void {
    this.client.enableAutoReconnect = false;
  }

  /**
   * Get connection status
   */
  public isConnected(): boolean {
    return this.client.isConnected;
  }

  /**
   * Get session metrics for analysis
   */
  public getMetrics(): any {
    return {
      sessionId: this._sessionId,
      isActive: this._isActive,
      duration: this.startTime > 0 ? Date.now() - this.startTime : 0,
      configuration: {
        voice: this.config.voice,
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens
      }
    };
  }

  /**
   * Cleanup resources
   */
  public dispose(): void {
    if (this._isActive) {
      this.stop();
    }

    // Clear event handlers
    this.onSessionReady = null;
    this.onTranscript = null;
    this.onAudioResponse = null;
    this.onTextResponse = null;
    this.onError = null;
    this.onDisconnect = null;
  }
}
