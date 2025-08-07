/**
 * Unit tests for the Azure-Centric AI Service Layer
 */

import { 
  generateCoverLetter, 
  calculateRelevancy, 
  tailorResume, 
  generateQuestions,
  getProviderInfo,
  switchProvider,
  dispose
} from '../index';
import { AzureOpenAIAdapter } from '../azureOpenAI';

// Mock the adapter
jest.mock('../azureOpenAI');

// Mock console methods to reduce noise in tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

describe('Azure-Centric AI Service Layer', () => {
  let mockAzureAdapter: jest.Mocked<AzureOpenAIAdapter>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up mock implementation
    mockAzureAdapter = {
      name: 'Azure OpenAI',
      initialize: jest.fn(),
      isReady: jest.fn(),
      generateCoverLetter: jest.fn(),
      calculateRelevancy: jest.fn(),
      tailorResume: jest.fn(),
      generateQuestions: jest.fn(),
      dispose: jest.fn()
    };

    // Mock the constructor
    (AzureOpenAIAdapter as jest.MockedClass<typeof AzureOpenAIAdapter>).mockImplementation(() => mockAzureAdapter);
  });

  afterEach(() => {
    dispose();
  });

  describe('Provider Initialization', () => {
    it('should initialize with Azure OpenAI provider', async () => {
      mockAzureAdapter.initialize.mockResolvedValue(true);
      mockAzureAdapter.isReady.mockReturnValue(true);
      mockAzureAdapter.generateCoverLetter.mockResolvedValue('Azure cover letter');

      const response = await generateCoverLetter('resume', 'job description');

      expect(mockAzureAdapter.initialize).toHaveBeenCalled();
      expect(response.success).toBe(true);
      expect(response.provider).toBe('Azure OpenAI');
      expect(response.data).toBe('Azure cover letter');
    });

    it('should return error when Azure OpenAI provider is not available', async () => {
      mockAzureAdapter.initialize.mockResolvedValue(false);

      const response = await generateCoverLetter('resume', 'job description');

      expect(response.success).toBe(false);
      expect(response.error).toContain('no providers available');
    });
  });

  describe('generateCoverLetter', () => {
    beforeEach(() => {
      mockAzureAdapter.initialize.mockResolvedValue(true);
      mockAzureAdapter.isReady.mockReturnValue(true);
    });

    it('should generate cover letter successfully', async () => {
      const expectedCoverLetter = 'Dear Hiring Manager...';
      mockAzureAdapter.generateCoverLetter.mockResolvedValue(expectedCoverLetter);

      const response = await generateCoverLetter('resume text', 'job description');

      expect(mockAzureAdapter.generateCoverLetter).toHaveBeenCalledWith('resume text', 'job description');
      expect(response.success).toBe(true);
      expect(response.data).toBe(expectedCoverLetter);
      expect(response.provider).toBe('Azure OpenAI');
    });

    it('should handle provider errors gracefully', async () => {
      const error = new Error('API quota exceeded');
      mockAzureAdapter.generateCoverLetter.mockRejectedValue(error);

      const response = await generateCoverLetter('resume', 'job');

      expect(response.success).toBe(false);
      expect(response.error).toBe('API quota exceeded');
      expect(response.provider).toBe('Azure OpenAI');
    });
  });

  describe('calculateRelevancy', () => {
    beforeEach(() => {
      mockAzureAdapter.initialize.mockResolvedValue(true);
      mockAzureAdapter.isReady.mockReturnValue(true);
    });

    it('should calculate relevancy score successfully', async () => {
      mockAzureAdapter.calculateRelevancy.mockResolvedValue(85);

      const response = await calculateRelevancy('resume text', 'job description');

      expect(mockAzureAdapter.calculateRelevancy).toHaveBeenCalledWith('resume text', 'job description');
      expect(response.success).toBe(true);
      expect(response.data).toBe(85);
      expect(response.provider).toBe('Azure OpenAI');
    });

    it('should clamp score to 0-100 range', async () => {
      mockAzureAdapter.calculateRelevancy.mockResolvedValue(150);

      const response = await calculateRelevancy('resume', 'job');

      expect(response.success).toBe(true);
      expect(response.data).toBe(100); // Clamped to max
    });

    it('should clamp negative scores to 0', async () => {
      mockAzureAdapter.calculateRelevancy.mockResolvedValue(-10);

      const response = await calculateRelevancy('resume', 'job');

      expect(response.success).toBe(true);
      expect(response.data).toBe(0); // Clamped to min
    });

    it('should handle provider errors', async () => {
      const error = new Error('Failed to analyze');
      mockAzureAdapter.calculateRelevancy.mockRejectedValue(error);

      const response = await calculateRelevancy('resume', 'job');

      expect(response.success).toBe(false);
      expect(response.error).toBe('Failed to analyze');
    });
  });

  describe('tailorResume', () => {
    beforeEach(() => {
      mockAzureAdapter.initialize.mockResolvedValue(true);
      mockAzureAdapter.isReady.mockReturnValue(true);
    });

    it('should tailor resume successfully', async () => {
      const tailoredResume = 'Tailored resume content';
      mockAzureAdapter.tailorResume.mockResolvedValue(tailoredResume);

      const response = await tailorResume('original resume', 'job description');

      expect(mockAzureAdapter.tailorResume).toHaveBeenCalledWith('original resume', 'job description');
      expect(response.success).toBe(true);
      expect(response.data).toBe(tailoredResume);
      expect(response.provider).toBe('Azure OpenAI');
    });

    it('should handle provider errors', async () => {
      const error = new Error('Tailoring failed');
      mockAzureAdapter.tailorResume.mockRejectedValue(error);

      const response = await tailorResume('resume', 'job');

      expect(response.success).toBe(false);
      expect(response.error).toBe('Tailoring failed');
    });
  });

  describe('generateQuestions', () => {
    beforeEach(() => {
      mockAzureAdapter.initialize.mockResolvedValue(true);
      mockAzureAdapter.isReady.mockReturnValue(true);
    });

    it('should generate questions successfully', async () => {
      const questions = [
        'Tell me about your experience with React',
        'How do you handle challenging situations?',
        'What are your career goals?'
      ];
      mockAzureAdapter.generateQuestions.mockResolvedValue(questions);

      const resumeInfo = {
        name: 'John Doe',
        experience: '5 years in web development',
        education: 'BS Computer Science',
        skills: 'React, Node.js, TypeScript'
      };

      const response = await generateQuestions(resumeInfo);

      expect(mockAzureAdapter.generateQuestions).toHaveBeenCalledWith(resumeInfo);
      expect(response.success).toBe(true);
      expect(response.data).toEqual(questions);
      expect(response.provider).toBe('Azure OpenAI');
    });

    it('should handle provider errors', async () => {
      const error = new Error('Question generation failed');
      mockAzureAdapter.generateQuestions.mockRejectedValue(error);

      const resumeInfo = {
        name: 'John Doe',
        experience: '5 years',
        education: 'BS',
        skills: 'JavaScript'
      };

      const response = await generateQuestions(resumeInfo);

      expect(response.success).toBe(false);
      expect(response.error).toBe('Question generation failed');
    });
  });

  describe('getProviderInfo', () => {
    it('should return provider information when initialized', async () => {
      mockAzureAdapter.initialize.mockResolvedValue(true);
      mockAzureAdapter.isReady.mockReturnValue(true);
      
      // Initialize by making a call
      await generateCoverLetter('test', 'test');
      
      const info = getProviderInfo();
      expect(info.name).toBe('Azure OpenAI');
      expect(info.isReady).toBe(true);
    });

    it('should return none when not initialized', () => {
      const info = getProviderInfo();
      expect(info.name).toBe('none');
      expect(info.isReady).toBe(false);
    });
  });

  describe('switchProvider', () => {
    beforeEach(() => {
      mockAzureAdapter.initialize.mockResolvedValue(true);
      mockAzureAdapter.isReady.mockReturnValue(true);
    });

    it('should switch to Azure OpenAI successfully', async () => {
      // Initialize first
      await generateCoverLetter('test', 'test');
      expect(getProviderInfo().name).toBe('Azure OpenAI');

      // Switch to Azure (should work since it's the only provider)
      const response = await switchProvider('azure-openai');
      
      expect(response.success).toBe(true);
      expect(response.data).toBe(true);
      expect(mockAzureAdapter.dispose).toHaveBeenCalled();
      expect(mockAzureAdapter.initialize).toHaveBeenCalled();
    });

    it('should handle invalid provider names', async () => {
      const response = await switchProvider('invalid-provider');
      
      expect(response.success).toBe(false);
      expect(response.error).toContain('Unknown error occurred');
    });

    it('should handle switch failures', async () => {
      mockAzureAdapter.initialize.mockResolvedValue(false);
      
      const response = await switchProvider('azure-openai');
      
      expect(response.success).toBe(false);
      expect(response.data).toBe(false);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      mockAzureAdapter.initialize.mockResolvedValue(true);
      mockAzureAdapter.isReady.mockReturnValue(true);
    });

    it('should handle unknown errors gracefully', async () => {
      mockAzureAdapter.generateCoverLetter.mockRejectedValue('String error');

      const response = await generateCoverLetter('resume', 'job');

      expect(response.success).toBe(false);
      expect(response.error).toBe('Unknown error occurred');
    });

    it('should handle provider not ready state', async () => {
      mockAzureAdapter.isReady.mockReturnValue(false);
      mockAzureAdapter.generateCoverLetter.mockRejectedValue(new Error('Provider not ready'));

      const response = await generateCoverLetter('resume', 'job');

      expect(response.success).toBe(false);
      expect(response.error).toContain('Provider not ready');
    });
  });

  describe('Concurrent Requests', () => {
    beforeEach(() => {
      mockAzureAdapter.initialize.mockResolvedValue(true);
      mockAzureAdapter.isReady.mockReturnValue(true);
    });

    it('should handle multiple concurrent requests', async () => {
      mockAzureAdapter.generateCoverLetter
        .mockResolvedValueOnce('Cover letter 1')
        .mockResolvedValueOnce('Cover letter 2')
        .mockResolvedValueOnce('Cover letter 3');

      const promises = [
        generateCoverLetter('resume1', 'job1'),
        generateCoverLetter('resume2', 'job2'),
        generateCoverLetter('resume3', 'job3')
      ];

      const responses = await Promise.all(promises);

      expect(responses).toHaveLength(3);
      expect(responses[0].success).toBe(true);
      expect(responses[1].success).toBe(true);
      expect(responses[2].success).toBe(true);
      expect(responses[0].data).toBe('Cover letter 1');
      expect(responses[1].data).toBe('Cover letter 2');
      expect(responses[2].data).toBe('Cover letter 3');
    });
  });
});
