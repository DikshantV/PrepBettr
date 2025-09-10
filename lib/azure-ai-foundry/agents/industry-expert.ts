import { BaseAgent } from './base-agent';
import { InterviewContext, Question } from '../types/agent-types';

/**
 * IndustryExpert agent specializing in industry-specific knowledge and trends
 * Uses Llama-4 model for domain expertise and industry insights
 */
export class IndustryExpert extends BaseAgent {
  constructor() {
    super({
      agentId: 'industry-expert',
      name: 'Industry Expert',
      version: '1.0.0',
      model: 'llama-4', // Specialized model for domain expertise
      temperature: 0.6,
      maxTokens: 2500,
      systemInstructions: `You are an industry expert with deep knowledge across various sectors and business domains.

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

Tailor questions to the specific industry and role level of the candidate.`
    });
  }

  /**
   * Generate industry-specific interview questions based on context
   */
  async generateQuestions(context: InterviewContext): Promise<Question[]> {
    try {
      const prompt = this.buildPrompt(context);
      
      const response = await this.client.request('/chat/completions', 'POST', {
        model: this.config.model,
        messages: [
          { role: 'system', content: this.config.systemInstructions },
          { role: 'user', content: prompt }
        ],
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens
      });

      const questions = this.parseQuestionsFromResponse(response.data);
      
      // Log usage and cost
      this.logUsage(context, response.data);
      
      return questions.length > 0 ? questions : this.getFallbackQuestions(context);
    } catch (error) {
      console.error('Error generating industry questions:', error);
      return this.getFallbackQuestions(context);
    }
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
    
    if (candidateProfile?.industries?.length) {
      prompt += `- Previous Industries: ${candidateProfile.industries.join(', ')}\n`;
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
  private getFallbackQuestions(context: InterviewContext): Question[] {
    const industry = this.extractIndustry(context.companyInfo, context.jobRole) || 'technology';
    
    const fallbackQuestions: Question[] = [
      {
        id: 'industry-1',
        text: `What do you see as the biggest trend currently shaping the ${industry} industry?`,
        category: 'trends',
        difficulty: 'intermediate',
        followUps: [
          'How do you think this trend will evolve over the next 2-3 years?',
          'What opportunities or challenges does this create for companies in this space?'
        ],
        industryContext: 'Understanding current market dynamics and trend awareness'
      },
      {
        id: 'industry-2',
        text: 'How do you stay updated with industry developments and emerging technologies?',
        category: 'learning',
        difficulty: 'beginner',
        followUps: [
          'Which industry publications or resources do you find most valuable?',
          'Can you share a recent industry insight that changed your perspective?'
        ],
        industryContext: 'Assessing continuous learning and industry engagement'
      },
      {
        id: 'industry-3',
        text: `What regulatory or compliance challenges do you think companies in ${industry} face today?`,
        category: 'regulation',
        difficulty: 'intermediate',
        followUps: [
          'How do you think these regulations impact business strategy?',
          'What approaches have you seen companies take to manage compliance?'
        ],
        industryContext: 'Understanding regulatory landscape and business impact'
      },
      {
        id: 'industry-4',
        text: 'How do you think artificial intelligence and automation will impact this industry?',
        category: 'technology',
        difficulty: 'intermediate',
        followUps: [
          'What specific use cases do you think will emerge first?',
          'How should professionals prepare for these changes?'
        ],
        industryContext: 'Evaluating technology adoption and future workforce considerations'
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
          category: 'technology-evaluation',
          difficulty: 'advanced',
          followUps: [
            'What criteria do you use to assess technical feasibility vs business value?',
            'How do you handle technical debt when introducing new solutions?'
          ],
          industryContext: 'Technology evaluation and strategic decision-making'
        }
      ],
      'finance': [
        {
          id: 'finance-specific-1',
          text: 'How do you see fintech disrupting traditional financial services?',
          category: 'disruption',
          difficulty: 'advanced',
          followUps: [
            'Which areas of traditional banking are most vulnerable?',
            'How should established financial institutions respond?'
          ],
          industryContext: 'Understanding fintech disruption and market dynamics'
        }
      ],
      'healthcare': [
        {
          id: 'health-specific-1',
          text: 'What role do you think digital health technologies play in improving patient outcomes?',
          category: 'digital-health',
          difficulty: 'intermediate',
          followUps: [
            'What barriers exist to widespread adoption of digital health tools?',
            'How do you balance innovation with patient privacy and safety?'
          ],
          industryContext: 'Digital transformation in healthcare delivery'
        }
      ]
    };

    return specificQuestions[industry] || [];
  }
}
