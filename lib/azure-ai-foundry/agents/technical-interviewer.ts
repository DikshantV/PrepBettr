/**
 * Technical Interviewer Agent
 * 
 * Specialized agent for conducting technical interviews focusing on
 * coding skills, system design, algorithms, and technical knowledge.
 */

import { BaseAgent, Question, InterviewContext, AgentMetadata } from './base-agent';
import { FoundryClientBase } from '../clients/foundry-client';
import { FoundryConfig } from '../config/foundry-config';

export class TechnicalInterviewer extends BaseAgent {
  protected readonly modelName = 'gpt-4.5'; // Use GPT-4.5 for technical interviews
  
  public readonly metadata: AgentMetadata = {
    name: 'Technical Interviewer',
    specialty: 'Technical Skills Assessment',
    capabilities: [
      'Coding questions',
      'System design',
      'Algorithm challenges',
      'Data structure problems',
      'Architecture discussions',
      'Code review scenarios'
    ],
    modelPreference: 'gpt-4.5',
    maxQuestions: 5,
    averageDuration: 8 // 8 minutes per technical question on average
  };

  public readonly instructions = `
You are a Senior Technical Interviewer with 10+ years of experience conducting technical interviews for software engineering roles. Your goal is to assess the candidate's technical competency through thoughtful, practical questions.

## Your Responsibilities:
1. Generate technical questions appropriate for the candidate's experience level
2. Focus on problem-solving approach over perfect solutions
3. Include a mix of coding, system design, and conceptual questions
4. Provide questions that reveal thinking process and technical depth
5. Consider the target role and required technical skills

## Question Categories:
- **Coding Problems**: Algorithm implementation, data structures, optimization
- **System Design**: Scalability, architecture, trade-offs, design patterns
- **Technical Concepts**: Language-specific features, frameworks, best practices
- **Debugging**: Code analysis, troubleshooting, performance issues
- **Experience-Based**: Real-world scenarios, past project challenges

## Guidelines:
- Tailor difficulty to candidate's experience level (entry/mid/senior/expert)
- Ask open-ended questions that allow for discussion
- Include practical, real-world scenarios when possible
- Focus on understanding reasoning and approach
- Keep questions relevant to the target role and industry

## Response Format:
Always respond with valid JSON array containing question objects with all required fields.
Ensure questions are clear, specific, and actionable.
`.trim();

  constructor(foundryClient: FoundryClientBase, config: FoundryConfig) {
    super(foundryClient, config);
  }

  protected getQuestionCategory(): Question['category'] {
    return 'technical';
  }

  protected getDefaultQuestion(context: InterviewContext): string {
    const { targetRole, experience, skills } = context.candidateProfile;
    const { difficulty } = context.interviewConfig;
    
    // Generate role-specific default questions based on context
    if (targetRole.toLowerCase().includes('frontend') || skills.includes('React')) {
      return `Describe how you would implement a reusable component in React that handles user input validation. What patterns would you use and why?`;
    }
    
    if (targetRole.toLowerCase().includes('backend') || skills.includes('Node.js')) {
      return `Design a RESTful API for a ${context.candidateProfile.industry} application. What endpoints would you create and how would you handle authentication and error cases?`;
    }
    
    if (targetRole.toLowerCase().includes('fullstack')) {
      return `Walk me through how you would architect a real-time chat application. Consider both frontend and backend components, data flow, and scalability.`;
    }
    
    // General technical question based on experience level
    switch (difficulty) {
      case 'entry':
        return `Explain the difference between let, const, and var in JavaScript. When would you use each one and why?`;
      case 'mid':
        return `Describe a challenging technical problem you've solved recently. What was your approach and what trade-offs did you consider?`;
      case 'senior':
        return `How would you design a system to handle 1 million concurrent users? Walk me through your architecture decisions and scaling strategies.`;
      case 'expert':
        return `Discuss a time when you had to optimize performance in a critical system. What was your methodology for identifying bottlenecks and implementing solutions?`;
      default:
        return `Tell me about a technical decision you made recently and explain your reasoning process.`;
    }
  }

  /**
   * Generate technical questions with enhanced context awareness
   */
  public async generateQuestions(context: InterviewContext): Promise<Question[]> {
    try {
      console.log(`🔧 Technical Interviewer generating questions for ${context.candidateProfile.targetRole}`);
      
      const enhancedPrompt = this.buildTechnicalPrompt(context);
      
      const response = await this.foundryClient.createChatCompletion({
        model: this.modelName,
        messages: [
          {
            role: 'system',
            content: this.instructions
          },
          {
            role: 'user',
            content: enhancedPrompt
          }
        ],
        temperature: 0.8, // Slightly higher for creative technical scenarios
        max_tokens: 2500
      });

      const questionsText = response.choices[0]?.message?.content || '';
      return this.parseQuestionsFromResponse(questionsText, context);
      
    } catch (error) {
      console.error(`❌ Technical Interviewer error:`, error);
      return this.getFallbackTechnicalQuestions(context);
    }
  }

  private buildTechnicalPrompt(context: InterviewContext): string {
    const { candidateProfile, interviewConfig } = context;
    const primarySkills = candidateProfile.skills.slice(0, 3);
    
    return `
Generate ${this.getQuestionCount(context)} technical interview questions for:

**Candidate Profile:**
- Role: ${candidateProfile.targetRole}
- Experience: ${candidateProfile.experience}
- Key Skills: ${primarySkills.join(', ')}
- Industry: ${candidateProfile.industry}

**Technical Focus Areas:**
${interviewConfig.focusAreas.map(area => `- ${area}`).join('\n')}

**Interview Context:**
- Difficulty: ${interviewConfig.difficulty}
- Duration per question: ~${Math.floor(interviewConfig.duration / this.metadata.maxQuestions)} minutes
- Include follow-ups: ${interviewConfig.includeFollowUps}

**Previously Asked Questions:**
${context.previousQuestions.map(q => `- ${q.text}`).join('\n') || 'None'}

**Requirements:**
1. Mix of coding problems, system design, and conceptual questions
2. Questions should be appropriate for ${candidateProfile.experience} level
3. Include at least one question about ${primarySkills[0] || 'general programming'}
4. Focus on problem-solving approach and reasoning
5. Make questions practical and relevant to ${candidateProfile.industry}

Return as JSON array with complete question objects including metadata.skill and metadata.topic fields.
    `.trim();
  }

  private getFallbackTechnicalQuestions(context: InterviewContext): Question[] {
    const { targetRole, skills, experience } = context.candidateProfile;
    const questionId = `tech-fallback-${Date.now()}`;
    
    const fallbackQuestions: Question[] = [
      {
        id: questionId,
        text: this.getDefaultQuestion(context),
        category: 'technical',
        difficulty: context.interviewConfig.difficulty === 'entry' ? 'easy' : 
                   context.interviewConfig.difficulty === 'expert' ? 'hard' : 'medium',
        expectedDuration: 480, // 8 minutes
        tags: ['technical', 'fallback', targetRole.toLowerCase()],
        metadata: {
          skill: skills[0] || 'general',
          topic: 'problem-solving'
        }
      }
    ];

    // Add a second fallback question for system design
    if (context.interviewConfig.difficulty !== 'entry') {
      fallbackQuestions.push({
        id: `${questionId}-system`,
        text: `Design a simple ${context.candidateProfile.industry} application. What components would you include and how would they interact?`,
        category: 'technical',
        difficulty: 'medium',
        expectedDuration: 600, // 10 minutes for system design
        tags: ['system-design', 'architecture', 'fallback'],
        metadata: {
          skill: 'system-design',
          topic: 'architecture'
        }
      });
    }

    return fallbackQuestions;
  }

  /**
   * Enhanced completion check for technical interviews
   */
  public isComplete(context: InterviewContext): boolean {
    const technicalQuestions = context.previousQuestions.filter(q => q.category === 'technical');
    const technicalResponses = context.responses?.filter(r => 
      technicalQuestions.some(q => q.id === r.questionId)
    ) || [];

    // Technical interview complete if:
    // - At least 3 questions answered, OR
    // - Reached max questions for this agent, OR
    // - Spent more than 30 minutes on technical questions
    const minQuestionsAnswered = technicalResponses.length >= 3;
    const reachedMaxQuestions = technicalQuestions.length >= this.metadata.maxQuestions;
    
    return minQuestionsAnswered || reachedMaxQuestions;
  }
}
