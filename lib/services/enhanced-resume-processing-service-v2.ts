/**
 * Enhanced Resume Processing Service v2
 * 
 * Refactored to use the new data layer abstraction with dual-write support.
 * Provides Azure AI Foundry Document Intelligence integration with fallback support.
 * Features backward compatibility and seamless migration between data stores.
 */

import { createDataStoreFactory } from '@/lib/data-layer/data-store-factory';
import { IResumeDocument } from '@/lib/data-layer/interfaces/IDocuments';
import { createDualWriteRepository } from '@/lib/data-layer/dual-write-decorator';
import { createAzureBlobStorageService } from '@/lib/services/azure/azure-blob-storage-service';
import { 
  foundryDocumentIntelligenceService, 
  FoundryResumeExtraction, 
  JobMatchAnalysis 
} from '@/lib/azure-ai-foundry/documents/document-client';
import { azureFormRecognizer, ExtractedResumeData } from './azure-form-recognizer';
import { logServerError } from '@/lib/errors';
import { retryWithExponentialBackoff } from '@/lib/utils/retry-with-backoff';
import { unifiedConfigService } from './unified-config-service';
import { secureSessionManager } from '@/lib/auth/secure-session-manager';

export interface EnhancedProcessedResumeResult {
  success: boolean;
  data?: {
    resumeId: string;
    fileUrl: string;
    sasUrl?: string;
    extractedData: FoundryResumeExtraction | ExtractedResumeData;
    interviewQuestions: string[];
    // Enhanced fields
    atsScore?: number;
    jobMatchScore?: number;
    missingKeywords?: string[];
    processingMethod: 'foundry-document-intelligence' | 'azure-form-recognizer' | 'openai-fallback';
    processingTime: number;
    confidence?: number;
  };
  error?: string;
}

export interface EnhancedResumeProcessingOptions {
  generateQuestions?: boolean;
  maxQuestions?: number;
  jobDescription?: string;
  includeAtsAnalysis?: boolean;
  includeJobMatching?: boolean;
  forceFoundryProcessing?: boolean;
}

/**
 * Enhanced Resume Processing Service with new data layer abstraction
 */
class EnhancedResumeProcessingServiceV2 {
  private initialized = false;
  private foundryEnabled = false;
  private dataStoreFactory = createDataStoreFactory();
  private resumeRepository: any; // Will be dual-write repository
  private blobStorageService = createAzureBlobStorageService();

  /**
   * Initialize the enhanced resume processing service
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const startTime = Date.now();
    console.log('🔧 Initializing Enhanced Resume Processing Service v2...');

    try {
      // Initialize data repositories with dual-write support
      await this.initializeDataLayer();

      // Check if Foundry Document Intelligence is enabled via feature flag
      this.foundryEnabled = await this.checkFoundryEnabled();

      if (this.foundryEnabled) {
        // Initialize Azure AI Foundry Document Intelligence
        const foundryReady = await foundryDocumentIntelligenceService.initialize();
        if (foundryReady) {
          console.log('✅ Azure AI Foundry Document Intelligence initialized');
        } else {
          console.warn('⚠️ Foundry Document Intelligence failed to initialize, using fallback');
          this.foundryEnabled = false;
        }
      }

      // Always initialize fallback services
      await azureFormRecognizer.initialize();
      
      this.initialized = true;
      const initTime = Date.now() - startTime;
      console.log(`✅ Enhanced Resume Processing Service v2 initialized in ${initTime}ms (Foundry: ${this.foundryEnabled})`);

    } catch (error) {
      console.error('❌ Failed to initialize Enhanced Resume Processing Service v2:', error);
      logServerError(error as Error, { 
        service: 'enhanced-resume-processing-v2', 
        action: 'initialize' 
      });
      // Don't throw - we can still operate with fallbacks
      this.initialized = true;
    }
  }

  /**
   * Initialize data layer with dual-write support
   */
  private async initializeDataLayer(): Promise<void> {
    try {
      // Create primary and secondary repositories
      const cosmosResumeRepo = this.dataStoreFactory.createCosmos().getResumeRepository();
      const firestoreResumeRepo = this.dataStoreFactory.createFirestore().getResumeRepository();

      // Create dual-write repository (Cosmos primary, Firestore secondary)
      this.resumeRepository = createDualWriteRepository(
        cosmosResumeRepo,
        firestoreResumeRepo,
        {
          primaryProvider: 'cosmos',
          secondaryProvider: 'firestore',
          enableDualWrite: await unifiedConfigService.get('migration.dualWriteEnabled', true),
          readFallbackEnabled: await unifiedConfigService.get('migration.readFallbackEnabled', true),
          writeConsistencyCheck: await unifiedConfigService.get('migration.consistencyCheckEnabled', false)
        }
      );

      console.log('🔄 Data layer initialized with dual-write support');
    } catch (error) {
      console.error('❌ Failed to initialize data layer:', error);
      throw error;
    }
  }

  /**
   * Check if Foundry processing is enabled via feature flag
   */
  private async checkFoundryEnabled(): Promise<boolean> {
    try {
      const enabled = await unifiedConfigService.get('features.foundryResumeProcessing', false);
      console.log(`🎛️ Foundry resume processing feature flag: ${enabled}`);
      return enabled;
    } catch (error) {
      console.warn('⚠️ Could not check Foundry feature flag, defaulting to false:', error);
      return false;
    }
  }

  /**
   * Process resume with enhanced capabilities
   */
  async processResume(
    userId: string,
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    fileSize: number,
    options: EnhancedResumeProcessingOptions = {}
  ): Promise<EnhancedProcessedResumeResult> {
    const startTime = Date.now();
    
    try {
      await this.initialize();
      
      console.log(`🔄 Processing resume for user ${userId}: ${fileName}`);
      console.log(`📋 Options:`, {
        generateQuestions: options.generateQuestions !== false,
        includeAtsAnalysis: options.includeAtsAnalysis || false,
        includeJobMatching: options.includeJobMatching && !!options.jobDescription,
        forceFoundryProcessing: options.forceFoundryProcessing || false
      });

      // Step 1: Delete existing resume if it exists (using new data layer)
      await this.deleteExistingResume(userId);

      // Step 2: Upload to Azure Blob Storage
      const storageResult = await this.uploadToStorage(
        userId, 
        fileBuffer, 
        fileName, 
        mimeType
      );

      // Step 3: Extract data using the best available method
      const extractionResult = await this.extractResumeDataEnhanced(
        fileBuffer, 
        mimeType, 
        options
      );

      // Step 4: Generate interview questions if requested
      let interviewQuestions: string[] = [];
      if (options.generateQuestions !== false) {
        interviewQuestions = await this.generateQuestionsEnhanced(
          extractionResult.extractedData, 
          options.maxQuestions
        );
      }

      // Step 5: Perform job matching if job description provided
      let jobMatchAnalysis: JobMatchAnalysis | undefined;
      if (options.includeJobMatching && options.jobDescription && this.isFoundryExtraction(extractionResult.extractedData)) {
        try {
          jobMatchAnalysis = await foundryDocumentIntelligenceService.compareWithJobDescription(
            extractionResult.extractedData as FoundryResumeExtraction,
            options.jobDescription
          );
        } catch (error) {
          console.warn('⚠️ Job matching failed:', error);
        }
      }

      // Step 6: Save to data store using dual-write repository
      const resumeDocument = await this.saveResumeDocument(userId, {
        fileName,
        fileUrl: storageResult.publicUrl || '',
        filePath: storageResult.filePath,
        sasUrl: storageResult.downloadUrl,
        extractedData: extractionResult.extractedData,
        interviewQuestions,
        jobDescription: options.jobDescription,
        jobMatchAnalysis,
        metadata: {
          fileSize,
          uploadDate: new Date(),
          lastModified: new Date(),
          mimeType,
          processingMethod: extractionResult.processingMethod,
          processingTime: Date.now() - startTime,
          confidence: extractionResult.confidence,
          atsScore: this.calculateAtsScore(extractionResult.extractedData),
          jobMatchScore: jobMatchAnalysis?.overallScore
        }
      });

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        data: {
          resumeId: resumeDocument.id,
          fileUrl: storageResult.publicUrl || '',
          sasUrl: storageResult.downloadUrl,
          extractedData: extractionResult.extractedData,
          interviewQuestions,
          atsScore: this.calculateAtsScore(extractionResult.extractedData),
          jobMatchScore: jobMatchAnalysis?.overallScore,
          missingKeywords: jobMatchAnalysis?.missingKeywords,
          processingMethod: extractionResult.processingMethod,
          processingTime,
          confidence: extractionResult.confidence
        }
      };

    } catch (error) {
      console.error('❌ Resume processing failed:', error);
      logServerError(error as Error, { 
        service: 'enhanced-resume-processing-v2', 
        action: 'processResume',
        userId 
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Upload file to Azure Blob Storage
   */
  private async uploadToStorage(
    userId: string,
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string
  ) {
    try {
      const result = await this.blobStorageService.uploadFile(
        fileBuffer,
        fileName,
        userId,
        'resume',
        {
          originalName: fileName,
          contentType: mimeType,
          processedBy: 'enhanced-resume-service-v2'
        }
      );

      if (!result.success) {
        throw new Error(`Storage upload failed: ${result.error}`);
      }

      return result;
    } catch (error) {
      console.error('❌ Failed to upload to storage:', error);
      throw new Error(`Storage upload failed: ${error.message}`);
    }
  }

  /**
   * Delete existing resume for user using new data layer
   */
  private async deleteExistingResume(userId: string): Promise<void> {
    try {
      // Find existing resumes for user
      const existingResumes = await this.resumeRepository.findMany({
        where: { userId },
        limit: 10
      });

      if (existingResumes.success && existingResumes.data && existingResumes.data.length > 0) {
        console.log(`🗑️ Deleting ${existingResumes.data.length} existing resumes for user ${userId}`);

        // Delete each resume (dual-write will handle both stores)
        for (const resume of existingResumes.data) {
          try {
            await this.resumeRepository.delete(resume.id);
            
            // Also delete from blob storage if file path exists
            if (resume.filePath) {
              try {
                await this.blobStorageService.deleteFile(resume.filePath, userId);
              } catch (storageError) {
                console.warn('⚠️ Failed to delete file from storage:', storageError.message);
              }
            }
          } catch (deleteError) {
            console.warn(`⚠️ Failed to delete resume ${resume.id}:`, deleteError.message);
          }
        }
      }
    } catch (error) {
      console.warn('⚠️ Failed to delete existing resumes:', error.message);
      // Don't throw - this is not critical
    }
  }

  /**
   * Save resume document using dual-write repository
   */
  private async saveResumeDocument(userId: string, resumeData: any): Promise<IResumeDocument> {
    const resumeDocument: Omit<IResumeDocument, 'id'> = {
      userId,
      fileName: resumeData.fileName,
      filePath: resumeData.filePath,
      fileUrl: resumeData.fileUrl,
      sasUrl: resumeData.sasUrl,
      fileSize: resumeData.metadata.fileSize,
      mimeType: resumeData.metadata.mimeType,
      uploadDate: resumeData.metadata.uploadDate,
      lastModified: resumeData.metadata.lastModified,
      processingMethod: resumeData.metadata.processingMethod,
      processingTime: resumeData.metadata.processingTime,
      confidence: resumeData.metadata.confidence,
      
      // Extracted data
      extractedText: this.getExtractedText(resumeData.extractedData),
      extractedData: resumeData.extractedData,
      
      // Interview questions
      interviewQuestions: resumeData.interviewQuestions || [],
      
      // Job matching data
      jobDescription: resumeData.jobDescription,
      jobMatchAnalysis: resumeData.jobMatchAnalysis,
      
      // ATS and scoring
      atsScore: resumeData.metadata.atsScore,
      jobMatchScore: resumeData.metadata.jobMatchScore,
      
      // Processing metadata
      processorVersion: '2.0.0', // v2 with new data layer
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await this.resumeRepository.create(resumeDocument);

    if (!result.success) {
      throw new Error(`Failed to save resume document: ${result.error}`);
    }

    return result.data!;
  }

  /**
   * Extract resume data with enhanced capabilities
   */
  private async extractResumeDataEnhanced(
    fileBuffer: Buffer, 
    mimeType: string, 
    options: EnhancedResumeProcessingOptions
  ): Promise<{
    extractedData: FoundryResumeExtraction | ExtractedResumeData;
    processingMethod: 'foundry-document-intelligence' | 'azure-form-recognizer' | 'openai-fallback';
    confidence?: number;
  }> {
    const startTime = Date.now();

    try {
      // Try Foundry Document Intelligence first if enabled
      if ((this.foundryEnabled || options.forceFoundryProcessing) && 
          foundryDocumentIntelligenceService.isReady()) {
        
        console.log('🔬 Using Azure AI Foundry Document Intelligence...');
        
        try {
          const foundryResult = await retryWithExponentialBackoff(
            () => foundryDocumentIntelligenceService.processResume(fileBuffer, mimeType),
            3,
            1000
          );

          if (foundryResult) {
            const processingTime = Date.now() - startTime;
            console.log(`✅ Foundry processing completed in ${processingTime}ms`);
            
            return {
              extractedData: foundryResult,
              processingMethod: 'foundry-document-intelligence',
              confidence: foundryResult.confidence || 0.85
            };
          }
        } catch (foundryError) {
          console.warn('⚠️ Foundry processing failed, falling back to Form Recognizer:', foundryError.message);
        }
      }

      // Fallback to Azure Form Recognizer
      console.log('📄 Using Azure Form Recognizer...');
      
      const formRecognizerResult = await retryWithExponentialBackoff(
        () => azureFormRecognizer.processResume(fileBuffer, mimeType),
        3,
        1000
      );

      if (formRecognizerResult && formRecognizerResult.success) {
        const processingTime = Date.now() - startTime;
        console.log(`✅ Form Recognizer processing completed in ${processingTime}ms`);
        
        return {
          extractedData: formRecognizerResult.data!,
          processingMethod: 'azure-form-recognizer',
          confidence: 0.7
        };
      }

      // Final fallback to OpenAI (if implemented)
      throw new Error('All document processing methods failed');

    } catch (error) {
      console.error('❌ Resume data extraction failed:', error);
      throw new Error(`Resume data extraction failed: ${error.message}`);
    }
  }

  /**
   * Generate interview questions with enhanced capabilities
   */
  private async generateQuestionsEnhanced(
    extractedData: FoundryResumeExtraction | ExtractedResumeData, 
    maxQuestions: number = 10
  ): Promise<string[]> {
    try {
      // Use Foundry-specific question generation if available
      if (this.isFoundryExtraction(extractedData) && foundryDocumentIntelligenceService.isReady()) {
        const foundryQuestions = await foundryDocumentIntelligenceService.generateInterviewQuestions(
          extractedData as FoundryResumeExtraction,
          { maxQuestions, includeSkillBasedQuestions: true }
        );

        if (foundryQuestions && foundryQuestions.length > 0) {
          return foundryQuestions.slice(0, maxQuestions);
        }
      }

      // Fallback to existing question generation logic
      // This would integrate with existing OpenAI-based question generation
      return this.generateFallbackQuestions(extractedData, maxQuestions);

    } catch (error) {
      console.warn('⚠️ Enhanced question generation failed, using fallback:', error.message);
      return this.generateFallbackQuestions(extractedData, maxQuestions);
    }
  }

  /**
   * Generate fallback questions using existing logic
   */
  private async generateFallbackQuestions(
    extractedData: any, 
    maxQuestions: number
  ): Promise<string[]> {
    // This would integrate with existing OpenAI-based question generation
    // For now, return sample questions
    const fallbackQuestions = [
      "Tell me about yourself and your professional background.",
      "What are your key strengths and how do they apply to this role?",
      "Describe a challenging project you've worked on.",
      "How do you handle working under pressure?",
      "What are your career goals for the next 5 years?"
    ];

    return fallbackQuestions.slice(0, maxQuestions);
  }

  /**
   * Calculate ATS score based on extracted data
   */
  private calculateAtsScore(extractedData: any): number {
    if (this.isFoundryExtraction(extractedData)) {
      const foundryData = extractedData as FoundryResumeExtraction;
      return foundryData.atsCompatibilityScore || 75;
    }

    // Simple ATS score calculation for non-Foundry data
    let score = 60; // Base score
    
    if (extractedData.skills && extractedData.skills.length > 0) score += 10;
    if (extractedData.experience && extractedData.experience.length > 0) score += 10;
    if (extractedData.education && extractedData.education.length > 0) score += 10;
    if (extractedData.contactInfo) score += 10;

    return Math.min(score, 100);
  }

  /**
   * Check if extraction result is from Foundry
   */
  private isFoundryExtraction(data: any): boolean {
    return data && 
           typeof data.confidence === 'number' && 
           data.skills && 
           Array.isArray(data.skills) &&
           data.atsCompatibilityScore !== undefined;
  }

  /**
   * Extract plain text from processed data
   */
  private getExtractedText(extractedData: any): string {
    if (this.isFoundryExtraction(extractedData)) {
      const foundryData = extractedData as FoundryResumeExtraction;
      return foundryData.rawText || '';
    }

    if (extractedData.extractedText) {
      return extractedData.extractedText;
    }

    // Fallback - concatenate available text fields
    const textParts: string[] = [];
    
    if (extractedData.personalInfo) {
      textParts.push(JSON.stringify(extractedData.personalInfo));
    }
    
    if (extractedData.summary) {
      textParts.push(extractedData.summary);
    }

    return textParts.join('\n');
  }

  /**
   * Get user's resume by ID using new data layer
   */
  async getResumeById(resumeId: string, userId: string): Promise<IResumeDocument | null> {
    try {
      await this.initialize();

      const result = await this.resumeRepository.findById(resumeId);
      
      if (!result.success || !result.data) {
        return null;
      }

      // Verify user ownership
      if (result.data.userId !== userId) {
        console.warn(`⚠️ User ${userId} attempted to access resume ${resumeId} owned by ${result.data.userId}`);
        return null;
      }

      return result.data;
    } catch (error) {
      console.error('❌ Failed to get resume by ID:', error);
      return null;
    }
  }

  /**
   * Get all resumes for a user using new data layer
   */
  async getUserResumes(userId: string, limit: number = 10): Promise<IResumeDocument[]> {
    try {
      await this.initialize();

      const result = await this.resumeRepository.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        limit
      });

      if (!result.success) {
        console.error('❌ Failed to get user resumes:', result.error);
        return [];
      }

      return result.data || [];
    } catch (error) {
      console.error('❌ Failed to get user resumes:', error);
      return [];
    }
  }

  /**
   * Delete resume using new data layer
   */
  async deleteResume(resumeId: string, userId: string): Promise<boolean> {
    try {
      await this.initialize();

      // First verify ownership
      const resume = await this.getResumeById(resumeId, userId);
      if (!resume) {
        return false;
      }

      // Delete from data store (dual-write will handle both)
      const result = await this.resumeRepository.delete(resumeId);
      
      if (result.success) {
        // Also delete from blob storage
        try {
          if (resume.filePath) {
            await this.blobStorageService.deleteFile(resume.filePath, userId);
          }
        } catch (storageError) {
          console.warn('⚠️ Failed to delete file from storage:', storageError.message);
        }

        return true;
      }

      return false;
    } catch (error) {
      console.error('❌ Failed to delete resume:', error);
      return false;
    }
  }

  /**
   * Get health status of the service
   */
  async getHealthStatus(): Promise<{
    healthy: boolean;
    services: { [key: string]: boolean };
    dualWriteMetrics?: any;
  }> {
    try {
      const services = {
        dataLayer: false,
        blobStorage: false,
        foundryEnabled: this.foundryEnabled,
        foundryReady: false,
        formRecognizer: false
      };

      // Check data layer health
      try {
        if (this.resumeRepository && typeof this.resumeRepository.getHealthStatus === 'function') {
          const healthStatus = this.resumeRepository.getHealthStatus();
          services.dataLayer = healthStatus.healthy;
        } else {
          services.dataLayer = true; // Assume healthy if no health check available
        }
      } catch (error) {
        services.dataLayer = false;
      }

      // Check blob storage health
      try {
        const storageHealth = await this.blobStorageService.healthCheck();
        services.blobStorage = storageHealth.healthy;
      } catch (error) {
        services.blobStorage = false;
      }

      // Check Foundry service
      if (this.foundryEnabled) {
        services.foundryReady = foundryDocumentIntelligenceService.isReady();
      }

      // Check Form Recognizer
      try {
        services.formRecognizer = azureFormRecognizer.isReady();
      } catch (error) {
        services.formRecognizer = false;
      }

      const healthy = services.dataLayer && services.blobStorage && 
                     (services.formRecognizer || services.foundryReady);

      const result: any = { healthy, services };

      // Include dual-write metrics if available
      if (this.resumeRepository && typeof this.resumeRepository.getMetrics === 'function') {
        result.dualWriteMetrics = this.resumeRepository.getMetrics();
      }

      return result;
    } catch (error) {
      console.error('❌ Health check failed:', error);
      return {
        healthy: false,
        services: {},
        error: error.message
      };
    }
  }
}

// Export singleton instance
export const enhancedResumeProcessingServiceV2 = new EnhancedResumeProcessingServiceV2();
export default enhancedResumeProcessingServiceV2;