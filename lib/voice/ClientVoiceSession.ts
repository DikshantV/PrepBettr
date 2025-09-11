/**
 * Client-side Voice Session Wrapper
 * 
 * Provides a client-safe interface to voice sessions without Azure dependencies.
 * Communicates with server-side voice sessions via WebSocket proxy.
 */

export interface ClientVoiceSessionOptions {
  sessionId: string;
  wsUrl?: string;
}

export interface VoiceSessionCallbacks {
  onTranscript?: (transcript: string, isFinal: boolean) => void;
  onAgentResponse?: (response: { text: string; audioData?: ArrayBuffer }) => void;
  onError?: (error: Error) => void;
  onConnectionStateChange?: (state: 'connecting' | 'connected' | 'disconnected' | 'error') => void;
}

export interface AudioFrame {
  audioData: ArrayBuffer | Uint8Array;
  timestamp: number;
  sampleRate: number;
  channels: number;
}

/**
 * Lightweight client-side voice session that proxies to server
 */
export class ClientVoiceSession {
  private sessionId: string;
  private wsUrl: string;
  private ws: WebSocket | null = null;
  private callbacks: VoiceSessionCallbacks = {};
  private connectionState: 'connecting' | 'connected' | 'disconnected' | 'error' = 'disconnected';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(options: ClientVoiceSessionOptions) {
    this.sessionId = options.sessionId;
    this.wsUrl = options.wsUrl || `/api/voice/session/${this.sessionId}/ws`;
  }

  /**
   * Start the voice session
   */
  async start(): Promise<void> {
    if (this.connectionState === 'connected') {
      return;
    }

    this.connectionState = 'connecting';
    this.notifyConnectionState('connecting');

    try {
      // Check if we're in development mode and should use mock mode
      const isDevelopment = process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost';
      
      if (isDevelopment && this.sessionId.startsWith('fallback_')) {
        console.log('🔧 [ClientVoiceSession] Starting in development mock mode');
        await this.startMockSession();
        return;
      }

      // Create WebSocket connection to our proxy
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}${this.wsUrl}`;
      
      this.ws = new WebSocket(wsUrl, ['realtime']);
      
      this.ws.onopen = () => {
        console.log('✅ [ClientVoiceSession] Connected to voice session');
        this.connectionState = 'connected';
        this.reconnectAttempts = 0;
        this.notifyConnectionState('connected');
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event);
      };

      this.ws.onclose = (event) => {
        console.log(`🔌 [ClientVoiceSession] Connection closed: ${event.code}`);
        this.connectionState = 'disconnected';
        this.notifyConnectionState('disconnected');
        
        // Auto-reconnect if not intentional close
        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.warn('⚠️ [ClientVoiceSession] WebSocket connection failed, falling back to mock mode');
        this.startMockSession().catch((fallbackError) => {
          console.warn('⚠️ [ClientVoiceSession] Mock fallback also failed:', fallbackError);
        });
      };

      // Wait for connection to establish with timeout
      await Promise.race([
        this.waitForConnection(),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Connection timeout')), 5000);
        })
      ]);

    } catch (error) {
      console.warn('⚠️ [ClientVoiceSession] Connection failed, falling back to mock mode:', error);
      await this.startMockSession();
    }
  }

  /**
   * Start mock session for development/fallback
   */
  private async startMockSession(): Promise<void> {
    console.log('🎭 [ClientVoiceSession] Starting mock voice session');
    
    this.connectionState = 'connected';
    this.notifyConnectionState('connected');
    
    // Simulate connection success after a short delay
    setTimeout(() => {
      console.log('✅ [ClientVoiceSession] Mock session ready');
    }, 100);
  }

  /**
   * Stop the voice session
   */
  async stop(): Promise<void> {
    if (this.ws) {
      this.ws.close(1000, 'Session stopped by user');
      this.ws = null;
    }
    this.connectionState = 'disconnected';
    this.notifyConnectionState('disconnected');
  }

  /**
   * Send audio data to the session
   */
  sendAudio(audioFrame: AudioFrame): boolean {
    if (this.connectionState !== 'connected') {
      return false;
    }

    // Handle mock session
    if (!this.ws) {
      console.log('🎭 [ClientVoiceSession] Mock audio sent (no actual processing)');
      
      // Simulate transcript after a delay
      setTimeout(() => {
        if (this.callbacks.onTranscript) {
          this.callbacks.onTranscript('This is a mock transcript for development', true);
        }
      }, 1000);
      
      return true;
    }

    try {
      const message = {
        type: 'audio',
        data: {
          audioData: Array.from(new Uint8Array(audioFrame.audioData)),
          timestamp: audioFrame.timestamp,
          sampleRate: audioFrame.sampleRate,
          channels: audioFrame.channels
        }
      };

      this.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.warn('⚠️ [ClientVoiceSession] Failed to send audio (expected in fallback mode):', error);
      return false;
    }
  }

  /**
   * Send text input to the session
   */
  sendText(text: string): boolean {
    if (this.connectionState !== 'connected') {
      return false;
    }

    // Handle mock session
    if (!this.ws) {
      console.log('🎭 [ClientVoiceSession] Mock text sent:', text);
      
      // Simulate agent response after a delay
      setTimeout(() => {
        if (this.callbacks.onAgentResponse) {
          this.callbacks.onAgentResponse({
            text: `Thank you for your input: "${text}". This is a mock response for development.`,
            audioData: undefined
          });
        }
      }, 1500);
      
      return true;
    }

    try {
      const message = {
        type: 'text',
        data: { text }
      };

      this.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.warn('⚠️ [ClientVoiceSession] Failed to send text (expected in fallback mode):', error);
      return false;
    }
  }

  /**
   * Register callbacks for session events
   */
  on(event: keyof VoiceSessionCallbacks, callback: any): void {
    this.callbacks[event] = callback;
  }

  /**
   * Get current connection state
   */
  getConnectionState(): string {
    return this.connectionState;
  }

  /**
   * Get session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  // Private methods

  private handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'transcript':
          if (this.callbacks.onTranscript) {
            this.callbacks.onTranscript(message.data.text, message.data.isFinal);
          }
          break;
          
        case 'agent_response':
          if (this.callbacks.onAgentResponse) {
            this.callbacks.onAgentResponse({
              text: message.data.text,
              audioData: message.data.audioData ? new Uint8Array(message.data.audioData).buffer : undefined
            });
          }
          break;
          
        case 'error':
          if (this.callbacks.onError) {
            this.callbacks.onError(new Error(message.data.message));
          }
          break;
          
        case 'control':
          // Handle control messages (like connection confirmation)
          console.log('📋 [ClientVoiceSession] Control message:', message.data);
          break;
          
        default:
          console.log('📨 [ClientVoiceSession] Unknown message type:', message.type);
      }
    } catch (error) {
      console.warn('⚠️ [ClientVoiceSession] Failed to parse message (expected in fallback mode):', error);
      
      // Handle binary audio data
      if (event.data instanceof ArrayBuffer) {
        if (this.callbacks.onAgentResponse) {
          this.callbacks.onAgentResponse({
            text: '',
            audioData: event.data
          });
        }
      }
    }
  }

  private notifyConnectionState(state: 'connecting' | 'connected' | 'disconnected' | 'error'): void {
    if (this.callbacks.onConnectionStateChange) {
      this.callbacks.onConnectionStateChange(state);
    }
  }

  private notifyError(error: Error): void {
    if (this.callbacks.onError) {
      this.callbacks.onError(error);
    }
  }

  private async waitForConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 10000);

      const checkConnection = () => {
        if (this.connectionState === 'connected') {
          clearTimeout(timeout);
          resolve();
        } else if (this.connectionState === 'error') {
          clearTimeout(timeout);
          reject(new Error('Connection failed'));
        } else {
          setTimeout(checkConnection, 100);
        }
      };

      checkConnection();
    });
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
    
    console.log(`🔄 [ClientVoiceSession] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.start().catch(error => {
        console.warn('⚠️ [ClientVoiceSession] Reconnection failed, continuing with fallback:', error);
      });
    }, delay);
  }
}
