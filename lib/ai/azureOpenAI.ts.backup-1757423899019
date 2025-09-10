/**
 * Azure OpenAI Provider Adapter
 * 
 * This adapter wraps Azure OpenAI API to provide a consistent interface
 * for the AI service layer. Reuses the existing AzureOpenAIService for
 * consistent configuration and error handling.
 */

import { azureOpenAIService } from '@/lib/services/azure-openai-service';
import { enhancedAzureOpenAIService } from '@/lib/services/azure-openai-enhanced';
import { AIProvider, ResumeInfo } from './index';
import { retryWithExponentialBackoff, RetryOptions } from '@/lib/utils/retry-with-backoff';

export class AzureOpenAIAdapter implements AIProvider {
  public name = 'Azure OpenAI (Enhanced)';
  private isInitialized = false;
  private useEnhancedService = true; // Feature flag for enhanced multi-deployment service
  
  // Default parameters for optimal Azure OpenAI performance
  private readonly DEFAULT_TEMPERATURE = 0.7; // Balanced creativity
  private readonly DEFAULT_MAX_TOKENS = 1500;  // Comprehensive responses
  private readonly RELEVANCY_TEMPERATURE = 0.1; // For precise scoring
  private readonly RELEVANCY_MAX_TOKENS = 50;   // Short numeric response

  /**
   * Initialize the Azure OpenAI service
   */
  async initialize(): Promise<boolean> {
    try {
      // Try enhanced service first, fallback to standard service
      if (this.useEnhancedService) {
        this.isInitialized = await enhancedAzureOpenAIService.initialize();
        if (this.isInitialized) {
          console.log('✅ Azure OpenAI adapter initialized with enhanced service');
          return true;
        }
        console.warn('⚠️ Enhanced service failed, falling back to standard service');
        this.useEnhancedService = false;
      }
      
      // Fallback to standard service
      this.isInitialized = await azureOpenAIService.initialize();
      
      if (this.isInitialized) {
        console.log('✅ Azure OpenAI adapter initialized with standard service');
      } else {
        console.warn('⚠️ Azure OpenAI adapter failed to initialize');
      }
      
      return this.isInitialized;
    } catch (error) {
      console.error('❌ Failed to initialize Azure OpenAI adapter:', error);
      return false;
    }
  }

  /**
   * Check if the adapter is ready
   */
  isReady(): boolean {
    if (this.useEnhancedService) {
      return this.isInitialized && enhancedAzureOpenAIService.isReady();
    }
    return this.isInitialized && azureOpenAIService.isReady();
  }

  /**
   * Generate a cover letter using Azure OpenAI with retry logic
   */
  async generateCoverLetter(resumeText: string, jobDescription: string, userId?: string): Promise<string> {
    if (!this.isReady()) {
      throw new Error('Azure OpenAI adapter not initialized');
    }

    return await retryWithExponentialBackoff(
      async () => {
        // Use enhanced service if available for optimal model selection
        if (this.useEnhancedService) {
          return await enhancedAzureOpenAIService.generateCoverLetter(resumeText, jobDescription);
        }

        // Fallback to custom implementation
        return await this.generateWithAzureOpenAI(this.getCoverLetterPrompt(resumeText, jobDescription));
      },
      'generate_cover_letter',
      userId,
      {
        maxRetries: 3,
        baseDelay: 2000, // 2 seconds base delay for AI operations
        maxDelay: 60000  // 1 minute max delay
      }
    );
  }

  /**
   * Calculate relevancy score between resume and job description with retry logic
   */
  async calculateRelevancy(resumeText: string, jobDescription: string, userId?: string): Promise<number> {
    if (!this.isReady()) {
      throw new Error('Azure OpenAI adapter not initialized');
    }

    return await retryWithExponentialBackoff(
      async () => {
        // Use enhanced service for efficient gpt-35-turbo scoring
        if (this.useEnhancedService) {
          return await enhancedAzureOpenAIService.calculateRelevancy(resumeText, jobDescription);
        }

        // Fallback implementation
        const prompt = this.getRelevancyPrompt(resumeText, jobDescription);
        const response = await this.generateWithAzureOpenAI(prompt, this.RELEVANCY_TEMPERATURE, this.RELEVANCY_MAX_TOKENS);
        
        // Extract number from response
        const scoreMatch = response.trim().match(/\d+/);
        if (!scoreMatch) {
          throw new Error('Could not extract relevancy score from response');
        }
        
        const score = parseInt(scoreMatch[0], 10);
        return Math.max(0, Math.min(100, score)); // Ensure score is between 0-100
      },
      'calculate_relevancy',
      userId,
      {
        maxRetries: 2, // Fewer retries for quick scoring operations
        baseDelay: 1000,
        maxDelay: 30000
      }
    );
  }

  /**
   * Tailor resume to match job description with retry logic
   */
  async tailorResume(resumeText: string, jobDescription: string, userId?: string): Promise<string> {
    if (!this.isReady()) {
      throw new Error('Azure OpenAI adapter not initialized');
    }

    return await retryWithExponentialBackoff(
      async () => {
        // Use enhanced service for optimal gpt-4o quality
        if (this.useEnhancedService) {
          return await enhancedAzureOpenAIService.tailorResume(resumeText, jobDescription);
        }

        // Fallback to standard service
        return await azureOpenAIService.tailorResume(resumeText, jobDescription);
      },
      'tailor_resume',
      userId,
      {
        maxRetries: 3,
        baseDelay: 3000, // 3 seconds base delay for complex operations
        maxDelay: 90000  // 1.5 minutes max delay
      }
    );
  }

  /**
   * Generate interview questions based on resume information with retry logic
   */
  async generateQuestions(resumeInfo: ResumeInfo, userId?: string): Promise<string[]> {
    if (!this.isReady()) {
      throw new Error('Azure OpenAI adapter not initialized');
    }

    return await retryWithExponentialBackoff(
      async () => {
        // Use enhanced service for efficient gpt-35-turbo question generation
        if (this.useEnhancedService) {
          return await enhancedAzureOpenAIService.generateQuestions(resumeInfo);
        }

        // Fallback to standard service
        return await azureOpenAIService.generateQuestions(resumeInfo);
      },
      'generate_questions',
      userId,
      {
        maxRetries: 2,
        baseDelay: 1500,
        maxDelay: 45000
      }
    );
  }

  /**
   * Generate content using Azure OpenAI with retry logic
   * Uses optimized parameters for consistent high-quality responses
   */
  private async generateWithAzureOpenAI(
    prompt: string, 
    temperature: number = this.DEFAULT_TEMPERATURE, 
    maxTokens: number = this.DEFAULT_MAX_TOKENS
  ): Promise<string> {
    const messages = [{ role: 'user' as const, content: prompt }];
    
    try {
      const completion = await azureOpenAIService.createCompletion(messages, {
        temperature,
        maxTokens,
        topP: 0.9,           // Balanced creativity settings
        frequencyPenalty: 0.1, // Reduce repetition
        presencePenalty: 0.1   // Encourage diverse content
      });
      
      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from Azure OpenAI');
      }
      
      return content;
    } catch (error) {
      console.error('❌ Error generating content with Azure OpenAI:', error);
      throw error;
    }
  }

  /**
   * Get cover letter generation prompt with optimized structure
   */
  private getCoverLetterPrompt(resumeText: string, jobDescription: string): string {
    return `You are an expert career coach and professional writer. Please generate a compelling cover letter based on the provided resume and job description.

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
  }

  /**
   * Get relevancy analysis prompt with structured requirements
   */
  private getRelevancyPrompt(resumeText: string, jobDescription: string): string {
    return `You are an expert ATS (Applicant Tracking System) analyzer. Please analyze the relevancy between this resume and job description.

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
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    // The underlying service manages its own resources
    this.isInitialized = false;
    this.useEnhancedService = true; // Reset for next initialization
    console.log('🧹 Azure OpenAI adapter disposed');
  }
}
