/**
 * Base Agent Class and Core Interfaces for Azure AI Foundry Agent System
 * 
 * This module provides the foundational classes and interfaces for implementing
 * specialized interview agents (technical, behavioral, industry expert).
 */

import { FoundryClientBase } from '../clients/foundry-client';
import { FoundryConfig } from '../config/foundry-config';
import { 
  Question, 
  InterviewContext, 
  SessionState, 
  AgentMetadata, 
  FoundryAgent 
} from '../types/agent-types';

// ===== BASE AGENT CLASS =====

export abstract class BaseAgent implements FoundryAgent {
  protected foundryClient: FoundryClientBase;
  protected config: FoundryConfig;
  
  // Required by FoundryAgent interface
  public abstract readonly id: string;
  public abstract readonly name: string;
  public abstract readonly type: 'technical' | 'behavioral' | 'industry';
  
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
      
      const response = await this.foundryClient.request(`/chat/completions`, {
        method: 'POST',
        body: {
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
        }
      });

      const questionsText = response.data?.choices?.[0]?.message?.content || response.raw || '';
      const questions = this.parseQuestionsFromResponse(questionsText, context);
      
      // Log usage for monitoring
      this.logUsage(context, response.data);
      
      return questions;
      
    } catch (error) {
      console.error(`❌ Error generating questions for ${this.metadata.name}:`, error);
      return this.getFallbackQuestions(context);
    }
  }

  /**
   * Process candidate response and return follow-up or acknowledgment
   */
  public async processResponse(response: string, context: InterviewContext): Promise<string> {
    try {
      // For now, just return a simple acknowledgment
      // In a full implementation, this would analyze the response and provide feedback
      console.log(`📝 ${this.metadata.name} processed response: ${response.substring(0, 50)}...`);
      
      // Return acknowledgment or follow-up question
      return "Thank you for your response. That's a good approach to the problem.";
      
    } catch (error) {
      console.error(`❌ Error processing response for ${this.metadata.name}:`, error);
      return "Thank you for your response. Let's continue with the next question.";
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
    return responses.length >= Math.min(3, this.metadata.maxQuestions || 5);
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
|- Duration per question: ~${Math.floor(context.interviewConfig.duration / (this.metadata.maxQuestions || 5))} minutes

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
        .slice(0, this.metadata.maxQuestions || 5);
        
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
        type: this.getQuestionCategory() || 'general',
        category: this.getQuestionCategory() || 'general',
        difficulty: 'medium',
        expectedDuration: 180,
        tags: ['fallback', this.metadata.specialty || 'general'],
        metadata: {
          topic: 'general'
        }
      }
    ];
  }

  protected getQuestionCount(context: InterviewContext): number {
    const remainingTime = context.interviewConfig.duration;
    const avgTimePerQuestion = this.metadata.averageDuration || 5;
    const maxQuestions = Math.min(
      this.metadata.maxQuestions || 5,
      Math.floor(remainingTime / avgTimePerQuestion)
    );
    return Math.max(1, maxQuestions);
  }

  /**
   * Log usage metrics for monitoring and cost tracking
   */
  protected logUsage(context: InterviewContext, responseData: any): void {
    try {
      const usage = responseData?.usage;
      if (usage) {
        console.log(`📊 ${this.metadata.name} usage - Tokens: ${usage.total_tokens} (${usage.prompt_tokens}+${usage.completion_tokens})`);
        
        // TODO: Integrate with Application Insights or monitoring service
        // trackEvent('agent_usage', {
        //   agent: this.metadata.name,
        //   sessionId: context.sessionId,
        //   tokens: usage.total_tokens,
        //   model: this.modelName
        // });
      }
    } catch (error) {
      console.warn(`⚠️ Failed to log usage for ${this.metadata.name}:`, error);
    }
  }

  /**
   * Handle errors with context-aware logging
   */
  protected handleError(error: Error, context: InterviewContext, operation: string): void {
    console.error(`❌ ${this.metadata.name} error in ${operation}:`, {
      error: error.message,
      sessionId: context.sessionId,
      agent: this.metadata.name,
      operation,
      timestamp: new Date().toISOString()
    });
    
    // TODO: Integrate with error tracking service
    // reportError(error, {
    //   context: `agent_${operation}`,
    //   metadata: {
    //     agent: this.metadata.name,
    //     sessionId: context.sessionId
    //   }
    // });
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
  const avgTimePerQuestion = currentAgent.metadata.averageDuration || 5;
  const remainingQuestions = Math.max(0, (currentAgent.metadata.maxQuestions || 5) - completedQuestions);
  return remainingQuestions * avgTimePerQuestion;
}
