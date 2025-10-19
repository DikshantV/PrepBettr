/**
 * Updated Resume Service
 * Demonstrates how existing services can be updated to use the standardized data layer
 * This serves as a template for updating other services
 */

import { DataLayerServiceFactory, IResumeDocument, IUsageDocument, RepositoryResult } from '@/lib/data-layer';
import { resumeServiceDataLayer } from './resume-service-data-layer';
import { unifiedConfigService } from './unified-config-service';
import { logServerError } from '@/lib/errors';

export interface ResumeServiceConfig {
  maxResumeSize: number;
  allowedFileTypes: string[];
  generateQuestions: boolean;
  trackUsage: boolean;
}

export class UpdatedResumeService {
  private static instance: UpdatedResumeService | null = null;
  private config: ResumeServiceConfig;
  private initialized = false;

  private constructor() {
    this.config = {
      maxResumeSize: 10 * 1024 * 1024, // 10MB
      allowedFileTypes: ['pdf', 'doc', 'docx'],
      generateQuestions: true,
      trackUsage: true
    };
  }

  static getInstance(): UpdatedResumeService {
    if (!UpdatedResumeService.instance) {
      UpdatedResumeService.instance = new UpdatedResumeService();
    }
    return UpdatedResumeService.instance;
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Initialize data layer
      await resumeServiceDataLayer.initialize();
      
      // Load configuration
      await this.loadConfiguration();
      
      this.initialized = true;
      console.log('✅ Updated Resume Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Updated Resume Service:', error);
      throw error;
    }
  }

  /**
   * Load configuration from unified config service
   */
  private async loadConfiguration(): Promise<void> {
    try {
      this.config = {
        maxResumeSize: await unifiedConfigService.get('resume.maxFileSize', 10 * 1024 * 1024),
        allowedFileTypes: await unifiedConfigService.get('resume.allowedTypes', ['pdf', 'doc', 'docx']),
        generateQuestions: await unifiedConfigService.get('resume.generateQuestions', true),
        trackUsage: await unifiedConfigService.get('features.trackUsage', true)
      };
    } catch (error) {
      console.warn('Failed to load configuration, using defaults:', error);
    }
  }

  /**
   * Upload and process a resume
   */
  async uploadResume(
    userId: string,
    fileName: string,
    fileBuffer: Buffer,
    fileSize: number,
    fileType: string
  ): Promise<{
    success: boolean;
    resumeId?: string;
    extractedData?: any;
    interviewQuestions?: string[];
    atsScore?: number;
    error?: string;
  }> {
    try {
      await this.initialize();

      // Validate file
      const validation = this.validateFile(fileName, fileSize, fileType);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      // Extract text from file (placeholder - would use actual extraction service)
      const extractedText = await this.extractText(fileBuffer, fileType);

      // Process through data layer
      const result = await resumeServiceDataLayer.processResumeUpload({
        userId,
        fileName,
        fileSize,
        fileType,
        extractedText,
        fileUrl: `/uploads/resumes/${userId}/${fileName}` // Would be actual URL after upload
      });

      if (result.success) {
        // Generate interview questions if enabled
        let interviewQuestions: string[] = [];
        if (this.config.generateQuestions && result.extractedData) {
          interviewQuestions = await this.generateInterviewQuestions(result.extractedData);
        }

        return {
          success: true,
          resumeId: result.resumeId,
          extractedData: result.extractedData,
          interviewQuestions,
          atsScore: result.atsScore
        };
      } else {
        return { success: false, error: result.error };
      }

    } catch (error) {
      console.error('Resume upload failed:', error);
      logServerError(error as Error, { service: 'updated-resume-service', action: 'uploadResume' });
      return { success: false, error: 'Resume upload failed' };
    }
  }

  /**
   * Get user's resumes
   */
  async getUserResumes(userId: string, limit?: number): Promise<{
    success: boolean;
    resumes?: IResumeDocument[];
    error?: string;
  }> {
    try {
      await this.initialize();

      const result = await resumeServiceDataLayer.getUserResumes(userId, limit);
      
      return {
        success: result.success,
        resumes: result.data || [],
        error: result.error
      };
    } catch (error) {
      console.error('Get user resumes failed:', error);
      return { success: false, error: 'Failed to fetch resumes' };
    }
  }

  /**
   * Get specific resume
   */
  async getResume(resumeId: string): Promise<{
    success: boolean;
    resume?: IResumeDocument;
    error?: string;
  }> {
    try {
      await this.initialize();

      const result = await resumeServiceDataLayer.getResume(resumeId);
      
      return {
        success: result.success,
        resume: result.data || undefined,
        error: result.error
      };
    } catch (error) {
      console.error('Get resume failed:', error);
      return { success: false, error: 'Failed to fetch resume' };
    }
  }

  /**
   * Update resume
   */
  async updateResume(
    resumeId: string, 
    updates: Partial<IResumeDocument>
  ): Promise<{
    success: boolean;
    resume?: IResumeDocument;
    error?: string;
  }> {
    try {
      await this.initialize();

      const result = await resumeServiceDataLayer.updateResume(resumeId, updates);
      
      return {
        success: result.success,
        resume: result.data || undefined,
        error: result.error
      };
    } catch (error) {
      console.error('Update resume failed:', error);
      return { success: false, error: 'Failed to update resume' };
    }
  }

  /**
   * Delete resume
   */
  async deleteResume(resumeId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      await this.initialize();

      const result = await resumeServiceDataLayer.deleteResume(resumeId);
      
      return {
        success: result.success,
        error: result.error
      };
    } catch (error) {
      console.error('Delete resume failed:', error);
      return { success: false, error: 'Failed to delete resume' };
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats(userId: string): Promise<{
    success: boolean;
    stats?: {
      totalResumes: number;
      resumesUploaded: number;
      interviewsCompleted: number;
      lastActivity: string;
      averageAtsScore: number;
    };
    error?: string;
  }> {
    try {
      await this.initialize();

      // Get resumes
      const resumesResult = await resumeServiceDataLayer.getUserResumes(userId);
      const resumes = resumesResult.data || [];

      // Get usage stats
      const usageStats = await resumeServiceDataLayer.getUserUsageStats(userId);

      // Calculate average ATS score
      const atsScores = resumes.filter(r => r.atsScore && r.atsScore > 0).map(r => r.atsScore!);
      const averageAtsScore = atsScores.length > 0 
        ? atsScores.reduce((sum, score) => sum + score, 0) / atsScores.length 
        : 0;

      return {
        success: true,
        stats: {
          totalResumes: resumes.length,
          resumesUploaded: usageStats.resumesUploaded,
          interviewsCompleted: usageStats.interviewsCompleted,
          lastActivity: usageStats.lastActivity,
          averageAtsScore: Math.round(averageAtsScore)
        }
      };
    } catch (error) {
      console.error('Get user stats failed:', error);
      return { success: false, error: 'Failed to fetch user statistics' };
    }
  }

  /**
   * Batch process multiple resumes
   */
  async batchUploadResumes(
    userId: string,
    files: Array<{
      fileName: string;
      fileBuffer: Buffer;
      fileSize: number;
      fileType: string;
    }>
  ): Promise<{
    success: boolean;
    results: Array<{
      fileName: string;
      success: boolean;
      resumeId?: string;
      error?: string;
    }>;
  }> {
    try {
      await this.initialize();

      const results = [];

      for (const file of files) {
        const result = await this.uploadResume(
          userId,
          file.fileName,
          file.fileBuffer,
          file.fileSize,
          file.fileType
        );

        results.push({
          fileName: file.fileName,
          success: result.success,
          resumeId: result.resumeId,
          error: result.error
        });
      }

      const successCount = results.filter(r => r.success).length;
      
      return {
        success: successCount > 0,
        results
      };
    } catch (error) {
      console.error('Batch upload failed:', error);
      return {
        success: false,
        results: []
      };
    }
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{
    healthy: boolean;
    details: any;
  }> {
    try {
      const dataLayerHealth = await resumeServiceDataLayer.getHealthStatus();
      
      return {
        healthy: dataLayerHealth.healthy && this.initialized,
        details: {
          initialized: this.initialized,
          dataLayer: dataLayerHealth.details,
          config: this.config
        }
      };
    } catch (error) {
      return {
        healthy: false,
        details: { error: error.message }
      };
    }
  }

  // Private helper methods

  private validateFile(fileName: string, fileSize: number, fileType: string): {
    valid: boolean;
    error?: string;
  } {
    if (fileSize > this.config.maxResumeSize) {
      return { valid: false, error: `File size exceeds limit of ${this.config.maxResumeSize / (1024 * 1024)}MB` };
    }

    if (!this.config.allowedFileTypes.includes(fileType.toLowerCase())) {
      return { valid: false, error: `File type '${fileType}' not allowed. Allowed types: ${this.config.allowedFileTypes.join(', ')}` };
    }

    if (!fileName || fileName.trim().length === 0) {
      return { valid: false, error: 'File name is required' };
    }

    return { valid: true };
  }

  private async extractText(fileBuffer: Buffer, fileType: string): Promise<string> {
    // Placeholder for text extraction
    // In practice, this would use libraries like pdf2pic, mammoth, etc.
    try {
      if (fileType.toLowerCase() === 'pdf') {
        // Use PDF parsing library
        return 'Extracted text from PDF...';
      } else if (['doc', 'docx'].includes(fileType.toLowerCase())) {
        // Use DOCX parsing library
        return 'Extracted text from Word document...';
      } else {
        return '';
      }
    } catch (error) {
      console.warn('Text extraction failed:', error);
      return '';
    }
  }

  private async generateInterviewQuestions(extractedData: any): Promise<string[]> {
    // Placeholder for AI-based question generation
    // In practice, this would use OpenAI, Google Gemini, or Azure OpenAI
    try {
      const baseQuestions = [
        'Tell me about yourself and your background.',
        'What interests you about this role?',
        'Describe a challenging project you worked on.',
        'How do you handle difficult situations at work?',
        'What are your career goals?'
      ];

      // Add skill-specific questions if skills are available
      if (extractedData?.skills && Array.isArray(extractedData.skills)) {
        const skillQuestions = extractedData.skills.slice(0, 3).map((skill: string) => 
          `Can you describe your experience with ${skill}?`
        );
        return [...baseQuestions, ...skillQuestions].slice(0, 8);
      }

      return baseQuestions;
    } catch (error) {
      console.warn('Question generation failed:', error);
      return [];
    }
  }
}

// Export singleton instance
export const updatedResumeService = UpdatedResumeService.getInstance();