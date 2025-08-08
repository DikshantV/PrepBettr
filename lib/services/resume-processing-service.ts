import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { azureBlobStorage } from './azure-blob-storage';
import { azureFormRecognizer, ExtractedResumeData } from './azure-form-recognizer';
import { 
  uploadResumeToStorage, 
  deleteResumeFromStorage, 
  getUserResume, 
  deleteUserResume,
  ResumeData 
} from './firebase-resume-service';
// Import will be done dynamically when needed
import { logServerError } from '@/lib/errors';

export interface ProcessedResumeResult {
  success: boolean;
  data?: {
    resumeId: string;
    fileUrl: string;
    sasUrl?: string;
    extractedData: ExtractedResumeData;
    interviewQuestions: string[];
    storageProvider: 'azure' | 'firebase';
  };
  error?: string;
}

export interface ResumeProcessingOptions {
  generateQuestions?: boolean;
  maxQuestions?: number;
}

class ResumeProcessingService {
  private initialized = false;

  /**
   * Initialize the resume processing service
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Initialize Azure services (they will gracefully fall back if not configured)
      await azureBlobStorage.initialize();
      await azureFormRecognizer.initialize();

      this.initialized = true;
      console.log('✅ Resume processing service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize resume processing service:', error);
      logServerError(error as Error, { service: 'resume-processing', action: 'initialize' });
      // Don't throw - we can still operate with Firebase fallback
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

      // Step 2: Upload to storage (Azure Blob Storage with Firebase fallback)
      const storageResult = await this.uploadToStorage(userId, fileBuffer, fileName, mimeType);

      // Step 3: Extract data from resume
      const extractedData = await this.extractResumeData(fileBuffer, mimeType);

      // Step 4: Generate interview questions if requested
      let interviewQuestions: string[] = [];
      if (options.generateQuestions !== false) {
        interviewQuestions = await this.generateQuestions(extractedData, options.maxQuestions);
      }

      // Step 5: Save to Firestore profiles collection
      const resumeId = await this.saveToFirestore(userId, {
        fileName,
        fileUrl: storageResult.fileUrl,
        filePath: storageResult.filePath,
        blobName: storageResult.blobName,
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
   * Upload resume to storage (Azure Blob with Firebase fallback)
   */
  private async uploadToStorage(
    userId: string,
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string
  ): Promise<{
    fileUrl: string;
    filePath?: string;
    blobName?: string;
    sasUrl?: string;
    provider: 'azure' | 'firebase';
  }> {
    
    // Try Azure Blob Storage first
    if (azureBlobStorage.isReady()) {
      try {
        console.log('📤 Uploading to Azure Blob Storage...');
        const result = await azureBlobStorage.uploadResume(userId, fileBuffer, fileName, mimeType);
        
        return {
          fileUrl: result.blobUrl,
          blobName: result.blobName,
          sasUrl: result.sasUrl,
          provider: 'azure'
        };
      } catch (error) {
        console.warn('⚠️ Azure Blob Storage upload failed, falling back to Firebase:', error);
        // Continue to Firebase fallback
      }
    }

    // Fallback to Firebase Storage
    console.log('📤 Uploading to Firebase Storage...');
    const { fileUrl, filePath } = await uploadResumeToStorage(userId, fileBuffer, fileName, mimeType);
    
    return {
      fileUrl,
      filePath,
      provider: 'firebase'
    };
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
      const pdfParse = await import('pdf-parse');
      const pdfData = await pdfParse.default(fileBuffer);
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
   * Save resume data to Firestore profiles collection
   */
  private async saveToFirestore(userId: string, resumeData: any): Promise<string> {
    try {
      const db = getAdminFirestore();
      const docRef = db.collection('profiles').doc(userId);

      await docRef.set({
        userId,
        ...resumeData,
        metadata: {
          ...resumeData.metadata,
          uploadDate: FieldValue.serverTimestamp(),
          lastModified: FieldValue.serverTimestamp(),
        },
      }, { merge: true }); // Use merge to update existing profile

      console.log(`✅ Resume data saved to Firestore for user: ${userId}`);
      return docRef.id;
    } catch (error) {
      console.error('Failed to save resume data to Firestore:', error);
      throw new Error('Failed to save resume data');
    }
  }

  /**
   * Delete existing resume for user
   */
  private async deleteExistingResume(userId: string): Promise<void> {
    try {
      // Get existing resume data
      const db = getAdminFirestore();
      const profileDoc = await db.collection('profiles').doc(userId).get();

      if (profileDoc.exists) {
        const profileData = profileDoc.data();
        
        // Delete from storage based on provider
        if (profileData?.metadata?.storageProvider === 'azure' && profileData?.blobName) {
          await azureBlobStorage.deleteResume(profileData.blobName);
        } else if (profileData?.filePath) {
          await deleteResumeFromStorage(profileData.filePath);
        }
      }

      // Also clean up legacy resume data
      await deleteUserResume(userId);
      
      console.log(`🗑️ Existing resume cleaned up for user: ${userId}`);
    } catch (error) {
      console.warn('Failed to delete existing resume:', error);
      // Don't throw - we still want to proceed with new upload
    }
  }

  /**
   * Get user's resume data from Firestore
   */
  async getUserResumeData(userId: string): Promise<any> {
    try {
      const db = getAdminFirestore();
      const profileDoc = await db.collection('profiles').doc(userId).get();

      if (profileDoc.exists) {
        return profileDoc.data();
      }

      // Fallback to legacy resume collection
      return await getUserResume(userId);
    } catch (error) {
      console.error('Failed to get user resume data:', error);
      throw error;
    }
  }

  /**
   * Generate new SAS URL for Azure blob
   */
  async generateNewSASUrl(userId: string, expiryHours: number = 24): Promise<string | null> {
    try {
      const resumeData = await this.getUserResumeData(userId);
      
      if (resumeData?.blobName && azureBlobStorage.isReady()) {
        const result = await azureBlobStorage.generateSASUrl(resumeData.blobName, expiryHours);
        return result.sasUrl;
      }

      return null;
    } catch (error) {
      console.error('Failed to generate new SAS URL:', error);
      return null;
    }
  }
}

// Export singleton instance
export const resumeProcessingService = new ResumeProcessingService();
