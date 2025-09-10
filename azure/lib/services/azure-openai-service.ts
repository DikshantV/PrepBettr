/**
 * @deprecated This service is deprecated due to security concerns.
 * It attempts to initialize Azure OpenAI from browser environment variables,
 * which exposes credentials in the client-side code.
 * 
 * Use azure-openai-service-server.ts for server-side API routes instead.
 * This file is kept for backward compatibility but should not be used in production.
 */

import { AzureOpenAI } from 'openai';
import { fetchAzureSecrets } from '../../../lib/azure-config-browser';

export interface ConversationMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CandidateProfile {
  currentRole?: string;
  techStack?: string;
  yearsExperience?: string;
  keySkills?: string;
  questionCount?: string;
}

export interface InterviewContext {
  type: 'technical' | 'behavioral' | 'general';
  position?: string;
  company?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  preliminaryCollected?: boolean; // Default: false - Indicates if preliminary info has been collected
  currentQuestionCount?: number; // Current number of questions asked in the interview
  maxQuestions?: number; // Default: 10 - Maximum number of questions for the interview
}

export interface GenerationResponse {
  content: string;
  questionNumber?: number;
  isComplete?: boolean;
  followUpSuggestions?: string[];
}

export class AzureOpenAIService {
  private client: AzureOpenAI | null = null;
  private isInitialized = false;
  private modelDeployment: string = 'gpt-4o'; // Store the deployment name as model
  private conversationHistory: ConversationMessage[] = [];
  private interviewContext: InterviewContext = { 
    type: 'general',
    preliminaryCollected: false,
    currentQuestionCount: 0,
    maxQuestions: 10
  };
  
  // Preliminary questions for gathering candidate profile
  private prelimQuestions = [
    'What is your current role?',
    'What primary tech stack do you use?',
    'How many years of experience do you have?',
    'What are your key skills?',
    'How many interview questions would you like?'
  ];
  private prelimIndex = 0;
  private candidateProfile: Record<string, string> = {};

  /**
   * Initialize the Azure OpenAI service
   */
  async initialize(): Promise<boolean> {
    try {
      const secrets = await fetchAzureSecrets();
      
      if (!secrets.azureOpenAIKey || !secrets.azureOpenAIEndpoint || !secrets.azureOpenAIDeployment) {
        console.warn('⚠️ Azure OpenAI credentials not available');
        return false;
      }

      this.client = new AzureOpenAI({
        apiKey: secrets.azureOpenAIKey,
        endpoint: secrets.azureOpenAIEndpoint,
        deployment: secrets.azureOpenAIDeployment,
        apiVersion: '2024-02-15-preview', // Using stable API version
        dangerouslyAllowBrowser: true
      });
      
      // Store the deployment name for use as model in API calls
      this.modelDeployment = secrets.azureOpenAIDeployment;

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
    // Merge context while preserving defaults
    this.interviewContext = { 
      ...this.interviewContext, 
      ...context,
      // Ensure defaults are set if not provided
      preliminaryCollected: context.preliminaryCollected ?? this.interviewContext.preliminaryCollected ?? false,
      currentQuestionCount: context.currentQuestionCount ?? this.interviewContext.currentQuestionCount ?? 0,
      maxQuestions: context.maxQuestions ?? this.interviewContext.maxQuestions ?? 10
    };
    console.log('📋 Interview context updated:', this.interviewContext);
  }

  /**
   * Build system context from candidate profile
   */
  private buildSystemContext(): string {
    const { currentRole, techStack, yearsExperience, keySkills } = this.candidateProfile;
    const { type, position, company, difficulty, currentQuestionCount, maxQuestions } = this.interviewContext;
    
    let systemPrompt = `You are an AI interviewer conducting a ${type} interview with a candidate.\n\n`;
    systemPrompt += `Candidate Profile:\n`;
    systemPrompt += `- Current Role: ${currentRole}\n`;
    systemPrompt += `- Tech Stack: ${techStack}\n`;
    systemPrompt += `- Years of Experience: ${yearsExperience}\n`;
    systemPrompt += `- Key Skills: ${keySkills}\n\n`;
    
    systemPrompt += `Interview Guidelines:\n`;
    systemPrompt += `1. Ask relevant, engaging questions tailored to their experience level\n`;
    systemPrompt += `2. Follow up on answers with clarifying questions\n`;
    systemPrompt += `3. Maintain a professional but friendly tone\n`;
    systemPrompt += `4. Keep responses concise and focused\n`;
    systemPrompt += `5. Adapt difficulty based on their experience and responses\n\n`;
    
    systemPrompt += `Interview Flow Control:\n`;
    systemPrompt += `• Preliminary questions have already been collected - do NOT ask them again\n`;
    systemPrompt += `• You are currently on interview question ${(currentQuestionCount || 0) + 1} of ${maxQuestions}\n`;
    systemPrompt += `• Continue with interview questions based on the candidate's profile\n`;
    systemPrompt += `• After question ${maxQuestions}, conclude the interview and thank the candidate\n`;
    systemPrompt += `• Do NOT exceed ${maxQuestions} interview questions\n\n`;
    
    if (position) {
      systemPrompt += `Position: ${position}\n`;
    }
    if (company) {
      systemPrompt += `Company: ${company}\n`;
    }
    if (difficulty) {
      systemPrompt += `Difficulty Level: ${difficulty}\n`;
    }
    
    switch (type) {
      case 'technical':
        systemPrompt += `\nFocus on technical skills relevant to their tech stack (${techStack}), problem-solving, coding concepts, and system design appropriate for someone with ${yearsExperience} years of experience.`;
        break;
      case 'behavioral':
        systemPrompt += `\nFocus on behavioral questions about teamwork, leadership, conflict resolution, and past experiences relevant to someone in a ${currentRole} role.`;
        break;
      default:
        systemPrompt += `\nAsk a mix of questions about background, experience, goals, and general fit for the role, considering their ${yearsExperience} years of experience in ${currentRole}.`;
    }
    
    systemPrompt += `\n\nKeep your responses under 100 words and ask one question at a time.`;
    return systemPrompt;
  }

  /**
   * Get system prompt based on interview context
   */
  private getSystemPrompt(): string {
    const { type, position, company, difficulty, preliminaryCollected, currentQuestionCount, maxQuestions } = this.interviewContext;
    
    let basePrompt = `You are an AI interviewer conducting a ${type} interview. You should:\n\n1. Ask relevant, engaging questions\n2. Follow up on answers with clarifying questions\n3. Maintain a professional but friendly tone\n4. Keep responses concise and focused\n5. Adapt difficulty based on candidate responses\n\nInterview Flow Instructions:\n• Ask preliminary questions (role, tech stack, experience, skills) only once at the beginning\n• After preliminary data is collected (preliminaryCollected = ${preliminaryCollected}), switch to actual interview questions\n• Keep track of question numbers - you are currently on question ${(currentQuestionCount || 0) + 1} of ${maxQuestions}\n• Increment the question number each time you ask a new interview question\n• Stop asking questions after reaching ${maxQuestions} questions and thank the candidate for their time\n• Do NOT repeat preliminary questions once they have been collected\n• Do NOT exceed the maximum number of questions (${maxQuestions})\n\n`;

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
   * Get the OpenAI client instance
   * @returns The AzureOpenAI client instance or null if not initialized
   */
  async getClient(): Promise<AzureOpenAI | null> {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) {
        return null;
      }
    }
    return this.client;
  }

  /**
   * Start a new interview conversation
   */
  async startInterviewConversation(): Promise<GenerationResponse> {
    if (!this.isInitialized || !this.client) {
      throw new Error('Azure OpenAI Service not initialized');
    }

    // Reset conversation history and preliminary questions state
    this.conversationHistory = [];
    this.prelimIndex = 0;
    this.candidateProfile = {};
    // Reset interview context flags
    this.interviewContext.preliminaryCollected = false;
    this.interviewContext.currentQuestionCount = 0;

    // Send greeting + first preliminary question
    const greeting = "Hello! Welcome to your interview practice session. Before we begin, I'd like to learn a bit about you.";
    const firstQuestion = this.prelimQuestions[0];
    const openingMessage = `${greeting}\n\n${firstQuestion}`;

    return {
      content: openingMessage,
      questionNumber: 0, // 0 indicates preliminary questions
      isComplete: false
    };
  }

  /**
   * Get opening message based on interview type
   * Uses generateInterviewQuestion helper for domain-specific questions
   */
  private async getOpeningMessage(): Promise<string> {
    const { position } = this.interviewContext;
    
    let greeting = "";
    
    if (position) {
      greeting += `Let's discuss the ${position} position. `;
    }
    
    try {
      // Use the helper to generate a domain-specific opening question
      const question = await this.generateInterviewQuestion();
      return greeting + question;
    } catch (error) {
      console.warn('⚠️ Falling back to default opening question');
      // Fallback to a simpler approach if generation fails
      return greeting + this.getFallbackQuestion();
    }
  }

  /**
   * Process user response and generate next question or comment
   */
  async processUserResponse(userResponse: string): Promise<GenerationResponse> {
    if (!this.isInitialized || !this.client) {
      throw new Error('Azure OpenAI Service not initialized');
    }

    // Check if we're still collecting preliminary information
    if (!this.interviewContext.preliminaryCollected) {
      // We're in preliminary phase - check if we still have questions to ask
      if (this.prelimIndex < this.prelimQuestions.length) {
        // Store the user's answer to the current preliminary question
        const questionKeys = ['currentRole', 'techStack', 'yearsExperience', 'keySkills', 'questionCount'];
        this.candidateProfile[questionKeys[this.prelimIndex]] = userResponse;
        
        // Increment to next preliminary question
        this.prelimIndex++;
        
        // If there are more preliminary questions, return the next one
        if (this.prelimIndex < this.prelimQuestions.length) {
          const nextQuestion = this.prelimQuestions[this.prelimIndex];
          return {
            content: `Thank you! ${nextQuestion}`,
            questionNumber: 0, // Still in preliminary phase - keep at 0
            isComplete: false
          };
        } else {
          // All preliminary questions collected - mark as complete
          this.interviewContext.preliminaryCollected = true;
          // Keep currentQuestionCount at 0 as we haven't asked real questions yet
          this.interviewContext.currentQuestionCount = 0;
          
          // Build system context from collected profile
          const systemContext = this.buildSystemContext();
          
          // Initialize conversation history with system context
          this.conversationHistory = [
            { role: 'system', content: systemContext }
          ];
          
          // Set max questions from user's response
          const requestedQuestions = parseInt(this.candidateProfile.questionCount) || 10;
          this.interviewContext.maxQuestions = Math.min(Math.max(requestedQuestions, 5), 20); // Between 5 and 20
          
          // Generate the first real interview question
          const openingMessage = await this.getOpeningMessage();
          this.conversationHistory.push({ role: 'assistant', content: openingMessage });
          
          // Increment question count for the first real question
          this.interviewContext.currentQuestionCount = 1;
          
          return {
            content: `Great! I now have a better understanding of your background. Let's begin the interview.\n\n${openingMessage}`,
            questionNumber: 1, // First real question
            isComplete: false
          };
        }
      }
    }

    // Normal interview flow - preliminary info has been collected
    // Add user response to conversation history
    this.conversationHistory.push({ role: 'user', content: userResponse });

    try {
      const completion = await this.client.chat.completions.create({
        model: this.modelDeployment,
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

      // Increment question count for the next question
      const currentQuestionCount = (this.interviewContext.currentQuestionCount || 0) + 1;
      const maxQuestions = this.interviewContext.maxQuestions || 10;
      
      // Update question count in context
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
   * Generate a domain-specific interview question based on context and conversation history
   * This helper generates a single, concise question tailored to the interview type and candidate profile
   */
  async generateInterviewQuestion(): Promise<string> {
    if (!this.isInitialized || !this.client) {
      throw new Error('Azure OpenAI Service not initialized');
    }

    // Build the appropriate system prompt based on interview type and profile
    const { type, difficulty, position } = this.interviewContext;
    const { currentRole, techStack, yearsExperience, keySkills } = this.candidateProfile;
    
    let questionPrompt = `Generate one concise interview question. `;
    
    // Add context-specific instructions based on interview type
    switch (type) {
      case 'technical':
        questionPrompt += `Focus on technical skills and problem-solving.\n`;
        questionPrompt += `Consider the candidate's tech stack: ${techStack || 'various technologies'}.\n`;
        questionPrompt += `Experience level: ${yearsExperience || 'mid-level'} years.\n`;
        questionPrompt += `Include specific technical scenarios such as:\n`;
        questionPrompt += `- Code/architecture design challenges\n`;
        questionPrompt += `- Debugging or optimization problems\n`;
        questionPrompt += `- Technology-specific best practices\n`;
        questionPrompt += `- System scalability considerations\n`;
        break;
        
      case 'behavioral':
        questionPrompt += `Focus on behavioral assessment using STAR method.\n`;
        questionPrompt += `Current role: ${currentRole || 'professional'}.\n`;
        questionPrompt += `Experience: ${yearsExperience || 'several'} years.\n`;
        questionPrompt += `Create STAR-format prompts about:\n`;
        questionPrompt += `- Leadership and teamwork situations\n`;
        questionPrompt += `- Conflict resolution examples\n`;
        questionPrompt += `- Project management challenges\n`;
        questionPrompt += `- Professional growth moments\n`;
        break;
        
      default: // 'general'
        questionPrompt += `Focus on overall experience and motivation.\n`;
        questionPrompt += `Role: ${currentRole || 'professional'}.\n`;
        questionPrompt += `Skills: ${keySkills || 'various competencies'}.\n`;
        questionPrompt += `Cover aspects such as:\n`;
        questionPrompt += `- Career journey and transitions\n`;
        questionPrompt += `- Professional motivations and goals\n`;
        questionPrompt += `- Work style and preferences\n`;
        questionPrompt += `- Learning and adaptation experiences\n`;
    }
    
    // Add difficulty adjustment
    if (difficulty) {
      questionPrompt += `\nDifficulty level: ${difficulty}.`;
    }
    
    // Add position context if available
    if (position) {
      questionPrompt += `\nPosition being interviewed for: ${position}.`;
    }
    
    // Add instruction for question format
    questionPrompt += `\n\nRequirements:\n`;
    questionPrompt += `- Make the question specific and actionable\n`;
    questionPrompt += `- Keep it under 50 words\n`;
    questionPrompt += `- Avoid yes/no questions\n`;
    questionPrompt += `- Ensure it's appropriate for the experience level\n`;
    
    // Consider conversation history for context continuity
    const recentContext = this.conversationHistory.slice(-4); // Last 2 exchanges
    if (recentContext.length > 0) {
      questionPrompt += `\n\nBuild upon but don't repeat topics from recent conversation.`;
    }

    try {
      // Create the messages array with system context and the prompt
      const messages: ConversationMessage[] = [
        {
          role: 'system',
          content: this.buildSystemContext()
        },
        ...recentContext,
        {
          role: 'user',
          content: questionPrompt
        }
      ];

      const completion = await this.client.chat.completions.create({
        model: this.modelDeployment,
        messages,
        temperature: 0.8, // Slightly higher for more variety
        max_tokens: 100,
        top_p: 0.9,
        frequency_penalty: 0.3, // Reduce repetition
        presence_penalty: 0.2,
      });

      const question = completion.choices[0]?.message?.content || 
        this.getFallbackQuestion();
      
      return question.trim();
    } catch (error) {
      console.error('❌ Error generating interview question:', error);
      // Return a fallback question based on type
      return this.getFallbackQuestion();
    }
  }

  /**
   * Get a fallback question when generation fails
   */
  private getFallbackQuestion(): string {
    const { type } = this.interviewContext;
    const { currentRole, techStack, yearsExperience } = this.candidateProfile;
    
    switch (type) {
      case 'technical':
        return `Can you describe a technical challenge you've faced with ${techStack || 'your current tech stack'} and how you solved it?`;
      case 'behavioral':
        return `Tell me about a time when you had to work with a difficult team member. How did you handle the situation?`;
      default:
        return `What interests you most about this opportunity and how does it align with your career goals?`;
    }
  }

  /**
   * Generate a completion for a given prompt
   */
  async generateCompletion(prompt: string): Promise<string> {
    if (!this.isInitialized || !this.client) {
      throw new Error('Azure OpenAI Service not initialized');
    }

    try {
      const completion = await this.client.chat.completions.create({
        model: this.modelDeployment,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      return completion.choices[0]?.message?.content || 'Unable to generate completion.';
    } catch (error) {
      console.error('❌ Error generating completion:', error);
      throw new Error('Failed to generate completion');
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
        model: this.modelDeployment,
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
    this.interviewContext.preliminaryCollected = false;
    this.prelimIndex = 0;
    this.candidateProfile = {};
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
