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
  private client: AzureOpenAI | null = null;
  private isInitialized = false;
  private conversationHistory: ConversationMessage[] = [];
  private interviewContext: InterviewContext = { type: 'general' };
  
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
   * Build system context from candidate profile
   */
  private buildSystemContext(): string {
    const { currentRole, techStack, yearsExperience, keySkills } = this.candidateProfile;
    const { type, position, company, difficulty } = this.interviewContext;
    
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

    // Reset conversation history and preliminary questions state
    this.conversationHistory = [];
    this.prelimIndex = 0;
    this.candidateProfile = {};

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
   */
  private getOpeningMessage(): string {
    const { type, position } = this.interviewContext;
    const { currentRole, techStack, yearsExperience } = this.candidateProfile;
    
    let greeting = "";
    
    if (position) {
      greeting += `Let's discuss the ${position} position. `;
    }
    
    switch (type) {
      case 'technical':
        // Tailor technical question to their tech stack and experience
        if (parseInt(yearsExperience) < 3) {
          return greeting + `As someone with ${yearsExperience} years of experience in ${techStack}, can you explain a recent project where you used ${techStack.split(',')[0]?.trim() || 'your primary technology'} and what you learned from it?`;
        } else if (parseInt(yearsExperience) < 7) {
          return greeting + `With your ${yearsExperience} years of experience in ${currentRole}, can you describe a challenging technical problem you've solved using ${techStack.split(',')[0]?.trim() || 'your tech stack'} and walk me through your approach?`;
        } else {
          return greeting + `As a senior ${currentRole} with ${yearsExperience} years of experience, can you discuss a complex system design decision you've made and how your experience with ${techStack} influenced your approach?`;
        }
      case 'behavioral':
        return greeting + `As a ${currentRole}, can you tell me about a time when you had to lead a challenging project or initiative and how you handled any obstacles?`;
      default:
        return greeting + `Tell me about your journey as a ${currentRole} and what aspects of your work with ${techStack} you find most rewarding.`;
    }
  }

  /**
   * Process user response and generate next question or comment
   */
  async processUserResponse(userResponse: string): Promise<GenerationResponse> {
    if (!this.isInitialized || !this.client) {
      throw new Error('Azure OpenAI Service not initialized');
    }

    // Check if we're still in preliminary questions phase
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
          questionNumber: 0, // Still in preliminary phase
          isComplete: false
        };
      } else {
        // Preliminary questions complete, build system context
        const systemContext = this.buildSystemContext();
        
        // Initialize conversation history with system context
        this.conversationHistory = [
          { role: 'system', content: systemContext }
        ];
        
        // Set max questions from user's response
        const requestedQuestions = parseInt(this.candidateProfile.questionCount) || 10;
        this.interviewContext.maxQuestions = Math.min(Math.max(requestedQuestions, 5), 20); // Between 5 and 20
        
        // Generate the first real interview question
        const openingMessage = this.getOpeningMessage();
        this.conversationHistory.push({ role: 'assistant', content: openingMessage });
        
        return {
          content: `Great! I now have a better understanding of your background. Let's begin the interview.\n\n${openingMessage}`,
          questionNumber: 1,
          isComplete: false
        };
      }
    }

    // Normal interview flow - add user response to conversation history
    this.conversationHistory.push({ role: 'user', content: userResponse });

    try {
      const completion = await this.client.chat.completions.create({
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
