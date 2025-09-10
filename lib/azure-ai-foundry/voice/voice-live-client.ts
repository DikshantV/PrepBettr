/**
 * Azure AI Foundry Voice Live Client
 * 
 * Provides real-time voice streaming capabilities using Azure AI Foundry's voice services.
 * Features WebSocket-based audio streaming, exponential backoff retry logic, and session management.
 */

import { getEnv, type VoiceEnvironmentConfig, validateVoiceConfig } from './foundry-environment';
import { VoiceTelemetry, VoiceConnectionError } from './voice-telemetry';

/**
 * Voice session options for creating new sessions
 */
export interface VoiceSessionOptions {
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
 * Voice session metadata returned when creating a session
 */
export interface VoiceSession {
  sessionId: string;
  wsUrl: string;
  options: VoiceSessionOptions;
  createdAt: Date;
}

/**
 * Voice settings that can be updated at runtime
 */
export interface VoiceSettings {
  voiceName?: string;
  speakingRate?: number;
  emotionalTone?: string;
}

/**
 * WebSocket connection state
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error' | 'closed';

/**
 * WebSocket message types for Azure AI Foundry voice service
 */
export interface VoiceWebSocketMessage {
  type: 'audio' | 'transcript' | 'response' | 'control' | 'error' | 'config';
  data?: any;
  sessionId?: string;
  timestamp?: number;
}

/**
 * Audio frame data for streaming
 */
export interface AudioFrame {
  audioData: ArrayBuffer | Uint8Array;
  timestamp: number;
  sampleRate: number;
  channels: number;
}

/**
 * WebSocket Manager with exponential backoff and retry logic
 */
class WebSocketManager {
  private ws: WebSocket | null = null;
  private connectionState: ConnectionState = 'disconnected';
  private retryCount = 0;
  private readonly maxRetries = 5;
  private readonly baseDelay = 1000; // 1 second
  private readonly maxDelay = 30000; // 30 seconds
  private retryTimeoutId: NodeJS.Timeout | null = null;

  private eventListeners = new Map<string, Set<(data: any) => void>>();

  constructor(
    private url: string,
    private protocols?: string[]
  ) {}

  /**
   * Connect to WebSocket with retry logic
   */
  async connect(): Promise<void> {
    if (this.connectionState === 'connected' || this.connectionState === 'connecting') {
      return;
    }

    this.connectionState = 'connecting';
    console.log(`🔌 [WebSocketManager] Connecting to ${this.url}...`);
    
    // Track connection attempt
    const connectionStartTime = Date.now();
    VoiceTelemetry.trackConnection('connecting', 'websocket', { retryCount: this.retryCount });

    try {
      this.ws = new WebSocket(this.url, this.protocols);
      
      this.ws.onopen = () => {
        const connectionTime = Date.now() - connectionStartTime;
        console.log('✅ [WebSocketManager] Connected successfully');
        this.connectionState = 'connected';
        this.retryCount = 0; // Reset retry count on successful connection
        
        // Track successful connection
        VoiceTelemetry.trackConnection('connected', 'websocket', { 
          connectionTime,
          retryCount: 0 
        });
        
        this.emit('connected', null);
      };

      this.ws.onclose = (event) => {
        console.log(`🔌 [WebSocketManager] Connection closed: ${event.code} ${event.reason}`);
        this.connectionState = 'disconnected';
        
        // Track disconnection with reason
        VoiceTelemetry.trackConnection('disconnected', 'websocket', {
          disconnectionReason: `${event.code}: ${event.reason}`,
          retryCount: this.retryCount
        });
        
        this.emit('disconnected', { code: event.code, reason: event.reason });
        
        // Auto-retry if not a normal closure
        if (event.code !== 1000 && this.retryCount < this.maxRetries) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ [WebSocketManager] Connection error:', error);
        this.connectionState = 'error';
        this.emit('error', error);
      };

      this.ws.onmessage = (event) => {
        try {
          const message: VoiceWebSocketMessage = JSON.parse(event.data);
          console.log(`📨 [WebSocketManager] Received message type: ${message.type}`);
          this.emit('message', message);
          this.emit(message.type, message.data);
        } catch (error) {
          console.error('❌ [WebSocketManager] Failed to parse message:', error);
          // Handle binary audio data
          if (event.data instanceof ArrayBuffer || event.data instanceof Blob) {
            this.emit('binaryData', event.data);
          }
        }
      };

      // Wait for connection to establish or fail
      await this.waitForConnection();

    } catch (error) {
      console.error('❌ [WebSocketManager] Connection failed:', error);
      this.connectionState = 'error';
      
      // Track connection failure
      const connectionError = new VoiceConnectionError(
        `Connection failed: ${error instanceof Error ? error.message : String(error)}`,
        'websocket',
        this.retryCount,
        error instanceof Error ? error : undefined
      );
      
      VoiceTelemetry.trackError(connectionError, 'websocket', 'WebSocket Connection', false);
      
      if (this.retryCount < this.maxRetries) {
        this.scheduleReconnect();
      } else {
        throw connectionError;
      }
    }
  }

  /**
   * Send data through WebSocket
   */
  send(data: string | ArrayBuffer | Uint8Array): boolean {
    if (this.connectionState !== 'connected' || !this.ws) {
      console.warn('⚠️ [WebSocketManager] Cannot send: not connected');
      return false;
    }

    try {
      this.ws.send(data);
      return true;
    } catch (error) {
      console.error('❌ [WebSocketManager] Send failed:', error);
      return false;
    }
  }

  /**
   * Send audio frame with proper formatting
   */
  sendAudioFrame(frame: AudioFrame): boolean {
    const message: VoiceWebSocketMessage = {
      type: 'audio',
      data: {
        audioData: Array.from(new Uint8Array(frame.audioData)),
        timestamp: frame.timestamp,
        sampleRate: frame.sampleRate,
        channels: frame.channels
      },
      timestamp: Date.now()
    };

    return this.send(JSON.stringify(message));
  }

  /**
   * Close WebSocket connection
   */
  close(code: number = 1000, reason: string = 'Normal closure'): void {
    console.log(`🔌 [WebSocketManager] Closing connection: ${code} ${reason}`);
    
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }

    if (this.ws) {
      this.connectionState = 'closed';
      this.ws.close(code, reason);
      this.ws = null;
    }

    this.eventListeners.clear();
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Add event listener
   */
  on(event: string, callback: (data: any) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  /**
   * Remove event listener
   */
  off(event: string, callback: (data: any) => void): void {
    this.eventListeners.get(event)?.delete(callback);
  }

  /**
   * Emit event to listeners
   */
  private emit(event: string, data: any): void {
    this.eventListeners.get(event)?.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`❌ [WebSocketManager] Event listener error for ${event}:`, error);
      }
    });
  }

  /**
   * Wait for WebSocket connection to establish
   */
  private waitForConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 10000); // 10 second timeout

      const onConnected = () => {
        clearTimeout(timeout);
        this.off('connected', onConnected);
        this.off('error', onError);
        resolve();
      };

      const onError = (error: any) => {
        clearTimeout(timeout);
        this.off('connected', onConnected);
        this.off('error', onError);
        reject(error);
      };

      this.on('connected', onConnected);
      this.on('error', onError);
    });
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    this.retryCount++;
    const delay = Math.min(
      this.baseDelay * Math.pow(2, this.retryCount - 1) + Math.random() * 1000,
      this.maxDelay
    );

    console.log(`🔄 [WebSocketManager] Scheduling reconnect attempt ${this.retryCount}/${this.maxRetries} in ${delay}ms`);
    
    this.retryTimeoutId = setTimeout(() => {
      this.connect().catch(error => {
        console.error('❌ [WebSocketManager] Reconnection failed:', error);
      });
    }, delay);
  }
}

/**
 * Azure AI Foundry Voice Live Client
 */
export class VoiceLiveClient {
  private config: VoiceEnvironmentConfig | null = null;
  private activeSessions = new Map<string, VoiceSession>();

  /**
   * Initialize the client with configuration
   */
  async init(forceRefresh = false): Promise<void> {
    console.log('🔧 [VoiceLiveClient] Initializing...');
    
    this.config = await getEnv(forceRefresh);
    
    const validation = validateVoiceConfig(this.config);
    if (!validation.isValid) {
      throw new Error(`Invalid voice configuration: ${validation.errors.join(', ')}`);
    }

    console.log('✅ [VoiceLiveClient] Initialized successfully');
  }

  /**
   * Create a new voice session with default settings
   */
  async createSession(options: VoiceSessionOptions = {}): Promise<VoiceSession> {
    if (!this.config) {
      await this.init();
    }

    // Apply default settings
    const sessionOptions: VoiceSessionOptions = {
      voiceName: options.voiceName || 'neural-hd-professional',
      locale: options.locale || 'en-US',
      speakingRate: options.speakingRate || 1.0,
      emotionalTone: options.emotionalTone || 'neutral',
      audioSettings: {
        noiseSuppression: true,
        echoCancellation: true,
        interruptionDetection: true,
        sampleRate: 16000,
        ...options.audioSettings
      }
    };

    console.log('🎤 [VoiceLiveClient] Creating voice session with options:', sessionOptions);

    try {
      // Call Azure AI Foundry API to create session
      const response = await fetch(`${this.config!.endpoint}/openai/realtime/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.config!.apiKey,
          'X-Project-ID': this.config!.projectId
        },
        body: JSON.stringify({
          model: this.config!.deploymentName || 'gpt-4o-realtime-preview',
          voice: sessionOptions.voiceName,
          input_audio_format: 'pcm16',
          output_audio_format: 'pcm16',
          turn_detection: sessionOptions.audioSettings?.interruptionDetection ? {
            type: 'server_vad',
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 800
          } : null,
          tools: [],
          tool_choice: 'none',
          temperature: 0.7,
          max_response_output_tokens: 4096
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Session creation failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const sessionData = await response.json();
      
      const session: VoiceSession = {
        sessionId: sessionData.id,
        wsUrl: sessionData.websocket_url,
        options: sessionOptions,
        createdAt: new Date()
      };

      // Store session for later reference
      this.activeSessions.set(session.sessionId, session);

      console.log(`✅ [VoiceLiveClient] Session created: ${session.sessionId}`);
      return session;

    } catch (error) {
      console.error('❌ [VoiceLiveClient] Session creation failed:', error);
      throw error;
    }
  }

  /**
   * Create WebSocket manager for a session
   */
  createWebSocketManager(session: VoiceSession): WebSocketManager {
    return new WebSocketManager(session.wsUrl, ['realtime']);
  }

  /**
   * Update voice settings for active sessions
   */
  updateSettings(sessionId: string, settings: Partial<VoiceSettings>): boolean {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      console.warn(`⚠️ [VoiceLiveClient] Session not found: ${sessionId}`);
      return false;
    }

    // Update session options
    Object.assign(session.options, settings);

    console.log(`🔧 [VoiceLiveClient] Updated settings for session ${sessionId}:`, settings);
    return true;
  }

  /**
   * Get active session by ID
   */
  getSession(sessionId: string): VoiceSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  /**
   * Remove session from active sessions
   */
  removeSession(sessionId: string): void {
    this.activeSessions.delete(sessionId);
    console.log(`🗑️ [VoiceLiveClient] Removed session: ${sessionId}`);
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): VoiceSession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Cleanup all sessions
   */
  cleanup(): void {
    console.log('🧹 [VoiceLiveClient] Cleaning up all sessions');
    this.activeSessions.clear();
  }
}

// Singleton instance
let voiceLiveClientInstance: VoiceLiveClient | null = null;

/**
 * Get shared VoiceLiveClient instance
 */
export function getVoiceLiveClient(): VoiceLiveClient {
  if (!voiceLiveClientInstance) {
    voiceLiveClientInstance = new VoiceLiveClient();
  }
  return voiceLiveClientInstance;
}
