/**
 * Enhanced Resume Processing Service
 * 
 * Integrates Azure AI Foundry Document Intelligence with the existing resume processing pipeline.
 * Provides advanced document analysis, ATS optimization, and job matching capabilities.
 * Features backward compatibility and graceful fallback to existing services.
 */

import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { resumeStorageService } from '@/lib/storage';
import { StorageProvider } from '@/lib/storage/IStorageService';
import { 
  foundryDocumentIntelligenceService, 
  FoundryResumeExtraction, 
  JobMatchAnalysis 
} from '@/lib/azure-ai-foundry/documents/document-client';
import { azureFormRecognizer, ExtractedResumeData } from './azure-form-recognizer';
import { logServerError } from '@/lib/errors';
import { retryWithExponentialBackoff } from '@/lib/utils/retry-with-backoff';
import { unifiedConfigService } from './unified-config-service';

export interface EnhancedProcessedResumeResult {
  success: boolean;
  data?: {
    resumeId: string;
    fileUrl: string;
    sasUrl?: string;
    extractedData: FoundryResumeExtraction | ExtractedResumeData;
    interviewQuestions: string[];
    storageProvider: StorageProvider;
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
 * Enhanced Resume Processing Service with Azure AI Foundry integration
 */
class EnhancedResumeProcessingService {
  private initialized = false;
  private foundryEnabled = false;
  private legacyService: any; // Reference to original service for fallback

  /**
   * Initialize the enhanced resume processing service
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const startTime = Date.now();
    console.log('🔧 Initializing Enhanced Resume Processing Service...');

    try {
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
      console.log(`✅ Enhanced Resume Processing Service initialized in ${initTime}ms (Foundry: ${this.foundryEnabled})`);

    } catch (error) {
      console.error('❌ Failed to initialize Enhanced Resume Processing Service:', error);
      logServerError(error as Error, { 
        service: 'enhanced-resume-processing', 
        action: 'initialize' 
      });
      // Don't throw - we can still operate with fallbacks
      this.initialized = true;
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

      // Step 1: Delete existing resume if it exists
      await this.deleteExistingResume(userId);

      // Step 2: Upload to storage first (for backup and sharing)
      const storageResult = await resumeStorageService.uploadResume(
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

      // Step 6: Save to Firestore with enhanced data
      const resumeId = await this.saveToFirestoreEnhanced(userId, {
        fileName,
        fileUrl: storageResult.fileUrl,
        filePath: storageResult.filePath,
        sasUrl: storageResult.sasUrl,
        extractedData: extractionResult.extractedData,
        interviewQuestions,
        jobDescription: options.jobDescription,
        jobMatchAnalysis,
        metadata: {
          fileSize,
          uploadDate: new Date(),
          lastModified: new Date(),
          mimeType,
          storageProvider: storageResult.provider,
          processingMethod: extractionResult.processingMethod,
          processingTime: extractionResult.processingTime,
          confidence: extractionResult.confidence
        }
      });

      const totalProcessingTime = Date.now() - startTime;
      console.log(`✅ Enhanced resume processing completed in ${totalProcessingTime}ms`);

      // Extract enhanced scores for response
      const atsScore = this.isFoundryExtraction(extractionResult.extractedData) 
        ? extractionResult.extractedData.atsAnalysis?.score 
        : undefined;
      
      const jobMatchScore = jobMatchAnalysis?.overallScore;
      const missingKeywords = jobMatchAnalysis?.skillsMatch.missingSkills;

      return {
        success: true,
        data: {
          resumeId,
          fileUrl: storageResult.fileUrl,
          sasUrl: storageResult.sasUrl,
          extractedData: extractionResult.extractedData,
          interviewQuestions,
          storageProvider: storageResult.provider,
          atsScore,
          jobMatchScore,
          missingKeywords,
          processingMethod: extractionResult.processingMethod,
          processingTime: totalProcessingTime,
          confidence: extractionResult.confidence
        }
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`❌ Enhanced resume processing failed for user ${userId}:`, error);
      
      logServerError(error as Error, {
        service: 'enhanced-resume-processing',
        action: 'process',
        userId
      }, {
        fileName: fileName.substring(0, 50),
        processingTime,
        foundryEnabled: this.foundryEnabled
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process resume'
      };
    }
  }

  /**
   * Extract resume data using enhanced processing with intelligent fallback
   */
  private async extractResumeDataEnhanced(
    fileBuffer: Buffer, 
    mimeType: string,
    options: EnhancedResumeProcessingOptions
  ): Promise<{
    extractedData: FoundryResumeExtraction | ExtractedResumeData;
    processingMethod: 'foundry-document-intelligence' | 'azure-form-recognizer' | 'openai-fallback';
    processingTime: number;
    confidence?: number;
  }> {
    
    // Try Azure AI Foundry Document Intelligence first (if enabled)
    if ((this.foundryEnabled || options.forceFoundryProcessing) && foundryDocumentIntelligenceService.isReady()) {
      try {
        console.log('🚀 Using Azure AI Foundry Document Intelligence...');
        const startTime = Date.now();
        
        const extraction = await foundryDocumentIntelligenceService.analyzeResume(
          fileBuffer, 
          mimeType,
          {
            includeAtsAnalysis: options.includeAtsAnalysis,
            modelType: 'resume-analysis'
          }
        );
        
        const processingTime = Date.now() - startTime;
        
        return {
          extractedData: extraction,
          processingMethod: 'foundry-document-intelligence',
          processingTime,
          confidence: extraction.metadata.overallConfidence
        };
        
      } catch (error) {
        console.warn('⚠️ Foundry Document Intelligence failed, falling back:', error);
        // Continue to fallback
      }
    }

    // Fallback to Azure Form Recognizer
    if (azureFormRecognizer.isReady()) {
      try {
        console.log('🔍 Using Azure Form Recognizer fallback...');
        const startTime = Date.now();
        
        const extraction = await azureFormRecognizer.extractResumeData(fileBuffer, mimeType);
        const processingTime = Date.now() - startTime;
        
        return {
          extractedData: extraction,
          processingMethod: 'azure-form-recognizer',
          processingTime,
          confidence: 0.8 // Default confidence for Form Recognizer
        };
        
      } catch (error) {
        console.warn('⚠️ Azure Form Recognizer failed, falling back to OpenAI:', error);
        // Continue to final fallback
      }
    }

    // Final fallback to OpenAI extraction
    console.log('🤖 Using OpenAI extraction fallback...');
    const startTime = Date.now();
    
    const extraction = await this.extractWithOpenAIFallback(fileBuffer, mimeType);
    const processingTime = Date.now() - startTime;
    
    return {
      extractedData: extraction,
      processingMethod: 'openai-fallback',
      processingTime,
      confidence: 0.7 // Lower confidence for text-only extraction
    };
  }

  /**
   * Enhanced question generation with intelligent routing
   */
  private async generateQuestionsEnhanced(
    extractedData: FoundryResumeExtraction | ExtractedResumeData,
    maxQuestions: number = 10
  ): Promise<string[]> {
    try {
      console.log('🤔 Generating interview questions...');

      // Use the enhanced AI service for question generation
      const { generateQuestions } = await import('@/lib/ai');
      
      // Convert data to the format expected by generateQuestions
      const resumeInfo = this.convertToResumeInfo(extractedData);
      const result = await generateQuestions(resumeInfo);
      
      if (result.success && result.data) {
        const questions = Array.isArray(result.data) 
          ? result.data.slice(0, maxQuestions)
          : [result.data];
        
        console.log(`✅ Generated ${questions.length} interview questions`);
        return questions;
      }

      // Return default questions if generation fails
      return this.getDefaultQuestions();

    } catch (error) {
      console.warn('⚠️ Question generation failed:', error);
      return this.getDefaultQuestions();
    }
  }

  /**
   * Save enhanced data to Firestore
   */
  private async saveToFirestoreEnhanced(userId: string, resumeData: any): Promise<string> {
    try {
      const db = await getAdminFirestore();
      const docRef = db.collection('profiles').doc(userId);

      // Extract ATS and job matching scores for top-level fields
      const atsScore = this.isFoundryExtraction(resumeData.extractedData) 
        ? resumeData.extractedData.atsAnalysis?.score 
        : undefined;
      
      const jobMatchScore = resumeData.jobMatchAnalysis?.overallScore;
      const missingKeywords = resumeData.jobMatchAnalysis?.skillsMatch.missingSkills || [];

      await docRef.set({
        userId,
        ...resumeData,
        // Enhanced fields for easy querying
        atsScore,
        jobMatchScore, 
        missingKeywords,
        processorVersion: this.isFoundryExtraction(resumeData.extractedData) ? 'foundry-v1' : 'legacy-v1',
        metadata: {
          ...resumeData.metadata,
          uploadDate: FieldValue.serverTimestamp(),
          lastModified: FieldValue.serverTimestamp(),
        },
      });

      console.log(`✅ Enhanced resume data saved to Firestore for user: ${userId}`);
      return userId;
      
    } catch (error) {
      console.error('❌ Failed to save enhanced resume data to Firestore:', error);
      throw new Error('Failed to save resume data');
    }
  }

  /**
   * Delete existing resume data
   */
  private async deleteExistingResume(userId: string): Promise<void> {
    try {
      const db = await getAdminFirestore();
      const profileDoc = await db.collection('profiles').doc(userId).get();

      if (profileDoc.exists) {
        const profileData = profileDoc.data() as any;
        
        // Delete from storage
        if (profileData?.filePath) {
          await resumeStorageService.deleteResume(profileData.filePath);
        } else if (profileData?.blobName) {
          await resumeStorageService.deleteResume(profileData.blobName);
        }
      }
      
      console.log(`🗑️ Existing resume cleaned up for user: ${userId}`);
    } catch (error) {
      console.warn('⚠️ Failed to delete existing resume:', error);
      // Don't throw - we still want to proceed with new upload
    }
  }

  /**
   * OpenAI fallback extraction (legacy method)
   */
  private async extractWithOpenAIFallback(fileBuffer: Buffer, mimeType: string): Promise<ExtractedResumeData> {
    // For PDFs, extract text first
    let text = '';

    if (mimeType === 'application/pdf') {
      const pdfParse = await import('pdf-parse');
      const pdfData = await pdfParse.default(fileBuffer);
      text = pdfData.text;
    } else if (mimeType.includes('text')) {
      text = fileBuffer.toString('utf-8');
    } else {
      throw new Error(`Unsupported file type for OpenAI extraction: ${mimeType}`);
    }

    // Use AI service for structured extraction
    const prompt = this.getExtractionPrompt(text);
    const { tailorResume } = await import('@/lib/ai');
    const result = await tailorResume(text, prompt);
    
    if (result.success && result.data) {
      try {
        const parsedData = typeof result.data === 'string' 
          ? JSON.parse(result.data) 
          : result.data;

        return {
          personalInfo: parsedData.personalInfo || {},
          summary: parsedData.summary,
          skills: parsedData.skills || [],
          experience: parsedData.experience || [],
          education: parsedData.education || [],
          projects: parsedData.projects || [],
          certifications: parsedData.certifications || [],
          languages: parsedData.languages || [],
          rawExtraction: { text, aiResponse: result.data }
        };
      } catch (parseError) {
        console.warn('⚠️ Failed to parse OpenAI extraction result');
        throw new Error('Failed to parse extracted resume data');
      }
    }

    throw new Error('Failed to extract resume data with OpenAI');
  }

  /**
   * Type guard to check if extraction is from Foundry
   */
  private isFoundryExtraction(data: FoundryResumeExtraction | ExtractedResumeData): data is FoundryResumeExtraction {
    return 'metadata' in data && data.metadata && 'processingTime' in data.metadata;
  }

  /**
   * Convert extracted data to ResumeInfo format for question generation
   */
  private convertToResumeInfo(data: FoundryResumeExtraction | ExtractedResumeData): any {
    if (this.isFoundryExtraction(data)) {
      // Enhanced Foundry extraction
      return {
        name: data.personalInfo?.name?.content || 'Unknown',
        skills: data.skills.map(s => s.skill).join(', '),
        experience: data.experience.map(exp => 
          `${exp.position.content} at ${exp.company.content} (${exp.startDate?.content || 'Unknown'} - ${exp.endDate?.content || 'Present'}): ${exp.description.content}`
        ).join('. '),
        education: data.education.map(edu => 
          `${edu.degree.content} in ${edu.field.content} from ${edu.institution.content} (${edu.startDate?.content || 'Unknown'} - ${edu.endDate?.content || 'Unknown'})`
        ).join(', ')
      };
    } else {
      // Legacy extraction
      return {
        name: data.personalInfo?.name || 'Unknown',
        skills: data.skills.join(', '),
        experience: data.experience.map(exp => 
          `${exp.position} at ${exp.company} (${exp.startDate || 'Unknown'} - ${exp.endDate || 'Present'}): ${exp.description}`
        ).join('. '),
        education: data.education.map(edu => 
          `${edu.degree} in ${edu.field} from ${edu.institution} (${edu.startDate || 'Unknown'} - ${edu.endDate || 'Unknown'})`
        ).join(', ')
      };
    }
  }

  /**
   * Get extraction prompt for OpenAI fallback
   */
  private getExtractionPrompt(text: string): string {
    return `Extract the following information from this resume text and return as JSON:

    {
      "personalInfo": {
        "name": "Full name",
        "email": "Email address", 
        "phone": "Phone number",
        "address": "Address",
        "linkedin": "LinkedIn URL",
        "github": "GitHub URL",
        "website": "Personal website URL"
      },
      "summary": "Professional summary",
      "skills": ["skill1", "skill2", ...],
      "experience": [
        {
          "company": "Company name",
          "position": "Job title", 
          "startDate": "Start date",
          "endDate": "End date or 'Present'",
          "isCurrent": true/false,
          "description": "Job description",
          "achievements": ["achievement1", ...],
          "technologies": ["tech1", "tech2", ...],
          "location": "Location"
        }
      ],
      "education": [
        {
          "institution": "School name",
          "degree": "Degree type",
          "field": "Field of study", 
          "startDate": "Start date",
          "endDate": "End date",
          "gpa": 3.5,
          "location": "Location"
        }
      ],
      "projects": [...],
      "certifications": [...],
      "languages": [...]
    }
    
    Resume text:
    ${text}`;
  }

  /**
   * Get default interview questions
   */
  private getDefaultQuestions(): string[] {
    return [
      "Tell me about yourself and your professional background.",
      "What interests you most about this position?",
      "Describe a challenging project you've worked on.",
      "How do you stay updated with industry trends?",
      "Where do you see yourself in 5 years?",
      "What are your greatest strengths?",
      "Describe a time when you had to work under pressure.",
      "How do you handle feedback and criticism?"
    ];
  }

  /**
   * Get user's resume data from Firestore
   */
  async getUserResumeData(userId: string): Promise<any> {
    try {
      const db = await getAdminFirestore();
      const profileDoc = await db.collection('profiles').doc(userId).get();

      if (profileDoc.exists) {
        return profileDoc.data() as any;
      }

      return null;
    } catch (error) {
      console.error('❌ Failed to get user resume data:', error);
      throw error;
    }
  }

  /**
   * Generate new secure URL for file access
   */
  async generateNewSecureUrl(userId: string, expiryHours: number = 24): Promise<string | null> {
    try {
      const resumeData = await this.getUserResumeData(userId);
      
      const filePath = resumeData?.filePath || resumeData?.blobName;
      if (filePath) {
        return await resumeStorageService.getResumeUrl(filePath, expiryHours);
      }

      return null;
    } catch (error) {
      console.error('❌ Failed to generate new secure URL:', error);
      return null;
    }
  }

  /**
   * Check service status
   */
  getServiceStatus(): {
    initialized: boolean;
    foundryEnabled: boolean;
    foundryReady: boolean;
    formRecognizerReady: boolean;
  } {
    return {
      initialized: this.initialized,
      foundryEnabled: this.foundryEnabled,
      foundryReady: foundryDocumentIntelligenceService.isReady(),
      formRecognizerReady: azureFormRecognizer.isReady()
    };
  }
}

// Export singleton instance
export const enhancedResumeProcessingService = new EnhancedResumeProcessingService();
