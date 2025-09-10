/**
 * Enhanced Azure OpenAI Service with Multi-Deployment Support
 * 
 * This service provides intelligent model selection based on task type:
 * - gpt-35-turbo: Fast, cost-effective for simple tasks (relevancy scoring, basic Q&A)
 * - gpt-4o: Advanced reasoning for complex tasks (cover letters, resume tailoring)
 */

import { MigrationOpenAIClient as OpenAI } from '@/lib/azure-ai-foundry/clients/migration-wrapper';
import { fetchAzureSecrets } from '@/lib/azure-config-browser';

interface ModelConfiguration {
  deployment: string;
  temperature: number;
  maxTokens: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

interface TaskConfigurations {
  [key: string]: ModelConfiguration;
}

export class EnhancedAzureOpenAIService {
  private clients: Map<string, OpenAI> = new Map();
  private isInitialized = false;
  private secrets: any = null;

  // Task-specific configurations optimized for different models
  private taskConfigurations: TaskConfigurations = {
    // Fast tasks - use gpt-35-turbo for efficiency
    'relevancy': {
      deployment: 'gpt-4o',
      temperature: 0.1,      // Low temperature for consistent scoring
      maxTokens: 50,         // Short numeric response
      topP: 0.9,
      frequencyPenalty: 0.0,
      presencePenalty: 0.0
    },
    
    'questions': {
      deployment: 'gpt-4o',
      temperature: 0.5,      // Moderate creativity for question variety
      maxTokens: 300,        // Multiple questions
      topP: 0.9,
      frequencyPenalty: 0.1,
      presencePenalty: 0.1
    },

    // Complex tasks - use gpt-4o for quality
    'cover-letter': {
      deployment: 'gpt-4o',
      temperature: 0.7,      // Balanced creativity for quality output
      maxTokens: 1500,       // Full cover letter
      topP: 0.9,
      frequencyPenalty: 0.1,
      presencePenalty: 0.1
    },

    'resume-tailor': {
      deployment: 'gpt-4o',
      temperature: 0.3,      // Lower temperature for precision
      maxTokens: 2000,       // Full resume content
      topP: 0.9,
      frequencyPenalty: 0.1,
      presencePenalty: 0.1
    },

    // Interview tasks - use gpt-4o for nuanced conversation
    'interview': {
      deployment: 'gpt-4o',
      temperature: 0.7,      // Natural conversation
      maxTokens: 200,        // Concise responses
      topP: 0.9,
      frequencyPenalty: 0.1,
      presencePenalty: 0.1
    }
  };

  /**
   * Initialize the service with multiple deployment clients
   */
  async initialize(): Promise<boolean> {
    try {
      this.secrets = await fetchAzureSecrets();
      
      if (!this.secrets.azureOpenAIKey || !this.secrets.azureOpenAIEndpoint) {
        console.warn('⚠️ Azure OpenAI credentials not available');
        return false;
      }

      // Initialize clients for different deployments
      const deployments = [
        { name: 'gpt-4o', deployment: this.secrets.azureOpenAIGpt35Deployment || 'gpt-4o' },
        { name: 'gpt-4o', deployment: this.secrets.azureOpenAIGpt4oDeployment || 'gpt-4o' },
        { name: 'default', deployment: this.secrets.azureOpenAIDeployment }
      ];

      for (const { name, deployment } of deployments) {
        if (deployment) {
          const client = new OpenAI();
          await client.init(); // Initialize the migration client
          
          this.clients.set(name, client);
          console.log(`✅ Azure OpenAI client initialized for ${name} (${deployment})`);
        }
      }

      this.isInitialized = this.clients.size > 0;
      
      if (this.isInitialized) {
        console.log(`✅ Enhanced Azure OpenAI Service initialized with ${this.clients.size} clients`);
      }
      
      return this.isInitialized;
    } catch (error) {
      console.error('❌ Failed to initialize Enhanced Azure OpenAI Service:', error);
      return false;
    }
  }

  /**
   * Generate content using the optimal model for the task
   */
  async generateContent(
    prompt: string,
    taskType: keyof TaskConfigurations,
    customOptions?: Partial<ModelConfiguration>
  ): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Enhanced Azure OpenAI Service not initialized');
    }

    const config = { ...this.taskConfigurations[taskType], ...customOptions };
    const client = this.clients.get(config.deployment) || this.clients.get('default');
    
    if (!client) {
      throw new Error(`No client available for deployment: ${config.deployment}`);
    }

    console.log(`🎯 Using ${config.deployment} for ${taskType} task`);

    const messages = [{ role: 'user' as const, content: prompt }];

    try {
      const completion = await this.retryWithBackoff(async () => {
        return await client.chat.completions.create({
          model: config.deployment,
          messages,
          temperature: config.temperature,
          max_tokens: config.maxTokens,
          top_p: config.topP || 0.9,
          frequency_penalty: config.frequencyPenalty || 0.1,
          presence_penalty: config.presencePenalty || 0.1,
        });
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error(`Empty response from Azure OpenAI (${config.deployment})`);
      }

      return content;
    } catch (error) {
      console.error(`❌ Error generating content with ${config.deployment}:`, error);
      throw error;
    }
  }

  /**
   * Generate cover letter using gpt-4o for high quality
   */
  async generateCoverLetter(resumeText: string, jobDescription: string): Promise<string> {
    const prompt = `You are an expert career coach and professional writer. Please generate a compelling cover letter based on the provided resume and job description.

JOB DESCRIPTION:
${jobDescription}

RESUME:
${resumeText}

Please generate a cover letter that:
1. Is tailored to the specific job description
2. Highlights the most relevant skills and experiences from the resume
3. Has a professional and engaging tone
4. Is well-structured and easy to read
5. Is approximately 3-4 paragraphs long

Return ONLY the cover letter content with no additional commentary or explanations.`;

    return await this.generateContent(prompt, 'cover-letter');
  }

  /**
   * Calculate relevancy score using gpt-35-turbo for efficiency
   */
  async calculateRelevancy(resumeText: string, jobDescription: string): Promise<number> {
    const prompt = `You are an expert ATS (Applicant Tracking System) analyzer. Please analyze the relevancy between this resume and job description.

JOB DESCRIPTION:
${jobDescription}

RESUME:
${resumeText}

Analyze the match between the resume and job description considering:
1. Skills alignment (technical and soft skills)
2. Experience relevance (years and type of experience)
3. Education and certifications match
4. Industry experience
5. Role responsibilities alignment
6. Keywords and terminology match

Return ONLY a single number between 0 and 100 representing the percentage match/relevancy score. No explanations or additional text.`;

    const response = await this.generateContent(prompt, 'relevancy');
    
    // Extract number from response
    const scoreMatch = response.trim().match(/\d+/);
    if (!scoreMatch) {
      throw new Error('Could not extract relevancy score from response');
    }
    
    const score = parseInt(scoreMatch[0], 10);
    return Math.max(0, Math.min(100, score)); // Ensure score is between 0-100
  }

  /**
   * Tailor resume using gpt-4o for quality
   */
  async tailorResume(resumeText: string, jobDescription: string): Promise<string> {
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

    return await this.generateContent(prompt, 'resume-tailor');
  }

  /**
   * Generate interview questions using gpt-35-turbo for efficiency
   */
  async generateQuestions(resumeInfo: {name: string, experience: string, education: string, skills: string}): Promise<string[]> {
    const prompt = `You are an experienced interviewer. Based on the following resume information, generate 5 relevant interview questions that would help assess this candidate's qualifications and fit for their field.

RESUME INFORMATION:
Name: ${resumeInfo.name}
Experience: ${resumeInfo.experience}
Education: ${resumeInfo.education}
Skills: ${resumeInfo.skills}

Generate questions that:
1. Are specific to their experience level and field
2. Assess both technical and behavioral competencies
3. Are professional and engaging
4. Would help determine cultural fit
5. Allow the candidate to showcase their strengths

Format: Return exactly 5 questions, each on a new line, numbered 1-5. No additional text or explanations.`;

    const response = await this.generateContent(prompt, 'questions');
    
    // Parse questions from response
    const questions = response
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => line.replace(/^\d+\.\s*/, '')) // Remove numbering
      .filter(line => line.length > 0)
      .slice(0, 5); // Ensure max 5 questions

    if (questions.length === 0) {
      throw new Error('No questions could be parsed from response');
    }

    return questions;
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
   * Check if service is ready
   */
  isReady(): boolean {
    return this.isInitialized && this.clients.size > 0;
  }

  /**
   * Get available deployments
   */
  getAvailableDeployments(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.clients.clear();
    this.isInitialized = false;
    console.log('🧹 Enhanced Azure OpenAI Service disposed');
  }
}

// Export singleton instance
export const enhancedAzureOpenAIService = new EnhancedAzureOpenAIService();
