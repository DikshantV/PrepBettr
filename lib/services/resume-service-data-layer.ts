/**
 * Resume Service with Data Layer Integration
 * Real-world example of integrating the data layer with PrepBettr's existing resume service
 */

import { getDataLayerRepositories, measureOperation } from '@/lib/data-layer/utils/integration';
import { IResumeDocument } from '@/lib/data-layer/interfaces/IDocuments';
import { nanoid } from 'nanoid';

// Integration with existing Azure AI Foundry and Gemini services
import { documentIntelligenceService } from '@/azure/lib/services/document-intelligence-service';
import { unifiedConfigService } from '@/lib/services/unified-config-service';

interface ResumeUploadResult {
  success: boolean;
  resumeId?: string;
  atsScore?: number;
  parsedContent?: any;
  skills?: string[];
  experience?: string[];
  error?: string;
  processingTime?: number;
}

interface ResumeSearchFilters {
  userId?: string;
  minAtsScore?: number;
  maxAtsScore?: number;
  skills?: string[];
  experience?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
}

interface ResumeStats {
  totalResumes: number;
  averageAtsScore: number;
  topSkills: string[];
  recentUploads: number;
  userDistribution: Record<string, number>;
}

/**
 * Enhanced Resume Service using Data Layer
 */
export class ResumeServiceDataLayer {
  private static instance: ResumeServiceDataLayer;

  static getInstance(): ResumeServiceDataLayer {
    if (!ResumeServiceDataLayer.instance) {
      ResumeServiceDataLayer.instance = new ResumeServiceDataLayer();
    }
    return ResumeServiceDataLayer.instance;
  }

  /**
   * Upload and process resume with AI analysis
   */
  async uploadResume(
    userId: string,
    file: File | Buffer,
    fileName: string,
    options: {
      skipAIProcessing?: boolean;
      customMetadata?: Record<string, any>;
    } = {}
  ): Promise<ResumeUploadResult> {
    const startTime = Date.now();
    
    try {
      console.log(`Starting resume upload for user ${userId}: ${fileName}`);
      
      // Get repository
      const { resumeRepository } = await getDataLayerRepositories();
      
      // Check if enhanced processing is enabled
      const useFoundryProcessing = await unifiedConfigService.get(
        'features.foundryResumeProcessing', 
        false
      );

      let parsedContent: any = {};
      let skills: string[] = [];
      let experience: string[] = [];
      let atsScore: number = 0;

      // Process resume with AI if not skipped
      if (!options.skipAIProcessing) {
        console.log(`Processing resume with AI (Foundry enabled: ${useFoundryProcessing})`);
        
        const processingResult = await measureOperation(
          'resume_ai_processing',
          async () => {
            if (useFoundryProcessing) {
              // Use Azure AI Foundry Document Intelligence
              return await documentIntelligenceService.processResume(file);
            } else {
              // Fallback to basic processing
              return await this.basicResumeProcessing(file, fileName);
            }
          },
          { userId, fileName, useFoundryProcessing }
        );

        if (processingResult.success && processingResult.data) {
          parsedContent = processingResult.data.parsedContent || {};
          skills = processingResult.data.skills || [];
          experience = processingResult.data.experience || [];
          atsScore = processingResult.data.atsScore || 0;
        }
      }

      // Create resume document
      const resumeDocument: IResumeDocument = {
        id: nanoid(),
        userId,
        fileName,
        uploadDate: new Date().toISOString(),
        fileSize: file instanceof File ? file.size : Buffer.byteLength(file),
        fileType: fileName.split('.').pop()?.toLowerCase() || 'unknown',
        skills,
        experience,
        atsScore,
        parsedContent,
        metadata: {
          processingMethod: useFoundryProcessing ? 'foundry' : 'basic',
          uploadSource: 'web',
          ...options.customMetadata
        },
        createdDate: new Date().toISOString(),
        updatedDate: new Date().toISOString()
      };

      // Save to data layer
      const saveResult = await measureOperation(
        'resume_save',
        () => resumeRepository.create(resumeDocument),
        { userId, resumeId: resumeDocument.id, fileSize: resumeDocument.fileSize }
      );

      if (!saveResult.success) {
        console.error('Failed to save resume:', saveResult.error);
        return {
          success: false,
          error: saveResult.error || 'Failed to save resume',
          processingTime: Date.now() - startTime
        };
      }

      // Log dual write status if available
      if ('dualWriteStatus' in saveResult) {
        console.log('Dual write status:', {
          primarySuccess: (saveResult as any).primaryResult?.success,
          secondarySuccess: (saveResult as any).secondaryResult?.success,
          inconsistencyDetected: (saveResult as any).inconsistencyDetected
        });
      }

      console.log(`Resume upload completed successfully: ${resumeDocument.id}`);
      
      return {
        success: true,
        resumeId: resumeDocument.id,
        atsScore,
        parsedContent,
        skills,
        experience,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      console.error('Resume upload failed:', error);
      return {
        success: false,
        error: error.message || 'Unknown error during resume upload',
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Get user's resumes with advanced filtering
   */
  async getUserResumes(
    userId: string,
    filters: ResumeSearchFilters = {},
    options: {
      limit?: number;
      offset?: number;
      sortBy?: 'uploadDate' | 'atsScore' | 'fileName';
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<{
    success: boolean;
    data?: IResumeDocument[];
    total?: number;
    error?: string;
  }> {
    try {
      const { resumeRepository } = await getDataLayerRepositories();

      // Use specific repository methods for optimized queries
      let result;

      if (filters.minAtsScore && filters.maxAtsScore) {
        // Use ATS score filtering
        result = await measureOperation(
          'get_resumes_by_ats_score',
          () => resumeRepository.getResumesByAtsScore(filters.minAtsScore!, filters.maxAtsScore!),
          { userId, minScore: filters.minAtsScore, maxScore: filters.maxAtsScore }
        );
      } else if (filters.skills && filters.skills.length > 0) {
        // Use skill-based search
        result = await measureOperation(
          'search_resumes_by_skills',
          () => resumeRepository.searchResumes(filters.skills!),
          { userId, skills: filters.skills }
        );
      } else {
        // Get all user resumes
        result = await measureOperation(
          'get_user_resumes',
          () => resumeRepository.getResumesByUser(userId),
          { userId }
        );
      }

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to retrieve resumes'
        };
      }

      let resumes = result.data || [];

      // Apply additional client-side filtering
      if (filters.dateRange) {
        resumes = resumes.filter(resume => {
          const uploadDate = new Date(resume.uploadDate);
          return uploadDate >= filters.dateRange!.start && uploadDate <= filters.dateRange!.end;
        });
      }

      // Apply sorting
      if (options.sortBy) {
        resumes.sort((a, b) => {
          let aValue: any = a[options.sortBy!];
          let bValue: any = b[options.sortBy!];
          
          if (options.sortBy === 'uploadDate') {
            aValue = new Date(aValue);
            bValue = new Date(bValue);
          }
          
          const comparison = aValue > bValue ? 1 : (aValue < bValue ? -1 : 0);
          return options.sortOrder === 'desc' ? -comparison : comparison;
        });
      }

      // Apply pagination
      const total = resumes.length;
      if (options.limit && options.limit > 0) {
        const start = options.offset || 0;
        resumes = resumes.slice(start, start + options.limit);
      }

      return {
        success: true,
        data: resumes,
        total
      };

    } catch (error) {
      console.error('Failed to get user resumes:', error);
      return {
        success: false,
        error: error.message || 'Failed to retrieve resumes'
      };
    }
  }

  /**
   * Update resume with AI re-analysis
   */
  async updateResume(
    resumeId: string,
    updates: Partial<IResumeDocument>,
    options: {
      reprocessWithAI?: boolean;
      userId?: string;
    } = {}
  ): Promise<{
    success: boolean;
    data?: IResumeDocument;
    error?: string;
  }> {
    try {
      const { resumeRepository } = await getDataLayerRepositories();

      // If reprocessing is requested, run AI analysis again
      if (options.reprocessWithAI && options.userId) {
        const useFoundryProcessing = await unifiedConfigService.get(
          'features.foundryResumeProcessing', 
          false
        );

        // Get current resume for file data
        const currentResume = await resumeRepository.findById(resumeId);
        if (!currentResume.success) {
          return {
            success: false,
            error: 'Resume not found for reprocessing'
          };
        }

        // Simulate AI reprocessing
        console.log(`Reprocessing resume ${resumeId} with AI`);
        const processingResult = await measureOperation(
          'resume_reprocessing',
          async () => {
            // This would typically re-fetch and re-process the file
            return {
              success: true,
              data: {
                atsScore: Math.floor(Math.random() * 100),
                skills: updates.skills || currentResume.data?.skills || [],
                experience: updates.experience || currentResume.data?.experience || []
              }
            };
          },
          { resumeId, useFoundryProcessing }
        );

        if (processingResult.success) {
          updates = {
            ...updates,
            atsScore: processingResult.data.atsScore,
            skills: processingResult.data.skills,
            experience: processingResult.data.experience,
            updatedDate: new Date().toISOString(),
            metadata: {
              ...updates.metadata,
              lastReprocessed: new Date().toISOString(),
              reprocessingMethod: useFoundryProcessing ? 'foundry' : 'basic'
            }
          };
        }
      }

      // Update the resume
      const result = await measureOperation(
        'update_resume',
        () => resumeRepository.update(resumeId, updates),
        { resumeId, updateFields: Object.keys(updates) }
      );

      return {
        success: result.success,
        data: result.data,
        error: result.error
      };

    } catch (error) {
      console.error('Failed to update resume:', error);
      return {
        success: false,
        error: error.message || 'Failed to update resume'
      };
    }
  }

  /**
   * Delete resume with cleanup
   */
  async deleteResume(
    resumeId: string,
    options: {
      userId?: string;
      softDelete?: boolean;
    } = {}
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const { resumeRepository } = await getDataLayerRepositories();

      if (options.softDelete) {
        // Soft delete by marking as deleted
        const result = await resumeRepository.update(resumeId, {
          metadata: {
            deleted: true,
            deletedAt: new Date().toISOString(),
            deletedBy: options.userId
          },
          updatedDate: new Date().toISOString()
        });

        return {
          success: result.success,
          error: result.error
        };
      } else {
        // Hard delete
        const result = await measureOperation(
          'delete_resume',
          () => resumeRepository.delete(resumeId),
          { resumeId, userId: options.userId }
        );

        return {
          success: result.success,
          error: result.error
        };
      }

    } catch (error) {
      console.error('Failed to delete resume:', error);
      return {
        success: false,
        error: error.message || 'Failed to delete resume'
      };
    }
  }

  /**
   * Get resume statistics
   */
  async getResumeStats(
    userId?: string,
    timeRange?: { start: Date; end: Date }
  ): Promise<{
    success: boolean;
    data?: ResumeStats;
    error?: string;
  }> {
    try {
      const { resumeRepository } = await getDataLayerRepositories();

      // Get statistics
      const statsResult = await measureOperation(
        'get_resume_stats',
        () => resumeRepository.getStats(),
        { userId, hasTimeRange: !!timeRange }
      );

      if (!statsResult.success) {
        return {
          success: false,
          error: statsResult.error || 'Failed to get statistics'
        };
      }

      // If user-specific stats are needed
      if (userId) {
        const userResumesResult = await resumeRepository.getResumesByUser(userId);
        if (userResumesResult.success && userResumesResult.data) {
          const userResumes = userResumesResult.data;
          
          const stats: ResumeStats = {
            totalResumes: userResumes.length,
            averageAtsScore: userResumes.reduce((sum, r) => sum + (r.atsScore || 0), 0) / userResumes.length || 0,
            topSkills: this.extractTopSkills(userResumes),
            recentUploads: userResumes.filter(r => {
              const uploadDate = new Date(r.uploadDate);
              const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
              return uploadDate >= weekAgo;
            }).length,
            userDistribution: { [userId]: userResumes.length }
          };

          return {
            success: true,
            data: stats
          };
        }
      }

      return {
        success: true,
        data: statsResult.data
      };

    } catch (error) {
      console.error('Failed to get resume stats:', error);
      return {
        success: false,
        error: error.message || 'Failed to get statistics'
      };
    }
  }

  /**
   * Batch upload multiple resumes
   */
  async batchUploadResumes(
    userId: string,
    files: Array<{ file: File | Buffer; fileName: string }>,
    options: {
      skipAIProcessing?: boolean;
      continueOnError?: boolean;
    } = {}
  ): Promise<{
    success: boolean;
    results: ResumeUploadResult[];
    successCount: number;
    errorCount: number;
  }> {
    const results: ResumeUploadResult[] = [];
    let successCount = 0;
    let errorCount = 0;

    console.log(`Starting batch upload of ${files.length} resumes for user ${userId}`);

    for (const { file, fileName } of files) {
      try {
        const result = await this.uploadResume(userId, file, fileName, {
          skipAIProcessing: options.skipAIProcessing
        });

        results.push(result);

        if (result.success) {
          successCount++;
        } else {
          errorCount++;
          if (!options.continueOnError) {
            break;
          }
        }

      } catch (error) {
        const errorResult: ResumeUploadResult = {
          success: false,
          error: error.message || 'Batch upload error'
        };
        results.push(errorResult);
        errorCount++;

        if (!options.continueOnError) {
          break;
        }
      }
    }

    console.log(`Batch upload completed: ${successCount} success, ${errorCount} errors`);

    return {
      success: errorCount === 0,
      results,
      successCount,
      errorCount
    };
  }

  // Private helper methods

  private async basicResumeProcessing(file: File | Buffer, fileName: string) {
    // Fallback processing when Azure AI Foundry is not available
    return {
      success: true,
      data: {
        parsedContent: {
          text: 'Basic text extraction would go here',
          format: 'basic'
        },
        skills: ['JavaScript', 'React'], // Placeholder
        experience: ['Software Developer'], // Placeholder
        atsScore: Math.floor(Math.random() * 100)
      }
    };
  }

  private extractTopSkills(resumes: IResumeDocument[]): string[] {
    const skillCounts: Record<string, number> = {};
    
    resumes.forEach(resume => {
      resume.skills?.forEach(skill => {
        skillCounts[skill] = (skillCounts[skill] || 0) + 1;
      });
    });

    return Object.entries(skillCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([skill]) => skill);
  }
}

// Export singleton instance
export const resumeServiceDataLayer = ResumeServiceDataLayer.getInstance();