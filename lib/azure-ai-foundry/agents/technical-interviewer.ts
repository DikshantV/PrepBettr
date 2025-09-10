/**
 * Technical Interviewer Agent
 * 
 * Specialized agent for conducting technical interviews focusing on
 * coding skills, system design, algorithms, and technical knowledge.
 */

import { BaseAgent } from './base-agent';
import { FoundryClientBase } from '../clients/foundry-client';
import { FoundryConfig } from '../config/foundry-config';
import { Question, InterviewContext, AgentMetadata } from '../types/agent-types';

export class TechnicalInterviewer extends BaseAgent {
  // Required BaseAgent interface properties
  readonly id = 'technical-interviewer';
  readonly name = 'Technical Interviewer';
  readonly type = 'technical' as const;
  
  protected readonly modelName = 'gpt-4.5'; // Use GPT-4.5 for technical interviews
  
  public readonly instructions = `You are a Senior Technical Interviewer with 10+ years of experience conducting technical interviews for software engineering roles. Your goal is to assess the candidate's technical competency through thoughtful, practical questions.

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
Ensure questions are clear, specific, and actionable.`;
  
  public readonly metadata: AgentMetadata = {
    id: 'technical-interviewer',
    name: 'Technical Interviewer',
    description: 'Specializes in technical questions for software engineering roles',
    version: '1.0.0',
    supportedPhases: ['technical', 'coding'],
    capabilities: ['question-generation', 'code-review', 'algorithm-assessment'],
    modelRequirements: {
      minimumTokens: 4000,
      preferredModels: ['gpt-4', 'gpt-4.5']
    },
    tags: ['technical', 'coding', 'algorithms', 'system-design'],
    // Legacy compatibility
    specialty: 'Technical Skills Assessment',
    modelPreference: 'gpt-4.5',
    maxQuestions: 5,
    averageDuration: 8 // 8 minutes per technical question on average
  };

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
    const reachedMaxQuestions = technicalQuestions.length >= (this.metadata.maxQuestions || 5);
    
    return minQuestionsAnswered || reachedMaxQuestions;
  }

}
