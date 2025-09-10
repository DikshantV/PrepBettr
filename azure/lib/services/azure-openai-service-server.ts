import { MigrationOpenAIClient } from '@/lib/azure-ai-foundry/clients/migration-wrapper';
import { fetchAzureSecrets } from '../azure-config';
import { templateEngine } from '@/lib/utils/template-engine';
import path from 'path';
import { 
  ErrorCode, 
  createStructuredError, 
  toStructuredError,
  StructuredError 
} from '@/lib/utils/structured-errors';
import { logServerError } from '@/lib/errors';

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

export class AzureOpenAIServiceServer {
  private client: MigrationOpenAIClient | null = null;
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
   * Initialize the Azure OpenAI service using server-side credential loading
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('🔑 Initializing Azure OpenAI service on server...');
      const secrets = await fetchAzureSecrets();
      
      if (!secrets.azureOpenAIKey || !secrets.azureOpenAIEndpoint || !secrets.azureOpenAIDeployment) {
        console.warn('⚠️ Azure OpenAI credentials not available');
        const error = createStructuredError(
          ErrorCode.SERVICE_NOT_CONFIGURED,
          { service: 'azure-openai', missingCredentials: ['key', 'endpoint', 'deployment'] },
          'Azure OpenAI credentials not available'
        );
        logServerError(new Error(error.message), {
          errorCode: error.code,
          category: error.category,
          details: error.details
        });
        return false;
      }

      this.client = new MigrationOpenAIClient();
      await this.client.init(); // Initialize the migration client
      
      // Store the deployment name for use as model in API calls
      this.modelDeployment = secrets.azureOpenAIDeployment;

      this.isInitialized = true;
      console.log('✅ Azure OpenAI Service (server-side) initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Azure OpenAI Service (server-side):', error);
      const structuredError = toStructuredError(error, ErrorCode.CONFIGURATION_ERROR);
      logServerError(error instanceof Error ? error : new Error(String(error)), {
        errorCode: structuredError.code,
        category: structuredError.category,
        details: structuredError.details
      });
      return false;
    }
  }

  /**
   * Check if the service is ready to use
   */
  isReady(): boolean {
    return this.isInitialized && this.client !== null;
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
   * Build system context from candidate profile using template engine
   */
  private buildSystemContext(): string {
    try {
      // Load the interview prompts template
      const templatePath = path.resolve(process.cwd(), 'config/templates/interview-prompts.yaml');
      const template = templateEngine.loadTemplate(templatePath);
      
      // Build context for template rendering
      const context = {
        candidate: {
          name: this.candidateProfile.currentRole || 'candidate'
        },
        role: this.candidateProfile.currentRole,
        company: this.interviewContext.company,
        interview_type: this.interviewContext.type,
        experience_level: this.candidateProfile.yearsExperience,
        tech_stack: this.candidateProfile.techStack ? this.candidateProfile.techStack.split(',').map(s => s.trim()) : [],
        custom_instructions: this.buildCustomInstructions(),
        sample_questions: this.getSampleQuestions(),
        duration: '45-60 minutes',
        tone: 'professional and encouraging'
      };
      
      return templateEngine.renderFromConfig(template, context);
    } catch (error) {
      console.warn('⚠️ Template engine failed, falling back to legacy prompt building:', error);
      return this.buildSystemContextLegacy();
    }
  }

  /**
   * Build custom instructions based on interview context
   */
  private buildCustomInstructions(): string {
    const { currentQuestionCount, maxQuestions } = this.interviewContext;
    return [
      'Preliminary questions have already been collected - do NOT ask them again',
      `You are currently on interview question ${(currentQuestionCount || 0) + 1} of ${maxQuestions}`,
      'Continue with interview questions based on the candidate\'s profile',
      `After question ${maxQuestions}, conclude the interview and thank the candidate`,
      `Do NOT exceed ${maxQuestions} interview questions`,
      'Keep your responses under 100 words and ask one question at a time'
    ].join('\n');
  }

  /**
   * Get sample questions based on interview type
   */
  private getSampleQuestions(): string[] {
    const { type } = this.interviewContext;
    const { techStack, yearsExperience, currentRole } = this.candidateProfile;
    
    switch (type) {
      case 'technical':
        return [
          `Tell me about a challenging technical problem you've solved using ${techStack}`,
          'How do you approach debugging complex issues?',
          'Describe your experience with system design and scalability',
          'What are your thoughts on code review and best practices?'
        ];
      case 'behavioral':
        return [
          'Tell me about a time when you had to work with a difficult team member',
          'Describe a situation where you had to learn a new technology quickly',
          'How do you handle conflicting priorities and tight deadlines?',
          'Give me an example of when you mentored or helped a colleague'
        ];
      default:
        return [
          'What interests you most about this position?',
          `How has your experience in ${currentRole} prepared you for this role?`,
          'What are your career goals for the next few years?',
          'What motivates you in your work?'
        ];
    }
  }

  /**
   * Legacy system context builder (fallback)
   */
  private buildSystemContextLegacy(): string {
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
   * Start a new interview conversation
   */
  async startInterviewConversation(): Promise<GenerationResponse> {
    if (!this.isInitialized || !this.client) {
      const error = createStructuredError(
        ErrorCode.SERVICE_UNAVAILABLE,
        { service: 'azure-openai' },
        'Azure OpenAI Service not initialized'
      );
      throw error;
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
    console.log('🧪 [AZURE OPENAI] Processing user response', { 
      responseLength: userResponse.length, 
      preliminaryCollected: this.interviewContext.preliminaryCollected,
      currentQuestionCount: this.interviewContext.currentQuestionCount
    });
    
    if (!this.isInitialized || !this.client) {
      console.error('❌ [AZURE OPENAI] Service not initialized');
      const error = createStructuredError(
        ErrorCode.SERVICE_UNAVAILABLE,
        { service: 'azure-openai', context: 'process-user-response' },
        'Azure OpenAI Service not initialized'
      );
      throw error;
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
      console.log('🧪 [AZURE OPENAI] Calling OpenAI API with', {
        model: this.modelDeployment,
        messagesCount: this.conversationHistory.length,
        currentQuestionCount: this.interviewContext.currentQuestionCount
      });
      
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
      
      console.log('✅ [AZURE OPENAI] Got response from OpenAI', {
        responseLength: assistantResponse.length,
        tokensUsed: completion.usage?.total_tokens || 'unknown'
      });
      
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
      console.error('❌ [AZURE OPENAI] Error generating OpenAI response:', error);
      
      // Map to structured error codes
      let structuredError: StructuredError;
      
      if (error && typeof error === 'object' && 'status' in error) {
        const apiError = error as any;
        console.error('❌ [AZURE OPENAI] API Error Details:', {
          status: apiError.status,
          code: apiError.code,
          type: apiError.type,
          message: apiError.message
        });
        
        if (apiError.status === 429) {
          structuredError = createStructuredError(
            ErrorCode.RATE_LIMIT_EXCEEDED,
            { service: 'azure-openai', apiStatus: apiError.status, apiCode: apiError.code },
            'Rate limit exceeded - please try again in a moment'
          );
        } else if (apiError.status === 401 || apiError.status === 403) {
          structuredError = createStructuredError(
            ErrorCode.AUTH_TOKEN_INVALID,
            { service: 'azure-openai', apiStatus: apiError.status },
            'Authentication failed - please check Azure OpenAI credentials'
          );
        } else if (apiError.status === 404) {
          structuredError = createStructuredError(
            ErrorCode.CONFIGURATION_ERROR,
            { service: 'azure-openai', deployment: this.modelDeployment, apiStatus: apiError.status },
            `Model deployment '${this.modelDeployment}' not found`
          );
        } else if (apiError.status >= 500) {
          structuredError = createStructuredError(
            ErrorCode.AZURE_OPENAI_ERROR,
            { service: 'azure-openai', apiStatus: apiError.status, apiType: apiError.type },
            'Azure OpenAI service error'
          );
        } else {
          structuredError = toStructuredError(error, ErrorCode.AZURE_OPENAI_ERROR);
        }
      } else {
        structuredError = toStructuredError(error, ErrorCode.AZURE_OPENAI_ERROR);
      }
      
      // Log the error for monitoring
      logServerError(error instanceof Error ? error : new Error(String(error)), {
        errorCode: structuredError.code,
        category: structuredError.category,
        details: structuredError.details,
        context: 'azure-openai-process-response'
      });
      
      throw structuredError;
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
   * Generate a domain-specific interview question using template engine
   */
  async generateInterviewQuestion(): Promise<string> {
    if (!this.isInitialized || !this.client) {
      const error = createStructuredError(
        ErrorCode.SERVICE_UNAVAILABLE,
        { service: 'azure-openai', context: 'generate-interview-question' },
        'Azure OpenAI Service not initialized'
      );
      throw error;
    }

    try {
      // Load the question generation template
      const templatePath = path.resolve(process.cwd(), 'config/templates/question-templates.yaml');
      const template = templateEngine.loadTemplate(templatePath);
      
      // Build context for template rendering
      const context = {
        role: this.candidateProfile.currentRole || 'Software Developer',
        category: this.interviewContext.type || 'general',
        difficulty: this.getDifficultyLevel(),
        count: 1,
        tech_stack: this.candidateProfile.techStack ? this.candidateProfile.techStack.split(',').map(s => s.trim()) : [],
        experience_level: this.candidateProfile.yearsExperience || 'mid-level',
        custom_requirements: this.interviewContext.position ? `Focus on requirements for ${this.interviewContext.position} position` : undefined
      };
      
      const questionPrompt = templateEngine.renderFromConfig(template, context);
      
      const completion = await this.client.chat.completions.create({
        model: this.modelDeployment,
        messages: [{ role: 'user', content: questionPrompt }],
        temperature: 0.8,
        max_tokens: 100,
        top_p: 0.9,
      });

      const question = completion.choices[0]?.message?.content?.trim() || this.getFallbackQuestion();
      return question;
    } catch (error) {
      console.warn('⚠️ Template-based question generation failed, using legacy method:', error);
      // Log but don't throw - fallback to legacy method
      const structuredError = toStructuredError(error, ErrorCode.AZURE_OPENAI_ERROR);
      logServerError(error instanceof Error ? error : new Error(String(error)), {
        errorCode: structuredError.code,
        category: structuredError.category,
        details: { ...structuredError.details, context: 'template-question-generation' },
        context: 'azure-openai-question-template-fallback'
      });
      return this.generateInterviewQuestionLegacy();
    }
  }

  /**
   * Get difficulty level mapping
   */
  private getDifficultyLevel(): string {
    const experience = parseInt(this.candidateProfile.yearsExperience || '3');
    if (experience <= 2) return 'junior';
    if (experience <= 5) return 'mid';
    if (experience <= 10) return 'senior';
    return 'principal';
  }

  /**
   * Legacy question generation method (fallback)
   */
  private async generateInterviewQuestionLegacy(): Promise<string> {
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
        questionPrompt += `Consider the candidate's role: ${currentRole || 'general position'}.\n`;
        questionPrompt += `Ask about situations involving:\n`;
        questionPrompt += `- Leadership and teamwork\n`;
        questionPrompt += `- Conflict resolution\n`;
        questionPrompt += `- Problem-solving under pressure\n`;
        questionPrompt += `- Learning from failures\n`;
        break;
        
      default:
        questionPrompt += `Ask a general interview question.\n`;
        questionPrompt += `Consider the candidate's background: ${currentRole || 'various roles'} with ${yearsExperience || 'some'} years experience.\n`;
        questionPrompt += `Focus on motivation, goals, and cultural fit.\n`;
    }

    if (difficulty) {
      questionPrompt += `Difficulty level: ${difficulty}.\n`;
    }
    
    if (position) {
      questionPrompt += `Position being interviewed for: ${position}.\n`;
    }

    questionPrompt += `\nReturn only the question text, no additional formatting or explanations.`;

    try {
      const completion = await this.client.chat.completions.create({
        model: this.modelDeployment,
        messages: [{ role: 'user', content: questionPrompt }],
        temperature: 0.8,
        max_tokens: 100,
        top_p: 0.9,
      });

      const question = completion.choices[0]?.message?.content?.trim() || this.getFallbackQuestion();
      return question;
    } catch (error) {
      console.warn('⚠️ Failed to generate interview question, using fallback');
      // Log the error for monitoring but return fallback instead of throwing
      const structuredError = toStructuredError(error, ErrorCode.AZURE_OPENAI_ERROR);
      logServerError(error instanceof Error ? error : new Error(String(error)), {
        errorCode: structuredError.code,
        category: structuredError.category,
        details: { ...structuredError.details, context: 'legacy-question-generation' },
        context: 'azure-openai-question-legacy-fallback'
      });
      return this.getFallbackQuestion();
    }
  }

  /**
   * Get fallback question when generation fails
   */
  private getFallbackQuestion(): string {
    const { type } = this.interviewContext;
    
    switch (type) {
      case 'technical':
        return "Tell me about a challenging technical problem you've solved recently.";
      case 'behavioral':
        return "Can you describe a time when you had to work with a difficult team member?";
      default:
        return "What interests you most about this role?";
    }
  }

  /**
   * Generate interview summary
   */
  async generateInterviewSummary(): Promise<string | null> {
    if (!this.isInitialized || !this.client || this.conversationHistory.length === 0) {
      return null;
    }

    const summaryPrompt = `Based on the following interview conversation, provide a brief summary of the candidate's performance, strengths, and areas for improvement. Keep it concise and professional.\n\nConversation:\n${this.conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}`;

    try {
      const completion = await this.client.chat.completions.create({
        model: this.modelDeployment,
        messages: [{ role: 'user', content: summaryPrompt }],
        temperature: 0.5,
        max_tokens: 300,
      });

      return completion.choices[0]?.message?.content?.trim() || null;
    } catch (error) {
      console.error('❌ Error generating interview summary:', error);
      // Log the error for monitoring but return null instead of throwing
      const structuredError = toStructuredError(error, ErrorCode.AZURE_OPENAI_ERROR);
      logServerError(error instanceof Error ? error : new Error(String(error)), {
        errorCode: structuredError.code,
        category: structuredError.category,
        details: { ...structuredError.details, context: 'interview-summary-generation' },
        context: 'azure-openai-summary-generation'
      });
      return null;
    }
  }

  /**
   * Get conversation history
   */
  getConversationHistory(): ConversationMessage[] {
    return this.conversationHistory;
  }

  /**
   * Reset the service state
   */
  reset(): void {
    this.conversationHistory = [];
    this.prelimIndex = 0;
    this.candidateProfile = {};
    this.interviewContext = { 
      type: 'general',
      preliminaryCollected: false,
      currentQuestionCount: 0,
      maxQuestions: 10
    };
    console.log('🔄 Azure OpenAI Service state reset');
  }
}

// Create and export a singleton instance for use across the application
export const azureOpenAIServiceServer = new AzureOpenAIServiceServer();
