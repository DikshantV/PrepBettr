/**
 * Azure-Centric AI Service Layer
 * 
 * This module provides a unified interface for AI operations backed
 * by Azure OpenAI services. Optimized for enterprise-grade AI functionality.
 * 
 * Updated to use the new unified Azure AI facade for improved service
 * management and intelligent routing between Azure services.
 */

import { AzureOpenAIAdapter } from './azureOpenAI';
import { azureAI, AzureAIResponse } from './azure-ai';

export interface AIProvider {
  name: string;
  initialize(): Promise<boolean>;
  isReady(): boolean;
  generateCoverLetter(resumeText: string, jobDescription: string): Promise<string>;
  calculateRelevancy(resumeText: string, jobDescription: string): Promise<number>;
  tailorResume(resumeText: string, jobDescription: string): Promise<string>;
  generateQuestions(resumeInfo: ResumeInfo): Promise<string[]>;
  dispose(): void;
}

export interface ResumeInfo {
  name: string;
  experience: string;
  education: string;
  skills: string;
}

export interface AIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  provider?: string;
}

/**
 * AI Service Manager - Azure OpenAI focused service manager
 */
class AIServiceManager {
  private currentProvider: AIProvider | null = null;
  private providers: Map<string, AIProvider> = new Map();
  private initialized = false;

  constructor() {
    // Register Azure OpenAI as the primary provider
    this.providers.set('azure-openai', new AzureOpenAIAdapter());
  }

  /**
   * Initialize the AI service with Azure OpenAI
   */
  async initialize(): Promise<boolean> {
    const providerName = 'azure-openai';
    
    console.log(`🚀 Initializing AI Service with provider: ${providerName}`);
    
    const provider = this.providers.get(providerName);
    if (!provider) {
      console.error(`❌ Azure OpenAI provider not found`);
      return false;
    }

    try {
      const success = await provider.initialize();
      if (success) {
        this.currentProvider = provider;
        this.initialized = true;
        console.log(`✅ AI Service initialized successfully with ${provider.name}`);
        return true;
      }
    } catch (error) {
      console.error(`❌ Failed to initialize Azure OpenAI provider:`, error);
    }

    console.error('❌ Azure OpenAI provider failed to initialize');
    return false;
  }


  /**
   * Get the current provider
   */
  getCurrentProvider(): AIProvider | null {
    return this.currentProvider;
  }

  /**
   * Check if the service is ready
   */
  isReady(): boolean {
    return this.initialized && this.currentProvider?.isReady() === true;
  }

  /**
   * Get current provider name
   */
  getProviderName(): string {
    return this.currentProvider?.name || 'none';
  }

  /**
   * Switch to a different provider at runtime
   */
  async switchProvider(providerName: string): Promise<boolean> {
    console.log(`🔄 Switching to provider: ${providerName}`);
    
    const provider = this.providers.get(providerName);
    if (!provider) {
      console.error(`❌ Provider '${providerName}' not found`);
      return false;
    }

    // Clean up current provider
    if (this.currentProvider) {
      this.currentProvider.dispose();
    }

    try {
      const success = await provider.initialize();
      if (success) {
        this.currentProvider = provider;
        console.log(`✅ Successfully switched to ${provider.name}`);
        return true;
      }
    } catch (error) {
      console.error(`❌ Failed to switch to provider '${providerName}':`, error);
    }

    return false;
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    if (this.currentProvider) {
      this.currentProvider.dispose();
    }
    this.currentProvider = null;
    this.initialized = false;
    console.log('🧹 AI Service Manager disposed');
  }
}

// Singleton instance
const aiServiceManager = new AIServiceManager();

/**
 * Ensure the AI service is initialized
 */
async function ensureInitialized(): Promise<void> {
  if (!aiServiceManager.isReady()) {
    const success = await aiServiceManager.initialize();
    if (!success) {
      throw new Error('Failed to initialize AI service - no providers available');
    }
  }
}

/**
 * Generate a cover letter based on resume and job description
 */
export async function generateCoverLetter(resumeText: string, jobDescription: string): Promise<AIResponse<string>> {
  try {
    await ensureInitialized();
    
    const provider = aiServiceManager.getCurrentProvider();
    if (!provider) {
      throw new Error('No AI provider available');
    }

    const coverLetter = await provider.generateCoverLetter(resumeText, jobDescription);
    
    return {
      success: true,
      data: coverLetter,
      provider: provider.name
    };
  } catch (error) {
    console.error('❌ Error generating cover letter:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      provider: aiServiceManager.getProviderName()
    };
  }
}

/**
 * Calculate relevancy score between resume and job description (0-100)
 */
export async function calculateRelevancy(resumeText: string, jobDescription: string): Promise<AIResponse<number>> {
  try {
    await ensureInitialized();
    
    const provider = aiServiceManager.getCurrentProvider();
    if (!provider) {
      throw new Error('No AI provider available');
    }

    const score = await provider.calculateRelevancy(resumeText, jobDescription);
    
    return {
      success: true,
      data: Math.max(0, Math.min(100, score)), // Ensure score is between 0-100
      provider: provider.name
    };
  } catch (error) {
    console.error('❌ Error calculating relevancy:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      provider: aiServiceManager.getProviderName()
    };
  }
}

/**
 * Tailor resume to match job description
 */
export async function tailorResume(resumeText: string, jobDescription: string): Promise<AIResponse<string>> {
  try {
    await ensureInitialized();
    
    const provider = aiServiceManager.getCurrentProvider();
    if (!provider) {
      throw new Error('No AI provider available');
    }

    const tailoredResume = await provider.tailorResume(resumeText, jobDescription);
    
    return {
      success: true,
      data: tailoredResume,
      provider: provider.name
    };
  } catch (error) {
    console.error('❌ Error tailoring resume:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      provider: aiServiceManager.getProviderName()
    };
  }
}

/**
 * Generate interview questions based on resume information
 */
export async function generateQuestions(resumeInfo: ResumeInfo): Promise<AIResponse<string[]>> {
  try {
    await ensureInitialized();
    
    const provider = aiServiceManager.getCurrentProvider();
    if (!provider) {
      throw new Error('No AI provider available');
    }

    const questions = await provider.generateQuestions(resumeInfo);
    
    return {
      success: true,
      data: questions,
      provider: provider.name
    };
  } catch (error) {
    console.error('❌ Error generating questions:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      provider: aiServiceManager.getProviderName()
    };
  }
}

/**
 * Get current AI provider information
 */
export function getProviderInfo(): { name: string; isReady: boolean } {
  return {
    name: aiServiceManager.getProviderName(),
    isReady: aiServiceManager.isReady()
  };
}

/**
 * Switch AI provider at runtime (for testing or hot-swapping)
 */
export async function switchProvider(providerName: string): Promise<AIResponse<boolean>> {
  try {
    const success = await aiServiceManager.switchProvider(providerName);
    
    return {
      success,
      data: success,
      provider: aiServiceManager.getProviderName()
    };
  } catch (error) {
    console.error('❌ Error switching provider:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      provider: aiServiceManager.getProviderName()
    };
  }
}

/**
 * Dispose of AI service resources
 */
export function dispose(): void {
  aiServiceManager.dispose();
}

// Export the unified Azure AI service for modern usage
export { azureAI };
export { azureAI as unifiedAI }; // Alias for clarity

// Export types from the unified service
export type {
  AzureAIResponse,
  ResumeExtractionOptions,
  QuestionGenerationOptions
} from './azure-ai';

// Re-export individual services for direct access if needed
export {
  azureOpenAIService,
  enhancedAzureOpenAIService,
  azureFormRecognizer,
  foundryDocumentIntelligenceService
} from './azure-ai';
