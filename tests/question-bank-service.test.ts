/**
 * Question Bank Service Tests
 * 
 * Tests for the centralized question bank service including caching logic.
 */

import { questionBankService } from '@/lib/services/question-bank-service';
import type { QuestionBankOptions } from '@/lib/services/question-bank-service';

// Mock the Azure AI service
jest.mock('@/lib/ai', () => ({
  azureAI: {
    generateQuestions: jest.fn()
  }
}));

// Mock error logging
jest.mock('@/lib/errors', () => ({
  logServerError: jest.fn()
}));

describe('QuestionBankService', () => {
  beforeEach(() => {
    // Clear cache before each test
    questionBankService.invalidateCache();
    jest.clearAllMocks();
  });

  describe('Cache Management', () => {
    it('should invalidate entire cache', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      questionBankService.invalidateCache();
      
      expect(consoleSpy).toHaveBeenCalledWith('🗑️ Invalidated entire question bank cache');
      consoleSpy.mockRestore();
    });

    it('should invalidate cache by pattern', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      questionBankService.invalidateCache('getQuestions');
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('cache entries matching pattern: getQuestions'));
      consoleSpy.mockRestore();
    });

    it('should return cache statistics', () => {
      const stats = questionBankService.getCacheStats();
      
      expect(stats).toMatchObject({
        size: expect.any(Number),
        maxSize: 500,
        enabled: true,
        ttl: 3600
      });
    });
  });

  describe('Template Management', () => {
    it('should get all available templates', () => {
      const templates = questionBankService.getAllTemplates();
      
      expect(templates).toBeInstanceOf(Array);
      expect(templates.length).toBeGreaterThan(0);
      expect(templates[0]).toMatchObject({
        id: expect.any(String),
        role: expect.any(String),
        type: expect.any(String),
        techStack: expect.any(Array),
        questions: expect.any(Array),
        difficulty: expect.stringMatching(/easy|medium|hard/),
        estimatedDuration: expect.any(Number)
      });
    });

    it('should get templates by role', () => {
      const frontendTemplates = questionBankService.getTemplatesByRole('Frontend');
      
      expect(frontendTemplates).toBeInstanceOf(Array);
      frontendTemplates.forEach(template => {
        expect(template.role.toLowerCase()).toContain('frontend');
      });
    });

    it('should return empty array for non-existent role', () => {
      const templates = questionBankService.getTemplatesByRole('Non-existent Role');
      
      expect(templates).toEqual([]);
    });

    it('should get interview template by ID', async () => {
      const template = await questionBankService.getInterviewTemplate('frontend-dev-1');
      
      expect(template).not.toBeNull();
      expect(template?.id).toBe('frontend-dev-1');
      expect(template?.role).toBe('Frontend Developer');
    });

    it('should return null for non-existent template ID', async () => {
      const template = await questionBankService.getInterviewTemplate('non-existent');
      
      expect(template).toBeNull();
    });

    it('should cache template results', async () => {
      // First call
      const template1 = await questionBankService.getInterviewTemplate('frontend-dev-1');
      // Second call (should be cached)
      const template2 = await questionBankService.getInterviewTemplate('frontend-dev-1');
      
      expect(template1).toEqual(template2);
      expect(questionBankService.getCacheStats().size).toBeGreaterThan(0);
    });
  });

  describe('Question Retrieval', () => {
    it('should get questions without filters', async () => {
      const questions = await questionBankService.getQuestions();
      
      expect(questions).toBeInstanceOf(Array);
      questions.forEach(question => {
        expect(question).toMatchObject({
          id: expect.any(String),
          content: expect.any(String),
          type: expect.stringMatching(/technical|behavioral|mixed/),
          difficulty: expect.stringMatching(/easy|medium|hard/),
          techStack: expect.any(Array),
          category: expect.any(String)
        });
      });
    });

    it('should filter questions by type', async () => {
      const options: QuestionBankOptions = {
        type: 'technical'
      };
      
      const questions = await questionBankService.getQuestions(options);
      
      expect(questions).toBeInstanceOf(Array);
      questions.forEach(question => {
        expect(question.type).toBe('technical');
      });
    });

    it('should filter questions by difficulty', async () => {
      const options: QuestionBankOptions = {
        difficulty: 'medium'
      };
      
      const questions = await questionBankService.getQuestions(options);
      
      expect(questions).toBeInstanceOf(Array);
      questions.forEach(question => {
        expect(question.difficulty).toBe('medium');
      });
    });

    it('should filter questions by tech stack', async () => {
      const options: QuestionBankOptions = {
        techStack: ['React']
      };
      
      const questions = await questionBankService.getQuestions(options);
      
      expect(questions).toBeInstanceOf(Array);
      questions.forEach(question => {
        expect(question.techStack).toContain('React');
      });
    });

    it('should limit questions by maxQuestions', async () => {
      const options: QuestionBankOptions = {
        maxQuestions: 2
      };
      
      const questions = await questionBankService.getQuestions(options);
      
      expect(questions).toBeInstanceOf(Array);
      expect(questions.length).toBeLessThanOrEqual(2);
    });

    it('should exclude questions by ID', async () => {
      const excludeIds = ['tech-react-hooks'];
      const options: QuestionBankOptions = {
        excludeIds,
        techStack: ['React']
      };
      
      const questions = await questionBankService.getQuestions(options);
      
      expect(questions).toBeInstanceOf(Array);
      questions.forEach(question => {
        expect(excludeIds).not.toContain(question.id);
      });
    });

    it('should cache question results', async () => {
      const options: QuestionBankOptions = {
        type: 'technical',
        maxQuestions: 3
      };
      
      // First call
      const questions1 = await questionBankService.getQuestions(options);
      // Second call (should be cached)
      const questions2 = await questionBankService.getQuestions(options);
      
      expect(questions1).toEqual(questions2);
      expect(questionBankService.getCacheStats().size).toBeGreaterThan(0);
    });

    it('should handle errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Force an error by providing invalid options to trigger fallback
      const questions = await questionBankService.getQuestions({
        maxQuestions: -1 // This should not cause a crash
      });
      
      expect(questions).toBeInstanceOf(Array);
      consoleSpy.mockRestore();
    });
  });

  describe('AI Question Generation', () => {
    beforeEach(() => {
      const { azureAI } = require('@/lib/ai');
      azureAI.generateQuestions.mockClear();
    });

    it('should generate questions when includeGenerated is true', async () => {
      const { azureAI } = require('@/lib/ai');
      
      // Mock successful AI response
      azureAI.generateQuestions.mockResolvedValue({
        success: true,
        data: [
          'What is your experience with React hooks?',
          'How do you handle state management in large applications?',
          'Describe your testing strategy for React components'
        ],
        provider: 'azure-foundry'
      });

      const options: QuestionBankOptions = {
        role: 'Frontend Developer',
        type: 'technical',
        techStack: ['React'],
        maxQuestions: 5,
        includeGenerated: true
      };

      const questions = await questionBankService.getQuestions(options);

      expect(questions).toBeInstanceOf(Array);
      expect(questions.length).toBeGreaterThan(0);
      
      // Check if AI-generated questions are included
      const generatedQuestions = questions.filter(q => 
        q.metadata?.source === 'generated'
      );
      expect(generatedQuestions.length).toBeGreaterThan(0);
      
      expect(azureAI.generateQuestions).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Candidate',
          experience: 'Frontend Developer',
          skills: 'React'
        }),
        expect.objectContaining({
          maxQuestions: expect.any(Number),
          interviewType: 'technical'
        })
      );
    });

    it('should handle AI generation failures gracefully', async () => {
      const { azureAI } = require('@/lib/ai');
      
      // Mock AI failure
      azureAI.generateQuestions.mockResolvedValue({
        success: false,
        error: 'AI service unavailable',
        provider: 'azure-foundry'
      });

      const options: QuestionBankOptions = {
        role: 'Developer',
        includeGenerated: true,
        maxQuestions: 5
      };

      const questions = await questionBankService.getQuestions(options);

      // Should still return curated questions even if AI fails
      expect(questions).toBeInstanceOf(Array);
      expect(questions.length).toBeGreaterThan(0);
    });

    it('should not call AI when includeGenerated is false', async () => {
      const { azureAI } = require('@/lib/ai');

      const options: QuestionBankOptions = {
        role: 'Developer',
        includeGenerated: false,
        maxQuestions: 3
      };

      await questionBankService.getQuestions(options);

      expect(azureAI.generateQuestions).not.toHaveBeenCalled();
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle combined filters correctly', async () => {
      const options: QuestionBankOptions = {
        type: 'technical',
        difficulty: 'medium',
        techStack: ['React', 'JavaScript'],
        maxQuestions: 10,
        excludeIds: ['tech-virtual-dom']
      };

      const questions = await questionBankService.getQuestions(options);

      expect(questions).toBeInstanceOf(Array);
      questions.forEach(question => {
        expect(question.type).toBe('technical');
        expect(question.difficulty).toBe('medium');
        expect(question.techStack.some(tech => 
          ['React', 'JavaScript'].includes(tech)
        )).toBe(true);
        expect(question.id).not.toBe('tech-virtual-dom');
      });
      expect(questions.length).toBeLessThanOrEqual(10);
    });

    it('should work with empty result sets', async () => {
      const options: QuestionBankOptions = {
        type: 'technical',
        techStack: ['NonExistentTech'],
        maxQuestions: 5
      };

      const questions = await questionBankService.getQuestions(options);

      expect(questions).toEqual([]);
    });
  });
});
