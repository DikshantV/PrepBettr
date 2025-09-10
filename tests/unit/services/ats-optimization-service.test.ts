/**
 * Unit Tests for ATS Optimization Service
 * 
 * Tests the ATS optimization functionality including:
 * - ATS scoring and analysis
 * - Job matching with semantic similarity
 * - Skills normalization using industry taxonomies
 * - Keyword density calculation
 * - Recommendations generation
 */

import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { atsOptimizationService } from '@/lib/services/ats-optimization-service';

// Mock Azure OpenAI service
jest.mock('@/azure/lib/services/azure-openai-service', () => ({
  azureOpenAIService: {
    getClient: jest.fn().mockResolvedValue({
      chat: {
        completions: {
          create: jest.fn()
        }
      },
      embeddings: {
        create: jest.fn()
      }
    })
  }
}));

// Mock OpenAI
jest.mock('openai', () => {
  return {
    OpenAI: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn()
        }
      },
      embeddings: {
        create: jest.fn()
      }
    }))
  };
});

describe('ATSOptimizationService', () => {
  // Sample resume data for testing
  const sampleResumeData = {
    personalInfo: {
      name: 'John Doe',
      email: 'john.doe@example.com',
      phone: '+1-555-123-4567',
      location: 'San Francisco, CA'
    },
    summary: 'Senior Software Engineer with 5+ years of experience in full-stack development.',
    skills: [
      { skill: 'JavaScript', category: 'technical', proficiency: 'advanced', yearsOfExperience: 5 },
      { skill: 'React', category: 'technical', proficiency: 'advanced', yearsOfExperience: 4 },
      { skill: 'Node.js', category: 'technical', proficiency: 'intermediate', yearsOfExperience: 3 },
      { skill: 'Python', category: 'technical', proficiency: 'intermediate', yearsOfExperience: 2 },
      { skill: 'Leadership', category: 'soft', proficiency: 'advanced', yearsOfExperience: 3 }
    ],
    experience: [
      {
        company: 'Tech Corp',
        position: 'Senior Software Engineer',
        startDate: '2020-01',
        endDate: 'Present',
        isCurrent: true,
        description: 'Led development of microservices architecture using React and Node.js',
        achievements: [
          'Improved application performance by 40%',
          'Led a team of 5 developers',
          'Implemented CI/CD pipeline reducing deployment time by 60%'
        ],
        technologies: ['React', 'Node.js', 'PostgreSQL', 'Docker', 'AWS'],
        managementScope: {
          teamSize: 5,
          budget: '$2M',
          responsibilities: ['Technical architecture', 'Team leadership', 'Project delivery']
        }
      }
    ],
    education: [
      {
        institution: 'Stanford University',
        degree: 'Bachelor of Science',
        field: 'Computer Science',
        startDate: '2015',
        endDate: '2019',
        gpa: 3.8
      }
    ]
  };

  const sampleJobDescription = `
    We are seeking a Senior Full-Stack Developer to join our team. The ideal candidate will have:
    
    Requirements:
    - 5+ years of experience in JavaScript and TypeScript
    - Expert knowledge of React and modern frontend frameworks
    - Experience with Node.js and backend development
    - Familiarity with Docker and Kubernetes
    - Experience with cloud platforms (AWS, Azure)
    - Strong communication and leadership skills
    - Bachelor's degree in Computer Science or related field
    
    Responsibilities:
    - Design and develop scalable web applications
    - Lead technical initiatives and mentor junior developers
    - Collaborate with product and design teams
    - Implement best practices for code quality and testing
    
    Preferred:
    - Experience with GraphQL
    - Knowledge of microservices architecture
    - DevOps experience with CI/CD pipelines
  `;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('analyzeATS', () => {
    it('should perform ATS analysis without job description', async () => {
      // Mock the AI response
      const mockATSAnalysis = {
        atsScore: 82,
        overallGrade: 'B+',
        analysis: {
          keywordAnalysis: {
            score: 78,
            totalKeywords: 25,
            matchedKeywords: ['JavaScript', 'React', 'Node.js', 'Leadership'],
            missingKeywords: ['TypeScript', 'Docker', 'Kubernetes'],
            keywordDensity: 0.7,
            recommendations: ['Add more technical keywords', 'Include cloud platform experience']
          },
          formatAnalysis: {
            score: 90,
            issues: [],
            strengths: ['Clear section headers', 'Consistent formatting', 'Quantifiable achievements']
          },
          structureAnalysis: {
            score: 85,
            missingElements: ['Certifications'],
            presentElements: ['Contact info', 'Work experience', 'Education', 'Skills'],
            recommendations: ['Consider adding relevant certifications']
          },
          contentAnalysis: {
            score: 80,
            strengthAreas: ['Strong quantifiable achievements', 'Relevant technical experience'],
            improvementAreas: ['Limited cloud platform mentions', 'No certifications'],
            recommendations: ['Highlight cloud platform experience', 'Include relevant certifications']
          }
        },
        prioritizedRecommendations: [
          {
            priority: 'high' as const,
            category: 'keywords' as const,
            recommendation: 'Add TypeScript to technical skills',
            implementation: 'Include TypeScript in skills section with proficiency level',
            expectedImpact: 'Improve keyword matching for modern development roles',
            timeToImplement: '5 minutes'
          }
        ]
      };

      // Mock the Azure OpenAI service
      const mockOpenAIClient = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{ message: { content: JSON.stringify(mockATSAnalysis) } }]
            })
          }
        }
      };

      const { azureOpenAIService } = await import('@/azure/lib/services/azure-openai-service');
      (azureOpenAIService.getClient as jest.Mock).mockResolvedValue(mockOpenAIClient);

      const result = await atsOptimizationService.analyzeATS(sampleResumeData);

      expect(result).toBeDefined();
      expect(result.atsScore).toBe(82);
      expect(result.overallGrade).toBe('B+');
      expect(result.analysis).toBeDefined();
      expect(result.analysis.keywordAnalysis.matchedKeywords).toContain('JavaScript');
      expect(result.analysis.keywordAnalysis.matchedKeywords).toContain('React');
      expect(result.prioritizedRecommendations).toBeDefined();
      expect(result.prioritizedRecommendations.length).toBeGreaterThan(0);
    });

    it('should perform enhanced ATS analysis with job description', async () => {
      const mockATSAnalysis = {
        atsScore: 88,
        overallGrade: 'A-',
        analysis: {
          keywordAnalysis: {
            score: 85,
            totalKeywords: 30,
            matchedKeywords: ['JavaScript', 'React', 'Node.js', 'Leadership', 'AWS'],
            missingKeywords: ['TypeScript', 'Docker', 'Kubernetes', 'GraphQL'],
            keywordDensity: 0.8,
            recommendations: ['Add TypeScript experience', 'Include Docker/Kubernetes knowledge']
          },
          formatAnalysis: {
            score: 92,
            issues: [],
            strengths: ['Professional formatting', 'ATS-friendly structure']
          },
          structureAnalysis: {
            score: 88,
            missingElements: ['Certifications'],
            presentElements: ['All required sections present'],
            recommendations: ['Add AWS or other cloud certifications']
          },
          contentAnalysis: {
            score: 86,
            strengthAreas: ['Strong technical background', 'Leadership experience', 'Quantifiable results'],
            improvementAreas: ['Missing some preferred technologies'],
            recommendations: ['Highlight Docker and Kubernetes exposure', 'Add GraphQL experience']
          }
        },
        prioritizedRecommendations: [
          {
            priority: 'high' as const,
            category: 'keywords' as const,
            recommendation: 'Add Docker and Kubernetes experience',
            implementation: 'Include containerization technologies in skills and experience',
            expectedImpact: 'Better alignment with modern DevOps requirements',
            timeToImplement: '30 minutes'
          }
        ]
      };

      const mockOpenAIClient = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{ message: { content: JSON.stringify(mockATSAnalysis) } }]
            })
          }
        }
      };

      const { azureOpenAIService } = await import('@/azure/lib/services/azure-openai-service');
      (azureOpenAIService.getClient as jest.Mock).mockResolvedValue(mockOpenAIClient);

      const result = await atsOptimizationService.analyzeATS(
        sampleResumeData, 
        sampleJobDescription, 
        'technology'
      );

      expect(result.atsScore).toBe(88);
      expect(result.analysis.keywordAnalysis.missingKeywords).toContain('TypeScript');
      expect(result.analysis.keywordAnalysis.missingKeywords).toContain('Docker');
    });
  });

  describe('analyzeJobMatch', () => {
    it('should perform job matching analysis', async () => {
      const mockJobMatchResult = {
        overallMatchScore: 78,
        matchGrade: 'B+',
        analysis: {
          skillsMatch: {
            score: 82,
            matchedSkills: [
              {
                skill: 'JavaScript',
                resumeLevel: 'advanced',
                requiredLevel: 'intermediate',
                match: 'exceeds' as const
              },
              {
                skill: 'React',
                resumeLevel: 'advanced', 
                requiredLevel: 'advanced',
                match: 'meets' as const
              }
            ],
            missingSkills: [
              {
                skill: 'Docker',
                importance: 'high' as const,
                canLearn: true,
                timeToLearn: '2-4 weeks'
              },
              {
                skill: 'Kubernetes',
                importance: 'medium' as const,
                canLearn: true,
                timeToLearn: '1-2 months'
              }
            ],
            skillGapAnalysis: {
              criticalGaps: ['Docker', 'Kubernetes'],
              niceToHaveGaps: ['GraphQL', 'TypeScript'],
              strengthAreas: ['Frontend development', 'Team leadership']
            }
          },
          experienceMatch: {
            score: 85,
            yearsRequired: 5,
            yearsCandidate: 5,
            yearsMatch: 'meets' as const,
            industryMatch: {
              score: 90,
              relevantIndustries: ['Technology', 'Software'],
              transferableExperience: ['Team leadership', 'Full-stack development']
            },
            roleSimilarity: {
              score: 88,
              similarRoles: ['Senior Software Engineer', 'Full-Stack Developer'],
              levelMatch: 'appropriate'
            }
          },
          educationMatch: {
            score: 95,
            degreeMatch: true,
            fieldRelevance: 'high' as const,
            institutionPrestige: 'excellent',
            additionalQualifications: []
          },
          culturalFit: {
            score: 72,
            indicators: ['Team leadership experience', 'Collaboration skills'],
            concerns: ['Limited product team experience'],
            strengths: ['Strong technical leadership', 'Mentoring background']
          }
        },
        recommendations: [
          {
            category: 'skills' as const,
            priority: 'high' as const,
            recommendation: 'Learn Docker containerization',
            reasoning: 'Critical for modern DevOps practices',
            resources: ['Docker documentation', 'Online courses'],
            timeframe: '2-4 weeks'
          }
        ],
        interviewPreparation: [
          'Be ready to discuss containerization strategy',
          'Highlight team leadership achievements',
          'Prepare examples of scalable architecture design'
        ],
        missingKeywords: ['Docker', 'Kubernetes', 'TypeScript', 'GraphQL']
      };

      // Mock embeddings for semantic similarity
      const mockEmbeddings = {
        data: [{ embedding: new Array(1536).fill(0.1) }]
      };

      const mockOpenAIClient = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{ message: { content: JSON.stringify(mockJobMatchResult) } }]
            })
          }
        },
        embeddings: {
          create: jest.fn().mockResolvedValue(mockEmbeddings)
        }
      };

      const { azureOpenAIService } = await import('@/azure/lib/services/azure-openai-service');
      (azureOpenAIService.getClient as jest.Mock).mockResolvedValue(mockOpenAIClient);

      const result = await atsOptimizationService.analyzeJobMatch(
        sampleResumeData,
        sampleJobDescription,
        'Senior Full-Stack Developer',
        'senior'
      );

      expect(result).toBeDefined();
      expect(result.overallMatchScore).toBeGreaterThanOrEqual(70); // Should be enhanced with semantic similarity
      expect(result.matchGrade).toBe('B+');
      expect(result.analysis.skillsMatch.matchedSkills.length).toBeGreaterThan(0);
      expect(result.analysis.skillsMatch.missingSkills.length).toBeGreaterThan(0);
      expect(result.missingKeywords).toContain('Docker');
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.interviewPreparation.length).toBeGreaterThan(0);
    });
  });

  describe('normalizeSkills', () => {
    it('should normalize skills using industry taxonomies', async () => {
      const mockSkillsNormalization = {
        normalizedSkills: [
          {
            originalSkill: 'React',
            normalizedSkill: 'React (JavaScript Framework)',
            category: 'Frontend Development',
            subcategory: 'JavaScript Frameworks',
            proficiencyLevel: 'advanced' as const,
            industryStandard: true,
            frameworks: {
              sfia: 'PROG - Programming/Software Development - Level 5',
              onet: '15-1252.00 - Software Developers, Applications',
              esco: '2512.1 - Software developers'
            },
            relatedSkills: ['JavaScript', 'TypeScript', 'Redux', 'Next.js'],
            marketDemand: 'high' as const,
            salaryImpact: 'positive' as const,
            learningPath: ['JavaScript fundamentals', 'React basics', 'Advanced React patterns']
          },
          {
            originalSkill: 'Node.js',
            normalizedSkill: 'Node.js (Runtime Environment)',
            category: 'Backend Development',
            subcategory: 'Runtime Environments',
            proficiencyLevel: 'intermediate' as const,
            industryStandard: true,
            frameworks: {
              sfia: 'PROG - Programming/Software Development - Level 4',
              onet: '15-1252.00 - Software Developers, Applications',
              esco: '2512.1 - Software developers'
            },
            relatedSkills: ['JavaScript', 'Express.js', 'npm', 'REST APIs'],
            marketDemand: 'high' as const,
            salaryImpact: 'positive' as const,
            learningPath: ['JavaScript basics', 'Node.js fundamentals', 'Express.js', 'Async programming']
          }
        ],
        skillCategories: {
          technical: ['React', 'Node.js', 'JavaScript', 'Python'],
          soft: ['Leadership'],
          language: [],
          certification: [],
          tool: []
        },
        industryAlignment: {
          score: 85,
          wellAlignedSkills: ['React', 'Node.js', 'JavaScript'],
          missingIndustrySkills: ['Docker', 'Kubernetes', 'TypeScript'],
          emergingSkills: ['GraphQL', 'Serverless', 'Microservices'],
          recommendations: [
            'Consider learning containerization technologies (Docker/Kubernetes)',
            'Add TypeScript for better code maintainability',
            'Explore GraphQL for modern API development'
          ]
        }
      };

      const mockOpenAIClient = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{ message: { content: JSON.stringify(mockSkillsNormalization) } }]
            })
          }
        }
      };

      const { azureOpenAIService } = await import('@/azure/lib/services/azure-openai-service');
      (azureOpenAIService.getClient as jest.Mock).mockResolvedValue(mockOpenAIClient);

      const skills = ['React', 'Node.js', 'JavaScript', 'Python', 'Leadership'];
      const result = await atsOptimizationService.normalizeSkills(
        skills,
        'technology',
        'senior'
      );

      expect(result).toBeDefined();
      expect(result.normalizedSkills.length).toBeGreaterThan(0);
      expect(result.normalizedSkills[0].originalSkill).toBe('React');
      expect(result.normalizedSkills[0].normalizedSkill).toBe('React (JavaScript Framework)');
      expect(result.normalizedSkills[0].industryStandard).toBe(true);
      expect(result.skillCategories.technical).toContain('React');
      expect(result.industryAlignment.score).toBeGreaterThanOrEqual(80);
    });
  });

  describe('calculateKeywordDensity', () => {
    it('should calculate keyword density correctly', async () => {
      const resumeText = `
        John Doe is a Senior Software Engineer with extensive experience in JavaScript, React, and Node.js.
        He has worked on multiple projects using React and JavaScript frameworks.
        His expertise includes full-stack development with Node.js and React applications.
      `;
      
      const targetKeywords = ['JavaScript', 'React', 'Node.js', 'Python', 'Docker'];
      
      const result = await atsOptimizationService.calculateKeywordDensity(resumeText, targetKeywords);
      
      expect(result.density).toBeGreaterThan(0);
      expect(result.matches).toContain('JavaScript');
      expect(result.matches).toContain('React');
      expect(result.matches).toContain('Node.js');
      expect(result.missing).toContain('Python');
      expect(result.missing).toContain('Docker');
    });

    it('should handle multi-word keywords correctly', async () => {
      const resumeText = `
        Experience with machine learning algorithms and artificial intelligence.
        Proficient in software engineering and web development practices.
      `;
      
      const targetKeywords = ['machine learning', 'artificial intelligence', 'software engineering', 'data science'];
      
      const result = await atsOptimizationService.calculateKeywordDensity(resumeText, targetKeywords);
      
      expect(result.matches).toContain('machine learning');
      expect(result.matches).toContain('artificial intelligence');
      expect(result.matches).toContain('software engineering');
      expect(result.missing).toContain('data science');
    });
  });

  describe('error handling', () => {
    it('should handle API errors gracefully in ATS analysis', async () => {
      const mockOpenAIClient = {
        chat: {
          completions: {
            create: jest.fn().mockRejectedValue(new Error('API Error'))
          }
        }
      };

      const { azureOpenAIService } = await import('@/azure/lib/services/azure-openai-service');
      (azureOpenAIService.getClient as jest.Mock).mockResolvedValue(mockOpenAIClient);

      await expect(
        atsOptimizationService.analyzeATS(sampleResumeData)
      ).rejects.toThrow('ATS analysis failed');
    });

    it('should handle invalid JSON responses gracefully', async () => {
      const mockOpenAIClient = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{ message: { content: 'Invalid JSON response' } }]
            })
          }
        }
      };

      const { azureOpenAIService } = await import('@/azure/lib/services/azure-openai-service');
      (azureOpenAIService.getClient as jest.Mock).mockResolvedValue(mockOpenAIClient);

      await expect(
        atsOptimizationService.analyzeATS(sampleResumeData)
      ).rejects.toThrow('ATS analysis failed');
    });

    it('should fallback to OpenAI when Azure OpenAI is not available', async () => {
      const { azureOpenAIService } = await import('@/azure/lib/services/azure-openai-service');
      (azureOpenAIService.getClient as jest.Mock).mockRejectedValue(new Error('Azure OpenAI not available'));

      // Set up OpenAI API key for fallback
      process.env.OPENAI_API_KEY = 'test-key';

      const mockATSAnalysis = {
        atsScore: 80,
        overallGrade: 'B',
        analysis: {
          keywordAnalysis: {
            score: 75,
            totalKeywords: 20,
            matchedKeywords: ['JavaScript'],
            missingKeywords: ['Docker'],
            keywordDensity: 0.6,
            recommendations: []
          },
          formatAnalysis: { score: 85, issues: [], strengths: [] },
          structureAnalysis: { score: 80, missingElements: [], presentElements: [], recommendations: [] },
          contentAnalysis: { score: 75, strengthAreas: [], improvementAreas: [], recommendations: [] }
        },
        prioritizedRecommendations: []
      };

      // Mock the OpenAI constructor
      const { OpenAI } = await import('openai');
      const mockOpenAIInstance = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{ message: { content: JSON.stringify(mockATSAnalysis) } }]
            })
          }
        }
      };
      (OpenAI as jest.Mock).mockImplementation(() => mockOpenAIInstance);

      const result = await atsOptimizationService.analyzeATS(sampleResumeData);
      
      expect(result).toBeDefined();
      expect(result.atsScore).toBe(80);
      
      // Clean up
      delete process.env.OPENAI_API_KEY;
    });
  });
});
