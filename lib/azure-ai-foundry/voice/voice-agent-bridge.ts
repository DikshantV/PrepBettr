/**
 * Voice Agent Bridge
 * Connects VoiceSession with AgentOrchestrator to enable voice-controlled agent interactions
 */

import { VoiceSession } from './voice-session';
import { 
  VoiceEventTypes, 
  VoiceEventHandler, 
  BridgeState, 
  AgentBridgeConfig, 
  SentimentAnalysis,
  TranscriptEntry,
  SessionRecording,
  AudioChunk
} from './types';
import { voiceTelemetry } from './voice-telemetry';

// Event emitter for voice bridge
class VoiceEventEmitter {
  private handlers: Map<string, VoiceEventHandler<any>[]> = new Map();

  on<T extends keyof VoiceEventTypes>(event: T, handler: VoiceEventHandler<T>): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)!.push(handler);
  }

  emit<T extends keyof VoiceEventTypes>(event: T, data: VoiceEventTypes[T]): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }

  off<T extends keyof VoiceEventTypes>(event: T, handler: VoiceEventHandler<T>): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }
}

export class VoiceAgentBridge extends VoiceEventEmitter {
  private voiceSession: VoiceSession;
  private agentOrchestrator: any; // Will be typed when AgentOrchestrator is implemented
  private config: AgentBridgeConfig;
  private state: BridgeState;
  private transcript: TranscriptEntry[] = [];
  private recording: SessionRecording | null = null;

  constructor(
    voiceSession: VoiceSession, 
    agentOrchestrator: any, 
    config?: Partial<AgentBridgeConfig>
  ) {
    super();
    
    this.voiceSession = voiceSession;
    this.agentOrchestrator = agentOrchestrator;
    this.config = {
      sessionTimeout: 1800000, // 30 minutes
      maxRetries: 3,
      errorRecoveryMode: 'graceful',
      sentimentMonitoring: true,
      recordingEnabled: true,
      transcriptStorage: 'both',
      ...config
    };

    this.state = {
      currentAgent: null,
      sessionActive: false,
      lastActivity: Date.now(),
      pendingHandoff: false,
      errorCount: 0,
      recovery: {
        inProgress: false,
        attempts: 0,
        lastAttempt: 0
      }
    };

    this.setupVoiceSessionHandlers();
    this.initializeRecording();

    voiceTelemetry.trackSessionCreated({
      sessionId: this.voiceSession.sessionId,
      config: {
        bridgeConfig: this.config,
        voiceConfig: this.voiceSession.configuration
      }
    });

    console.log('🌉 [VOICE BRIDGE] Bridge created', {
      sessionId: this.voiceSession.sessionId,
      config: this.config
    });
  }

  /**
   * Start the voice bridge and begin listening
   */
  public async start(): Promise<void> {
    try {
      console.log('🚀 [VOICE BRIDGE] Starting bridge', {
        sessionId: this.voiceSession.sessionId
      });

      await this.voiceSession.start();
      this.state.sessionActive = true;
      this.state.lastActivity = Date.now();

      this.emit('session:started', {
        sessionId: this.voiceSession.sessionId,
        agent: this.state.currentAgent || 'initial'
      });

      // Set up activity timeout
      this.setupActivityTimeout();

      voiceTelemetry.trackSessionStart({
        sessionId: this.voiceSession.sessionId,
        deploymentId: this.voiceSession.configuration.deploymentId,
        voice: this.voiceSession.configuration.voice
      });

      console.log('✅ [VOICE BRIDGE] Bridge started successfully');

    } catch (error) {
      const bridgeError = error instanceof Error ? error : new Error('Failed to start bridge');
      
      voiceTelemetry.trackError(bridgeError, 'BRIDGE_START_FAILED', {
        sessionId: this.voiceSession.sessionId
      });

      this.handleError(bridgeError);
      throw bridgeError;
    }
  }

  /**
   * Stop the voice bridge
   */
  public stop(): void {
    console.log('🛑 [VOICE BRIDGE] Stopping bridge', {
      sessionId: this.voiceSession.sessionId
    });

    this.state.sessionActive = false;
    this.voiceSession.stop();

    if (this.recording) {
      this.finalizeRecording();
    }

    this.emit('session:ended', {
      sessionId: this.voiceSession.sessionId,
      reason: 'user_stopped'
    });

    console.log('🏁 [VOICE BRIDGE] Bridge stopped');
  }

  /**
   * Handle agent handoff
   */
  public async handoffToAgent(agentName: string, context?: any): Promise<void> {
    if (this.state.pendingHandoff) {
      console.warn('⚠️ [VOICE BRIDGE] Handoff already in progress');
      return;
    }

    try {
      this.state.pendingHandoff = true;
      const previousAgent = this.state.currentAgent;

      console.log('🔄 [VOICE BRIDGE] Handing off to agent', {
        from: previousAgent,
        to: agentName,
        sessionId: this.voiceSession.sessionId
      });

      // Notify agent orchestrator about handoff
      if (this.agentOrchestrator?.handoff) {
        await this.agentOrchestrator.handoff(agentName, context);
      }

      this.state.currentAgent = agentName;
      this.state.pendingHandoff = false;
      this.state.lastActivity = Date.now();

      this.emit('agent:handoff', {
        from: previousAgent || 'none',
        to: agentName,
        context
      });

      // Update voice session with agent-specific settings if available
      const agentVoiceSettings = this.getAgentVoiceSettings(agentName);
      if (agentVoiceSettings) {
        this.voiceSession.updateSettings(agentVoiceSettings);
      }

      console.log('✅ [VOICE BRIDGE] Handoff completed', {
        currentAgent: agentName
      });

    } catch (error) {
      this.state.pendingHandoff = false;
      const handoffError = error instanceof Error ? error : new Error('Agent handoff failed');
      
      voiceTelemetry.trackError(handoffError, 'AGENT_HANDOFF_FAILED', {
        sessionId: this.voiceSession.sessionId,
        targetAgent: agentName,
        currentAgent: this.state.currentAgent
      });

      this.handleError(handoffError);
      throw handoffError;
    }
  }

  /**
   * Send synthesized audio response
   */
  public async sendAudioResponse(text: string, audioData?: string): Promise<void> {
    try {
      this.state.lastActivity = Date.now();

      this.emit('agent:response', {
        agent: this.state.currentAgent || 'unknown',
        text,
        audioData
      });

      // Add to transcript
      this.addToTranscript('agent', text);

      // Add to recording if enabled
      if (audioData && this.config.recordingEnabled) {
        this.addAudioToRecording('agent', audioData);
      }

      // Perform sentiment analysis if enabled
      if (this.config.sentimentMonitoring) {
        this.performSentimentAnalysis(text, 'agent');
      }

      console.log('🎵 [VOICE BRIDGE] Audio response sent', {
        agent: this.state.currentAgent,
        textLength: text.length,
        hasAudio: !!audioData
      });

    } catch (error) {
      const responseError = error instanceof Error ? error : new Error('Failed to send audio response');
      voiceTelemetry.trackError(responseError, 'AUDIO_RESPONSE_FAILED', {
        sessionId: this.voiceSession.sessionId,
        agent: this.state.currentAgent
      });
      this.handleError(responseError);
    }
  }

  /**
   * Get current session state
   */
  public getState(): BridgeState {
    return { ...this.state };
  }

  /**
   * Get current transcript
   */
  public getTranscript(): TranscriptEntry[] {
    return [...this.transcript];
  }

  /**
   * Get current recording
   */
  public getRecording(): SessionRecording | null {
    return this.recording ? { ...this.recording } : null;
  }

  // ===== PRIVATE METHODS =====

  private setupVoiceSessionHandlers(): void {
    // Handle transcript from voice session
    this.voiceSession.onTranscript = (transcript: string) => {
      this.handleUserTranscript(transcript);
    };

    // Handle audio responses
    this.voiceSession.onAudioResponse = (audioData: string) => {
      this.handleAudioResponse(audioData);
    };

    // Handle session ready
    this.voiceSession.onSessionReady = (session) => {
      console.log('🔥 [VOICE BRIDGE] Voice session ready', {
        azureSessionId: session.id,
        voice: session.voice
      });
    };

    // Handle errors
    this.voiceSession.onError = (error) => {
      this.handleError(error instanceof Error ? error : new Error('Voice session error'));
    };

    // Handle disconnection
    this.voiceSession.onDisconnect = (code, reason) => {
      console.log('🔌 [VOICE BRIDGE] Voice session disconnected', {
        code, reason
      });
      
      this.emit('session:ended', {
        sessionId: this.voiceSession.sessionId,
        reason: 'connection_lost'
      });
    };
  }

  private async handleUserTranscript(transcript: string): Promise<void> {
    try {
      this.state.lastActivity = Date.now();

      console.log('📝 [VOICE BRIDGE] User transcript received', {
        transcript: transcript.substring(0, 100) + (transcript.length > 100 ? '...' : ''),
        length: transcript.length
      });

      // Add to transcript
      this.addToTranscript('user', transcript);

      // Emit transcript event
      const transcriptEntry: TranscriptEntry = {
        id: `transcript-${Date.now()}`,
        timestamp: Date.now(),
        speaker: 'user',
        text: transcript,
        confidence: 0.95 // Will be real confidence from Azure
      };

      this.emit('transcript:final', {
        sessionId: this.voiceSession.sessionId,
        entry: transcriptEntry
      });

      // Perform sentiment analysis if enabled
      if (this.config.sentimentMonitoring) {
        this.performSentimentAnalysis(transcript, 'user');
      }

      // Route to agent orchestrator if available
      if (this.agentOrchestrator?.handleInput) {
        this.emit('agent:thinking', {
          agent: this.state.currentAgent || 'system',
          isThinking: true
        });

        const response = await this.agentOrchestrator.handleInput(transcript, {
          sessionId: this.voiceSession.sessionId,
          currentAgent: this.state.currentAgent,
          context: this.getConversationContext()
        });

        this.emit('agent:thinking', {
          agent: this.state.currentAgent || 'system',
          isThinking: false
        });

        if (response) {
          await this.sendAudioResponse(response.text, response.audioData);
        }
      }

    } catch (error) {
      const transcriptError = error instanceof Error ? error : new Error('Failed to handle transcript');
      voiceTelemetry.trackError(transcriptError, 'TRANSCRIPT_PROCESSING_FAILED', {
        sessionId: this.voiceSession.sessionId,
        transcriptLength: transcript.length
      });
      this.handleError(transcriptError);
    }
  }

  private handleAudioResponse(audioData: string): void {
    this.state.lastActivity = Date.now();

    this.emit('audio:synthesis:complete', {
      sessionId: this.voiceSession.sessionId,
      audioData
    });

    // Add to recording if enabled
    if (this.config.recordingEnabled) {
      this.addAudioToRecording('agent', audioData);
    }
  }

  private addToTranscript(speaker: 'user' | 'agent', text: string): void {
    const entry: TranscriptEntry = {
      id: `transcript-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      speaker,
      text,
      confidence: speaker === 'user' ? 0.95 : 1.0
    };

    this.transcript.push(entry);

    // Store transcript based on configuration
    if (this.config.transcriptStorage === 'persistent' || this.config.transcriptStorage === 'both') {
      this.persistTranscript(entry);
    }

    console.log(`📝 [VOICE BRIDGE] Added to transcript`, {
      speaker,
      length: text.length,
      totalEntries: this.transcript.length
    });
  }

  private initializeRecording(): void {
    if (!this.config.recordingEnabled) {
      return;
    }

    this.recording = {
      sessionId: this.voiceSession.sessionId,
      startTime: Date.now(),
      totalDuration: 0,
      chunks: [],
      storageLocation: {
        containerName: 'voice-recordings',
        blobName: `session-${this.voiceSession.sessionId}-${Date.now()}.wav`
      },
      processingStatus: 'uploading'
    };

    console.log('🎙️ [VOICE BRIDGE] Recording initialized', {
      sessionId: this.voiceSession.sessionId,
      blobName: this.recording.storageLocation.blobName
    });
  }

  private addAudioToRecording(speaker: 'user' | 'agent', audioData: string): void {
    if (!this.recording || !this.config.recordingEnabled) {
      return;
    }

    try {
      // Decode base64 audio data
      const audioBuffer = this.base64ToArrayBuffer(audioData);
      
      const chunk: AudioChunk = {
        id: `chunk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        sessionId: this.voiceSession.sessionId,
        timestamp: Date.now(),
        duration: 1000, // Will be calculated based on audio data
        format: 'pcm16',
        sampleRate: 16000,
        data: audioBuffer,
        metadata: {
          speaker,
          quality: 'medium',
          noiseLevel: 0.1
        }
      };

      this.recording.chunks.push(chunk);
      this.recording.totalDuration += chunk.duration;

      console.log('🎵 [VOICE BRIDGE] Audio chunk added to recording', {
        speaker,
        chunkId: chunk.id,
        totalChunks: this.recording.chunks.length
      });

    } catch (error) {
      console.error('❌ [VOICE BRIDGE] Failed to add audio to recording:', error);
    }
  }

  private finalizeRecording(): void {
    if (!this.recording) {
      return;
    }

    this.recording.endTime = Date.now();
    this.recording.processingStatus = 'processing';

    // In a real implementation, this would upload to blob storage
    console.log('📦 [VOICE BRIDGE] Recording finalized', {
      sessionId: this.voiceSession.sessionId,
      duration: this.recording.totalDuration,
      chunks: this.recording.chunks.length
    });
  }

  private performSentimentAnalysis(text: string, speaker: 'user' | 'agent'): void {
    // Simple sentiment analysis implementation
    // In production, this would use Azure Cognitive Services
    const stressWords = ['nervous', 'worried', 'difficult', 'hard', 'struggle', 'confused', 'stuck'];
    const positiveWords = ['good', 'great', 'excellent', 'confident', 'sure', 'excited', 'happy'];
    
    const words = text.toLowerCase().split(' ');
    const stressWordCount = words.filter(word => stressWords.includes(word)).length;
    const positiveWordCount = words.filter(word => positiveWords.includes(word)).length;
    
    let score = 0;
    if (positiveWordCount > stressWordCount) {
      score = 0.7;
    } else if (stressWordCount > positiveWordCount) {
      score = -0.5;
    }

    const sentiment: SentimentAnalysis = {
      score,
      magnitude: Math.abs(score),
      label: score > 0.5 ? 'positive' : score < -0.3 ? 'negative' : 'neutral',
      confidence: 0.8,
      stressIndicators: {
        hasHighStressWords: stressWordCount > 0,
        stressWords: words.filter(word => stressWords.includes(word)),
        speechPattern: stressWordCount > 2 ? 'hesitant' : 'normal',
        emotionalState: score > 0.5 ? 'calm' : score < -0.3 ? 'nervous' : 'neutral'
      }
    };

    this.emit('sentiment:analysis', {
      sessionId: this.voiceSession.sessionId,
      sentiment
    });

    if (sentiment.stressIndicators.hasHighStressWords && speaker === 'user') {
      this.emit('sentiment:stress:detected', {
        sessionId: this.voiceSession.sessionId,
        level: stressWordCount > 2 ? 'high' : 'moderate',
        suggestions: [
          'Consider taking a brief pause',
          'Remind the candidate to take their time',
          'Ask if they need clarification'
        ]
      });
    }
  }

  private getAgentVoiceSettings(agentName: string): Partial<any> {
    // Return agent-specific voice settings
    // This would be expanded when agent classes are implemented
    const agentSettings: Record<string, any> = {
      'technical': {
        voice: 'en-US-JennyNeural',
        temperature: 0.7,
        responseStyle: 'detailed'
      },
      'behavioral': {
        voice: 'en-US-AvaMultilingualNeural',
        temperature: 0.8,
        responseStyle: 'empathetic'
      },
      'general': {
        voice: 'en-US-AriaNeural',
        temperature: 0.6,
        responseStyle: 'conversational'
      }
    };

    return agentSettings[agentName] || {};
  }

  private getConversationContext(): any {
    return {
      transcriptLength: this.transcript.length,
      lastMessages: this.transcript.slice(-5),
      sessionDuration: Date.now() - (this.recording?.startTime || Date.now()),
      currentAgent: this.state.currentAgent,
      errorCount: this.state.errorCount
    };
  }

  private persistTranscript(entry: TranscriptEntry): void {
    // In production, this would save to persistent storage
    console.log('💾 [VOICE BRIDGE] Transcript entry persisted', {
      id: entry.id,
      speaker: entry.speaker,
      length: entry.text.length
    });
  }

  private setupActivityTimeout(): void {
    const checkActivity = () => {
      const timeSinceActivity = Date.now() - this.state.lastActivity;
      
      if (timeSinceActivity > this.config.sessionTimeout) {
        console.log('⏰ [VOICE BRIDGE] Session timeout reached');
        this.stop();
        return;
      }

      setTimeout(checkActivity, 60000); // Check every minute
    };

    setTimeout(checkActivity, 60000);
  }

  private handleError(error: Error): void {
    this.state.errorCount++;
    
    console.error('💥 [VOICE BRIDGE] Error occurred', {
      message: error.message,
      errorCount: this.state.errorCount
    });

    this.emit('session:error', {
      sessionId: this.voiceSession.sessionId,
      error
    });

    // Implement recovery based on configuration
    if (this.config.errorRecoveryMode === 'graceful' && this.state.errorCount < this.config.maxRetries) {
      this.attemptRecovery();
    }
  }

  private async attemptRecovery(): Promise<void> {
    if (this.state.recovery.inProgress) {
      return;
    }

    this.state.recovery.inProgress = true;
    this.state.recovery.attempts++;
    this.state.recovery.lastAttempt = Date.now();

    try {
      console.log('🔧 [VOICE BRIDGE] Attempting recovery', {
        attempt: this.state.recovery.attempts,
        maxRetries: this.config.maxRetries
      });

      // Simple recovery: try to reconnect voice session
      if (!this.voiceSession.isConnected()) {
        await this.voiceSession.start();
      }

      this.state.recovery.inProgress = false;
      console.log('✅ [VOICE BRIDGE] Recovery successful');

    } catch (error) {
      this.state.recovery.inProgress = false;
      console.error('❌ [VOICE BRIDGE] Recovery failed:', error);
      
      if (this.state.recovery.attempts >= this.config.maxRetries) {
        console.error('🚨 [VOICE BRIDGE] Max recovery attempts reached, stopping bridge');
        this.stop();
      }
    }
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }
}
