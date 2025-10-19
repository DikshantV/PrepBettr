/**
 * Usage Tracking Service v2
 * 
 * Refactored to use the new data layer abstraction with dual-write support.
 * Tracks user usage across interviews, resume processing, and premium features.
 * Features backward compatibility and seamless migration between data stores.
 */

import { createDataStoreFactory } from '@/lib/data-layer/data-store-factory';
import { IUsageDocument } from '@/lib/data-layer/interfaces/IDocuments';
import { createDualWriteRepository } from '@/lib/data-layer/dual-write-decorator';
import { unifiedConfigService } from './unified-config-service';
import { logServerError } from '@/lib/errors';

export interface UsageStats {
  interviewsThisMonth: number;
  resumeProcessingThisMonth: number;
  totalInterviews: number;
  totalResumeProcessing: number;
  lastReset: Date;
  planType: 'free' | 'premium' | 'enterprise';
  premiumExpiresAt?: Date;
  quotaLimits: {
    interviews: number;
    resumeProcessing: number;
  };
  quotaUsed: {
    interviews: number;
    resumeProcessing: number;
  };
  quotaRemaining: {
    interviews: number;
    resumeProcessing: number;
  };
}

export interface UsageEvent {
  userId: string;
  eventType: 'interview_started' | 'interview_completed' | 'resume_processed' | 'premium_feature_used';
  eventData?: any;
  timestamp: Date;
  metadata?: {
    sessionId?: string;
    deviceInfo?: string;
    userAgent?: string;
    ipAddress?: string;
  };
}

export interface QuotaCheck {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetDate: Date;
  message?: string;
}

/**
 * Usage Tracking Service with new data layer abstraction
 */
class UsageTrackingServiceV2 {
  private initialized = false;
  private dataStoreFactory = createDataStoreFactory();
  private usageRepository: any; // Will be dual-write repository
  private quotaLimits = {
    free: {
      interviews: 3,
      resumeProcessing: 5
    },
    premium: {
      interviews: 50,
      resumeProcessing: 100
    },
    enterprise: {
      interviews: 1000,
      resumeProcessing: 1000
    }
  };

  /**
   * Initialize the usage tracking service
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const startTime = Date.now();
    console.log('🔧 Initializing Usage Tracking Service v2...');

    try {
      // Initialize data repositories with dual-write support
      await this.initializeDataLayer();

      // Load quota limits from configuration
      await this.loadQuotaConfiguration();
      
      this.initialized = true;
      const initTime = Date.now() - startTime;
      console.log(`✅ Usage Tracking Service v2 initialized in ${initTime}ms`);

    } catch (error) {
      console.error('❌ Failed to initialize Usage Tracking Service v2:', error);
      logServerError(error as Error, { 
        service: 'usage-tracking-v2', 
        action: 'initialize' 
      });
      // Don't throw - we can still operate with defaults
      this.initialized = true;
    }
  }

  /**
   * Initialize data layer with dual-write support
   */
  private async initializeDataLayer(): Promise<void> {
    try {
      // Create primary and secondary repositories
      const cosmosUsageRepo = this.dataStoreFactory.createCosmos().getUsageRepository();
      const firestoreUsageRepo = this.dataStoreFactory.createFirestore().getUsageRepository();

      // Create dual-write repository (Cosmos primary, Firestore secondary)
      this.usageRepository = createDualWriteRepository(
        cosmosUsageRepo,
        firestoreUsageRepo,
        {
          primaryProvider: 'cosmos',
          secondaryProvider: 'firestore',
          enableDualWrite: await unifiedConfigService.get('migration.dualWriteEnabled', true),
          readFallbackEnabled: await unifiedConfigService.get('migration.readFallbackEnabled', true),
          writeConsistencyCheck: await unifiedConfigService.get('migration.consistencyCheckEnabled', false)
        }
      );

      console.log('🔄 Usage tracking data layer initialized with dual-write support');
    } catch (error) {
      console.error('❌ Failed to initialize usage tracking data layer:', error);
      throw error;
    }
  }

  /**
   * Load quota configuration from unified config service
   */
  private async loadQuotaConfiguration(): Promise<void> {
    try {
      const freeInterviews = await unifiedConfigService.get('quotas.freeInterviews', 3);
      const freeResumes = await unifiedConfigService.get('quotas.freeResumes', 5);
      const premiumInterviews = await unifiedConfigService.get('quotas.premiumInterviews', 50);
      const premiumResumes = await unifiedConfigService.get('quotas.premiumResumes', 100);

      this.quotaLimits = {
        free: {
          interviews: freeInterviews,
          resumeProcessing: freeResumes
        },
        premium: {
          interviews: premiumInterviews,
          resumeProcessing: premiumResumes
        },
        enterprise: {
          interviews: 1000,
          resumeProcessing: 1000
        }
      };

      console.log('📊 Quota limits loaded:', this.quotaLimits);
    } catch (error) {
      console.warn('⚠️ Failed to load quota configuration, using defaults:', error.message);
    }
  }

  /**
   * Get user's usage statistics
   */
  async getUserUsage(userId: string): Promise<UsageStats | null> {
    try {
      await this.initialize();

      const result = await this.usageRepository.findById(userId);
      
      if (!result.success || !result.data) {
        // Create default usage record if none exists
        return await this.createDefaultUsageRecord(userId);
      }

      const usageData = result.data as IUsageDocument;
      
      // Check if we need to reset monthly counters
      const shouldReset = this.shouldResetMonthlyCounters(usageData.lastReset);
      if (shouldReset) {
        await this.resetMonthlyCounters(userId);
        // Refetch updated data
        return await this.getUserUsage(userId);
      }

      return this.mapUsageDocumentToStats(usageData);
    } catch (error) {
      console.error('❌ Failed to get user usage:', error);
      return null;
    }
  }

  /**
   * Check if user can perform an action (quota check)
   */
  async checkQuota(userId: string, actionType: 'interview' | 'resume_processing'): Promise<QuotaCheck> {
    try {
      const usage = await this.getUserUsage(userId);
      
      if (!usage) {
        // If we can't get usage, allow the action but warn
        console.warn(`⚠️ Could not get usage for user ${userId}, allowing action`);
        return {
          allowed: true,
          remaining: 0,
          limit: 0,
          resetDate: new Date(),
          message: 'Usage data unavailable'
        };
      }

      const limit = actionType === 'interview' 
        ? usage.quotaLimits.interviews 
        : usage.quotaLimits.resumeProcessing;

      const used = actionType === 'interview' 
        ? usage.quotaUsed.interviews 
        : usage.quotaUsed.resumeProcessing;

      const remaining = Math.max(0, limit - used);
      const allowed = remaining > 0;

      // Calculate next reset date (first day of next month)
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextMonth.setDate(1);
      nextMonth.setHours(0, 0, 0, 0);

      return {
        allowed,
        remaining,
        limit,
        resetDate: nextMonth,
        message: allowed ? undefined : `Monthly ${actionType} quota exceeded. Resets on ${nextMonth.toDateString()}`
      };
    } catch (error) {
      console.error('❌ Quota check failed:', error);
      // On error, allow the action to avoid blocking users
      return {
        allowed: true,
        remaining: 0,
        limit: 0,
        resetDate: new Date(),
        message: 'Quota check failed'
      };
    }
  }

  /**
   * Track a usage event
   */
  async trackUsage(event: UsageEvent): Promise<boolean> {
    try {
      await this.initialize();

      // Get current usage
      const usage = await this.getUserUsage(event.userId);
      if (!usage) {
        console.error(`❌ Could not track usage for user ${event.userId}: no usage record`);
        return false;
      }

      // Update usage counters
      const updates: Partial<IUsageDocument> = {
        updatedAt: new Date()
      };

      switch (event.eventType) {
        case 'interview_started':
          updates.interviewsThisMonth = usage.interviewsThisMonth + 1;
          updates.totalInterviews = usage.totalInterviews + 1;
          break;
        
        case 'interview_completed':
          // Interview completion doesn't increment counters (already counted on start)
          // But we could track completion rate or other metrics
          break;
        
        case 'resume_processed':
          updates.resumeProcessingThisMonth = usage.resumeProcessingThisMonth + 1;
          updates.totalResumeProcessing = usage.totalResumeProcessing + 1;
          break;
        
        case 'premium_feature_used':
          // Track premium feature usage if needed
          break;
      }

      // Update usage record
      const result = await this.usageRepository.update(event.userId, updates);
      
      if (!result.success) {
        console.error(`❌ Failed to update usage for user ${event.userId}:`, result.error);
        return false;
      }

      console.log(`📊 Tracked ${event.eventType} for user ${event.userId}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to track usage:', error);
      logServerError(error as Error, { 
        service: 'usage-tracking-v2', 
        action: 'trackUsage',
        userId: event.userId,
        eventType: event.eventType
      });
      return false;
    }
  }

  /**
   * Update user's plan type
   */
  async updatePlanType(
    userId: string, 
    planType: 'free' | 'premium' | 'enterprise', 
    premiumExpiresAt?: Date
  ): Promise<boolean> {
    try {
      await this.initialize();

      const updates: Partial<IUsageDocument> = {
        planType,
        premiumExpiresAt,
        updatedAt: new Date()
      };

      const result = await this.usageRepository.update(userId, updates);
      
      if (!result.success) {
        console.error(`❌ Failed to update plan for user ${userId}:`, result.error);
        return false;
      }

      console.log(`✅ Updated plan for user ${userId} to ${planType}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to update plan type:', error);
      return false;
    }
  }

  /**
   * Reset monthly counters for a user
   */
  async resetMonthlyCounters(userId: string): Promise<boolean> {
    try {
      const updates: Partial<IUsageDocument> = {
        interviewsThisMonth: 0,
        resumeProcessingThisMonth: 0,
        lastReset: new Date(),
        updatedAt: new Date()
      };

      const result = await this.usageRepository.update(userId, updates);
      
      if (!result.success) {
        console.error(`❌ Failed to reset monthly counters for user ${userId}:`, result.error);
        return false;
      }

      console.log(`🔄 Reset monthly counters for user ${userId}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to reset monthly counters:', error);
      return false;
    }
  }

  /**
   * Get usage statistics for multiple users (admin function)
   */
  async getUsageStatistics(limit: number = 100): Promise<{
    totalUsers: number;
    activeUsers: number;
    totalInterviews: number;
    totalResumeProcessing: number;
    planBreakdown: { [key: string]: number };
  }> {
    try {
      await this.initialize();

      const result = await this.usageRepository.findMany({
        orderBy: { updatedAt: 'desc' },
        limit
      });

      if (!result.success) {
        throw new Error(`Failed to get usage statistics: ${result.error}`);
      }

      const usageRecords = result.data || [];
      
      const stats = {
        totalUsers: usageRecords.length,
        activeUsers: 0,
        totalInterviews: 0,
        totalResumeProcessing: 0,
        planBreakdown: {
          free: 0,
          premium: 0,
          enterprise: 0
        }
      };

      for (const record of usageRecords) {
        // Consider user active if they've used the service in the last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        if (record.updatedAt && record.updatedAt > thirtyDaysAgo) {
          stats.activeUsers++;
        }

        stats.totalInterviews += record.totalInterviews || 0;
        stats.totalResumeProcessing += record.totalResumeProcessing || 0;
        stats.planBreakdown[record.planType || 'free']++;
      }

      return stats;
    } catch (error) {
      console.error('❌ Failed to get usage statistics:', error);
      throw error;
    }
  }

  /**
   * Bulk reset monthly counters (admin function for month transitions)
   */
  async bulkResetMonthlyCounters(): Promise<{
    success: boolean;
    resetCount: number;
    errors: string[];
  }> {
    try {
      await this.initialize();

      console.log('🔄 Starting bulk reset of monthly counters...');

      // Find all users who need monthly reset
      const result = await this.usageRepository.findMany({
        limit: 1000 // Process in batches
      });

      if (!result.success) {
        throw new Error(`Failed to get usage records: ${result.error}`);
      }

      const usageRecords = result.data || [];
      let resetCount = 0;
      const errors: string[] = [];

      for (const record of usageRecords) {
        try {
          if (this.shouldResetMonthlyCounters(record.lastReset)) {
            const resetSuccess = await this.resetMonthlyCounters(record.userId);
            if (resetSuccess) {
              resetCount++;
            } else {
              errors.push(`Failed to reset counters for user ${record.userId}`);
            }
          }
        } catch (error) {
          errors.push(`Error resetting user ${record.userId}: ${error.message}`);
        }
      }

      console.log(`✅ Bulk reset completed: ${resetCount} users reset, ${errors.length} errors`);

      return {
        success: errors.length === 0,
        resetCount,
        errors
      };
    } catch (error) {
      console.error('❌ Bulk reset failed:', error);
      return {
        success: false,
        resetCount: 0,
        errors: [error.message]
      };
    }
  }

  /**
   * Delete usage data for a user (GDPR compliance)
   */
  async deleteUserUsage(userId: string): Promise<boolean> {
    try {
      await this.initialize();

      const result = await this.usageRepository.delete(userId);
      
      if (!result.success) {
        console.error(`❌ Failed to delete usage data for user ${userId}:`, result.error);
        return false;
      }

      console.log(`🗑️ Deleted usage data for user ${userId}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to delete user usage:', error);
      return false;
    }
  }

  // Private helper methods

  private async createDefaultUsageRecord(userId: string): Promise<UsageStats> {
    const defaultUsage: Omit<IUsageDocument, 'id'> = {
      userId,
      planType: 'free',
      interviewsThisMonth: 0,
      resumeProcessingThisMonth: 0,
      totalInterviews: 0,
      totalResumeProcessing: 0,
      lastReset: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await this.usageRepository.create(defaultUsage);
    
    if (!result.success) {
      throw new Error(`Failed to create default usage record: ${result.error}`);
    }

    return this.mapUsageDocumentToStats(result.data);
  }

  private mapUsageDocumentToStats(usage: IUsageDocument): UsageStats {
    const planLimits = this.quotaLimits[usage.planType || 'free'];
    
    return {
      interviewsThisMonth: usage.interviewsThisMonth || 0,
      resumeProcessingThisMonth: usage.resumeProcessingThisMonth || 0,
      totalInterviews: usage.totalInterviews || 0,
      totalResumeProcessing: usage.totalResumeProcessing || 0,
      lastReset: usage.lastReset || new Date(),
      planType: usage.planType || 'free',
      premiumExpiresAt: usage.premiumExpiresAt,
      quotaLimits: {
        interviews: planLimits.interviews,
        resumeProcessing: planLimits.resumeProcessing
      },
      quotaUsed: {
        interviews: usage.interviewsThisMonth || 0,
        resumeProcessing: usage.resumeProcessingThisMonth || 0
      },
      quotaRemaining: {
        interviews: Math.max(0, planLimits.interviews - (usage.interviewsThisMonth || 0)),
        resumeProcessing: Math.max(0, planLimits.resumeProcessing - (usage.resumeProcessingThisMonth || 0))
      }
    };
  }

  private shouldResetMonthlyCounters(lastReset?: Date): boolean {
    if (!lastReset) return true;

    const now = new Date();
    const resetDate = new Date(lastReset);
    
    // Reset if it's a new month
    return now.getMonth() !== resetDate.getMonth() || 
           now.getFullYear() !== resetDate.getFullYear();
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
        quotaConfig: false
      };

      // Check data layer health
      try {
        if (this.usageRepository && typeof this.usageRepository.getHealthStatus === 'function') {
          const healthStatus = this.usageRepository.getHealthStatus();
          services.dataLayer = healthStatus.healthy;
        } else {
          services.dataLayer = true; // Assume healthy if no health check available
        }
      } catch (error) {
        services.dataLayer = false;
      }

      // Check if quota configuration is loaded
      services.quotaConfig = this.quotaLimits.free.interviews > 0;

      const healthy = services.dataLayer && services.quotaConfig;

      const result: any = { healthy, services };

      // Include dual-write metrics if available
      if (this.usageRepository && typeof this.usageRepository.getMetrics === 'function') {
        result.dualWriteMetrics = this.usageRepository.getMetrics();
      }

      return result;
    } catch (error) {
      console.error('❌ Usage tracking health check failed:', error);
      return {
        healthy: false,
        services: {},
        error: error.message
      };
    }
  }
}

// Export singleton instance
export const usageTrackingServiceV2 = new UsageTrackingServiceV2();
export default usageTrackingServiceV2;