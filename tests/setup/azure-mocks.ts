/**
 * Azure Service Mocks for Unit Testing
 * 
 * Comprehensive mocking setup for all Azure services used in PrepBettr,
 * providing realistic behavior simulation for reliable unit testing.
 * 
 * @version 2.0.0
 */

import { jest } from '@jest/globals';

// ===== COSMOS DB MOCKS =====

let mockData: any = {};

const mockCosmosClient: any = {
  database: jest.fn().mockReturnValue({
    container: jest.fn().mockReturnValue({
      items: {
        create: (jest.fn() as any).mockResolvedValue({
          resource: { id: 'test-id', ...mockData },
          statusCode: 201
        }),
        upsert: (jest.fn() as any).mockResolvedValue({
          resource: { id: 'test-id', ...mockData },
          statusCode: 200
        }),
        query: jest.fn().mockReturnValue({
          fetchAll: (jest.fn() as any).mockResolvedValue({
            resources: [{ id: 'test-id', ...mockData }]
          }),
          fetchNext: (jest.fn() as any).mockResolvedValue({
            resources: [{ id: 'test-id', ...mockData }],
            hasMoreResults: false
          })
        })
      },
      item: jest.fn().mockReturnValue({
        read: (jest.fn() as any).mockResolvedValue({
          resource: { id: 'test-id', ...mockData },
          statusCode: 200
        }),
        replace: (jest.fn() as any).mockResolvedValue({
          resource: { id: 'test-id', ...mockData },
          statusCode: 200
        }),
        patch: (jest.fn() as any).mockResolvedValue({
          resource: { id: 'test-id', ...mockData },
          statusCode: 200
        }),
        delete: (jest.fn() as any).mockResolvedValue({
          resource: undefined,
          statusCode: 204
        })
      })
    })
  })
};

export const setMockCosmosData = (data: any) => {
  mockData = data;
};

// ===== BLOB STORAGE MOCKS =====

const mockBlobServiceClient = {
  getContainerClient: jest.fn().mockReturnValue({
    createIfNotExists: (jest.fn() as any).mockResolvedValue({ succeeded: true }),
    getBlobClient: jest.fn().mockReturnValue({
      upload: (jest.fn() as any).mockResolvedValue({
        requestId: 'test-request-id',
        etag: 'test-etag'
      }),
      download: (jest.fn() as any).mockResolvedValue({
        readableStreamBody: Buffer.from('test-content'),
        contentLength: 12
      }),
      delete: (jest.fn() as any).mockResolvedValue({
        requestId: 'test-request-id'
      }),
      generateSasUrl: jest.fn().mockReturnValue(
        'https://teststorage.blob.core.windows.net/test-container/test-blob?sas-token'
      )
    }),
    listBlobsFlat: jest.fn().mockReturnValue({
      [Symbol.asyncIterator]: async function* () {
        yield { name: 'test-blob.txt', properties: { lastModified: new Date() } };
      }
    })
  })
};

// ===== AZURE SPEECH SERVICE MOCKS =====

const mockSpeechConfig = {
  fromSubscription: jest.fn().mockReturnValue({
    speechSynthesisVoiceName: 'en-US-JennyNeural',
    speechSynthesisOutputFormat: 'Audio16Khz32KBitRateMonoMp3'
  })
};

const mockSpeechSynthesizer = jest.fn().mockImplementation(() => ({
  speakTextAsync: jest.fn().mockImplementation((text: any, successCallback: any, errorCallback: any) => {
    setTimeout(() => {
      (successCallback as any)({
        reason: 'SynthesizingAudioCompleted',
        audioData: new ArrayBuffer(1024)
      });
    }, 100);
  }),
  close: jest.fn()
}));

const mockSpeechRecognizer = jest.fn().mockImplementation(() => ({
  recognizeOnceAsync: jest.fn().mockImplementation((successCallback: any, errorCallback: any) => {
    setTimeout(() => {
      (successCallback as any)({
        reason: 'RecognizedSpeech',
        text: 'Test recognized text',
        confidence: 0.95
      });
    }, 100);
  }),
  startContinuousRecognitionAsync: jest.fn(),
  stopContinuousRecognitionAsync: jest.fn(),
  close: jest.fn()
}));

// ===== AZURE OPENAI MOCKS =====

const mockOpenAIClient = {
  getChatCompletions: (jest.fn() as any).mockResolvedValue({
    choices: [{
      message: {
        role: 'assistant',
        content: 'Test AI response for interview question'
      },
      finishReason: 'stop'
    }],
    usage: {
      totalTokens: 150,
      promptTokens: 100,
      completionTokens: 50
    }
  }),
  getCompletions: (jest.fn() as any).mockResolvedValue({
    choices: [{
      text: 'Test completion response',
      finishReason: 'stop'
    }],
    usage: {
      totalTokens: 100
    }
  })
};

// ===== SIGNALR MOCKS =====

const mockSignalRService = {
  getClientAccessToken: (jest.fn() as any).mockResolvedValue({
    token: 'test-signalr-token',
    url: 'https://test.service.signalr.net'
  }),
  sendToAll: (jest.fn() as any).mockResolvedValue(undefined),
  sendToGroup: (jest.fn() as any).mockResolvedValue(undefined),
  sendToUser: (jest.fn() as any).mockResolvedValue(undefined),
  addUserToGroup: (jest.fn() as any).mockResolvedValue(undefined),
  removeUserFromGroup: (jest.fn() as any).mockResolvedValue(undefined)
};

// ===== AZURE KEY VAULT MOCKS =====

const mockSecretClient = {
  getSecret: jest.fn().mockImplementation((secretName: any) => {
    const secrets: any = {
      'firebase-service-account-key': JSON.stringify({
        type: 'service_account',
        project_id: 'test-project',
        private_key: '-----BEGIN PRIVATE KEY-----\ntest-key\n-----END PRIVATE KEY-----',
        client_email: 'test@test-project.iam.gserviceaccount.com'
      }),
      'speech-key': 'test-speech-key',
      'azure-openai-key': 'test-openai-key',
      'azure-openai-endpoint': 'https://test.openai.azure.com'
    };
    
    return Promise.resolve({
      name: secretName,
      value: secrets[secretName] || 'test-secret-value',
      properties: {
        version: 'test-version'
      }
    });
  }),
  setSecret: (jest.fn() as any).mockResolvedValue({
    name: 'test-secret',
    properties: { version: 'new-version' }
  }),
  listPropertiesOfSecrets: jest.fn().mockReturnValue({
    [Symbol.asyncIterator]: async function* () {
      yield { name: 'test-secret', enabled: true };
    }
  })
};

// ===== APPLICATION INSIGHTS MOCKS =====

const mockTelemetryClient = {
  trackEvent: jest.fn(),
  trackException: jest.fn(),
  trackMetric: jest.fn(),
  trackTrace: jest.fn(),
  trackDependency: jest.fn(),
  trackRequest: jest.fn(),
  flush: jest.fn().mockImplementation((callback: any) => {
    if (callback) callback();
  })
};

// ===== FIREBASE AUTH MOCKS =====

const mockFirebaseAdmin = {
  apps: [],
  initializeApp: jest.fn().mockReturnValue({
    name: 'test-app'
  }),
  credential: {
    cert: jest.fn()
  },
  auth: jest.fn().mockReturnValue({
    verifyIdToken: (jest.fn() as any).mockResolvedValue({
      uid: 'test-uid',
      email: 'test@example.com',
      email_verified: true,
      exp: Math.floor(Date.now() / 1000) + 3600
    }),
    createSessionCookie: (jest.fn() as any).mockResolvedValue('test-session-cookie'),
    verifySessionCookie: (jest.fn() as any).mockResolvedValue({
      uid: 'test-uid',
      email: 'test@example.com'
    }),
    getUser: (jest.fn() as any).mockResolvedValue({
      uid: 'test-uid',
      email: 'test@example.com',
      customClaims: { role: 'user' }
    }),
    setCustomUserClaims: (jest.fn() as any).mockResolvedValue(undefined),
    deleteUser: (jest.fn() as any).mockResolvedValue(undefined)
  }),
  firestore: jest.fn().mockReturnValue({
    collection: jest.fn().mockReturnValue({
      doc: jest.fn().mockReturnValue({
        set: (jest.fn() as any).mockResolvedValue(undefined),
        get: (jest.fn() as any).mockResolvedValue({
          exists: true,
          data: () => ({ test: 'data' })
        }),
        delete: (jest.fn() as any).mockResolvedValue(undefined)
      })
    })
  })
};

// ===== MOCK SETUP FUNCTIONS =====

/**
 * Set up all Azure service mocks
 */
export function setupAzureMocks() {
  // Cosmos DB
  jest.mock('@azure/cosmos', () => ({
    CosmosClient: jest.fn().mockImplementation(() => mockCosmosClient)
  }));

  // Blob Storage
  jest.mock('@azure/storage-blob', () => ({
    BlobServiceClient: {
      fromConnectionString: jest.fn().mockReturnValue(mockBlobServiceClient)
    }
  }));

  // Azure Speech SDK
  jest.mock('microsoft-cognitiveservices-speech-sdk', () => ({
    SpeechConfig: mockSpeechConfig,
    SpeechSynthesizer: mockSpeechSynthesizer,
    SpeechRecognizer: mockSpeechRecognizer,
    ResultReason: {
      SynthesizingAudioCompleted: 'SynthesizingAudioCompleted',
      RecognizedSpeech: 'RecognizedSpeech'
    },
    SpeechSynthesisOutputFormat: {
      Audio16Khz32KBitRateMonoMp3: 'Audio16Khz32KBitRateMonoMp3'
    }
  }));

  // Azure OpenAI
  jest.mock('@azure/openai', () => ({
    OpenAIApi: jest.fn().mockImplementation(() => mockOpenAIClient)
  }));

  // SignalR
  jest.mock('@azure/web-pubsub', () => ({
    WebPubSubServiceClient: jest.fn().mockImplementation(() => mockSignalRService)
  }));

  // Key Vault
  jest.mock('@azure/keyvault-secrets', () => ({
    SecretClient: jest.fn().mockImplementation(() => mockSecretClient)
  }));

  // Azure Identity
  jest.mock('@azure/identity', () => ({
    DefaultAzureCredential: jest.fn()
  }));

  // Application Insights
  jest.mock('applicationinsights', () => ({
    TelemetryClient: jest.fn().mockImplementation(() => mockTelemetryClient),
    setup: jest.fn().mockReturnValue({
      setAutoDependencyCorrelation: jest.fn().mockReturnThis(),
      setAutoCollectRequests: jest.fn().mockReturnThis(),
      setAutoCollectPerformance: jest.fn().mockReturnThis(),
      setAutoCollectExceptions: jest.fn().mockReturnThis(),
      setAutoCollectDependencies: jest.fn().mockReturnThis(),
      setUseDiskRetryCaching: jest.fn().mockReturnThis(),
      start: jest.fn()
    })
  }));

  // Firebase Admin
  jest.mock('firebase-admin', () => mockFirebaseAdmin);
}

/**
 * Reset all mocks to clean state
 */
export function resetAzureMocks() {
  Object.values(mockCosmosClient.database().container().items).forEach((mock: any) => {
    if (typeof mock === 'function' && mock.mockClear) {
      mock.mockClear();
    }
  });

  Object.values((mockBlobServiceClient.getContainerClient() as any).getBlobClient()).forEach((mock: any) => {
    if (typeof mock === 'function' && mock.mockClear) {
      mock.mockClear();
    }
  });

  Object.values(mockTelemetryClient).forEach((mock: any) => {
    if (typeof mock === 'function' && mock.mockClear) {
      mock.mockClear();
    }
  });

  mockData = {};
}

/**
 * Create mock response helpers
 */
export const MockHelpers = {
  cosmosResponse: (data: any, statusCode = 200) => ({
    resource: data,
    statusCode,
    requestCharge: 2.5,
    activityId: 'test-activity-id'
  }),

  blobResponse: (content: string) => ({
    readableStreamBody: Buffer.from(content),
    contentLength: content.length,
    contentType: 'text/plain',
    etag: 'test-etag'
  }),

  speechResponse: (text: string, confidence = 0.95) => ({
    reason: 'RecognizedSpeech',
    text,
    confidence,
    duration: 1000
  }),

  openaiResponse: (content: string, tokens = 100) => ({
    choices: [{
      message: { role: 'assistant', content },
      finishReason: 'stop'
    }],
    usage: { totalTokens: tokens }
  })
};

// ===== PERFORMANCE TESTING UTILITIES =====

export const PerformanceMocks = {
  simulateLatency: (ms: number) => {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  mockSlowResponse: (originalMock: any, latency: number) => {
    return jest.fn().mockImplementation(async (...args) => {
      await PerformanceMocks.simulateLatency(latency);
      return originalMock(...args);
    });
  },

  trackCallTimes: () => {
    const callTimes: number[] = [];
    return {
      mock: jest.fn().mockImplementation(async (...args) => {
        const start = Date.now();
        // Simulate some processing
        await PerformanceMocks.simulateLatency(10);
        const end = Date.now();
        callTimes.push(end - start);
      }),
      getCallTimes: () => callTimes,
      getAverageTime: () => callTimes.reduce((a, b) => a + b, 0) / callTimes.length
    };
  }
};

// Set up mocks immediately when this module is imported
setupAzureMocks();

export {
  mockCosmosClient,
  mockBlobServiceClient,
  mockOpenAIClient,
  mockSignalRService,
  mockSecretClient,
  mockTelemetryClient,
  mockFirebaseAdmin
};
