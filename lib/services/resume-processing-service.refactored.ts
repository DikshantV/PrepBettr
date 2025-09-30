/**
 * Resume Processing Service (Refactored)
 * 
 * Uses the new data layer abstraction for storage operations.
 * Maintains compatibility with existing code while using Azure Cosmos DB and Blob Storage.
 */

import { FieldValue } from 'firebase-admin/firestore';
import { getStorageService, resumeStorageService } from '@/lib/storage';
import { StorageProvider } from '@/lib/storage/IStorageService';
import { azureFormRecognizer, ExtractedResumeData } from './azure-form-recognizer';
import { logServerError } from '@/lib/errors';
import { 
  getResumeRepository,
  getDataStoreProvider
} from '@/lib/data-layer/data-store-factory';
import { 
  ResumeDocument,
  DataStoreError
} from '@/lib/data-layer/interfaces';
import { unifiedConfigService } from '@/lib/services/unified-config-service';

export interface ProcessedResumeResult {
  success: boolean;
  data?: {
    resumeId: string;
    fileUrl: string;
    sasUrl?: string;
    extractedData: ExtractedResumeData;
    interviewQuestions: string[];
    storageProvider: StorageProvider;
  };
  error?: string;
}

export interface ResumeProcessingOptions {
  generateQuestions?: boolean;
  maxQuestions?: number;
}

class ResumeProcessingService {
  private initialized = false;
  private useAzureDataLayer = false;

  /**
   * Initialize the resume processing service
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Initialize Azure Form Recognizer
      await azureFormRecognizer.initialize();
      
      // Check if we should use the new data layer
      this.useAzureDataLayer = await unifiedConfigService.get('features.azureDataLayer', false);
      
      this.initialized = true;
      console.log(`✅ Resume processing service initialized (Azure Data Layer: ${this.useAzureDataLayer ? 'Enabled' : 'Disabled'})`);
    } catch (error) {
      console.error('❌ Failed to initialize resume processing service:', error);
      logServerError(error as Error, { service: 'resume-processing', action: 'initialize' });
      // Don't throw - we can still operate with fallbacks
      this.initialized = true;
    }
  }

  /**
   * Process uploaded resume: storage, extraction, and data persistence
   */
  async processResume(
    userId: string,
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    fileSize: number,
    options: ResumeProcessingOptions = {}
  ): Promise<ProcessedResumeResult> {
    try {
      await this.initialize();

      console.log(`🔄 Processing resume for user ${userId}: ${fileName}`);

      // Step 1: Delete existing resume if it exists
      await this.deleteExistingResume(userId);

      // Step 2: Upload to storage using the abstraction layer
      const storageResult = await resumeStorageService.uploadResume(userId, fileBuffer, fileName, mimeType);

      // Step 3: Extract data from resume
      const extractedData = await this.extractResumeData(fileBuffer, mimeType);

      // Step 4: Generate interview questions if requested
      let interviewQuestions: string[] = [];
      if (options.generateQuestions !== false) {
        interviewQuestions = await this.generateQuestions(extractedData, options.maxQuestions);
      }

      // Step 5: Save to data store (Cosmos DB or Firestore)
      const resumeId = await this.saveResumeData(userId, {
        fileName,
        fileUrl: storageResult.fileUrl,
        filePath: storageResult.filePath,
        sasUrl: storageResult.sasUrl,
        extractedData,
        interviewQuestions,
        metadata: {
          fileSize,
          uploadDate: new Date(),
          lastModified: new Date(),
          mimeType,
          storageProvider: storageResult.provider
        }
      });

      console.log(`✅ Resume processed successfully for user ${userId}`);

      return {
        success: true,
        data: {
          resumeId,
          fileUrl: storageResult.fileUrl,
          sasUrl: storageResult.sasUrl,
          extractedData,
          interviewQuestions,
          storageProvider: storageResult.provider
        }
      };

    } catch (error) {
      console.error(`❌ Failed to process resume for user ${userId}:`, error);
      logServerError(error as Error, {
        service: 'resume-processing',
        action: 'process',
        userId
      }, {
        fileName: fileName.substring(0, 50)
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process resume'
      };
    }
  }

  /**
   * Extract data from resume using Azure Form Recognizer or OpenAI
   */
  private async extractResumeData(fileBuffer: Buffer, mimeType: string): Promise<ExtractedResumeData> {
    
    // Try Azure Form Recognizer first
    if (azureFormRecognizer.isReady()) {
      try {
        console.log('🔍 Extracting data with Azure Form Recognizer...');
        return await azureFormRecognizer.extractResumeData(fileBuffer, mimeType);
      } catch (error) {
        console.warn('⚠️ Azure Form Recognizer extraction failed, falling back to OpenAI:', error);
        // Continue to OpenAI fallback
      }
    }

    // Fallback to OpenAI extraction
    console.log('🔍 Extracting data with OpenAI...');
    return await this.extractWithOpenAI(fileBuffer, mimeType);
  }

  /**
   * Extract resume data using OpenAI as fallback
   */
  private async extractWithOpenAI(fileBuffer: Buffer, mimeType: string): Promise<ExtractedResumeData> {
    // For PDFs, we need to extract text first
    let text = '';

    if (mimeType === 'application/pdf') {
      // Dynamic import to avoid bundling pdf-parse in main bundle
      const { default: pdfParse } = await import('pdf-parse');
      const pdfData = await pdfParse(fileBuffer);
      text = pdfData.text;
    } else if (mimeType.includes('text')) {
      text = fileBuffer.toString('utf-8');
    } else {
      throw new Error(`Unsupported file type for OpenAI extraction: ${mimeType}`);
    }

    // Use OpenAI function calling to extract structured data
    const prompt = `Extract the following information from this resume and return as JSON:

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
        console.warn('Failed to parse OpenAI extraction result');
        throw new Error('Failed to parse extracted resume data');
      }
    }

    throw new Error('Failed to extract resume data with OpenAI');
  }

  /**
   * Generate interview questions based on extracted data
   */
  private async generateQuestions(
    extractedData: ExtractedResumeData, 
    maxQuestions: number = 10
  ): Promise<string[]> {
    try {
      console.log('🤔 Generating interview questions...');

      // Create a summary of the candidate's profile for question generation
      const profileSummary = `
        Name: ${extractedData.personalInfo.name || 'N/A'}
        Summary: ${extractedData.summary || 'N/A'}
        Skills: ${extractedData.skills.join(', ')}
        Experience: ${extractedData.experience.map(exp => `${exp.position} at ${exp.company}`).join(', ')}
        Education: ${extractedData.education.map(edu => `${edu.degree} in ${edu.field} from ${edu.institution}`).join(', ')}
      `;

      // Dynamic import to avoid circular dependencies
      const { generateQuestions } = await import('@/lib/ai');
      
      // Convert ExtractedResumeData to ResumeInfo format expected by generateQuestions
      const resumeInfo = {
        name: extractedData.personalInfo?.name || 'Unknown',
        skills: extractedData.skills.join(', '),
        experience: extractedData.experience.map(exp => `${exp.position} at ${exp.company} (${exp.startDate} - ${exp.endDate || 'Present'}): ${exp.description}`).join('. '),
        education: extractedData.education.map(edu => `${edu.degree} in ${edu.field} from ${edu.institution} (${edu.startDate} - ${edu.endDate})`).join(', ')
      };
      
      const questions = await generateQuestions(resumeInfo);
      
      if (questions.success && questions.data) {
        // Limit to maxQuestions
        return Array.isArray(questions.data) 
          ? questions.data.slice(0, maxQuestions)
          : [questions.data];
      }

      // Return default questions if generation fails
      return [
        "Tell me about yourself and your professional background.",
        "What interests you most about this position?",
        "Describe a challenging project you've worked on.",
        "How do you stay updated with industry trends?",
        "Where do you see yourself in 5 years?"
      ];

    } catch (error) {
      console.warn('Failed to generate interview questions:', error);
      return [];
    }
  }

  /**
   * Save resume data to data store
   * Uses Azure Cosmos DB if enabled, otherwise Firestore
   */
  private async saveResumeData(userId: string, resumeData: any): Promise<string> {
    try {
      if (this.useAzureDataLayer) {
        return await this.saveToCosmosDB(userId, resumeData);
      } else {
        return await this.saveToFirestore(userId, resumeData);
      }
    } catch (error) {
      console.error('Failed to save resume data:', error);
      throw error instanceof DataStoreError ? error : new Error('Failed to save resume data');
    }
  }

  /**
   * Save resume data to Azure Cosmos DB using the new data layer
   */
  private async saveToCosmosDB(userId: string, resumeData: any): Promise<string> {
    try {
      console.log('☁️ Saving resume data to Azure Cosmos DB...');
      
      // Get the resume repository from the data layer
      const resumeRepo = await getResumeRepository();
      
      // Create document data
      const resumeDocument: Omit<ResumeDocument, 'id' | '_partitionKey' | 'createdAt' | 'updatedAt'> = {
        userId,
        fileName: resumeData.fileName,
        fileUrl: resumeData.fileUrl,
        filePath: resumeData.filePath,
        sasUrl: resumeData.sasUrl,
        blobName: resumeData.filePath || resumeData.blobName,
        extractedData: resumeData.extractedData,
        interviewQuestions: resumeData.interviewQuestions,
        processorVersion: 'legacy-v1', // Default to legacy version
        metadata: {
          ...resumeData.metadata,
          uploadDate: new Date(),
          lastModified: new Date(),
        }
      };
      
      // Save to Cosmos DB
      const resumeId = await resumeRepo.create(resumeDocument);
      
      console.log(`✅ Resume data saved to Cosmos DB with ID: ${resumeId}`);
      
      // If dual-write is enabled, also save to Firestore
      if (await unifiedConfigService.get('features.enableDualWrite', false)) {
        console.log('📊 Dual-write enabled, also saving to Firestore...');
        try {
          await this.saveToFirestore(userId, resumeData);
        } catch (error) {
          console.warn('⚠️ Failed to dual-write to Firestore:', error);
          // Don't throw - continue with primary write to Cosmos DB
        }
      }
      
      return resumeId;
    } catch (error) {
      console.error('❌ Failed to save resume data to Cosmos DB:', error);
      
      // If fallback is enabled, try Firestore
      if (await unifiedConfigService.get('features.enableFallback', true)) {
        console.log('🔄 Falling back to Firestore...');
        return await this.saveToFirestore(userId, resumeData);
      }
      
      throw error;
    }
  }

  /**
   * Legacy method: Save resume data to Firestore profiles collection
   */
  private async saveToFirestore(userId: string, resumeData: any): Promise<string> {
    try {
      // Import Firestore dynamically to avoid hard dependencies
      const { getAdminFirestore } = await import('@/lib/firebase/admin');
      const { FieldValue } = await import('firebase-admin/firestore');
      
      const db = await getAdminFirestore();
      const docRef = db.collection('profiles').doc(userId);

      await docRef.set({
        userId,
        ...resumeData,
        metadata: {
          ...resumeData.metadata,
          uploadDate: FieldValue.serverTimestamp(),
          lastModified: FieldValue.serverTimestamp(),
        },
      });

      console.log(`✅ Resume data saved to Firestore for user: ${userId}`);
      return userId; // Use userId as the document ID since that's what we set
    } catch (error) {
      console.error('❌ Failed to save resume data to Firestore:', error);
      throw new Error('Failed to save resume data to Firestore');
    }
  }

  /**
   * Delete existing resume for user
   */
  private async deleteExistingResume(userId: string): Promise<void> {
    try {
      if (this.useAzureDataLayer) {
        await this.deleteFromCosmosDB(userId);
      } else {
        await this.deleteFromFirestore(userId);
      }
    } catch (error) {
      console.warn('⚠️ Failed to delete existing resume:', error);
      // Don't throw - we still want to proceed with new upload
    }
  }

  /**
   * Delete resume from Cosmos DB
   */
  private async deleteFromCosmosDB(userId: string): Promise<void> {
    try {
      console.log('☁️ Deleting resume data from Cosmos DB...');
      
      // Get resume repository
      const resumeRepo = await getResumeRepository();
      
      // Get existing resume
      const existingResume = await resumeRepo.getUserLatestResume(userId);
      
      if (existingResume) {
        // Delete from storage using the abstraction layer
        if (existingResume.filePath) {
          await resumeStorageService.deleteResume(existingResume.filePath);
        } else if (existingResume.blobName) {
          await resumeStorageService.deleteResume(existingResume.blobName);
        }
        
        // Delete from Cosmos DB
        await resumeRepo.delete(existingResume.id, userId);
        
        console.log(`✅ Deleted resume data from Cosmos DB for user: ${userId}`);
      }
      
      // If dual-write is enabled, also delete from Firestore
      if (await unifiedConfigService.get('features.enableDualWrite', false)) {
        await this.deleteFromFirestore(userId);
      }
    } catch (error) {
      console.error('❌ Failed to delete resume data from Cosmos DB:', error);
      
      // If fallback is enabled, try Firestore
      if (await unifiedConfigService.get('features.enableFallback', true)) {
        await this.deleteFromFirestore(userId);
      }
    }
  }

  /**
   * Delete resume from Firestore
   */
  private async deleteFromFirestore(userId: string): Promise<void> {
    try {
      console.log('🔥 Checking for existing resume data in Firestore...');
      
      // Import Firestore dynamically
      const { getAdminFirestore } = await import('@/lib/firebase/admin');
      const db = await getAdminFirestore();
      
      // Get existing profile document
      const profileDoc = await db.collection('profiles').doc(userId).get();

      if (profileDoc.exists) {
        const profileData = profileDoc.data() as any;
        
        // Delete from storage using the abstraction layer
        if (profileData?.filePath) {
          await resumeStorageService.deleteResume(profileData.filePath);
        } else if (profileData?.blobName) {
          await resumeStorageService.deleteResume(profileData.blobName);
        }
        
        console.log('✅ Deleted storage files from Firestore references');
      }
      
      // Note: We don't delete the document itself, just the storage files
      // This is because we'll overwrite it with new data
    } catch (error) {
      console.warn('⚠️ Failed to delete existing resume from Firestore:', error);
    }
  }

  /**
   * Get user's resume data
   */
  async getUserResumeData(userId: string): Promise<any> {
    try {
      if (this.useAzureDataLayer) {
        return await this.getFromCosmosDB(userId);
      } else {
        return await this.getFromFirestore(userId);
      }
    } catch (error) {
      console.error('❌ Failed to get user resume data:', error);
      throw error;
    }
  }

  /**
   * Get resume data from Cosmos DB
   */
  private async getFromCosmosDB(userId: string): Promise<any> {
    try {
      console.log(`☁️ Getting resume data from Cosmos DB for user: ${userId}`);
      
      // Get resume repository
      const resumeRepo = await getResumeRepository();
      
      // Get latest resume
      const resumeData = await resumeRepo.getUserLatestResume(userId);
      
      if (resumeData) {
        console.log(`✅ Retrieved resume data from Cosmos DB for user: ${userId}`);
        return resumeData;
      }
      
      // If not found and fallback is enabled, try Firestore
      if (await unifiedConfigService.get('features.enableFallback', true)) {
        console.log('🔄 Resume not found in Cosmos DB, checking Firestore...');
        return await this.getFromFirestore(userId);
      }
      
      return null;
    } catch (error) {
      console.error('❌ Failed to get resume data from Cosmos DB:', error);
      
      // If fallback is enabled, try Firestore
      if (await unifiedConfigService.get('features.enableFallback', true)) {
        return await this.getFromFirestore(userId);
      }
      
      throw error;
    }
  }

  /**
   * Get resume data from Firestore
   */
  private async getFromFirestore(userId: string): Promise<any> {
    try {
      // Import Firestore dynamically
      const { getAdminFirestore } = await import('@/lib/firebase/admin');
      const db = await getAdminFirestore();
      
      // Get profile document
      const profileDoc = await db.collection('profiles').doc(userId).get();

      if (profileDoc.exists) {
        return profileDoc.data() as any;
      }

      return null;
    } catch (error) {
      console.error('❌ Failed to get resume data from Firestore:', error);
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
}

// Export singleton instance
export const resumeProcessingService = new ResumeProcessingService();