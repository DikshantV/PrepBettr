import { NextRequest, NextResponse } from 'next/server';
import { POST } from '@/app/api/resume/tailor/route';
import { firebaseVerification } from '@/lib/services/firebase-verification';
import { azureOpenAIService } from '@/lib/services/azure-openai-service';

// Mock the dependencies
jest.mock('@/lib/services/firebase-verification');
jest.mock('@/lib/services/azure-openai-service');

describe('/api/resume/tailor endpoint', () => {
  let mockFirebaseVerification;
  let mockAzureOpenAIService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFirebaseVerification = firebaseVerification;
    mockAzureOpenAIService = azureOpenAIService;
  });

  const createMockRequest = (sessionValue, body) => {
    const request = {
      cookies: {
        get: jest.fn().mockReturnValue(sessionValue ? { value: sessionValue } : undefined),
      },
      json: jest.fn().mockResolvedValue(body),
    };
    return request;
  };

  describe('Authentication', () => {
    it('should return 401 when session cookie is missing', async () => {
      const request = createMockRequest(null, {});
      const response = await POST(request);
      const responseBody = await response.json();
      
      expect(response.status).toBe(401);
      expect(responseBody).toEqual({ error: 'Authentication required' });
    });

    it('should return 401 when session token is invalid', async () => {
      mockFirebaseVerification.verifyIdToken.mockResolvedValue({
        success: false,
        decodedToken: null,
      });

      const request = createMockRequest('invalid-session', {});
      const response = await POST(request);
      const responseBody = await response.json();
      
      expect(response.status).toBe(401);
      expect(responseBody).toEqual({ error: 'Invalid session' });
    });
  });

  describe('Input Validation', () => {
    beforeEach(() => {
      mockFirebaseVerification.verifyIdToken.mockResolvedValue({
        success: true,
        decodedToken: { uid: 'test-user-id' },
      });
    });

    it('should return 400 when resume text is missing', async () => {
      const request = createMockRequest('valid-session', {
        resumeText: '',
        jobDescription: 'Valid job description',
      });
      
      const response = await POST(request);
      const responseBody = await response.json();
      
      expect(response.status).toBe(400);
      expect(responseBody).toEqual({
        error: 'Both resume text and job description are required',
      });
    });

    it('should return 400 when job description is missing', async () => {
      const request = createMockRequest('valid-session', {
        resumeText: 'Valid resume text',
        jobDescription: '',
      });
      
      const response = await POST(request);
      const responseBody = await response.json();
      
      expect(response.status).toBe(400);
      expect(responseBody).toEqual({
        error: 'Both resume text and job description are required',
      });
    });

    it('should return 400 when text length exceeds limit', async () => {
      const longText = 'a'.repeat(50001);
      const request = createMockRequest('valid-session', {
        resumeText: longText,
        jobDescription: 'Valid job description',
      });
      
      const response = await POST(request);
      const responseBody = await response.json();
      
      expect(response.status).toBe(400);
      expect(responseBody).toEqual({
        error: 'Text length exceeds maximum limit (50,000 characters)',
      });
    });
  });

  describe('Azure OpenAI Service Integration', () => {
    const sampleResumeText = `
      John Doe
      Software Developer
      Experience: 5 years in full-stack development
      Skills: JavaScript, React, Node.js, Python
    `;

    const sampleJobDescription = `
      We are looking for a Senior Full Stack Developer with experience in:
      - React and Node.js
      - Cloud platforms (Azure/AWS)
      - API development
    `;

    beforeEach(() => {
      mockFirebaseVerification.verifyIdToken.mockResolvedValue({
        success: true,
        decodedToken: { uid: 'test-user-id' },
      });
    });

    it('should return 503 when Azure OpenAI service is not available', async () => {
      // Mock the module-level initialization function to return false
      const originalModule = jest.requireActual('@/lib/services/azure-openai-service');
      jest.doMock('@/lib/services/azure-openai-service', () => ({
        ...originalModule,
        azureOpenAIService: {
          ...originalModule.azureOpenAIService,
          initialize: jest.fn().mockResolvedValue(false),
        },
      }));

      const request = createMockRequest('valid-session', {
        resumeText: sampleResumeText,
        jobDescription: sampleJobDescription,
      });
      
      const response = await POST(request);
      const responseBody = await response.json();
      
      expect(response.status).toBe(503);
      expect(responseBody).toEqual({
        error: 'Azure OpenAI service is not available. Please try again later.',
      });
    });

    it('should return 200 with tailored resume on successful processing', async () => {
      const tailoredResumeContent = `
        John Doe
        Senior Full Stack Developer
        Experience: 5 years in full-stack development with Azure cloud platforms
        Skills: JavaScript, React, Node.js, Python, Azure, API development
      `;

      mockAzureOpenAIService.initialize.mockResolvedValue(true);
      mockAzureOpenAIService.tailorResume.mockResolvedValue(tailoredResumeContent);

      const request = createMockRequest('valid-session', {
        resumeText: sampleResumeText,
        jobDescription: sampleJobDescription,
      });
      
      const response = await POST(request);
      const responseBody = await response.json();
      
      expect(response.status).toBe(200);
      expect(responseBody).toEqual({
        tailoredResume: tailoredResumeContent,
        success: true,
      });
      expect(mockAzureOpenAIService.tailorResume).toHaveBeenCalledWith(
        sampleResumeText,
        sampleJobDescription
      );
    });

    it('should handle rate limiting errors (429)', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      rateLimitError.status = 429;

      mockAzureOpenAIService.initialize.mockResolvedValue(true);
      mockAzureOpenAIService.tailorResume.mockRejectedValue(rateLimitError);

      const request = createMockRequest('valid-session', {
        resumeText: sampleResumeText,
        jobDescription: sampleJobDescription,
      });
      
      const response = await POST(request);
      const responseBody = await response.json();
      
      expect(response.status).toBe(429);
      expect(responseBody).toEqual({
        error: 'Service temporarily unavailable due to usage limits. Please try again later.',
      });
    });

    it('should handle authentication errors (401)', async () => {
      const authError = new Error('Authentication failed');
      authError.status = 401;

      mockAzureOpenAIService.initialize.mockResolvedValue(true);
      mockAzureOpenAIService.tailorResume.mockRejectedValue(authError);

      const request = createMockRequest('valid-session', {
        resumeText: sampleResumeText,
        jobDescription: sampleJobDescription,
      });
      
      const response = await POST(request);
      const responseBody = await response.json();
      
      expect(response.status).toBe(401);
      expect(responseBody).toEqual({
        error: 'Authentication failed with Azure OpenAI service.',
      });
    });

    it('should handle server errors (500)', async () => {
      const serverError = new Error('Internal server error');
      serverError.status = 500;

      mockAzureOpenAIService.initialize.mockResolvedValue(true);
      mockAzureOpenAIService.tailorResume.mockRejectedValue(serverError);

      const request = createMockRequest('valid-session', {
        resumeText: sampleResumeText,
        jobDescription: sampleJobDescription,
      });
      
      const response = await POST(request);
      const responseBody = await response.json();
      
      expect(response.status).toBe(500);
      expect(responseBody).toEqual({
        error: 'Azure OpenAI service is temporarily unavailable. Please try again later.',
      });
    });
  });
});

