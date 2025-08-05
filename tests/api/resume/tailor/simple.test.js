const { POST } = require('../../../../app/api/resume/tailor/route');

// Mock dependencies
jest.mock('@/lib/services/firebase-verification', () => ({
  firebaseVerification: {
    verifyIdToken: jest.fn(),
  },
}));

jest.mock('@/lib/services/azure-openai-service', () => ({
  azureOpenAIService: {
    initialize: jest.fn(),
    tailorResume: jest.fn(),
  },
}));

describe('Resume Tailor API', () => {
  let mockRequest;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockRequest = {
      cookies: {
        get: jest.fn(),
      },
      json: jest.fn(),
    };
  });

  test('should return 401 when no session cookie', async () => {
    mockRequest.cookies.get.mockReturnValue(undefined);
    
    const response = await POST(mockRequest);
    const data = await response.json();
    
    expect(response.status).toBe(401);
    expect(data.error).toBe('Authentication required');
  });

  test('should return 400 when missing required fields', async () => {
    const { firebaseVerification } = require('@/lib/services/firebase-verification');
    
    mockRequest.cookies.get.mockReturnValue({ value: 'test-session' });
    mockRequest.json.mockResolvedValue({
      resumeText: '',
      jobDescription: '',
    });
    
    firebaseVerification.verifyIdToken.mockResolvedValue({
      success: true,
      decodedToken: { uid: 'test-user' },
    });
    
    const response = await POST(mockRequest);
    const data = await response.json();
    
    expect(response.status).toBe(400);
    expect(data.error).toBe('Both resume text and job description are required');
  });

  test('should return 200 with successful tailoring', async () => {
    const { firebaseVerification } = require('@/lib/services/firebase-verification');
    const { azureOpenAIService } = require('@/lib/services/azure-openai-service');
    
    mockRequest.cookies.get.mockReturnValue({ value: 'test-session' });
    mockRequest.json.mockResolvedValue({
      resumeText: 'Sample resume content',
      jobDescription: 'Sample job description',
    });
    
    firebaseVerification.verifyIdToken.mockResolvedValue({
      success: true,
      decodedToken: { uid: 'test-user' },
    });
    
    azureOpenAIService.initialize.mockResolvedValue(true);
    azureOpenAIService.tailorResume.mockResolvedValue('Tailored resume content');
    
    const response = await POST(mockRequest);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.tailoredResume).toBe('Tailored resume content');
  });
});
