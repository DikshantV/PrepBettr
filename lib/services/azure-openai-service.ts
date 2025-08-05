import OpenAI from 'openai';
import { fetchAzureSecrets } from '@/lib/azure-config-browser';

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
    
    // Always start with preliminary questions regardless of interview type
    return greeting + "Before we dive into the main interview, I'd like to get to know you better. Could you please tell me about your current role, your years of experience, and the main technologies or skills you work with?";
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
      const completion = await this.retryWithBackoff(async () => {
        return await this.client!.chat.completions.create({
          messages: this.conversationHistory,
          temperature: 0.7,
          max_tokens: 200,
          top_p: 0.9,
          frequency_penalty: 0.1,
          presence_penalty: 0.1,
        });
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
