/**
 * Voice Live Client - Azure AI Foundry WebSocket Integration
 * Handles real-time voice communication with Azure OpenAI Realtime API
 */

import { ConfigOptions, FoundryVoiceSession, FoundryVoiceError } from './types';
import { voiceTelemetry } from './voice-telemetry';

export class ConnectionError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'ConnectionError';
  }
}

export class VoiceLiveClient {
  private ws: WebSocket | null = null;
  private config: ConfigOptions;
  private isConnectionActive = false;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;

  // Public configuration
  public enableAutoReconnect = false;
  public maxReconnectAttempts = 3;

  // Event handlers
  public onSessionCreated: ((session: FoundryVoiceSession) => void) | null = null;
  public onTranscript: ((transcript: string) => void) | null = null;
  public onAudioDelta: ((audioData: string) => void) | null = null;
  public onTextDelta: ((textDelta: string) => void) | null = null;
  public onError: ((error: FoundryVoiceError) => void) | null = null;
  public onDisconnect: ((code: number, reason: string) => void) | null = null;

  constructor(config: ConfigOptions) {
    this.config = this.validateConfig(config);
    voiceTelemetry.trackClientCreation({
      endpoint: config.endpoint,
      deploymentId: config.deploymentId,
      voice: config.voice
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

  /**
   * Connect to Azure AI Foundry WebSocket
   */
  public async connect(): Promise<void> {
    if (this.isConnectionActive) {
      console.warn('Connection already active');
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        voiceTelemetry.trackConnectionAttempt({
          endpoint: this.config.endpoint,
          attempt: this.reconnectAttempts + 1
        });

        const wsUrl = this.buildWebSocketUrl();
        this.ws = new WebSocket(wsUrl, ['azure-openai-realtime']);

        const connectionTimeout = setTimeout(() => {
          if (this.ws) {
            this.ws.close();
            const error = new ConnectionError('Connection timeout');
            voiceTelemetry.trackConnectionFailure(error, {
              reason: 'timeout',
              attempt: this.reconnectAttempts + 1
            });
            reject(error);
          }
        }, 10000); // 10 second timeout

        this.ws.onopen = () => {
          clearTimeout(connectionTimeout);
          this.isConnectionActive = true;
          this.reconnectAttempts = 0;
          
          voiceTelemetry.trackConnectionSuccess({
            endpoint: this.config.endpoint,
            sessionId: `foundry-${Date.now()}`
          });

          // Send session configuration
          this.sendSessionConfig();
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event);
        };

        this.ws.onclose = (event) => {
          clearTimeout(connectionTimeout);
          this.isConnectionActive = false;
          
          voiceTelemetry.trackConnectionClosed({
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean
          });

          if (this.onDisconnect) {
            this.onDisconnect(event.code, event.reason);
          }

          // Attempt reconnection if enabled and not a clean close
          if (this.enableAutoReconnect && !event.wasClean && event.code !== 1000) {
            this.attemptReconnect();
          }
        };

        this.ws.onerror = (event) => {
          clearTimeout(connectionTimeout);
          const error = new ConnectionError('WebSocket connection failed');
          voiceTelemetry.trackConnectionFailure(error, {
            reason: 'websocket_error',
            attempt: this.reconnectAttempts + 1
          });
          reject(error);
        };

      } catch (error) {
        const connectionError = error instanceof Error ? error : new Error('Unknown connection error');
        voiceTelemetry.trackConnectionFailure(connectionError, {
          reason: 'setup_error',
          attempt: this.reconnectAttempts + 1
        });
        reject(connectionError);
      }
    });
  }

  /**
   * Disconnect from WebSocket
   */
  public disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws && this.isConnectionActive) {
      this.ws.close(1000, 'Client disconnect');
    }

    this.ws = null;
    this.isConnectionActive = false;
    this.reconnectAttempts = 0;
  }

  /**
   * Check if connection is active
   */
  public get isConnected(): boolean {
    return this.isConnectionActive && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Send audio data to the session
   */
  public sendAudio(audioData: ArrayBuffer): void {
    if (!this.isConnected) {
      throw new Error('WebSocket is not connected');
    }

    const base64Audio = this.arrayBufferToBase64(audioData);
    
    const message = {
      type: 'input_audio_buffer.append',
      audio: base64Audio
    };

    this.ws!.send(JSON.stringify(message));
    
    voiceTelemetry.trackAudioSent({
      sessionId: this.getSessionId(),
      audioSize: audioData.byteLength,
      timestamp: Date.now()
    });
  }

  /**
   * Commit audio buffer for processing
   */
  public commitAudio(): void {
    if (!this.isConnected) {
      throw new Error('WebSocket is not connected');
    }

    const message = {
      type: 'input_audio_buffer.commit'
    };

    this.ws!.send(JSON.stringify(message));
  }

  /**
   * Clear audio buffer
   */
  public clearAudioBuffer(): void {
    if (!this.isConnected) {
      throw new Error('WebSocket is not connected');
    }

    const message = {
      type: 'input_audio_buffer.clear'
    };

    this.ws!.send(JSON.stringify(message));
  }

  /**
   * Send text message to the session
   */
  public sendText(text: string): void {
    if (!this.isConnected) {
      throw new Error('WebSocket is not connected');
    }

    // Create conversation item
    const createMessage = {
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: text
          }
        ]
      }
    };

    this.ws!.send(JSON.stringify(createMessage));

    // Trigger response
    const responseMessage = {
      type: 'response.create'
    };

    this.ws!.send(JSON.stringify(responseMessage));

    voiceTelemetry.trackTextSent({
      sessionId: this.getSessionId(),
      textLength: text.length,
      timestamp: Date.now()
    });
  }

  /**
   * Update session settings
   */
  public updateSession(settings: Partial<ConfigOptions>): void {
    if (!this.isConnected) {
      throw new Error('WebSocket is not connected');
    }

    const sessionUpdate: any = {
      type: 'session.update',
      session: {}
    };

    if (settings.temperature !== undefined) {
      sessionUpdate.session.temperature = settings.temperature;
    }

    if (settings.maxTokens !== undefined) {
      sessionUpdate.session.max_response_output_tokens = settings.maxTokens;
    }

    if (settings.voice !== undefined) {
      sessionUpdate.session.voice = settings.voice;
    }

    this.ws!.send(JSON.stringify(sessionUpdate));

    voiceTelemetry.trackConfigUpdate({
      sessionId: this.getSessionId(),
      changes: settings
    });
  }

  private buildWebSocketUrl(): string {
    const url = new URL(this.config.endpoint);
    url.searchParams.set('api-version', '2024-10-01-preview');
    url.searchParams.set('deployment', this.config.deploymentId);
    url.searchParams.set('api-key', this.config.apiKey);
    
    return url.toString();
  }

  private sendSessionConfig(): void {
    const sessionConfig = {
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: this.config.instructionMessage || this.config.systemMessage,
        voice: this.config.voice,
        input_audio_format: this.config.inputAudioFormat,
        output_audio_format: this.config.outputAudioFormat,
        input_audio_transcription: {
          model: 'whisper-1'
        },
        turn_detection: this.config.turnDetection,
        tool_choice: 'auto',
        temperature: this.config.temperature,
        max_response_output_tokens: this.config.maxTokens
      }
    };

    this.ws!.send(JSON.stringify(sessionConfig));
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      
      voiceTelemetry.trackMessageReceived({
        type: data.type,
        sessionId: this.getSessionId(),
        timestamp: Date.now()
      });

      switch (data.type) {
        case 'session.created':
          if (this.onSessionCreated) {
            this.onSessionCreated(data.session);
          }
          break;

        case 'conversation.item.input_audio_transcription.completed':
          if (this.onTranscript) {
            this.onTranscript(data.transcript);
          }
          break;

        case 'response.audio.delta':
          if (this.onAudioDelta) {
            this.onAudioDelta(data.delta);
          }
          break;

        case 'error':
          if (this.onError) {
            this.onError(data.error);
          }
          break;
          
        case 'session.updated':
          // Session configuration updated
          voiceTelemetry.trackSessionEvent({
            eventType: 'SESSION_UPDATED',
            sessionId: this.getSessionId()
          });
          break;
          
        case 'response.text.delta':
          // Text response streaming delta
          if (this.onTextDelta) {
            this.onTextDelta(data.delta || '');
          }
          break;
          
        case 'response.audio.done':
          // Audio generation complete
          voiceTelemetry.trackAudioEvent({
            eventType: 'AUDIO_GENERATION_COMPLETE',
            sessionId: this.getSessionId(),
            durationMs: 0
          });
          break;

        default:
          console.warn('Unknown event type:', data.type);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    const delay = Math.pow(2, this.reconnectAttempts) * 1000; // Exponential backoff
    this.reconnectAttempts++;

    voiceTelemetry.trackReconnectionAttempt({
      attempt: this.reconnectAttempts,
      delay: delay,
      maxAttempts: this.maxReconnectAttempts
    });

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect();
        console.log(`Reconnected successfully after ${this.reconnectAttempts} attempts`);
      } catch (error) {
        console.error(`Reconnection attempt ${this.reconnectAttempts} failed:`, error);
        this.attemptReconnect();
      }
    }, delay);
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private getSessionId(): string {
    // Generate a session ID based on connection time or use existing one
    return `session-${Date.now()}`;
  }
}
