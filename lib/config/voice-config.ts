/**
 * Voice System Configuration
 * Centralized configuration for optimized voice interaction parameters
 */

export interface VoiceConfig {
  speech: {
    recognition: {
      language: string;
      initialSilenceTimeoutMs: number;
      endSilenceTimeoutMs: number;
      segmentationSilenceTimeoutMs: number;
      enableDiarization: boolean;
      enableDetailedResults: boolean;
      recognitionMode: string;
    };
    synthesis: {
      defaultVoice: string;
      alternativeVoices: string[];
      outputFormat: string;
      defaultRate: string;
      defaultPitch: string;
      ssmlEnabled: boolean;
    };
  };
  openai: {
    conversation: {
      temperature: number;
      maxTokens: number;
      topP: number;
      frequencyPenalty: number;
      presencePenalty: number;
      systemPromptTemplate: string;
    };
    interview: {
      defaultMaxQuestions: number;
      responseTimeoutMs: number;
      retryAttempts: number;
    };
  };
  performance: {
    audioChunkSize: number;
    maxAudioDurationMs: number;
    enableAudioCompression: boolean;
    cacheResponses: boolean;
    cacheTtlMs: number;
  };
}

export const OPTIMIZED_VOICE_CONFIG: VoiceConfig = {
  speech: {
    recognition: {
      language: 'en-US',
      initialSilenceTimeoutMs: 5000,
      endSilenceTimeoutMs: 2000,
      segmentationSilenceTimeoutMs: 2000,
      enableDiarization: true,
      enableDetailedResults: true,
      recognitionMode: 'CONVERSATION',
    },
    synthesis: {
      defaultVoice: 'en-US-AriaNeural',
      alternativeVoices: [
        'en-US-SaraNeural',
        'en-US-GuyNeural',
        'en-US-JennyNeural',
        'en-US-DavisNeural',
        'en-US-AmberNeural'
      ],
      outputFormat: 'Audio24Khz48KBitRateMonoMp3',
      defaultRate: '1.0',
      defaultPitch: '0Hz',
      ssmlEnabled: true,
    },
  },
  openai: {
    conversation: {
      temperature: 0.7,
      maxTokens: 200,
      topP: 0.9,
      frequencyPenalty: 0.1,
      presencePenalty: 0.1,
      systemPromptTemplate: 'enhanced_interviewer_v2',
    },
    interview: {
      defaultMaxQuestions: 8,
      responseTimeoutMs: 30000,
      retryAttempts: 3,
    },
  },
  performance: {
    audioChunkSize: 4096,
    maxAudioDurationMs: 300000, // 5 minutes
    enableAudioCompression: true,
    cacheResponses: false, // Disable for dynamic interview content
    cacheTtlMs: 300000, // 5 minutes
  },
};

/**
 * Voice quality presets for different scenarios
 */
export const VOICE_QUALITY_PRESETS = {
  HIGH_QUALITY: {
    outputFormat: 'Audio48Khz192KBitRateMonoMp3',
    rate: '0.9',
    enableSSML: true,
  },
  BALANCED: {
    outputFormat: 'Audio24Khz48KBitRateMonoMp3',
    rate: '1.0',
    enableSSML: true,
  },
  FAST_RESPONSE: {
    outputFormat: 'Audio16Khz32KBitRateMonoMp3',
    rate: '1.1',
    enableSSML: false,
  },
};

/**
 * Interview type specific configurations
 */
export const INTERVIEW_TYPE_CONFIGS = {
  technical: {
    maxQuestions: 10,
    questionComplexityProgression: true,
    enableCodeSnippets: false, // For now, focus on verbal discussion
    followUpProbability: 0.8,
  },
  behavioral: {
    maxQuestions: 8,
    starMethodPrompting: true,
    emotionalIntelligenceAssessment: true,
    followUpProbability: 0.9,
  },
  general: {
    maxQuestions: 6,
    personalityAssessment: true,
    cultureAssessment: true,
    followUpProbability: 0.7,
  },
};

/**
 * Error handling and retry configurations
 */
export const ERROR_HANDLING_CONFIG = {
  maxRetries: 3,
  retryDelayMs: 1000,
  backoffMultiplier: 2,
  speechRecognitionTimeout: 30000,
  speechSynthesisTimeout: 15000,
  openaiTimeout: 30000,
  gracefulDegradation: true,
};

/**
 * Monitoring and analytics configuration
 */
export const MONITORING_CONFIG = {
  logLevel: 'info',
  enablePerformanceMetrics: true,
  enableUsageAnalytics: false, // Respect privacy
  enableErrorTracking: true,
  maxLogRetention: 24 * 60 * 60 * 1000, // 24 hours
};

export default OPTIMIZED_VOICE_CONFIG;
