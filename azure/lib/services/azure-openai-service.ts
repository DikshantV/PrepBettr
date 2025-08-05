import OpenAI from 'openai';
import { fetchAzureSecrets } from '../../lib/azure-config-browser';

export interface ConversationMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface InterviewContext {
  type: 'technical' | 'behavioral' | 'general';
  position?: string;
  company?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  currentQuestionCount?: number;
  maxQuestions?: number;
}

export interface GenerationResponse {
  content: string;
  questionNumber?: number;
  isComplete?: boolean;
  followUpSuggestions?: string[];
}

export class AzureOpenAIService {
  private client: OpenAI | null = null;
  private isInitialized = false;
  private conversationHistory: ConversationMessage[] = [];
  private interviewContext: InterviewContext = { type: 'general' };

  /**
   * Initialize the Azure OpenAI service
   */
  async initialize(): Promise<boolean> {
    try {
      const secrets = await fetchAzureSecrets();
      
      if (!secrets.azureOpenAIKey || !secrets.azureOpenAIEndpoint) {
        console.warn('⚠️ Azure OpenAI credentials not available');
        return false;
      }

      this.client = new OpenAI({
        apiKey: secrets.azureOpenAIKey,
        baseURL: `${secrets.azureOpenAIEndpoint}/openai/deployments/${secrets.azureOpenAIDeployment}`,
        defaultQuery: { 'api-version': '2024-08-01-preview' },
        defaultHeaders: {
          'api-key': secrets.azureOpenAIKey,
        },
      });

      this.isInitialized = true;
      console.log('✅ Azure OpenAI Service initialized');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Azure OpenAI Service:', error);
      return false;
    }
  }

  /**
   * Set interview context for conversation management
   */
  setInterviewContext(context: Partial<InterviewContext>): void {
    this.interviewContext = { ...this.interviewContext, ...context };
    console.log('📋 Interview context updated:', this.interviewContext);
  }

  /**
   * Get system prompt based on interview context
   */
  private getSystemPrompt(): string {
    const { type, position, company, difficulty } = this.interviewContext;
    
    let basePrompt = `You are an AI interviewer conducting a ${type} interview. You should:\n\n1. Ask relevant, engaging questions\n2. Follow up on answers with clarifying questions\n3. Maintain a professional but friendly tone\n4. Keep responses concise and focused\n5. Adapt difficulty based on candidate responses\n\n`;

    if (position) {
      basePrompt += `Position: ${position}\n`;
    }
    if (company) {
      basePrompt += `Company: ${company}\n`;
    }
    if (difficulty) {
      basePrompt += `Difficulty Level: ${difficulty}\n`;
    }

    switch (type) {
      case 'technical':
        basePrompt += `\nFocus on technical skills, problem-solving, coding concepts, and system design. Ask about specific technologies, algorithms, and best practices.`;
        break;
      case 'behavioral':
        basePrompt += `\nFocus on behavioral questions about teamwork, leadership, conflict resolution, and past experiences. Use the STAR method for evaluation.`;
        break;
      default:
        basePrompt += `\nAsk a mix of questions about background, experience, goals, and general fit for the role.`;
    }

    basePrompt += `\n\nKeep your responses under 100 words and ask one question at a time.`;
    return basePrompt;
  }

  /**
   * Start a new interview conversation
   */
  async startInterviewConversation(): Promise<GenerationResponse> {
    if (!this.isInitialized || !this.client) {
      throw new Error('Azure OpenAI Service not initialized');
    }

    // Reset conversation history
    this.conversationHistory = [
      { role: 'system', content: this.getSystemPrompt() }
    ];

    const openingMessage = this.getOpeningMessage();
    this.conversationHistory.push({ role: 'assistant', content: openingMessage });

    return {
      content: openingMessage,
      questionNumber: 1,
      isComplete: false
    };
  }

  /**
   * Get opening message based on interview type
   */
  private getOpeningMessage(): string {
    const { type, position } = this.interviewContext;
    
    let greeting = "Hello! I'm excited to interview you today. ";
    
    if (position) {
      greeting += `We'll be discussing the ${position} position. `;
    }
    
    switch (type) {
      case 'technical':
        return greeting + "Let's start with a technical question. Can you tell me about a challenging programming problem you've solved recently and walk me through your approach?";
      case 'behavioral':
        return greeting + "Let's begin with a behavioral question. Can you tell me about a time when you had to work with a difficult team member and how you handled the situation?";
      default:
        return greeting + "Let's start by having you tell me about yourself and what interests you about this opportunity.";
    }
  }

  /**
   * Process user response and generate next question or comment
   */
  async processUserResponse(userResponse: string): Promise<GenerationResponse> {
    if (!this.isInitialized || !this.client) {
      throw new Error('Azure OpenAI Service not initialized');
    }

    // Add user response to conversation history
    this.conversationHistory.push({ role: 'user', content: userResponse });

    try {
      const completion = await this.client.chat.completions.create({
        model: 'gpt-4o',
        messages: this.conversationHistory,
        temperature: 0.7,
        max_tokens: 200,
        top_p: 0.9,
        frequency_penalty: 0.1,
        presence_penalty: 0.1,
      });

      const assistantResponse = completion.choices[0]?.message?.content || 'I\'m sorry, I didn\'t catch that. Could you repeat your answer?';
      
      // Add assistant response to conversation history
      this.conversationHistory.push({ role: 'assistant', content: assistantResponse });

      const currentQuestionCount = (this.interviewContext.currentQuestionCount || 0) + 1;
      const maxQuestions = this.interviewContext.maxQuestions || 10;
      
      // Update question count
      this.interviewContext.currentQuestionCount = currentQuestionCount;

      return {
        content: assistantResponse,
        questionNumber: currentQuestionCount,
        isComplete: currentQuestionCount >= maxQuestions,
        followUpSuggestions: this.generateFollowUpSuggestions()
      };
    } catch (error) {
      console.error('❌ Error generating OpenAI response:', error);
      throw new Error('Failed to generate response');
    }
  }

  /**
   * Generate follow-up suggestions based on conversation
   */
  private generateFollowUpSuggestions(): string[] {
    const { type } = this.interviewContext;
    
    switch (type) {
      case 'technical':
        return [
          "Can you explain your thought process?",
          "What would you do differently?",
          "How would this scale?"
        ];
      case 'behavioral':
        return [
          "What was the outcome?",
          "What did you learn?",
          "How would you handle it now?"
        ];
      default:
        return [
          "Can you elaborate on that?",
          "What was your biggest challenge?",
          "What motivates you?"
        ];
    }
  }

  /**
   * Generate interview summary and feedback
   */
  async generateInterviewSummary(): Promise<string> {
    if (!this.isInitialized || !this.client) {
      throw new Error('Azure OpenAI Service not initialized');
    }

    const summaryPrompt = {
      role: 'system' as const,
      content: `Based on the interview conversation, provide a brief summary of the candidate's performance, highlighting:\n1. Key strengths demonstrated\n2. Areas for improvement\n3. Overall assessment\n4. Recommendation\n\nKeep it concise and constructive (under 200 words).`
    };

    try {
      const completion = await this.client.chat.completions.create({
        model: 'gpt-4o',
        messages: [...this.conversationHistory, summaryPrompt],
        temperature: 0.3,
        max_tokens: 300,
      });

      return completion.choices[0]?.message?.content || 'Unable to generate summary.';
    } catch (error) {
      console.error('❌ Error generating interview summary:', error);
      throw new Error('Failed to generate summary');
    }
  }

  /**
   * Get conversation history
   */
  getConversationHistory(): ConversationMessage[] {
    return this.conversationHistory.filter(msg => msg.role !== 'system');
  }

  /**
   * Clear conversation history
   */
  clearConversation(): void {
    this.conversationHistory = [];
    this.interviewContext.currentQuestionCount = 0;
    console.log('🧹 Conversation history cleared');
  }

  /**
   * Check if service is ready
   */
  isReady(): boolean {
    return this.isInitialized && this.client !== null;
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.client = null;
    this.isInitialized = false;
    this.conversationHistory = [];
    console.log('🧹 Azure OpenAI Service disposed');
  }
}

// Export singleton instance
export const azureOpenAIService = new AzureOpenAIService();
