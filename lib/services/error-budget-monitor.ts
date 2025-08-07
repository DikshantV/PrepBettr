import { db } from '@/firebase/client';
import { collection, addDoc, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';

export interface ErrorEvent {
  featureName: string;
  errorType: 'client_error' | 'server_error' | 'performance' | 'user_experience';
  errorMessage: string;
  userId?: string;
  userAgent?: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, any>;
}

export interface ErrorBudget {
  featureName: string;
  timeWindow: number; // in minutes
  errorThreshold: number; // maximum allowed errors in the time window
  currentErrors: number;
  budgetExceeded: boolean;
  lastReset: Date;
}

class ErrorBudgetMonitorService {
  private static instance: ErrorBudgetMonitorService;
  private readonly COLLECTION_NAME = 'featureErrors';
  private readonly ERROR_BUDGETS_COLLECTION = 'errorBudgets';

  // Default error budgets for our features
  private readonly DEFAULT_BUDGETS: Record<string, Omit<ErrorBudget, 'currentErrors' | 'budgetExceeded' | 'lastReset'>> = {
    autoApplyAzure: {
      featureName: 'autoApplyAzure',
      timeWindow: 60, // 1 hour
      errorThreshold: 10, // max 10 errors per hour
    },
    portalIntegration: {
      featureName: 'portalIntegration', 
      timeWindow: 60, // 1 hour
      errorThreshold: 5, // max 5 errors per hour
    }
  };

  static getInstance(): ErrorBudgetMonitorService {
    if (!ErrorBudgetMonitorService.instance) {
      ErrorBudgetMonitorService.instance = new ErrorBudgetMonitorService();
    }
    return ErrorBudgetMonitorService.instance;
  }

  /**
   * Log an error event for monitoring
   */
  async logError(errorEvent: ErrorEvent): Promise<void> {
    try {
      await addDoc(collection(db, this.COLLECTION_NAME), {
        ...errorEvent,
        timestamp: Timestamp.fromDate(errorEvent.timestamp),
        createdAt: Timestamp.now(),
      });

      console.log(`Error logged for feature ${errorEvent.featureName}:`, errorEvent.errorMessage);
      
      // Check if error budget is exceeded after logging
      await this.checkErrorBudget(errorEvent.featureName);
    } catch (error) {
      console.error('Error logging feature error:', error);
      // Don't throw to avoid cascading errors
    }
  }

  /**
   * Get error count for a feature within a time window
   */
  async getErrorCount(featureName: string, timeWindowMinutes: number = 60): Promise<number> {
    try {
      const cutoffTime = new Date(Date.now() - timeWindowMinutes * 60 * 1000);
      
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('featureName', '==', featureName),
        where('timestamp', '>=', Timestamp.fromDate(cutoffTime)),
        orderBy('timestamp', 'desc')
      );

      const snapshot = await getDocs(q);
      return snapshot.size;
    } catch (error) {
      console.error('Error getting error count:', error);
      return 0;
    }
  }

  /**
   * Check if error budget is exceeded for a feature
   */
  async checkErrorBudget(featureName: string): Promise<ErrorBudget> {
    const budgetConfig = this.DEFAULT_BUDGETS[featureName];
    if (!budgetConfig) {
      throw new Error(`No error budget configured for feature: ${featureName}`);
    }

    const currentErrors = await this.getErrorCount(featureName, budgetConfig.timeWindow);
    const budgetExceeded = currentErrors > budgetConfig.errorThreshold;

    const errorBudget: ErrorBudget = {
      ...budgetConfig,
      currentErrors,
      budgetExceeded,
      lastReset: new Date(),
    };

    // Log if budget is exceeded
    if (budgetExceeded) {
      console.warn(`🚨 Error budget exceeded for ${featureName}!`, {
        currentErrors,
        threshold: budgetConfig.errorThreshold,
        timeWindow: budgetConfig.timeWindow,
      });
      
      // Could trigger alerts, rollback, etc.
      await this.handleBudgetExceeded(featureName, errorBudget);
    }

    return errorBudget;
  }

  /**
   * Handle when error budget is exceeded
   */
  private async handleBudgetExceeded(featureName: string, errorBudget: ErrorBudget): Promise<void> {
    // Log the budget breach
    await addDoc(collection(db, this.ERROR_BUDGETS_COLLECTION), {
      featureName,
      breachedAt: Timestamp.now(),
      errorCount: errorBudget.currentErrors,
      threshold: errorBudget.errorThreshold,
      timeWindow: errorBudget.timeWindow,
      action: 'budget_exceeded_alert',
    });

    // In a real implementation, you might:
    // - Send alerts to monitoring systems
    // - Automatically disable the feature
    // - Reduce rollout percentage
    // - Trigger incident response
    
    console.log(`Error budget breach logged for ${featureName}`);
  }

  /**
   * Get error budget status for all features
   */
  async getAllErrorBudgets(): Promise<Record<string, ErrorBudget>> {
    const results: Record<string, ErrorBudget> = {};
    
    for (const featureName of Object.keys(this.DEFAULT_BUDGETS)) {
      try {
        results[featureName] = await this.checkErrorBudget(featureName);
      } catch (error) {
        console.error(`Error checking budget for ${featureName}:`, error);
      }
    }
    
    return results;
  }

  /**
   * Get recent errors for a feature
   */
  async getRecentErrors(featureName: string, limitCount: number = 10): Promise<ErrorEvent[]> {
    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('featureName', '==', featureName),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          timestamp: data.timestamp.toDate(),
        } as ErrorEvent;
      });
    } catch (error) {
      console.error('Error getting recent errors:', error);
      return [];
    }
  }

  /**
   * Convenience methods for specific feature logging
   */
  async logAutoApplyAzureError(errorMessage: string, severity: ErrorEvent['severity'] = 'medium', metadata?: Record<string, any>): Promise<void> {
    await this.logError({
      featureName: 'autoApplyAzure',
      errorType: 'client_error',
      errorMessage,
      severity,
      metadata,
      timestamp: new Date(),
    });
  }

  async logPortalIntegrationError(errorMessage: string, severity: ErrorEvent['severity'] = 'medium', metadata?: Record<string, any>): Promise<void> {
    await this.logError({
      featureName: 'portalIntegration',
      errorType: 'client_error',
      errorMessage,
      severity,
      metadata,
      timestamp: new Date(),
    });
  }
}

// Export singleton instance
export const errorBudgetMonitor = ErrorBudgetMonitorService.getInstance();
