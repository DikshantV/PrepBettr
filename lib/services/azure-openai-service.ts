import OpenAI from 'openai';
import { fetchAzureSecrets } from '@/lib/azure-config-vercel';
import { InterviewContext } from '@/lib/types/voice';

export interface ConversationMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
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
  private deployment: string = '';
  private conversationHistory: ConversationMessage[] = [];
  private interviewContext: InterviewContext = { 
    type: 'general',
    preliminaryCollected: false,
    currentQuestionCount: 0,
    maxQuestions: 10
  };

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

      this.deployment = secrets.azureOpenAIDeployment;
      this.client = new OpenAI({
        apiKey: secrets.azureOpenAIKey,
        baseURL: `${secrets.azureOpenAIEndpoint}/openai/deployments/${secrets.azureOpenAIDeployment}`,
        defaultQuery: { 'api-version': '2024-08-01-preview' }, // Latest stable API version with gpt-4o support
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
    const previousState = { ...this.interviewContext };
    
    // Merge context while preserving defaults
    this.interviewContext = { 
      ...this.interviewContext, 
      ...context,
      // Ensure defaults are set if not provided
      preliminaryCollected: context.preliminaryCollected ?? this.interviewContext.preliminaryCollected ?? false,
      currentQuestionCount: context.currentQuestionCount ?? this.interviewContext.currentQuestionCount ?? 0,
      maxQuestions: context.maxQuestions ?? this.interviewContext.maxQuestions ?? 10
    };
    
    // Log state transition
    console.log('📋 Interview context updated:', this.interviewContext);
    console.debug('🔄 [STATE_TRANSITION] Interview context changed', {
      from: previousState,
      to: this.interviewContext,
      changes: {
        preliminaryCollected: previousState.preliminaryCollected !== this.interviewContext.preliminaryCollected,
        currentQuestionCount: previousState.currentQuestionCount !== this.interviewContext.currentQuestionCount,
        maxQuestions: previousState.maxQuestions !== this.interviewContext.maxQuestions
      },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get system prompt based on interview context
   */
  private getSystemPrompt(): string {
    const { type, position, company, difficulty } = this.interviewContext;
    
    let basePrompt = `You are an experienced AI interviewer conducting a ${type} interview. Your goal is to create an engaging, realistic interview experience that helps candidates prepare effectively.

Core Interview Principles:
1. Ask relevant, progressively challenging questions
2. Provide thoughtful follow-ups based on candidate responses
3. Maintain a professional yet conversational tone
4. Show genuine interest in the candidate's experiences
5. Adapt question difficulty based on their expertise level
6. Give brief encouraging feedback when appropriate
7. Keep responses concise (50-80 words) and ask one question at a time

`;

    if (position) {
      basePrompt += `Target Position: ${position}\n`;
    }
    if (company) {
      basePrompt += `Company Context: ${company}\n`;
    }
    if (difficulty) {
      basePrompt += `Difficulty Level: ${difficulty}\n`;
    }

    switch (type) {
      case 'technical':
        basePrompt += `\nTechnical Interview Focus:
- Start with foundational concepts, then progress to complex scenarios
- Ask about specific technologies, algorithms, and system design
- Explore problem-solving approaches and trade-offs
- Include practical coding scenarios and architecture discussions
- Ask "How would you optimize this?" or "What challenges might arise?"
- Focus on real-world application of technical knowledge`;
        break;
      case 'behavioral':
        basePrompt += `\nBehavioral Interview Focus:
- Use STAR method (Situation, Task, Action, Result) evaluation
- Ask about leadership, teamwork, conflict resolution, and growth
- Explore past experiences with specific examples
- Ask follow-ups like "What would you do differently?" or "What did you learn?"
- Focus on cultural fit, communication skills, and problem-solving approach
- Include questions about handling failures and difficult situations`;
        break;
      default:
        basePrompt += `\nGeneral Interview Focus:
- Balance background, experience, motivation, and role fit
- Ask about career goals, interests, and what excites them about the opportunity
- Explore their understanding of the role and company
- Include questions about learning style and professional development
- Ask about their greatest achievements and challenges`;
    }

    basePrompt += `\n\nInterview Style:
- Be conversational and show active listening
- Acknowledge good points: "That's a great approach" or "Interesting perspective"
- Ask natural follow-ups that build on their responses
- Create a comfortable environment that encourages detailed answers`;
    
    return basePrompt;
  }

  /**
   * Start a new interview conversation
   */
  async startInterviewConversation(): Promise<GenerationResponse> {
    console.log('🚀 [TRACE] startInterviewConversation called', {
      timestamp: new Date().toISOString(),
      interviewContext: this.interviewContext,
      isInitialized: this.isInitialized,
      callStack: new Error().stack?.split('\n').slice(0, 5).join('\n')
    });
    
    if (!this.isInitialized || !this.client) {
      throw new Error('Azure OpenAI Service not initialized');
    }

    // Reset conversation history
    this.conversationHistory = [
      { role: 'system', content: this.getSystemPrompt() }
    ];

    const openingMessage = this.getOpeningMessage();
    
    console.log('📢 [TRACE] Opening message generated', {
      message: openingMessage,
      interviewType: this.interviewContext.type,
      isPreliminaryQuestion: openingMessage.includes('tell me about your current role'),
      timestamp: new Date().toISOString()
    });
    
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
    const { type, position, preliminaryCollected } = this.interviewContext;
    
    console.log('🎯 [TRACE] getOpeningMessage called', {
      type,
      position,
      preliminaryCollected,
      timestamp: new Date().toISOString(),
      callStack: new Error().stack?.split('\n').slice(0, 5).join('\n')
    });
    
    // Always greet user
    let greeting = "Hello! I'm excited to interview you today. ";
    
    if (position) {
      greeting += `We'll be discussing the ${position} position. `;
    }
    
    // Build opening message dynamically based on preliminaryCollected flag
    if (!preliminaryCollected) {
      // Append the single preliminary request
      return greeting + "Before we dive into the main interview, I'd like to get to know you better. Could you please tell me about your current role, your years of experience, and the main technologies or skills you work with?";
    } else {
      // Immediately ask first domain-specific question
      return greeting + this.generateFirstInterviewQuestion();
    }
  }

  /**
   * Generate the first interview question based on interview type
   */
  private generateFirstInterviewQuestion(): string {
    const { type, position, company, difficulty } = this.interviewContext;
    
    switch (type) {
      case 'technical':
        if (difficulty === 'easy') {
          return "Let's start with some fundamentals. Can you explain the difference between an array and a linked list, and when you would choose one over the other?";
        } else if (difficulty === 'hard') {
          return "Let's dive into system design. How would you design a distributed caching system that can handle millions of requests per second with sub-millisecond latency?";
        } else {
          return "To get started, can you walk me through a recent technical challenge you faced and how you approached solving it?";
        }
        
      case 'behavioral':
        if (company) {
          return `Tell me about a time when you had to work with a difficult team member. How did you handle the situation and what was the outcome?`;
        } else {
          return "Can you describe a situation where you had to lead a project or initiative? What was your approach and what did you learn from the experience?";
        }
        
      default:
        if (position) {
          return `What specifically interests you about this ${position} role, and how does it align with your career goals?`;
        } else {
          return "What motivated you to pursue this opportunity, and what unique value do you think you can bring to our team?";
        }
    }
  }

  /**
   * Process user response and generate next question or comment
   */
  async processUserResponse(userResponse: string): Promise<GenerationResponse> {
    console.log('💬 [TRACE] processUserResponse called', {
      userResponse: userResponse.substring(0, 100) + '...',
      historyLength: this.conversationHistory.length,
      preliminaryCollected: this.interviewContext.preliminaryCollected,
      currentQuestionCount: this.interviewContext.currentQuestionCount,
      maxQuestions: this.interviewContext.maxQuestions,
      timestamp: new Date().toISOString(),
      callStack: new Error().stack?.split('\n').slice(0, 5).join('\n')
    });
    
    if (!this.isInitialized || !this.client) {
      throw new Error('Azure OpenAI Service not initialized');
    }

    // Check if we're still collecting preliminary information
    if (!this.interviewContext.preliminaryCollected) {
      console.debug('🎯 [PRELIMINARY] Processing preliminary response', {
        userResponseLength: userResponse.length,
        timestamp: new Date().toISOString()
      });
      
      // Process the preliminary response and set flag
      const previousPreliminaryState = this.interviewContext.preliminaryCollected;
      this.interviewContext.preliminaryCollected = true;
      
      console.debug('🔄 [STATE_TRANSITION] preliminaryCollected: false → true', {
        previousState: previousPreliminaryState,
        newState: true,
        timestamp: new Date().toISOString()
      });
      
      // Keep currentQuestionCount at 0 since we haven't asked real questions yet
      this.interviewContext.currentQuestionCount = 0;
      
      // Generate first real interview question
      const firstQuestion = this.generateFirstInterviewQuestion();
      this.conversationHistory.push({ role: 'assistant', content: firstQuestion });
      
      // Increment to 1 for the first real question
      const previousQuestionCount = this.interviewContext.currentQuestionCount;
      this.interviewContext.currentQuestionCount = 1;
      
      console.debug('🔄 [STATE_TRANSITION] questionNumber: 0 → 1', {
        previousCount: previousQuestionCount,
        newCount: 1,
        isFirstRealQuestion: true,
        timestamp: new Date().toISOString()
      });
      
      return {
        content: `Thank you for that information! Now let's begin the interview.\n\n${firstQuestion}`,
        questionNumber: 1,
        isComplete: false,
        followUpSuggestions: this.generateFollowUpSuggestions()
      };
    }

    // Normal interview flow - add user response to conversation history
    this.conversationHistory.push({ role: 'user', content: userResponse });
    
    console.log('📝 [TRACE] User response added to history', {
      historyLength: this.conversationHistory.length,
      timestamp: new Date().toISOString()
    });

    try {
      const completion = await this.retryWithBackoff(async () => {
        return await this.client!.chat.completions.create({
          model: this.deployment,
          messages: this.conversationHistory,
          temperature: 0.7, // Match Gemini default
          max_tokens: 200,
          top_p: 0.9,
          frequency_penalty: 0.1,
          presence_penalty: 0.1,
        });
      });

      const assistantResponse = completion.choices[0]?.message?.content || 'I\'m sorry, I didn\'t catch that. Could you repeat your answer?';
      
      console.log('🤖 [TRACE] OpenAI response received', {
        response: assistantResponse.substring(0, 100) + '...',
        questionCount: this.interviewContext.currentQuestionCount,
        timestamp: new Date().toISOString()
      });
      
      // Add assistant response to conversation history
      this.conversationHistory.push({ role: 'assistant', content: assistantResponse });

      const previousQuestionCount = this.interviewContext.currentQuestionCount || 0;
      const currentQuestionCount = previousQuestionCount + 1;
      const maxQuestions = this.interviewContext.maxQuestions || 10;
      
      console.log('📊 [TRACE] Question progression', {
        currentQuestionCount,
        maxQuestions,
        isComplete: currentQuestionCount >= maxQuestions,
        willContinue: currentQuestionCount < maxQuestions,
        timestamp: new Date().toISOString()
      });
      
      console.debug('🔄 [STATE_TRANSITION] questionNumber: %d → %d', 
        previousQuestionCount, 
        currentQuestionCount, 
        {
          maxQuestions,
          progressPercentage: Math.round((currentQuestionCount / maxQuestions) * 100),
          remainingQuestions: Math.max(0, maxQuestions - currentQuestionCount),
          timestamp: new Date().toISOString()
        }
      );
      
      // Update question count
      this.interviewContext.currentQuestionCount = currentQuestionCount;

      return {
        content: assistantResponse,
        questionNumber: currentQuestionCount,
        isComplete: currentQuestionCount >= maxQuestions,
        followUpSuggestions: this.generateFollowUpSuggestions()
      };
    } catch (error: any) {
      console.error('❌ Error generating OpenAI response:', error);
      
      // Provide fallback response for common errors
      if (error.status === 429) {
        const fallbackResponse = this.getFallbackResponse(userResponse);
        this.conversationHistory.push({ role: 'assistant', content: fallbackResponse });
        
        const currentQuestionCount = (this.interviewContext.currentQuestionCount || 0) + 1;
        this.interviewContext.currentQuestionCount = currentQuestionCount;
        
        return {
          content: fallbackResponse,
          questionNumber: currentQuestionCount,
          isComplete: false,
          followUpSuggestions: this.generateFollowUpSuggestions()
        };
      }
      
      throw new Error('Failed to generate response');
    }
  }

  /**
   * Retry mechanism with exponential backoff for rate limiting
   */
  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        
        // Don't retry on non-retryable errors
        if (error.status && ![429, 500, 502, 503, 504].includes(error.status)) {
          throw error;
        }
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Calculate delay with exponential backoff
        const delay = error.status === 429 
          ? parseInt(error.headers?.['retry-after'] || '10') * 1000
          : baseDelay * Math.pow(2, attempt);
        
        console.log(`⏳ Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  }

  /**
   * Generate fallback response when AI service is unavailable
   */
  private getFallbackResponse(userResponse: string): string {
    const { type } = this.interviewContext;
    
    const fallbackResponses = {
      technical: [
        "That's an interesting approach. Can you tell me more about the challenges you faced?",
        "I see. How would you optimize this solution for better performance?",
        "Good point. What alternative approaches did you consider?"
      ],
      behavioral: [
        "Thank you for sharing that experience. What was the outcome?",
        "That sounds challenging. What did you learn from that situation?",
        "Interesting. How would you handle a similar situation now?"
      ],
      general: [
        "That's great to hear. Can you elaborate on that?",
        "Interesting background. What motivates you in your work?",
        "I appreciate you sharing that. What are you most proud of?"
      ]
    };
    
    const responses = fallbackResponses[type] || fallbackResponses.general;
    return responses[Math.floor(Math.random() * responses.length)];
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
        model: this.deployment,
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
    const previousState = {
      historyLength: this.conversationHistory.length,
      questionCount: this.interviewContext.currentQuestionCount,
      preliminaryCollected: this.interviewContext.preliminaryCollected
    };
    
    this.conversationHistory = [];
    this.interviewContext.currentQuestionCount = 0;
    this.interviewContext.preliminaryCollected = false;
    
    console.log('🧹 Conversation history cleared');
    console.debug('🔄 [STATE_RESET] Conversation state reset', {
      previousState,
      newState: {
        historyLength: 0,
        questionCount: 0,
        preliminaryCollected: false
      },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Generate questions based on resume information
   */
  async generateQuestions(resumeInfo: {name: string, experience: string, education: string, skills: string}): Promise<string[]> {
    if (!this.isInitialized || !this.client) {
      throw new Error('Azure OpenAI Service not initialized');
    }

    const prompt = `Given the following resume information, generate 5 relevant interview questions. Format each question on a new line. Only return the questions, no additional text.

Name: ${resumeInfo.name}
Experience: ${resumeInfo.experience}
Education: ${resumeInfo.education}
Skills: ${resumeInfo.skills}`;

    try {
      const completion = await this.client.chat.completions.create({
        model: this.deployment,
        messages: [{role: 'system', content: prompt}],
        temperature: 0.5,
        max_tokens: 150
      });

      const response = completion.choices[0]?.message?.content || '';
      return response
        .split('\n')
        .map(q => q.trim())
        .filter(q => q.length > 0)
        .slice(0, 5);
    } catch (error) {
      console.error('❌ Error generating questions:', error);
      throw new Error('Failed to generate questions');
    }
  }

  /**
   * Tailor resume based on job description using Azure OpenAI
   */
  async tailorResume(resumeText: string, jobDescription: string): Promise<string> {
    if (!this.isInitialized || !this.client) {
      throw new Error('Azure OpenAI Service not initialized');
    }

    const prompt = `You are an expert resume writer and ATS optimization specialist. Please tailor this resume to better match the following job description for maximum ATS compatibility and relevance.

JOB DESCRIPTION:
${jobDescription}

CURRENT RESUME:
${resumeText}

Please provide a tailored version of the resume that:
1. Uses keywords and phrases directly from the job description
2. Highlights relevant skills and experiences that match the job requirements
3. Maintains professional formatting and ATS-friendly structure
4. Uses strong action verbs and quantifiable achievements
5. Keeps the same overall length and format structure
6. Optimizes for Applicant Tracking Systems (ATS)
7. Ensures keyword density without keyword stuffing

Return ONLY the tailored resume content with no additional commentary or explanations.`;

    try {
      const completion = await this.retryWithBackoff(async () => {
        return await this.client!.chat.completions.create({
          model: this.deployment,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 2000,
          top_p: 0.9,
          frequency_penalty: 0.1,
          presence_penalty: 0.1,
        });
      });

      const tailoredResume = completion.choices[0]?.message?.content;
      if (!tailoredResume) {
        throw new Error('No response generated');
      }

      return tailoredResume;
    } catch (error) {
      console.error('❌ Error tailoring resume:', error);
      throw error;
    }
  }

  /**
   * Check if service is ready
   */
  isReady(): boolean {
    return this.isInitialized && this.client !== null;
  }

  /**
   * Generate a completion for a given prompt
   */
  async generateCompletion(prompt: string): Promise<string> {
    if (!this.isInitialized || !this.client) {
      throw new Error('Azure OpenAI Service not initialized');
    }

    try {
      const completion = await this.createCompletion([
        {
          role: 'user',
          content: prompt
        }
      ], {
        temperature: 0.7,
        maxTokens: 1000
      });

      return completion.choices[0]?.message?.content || 'Unable to generate completion.';
    } catch (error) {
      console.error('❌ Error generating completion:', error);
      throw new Error('Failed to generate completion');
    }
  }

  /**
   * Create a chat completion with custom parameters
   * Public method for use by adapters
   */
  async createCompletion(
    messages: Array<{ role: 'user' | 'system' | 'assistant'; content: string }>,
    options: {
      temperature?: number;
      maxTokens?: number;
      topP?: number;
      frequencyPenalty?: number;
      presencePenalty?: number;
    } = {}
  ) {
    if (!this.isInitialized || !this.client) {
      throw new Error('Azure OpenAI Service not initialized');
    }

    const {
      temperature = 0.7,     // Default matching Gemini for prompt parity
      maxTokens = 1500,      // Default matching Gemini for prompt parity
      topP = 0.9,            // Maintain creativity balance
      frequencyPenalty = 0.1, // Reduce repetition
      presencePenalty = 0.1   // Encourage diverse content
    } = options;

    return await this.retryWithBackoff(async () => {
      return await this.client!.chat.completions.create({
        model: this.deployment,
        messages,
        temperature,
        max_tokens: maxTokens,
        top_p: topP,
        frequency_penalty: frequencyPenalty,
        presence_penalty: presencePenalty,
      });
    });
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
