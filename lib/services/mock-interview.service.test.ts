/**
 * Unit tests for Mock Interview Service
 * Tests cover:
 * - No duplicate titles in batch of 10 interviews
 * - All required fields are present in generated interviews
 * - Question array length is at least 5
 */

import { MockInterviewService } from './mock-interview.service';
import { Interview } from '@/types';

// Mock the Azure OpenAI Adapter
jest.mock('@/lib/ai/azureOpenAI', () => ({
  AzureOpenAIAdapter: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(true),
    generateQuestions: jest.fn().mockImplementation((resumeInfo) => {
      // Generate 5-8 unique questions based on resume info
      const baseQuestions = [
        'Tell me about your experience with the technologies mentioned in your resume.',
        'How do you approach problem-solving in your current role?',
        'Describe a challenging project you worked on recently.',
        'What are your thoughts on best practices for code quality?',
        'How do you stay updated with the latest technology trends?',
        'Can you explain a complex technical concept to a non-technical person?',
        'What motivates you in your career?',
        'How do you handle tight deadlines and pressure?'
      ];
      return Promise.resolve(baseQuestions.slice(0, 5 + Math.floor(Math.random() * 4)));
    }),
    generateWithAzureOpenAI: jest.fn().mockImplementation((prompt, temperature, maxTokens) => {
      // Mock responses based on prompt content
      if (prompt.includes('unique job interview scenario')) {
        // Generate unique role and company
        const roles = [
          { jobTitle: 'Cloud Solutions Architect', seniority: 'Senior', company: 'TechVision Labs', industry: 'Cloud Computing' },
          { jobTitle: 'DevOps Lead Engineer', seniority: 'Lead', company: 'DataStream Solutions', industry: 'Data Infrastructure' },
          { jobTitle: 'Full Stack Software Engineer', seniority: 'Mid-level', company: 'InnovateTech Corp', industry: 'Software Development' },
          { jobTitle: 'Machine Learning Engineer', seniority: 'Senior', company: 'AI Dynamics', industry: 'Artificial Intelligence' },
          { jobTitle: 'Mobile Development Specialist', seniority: 'Senior', company: 'AppCraft Studios', industry: 'Mobile Technology' },
          { jobTitle: 'Backend Systems Engineer', seniority: 'Principal', company: 'ScaleUp Systems', industry: 'Enterprise Software' },
          { jobTitle: 'Frontend UI Developer', seniority: 'Mid-level', company: 'DesignFlow Inc', industry: 'Web Development' },
          { jobTitle: 'Data Platform Engineer', seniority: 'Senior', company: 'DataBridge Analytics', industry: 'Data Analytics' },
          { jobTitle: 'Security Software Engineer', seniority: 'Lead', company: 'CyberGuard Tech', industry: 'Cybersecurity' },
          { jobTitle: 'Platform Reliability Engineer', seniority: 'Senior', company: 'ReliaTech Systems', industry: 'Infrastructure' }
        ];
        
        // Get a random role that hasn't been used (tracked by the service)
        const randomIndex = Math.floor(Math.random() * roles.length);
        return Promise.resolve(JSON.stringify(roles[randomIndex]));
      }
      
      if (prompt.includes('generate a relevant technology stack')) {
        // Generate tech stack
        const techStacks = {
          'Cloud Solutions Architect': ['AWS', 'Terraform', 'Kubernetes', 'Python', 'Docker'],
          'DevOps Lead Engineer': ['Jenkins', 'GitLab CI', 'Docker', 'Ansible', 'Prometheus'],
          'Full Stack Software Engineer': ['React', 'Node.js', 'PostgreSQL', 'Redis', 'TypeScript'],
          'Machine Learning Engineer': ['Python', 'TensorFlow', 'PyTorch', 'Scikit-learn', 'Apache Spark'],
          'Mobile Development Specialist': ['React Native', 'Swift', 'Kotlin', 'Firebase', 'GraphQL'],
          'Backend Systems Engineer': ['Java', 'Spring Boot', 'Kafka', 'Cassandra', 'Elasticsearch'],
          'Frontend UI Developer': ['Vue.js', 'TypeScript', 'Tailwind CSS', 'Webpack', 'Jest'],
          'Data Platform Engineer': ['Apache Spark', 'Airflow', 'Databricks', 'Python', 'SQL'],
          'Security Software Engineer': ['Go', 'Python', 'OWASP', 'Kubernetes', 'HashiCorp Vault'],
          'Platform Reliability Engineer': ['Kubernetes', 'Prometheus', 'Grafana', 'Go', 'Terraform']
        };
        
        // Try to match based on role in prompt
        for (const [role, stack] of Object.entries(techStacks)) {
          if (prompt.includes(role)) {
            return Promise.resolve(JSON.stringify({
              technologies: stack,
              primaryFocus: `${role} technologies and best practices`
            }));
          }
        }
        
        // Default tech stack
        return Promise.resolve(JSON.stringify({
          technologies: ['JavaScript', 'Python', 'Docker', 'Git', 'PostgreSQL'],
          primaryFocus: 'Full-stack development'
        }));
      }
      
      return Promise.resolve('{}');
    })
  }))
}));

// Mock getCompanyLogoForInterview utility
jest.mock('@/lib/utils', () => ({
  getCompanyLogoForInterview: jest.fn((interviewId) => ({
    logo: `/logos/company-${interviewId}.png`,
    company: 'Mock Company'
  }))
}));

describe('MockInterviewService', () => {
  let service: MockInterviewService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MockInterviewService();
    // Clear any caches and used lists
    service.clearCaches();
  });

  describe('Initialization', () => {
    it('should initialize the service successfully', async () => {
      const result = await service.initialize();
      expect(result).toBe(true);
    });

    it('should handle initialization errors gracefully', async () => {
      const mockAdapter = require('@/lib/ai/azureOpenAI').AzureOpenAIAdapter;
      mockAdapter.mockImplementationOnce(() => ({
        initialize: jest.fn().mockRejectedValue(new Error('Initialization failed'))
      }));
      
      const errorService = new MockInterviewService();
      const result = await errorService.initialize();
      expect(result).toBe(false);
    });
  });

  describe('Interview Generation', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should generate an interview with all required fields', async () => {
      const interview = await service.createMockInterview('test-user-123');

      // Check all required fields are present
      expect(interview).toHaveProperty('id');
      expect(interview).toHaveProperty('userId');
      expect(interview).toHaveProperty('role');
      expect(interview).toHaveProperty('level');
      expect(interview).toHaveProperty('type');
      expect(interview).toHaveProperty('techstack');
      expect(interview).toHaveProperty('questions');
      expect(interview).toHaveProperty('finalized');
      expect(interview).toHaveProperty('createdAt');
      expect(interview).toHaveProperty('companyLogo');
      expect(interview).toHaveProperty('companyName');

      // Validate field types
      expect(typeof interview.id).toBe('string');
      expect(interview.userId).toBe('test-user-123');
      expect(typeof interview.role).toBe('string');
      expect(typeof interview.level).toBe('string');
      expect(typeof interview.type).toBe('string');
      expect(Array.isArray(interview.techstack)).toBe(true);
      expect(Array.isArray(interview.questions)).toBe(true);
      expect(interview.finalized).toBe(true);
      expect(typeof interview.createdAt).toBe('string');
      expect(typeof interview.companyLogo).toBe('string');
      expect(typeof interview.companyName).toBe('string');

      // Validate that role includes company name
      expect(interview.role).toMatch(/at/);
    });

    it('should generate interviews with at least 5 questions', async () => {
      const interviews: Interview[] = [];
      
      // Generate 10 interviews
      for (let i = 0; i < 10; i++) {
        const interview = await service.createMockInterview(`user-${i}`);
        interviews.push(interview);
      }

      // Check that all interviews have at least 5 questions
      interviews.forEach((interview, index) => {
        expect(interview.questions.length).toBeGreaterThanOrEqual(5);
        expect(interview.questions.length).toBeLessThanOrEqual(8); // Based on our mock
        
        // Verify questions are strings and not empty
        interview.questions.forEach((question: any) => {
          expect(typeof question).toBe('string');
          expect(question.length).toBeGreaterThan(0);
        });
      });
    });

    it('should not generate duplicate job titles in a batch of 10 interviews', async () => {
      const interviews: Interview[] = [];
      const jobTitles = new Set<string>();

      // Generate 10 interviews
      for (let i = 0; i < 10; i++) {
        const interview = await service.createMockInterview(`user-${i}`);
        interviews.push(interview);
        
        // Extract job title from role (format: "JobTitle at Company")
        const jobTitle = interview.role?.split(' at ')[0];
        jobTitles.add(jobTitle);
      }

      // Check that we have 10 unique job titles
      expect(jobTitles.size).toBe(10);
      
      // Additional check: no two interviews should have the exact same role
      const roles = interviews.map(i => i.role);
      const uniqueRoles = new Set(roles);
      expect(uniqueRoles.size).toBe(10);
    });

    it('should generate appropriate tech stacks for each role', async () => {
      const interview = await service.createMockInterview('test-user');
      
      // Tech stack should be an array with 4-6 technologies
      expect(Array.isArray(interview.techstack)).toBe(true);
      expect(interview.techstack).toBeDefined();
      if (Array.isArray(interview.techstack)) {
        expect(interview.techstack.length).toBeGreaterThanOrEqual(4);
        expect(interview.techstack.length).toBeLessThanOrEqual(6);
      }
      
      // Each technology should be a non-empty string
      interview.techstack?.forEach((tech: any) => {
        expect(typeof tech).toBe('string');
        expect(tech.length).toBeGreaterThan(0);
      });
    });

    it('should select interview types with proper distribution', async () => {
      const typeCounts = { Technical: 0, Behavioral: 0, Mixed: 0 };
      
      // Generate 30 interviews to test distribution
      for (let i = 0; i < 30; i++) {
        const interview = await service.createMockInterview(`user-${i}`);
        typeCounts[interview.type as keyof typeof typeCounts]++;
      }
      
      // Each type should appear at least once in 30 interviews
      expect(typeCounts.Technical).toBeGreaterThan(0);
      expect(typeCounts.Behavioral).toBeGreaterThan(0);
      expect(typeCounts.Mixed).toBeGreaterThan(0);
      
      // Check that the distribution is roughly balanced (within reasonable variance)
      // Expected: ~10 each with some variance
      Object.values(typeCounts).forEach(count => {
        expect(count).toBeGreaterThanOrEqual(5);
        expect(count).toBeLessThanOrEqual(15);
      });
    });

    it('should handle defaulting to mock user when no userId provided', async () => {
      const interview = await service.createMockInterview();
      expect(interview.userId).toBe('mock-user');
    });

    it('should generate unique interview IDs', async () => {
      const ids = new Set<string>();
      
      for (let i = 0; i < 10; i++) {
        const interview = await service.createMockInterview();
        ids.add(interview.id);
      }
      
      // All IDs should be unique
      expect(ids.size).toBe(10);
      
      // IDs should follow the expected format
      ids.forEach(id => {
        expect(id).toMatch(/^mock-\d+-[a-z0-9]+$/);
      });
    });

    it('should set correct seniority levels', async () => {
      const validSeniorities = ['Junior', 'Mid-level', 'Senior', 'Lead', 'Principal'];
      const interviews: Interview[] = [];
      
      for (let i = 0; i < 10; i++) {
        const interview = await service.createMockInterview(`user-${i}`);
        interviews.push(interview);
      }
      
      interviews.forEach(interview => {
        expect(validSeniorities).toContain(interview.level);
      });
    });

    it('should properly format createdAt timestamp', async () => {
      const before = new Date().toISOString();
      const interview = await service.createMockInterview();
      const after = new Date().toISOString();
      
      // Timestamp should be in ISO format
      expect(interview.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      
      // Timestamp should be between before and after
      expect(new Date(interview.createdAt).getTime()).toBeGreaterThanOrEqual(new Date(before).getTime());
      expect(new Date(interview.createdAt).getTime()).toBeLessThanOrEqual(new Date(after).getTime());
    });
  });

  describe('Cache Management', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should maintain cache statistics', async () => {
      // Generate a few interviews
      await service.createMockInterview('user-1');
      await service.createMockInterview('user-2');
      
      const stats = service.getCacheStats();
      
      expect(stats).toHaveProperty('rolesCached');
      expect(stats).toHaveProperty('techStacksCached');
      expect(stats).toHaveProperty('questionsCached');
      expect(stats).toHaveProperty('usedRolesCount');
      expect(stats).toHaveProperty('usedCompaniesCount');
      
      // Should have some cached data
      expect(stats.usedRolesCount).toBeGreaterThan(0);
      expect(stats.usedCompaniesCount).toBeGreaterThan(0);
    });

    it('should clear caches when requested', async () => {
      // Generate some interviews to populate cache
      await service.createMockInterview('user-1');
      await service.createMockInterview('user-2');
      
      // Get initial stats
      const statsBefore = service.getCacheStats();
      expect(statsBefore.usedRolesCount).toBeGreaterThan(0);
      
      // Clear caches
      service.clearCaches();
      
      // Verify caches are cleared
      const statsAfter = service.getCacheStats();
      expect(statsAfter.rolesCached).toBe(0);
      expect(statsAfter.techStacksCached).toBe(0);
      expect(statsAfter.questionsCached).toBe(0);
      expect(statsAfter.usedRolesCount).toBe(0);
      expect(statsAfter.usedCompaniesCount).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle API failures with fallback data', async () => {
      // Mock a failure in the Azure OpenAI adapter
      const mockAdapter = require('@/lib/ai/azureOpenAI').AzureOpenAIAdapter;
      mockAdapter.mockImplementationOnce(() => ({
        initialize: jest.fn().mockResolvedValue(true),
        generateQuestions: jest.fn().mockRejectedValue(new Error('API Error')),
        generateWithAzureOpenAI: jest.fn().mockRejectedValue(new Error('API Error'))
      }));
      
      const errorService = new MockInterviewService();
      await errorService.initialize();
      
      // Should still generate an interview using fallback data
      const interview = await errorService.createMockInterview('test-user');
      
      expect(interview).toHaveProperty('id');
      expect(interview).toHaveProperty('role');
      expect(interview).toHaveProperty('questions');
      expect(interview.questions.length).toBeGreaterThanOrEqual(5);
    });

    it('should throw error when service is not initialized', async () => {
      const uninitializedService = new MockInterviewService();
      
      await expect(uninitializedService.createMockInterview()).rejects.toThrow();
    });
  });

  describe('Unique Role and Company Generation', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should respect exclusion lists when generating roles', async () => {
      const excludeRoles = ['Software Engineer', 'Product Manager'];
      const excludeCompanies = ['TechCorp', 'DataInc'];
      
      const role = await service.generateUniqueRoleAndCompany(excludeRoles, excludeCompanies);
      
      expect(excludeRoles).not.toContain(role.jobTitle);
      expect(excludeCompanies).not.toContain(role.company);
    });

    it('should track and avoid previously generated roles', async () => {
      const roles: string[] = [];
      const companies: string[] = [];
      
      // Generate multiple roles
      for (let i = 0; i < 5; i++) {
        const role = await service.generateUniqueRoleAndCompany();
        roles.push(role.jobTitle);
        companies.push(role.company);
      }
      
      // Check uniqueness
      const uniqueRoles = new Set(roles);
      const uniqueCompanies = new Set(companies);
      
      expect(uniqueRoles.size).toBe(5);
      expect(uniqueCompanies.size).toBe(5);
    });
  });
});
