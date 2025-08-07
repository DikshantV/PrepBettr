/**
 * Unit tests for the Azure OpenAI Adapter
 */

import { AzureOpenAIAdapter } from '../azureOpenAI';
import { azureOpenAIService } from '@/lib/services/azure-openai-service';

// Mock the Azure OpenAI service
jest.mock('@/lib/services/azure-openai-service');

describe('AzureOpenAIAdapter', () => {
  let adapter: AzureOpenAIAdapter;
  let mockService: jest.Mocked<typeof azureOpenAIService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up mock service
    mockService = azureOpenAIService as jest.Mocked<typeof azureOpenAIService>;
    
    adapter = new AzureOpenAIAdapter();
  });

  afterEach(() => {
    adapter.dispose();
  });

  describe('Initialization', () => {
    it('should initialize successfully when service initializes', async () => {
      mockService.initialize.mockResolvedValue(true);

      const result = await adapter.initialize();

      expect(result).toBe(true);
      expect(mockService.initialize).toHaveBeenCalled();
    });

    it('should fail to initialize when service fails', async () => {
      mockService.initialize.mockResolvedValue(false);

      const result = await adapter.initialize();

      expect(result).toBe(false);
      expect(mockService.initialize).toHaveBeenCalled();
    });

    it('should handle initialization errors', async () => {
      const error = new Error('Azure credentials not found');
      mockService.initialize.mockRejectedValue(error);

      const result = await adapter.initialize();

      expect(result).toBe(false);
    });
  });

  describe('isReady', () => {
    it('should return true when initialized and service is ready', async () => {
      mockService.initialize.mockResolvedValue(true);
      mockService.isReady.mockReturnValue(true);

      await adapter.initialize();

      expect(adapter.isReady()).toBe(true);
    });

    it('should return false when not initialized', () => {
      mockService.isReady.mockReturnValue(true);

      expect(adapter.isReady()).toBe(false);
    });

    it('should return false when service is not ready', async () => {
      mockService.initialize.mockResolvedValue(true);
      mockService.isReady.mockReturnValue(false);

      await adapter.initialize();

      expect(adapter.isReady()).toBe(false);
    });
  });

  describe('generateCoverLetter', () => {
    beforeEach(async () => {
      mockService.initialize.mockResolvedValue(true);
      mockService.isReady.mockReturnValue(true);
      await adapter.initialize();
    });

    it('should generate cover letter successfully', async () => {
      const mockCompletion = {
        choices: [{
          message: {
            content: 'Dear Hiring Manager, I am excited to apply...'
          }
        }]
      };
      mockService.createCompletion.mockResolvedValue(mockCompletion as any);

      const result = await adapter.generateCoverLetter('resume text', 'job description');

      expect(mockService.createCompletion).toHaveBeenCalledWith(
        [{ role: 'user', content: expect.stringContaining('job description') }],
        { temperature: 0.7, maxTokens: 1500 }
      );
      expect(result).toBe('Dear Hiring Manager, I am excited to apply...');
    });

    it('should throw error when not initialized', async () => {
      const uninitializedAdapter = new AzureOpenAIAdapter();

      await expect(uninitializedAdapter.generateCoverLetter('resume', 'job'))
        .rejects.toThrow('Azure OpenAI adapter not initialized');
    });

    it('should handle empty response', async () => {
      const mockCompletion = {
        choices: [{
          message: {
            content: ''
          }
        }]
      };
      mockService.createCompletion.mockResolvedValue(mockCompletion as any);

      await expect(adapter.generateCoverLetter('resume', 'job'))
        .rejects.toThrow('Empty response from Azure OpenAI');
    });

    it('should handle missing choices', async () => {
      const mockCompletion = {
        choices: []
      };
      mockService.createCompletion.mockResolvedValue(mockCompletion as any);

      await expect(adapter.generateCoverLetter('resume', 'job'))
        .rejects.toThrow('Empty response from Azure OpenAI');
    });

    it('should handle API errors', async () => {
      const apiError = new Error('Rate limit exceeded');
      mockService.createCompletion.mockRejectedValue(apiError);

      await expect(adapter.generateCoverLetter('resume', 'job'))
        .rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('calculateRelevancy', () => {
    beforeEach(async () => {
      mockService.initialize.mockResolvedValue(true);
      mockService.isReady.mockReturnValue(true);
      await adapter.initialize();
    });

    it('should calculate relevancy score successfully', async () => {
      const mockCompletion = {
        choices: [{
          message: {
            content: '87'
          }
        }]
      };
      mockService.createCompletion.mockResolvedValue(mockCompletion as any);

      const result = await adapter.calculateRelevancy('resume text', 'job description');

      expect(mockService.createCompletion).toHaveBeenCalledWith(
        [{ role: 'user', content: expect.stringContaining('ATS') }],
        { temperature: 0.1, maxTokens: 50 }
      );
      expect(result).toBe(87);
    });

    it('should handle response with extra text', async () => {
      const mockCompletion = {
        choices: [{
          message: {
            content: 'Based on the analysis, the score is 94.'
          }
        }]
      };
      mockService.createCompletion.mockResolvedValue(mockCompletion as any);

      const result = await adapter.calculateRelevancy('resume', 'job');

      expect(result).toBe(94);
    });

    it('should clamp scores to valid range', async () => {
      const mockCompletion = {
        choices: [{
          message: {
            content: '150'
          }
        }]
      };
      mockService.createCompletion.mockResolvedValue(mockCompletion as any);

      const result = await adapter.calculateRelevancy('resume', 'job');

      expect(result).toBe(100); // Clamped to maximum
    });

    it('should throw error when no score found', async () => {
      const mockCompletion = {
        choices: [{
          message: {
            content: 'No numeric value available'
          }
        }]
      };
      mockService.createCompletion.mockResolvedValue(mockCompletion as any);

      await expect(adapter.calculateRelevancy('resume', 'job'))
        .rejects.toThrow('Could not extract relevancy score from response');
    });
  });

  describe('tailorResume', () => {
    beforeEach(async () => {
      mockService.initialize.mockResolvedValue(true);
      mockService.isReady.mockReturnValue(true);
      await adapter.initialize();
    });

    it('should tailor resume successfully', async () => {
      const tailoredContent = 'John Doe\nSenior Software Engineer...';
      mockService.tailorResume.mockResolvedValue(tailoredContent);

      const result = await adapter.tailorResume('original resume', 'job description');

      expect(mockService.tailorResume).toHaveBeenCalledWith('original resume', 'job description');
      expect(result).toBe(tailoredContent);
    });

    it('should handle service errors', async () => {
      const error = new Error('Azure OpenAI service error');
      mockService.tailorResume.mockRejectedValue(error);

      await expect(adapter.tailorResume('resume', 'job'))
        .rejects.toThrow('Azure OpenAI service error');
    });
  });

  describe('generateQuestions', () => {
    beforeEach(async () => {
      mockService.initialize.mockResolvedValue(true);
      mockService.isReady.mockReturnValue(true);
      await adapter.initialize();
    });

    it('should generate questions successfully', async () => {
      const questions = [
        'Tell me about your experience',
        'How do you handle challenges?',
        'What are your strengths?'
      ];
      mockService.generateQuestions.mockResolvedValue(questions);

      const resumeInfo = {
        name: 'John Doe',
        experience: '5 years',
        education: 'BS',
        skills: 'React, Node.js'
      };

      const result = await adapter.generateQuestions(resumeInfo);

      expect(mockService.generateQuestions).toHaveBeenCalledWith(resumeInfo);
      expect(result).toEqual(questions);
    });

    it('should handle service errors', async () => {
      const error = new Error('Question generation failed');
      mockService.generateQuestions.mockRejectedValue(error);

      const resumeInfo = {
        name: 'Test',
        experience: 'test',
        education: 'test',
        skills: 'test'
      };

      await expect(adapter.generateQuestions(resumeInfo))
        .rejects.toThrow('Question generation failed');
    });
  });

  describe('dispose', () => {
    it('should dispose resources properly', async () => {
      mockService.initialize.mockResolvedValue(true);
      mockService.isReady.mockReturnValue(true);
      await adapter.initialize();
      
      expect(adapter.isReady()).toBe(true);
      
      adapter.dispose();
      
      expect(adapter.isReady()).toBe(false);
    });

    it('should handle dispose when not initialized', () => {
      expect(() => adapter.dispose()).not.toThrow();
      expect(adapter.isReady()).toBe(false);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      mockService.initialize.mockResolvedValue(true);
      mockService.isReady.mockReturnValue(true);
      await adapter.initialize();
    });

    it('should handle service initialization failures', async () => {
      mockService.initialize.mockResolvedValue(false);
      const newAdapter = new AzureOpenAIAdapter();

      const result = await newAdapter.initialize();

      expect(result).toBe(false);
      expect(newAdapter.isReady()).toBe(false);
    });

    it('should handle network errors in createCompletion', async () => {
      const networkError = new Error('Network connection failed');
      mockService.createCompletion.mockRejectedValue(networkError);

      await expect(adapter.generateCoverLetter('resume', 'job'))
        .rejects.toThrow('Network connection failed');
    });

    it('should handle malformed completion responses', async () => {
      const malformedCompletion = {
        choices: [{
          // Missing message property
        }]
      };
      mockService.createCompletion.mockResolvedValue(malformedCompletion as any);

      await expect(adapter.generateCoverLetter('resume', 'job'))
        .rejects.toThrow('Empty response from Azure OpenAI');
    });

    it('should handle Azure service not ready', async () => {
      mockService.isReady.mockReturnValue(false);

      await expect(adapter.generateCoverLetter('resume', 'job'))
        .rejects.toThrow('Azure OpenAI adapter not initialized');
    });
  });

  describe('Integration with Azure Service', () => {
    beforeEach(async () => {
      mockService.initialize.mockResolvedValue(true);
      mockService.isReady.mockReturnValue(true);
      await adapter.initialize();
    });

    it('should use correct parameters for cover letter generation', async () => {
      const mockCompletion = {
        choices: [{
          message: {
            content: 'Generated cover letter'
          }
        }]
      };
      mockService.createCompletion.mockResolvedValue(mockCompletion as any);

      await adapter.generateCoverLetter('resume text', 'job desc');

      expect(mockService.createCompletion).toHaveBeenCalledWith(
        [{ role: 'user', content: expect.stringContaining('cover letter') }],
        { temperature: 0.7, maxTokens: 1500 }
      );
    });

    it('should use correct parameters for relevancy calculation', async () => {
      const mockCompletion = {
        choices: [{
          message: {
            content: '75'
          }
        }]
      };
      mockService.createCompletion.mockResolvedValue(mockCompletion as any);

      await adapter.calculateRelevancy('resume', 'job');

      expect(mockService.createCompletion).toHaveBeenCalledWith(
        [{ role: 'user', content: expect.stringContaining('relevancy') }],
        { temperature: 0.1, maxTokens: 50 }
      );
    });

    it('should delegate tailorResume to service directly', async () => {
      mockService.tailorResume.mockResolvedValue('tailored content');

      await adapter.tailorResume('original', 'job');

      expect(mockService.tailorResume).toHaveBeenCalledWith('original', 'job');
      expect(mockService.createCompletion).not.toHaveBeenCalled();
    });

    it('should delegate generateQuestions to service directly', async () => {
      const questions = ['Q1', 'Q2'];
      mockService.generateQuestions.mockResolvedValue(questions);

      const resumeInfo = {
        name: 'Test',
        experience: 'test',
        education: 'test',
        skills: 'test'
      };

      await adapter.generateQuestions(resumeInfo);

      expect(mockService.generateQuestions).toHaveBeenCalledWith(resumeInfo);
      expect(mockService.createCompletion).not.toHaveBeenCalled();
    });
  });
});
