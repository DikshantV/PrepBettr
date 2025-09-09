/**
 * Base Agent Class and Core Interfaces for Azure AI Foundry Agent System
 * 
 * This module provides the foundational classes and interfaces for implementing
 * specialized interview agents (technical, behavioral, industry expert).
 */

import { FoundryClientBase } from '../clients/foundry-client';
import { FoundryConfig } from '../config/foundry-config';

// ===== CORE INTERFACES =====

export interface Question {
  id: string;
  text: string;
  category: 'technical' | 'behavioral' | 'industry' | 'general';
  difficulty: 'easy' | 'medium' | 'hard';
  expectedDuration: number; // in seconds
  followUpQuestions?: string[];
  tags: string[];
  metadata?: {
    skill?: string;
    topic?: string;
    scenario?: string;
  };
}

export interface InterviewContext {
  sessionId: string;
  candidateProfile: {
    name?: string;
    experience: string;
    skills: string[];
    targetRole: string;
    industry: string;
    resumeContent?: string;
  };
  interviewConfig: {
    duration: number; // total interview duration in minutes
    focusAreas: string[];
    difficulty: 'entry' | 'mid' | 'senior' | 'expert';
    includeFollowUps: boolean;
  };
  previousQuestions: Question[];
  currentPhase: 'technical' | 'behavioral' | 'industry';
  responses?: {
    questionId: string;
    response: string;
    timestamp: Date;
  }[];
}

export interface SessionState {
  sessionId: string;
  currentAgent: string;
  phase: 'technical' | 'behavioral' | 'industry' | 'completed';
  startTime: Date;
  lastActivity: Date;
  context: InterviewContext;
  agentQueue: string[];
  completedAgents: string[];
  metadata: {
    totalQuestions: number;
    averageResponseTime: number;
    completionPercentage: number;
  };
}

export interface AgentMetadata {
  name: string;
  specialty: string;
  capabilities: string[];
  modelPreference: string;
  maxQuestions: number;
  averageDuration: number; // in minutes
}

export interface FoundryAgent {
  metadata: AgentMetadata;
  generateQuestions(context: InterviewContext): Promise<Question[]>;
  processResponse(questionId: string, response: string, context: InterviewContext): Promise<void>;
  isComplete(context: InterviewContext): boolean;
}

// ===== BASE AGENT CLASS =====

export abstract class BaseAgent implements FoundryAgent {
  protected foundryClient: FoundryClientBase;
  protected config: FoundryConfig;
  
  public abstract readonly metadata: AgentMetadata;
  public abstract readonly instructions: string;
  protected abstract readonly modelName: string;

  constructor(foundryClient: FoundryClientBase, config: FoundryConfig) {
    this.foundryClient = foundryClient;
    this.config = config;
  }

  /**
   * Generate interview questions based on context
   */
  public async generateQuestions(context: InterviewContext): Promise<Question[]> {
    try {
      console.log(`🤖 ${this.metadata.name} generating questions for ${context.candidateProfile.targetRole}`);
      
      const prompt = this.buildQuestionsPrompt(context);
      
      const response = await this.foundryClient.createChatCompletion({
        model: this.modelName,
        messages: [
          {
            role: 'system',
            content: this.instructions
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      });

      const questionsText = response.choices[0]?.message?.content || '';
      return this.parseQuestionsFromResponse(questionsText, context);
      
    } catch (error) {
      console.error(`❌ Error generating questions for ${this.metadata.name}:`, error);
      return this.getFallbackQuestions(context);
    }
  }

  /**
   * Process candidate response and update context
   */
  public async processResponse(questionId: string, response: string, context: InterviewContext): Promise<void> {
    try {
      // Add response to context
      if (!context.responses) {
        context.responses = [];
      }
      
      context.responses.push({
        questionId,
        response,
        timestamp: new Date()
      });

      console.log(`📝 ${this.metadata.name} processed response for question ${questionId}`);
      
    } catch (error) {
      console.error(`❌ Error processing response for ${this.metadata.name}:`, error);
    }
  }

  /**
   * Check if agent has completed its interview phase
   */
  public isComplete(context: InterviewContext): boolean {
    const agentQuestions = context.previousQuestions.filter(
      q => q.category === this.getQuestionCategory()
    );
    
    const responses = context.responses?.filter(r => 
      agentQuestions.some(q => q.id === r.questionId)
    ) || [];

    // Complete if we have responses to at least 3 questions or reached max questions
    return responses.length >= Math.min(3, this.metadata.maxQuestions);
  }

  // ===== PROTECTED HELPER METHODS =====

  protected buildQuestionsPrompt(context: InterviewContext): string {
    return `
Generate ${this.getQuestionCount(context)} interview questions for:

**Candidate Profile:**
- Target Role: ${context.candidateProfile.targetRole}
- Experience: ${context.candidateProfile.experience}
- Skills: ${context.candidateProfile.skills.join(', ')}
- Industry: ${context.candidateProfile.industry}

**Interview Requirements:**
- Difficulty: ${context.interviewConfig.difficulty}
- Focus Areas: ${context.interviewConfig.focusAreas.join(', ')}
- Duration per question: ~${Math.floor(context.interviewConfig.duration / this.metadata.maxQuestions)} minutes

**Previously Asked Questions:**
${context.previousQuestions.map(q => `- ${q.text}`).join('\n') || 'None'}

Return questions in JSON format:
[
  {
    "id": "unique-id",
    "text": "Question text here",
    "category": "${this.getQuestionCategory()}",
    "difficulty": "easy|medium|hard",
    "expectedDuration": 180,
    "followUpQuestions": ["follow-up if needed"],
    "tags": ["relevant", "tags"],
    "metadata": {
      "skill": "specific skill",
      "topic": "topic area"
    }
  }
]
    `.trim();
  }

  protected parseQuestionsFromResponse(responseText: string, context: InterviewContext): Question[] {
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.warn(`⚠️ Could not find JSON in ${this.metadata.name} response, using fallback`);
        return this.getFallbackQuestions(context);
      }

      const questions = JSON.parse(jsonMatch[0]) as Question[];
      
      // Validate and clean questions
      return questions
        .filter(q => q.text && q.id)
        .map(q => ({
          ...q,
          category: this.getQuestionCategory(),
          id: q.id || `${this.metadata.name.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
        }))
        .slice(0, this.metadata.maxQuestions);
        
    } catch (error) {
      console.error(`❌ Error parsing questions from ${this.metadata.name}:`, error);
      return this.getFallbackQuestions(context);
    }
  }

  protected getFallbackQuestions(context: InterviewContext): Question[] {
    return [
      {
        id: `${this.metadata.name.toLowerCase()}-fallback-${Date.now()}`,
        text: this.getDefaultQuestion(context),
        category: this.getQuestionCategory(),
        difficulty: 'medium',
        expectedDuration: 180,
        tags: ['fallback', this.metadata.specialty],
        metadata: {
          topic: 'general'
        }
      }
    ];
  }

  protected getQuestionCount(context: InterviewContext): number {
    const remainingTime = context.interviewConfig.duration;
    const avgTimePerQuestion = this.metadata.averageDuration;
    const maxQuestions = Math.min(
      this.metadata.maxQuestions,
      Math.floor(remainingTime / avgTimePerQuestion)
    );
    return Math.max(1, maxQuestions);
  }

  // ===== ABSTRACT METHODS =====

  protected abstract getQuestionCategory(): Question['category'];
  protected abstract getDefaultQuestion(context: InterviewContext): string;
}

// ===== UTILITY FUNCTIONS =====

export function generateQuestionId(agentName: string, category: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 5);
  return `${agentName.toLowerCase()}-${category}-${timestamp}-${random}`;
}

export function calculateInterviewProgress(context: InterviewContext): number {
  const totalExpectedQuestions = 9; // 3 per agent type
  const completedQuestions = context.responses?.length || 0;
  return Math.min(100, Math.round((completedQuestions / totalExpectedQuestions) * 100));
}

export function getEstimatedRemainingTime(context: InterviewContext, currentAgent: FoundryAgent): number {
  const completedQuestions = context.responses?.length || 0;
  const avgTimePerQuestion = currentAgent.metadata.averageDuration;
  const remainingQuestions = Math.max(0, currentAgent.metadata.maxQuestions - completedQuestions);
  return remainingQuestions * avgTimePerQuestion;
}
