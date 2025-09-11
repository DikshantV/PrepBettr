import { auth } from '@/firebase/client';

export interface RolloutConfig {
  percentage: number; // 0-100, percentage of users to include
  featureName: string;
}

export class UserTargetingService {
  private static instance: UserTargetingService;

  static getInstance(): UserTargetingService {
    if (!UserTargetingService.instance) {
      UserTargetingService.instance = new UserTargetingService();
    }
    return UserTargetingService.instance;
  }

  /**
   * Simple hash function to create a consistent hash from user ID
   */
  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Determines if a user should be included in a feature rollout
   * Uses consistent hashing to ensure the same user always gets the same result
   */
  isUserInRollout(userId: string, rolloutConfig: RolloutConfig): boolean {
    if (rolloutConfig.percentage <= 0) return false;
    if (rolloutConfig.percentage >= 100) return true;

    // Create a feature-specific hash by combining userId and feature name
    const combinedString = `${userId}-${rolloutConfig.featureName}`;
    const hash = this.hashUserId(combinedString);
    
    // Use modulo to get a consistent percentage (0-99)
    const userBucket = hash % 100;
    
    return userBucket < rolloutConfig.percentage;
  }

  /**
   * Get the current user's ID
   */
  getCurrentUserId(): string | null {
    return auth?.currentUser?.uid || null;
  }

  /**
   * Check if current user is in a specific feature rollout
   */
  isCurrentUserInRollout(rolloutConfig: RolloutConfig): boolean {
    const userId = this.getCurrentUserId();
    if (!userId) {
      // For anonymous users, use a fallback (could be device ID, session ID, etc.)
      const fallbackId = this.getAnonymousUserFallback();
      return this.isUserInRollout(fallbackId, rolloutConfig);
    }
    
    return this.isUserInRollout(userId, rolloutConfig);
  }

  /**
   * Generate a fallback ID for anonymous users
   * This could be based on device fingerprinting, localStorage, etc.
   */
  private getAnonymousUserFallback(): string {
    // Try to get or create a persistent anonymous ID
    let anonymousId = localStorage.getItem('prep_anonymous_id');
    
    if (!anonymousId) {
      // Generate a new anonymous ID
      anonymousId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('prep_anonymous_id', anonymousId);
    }
    
    return anonymousId;
  }

  /**
   * Predefined rollout configurations
   */
  static ROLLOUT_CONFIGS = {
    autoApplyAzure: {
      percentage: 5, // Start with 5% rollout
      featureName: 'autoApplyAzure'
    } as RolloutConfig,
    
    portalIntegration: {
      percentage: 5, // Start with 5% rollout
      featureName: 'portalIntegration'
    } as RolloutConfig,
    
    voiceInterview: {
      percentage: 10, // Start with 10% rollout
      featureName: 'voiceInterview'
    } as RolloutConfig,
    
    voiceInterviewV2: {
      percentage: 100, // Full rollout for Azure AI Foundry voice system
      featureName: 'voiceInterviewV2'
    } as RolloutConfig,
    
    premiumFeatures: {
      percentage: 15, // Start with 15% rollout
      featureName: 'premiumFeatures'
    } as RolloutConfig,
    
    newUI: {
      percentage: 20, // Start with 20% rollout
      featureName: 'newUI'
    } as RolloutConfig,
  };

  /**
   * Get all rollout statuses for the current user
   */
  getCurrentUserRolloutStatus(): Record<string, boolean> {
    return {
      autoApplyAzure: this.isCurrentUserInRollout(UserTargetingService.ROLLOUT_CONFIGS.autoApplyAzure),
      portalIntegration: this.isCurrentUserInRollout(UserTargetingService.ROLLOUT_CONFIGS.portalIntegration),
      voiceInterview: this.isCurrentUserInRollout(UserTargetingService.ROLLOUT_CONFIGS.voiceInterview),
      voiceInterviewV2: this.isCurrentUserInRollout(UserTargetingService.ROLLOUT_CONFIGS.voiceInterviewV2),
      premiumFeatures: this.isCurrentUserInRollout(UserTargetingService.ROLLOUT_CONFIGS.premiumFeatures),
      newUI: this.isCurrentUserInRollout(UserTargetingService.ROLLOUT_CONFIGS.newUI),
    };
  }

  /**
   * Update rollout percentage for a feature (for admin/testing purposes)
   */
  static updateRolloutPercentage(featureName: keyof typeof UserTargetingService.ROLLOUT_CONFIGS, percentage: number): void {
    if (percentage < 0 || percentage > 100) {
      throw new Error('Rollout percentage must be between 0 and 100');
    }
    
    UserTargetingService.ROLLOUT_CONFIGS[featureName].percentage = percentage;
    console.log(`Updated ${featureName} rollout to ${percentage}%`);
  }
}

// Export singleton instance
export const userTargetingService = UserTargetingService.getInstance();
