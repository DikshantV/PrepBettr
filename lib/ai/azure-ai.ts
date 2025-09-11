/**
 * Unified Azure AI Facade
 * 
 * Central entry point for all Azure AI services including OpenAI, Cognitive Services,
 * and Azure AI Foundry. Provides simplified access to Azure's AI capabilities
 * with intelligent routing and fallback mechanisms.
 */

import { azureOpenAIService } from '@/lib/services/azure-openai-service';
import { enhancedAzureOpenAIService } from '@/lib/services/azure-openai-enhanced';
import { azureFormRecognizer } from '@/lib/services/azure-form-recognizer';
import { foundryDocumentIntelligenceService } from '@/lib/azure-ai-foundry/documents/document-client';
import { migrationOpenAIClient } from '@/lib/azure-ai-foundry/clients/migration-wrapper';
import { unifiedConfigService } from '@/lib/services/unified-config-service';
import { logServerError } from '@/lib/errors';
import { retryWithExponentialBackoff } from '@/lib/utils/retry-with-backoff';

export interface AzureAIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  provider: 'azure-openai' | 'azure-foundry' | 'azure-form-recognizer';
  processingTime?: number;
  confidence?: number;
}

export interface ResumeExtractionOptions {
  includeAtsAnalysis?: boolean;
  includeJobMatching?: boolean;
  jobDescription?: string;
  forceFoundryProcessing?: boolean;
}

export interface QuestionGenerationOptions {
  maxQuestions?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  focusAreas?: string[];
  interviewType?: 'behavioral' | 'technical' | 'mixed';
}

/**
 * Azure AI Unified Service
 * Provides centralized access to all Azure AI capabilities
 */
class AzureAIService {
  private initialized = false;
  private availableServices = {
    openai: false,
    enhanced: false,
    formRecognizer: false,
    foundry: false
  };

  /**
   * Initialize all Azure AI services
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log('🚀 Initializing Azure AI unified service...');
    const startTime = Date.now();

    try {
      // Initialize Azure OpenAI services
      const [openaiReady, enhancedReady, formRecognizerReady] = await Promise.allSettled([
        azureOpenAIService.initialize(),
        enhancedAzureOpenAIService.initialize(),
        azureFormRecognizer.initialize()
      ]);

      this.availableServices.openai = openaiReady.status === 'fulfilled' && openaiReady.value;
      this.availableServices.enhanced = enhancedReady.status === 'fulfilled' && enhancedReady.value;
      this.availableServices.formRecognizer = formRecognizerReady.status === 'fulfilled' && formRecognizerReady.value;

      // Initialize Azure AI Foundry if feature flag is enabled
      try {
        const foundryEnabled = await unifiedConfigService.get('features.foundryResumeProcessing', false);
        if (foundryEnabled) {
          this.availableServices.foundry = await foundryDocumentIntelligenceService.initialize();
        }
      } catch (error) {
        console.warn('⚠️ Foundry initialization skipped:', error);
      }

      this.initialized = true;
      const initTime = Date.now() - startTime;
      
      console.log('✅ Azure AI unified service initialized', {
        duration: `${initTime}ms`,
        services: this.availableServices
      });
    } catch (error) {
      console.error('❌ Azure AI service initialization failed:', error);
      logServerError(error as Error, { 
        service: 'azure-ai-unified', 
        action: 'initialize' 
      });
      throw error;
    }
  }

  /**
   * Get service status information
   */
  getStatus() {
    return {
      initialized: this.initialized,
      services: this.availableServices
    };
  }

  /**
   * Generate text completions using Azure OpenAI
   */
  async generateCompletion(
    prompt: string, 
    options: {
      temperature?: number;
      maxTokens?: number;
      model?: string;
      userId?: string;
    } = {}
  ): Promise<AzureAIResponse<string>> {
    await this.initialize();

    const startTime = Date.now();
    
    try {
      // Use enhanced service if available, fallback to standard
      const service = this.availableServices.enhanced ? enhancedAzureOpenAIService : azureOpenAIService;
      
      const result = await retryWithExponentialBackoff(
        async () => {
          if (this.availableServices.enhanced) {
            return await enhancedAzureOpenAIService.generateContent(prompt, 'general');
          } else {
            // Fall back to basic service, but it doesn't have generateCompletion
            throw new Error('Basic Azure OpenAI service does not support completion generation');
          }
        },
        'azure_ai_completion',
        options.userId,
        { maxRetries: 3, baseDelay: 1000 }
      );

      return {
        success: true,
        data: result,
        provider: this.availableServices.enhanced ? 'azure-foundry' : 'azure-openai',
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('❌ Azure AI completion failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Completion failed',
        provider: this.availableServices.enhanced ? 'azure-foundry' : 'azure-openai',
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Generate interview questions from resume data
   */
  async generateQuestions(
    resumeData: any,
    options: QuestionGenerationOptions = {}
  ): Promise<AzureAIResponse<string[]>> {
    await this.initialize();

    const startTime = Date.now();
    
    try {
      // Use enhanced service if available
      const service = this.availableServices.enhanced ? enhancedAzureOpenAIService : azureOpenAIService;
      
      const questions = await retryWithExponentialBackoff(
        async () => {
          if (this.availableServices.enhanced) {
            return await enhancedAzureOpenAIService.generateQuestions(resumeData);
          } else {
            return await azureOpenAIService.generateQuestions(resumeData);
          }
        },
        'azure_ai_questions',
        undefined,
        { maxRetries: 2, baseDelay: 1000 }
      );

      // Filter to max questions if specified
      const filteredQuestions = options.maxQuestions 
        ? questions.slice(0, options.maxQuestions)
        : questions;

      return {
        success: true,
        data: filteredQuestions,
        provider: this.availableServices.enhanced ? 'azure-foundry' : 'azure-openai',
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('❌ Azure AI question generation failed:', error);
      
      // Return default questions as fallback
      const defaultQuestions = [
        "Tell me about yourself and your professional background.",
        "What interests you most about this position?",
        "Describe a challenging project you've worked on.",
        "How do you stay updated with industry trends?",
        "Where do you see yourself in 5 years?",
        "What are your greatest strengths?",
        "Describe a time when you had to work under pressure.",
        "How do you handle feedback and criticism?"
      ];

      return {
        success: false,
        data: defaultQuestions.slice(0, options.maxQuestions || 8),
        error: error instanceof Error ? error.message : 'Question generation failed',
        provider: this.availableServices.enhanced ? 'azure-foundry' : 'azure-openai',
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Extract data from resume documents
   */
  async extractResumeData(
    fileBuffer: Buffer,
    mimeType: string,
    options: ResumeExtractionOptions = {}
  ): Promise<AzureAIResponse<any>> {
    await this.initialize();

    const startTime = Date.now();

    try {
      // Use Azure AI Foundry if available and enabled
      if (this.availableServices.foundry && (options.forceFoundryProcessing || 
          await unifiedConfigService.get('features.foundryResumeProcessing', false))) {
        
        const extraction = await foundryDocumentIntelligenceService.analyzeResume(
          fileBuffer,
          mimeType,
          {
            includeAtsAnalysis: options.includeAtsAnalysis,
            modelType: 'resume-analysis'
          }
        );

        return {
          success: true,
          data: extraction,
          provider: 'azure-foundry',
          processingTime: Date.now() - startTime,
          confidence: extraction.metadata?.overallConfidence
        };
      }

      // Fallback to Azure Form Recognizer
      if (this.availableServices.formRecognizer) {
        const extraction = await azureFormRecognizer.extractResumeData(fileBuffer, mimeType);

        return {
          success: true,
          data: extraction,
          provider: 'azure-form-recognizer',
          processingTime: Date.now() - startTime,
          confidence: 0.85 // Default confidence for Form Recognizer
        };
      }

      throw new Error('No Azure document extraction services available');
    } catch (error) {
      console.error('❌ Azure resume extraction failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Extraction failed',
        provider: this.availableServices.foundry ? 'azure-foundry' : 'azure-form-recognizer',
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Generate tailored resume content
   */
  async tailorResume(
    resumeText: string,
    jobDescription: string,
    options: { userId?: string } = {}
  ): Promise<AzureAIResponse<string>> {
    await this.initialize();

    const startTime = Date.now();

    try {
      const service = this.availableServices.enhanced ? enhancedAzureOpenAIService : azureOpenAIService;
      
      const tailoredContent = await retryWithExponentialBackoff(
        async () => {
          if (this.availableServices.enhanced) {
            return await enhancedAzureOpenAIService.tailorResume(resumeText, jobDescription);
          } else {
            return await azureOpenAIService.tailorResume(resumeText, jobDescription);
          }
        },
        'azure_ai_tailor',
        options.userId,
        { maxRetries: 3, baseDelay: 2000 }
      );

      return {
        success: true,
        data: tailoredContent,
        provider: this.availableServices.enhanced ? 'azure-foundry' : 'azure-openai',
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('❌ Azure AI resume tailoring failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Resume tailoring failed',
        provider: this.availableServices.enhanced ? 'azure-foundry' : 'azure-openai',
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Generate cover letters
   */
  async generateCoverLetter(
    resumeText: string,
    jobDescription: string,
    options: { userId?: string } = {}
  ): Promise<AzureAIResponse<string>> {
    await this.initialize();

    const startTime = Date.now();

    try {
      const service = this.availableServices.enhanced ? enhancedAzureOpenAIService : azureOpenAIService;
      
      const coverLetter = await retryWithExponentialBackoff(
        async () => {
          if (this.availableServices.enhanced) {
            return await enhancedAzureOpenAIService.generateCoverLetter(resumeText, jobDescription);
          } else {
            throw new Error('Cover letter generation requires enhanced Azure OpenAI service');
          }
        },
        'azure_ai_cover_letter',
        options.userId,
        { maxRetries: 3, baseDelay: 2000 }
      );

      return {
        success: true,
        data: coverLetter,
        provider: this.availableServices.enhanced ? 'azure-foundry' : 'azure-openai',
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('❌ Azure AI cover letter generation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Cover letter generation failed',
        provider: this.availableServices.enhanced ? 'azure-foundry' : 'azure-openai',
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Calculate relevancy score between resume and job description
   */
  async calculateRelevancy(
    resumeText: string,
    jobDescription: string
  ): Promise<AzureAIResponse<number>> {
    await this.initialize();

    const startTime = Date.now();

    try {
      const service = this.availableServices.enhanced ? enhancedAzureOpenAIService : azureOpenAIService;
      
      const score = await retryWithExponentialBackoff(
        async () => {
          if (this.availableServices.enhanced) {
            return await enhancedAzureOpenAIService.calculateRelevancy(resumeText, jobDescription);
          } else {
            throw new Error('Relevancy calculation requires enhanced Azure OpenAI service');
          }
        },
        'azure_ai_relevancy',
        undefined,
        { maxRetries: 2, baseDelay: 1000 }
      );

      return {
        success: true,
        data: Math.max(0, Math.min(100, score)), // Ensure 0-100 range
        provider: this.availableServices.enhanced ? 'azure-foundry' : 'azure-openai',
        processingTime: Date.now() - startTime,
        confidence: 0.9
      };
    } catch (error) {
      console.error('❌ Azure AI relevancy calculation failed:', error);
      return {
        success: false,
        data: 50, // Default middle score
        error: error instanceof Error ? error.message : 'Relevancy calculation failed',
        provider: this.availableServices.enhanced ? 'azure-foundry' : 'azure-openai',
        processingTime: Date.now() - startTime
      };
    }
  }
}

// Export singleton instance
export const azureAI = new AzureAIService();

// For backward compatibility, export individual service references
export {
  azureOpenAIService,
  enhancedAzureOpenAIService,
  azureFormRecognizer,
  foundryDocumentIntelligenceService
};

// Export types with unique names to avoid conflicts
export type UnifiedAzureAIResponse<T = any> = AzureAIResponse<T>;
export type UnifiedResumeExtractionOptions = ResumeExtractionOptions;
export type UnifiedQuestionGenerationOptions = QuestionGenerationOptions;
