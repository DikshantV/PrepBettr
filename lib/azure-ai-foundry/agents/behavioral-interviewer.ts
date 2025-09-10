import { BaseAgent } from './base-agent';
import { InterviewContext, Question } from '../types/agent-types';

/**
 * BehavioralInterviewer agent specializing in behavioral and situational questions
 * Uses GPT-4o model for human-focused behavioral assessment
 */
export class BehavioralInterviewer extends BaseAgent {
  constructor() {
    super({
      agentId: 'behavioral-interviewer',
      name: 'Behavioral Interviewer',
      version: '1.0.0',
      model: 'gpt-4o',
      temperature: 0.7,
      maxTokens: 2000,
      systemInstructions: `You are a behavioral interview specialist focused on assessing soft skills, leadership potential, and cultural fit.

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

Always tailor questions to the candidate's background and the specific role requirements.`
    });
  }

  /**
   * Generate behavioral interview questions based on context
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
      console.error('Error generating behavioral questions:', error);
      return this.getFallbackQuestions(context);
    }
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
    
    if (candidateProfile?.previousRoles?.length) {
      prompt += `- Previous Roles: ${candidateProfile.previousRoles.join(', ')}\n`;
    }
    
    if (companyInfo?.culture) {
      prompt += `\nCompany Culture: ${companyInfo.culture}\n`;
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
  private getFallbackQuestions(context: InterviewContext): Question[] {
    const experienceLevel = context.candidateProfile?.experience?.toLowerCase() || 'intermediate';
    
    const fallbackQuestions: Question[] = [
      {
        id: 'behavioral-1',
        text: 'Tell me about a time when you had to work with a difficult team member. How did you handle the situation?',
        category: 'teamwork',
        difficulty: 'intermediate',
        followUps: [
          'What would you do differently if you faced a similar situation again?',
          'How did this experience change your approach to team collaboration?'
        ]
      },
      {
        id: 'behavioral-2',
        text: 'Describe a situation where you had to learn something new quickly to complete a project.',
        category: 'adaptability',
        difficulty: 'beginner',
        followUps: [
          'What resources did you use to learn quickly?',
          'How do you typically approach learning new skills?'
        ]
      },
      {
        id: 'behavioral-3',
        text: 'Give me an example of a time when you had to make a decision without having all the information you needed.',
        category: 'decision-making',
        difficulty: 'intermediate',
        followUps: [
          'How did you gather the information you could?',
          'What was the outcome of your decision?'
        ]
      },
      {
        id: 'behavioral-4',
        text: 'Tell me about a time when you received constructive criticism. How did you respond?',
        category: 'growth-mindset',
        difficulty: 'beginner',
        followUps: [
          'How did you implement the feedback?',
          'What did you learn from this experience?'
        ]
      }
    ];

    // Add senior-level questions if appropriate
    if (experienceLevel.includes('senior') || experienceLevel.includes('lead') || experienceLevel.includes('principal')) {
      fallbackQuestions.push({
        id: 'behavioral-5',
        text: 'Describe a time when you had to influence others without having direct authority over them.',
        category: 'leadership',
        difficulty: 'advanced',
        followUps: [
          'What strategies did you use to gain buy-in?',
          'How do you build influence in an organization?'
        ]
      });
    }

    return fallbackQuestions;
  }
}
