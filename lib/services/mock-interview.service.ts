/**
 * Mock Interview Generator Service
 * 
 * This service generates dynamic mock interviews using Azure OpenAI,
 * creating unique roles, companies, tech stacks, and questions while
 * avoiding duplicates and implementing memoization for efficiency.
 */

import { AzureOpenAIAdapter } from '@/lib/ai/azureOpenAI';
import { getCompanyLogoForInterview } from '@/lib/utils';
// Interview type is globally available from types/index.d.ts

// Types for generated content
interface GeneratedRole {
  jobTitle: string;
  seniority: 'Junior' | 'Mid-level' | 'Senior' | 'Lead' | 'Principal';
  company: string;
  industry: string;
}

interface GeneratedTechStack {
  technologies: string[];
  primaryFocus: string;
}

interface CachedEntry<T> {
  data: T;
  timestamp: number;
}

// Interview types with weighted distribution
const INTERVIEW_TYPES = [
  { type: 'Technical', weight: 0.33 },
  { type: 'Behavioral', weight: 0.33 },
  { type: 'Mixed', weight: 0.34 }
];

// Cache configuration
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export class MockInterviewService {
  private azureAdapter: AzureOpenAIAdapter;
  private isInitialized = false;
  
  // Memoization caches
  private roleCache = new Map<string, CachedEntry<GeneratedRole>>();
  private techStackCache = new Map<string, CachedEntry<GeneratedTechStack>>();
  private questionsCache = new Map<string, CachedEntry<string[]>>();
  
  // Exclusion lists to avoid duplicates
  private usedRoles = new Set<string>();
  private usedCompanies = new Set<string>();

  constructor() {
    this.azureAdapter = new AzureOpenAIAdapter();
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<boolean> {
    try {
      this.isInitialized = await this.azureAdapter.initialize();
      if (this.isInitialized) {
        console.log('✅ Mock Interview Service initialized');
      }
      return this.isInitialized;
    } catch (error) {
      console.error('❌ Failed to initialize Mock Interview Service:', error);
      return false;
    }
  }

  /**
   * Generate a unique role and company with Azure OpenAI
   */
  async generateUniqueRoleAndCompany(
    excludeRoles?: string[],
    excludeCompanies?: string[]
  ): Promise<GeneratedRole> {
    if (!this.isInitialized) {
      throw new Error('Mock Interview Service not initialized');
    }

    // Combine exclusion lists
    const allExcludedRoles = [...this.usedRoles, ...(excludeRoles || [])];
    const allExcludedCompanies = [...this.usedCompanies, ...(excludeCompanies || [])];

    const prompt = `Generate a unique job interview scenario with the following requirements:

1. Create a realistic job title (NOT generic like "Software Engineer")
2. Assign an appropriate seniority level (Junior, Mid-level, Senior, Lead, or Principal)
3. Create a fictitious but realistic company name (must be creative and unique)
4. Specify the industry sector

IMPORTANT: Avoid these previously used roles: ${allExcludedRoles.join(', ') || 'none'}
IMPORTANT: Avoid these previously used companies: ${allExcludedCompanies.join(', ') || 'none'}

Return ONLY a valid JSON object in this exact format:
{
  "jobTitle": "Example: Cloud Architecture Specialist",
  "seniority": "Senior",
  "company": "Example: TechNova Solutions",
  "industry": "Example: Financial Technology"
}`;

    try {
      // Generate using Azure OpenAI (via adapter's internal method)
      const response = await (this.azureAdapter as any).generateWithAzureOpenAI(
        prompt,
        0.8, // Higher temperature for creativity
        150  // Max tokens for JSON response
      );

      // Parse the JSON response
      const cleanedResponse = response.replace(/```json\n?|\n?```/g, '').trim();
      const generatedRole = JSON.parse(cleanedResponse) as GeneratedRole;

      // Add to exclusion lists
      this.usedRoles.add(generatedRole.jobTitle);
      this.usedCompanies.add(generatedRole.company);

      // Cache the result
      const cacheKey = `${generatedRole.jobTitle}-${generatedRole.company}`;
      this.roleCache.set(cacheKey, {
        data: generatedRole,
        timestamp: Date.now()
      });

      console.log('📋 Generated unique role:', generatedRole);
      return generatedRole;
    } catch (error) {
      console.error('❌ Error generating unique role and company:', error);
      
      // Fallback to predefined options
      return this.getFallbackRole();
    }
  }

  /**
   * Generate relevant tech stack for a given role
   */
  async generateTechStack(role: GeneratedRole): Promise<string[]> {
    if (!this.isInitialized) {
      throw new Error('Mock Interview Service not initialized');
    }

    // Check cache first
    const cacheKey = `${role.jobTitle}-${role.seniority}`;
    const cached = this.techStackCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      console.log('📦 Using cached tech stack for:', cacheKey);
      return cached.data.technologies;
    }

    const prompt = `Based on this job role, generate a relevant technology stack:

Role: ${role.jobTitle}
Seniority: ${role.seniority}
Company: ${role.company}
Industry: ${role.industry}

Generate 4-6 specific technologies that would be relevant for this position.
Consider the seniority level when selecting technologies (e.g., more advanced tools for senior roles).

Return ONLY a valid JSON object in this exact format:
{
  "technologies": ["Tech1", "Tech2", "Tech3", "Tech4"],
  "primaryFocus": "Brief description of the tech focus area"
}`;

    try {
      const response = await (this.azureAdapter as any).generateWithAzureOpenAI(
        prompt,
        0.5, // Moderate temperature for relevant but varied tech
        150  // Max tokens for JSON response
      );

      // Parse the JSON response
      const cleanedResponse = response.replace(/```json\n?|\n?```/g, '').trim();
      const generatedTech = JSON.parse(cleanedResponse) as GeneratedTechStack;

      // Cache the result
      this.techStackCache.set(cacheKey, {
        data: generatedTech,
        timestamp: Date.now()
      });

      console.log('🛠️ Generated tech stack:', generatedTech.technologies);
      return generatedTech.technologies;
    } catch (error) {
      console.error('❌ Error generating tech stack:', error);
      
      // Fallback to common tech stacks based on role
      return this.getFallbackTechStack(role);
    }
  }

  /**
   * Generate interview questions using the existing adapter method
   */
  async generateQuestions(
    role: GeneratedRole,
    type: string,
    techStack: string[]
  ): Promise<string[]> {
    if (!this.isInitialized) {
      throw new Error('Mock Interview Service not initialized');
    }

    // Create cache key
    const cacheKey = `${role.jobTitle}-${type}-${techStack.join(',')}`;
    const cached = this.questionsCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      console.log('📦 Using cached questions for:', cacheKey);
      return cached.data;
    }

    // Create ResumeInfo object for the adapter's generateQuestions method
    const resumeInfo = {
      name: 'Mock Candidate',
      experience: `${role.seniority} ${role.jobTitle} with expertise in ${techStack.slice(0, 3).join(', ')}`,
      education: this.getEducationForSeniority(role.seniority),
      skills: techStack.join(', ')
    };

    try {
      // Use the existing adapter method
      const questions = await this.azureAdapter.generateQuestions(resumeInfo);
      
      // Cache the result
      this.questionsCache.set(cacheKey, {
        data: questions,
        timestamp: Date.now()
      });

      console.log(`❓ Generated ${questions.length} questions for ${type} interview`);
      return questions;
    } catch (error) {
      console.error('❌ Error generating questions:', error);
      
      // Fallback questions based on type
      return this.getFallbackQuestions(type, role);
    }
  }

  /**
   * Main method to create a complete mock interview
   */
  async createMockInterview(userId?: string): Promise<Interview> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Step 1: Generate unique role and company
      const role = await this.generateUniqueRoleAndCompany();
      
      // Step 2: Generate relevant tech stack
      const techStack = await this.generateTechStack(role);
      
      // Step 3: Select interview type (weighted random selection)
      const interviewType = this.selectInterviewType();
      
      // Step 4: Generate questions based on role, type, and tech stack
      const questions = await this.generateQuestions(role, interviewType, techStack);
      
      // Step 5: Generate unique interview ID
      const interviewId = this.generateInterviewId();
      
      // Step 6: Get company logo deterministically based on interview ID
      const { logo, company } = getCompanyLogoForInterview(interviewId);
      
      // Step 7: Create Interview object with company branding
      const interview: Interview = {
        id: interviewId,
        userId: userId || 'mock-user',
        jobTitle: role.jobTitle,
        company: company,
        questions: questions,
        finalized: true, // Mock interviews are pre-finalized
        createdAt: new Date().toISOString(),
        // Legacy properties for backward compatibility
        role: `${role.jobTitle} at ${company}`,
        level: role.seniority,
        type: interviewType,
        techstack: techStack,
        companyLogo: logo,
        companyName: company
      };

      console.log('✨ Created mock interview:', {
        id: interview.id,
        role: interview.role,
        type: interview.type,
        questionCount: interview.questions.length
      });

      return interview;
    } catch (error) {
      console.error('❌ Error creating mock interview:', error);
      throw new Error('Failed to create mock interview');
    }
  }

  /**
   * Select interview type based on weighted distribution
   */
  private selectInterviewType(): string {
    const random = Math.random();
    let cumulativeWeight = 0;
    
    for (const { type, weight } of INTERVIEW_TYPES) {
      cumulativeWeight += weight;
      if (random <= cumulativeWeight) {
        return type;
      }
    }
    
    return 'Mixed'; // Default fallback
  }

  /**
   * Generate unique interview ID
   */
  private generateInterviewId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `mock-${timestamp}-${random}`;
  }

  /**
   * Get education level based on seniority
   */
  private getEducationForSeniority(seniority: string): string {
    const educationMap: Record<string, string> = {
      'Junior': "Bachelor's degree in Computer Science or related field",
      'Mid-level': "Bachelor's degree with 3-5 years experience",
      'Senior': "Bachelor's/Master's degree with 5+ years experience",
      'Lead': "Advanced degree with 7+ years experience",
      'Principal': "Advanced degree with 10+ years experience"
    };
    
    return educationMap[seniority] || "Bachelor's degree in relevant field";
  }

  /**
   * Fallback role generation when API fails
   */
  private getFallbackRole(): GeneratedRole {
    const fallbackRoles: GeneratedRole[] = [
      {
        jobTitle: 'Full Stack Developer',
        seniority: 'Senior',
        company: 'InnovateTech Solutions',
        industry: 'Software Development'
      },
      {
        jobTitle: 'DevOps Engineer',
        seniority: 'Mid-level',
        company: 'CloudScale Systems',
        industry: 'Cloud Infrastructure'
      },
      {
        jobTitle: 'Data Engineer',
        seniority: 'Senior',
        company: 'DataFlow Analytics',
        industry: 'Data Analytics'
      },
      {
        jobTitle: 'Mobile App Developer',
        seniority: 'Mid-level',
        company: 'AppCraft Studios',
        industry: 'Mobile Development'
      },
      {
        jobTitle: 'Machine Learning Engineer',
        seniority: 'Senior',
        company: 'AI Innovations Lab',
        industry: 'Artificial Intelligence'
      }
    ];

    // Select a random fallback role that hasn't been used
    const availableRoles = fallbackRoles.filter(
      r => !this.usedRoles.has(r.jobTitle) && !this.usedCompanies.has(r.company)
    );
    
    if (availableRoles.length === 0) {
      // If all fallbacks are used, return the first one with modified company
      const role = { ...fallbackRoles[0] };
      role.company = `${role.company} ${Date.now() % 1000}`;
      return role;
    }
    
    const selected = availableRoles[Math.floor(Math.random() * availableRoles.length)];
    this.usedRoles.add(selected.jobTitle);
    this.usedCompanies.add(selected.company);
    
    return selected;
  }

  /**
   * Fallback tech stack generation based on role
   */
  private getFallbackTechStack(role: GeneratedRole): string[] {
    const techByRole: Record<string, string[]> = {
      'Full Stack Developer': ['React', 'Node.js', 'MongoDB', 'TypeScript', 'Docker'],
      'DevOps Engineer': ['Kubernetes', 'Docker', 'AWS', 'Terraform', 'Jenkins'],
      'Data Engineer': ['Python', 'Apache Spark', 'SQL', 'Kafka', 'Airflow'],
      'Mobile App Developer': ['React Native', 'TypeScript', 'Redux', 'Firebase', 'GraphQL'],
      'Machine Learning Engineer': ['Python', 'TensorFlow', 'PyTorch', 'Scikit-learn', 'Docker'],
      'Frontend Developer': ['React', 'TypeScript', 'Next.js', 'Tailwind CSS', 'Jest'],
      'Backend Developer': ['Node.js', 'Express', 'PostgreSQL', 'Redis', 'Docker'],
      'Cloud Architect': ['AWS', 'Terraform', 'Kubernetes', 'Python', 'Ansible']
    };

    // Find matching tech stack or return generic one
    for (const [roleKey, tech] of Object.entries(techByRole)) {
      if (role.jobTitle.toLowerCase().includes(roleKey.toLowerCase())) {
        return tech.slice(0, 5); // Return 5 technologies
      }
    }

    // Generic fallback
    return ['JavaScript', 'Python', 'Docker', 'Git', 'SQL'];
  }

  /**
   * Fallback questions generation
   */
  private getFallbackQuestions(type: string, role: GeneratedRole): string[] {
    const questionsByType: Record<string, string[]> = {
      'Technical': [
        `Can you explain your experience with the technologies listed in the ${role.jobTitle} job description?`,
        'Describe a complex technical problem you solved recently. What was your approach?',
        'How do you ensure code quality and maintainability in your projects?',
        'What is your approach to system design and architecture decisions?',
        'Can you walk me through your debugging process when facing a difficult issue?'
      ],
      'Behavioral': [
        'Tell me about a time when you had to work with a difficult team member.',
        'Describe a situation where you had to meet a tight deadline. How did you manage it?',
        'Give an example of when you had to learn a new technology quickly.',
        'How do you handle constructive criticism and feedback?',
        'Tell me about a project you\'re particularly proud of. What was your role?'
      ],
      'Mixed': [
        `What interests you most about the ${role.jobTitle} position at ${role.company}?`,
        'How do you stay updated with the latest technology trends in your field?',
        'Describe your ideal work environment and team structure.',
        'What are your career goals for the next 3-5 years?',
        'How do you balance technical excellence with meeting business deadlines?'
      ]
    };

    return questionsByType[type] || questionsByType['Mixed'];
  }

  /**
   * Clear caches (useful for testing or memory management)
   */
  clearCaches(): void {
    this.roleCache.clear();
    this.techStackCache.clear();
    this.questionsCache.clear();
    this.usedRoles.clear();
    this.usedCompanies.clear();
    console.log('🧹 Mock Interview Service caches cleared');
  }

  /**
   * Clean expired cache entries
   */
  cleanExpiredCache(): void {
    const now = Date.now();
    
    // Clean role cache
    for (const [key, entry] of this.roleCache.entries()) {
      if (now - entry.timestamp > CACHE_DURATION) {
        this.roleCache.delete(key);
      }
    }
    
    // Clean tech stack cache
    for (const [key, entry] of this.techStackCache.entries()) {
      if (now - entry.timestamp > CACHE_DURATION) {
        this.techStackCache.delete(key);
      }
    }
    
    // Clean questions cache
    for (const [key, entry] of this.questionsCache.entries()) {
      if (now - entry.timestamp > CACHE_DURATION) {
        this.questionsCache.delete(key);
      }
    }
    
    console.log('🧹 Expired cache entries cleaned');
  }

  /**
   * Get cache statistics (useful for monitoring)
   */
  getCacheStats(): {
    rolesCached: number;
    techStacksCached: number;
    questionsCached: number;
    usedRolesCount: number;
    usedCompaniesCount: number;
  } {
    return {
      rolesCached: this.roleCache.size,
      techStacksCached: this.techStackCache.size,
      questionsCached: this.questionsCache.size,
      usedRolesCount: this.usedRoles.size,
      usedCompaniesCount: this.usedCompanies.size
    };
  }
}

// Export singleton instance
export const mockInterviewService = new MockInterviewService();

// Export the main creation function for convenience
export async function createMockInterview(userId?: string): Promise<Interview> {
  return mockInterviewService.createMockInterview(userId);
}
