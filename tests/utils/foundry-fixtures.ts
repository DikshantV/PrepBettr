/**
 * Azure AI Foundry Test Fixtures
 * 
 * Comprehensive test data and utility factories for Azure AI Foundry testing.
 * Provides realistic mock data, sample files, and fixture generators.
 * 
 * @version 2.0.0
 */

import { ConfigOptions, FoundryVoiceSession, FoundryVoiceError } from '@/lib/azure-ai-foundry/voice/types';
import { ModelConfig, FoundryConfig } from '@/lib/azure-ai-foundry/config/foundry-config';
import { ModelUsageEntry, ModelPerformanceMetrics } from '@/lib/azure-ai-foundry/managers/model-manager';
import type { TokenUsage, CompletionResponse, ChatCompletionResponse } from '@/lib/azure-ai-foundry/types/foundry-types';

/**
 * Sample resume data for testing document processing
 */
export const SAMPLE_RESUMES = {
  SENIOR_DEVELOPER: {
    fileName: 'john_doe_senior_dev.pdf',
    content: {
      personalInfo: {
        name: 'John Doe',
        email: 'john.doe@email.com',
        phone: '+1 (555) 123-4567',
        location: 'San Francisco, CA',
        linkedIn: 'linkedin.com/in/johndoe',
        github: 'github.com/johndoe'
      },
      summary: 'Senior Full Stack Developer with 8+ years of experience in modern web technologies, cloud architecture, and team leadership.',
      experience: [
        {
          company: 'TechCorp Inc.',
          position: 'Senior Software Engineer',
          duration: '2020 - Present',
          responsibilities: [
            'Led development of microservices architecture serving 1M+ users',
            'Mentored junior developers and conducted code reviews',
            'Implemented CI/CD pipelines reducing deployment time by 60%',
            'Designed and built RESTful APIs with Node.js and TypeScript'
          ]
        },
        {
          company: 'StartupXYZ',
          position: 'Full Stack Developer',
          duration: '2018 - 2020',
          responsibilities: [
            'Built responsive web applications using React and Redux',
            'Developed backend services with Python and PostgreSQL',
            'Integrated third-party APIs and payment systems'
          ]
        }
      ],
      skills: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'PostgreSQL', 'AWS', 'Docker', 'Kubernetes'],
      education: [
        {
          degree: 'Bachelor of Science in Computer Science',
          institution: 'Stanford University',
          year: '2016'
        }
      ]
    }
  },
  
  ENTRY_LEVEL: {
    fileName: 'jane_smith_junior.pdf',
    content: {
      personalInfo: {
        name: 'Jane Smith',
        email: 'jane.smith@email.com',
        phone: '+1 (555) 987-6543',
        location: 'Austin, TX'
      },
      summary: 'Recent Computer Science graduate passionate about web development and eager to contribute to innovative projects.',
      experience: [
        {
          company: 'University Tech Lab',
          position: 'Research Assistant',
          duration: '2023 - 2024',
          responsibilities: [
            'Assisted in machine learning research projects',
            'Developed web interfaces for data visualization',
            'Collaborated with PhD students on algorithm implementation'
          ]
        }
      ],
      skills: ['JavaScript', 'Python', 'React', 'HTML/CSS', 'Git', 'MySQL'],
      education: [
        {
          degree: 'Bachelor of Science in Computer Science',
          institution: 'University of Texas at Austin',
          year: '2024',
          gpa: '3.8'
        }
      ],
      projects: [
        {
          name: 'E-commerce Web App',
          description: 'Built a full-stack e-commerce platform using React and Express.js',
          technologies: ['React', 'Node.js', 'MongoDB', 'Stripe API']
        }
      ]
    }
  },

  MALFORMED: {
    fileName: 'corrupted_resume.pdf',
    content: {
      personalInfo: {
        name: 'Test User'
        // Missing required fields for testing error handling
      },
      // Incomplete structure for testing robustness
    }
  }
};

/**
 * Sample interview scenarios for testing agent behavior
 */
export const INTERVIEW_SCENARIOS = {
  TECHNICAL_BACKEND: {
    id: 'tech-backend-001',
    jobRole: 'Senior Backend Engineer',
    companyName: 'TechCorp',
    candidateName: 'John',
    expectedQuestions: [
      'Tell me about your experience with microservices architecture.',
      'How would you design a system to handle 1 million concurrent users?',
      'What are your thoughts on database sharding strategies?',
      'Describe a challenging technical problem you solved recently.'
    ],
    techStack: ['Node.js', 'PostgreSQL', 'Redis', 'Kubernetes'],
    difficulty: 'senior',
    duration: 45
  },
  
  BEHAVIORAL: {
    id: 'behavioral-001',
    jobRole: 'Software Engineering Manager',
    companyName: 'InnovateLab',
    candidateName: 'Sarah',
    expectedQuestions: [
      'Describe a time when you had to deliver difficult feedback to a team member.',
      'How do you handle conflicting priorities and tight deadlines?',
      'Tell me about a project where you had to influence stakeholders without direct authority.',
      'How do you foster innovation within your team?'
    ],
    focusAreas: ['leadership', 'communication', 'conflict-resolution'],
    difficulty: 'senior',
    duration: 30
  },
  
  ENTRY_LEVEL_FRONTEND: {
    id: 'entry-frontend-001',
    jobRole: 'Junior Frontend Developer',
    companyName: 'WebStudio',
    candidateName: 'Alex',
    expectedQuestions: [
      'What interests you most about frontend development?',
      'How do you ensure your web applications are accessible?',
      'Describe your approach to responsive web design.',
      'What frontend frameworks or libraries have you worked with?'
    ],
    techStack: ['React', 'TypeScript', 'CSS3', 'Webpack'],
    difficulty: 'junior',
    duration: 30
  }
};

/**
 * Mock Azure AI Foundry voice session responses
 */
export const MOCK_VOICE_RESPONSES = {
  SESSION_CREATED: {
    type: 'session.created',
    session: {
      id: 'sess_mock_12345',
      object: 'realtime.session',
      model: 'gpt-4o-realtime-preview-2024-10-01',
      modalities: ['text', 'audio'],
      instructions: 'You are conducting a technical interview. Be professional and engaging.',
      voice: 'en-US-AvaMultilingualNeural',
      input_audio_format: 'pcm16',
      output_audio_format: 'pcm16',
      input_audio_transcription: { model: 'whisper-1' },
      turn_detection: {
        type: 'server_vad',
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 500
      },
      tools: [],
      tool_choice: 'auto',
      temperature: 0.8,
      max_response_output_tokens: 4096
    }
  },

  TRANSCRIPT_COMPLETED: {
    type: 'conversation.item.input_audio_transcription.completed',
    item_id: 'item_audio_001',
    content_index: 0,
    transcript: 'Hello, I am ready to start the interview. My name is John and I have 8 years of backend development experience.'
  },

  RESPONSE_AUDIO_DELTA: {
    type: 'response.audio.delta',
    response_id: 'resp_001',
    item_id: 'item_resp_001',
    output_index: 0,
    content_index: 0,
    delta: 'UklGRiQAAABXQVZFZm10IBAAAAABAAECA...' // Base64 encoded PCM16 audio
  },

  RESPONSE_TEXT_DELTA: {
    type: 'response.text.delta',
    response_id: 'resp_002',
    item_id: 'item_resp_002',
    output_index: 0,
    content_index: 0,
    delta: 'Thank you for joining us today, John. '
  },

  ERROR_INVALID_AUDIO: {
    type: 'error',
    error: {
      type: 'invalid_request_error',
      code: 'invalid_audio_format',
      message: 'The provided audio format is not supported. Please use PCM16 format.',
      param: 'audio',
      event_id: 'event_error_001'
    }
  },

  ERROR_RATE_LIMITED: {
    type: 'error',
    error: {
      type: 'rate_limit_error',
      code: 'rate_limit_exceeded',
      message: 'Rate limit exceeded. Please retry after 60 seconds.',
      event_id: 'event_error_002'
    }
  }
};

/**
 * Mock model configurations for testing
 */
export const MOCK_MODEL_CONFIGS: Record<string, ModelConfig> = {
  'test-gpt-4o': {
    deploymentName: 'test-gpt-4o-deployment',
    modelName: 'gpt-4o',
    version: '2024-05-13',
    maxTokens: 4096,
    temperature: 0.7,
    topP: 0.9,
    frequencyPenalty: 0,
    presencePenalty: 0,
    costPerToken: 0.005,
    capabilities: ['text-generation', 'reasoning', 'coding', 'analysis'],
    isDefault: true
  },
  'test-phi-4': {
    deploymentName: 'test-phi-4-deployment',
    modelName: 'phi-4',
    version: '2024-12-12',
    maxTokens: 2048,
    temperature: 0.6,
    topP: 0.85,
    frequencyPenalty: 0.1,
    presencePenalty: 0.1,
    costPerToken: 0.001,
    capabilities: ['text-generation', 'reasoning', 'lightweight-tasks']
  }
};

/**
 * Mock Foundry configuration for testing
 */
export const MOCK_FOUNDRY_CONFIG: FoundryConfig = {
  endpoint: 'https://test-foundry.cognitiveservices.azure.com',
  apiKey: 'test-api-key-12345',
  projectId: 'test-interview-agents',
  resourceId: 'test-resource-id',
  resourceGroup: 'TestGroup',
  region: 'eastus',
  environment: 'development',
  models: MOCK_MODEL_CONFIGS,
  connection: {
    timeout: 30000,
    keepAlive: true,
    maxConnections: 5,
    retryPolicy: {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      exponentialBase: 2,
      jitter: true
    }
  }
};

/**
 * Factory for creating mock voice session configurations
 */
export function createMockVoiceConfig(overrides: Partial<ConfigOptions> = {}): ConfigOptions {
  return {
    endpoint: 'wss://test-region.api.cognitive.microsoft.com/cognitiveservices/websocket/v1',
    apiKey: 'test-voice-api-key',
    deploymentId: 'test-deployment',
    temperature: 0.7,
    maxTokens: 150,
    voice: 'en-US-AvaMultilingualNeural',
    inputFormat: 'simple',
    outputFormat: 'simple',
    instructionMessage: 'You are conducting a professional technical interview.',
    turnDetection: {
      type: 'server_vad',
      threshold: 0.5,
      prefix_padding_ms: 300,
      silence_duration_ms: 500
    },
    ...overrides
  };
}

/**
 * Factory for creating mock usage entries
 */
export function createMockUsageEntry(overrides: Partial<ModelUsageEntry> = {}): ModelUsageEntry {
  return {
    modelName: 'test-gpt-4o',
    timestamp: new Date().toISOString(),
    promptTokens: 100,
    completionTokens: 50,
    totalTokens: 150,
    cost: 0.75, // $0.75 for 150 tokens at $5/1K
    latency: 1200,
    success: true,
    ...overrides
  };
}

/**
 * Factory for creating mock token usage
 */
export function createMockTokenUsage(overrides: Partial<TokenUsage> = {}): TokenUsage {
  return {
    prompt_tokens: 100,
    completion_tokens: 50,
    total_tokens: 150,
    ...overrides
  };
}

/**
 * Factory for creating mock completion responses
 */
export function createMockCompletionResponse(overrides: Partial<CompletionResponse> = {}): CompletionResponse {
  return {
    id: `completion-${Date.now()}`,
    object: 'text_completion',
    created: Math.floor(Date.now() / 1000),
    model: 'test-gpt-4o',
    choices: [
      {
        text: 'This is a test completion response.',
        index: 0,
        logprobs: null,
        finish_reason: 'stop'
      }
    ],
    usage: createMockTokenUsage(),
    ...overrides
  };
}

/**
 * Factory for creating mock chat completion responses
 */
export function createMockChatCompletionResponse(overrides: Partial<ChatCompletionResponse> = {}): ChatCompletionResponse {
  return {
    id: `chatcmpl-${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: 'test-gpt-4o',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: 'Thank you for joining the interview today. Let\'s start by discussing your background.'
        },
        finish_reason: 'stop'
      }
    ],
    usage: createMockTokenUsage(),
    ...overrides
  };
}

/**
 * Factory for creating mock voice session objects
 */
export function createMockVoiceSession(overrides: Partial<FoundryVoiceSession> = {}): FoundryVoiceSession {
  return {
    id: `sess_mock_${Date.now()}`,
    object: 'realtime.session',
    model: 'gpt-4o-realtime-preview-2024-10-01',
    modalities: ['text', 'audio'],
    instructions: 'You are conducting a professional interview.',
    voice: 'en-US-AvaMultilingualNeural',
    input_audio_format: 'pcm16',
    output_audio_format: 'pcm16',
    input_audio_transcription: { model: 'whisper-1' },
    turn_detection: {
      type: 'server_vad',
      threshold: 0.5,
      prefix_padding_ms: 300,
      silence_duration_ms: 500
    },
    tools: [],
    tool_choice: 'auto',
    temperature: 0.8,
    max_response_output_tokens: 4096,
    ...overrides
  };
}

/**
 * Factory for creating mock voice errors
 */
export function createMockVoiceError(overrides: Partial<FoundryVoiceError> = {}): FoundryVoiceError {
  return {
    type: 'invalid_request_error',
    code: 'invalid_audio_format',
    message: 'Test error message',
    param: 'audio',
    event_id: `error_${Date.now()}`,
    ...overrides
  };
}

/**
 * Audio data generators for testing
 */
export const AUDIO_TEST_DATA = {
  // Generate silence audio data (PCM16, 16kHz, mono)
  generateSilence(durationMs: number): ArrayBuffer {
    const sampleRate = 16000;
    const samples = Math.floor((durationMs / 1000) * sampleRate);
    const buffer = new ArrayBuffer(samples * 2); // 16-bit = 2 bytes per sample
    return buffer;
  },

  // Generate sine wave audio data (for testing audio processing)
  generateSineWave(durationMs: number, frequency: number = 440): ArrayBuffer {
    const sampleRate = 16000;
    const samples = Math.floor((durationMs / 1000) * sampleRate);
    const buffer = new ArrayBuffer(samples * 2);
    const view = new Int16Array(buffer);
    
    for (let i = 0; i < samples; i++) {
      const amplitude = Math.floor(32767 * 0.5); // 50% amplitude
      const sample = Math.sin(2 * Math.PI * frequency * i / sampleRate) * amplitude;
      view[i] = Math.floor(sample);
    }
    
    return buffer;
  },

  // Generate typical voice sample sizes
  SMALL_CHUNK: new ArrayBuffer(512),   // 32ms at 16kHz
  MEDIUM_CHUNK: new ArrayBuffer(1024), // 64ms at 16kHz  
  LARGE_CHUNK: new ArrayBuffer(4096),  // 256ms at 16kHz
};

/**
 * Performance benchmarks for testing
 */
export const PERFORMANCE_THRESHOLDS = {
  VOICE_SESSION: {
    CONNECTION_TIMEOUT: 5000,     // 5 seconds
    FIRST_RESPONSE_TIME: 2000,    // 2 seconds
    AUDIO_PROCESSING_TIME: 500,   // 500ms
    TRANSCRIPT_DELAY: 1000,       // 1 second
  },
  
  MODEL_MANAGER: {
    CONFIG_LOAD_TIME: 1000,       // 1 second
    MODEL_SELECTION_TIME: 100,    // 100ms
    HEALTH_CHECK_TIME: 3000,      // 3 seconds
  },
  
  DOCUMENT_PROCESSING: {
    RESUME_PARSE_TIME: 5000,      // 5 seconds per resume
    QUESTION_GENERATION_TIME: 3000, // 3 seconds
    FIELD_EXTRACTION_TIME: 2000,  // 2 seconds
  }
};

/**
 * Error scenarios for testing robustness
 */
export const ERROR_SCENARIOS = {
  NETWORK_ERRORS: [
    { code: 'ECONNRESET', message: 'Connection reset by peer' },
    { code: 'ECONNREFUSED', message: 'Connection refused' },
    { code: 'ETIMEDOUT', message: 'Connection timed out' }
  ],
  
  API_ERRORS: [
    { status: 400, message: 'Bad Request' },
    { status: 401, message: 'Unauthorized' },
    { status: 403, message: 'Forbidden' },
    { status: 404, message: 'Not Found' },
    { status: 429, message: 'Rate Limited' },
    { status: 500, message: 'Internal Server Error' },
    { status: 503, message: 'Service Unavailable' }
  ],
  
  VOICE_ERRORS: [
    createMockVoiceError({ type: 'invalid_request_error', code: 'invalid_audio_format' }),
    createMockVoiceError({ type: 'rate_limit_error', code: 'rate_limit_exceeded' }),
    createMockVoiceError({ type: 'server_error', code: 'internal_error' })
  ]
};

/**
 * Test data validation helpers
 */
export const VALIDATORS = {
  isValidVoiceSession(session: any): session is FoundryVoiceSession {
    return session && 
           typeof session.id === 'string' &&
           typeof session.model === 'string' &&
           Array.isArray(session.modalities) &&
           typeof session.voice === 'string';
  },
  
  isValidUsageEntry(entry: any): entry is ModelUsageEntry {
    return entry &&
           typeof entry.modelName === 'string' &&
           typeof entry.timestamp === 'string' &&
           typeof entry.totalTokens === 'number' &&
           typeof entry.cost === 'number' &&
           typeof entry.success === 'boolean';
  },
  
  isValidModelConfig(config: any): config is ModelConfig {
    return config &&
           typeof config.deploymentName === 'string' &&
           typeof config.modelName === 'string' &&
           typeof config.maxTokens === 'number' &&
           Array.isArray(config.capabilities);
  }
};

/**
 * Test environment setup helpers
 */
export const TEST_ENV_SETUP = {
  setupMockEnvironment(): void {
    // Set test environment variables
    process.env.NODE_ENV = 'test';
    process.env.AZURE_FOUNDRY_ENDPOINT = MOCK_FOUNDRY_CONFIG.endpoint;
    process.env.AZURE_FOUNDRY_API_KEY = MOCK_FOUNDRY_CONFIG.apiKey;
    process.env.AZURE_FOUNDRY_PROJECT_ID = MOCK_FOUNDRY_CONFIG.projectId;
  },

  cleanupMockEnvironment(): void {
    // Clean up test environment variables
    delete process.env.AZURE_FOUNDRY_ENDPOINT;
    delete process.env.AZURE_FOUNDRY_API_KEY;
    delete process.env.AZURE_FOUNDRY_PROJECT_ID;
  }
};

export default {
  SAMPLE_RESUMES,
  INTERVIEW_SCENARIOS,
  MOCK_VOICE_RESPONSES,
  MOCK_MODEL_CONFIGS,
  MOCK_FOUNDRY_CONFIG,
  AUDIO_TEST_DATA,
  PERFORMANCE_THRESHOLDS,
  ERROR_SCENARIOS,
  VALIDATORS,
  TEST_ENV_SETUP,
  createMockVoiceConfig,
  createMockUsageEntry,
  createMockTokenUsage,
  createMockCompletionResponse,
  createMockChatCompletionResponse,
  createMockVoiceSession,
  createMockVoiceError
};
