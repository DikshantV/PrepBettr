/**
 * MSW Request Handlers for Azure AI Foundry Tests
 * 
 * Mocks REST API endpoints for Foundry services during testing
 */

import { http, HttpResponse } from 'msw';

// Mock API responses
const mockResponses = {
  healthCheck: { status: 'healthy', timestamp: Date.now() },
  chatCompletion: {
    choices: [{
      message: {
        role: 'assistant',
        content: 'This is a mock response from Azure AI Foundry'
      }
    }],
    usage: {
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150
    }
  },
  modelList: {
    models: [
      {
        id: 'gpt-4o',
        name: 'GPT-4 Omni',
        capabilities: ['text-generation', 'coding'],
        costPerToken: 0.005
      },
      {
        id: 'phi-4',
        name: 'Phi-4',
        capabilities: ['text-generation'],
        costPerToken: 0.001
      }
    ]
  },
  voiceSession: {
    sessionId: 'test-session-123',
    status: 'created',
    websocketUrl: 'ws://localhost:1234'
  }
};

export const handlers = [
  // Health check endpoint - root endpoint for validateConnection
  http.get('https://test-foundry.cognitiveservices.azure.com/', () => {
    return HttpResponse.json(mockResponses.healthCheck);
  }),

  // Health check endpoint - for request tests
  http.get('https://test-foundry.cognitiveservices.azure.com/health', () => {
    return HttpResponse.json(mockResponses.healthCheck);
  }),

  // Chat completions endpoint
  http.post('https://test-foundry.cognitiveservices.azure.com/chat/completions', async ({ request }) => {
    const body = await request.json() as any;
    
    // Simulate different response times based on model
    if (body.model === 'slow-model') {
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    return HttpResponse.json(mockResponses.chatCompletion);
  }),

  // Model listing endpoint
  http.get('https://test-foundry.cognitiveservices.azure.com/models', () => {
    return HttpResponse.json(mockResponses.modelList);
  }),

  // Voice session creation
  http.post('https://test-foundry.cognitiveservices.azure.com/voice/sessions', () => {
    return HttpResponse.json(mockResponses.voiceSession, { status: 201 });
  }),

  // Plain text endpoint
  http.get('https://test-foundry.cognitiveservices.azure.com/text', () => {
    return new HttpResponse('Plain text response', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    });
  }),

  // Retry test endpoint
  http.get('https://test-foundry.cognitiveservices.azure.com/retry-test', () => {
    return new HttpResponse(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }),

  // Always fail endpoint
  http.get('https://test-foundry.cognitiveservices.azure.com/always-fail', () => {
    return new HttpResponse('Service unavailable', { status: 503 });
  }),

  // Timeout endpoint
  http.get('https://test-foundry.cognitiveservices.azure.com/timeout', () => {
    return new Promise(() => {}); // Never resolve to simulate timeout
  }),

  // Client error endpoint
  http.get('https://test-foundry.cognitiveservices.azure.com/client-error', () => {
    return new HttpResponse('Bad Request', { status: 400 });
  }),

  // Server error endpoints
  http.get('https://test-foundry.cognitiveservices.azure.com/error/timeout', () => {
    return new Promise(() => {});
  }),

  http.get('https://test-foundry.cognitiveservices.azure.com/error/500', () => {
    return HttpResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }),

  http.get('https://test-foundry.cognitiveservices.azure.com/error/503', () => {
    return HttpResponse.json(
      { error: 'Service temporarily unavailable' },
      { status: 503 }
    );
  }),

  http.get('https://test-foundry.cognitiveservices.azure.com/error/429', () => {
    return HttpResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }),

  // Configuration endpoints
  http.get('https://test-foundry.cognitiveservices.azure.com/config', () => {
    return HttpResponse.json({
      endpoint: 'https://test-foundry.cognitiveservices.azure.com',
      models: mockResponses.modelList.models,
      region: 'eastus'
    });
  })
];

export { mockResponses };
