/**
 * Azure AI Foundry Voice Session
 * 
 * Manages the lifecycle of a voice streaming session, including audio input/output,
 * transcript handling, and WebSocket communication.
 */

import { 
  VoiceLiveClient, 
  VoiceSession as VoiceSessionMetadata, 
  AudioFrame, 
  VoiceWebSocketMessage 
} from './voice-live-client';
import { VoiceTelemetry, VoiceAudioError, VoiceSessionError } from './voice-telemetry';

/**
 * Audio processing configuration
 */
interface AudioConfig {
  sampleRate: number;
  channels: number;
  chunkDurationMs: number;
  bufferSize: number;
}

/**
 * Transcript event data
 */
export interface TranscriptEvent {
  text: string;
  timestamp: number;
  confidence?: number;
  isFinal: boolean;
}

/**
 * Audio response event data
 */
export interface AudioResponseEvent {
  audioData: Blob;
  timestamp: number;
  duration?: number;
}

/**
 * Session state tracking
 */
export type SessionState = 'idle' | 'starting' | 'active' | 'stopping' | 'stopped' | 'error';

/**
 * Voice Session class for managing real-time voice streaming
 */
export class VoiceSession {
  private client: VoiceLiveClient;
  private sessionMeta: VoiceSessionMetadata;
  private websocketManager: any; // WebSocketManager from voice-live-client
  
  private state: SessionState = 'idle';
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private audioWorkletNode: AudioWorkletNode | null = null;
  
  private transcriptCallbacks = new Set<(event: TranscriptEvent) => void>();
  private responseCallbacks = new Set<(event: AudioResponseEvent) => void>();
  
  private audioConfig: AudioConfig = {
    sampleRate: 16000,
    channels: 1,
    chunkDurationMs: 20, // 20ms chunks
    bufferSize: 320 // 20ms * 16kHz = 320 samples
  };

  // Cleanup handling
  private cleanupHandlers = new Set<() => void>();
  private isPageUnloading = false;

  constructor(client: VoiceLiveClient, sessionMeta: VoiceSessionMetadata) {
    this.client = client;
    this.sessionMeta = sessionMeta;
    this.websocketManager = client.createWebSocketManager(sessionMeta);
    
    // Setup page unload cleanup
    this.setupPageUnloadCleanup();
  }

  /**
   * Start the voice session and begin audio streaming
   */
  async start(audioStream?: MediaStream): Promise<void> {
    if (this.state !== 'idle') {
      console.warn(`⚠️ [VoiceSession] Cannot start: current state is ${this.state}`);
      return;
    }

    this.state = 'starting';
    const sessionStartTime = Date.now();
    console.log(`🚀 [VoiceSession] Starting session ${this.sessionMeta.sessionId}...`);
    
    // Initialize telemetry for this session
    VoiceTelemetry.startSession(this.sessionMeta.sessionId);

    try {
      // Initialize audio context
      await this.initializeAudioContext();

      // Get audio stream (use provided or request new one)
      if (audioStream) {
        this.mediaStream = audioStream;
      } else {
        await this.requestMicrophoneAccess();
      }

      // Connect WebSocket
      await this.websocketManager.connect();

      // Setup WebSocket event handlers
      this.setupWebSocketHandlers();

      // Start audio processing
      await this.startAudioProcessing();

      this.state = 'active';
      console.log(`✅ [VoiceSession] Session ${this.sessionMeta.sessionId} started successfully`);

    } catch (error) {
      console.error(`❌ [VoiceSession] Failed to start session:`, error);
      this.state = 'error';
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Register callback for transcript events
   */
  onTranscript(callback: (event: TranscriptEvent) => void): void {
    this.transcriptCallbacks.add(callback);
    
    // Add cleanup handler
    this.cleanupHandlers.add(() => {
      this.transcriptCallbacks.delete(callback);
    });
  }

  /**
   * Register callback for audio response events
   */
  onResponse(callback: (event: AudioResponseEvent) => void): void {
    this.responseCallbacks.add(callback);
    
    // Add cleanup handler
    this.cleanupHandlers.add(() => {
      this.responseCallbacks.delete(callback);
    });
  }

  /**
   * Stop the session gracefully
   */
  async stop(graceful: boolean = true): Promise<void> {
    if (this.state === 'stopped' || this.state === 'stopping') {
      return;
    }

    this.state = 'stopping';
    console.log(`🛑 [VoiceSession] Stopping session ${this.sessionMeta.sessionId}...`);

    try {
      if (graceful) {
        // Send final audio chunk and wait for pending responses
        await this.flushAudioBuffers();
        await this.waitForPendingResponses();
      }

      // Close WebSocket connection
      this.websocketManager.close(graceful ? 1000 : 1001, graceful ? 'Normal closure' : 'Forced closure');

      // Clean up audio resources
      await this.cleanup();

      // Remove from client's active sessions
      this.client.removeSession(this.sessionMeta.sessionId);

      this.state = 'stopped';
      console.log(`✅ [VoiceSession] Session ${this.sessionMeta.sessionId} stopped successfully`);

    } catch (error) {
      console.error(`❌ [VoiceSession] Error stopping session:`, error);
      this.state = 'error';
      throw error;
    }
  }

  /**
   * Get current session state
   */
  getState(): SessionState {
    return this.state;
  }

  /**
   * Get session ID
   */
  get sessionId(): string {
    return this.sessionMeta.sessionId;
  }

  /**
   * Get session metadata
   */
  getMetadata(): VoiceSessionMetadata {
    return { ...this.sessionMeta };
  }

  /**
   * Initialize audio context with optimal settings
   */
  private async initializeAudioContext(): Promise<void> {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: this.audioConfig.sampleRate,
        latencyHint: 'interactive'
      });

      // Resume context if suspended (required by browser policies)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      console.log(`🎵 [VoiceSession] Audio context initialized: ${this.audioContext.sampleRate}Hz`);

    } catch (error) {
      console.error('❌ [VoiceSession] Failed to initialize audio context:', error);
      throw new Error('Audio context initialization failed');
    }
  }

  /**
   * Request microphone access
   */
  private async requestMicrophoneAccess(): Promise<void> {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.audioConfig.sampleRate,
          channelCount: this.audioConfig.channels,
          echoCancellation: this.sessionMeta.options.audioSettings?.echoCancellation ?? true,
          noiseSuppression: this.sessionMeta.options.audioSettings?.noiseSuppression ?? true,
          autoGainControl: true
        }
      });

      console.log('🎤 [VoiceSession] Microphone access granted');

    } catch (error) {
      console.error('❌ [VoiceSession] Failed to access microphone:', error);
      throw new Error('Microphone access denied or failed');
    }
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupWebSocketHandlers(): void {
    // Handle transcript events
    this.websocketManager.on('transcript', (data: any) => {
      const transcriptEvent: TranscriptEvent = {
        text: data.text || '',
        timestamp: data.timestamp || Date.now(),
        confidence: data.confidence,
        isFinal: data.is_final || false
      };

      console.log(`📝 [VoiceSession] Transcript: "${transcriptEvent.text}" (confidence: ${transcriptEvent.confidence})`);
      
      // Track transcript event with telemetry
      VoiceTelemetry.getInstance().logTranscriptEvent(
        transcriptEvent.isFinal ? 'transcript_final' : 'transcript_partial',
        this.sessionMeta.sessionId,
        transcriptEvent.text,
        transcriptEvent.confidence
      );
      
      this.transcriptCallbacks.forEach(callback => {
        try {
          callback(transcriptEvent);
        } catch (error) {
          console.error('❌ [VoiceSession] Transcript callback error:', error);
          VoiceTelemetry.trackError(error as Error, this.sessionMeta.sessionId, 'Transcript callback');
        }
      });
    });

    // Handle audio response events
    this.websocketManager.on('response', async (data: any) => {
      if (data.audio_data) {
        try {
          // Convert audio data to blob
          const audioData = new Uint8Array(data.audio_data);
          const audioBlob = new Blob([audioData], { type: 'audio/wav' });

          const responseEvent: AudioResponseEvent = {
            audioData: audioBlob,
            timestamp: data.timestamp || Date.now(),
            duration: data.duration
          };

          console.log(`🔊 [VoiceSession] Audio response received (${audioBlob.size} bytes)`);

          // Play audio response
          await this.playAudioResponse(audioBlob);

          this.responseCallbacks.forEach(callback => {
            try {
              callback(responseEvent);
            } catch (error) {
              console.error('❌ [VoiceSession] Response callback error:', error);
            }
          });

        } catch (error) {
          console.error('❌ [VoiceSession] Failed to process audio response:', error);
        }
      }
    });

    // Handle connection events
    this.websocketManager.on('disconnected', (event: any) => {
      console.warn(`⚠️ [VoiceSession] WebSocket disconnected: ${event.code} ${event.reason}`);
      if (this.state === 'active' && !this.isPageUnloading) {
        // Auto-reconnect logic is handled by WebSocketManager
        console.log('🔄 [VoiceSession] WebSocket will attempt to reconnect...');
      }
    });

    // Handle errors
    this.websocketManager.on('error', (error: any) => {
      console.error('❌ [VoiceSession] WebSocket error:', error);
      this.state = 'error';
    });
  }

  /**
   * Start audio processing and streaming
   */
  private async startAudioProcessing(): Promise<void> {
    if (!this.audioContext || !this.mediaStream) {
      throw new Error('Audio context or media stream not initialized');
    }

    try {
      // Create audio source from media stream
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Create processor for audio chunking
      this.audioWorkletNode = await this.createAudioWorkletNode();

      // Connect audio pipeline
      source.connect(this.audioWorkletNode);
      
      console.log('🎵 [VoiceSession] Audio processing pipeline started');

    } catch (error) {
      console.error('❌ [VoiceSession] Failed to start audio processing:', error);
      throw error;
    }
  }

  /**
   * Create audio worklet node for processing audio chunks
   */
  private async createAudioWorkletNode(): Promise<AudioWorkletNode> {
    if (!this.audioContext) {
      throw new Error('Audio context not initialized');
    }

    // Create a simple ScriptProcessorNode as fallback if AudioWorklet is not available
    // In production, you'd want to implement a proper AudioWorklet
    const bufferSize = 4096; // Fixed buffer size for ScriptProcessorNode
    const processor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);

    processor.onaudioprocess = (event) => {
      const inputBuffer = event.inputBuffer.getChannelData(0);
      
      // Create audio frame
      const audioFrame: AudioFrame = {
        audioData: inputBuffer.buffer.slice(0), // Copy the buffer
        timestamp: Date.now(),
        sampleRate: this.audioConfig.sampleRate,
        channels: this.audioConfig.channels
      };

      // Send audio frame to WebSocket
      if (this.websocketManager.getState() === 'connected') {
        this.websocketManager.sendAudioFrame(audioFrame);
      }
    };

    // Connect to destination to keep the processor active
    processor.connect(this.audioContext.destination);

    return processor as any; // Type assertion for compatibility
  }

  /**
   * Play audio response through speakers
   */
  private async playAudioResponse(audioBlob: Blob): Promise<void> {
    try {
      if (!this.audioContext) {
        throw new Error('Audio context not available');
      }

      // Convert blob to array buffer
      const arrayBuffer = await audioBlob.arrayBuffer();
      
      // Decode audio data
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      // Create audio source
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      
      // Play audio
      source.start();
      
      console.log(`🔊 [VoiceSession] Playing audio response (${audioBuffer.duration.toFixed(2)}s)`);

    } catch (error) {
      console.error('❌ [VoiceSession] Failed to play audio response:', error);
      // Don't throw error to avoid breaking the session
    }
  }

  /**
   * Flush any pending audio buffers
   */
  private async flushAudioBuffers(): Promise<void> {
    // Implementation depends on the audio processing pipeline
    console.log('🔄 [VoiceSession] Flushing audio buffers...');
    
    // Send a flush signal to the WebSocket
    const flushMessage: VoiceWebSocketMessage = {
      type: 'control',
      data: { action: 'flush' },
      sessionId: this.sessionMeta.sessionId,
      timestamp: Date.now()
    };

    this.websocketManager.send(JSON.stringify(flushMessage));
    
    // Wait a bit for any pending audio to be processed
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Wait for any pending responses to complete
   */
  private async waitForPendingResponses(): Promise<void> {
    console.log('⏳ [VoiceSession] Waiting for pending responses...');
    
    // Simple timeout-based wait - in production, you'd track pending requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  /**
   * Setup page unload cleanup
   */
  private setupPageUnloadCleanup(): void {
    const handlePageUnload = () => {
      this.isPageUnloading = true;
      this.stop(false); // Force stop on page unload
    };

    window.addEventListener('beforeunload', handlePageUnload);
    window.addEventListener('unload', handlePageUnload);

    this.cleanupHandlers.add(() => {
      window.removeEventListener('beforeunload', handlePageUnload);
      window.removeEventListener('unload', handlePageUnload);
    });
  }

  /**
   * Clean up all resources
   */
  private async cleanup(): Promise<void> {
    console.log('🧹 [VoiceSession] Cleaning up resources...');

    // Stop media stream
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => {
        track.stop();
        console.log(`🛑 [VoiceSession] Stopped ${track.kind} track`);
      });
      this.mediaStream = null;
    }

    // Disconnect audio nodes
    if (this.audioWorkletNode) {
      this.audioWorkletNode.disconnect();
      this.audioWorkletNode = null;
    }

    // Close audio context
    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close();
      this.audioContext = null;
    }

    // Run cleanup handlers
    this.cleanupHandlers.forEach(handler => {
      try {
        handler();
      } catch (error) {
        console.error('❌ [VoiceSession] Cleanup handler error:', error);
      }
    });
    this.cleanupHandlers.clear();

    // Clear callbacks
    this.transcriptCallbacks.clear();
    this.responseCallbacks.clear();

    console.log('✅ [VoiceSession] Cleanup completed');
  }
}
