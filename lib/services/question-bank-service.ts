/**
 * Question Bank Service
 * 
 * Centralized service for managing interview questions with caching support.
 * Consolidates mock question data and provides APIs for dynamic question generation.
 */

import { logServerError } from '@/lib/errors';
import { azureAI } from '@/lib/ai';
import type { AzureAIResponse } from '@/lib/ai';

// ===== INTERFACES =====

export interface QuestionBankQuestion {
  id: string;
  content: string;
  type: 'technical' | 'behavioral' | 'mixed';
  difficulty: 'easy' | 'medium' | 'hard';
  techStack: string[];
  category: string;
  estimatedTime?: number; // minutes
  metadata?: {
    tags: string[];
    source: 'generated' | 'curated' | 'community';
    version: string;
    lastUpdated: Date;
  };
}

export interface InterviewTemplate {
  id: string;
  role: string;
  type: 'technical' | 'behavioral' | 'mixed';
  techStack: string[];
  questions: string[]; // Question IDs or content
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedDuration: number; // minutes
  description?: string;
  metadata?: {
    popularity: number;
    successRate: number;
    lastUsed: Date;
  };
}

export interface QuestionBankOptions {
  role?: string;
  type?: 'technical' | 'behavioral' | 'mixed';
  difficulty?: 'easy' | 'medium' | 'hard';
  techStack?: string[];
  maxQuestions?: number;
  excludeIds?: string[];
  includeGenerated?: boolean;
}

export interface CacheConfig {
  enabled: boolean;
  ttl: number; // seconds
  maxSize: number;
  redisUrl?: string; // Optional Redis for distributed caching
}

// ===== MOCK DATA =====

const MOCK_INTERVIEW_TEMPLATES: InterviewTemplate[] = [
  {
    id: 'frontend-dev-1',
    role: 'Frontend Developer',
    type: 'technical',
    techStack: ['React', 'TypeScript', 'Next.js', 'Tailwind CSS'],
    questions: [
      'Explain the concept of React hooks and provide examples',
      'What is the virtual DOM and how does it work?',
      'How do you handle state management in React applications?',
      'Describe the differences between TypeScript and JavaScript',
      'How do you implement responsive design with Tailwind CSS?'
    ],
    difficulty: 'medium',
    estimatedDuration: 45,
    description: 'Frontend development interview focusing on React ecosystem'
  },
  {
    id: 'backend-dev-1',
    role: 'Backend Developer',
    type: 'technical',
    techStack: ['Node.js', 'Express', 'MongoDB', 'JavaScript'],
    questions: [
      'Explain RESTful API design principles',
      'How do you handle database relationships in MongoDB?',
      'What are middleware functions in Express.js?',
      'How do you implement authentication and authorization?',
      'Describe your approach to error handling in APIs'
    ],
    difficulty: 'medium',
    estimatedDuration: 50,
    description: 'Backend development interview focusing on Node.js stack'
  },
  {
    id: 'fullstack-dev-1',
    role: 'Full Stack Developer',
    type: 'mixed',
    techStack: ['Python', 'Django', 'PostgreSQL', 'Redis'],
    questions: [
      'Describe your experience with full-stack development',
      'How do you optimize database queries?',
      'What is your approach to handling user authentication?',
      'How do you implement caching strategies?',
      'Describe a challenging full-stack project you built'
    ],
    difficulty: 'medium',
    estimatedDuration: 60,
    description: 'Full-stack development interview with Python/Django focus'
  },
  {
    id: 'software-eng-behavioral',
    role: 'Software Engineer',
    type: 'behavioral',
    techStack: ['Vue.js', 'Nuxt.js', 'Vuex', 'SCSS'],
    questions: [
      'Tell me about a challenging project you worked on',
      'How do you handle conflicts in a team environment?',
      'Describe a time when you had to learn a new technology quickly',
      'How do you prioritize tasks when everything seems urgent?',
      'Tell me about a mistake you made and how you handled it'
    ],
    difficulty: 'medium',
    estimatedDuration: 40,
    description: 'Behavioral interview for software engineering roles'
  },
  {
    id: 'devops-eng-1',
    role: 'DevOps Engineer',
    type: 'technical',
    techStack: ['Docker', 'Kubernetes', 'AWS', 'Jenkins'],
    questions: [
      'Explain containerization and its benefits',
      'How do you implement CI/CD pipelines?',
      'What is Infrastructure as Code?',
      'How do you monitor and troubleshoot production systems?',
      'Describe your experience with cloud platforms'
    ],
    difficulty: 'hard',
    estimatedDuration: 55,
    description: 'DevOps engineering interview focusing on containerization and CI/CD'
  },
  {
    id: 'data-scientist-1',
    role: 'Data Scientist',
    type: 'technical',
    techStack: ['Python', 'TensorFlow', 'Pandas', 'SQL'],
    questions: [
      'Explain the difference between supervised and unsupervised learning',
      'How do you handle missing data in datasets?',
      'What is feature engineering and why is it important?',
      'Describe your experience with neural networks',
      'How do you validate and test machine learning models?'
    ],
    difficulty: 'hard',
    estimatedDuration: 60,
    description: 'Data science interview covering machine learning fundamentals'
  },
  {
    id: 'mobile-dev-1',
    role: 'Mobile Developer',
    type: 'mixed',
    techStack: ['React Native', 'JavaScript', 'Firebase', 'Redux'],
    questions: [
      'What are the advantages of React Native over native development?',
      'How do you handle offline functionality in mobile apps?',
      'Describe your experience with mobile app deployment',
      'How do you optimize mobile app performance?',
      'What are your strategies for handling different screen sizes?'
    ],
    difficulty: 'medium',
    estimatedDuration: 45,
    description: 'Mobile development interview with React Native focus'
  },
  {
    id: 'qa-engineer-1',
    role: 'QA Engineer',
    type: 'technical',
    techStack: ['Selenium', 'Jest', 'Cypress', 'JavaScript'],
    questions: [
      'What is the difference between unit testing and integration testing?',
      'How do you design test cases for a new feature?',
      'Explain automation testing strategies you have used',
      'How do you handle flaky tests in your test suite?',
      'Describe your approach to performance testing'
    ],
    difficulty: 'medium',
    estimatedDuration: 40,
    description: 'Quality assurance interview focusing on testing strategies'
  }
];

const CURATED_QUESTIONS: QuestionBankQuestion[] = [
  // Technical Questions
  {
    id: 'tech-react-hooks',
    content: 'Explain the concept of React hooks and provide examples',
    type: 'technical',
    difficulty: 'medium',
    techStack: ['React', 'JavaScript'],
    category: 'frontend',
    estimatedTime: 5,
    metadata: {
      tags: ['hooks', 'state-management', 'functional-components'],
      source: 'curated',
      version: '1.0',
      lastUpdated: new Date()
    }
  },
  {
    id: 'tech-virtual-dom',
    content: 'What is the virtual DOM and how does it work?',
    type: 'technical',
    difficulty: 'medium',
    techStack: ['React', 'JavaScript'],
    category: 'frontend',
    estimatedTime: 4,
    metadata: {
      tags: ['virtual-dom', 'performance', 'react-internals'],
      source: 'curated',
      version: '1.0',
      lastUpdated: new Date()
    }
  },
  // Add more curated questions...
];

// ===== SERVICE CLASS =====

class QuestionBankService {
  private cache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map();
  private cacheConfig: CacheConfig = {
    enabled: true,
    ttl: 3600, // 1 hour
    maxSize: 1000
  };

  constructor(config?: Partial<CacheConfig>) {
    if (config) {
      this.cacheConfig = { ...this.cacheConfig, ...config };
    }
  }

  // ===== CACHE METHODS =====

  private getCacheKey(method: string, params: any): string {
    return `qb:${method}:${JSON.stringify(params)}`;
  }

  private getFromCache<T>(key: string): T | null {
    if (!this.cacheConfig.enabled) return null;

    const cached = this.cache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > cached.ttl * 1000) {
      this.cache.delete(key);
      return null;
    }

    return cached.data as T;
  }

  private setCache(key: string, data: any, ttl?: number): void {
    if (!this.cacheConfig.enabled) return;

    // Clean up if cache is too large
    if (this.cache.size >= this.cacheConfig.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.cacheConfig.ttl
    });
  }

  public invalidateCache(pattern?: string): void {
    if (pattern) {
      const keys = Array.from(this.cache.keys()).filter(key => key.includes(pattern));
      keys.forEach(key => this.cache.delete(key));
      console.log(`🗑️ Invalidated ${keys.length} cache entries matching pattern: ${pattern}`);
    } else {
      this.cache.clear();
      console.log('🗑️ Invalidated entire question bank cache');
    }
  }

  // ===== CORE METHODS =====

  /**
   * Get interview template by ID or generate one based on criteria
   */
  async getInterviewTemplate(
    templateId: string,
    options?: QuestionBankOptions
  ): Promise<InterviewTemplate | null> {
    const cacheKey = this.getCacheKey('getInterviewTemplate', { templateId, options });
    const cached = this.getFromCache<InterviewTemplate>(cacheKey);
    if (cached) return cached;

    try {
      // First try to find existing template
      const template = MOCK_INTERVIEW_TEMPLATES.find(t => t.id === templateId);
      
      if (template) {
        this.setCache(cacheKey, template);
        return template;
      }

      // If not found and we have enough context, generate one
      if (options?.role) {
        const generatedTemplate = await this.generateInterviewTemplate(options);
        this.setCache(cacheKey, generatedTemplate);
        return generatedTemplate;
      }

      return null;
    } catch (error) {
      console.error('❌ Error getting interview template:', error);
      logServerError(error as Error, {
        service: 'question-bank',
        action: 'getInterviewTemplate'
      });
      return null;
    }
  }

  /**
   * Get questions based on criteria
   */
  async getQuestions(options: QuestionBankOptions = {}): Promise<QuestionBankQuestion[]> {
    const cacheKey = this.getCacheKey('getQuestions', options);
    const cached = this.getFromCache<QuestionBankQuestion[]>(cacheKey);
    if (cached) return cached;

    try {
      let questions = [...CURATED_QUESTIONS];

      // Filter by criteria
      if (options.type) {
        questions = questions.filter(q => q.type === options.type);
      }
      if (options.difficulty) {
        questions = questions.filter(q => q.difficulty === options.difficulty);
      }
      if (options.techStack) {
        questions = questions.filter(q => 
          q.techStack.some(tech => options.techStack!.includes(tech))
        );
      }
      if (options.excludeIds) {
        questions = questions.filter(q => !options.excludeIds!.includes(q.id));
      }

      // Generate additional questions if needed and enabled
      if (options.includeGenerated && questions.length < (options.maxQuestions || 10)) {
        const additionalQuestions = await this.generateQuestions({
          ...options,
          maxQuestions: (options.maxQuestions || 10) - questions.length
        });
        questions.push(...additionalQuestions);
      }

      // Apply max limit
      if (options.maxQuestions) {
        questions = questions.slice(0, options.maxQuestions);
      }

      this.setCache(cacheKey, questions);
      return questions;
    } catch (error) {
      console.error('❌ Error getting questions:', error);
      logServerError(error as Error, {
        service: 'question-bank',
        action: 'getQuestions'
      });
      return CURATED_QUESTIONS.slice(0, options.maxQuestions || 10);
    }
  }

  /**
   * Generate new questions using AI
   */
  private async generateQuestions(options: QuestionBankOptions): Promise<QuestionBankQuestion[]> {
    try {
      const prompt = this.buildQuestionGenerationPrompt(options);
      const response: AzureAIResponse<string[]> = await azureAI.generateQuestions(
        { 
          name: 'Candidate',
          experience: options.role || 'Software Developer',
          education: 'Computer Science',
          skills: (options.techStack || []).join(', ')
        },
        {
          maxQuestions: options.maxQuestions || 5,
          difficulty: options.difficulty,
          interviewType: options.type
        }
      );

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to generate questions');
      }

      return response.data.map((content: string, index: number) => ({
        id: `generated-${Date.now()}-${index}`,
        content,
        type: options.type || 'mixed',
        difficulty: options.difficulty || 'medium',
        techStack: options.techStack || [],
        category: options.role?.toLowerCase().replace(' ', '-') || 'general',
        estimatedTime: 5,
        metadata: {
          tags: ['generated', 'ai'],
          source: 'generated' as const,
          version: '1.0',
          lastUpdated: new Date()
        }
      }));
    } catch (error) {
      console.error('❌ Error generating questions:', error);
      return [];
    }
  }

  /**
   * Generate interview template using AI
   */
  private async generateInterviewTemplate(options: QuestionBankOptions): Promise<InterviewTemplate> {
    const questions = await this.generateQuestions({
      ...options,
      maxQuestions: 5,
      includeGenerated: true
    });

    return {
      id: `generated-${Date.now()}`,
      role: options.role || 'Software Developer',
      type: options.type || 'mixed',
      techStack: options.techStack || [],
      questions: questions.map(q => q.content),
      difficulty: options.difficulty || 'medium',
      estimatedDuration: questions.length * 8, // 8 minutes per question
      description: `Generated interview template for ${options.role || 'Software Developer'}`,
      metadata: {
        popularity: 0,
        successRate: 0,
        lastUsed: new Date()
      }
    };
  }

  /**
   * Get all available interview templates
   */
  getAllTemplates(): InterviewTemplate[] {
    return [...MOCK_INTERVIEW_TEMPLATES];
  }

  /**
   * Get templates by role
   */
  getTemplatesByRole(role: string): InterviewTemplate[] {
    return MOCK_INTERVIEW_TEMPLATES.filter(t => 
      t.role.toLowerCase().includes(role.toLowerCase())
    );
  }

  /**
   * Build prompt for question generation
   */
  private buildQuestionGenerationPrompt(options: QuestionBankOptions): string {
    const parts = [
      `Generate ${options.maxQuestions || 5} interview questions for a ${options.role || 'Software Developer'} position.`
    ];

    if (options.type) {
      parts.push(`Focus on ${options.type} questions.`);
    }

    if (options.difficulty) {
      parts.push(`Questions should be ${options.difficulty} difficulty level.`);
    }

    if (options.techStack && options.techStack.length > 0) {
      parts.push(`Include questions about: ${options.techStack.join(', ')}.`);
    }

    parts.push('Make questions practical and relevant to real-world scenarios.');

    return parts.join(' ');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: this.cacheConfig.maxSize,
      enabled: this.cacheConfig.enabled,
      ttl: this.cacheConfig.ttl
    };
  }
}

// ===== EXPORTS =====

// Singleton instance
export const questionBankService = new QuestionBankService({
  enabled: true,
  ttl: 3600, // 1 hour cache
  maxSize: 500 // Reasonable size for questions cache
});

// Export templates for backward compatibility
export { MOCK_INTERVIEW_TEMPLATES };
