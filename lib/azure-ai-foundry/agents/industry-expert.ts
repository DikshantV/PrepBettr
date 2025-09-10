import { BaseAgent } from './base-agent';
import { FoundryClientBase } from '../clients/foundry-client';
import { FoundryConfig } from '../config/foundry-config';
import { InterviewContext, Question, AgentMetadata } from '../types/agent-types';

/**
 * IndustryExpert agent specializing in industry-specific knowledge and trends
 * Uses specialized models for domain expertise and industry insights
 */
export class IndustryExpert extends BaseAgent {
  // Required BaseAgent interface properties
  readonly id = 'industry-expert';
  readonly name = 'Industry Expert';
  readonly type = 'industry' as const;
  
  protected readonly modelName = 'llama-4';
  
  public readonly instructions = `You are an industry expert with deep knowledge across various sectors and business domains.

EXPERTISE AREAS:
- Technology trends and emerging technologies
- Business strategy and market dynamics
- Industry-specific regulations and compliance
- Competitive landscape analysis
- Best practices and industry standards
- Innovation and future outlook

ROLE GUIDELINES:
- Ask questions that assess industry knowledge and awareness
- Focus on current trends, challenges, and opportunities in the candidate's field
- Evaluate strategic thinking and business acumen
- Assess understanding of industry regulations and standards
- Test knowledge of competitive landscape and market positioning

QUESTION TYPES TO FOCUS ON:
- Industry trends and future predictions
- Regulatory changes and compliance requirements
- Competitive analysis and market positioning
- Technology adoption and innovation
- Business model evolution and disruption
- Ethical considerations and sustainability

INTERVIEW STYLE:
- Be knowledgeable and analytical
- Ask thought-provoking questions about industry direction
- Encourage strategic thinking and business reasoning
- Focus on practical application of industry knowledge
- Assess both current knowledge and learning agility

Tailor questions to the specific industry and role level of the candidate.`;
  
  public readonly metadata: AgentMetadata = {
    id: 'industry-expert',
    name: 'Industry Expert',
    description: 'Specializes in industry-specific knowledge and market insights',
    version: '1.0.0',
    supportedPhases: ['industry', 'market-analysis'],
    capabilities: ['industry-analysis', 'market-knowledge', 'trend-assessment'],
    modelRequirements: {
      minimumTokens: 2500,
      preferredModels: ['llama-4', 'gpt-4']
    },
    tags: ['industry', 'market', 'trends', 'business'],
    // Legacy compatibility
    maxQuestions: 4,
    averageDuration: 7
  };

  constructor(foundryClient: FoundryClientBase, config: FoundryConfig) {
    super(foundryClient, config);
  }

  /**
   * Generate industry-specific interview questions based on context
   */
  async generateQuestions(context: InterviewContext): Promise<Question[]> {
    try {
      const prompt = this.buildPrompt(context);
      
      const response = await this.foundryClient.request('/chat/completions', {
        method: 'POST',
        body: {
          model: 'llama-4',
          messages: [
            { role: 'system', content: this.getSystemInstructions() },
            { role: 'user', content: prompt }
          ],
          temperature: 0.6,
          max_tokens: 2500
        }
      });

      const questionsText = response.data?.choices?.[0]?.message?.content || response.raw || '';
      const questions = this.parseQuestionsFromResponse(questionsText, context);
      
      return questions.length > 0 ? questions : this.getFallbackQuestions(context);
    } catch (error) {
      console.error('Error generating industry questions:', error);
      return this.getFallbackQuestions(context);
    }
  }

  private getSystemInstructions(): string {
    return `You are an industry expert with deep knowledge across various sectors and business domains.

EXPERTISE AREAS:
- Technology trends and emerging technologies
- Business strategy and market dynamics
- Industry-specific regulations and compliance
- Competitive landscape analysis
- Best practices and industry standards
- Innovation and future outlook

ROLE GUIDELINES:
- Ask questions that assess industry knowledge and awareness
- Focus on current trends, challenges, and opportunities in the candidate's field
- Evaluate strategic thinking and business acumen
- Assess understanding of industry regulations and standards
- Test knowledge of competitive landscape and market positioning

QUESTION TYPES TO FOCUS ON:
- Industry trends and future predictions
- Regulatory changes and compliance requirements
- Competitive analysis and market positioning
- Technology adoption and innovation
- Business model evolution and disruption
- Ethical considerations and sustainability

INTERVIEW STYLE:
- Be knowledgeable and analytical
- Ask thought-provoking questions about industry direction
- Encourage strategic thinking and business reasoning
- Focus on practical application of industry knowledge
- Assess both current knowledge and learning agility

Tailor questions to the specific industry and role level of the candidate.`;
  }

  /**
   * Build industry-specific prompt based on context
   */
  private buildPrompt(context: InterviewContext): string {
    const { candidateProfile, jobRole, companyInfo, sessionHistory } = context;
    
    // Extract industry from company or job role
    const industry = this.extractIndustry(companyInfo, jobRole);
    
    let prompt = `Generate 5-7 industry-specific interview questions for a candidate interviewing for: ${jobRole}`;
    
    if (companyInfo?.name) {
      prompt += ` at ${companyInfo.name}`;
    }
    
    if (industry) {
      prompt += ` in the ${industry} industry`;
    }
    
    prompt += '\n\nCandidate Background:\n';
    
    if (candidateProfile?.experience) {
      prompt += `- Experience Level: ${candidateProfile.experience}\n`;
    }
    
    if (candidateProfile?.skills?.length) {
      prompt += `- Technical Skills: ${candidateProfile.skills.join(', ')}\n`;
    }
    
    if (candidateProfile?.industry) {
      prompt += `- Industry Background: ${candidateProfile.industry}\n`;
    }
    
    if (companyInfo?.industry) {
      prompt += `\nTarget Industry: ${companyInfo.industry}\n`;
    }
    
    if (companyInfo?.size) {
      prompt += `Company Size: ${companyInfo.size}\n`;
    }
    
    if (sessionHistory?.previousQuestions?.length) {
      prompt += `\nPreviously Asked Questions:\n${sessionHistory.previousQuestions.map(q => `- ${q.text}`).join('\n')}\n\nBuild upon previous responses and avoid repetition.\n`;
    }
    
    prompt += `\nFOCUS AREAS FOR ${industry?.toUpperCase() || 'THIS'} INDUSTRY:
- Current market trends and disruptions
- Regulatory environment and compliance challenges  
- Competitive landscape and positioning
- Technology adoption and digital transformation
- Business model innovation and evolution
- Sustainability and ethical considerations
- Future outlook and growth opportunities

FORMAT: Return each question as a JSON object with:
- "text": the question text focusing on industry knowledge
- "category": industry category (trends, regulation, competition, technology, etc.)
- "followUps": 1-2 follow-up questions to drill deeper
- "difficulty": beginner/intermediate/advanced based on role seniority
- "industryContext": brief context about why this knowledge is important

Ensure questions test both current industry knowledge and strategic thinking abilities.`;

    return prompt;
  }

  /**
   * Extract industry from company info and job role
   */
  private extractIndustry(companyInfo?: any, jobRole?: string): string | null {
    // Check explicit industry field first
    if (companyInfo?.industry) {
      return companyInfo.industry;
    }
    
    // Infer from company name or job role
    const combinedText = `${companyInfo?.name || ''} ${jobRole || ''}`.toLowerCase();
    
    const industryKeywords = {
      'technology': ['tech', 'software', 'saas', 'ai', 'data', 'cloud', 'developer', 'engineer'],
      'finance': ['bank', 'fintech', 'financial', 'investment', 'trading', 'credit', 'payment'],
      'healthcare': ['health', 'medical', 'pharma', 'biotech', 'hospital', 'clinical'],
      'retail': ['retail', 'ecommerce', 'commerce', 'shopping', 'store', 'marketplace'],
      'manufacturing': ['manufacturing', 'automotive', 'industrial', 'factory', 'production'],
      'consulting': ['consulting', 'advisory', 'strategy', 'management', 'professional services'],
      'education': ['education', 'learning', 'school', 'university', 'training', 'academic']
    };
    
    for (const [industry, keywords] of Object.entries(industryKeywords)) {
      if (keywords.some(keyword => combinedText.includes(keyword))) {
        return industry;
      }
    }
    
    return null;
  }

  /**
   * Get fallback industry questions when AI generation fails
   */
  protected getFallbackQuestions(context: InterviewContext): Question[] {
    const industry = this.extractIndustry(context.companyInfo, context.jobRole) || 'technology';
    
    const fallbackQuestions: Question[] = [
      {
        id: 'industry-1',
        text: `What do you see as the biggest trend currently shaping the ${industry} industry?`,
        type: 'industry',
        category: 'industry',
        difficulty: 'medium',
        expectedDuration: 360,
        tags: ['trends', 'market-analysis'],
        metadata: {
          topic: 'trends'
        }
      },
      {
        id: 'industry-2',
        text: 'How do you stay updated with industry developments and emerging technologies?',
        type: 'industry',
        category: 'industry',
        difficulty: 'easy',
        expectedDuration: 240,
        tags: ['learning', 'industry-knowledge'],
        metadata: {
          topic: 'learning'
        }
      },
      {
        id: 'industry-3',
        text: `What regulatory or compliance challenges do you think companies in ${industry} face today?`,
        type: 'industry',
        category: 'industry',
        difficulty: 'medium',
        expectedDuration: 420,
        tags: ['regulation', 'compliance'],
        metadata: {
          topic: 'regulation'
        }
      },
      {
        id: 'industry-4',
        text: 'How do you think artificial intelligence and automation will impact this industry?',
        type: 'industry',
        category: 'industry',
        difficulty: 'medium',
        expectedDuration: 480,
        tags: ['technology', 'future-trends'],
        metadata: {
          topic: 'technology'
        }
      }
    ];

    // Add industry-specific questions based on detected industry
    const industrySpecific = this.getIndustrySpecificQuestions(industry);
    fallbackQuestions.push(...industrySpecific);

    return fallbackQuestions;
  }

  /**
   * Get industry-specific fallback questions
   */
  private getIndustrySpecificQuestions(industry: string): Question[] {
    const specificQuestions: { [key: string]: Question[] } = {
      'technology': [
        {
          id: 'tech-specific-1',
          text: 'How do you approach evaluating new technologies for adoption in a business context?',
          type: 'industry',
          category: 'industry',
          difficulty: 'hard',
          expectedDuration: 540,
          tags: ['technology-evaluation', 'strategic-thinking'],
          metadata: {
            topic: 'technology-evaluation'
          }
        }
      ],
      'finance': [
        {
          id: 'finance-specific-1',
          text: 'How do you see fintech disrupting traditional financial services?',
          type: 'industry',
          category: 'industry',
          difficulty: 'hard',
          expectedDuration: 480,
          tags: ['fintech', 'disruption'],
          metadata: {
            topic: 'disruption'
          }
        }
      ],
      'healthcare': [
        {
          id: 'health-specific-1',
          text: 'What role do you think digital health technologies play in improving patient outcomes?',
          type: 'industry',
          category: 'industry',
          difficulty: 'medium',
          expectedDuration: 420,
          tags: ['digital-health', 'patient-outcomes'],
          metadata: {
            topic: 'digital-health'
          }
        }
      ]
    };

    return specificQuestions[industry] || [];
  }

  // Required BaseAgent abstract methods
  protected getQuestionCategory(): Question['category'] {
    return 'industry';
  }

  protected getDefaultQuestion(context: InterviewContext): string {
    const industry = this.extractIndustry(context.companyInfo, context.jobRole) || context.candidateProfile?.industry || 'technology';
    return `What do you see as the biggest trend currently shaping the ${industry} industry?`;
  }
}
