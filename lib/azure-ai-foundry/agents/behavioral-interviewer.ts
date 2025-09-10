import { BaseAgent } from './base-agent';
import { FoundryClientBase } from '../clients/foundry-client';
import { FoundryConfig } from '../config/foundry-config';
import { InterviewContext, Question, AgentMetadata } from '../types/agent-types';

/**
 * BehavioralInterviewer agent specializing in behavioral and situational questions
 * Uses GPT-4o model for human-focused behavioral assessment
 */
export class BehavioralInterviewer extends BaseAgent {
  // Required BaseAgent interface properties
  readonly id = 'behavioral-interviewer';
  readonly name = 'Behavioral Interviewer';
  readonly type = 'behavioral' as const;
  
  protected readonly modelName = 'gpt-4o';
  
  public readonly instructions = `You are a behavioral interview specialist focused on assessing soft skills, leadership potential, and cultural fit.

ROLE GUIDELINES:
- Ask questions about past experiences, challenging situations, and interpersonal skills
- Focus on STAR method responses (Situation, Task, Action, Result)
- Assess communication skills, problem-solving approach, and emotional intelligence
- Adapt questions based on the candidate's seniority level and role requirements

QUESTION TYPES TO FOCUS ON:
- Leadership and teamwork experiences
- Conflict resolution and difficult conversations
- Adaptability and learning from failure
- Decision-making under pressure
- Career motivation and goal alignment

INTERVIEW STYLE:
- Be empathetic and encouraging
- Ask follow-up questions to understand context and impact
- Help candidates structure their responses using the STAR method
- Focus on specific examples rather than hypothetical scenarios

Always tailor questions to the candidate's background and the specific role requirements.`;
  
  public readonly metadata: AgentMetadata = {
    id: 'behavioral-interviewer',
    name: 'Behavioral Interviewer',
    description: 'Specializes in behavioral and soft skills assessment',
    version: '1.0.0',
    supportedPhases: ['behavioral', 'cultural-fit'],
    capabilities: ['behavioral-assessment', 'soft-skills-evaluation', 'cultural-fit-analysis'],
    modelRequirements: {
      minimumTokens: 2000,
      preferredModels: ['gpt-4o', 'gpt-4']
    },
    tags: ['behavioral', 'soft-skills', 'teamwork', 'leadership'],
    // Legacy compatibility
    maxQuestions: 5,
    averageDuration: 6
  };

  constructor(foundryClient: FoundryClientBase, config: FoundryConfig) {
    super(foundryClient, config);
  }


  /**
   * Build behavioral-specific prompt based on context
   */
  private buildPrompt(context: InterviewContext): string {
    const { candidateProfile, jobRole, companyInfo, sessionHistory } = context;
    
    let prompt = `Generate 5-7 behavioral interview questions for a candidate interviewing for: ${jobRole}`;
    
    if (companyInfo?.name) {
      prompt += ` at ${companyInfo.name}`;
    }
    
    prompt += '\n\nCandidate Background:\n';
    
    if (candidateProfile?.experience) {
      prompt += `- Experience Level: ${candidateProfile.experience}\n`;
    }
    
    if (candidateProfile?.skills?.length) {
      prompt += `- Key Skills: ${candidateProfile.skills.join(', ')}\n`;
    }
    
    // Remove references to undefined properties
    if (candidateProfile?.industry) {
      prompt += `- Industry: ${candidateProfile.industry}\n`;
    }
    
    if (sessionHistory?.previousQuestions?.length) {
      prompt += `\nPreviously Asked Questions:\n${sessionHistory.previousQuestions.map(q => `- ${q.text}`).join('\n')}\n\nAvoid repeating these topics and build upon previous responses.\n`;
    }
    
    prompt += `\nFOCUS AREAS:
- Past experiences demonstrating relevant skills
- Leadership and teamwork scenarios
- Problem-solving and decision-making situations
- Adaptability and learning from challenges
- Communication and interpersonal skills
- Career motivation and cultural fit

FORMAT: Return each question as a JSON object with:
- "text": the question text
- "category": behavioral category (leadership, teamwork, problem-solving, etc.)
- "followUps": 1-2 potential follow-up questions
- "difficulty": beginner/intermediate/advanced based on role seniority

Ensure questions encourage STAR method responses and are appropriate for the candidate's experience level.`;

    return prompt;
  }

  /**
   * Get fallback behavioral questions when AI generation fails
   */
  private getFallbackBehavioralQuestions(context: InterviewContext): Question[] {
    const experienceLevel = context.candidateProfile?.experience?.toLowerCase() || 'intermediate';
    
    const fallbackQuestions: Question[] = [
      {
        id: 'behavioral-1',
        text: 'Tell me about a time when you had to work with a difficult team member. How did you handle the situation?',
        type: 'behavioral',
        category: 'behavioral',
        difficulty: 'medium',
        expectedDuration: 300,
        tags: ['teamwork', 'conflict-resolution'],
        metadata: {
          topic: 'teamwork'
        }
      },
      {
        id: 'behavioral-2',
        text: 'Describe a situation where you had to learn something new quickly to complete a project.',
        type: 'behavioral',
        category: 'behavioral',
        difficulty: 'easy',
        expectedDuration: 240,
        tags: ['adaptability', 'learning'],
        metadata: {
          topic: 'adaptability'
        }
      },
      {
        id: 'behavioral-3',
        text: 'Give me an example of a time when you had to make a decision without having all the information you needed.',
        type: 'behavioral',
        category: 'behavioral',
        difficulty: 'medium',
        expectedDuration: 360,
        tags: ['decision-making', 'problem-solving'],
        metadata: {
          topic: 'decision-making'
        }
      },
      {
        id: 'behavioral-4',
        text: 'Tell me about a time when you received constructive criticism. How did you respond?',
        type: 'behavioral',
        category: 'behavioral',
        difficulty: 'easy',
        expectedDuration: 240,
        tags: ['growth-mindset', 'feedback'],
        metadata: {
          topic: 'growth-mindset'
        }
      }
    ];

    // Add senior-level questions if appropriate
    if (experienceLevel.includes('senior') || experienceLevel.includes('lead') || experienceLevel.includes('principal')) {
      fallbackQuestions.push({
        id: 'behavioral-5',
        text: 'Describe a time when you had to influence others without having direct authority over them.',
        type: 'behavioral',
        category: 'behavioral',
        difficulty: 'hard',
        expectedDuration: 420,
        tags: ['leadership', 'influence'],
        metadata: {
          topic: 'leadership'
        }
      });
    }

    return fallbackQuestions;
  }

  // Required BaseAgent abstract methods
  protected getQuestionCategory(): Question['category'] {
    return 'behavioral';
  }

  protected getDefaultQuestion(context: InterviewContext): string {
    return 'Tell me about a time when you had to work with a difficult team member. How did you handle the situation?';
  }
}
