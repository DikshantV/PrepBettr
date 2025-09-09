/**
 * Azure AI Foundry Voice Integration Types
 * Comprehensive type definitions for voice-enabled interview system
 */

// ===== VOICE CONFIGURATION TYPES =====

export interface VoiceSettings {
  // Speech-to-Text Configuration
  inputAudioFormat: 'pcm16' | 'pcm24' | 'opus';
  inputSampleRate: number;
  language: string;
  
  // Text-to-Speech Configuration  
  outputAudioFormat: 'pcm16' | 'pcm24' | 'opus';
  outputSampleRate: number;
  voice: string;
  
  // Conversation Parameters
  temperature: number;
  maxTokens: number;
  systemMessage: string;
  
  // Voice Activity Detection
  turnDetection: {
    type: 'server_vad' | 'none';
    threshold?: number;
    prefix_padding_ms?: number;
    silence_duration_ms?: number;
  };
  
  // Agent-specific Settings
  personality?: 'professional' | 'friendly' | 'technical' | 'empathetic';
  speakingPace?: 'slow' | 'normal' | 'fast';
  responseStyle?: 'concise' | 'detailed' | 'conversational';
}

export interface ConfigOptions extends VoiceSettings {
  // Connection Settings
  endpoint: string;
  apiKey: string;
  deploymentId: string;
  
  // Format Settings (legacy compatibility)
  inputFormat: string;
  outputFormat: string;
  instructionMessage: string;
}

// ===== AGENT-SPECIFIC VOICE SETTINGS =====

export interface AgentVoiceConfig {
  agentType: 'technical' | 'behavioral' | 'industry' | 'general';
  defaultVoiceSettings: Partial<VoiceSettings>;
  voicePersonality: {
    systemPromptAddition: string;
    responseCharacteristics: string[];
  };
  interactionStyle: {
    questionPacing: number; // seconds between questions
    followUpStyle: 'immediate' | 'delayed' | 'contextual';
    errorRecovery: 'restart' | 'clarify' | 'skip';
  };
}

// ===== REAL-TIME TRANSCRIPT TYPES =====

export interface TranscriptEntry {
  id: string;
  timestamp: number;
  speaker: 'user' | 'agent';
  text: string;
  confidence?: number;
  isPartial?: boolean;
  wordTimings?: {
    word: string;
    startTime: number;
    endTime: number;
    confidence: number;
  }[];
}

export interface TranscriptSession {
  sessionId: string;
  startTime: number;
  endTime?: number;
  entries: TranscriptEntry[];
  metadata: {
    totalDuration: number;
    wordCount: number;
    averageConfidence: number;
    language: string;
  };
}

// ===== SENTIMENT DETECTION TYPES =====

export interface SentimentAnalysis {
  score: number; // -1 to 1 (negative to positive)
  magnitude: number; // 0 to 1 (intensity)
  label: 'very_negative' | 'negative' | 'neutral' | 'positive' | 'very_positive';
  confidence: number;
  stressIndicators: {
    hasHighStressWords: boolean;
    stressWords: string[];
    speechPattern: 'normal' | 'rushed' | 'hesitant' | 'unclear';
    emotionalState: 'calm' | 'nervous' | 'excited' | 'frustrated';
  };
}

export interface SentimentTrend {
  sessionId: string;
  timeline: {
    timestamp: number;
    sentiment: SentimentAnalysis;
    transcriptId: string;
  }[];
  summary: {
    averageSentiment: number;
    trendDirection: 'improving' | 'declining' | 'stable';
    stressEvents: number;
    recommendedInterventions: string[];
  };
}

// ===== RECORDING AND STORAGE TYPES =====

export interface AudioChunk {
  id: string;
  sessionId: string;
  timestamp: number;
  duration: number; // in milliseconds
  format: string;
  sampleRate: number;
  data: ArrayBuffer;
  metadata: {
    speaker: 'user' | 'agent';
    quality: 'low' | 'medium' | 'high';
    noiseLevel: number;
  };
}

export interface SessionRecording {
  sessionId: string;
  startTime: number;
  endTime?: number;
  totalDuration: number;
  chunks: AudioChunk[];
  storageLocation: {
    containerName: string;
    blobName: string;
    url?: string;
  };
  processingStatus: 'uploading' | 'processing' | 'completed' | 'failed';
  transcriptId?: string;
}

// ===== VOICE SESSION STATE TYPES =====

export interface VoiceSessionState {
  sessionId: string;
  status: 'initializing' | 'connected' | 'active' | 'paused' | 'ended' | 'error';
  currentAgent: string;
  activeTranscript: TranscriptSession;
  sentimentAnalysis: SentimentTrend;
  recording?: SessionRecording;
  
  // Real-time Metrics
  metrics: {
    connectionLatency: number;
    audioLatency: number;
    transcriptionAccuracy: number;
    responseTime: number;
    totalSpeakingTime: number;
    silenceDuration: number;
  };
  
  // Error Tracking
  errors: {
    timestamp: number;
    type: 'connection' | 'audio' | 'transcription' | 'synthesis';
    message: string;
    recovered: boolean;
  }[];
}

// ===== EVENT TYPES FOR VOICE BRIDGE =====

export interface VoiceEventTypes {
  // Session Events
  'session:started': { sessionId: string; agent: string };
  'session:ended': { sessionId: string; reason: string };
  'session:error': { sessionId: string; error: Error };
  
  // Transcription Events
  'transcript:partial': { sessionId: string; text: string; confidence: number };
  'transcript:final': { sessionId: string; entry: TranscriptEntry };
  'transcript:error': { sessionId: string; error: string };
  
  // Audio Events
  'audio:received': { sessionId: string; chunk: AudioChunk };
  'audio:synthesis:start': { sessionId: string; text: string };
  'audio:synthesis:complete': { sessionId: string; audioData: string };
  'audio:playback:start': { sessionId: string };
  'audio:playback:end': { sessionId: string };
  
  // Agent Events
  'agent:handoff': { from: string; to: string; context: any };
  'agent:response': { agent: string; text: string; audioData?: string };
  'agent:thinking': { agent: string; isThinking: boolean };
  
  // Sentiment Events
  'sentiment:analysis': { sessionId: string; sentiment: SentimentAnalysis };
  'sentiment:stress:detected': { sessionId: string; level: 'moderate' | 'high'; suggestions: string[] };
}

// ===== UTILITY TYPES =====

export type VoiceEventHandler<T extends keyof VoiceEventTypes> = (event: VoiceEventTypes[T]) => void;

export interface VoiceCapabilities {
  supportedLanguages: string[];
  supportedVoices: string[];
  supportedFormats: {
    input: string[];
    output: string[];
  };
  features: {
    realTimeTranscription: boolean;
    sentimentAnalysis: boolean;
    voiceActivityDetection: boolean;
    noiseReduction: boolean;
    multipleAgents: boolean;
  };
}

// ===== AZURE AI FOUNDRY SPECIFIC TYPES =====

export interface FoundryVoiceSession {
  id: string;
  status: 'active' | 'inactive' | 'terminated';
  model: string;
  modalities: ('text' | 'audio')[];
  instructions: string;
  voice: string;
  inputAudioFormat: string;
  outputAudioFormat: string;
  turnDetection: VoiceSettings['turnDetection'];
  temperature: number;
  maxResponseOutputTokens: number | null;
}

export interface FoundryVoiceMessage {
  type: string;
  [key: string]: any;
}

export interface FoundryVoiceError {
  type: string;
  code: string;
  message: string;
  param?: string;
  eventId?: string;
}

// ===== AGENT BRIDGE TYPES =====

export interface AgentBridgeConfig {
  sessionTimeout: number;
  maxRetries: number;
  errorRecoveryMode: 'graceful' | 'immediate' | 'manual';
  sentimentMonitoring: boolean;
  recordingEnabled: boolean;
  transcriptStorage: 'memory' | 'persistent' | 'both';
}

export interface BridgeState {
  currentAgent: string | null;
  sessionActive: boolean;
  lastActivity: number;
  pendingHandoff: boolean;
  errorCount: number;
  recovery: {
    inProgress: boolean;
    attempts: number;
    lastAttempt: number;
  };
}
