/**
 * Application Insights Custom Events for Resume Processing
 * 
 * Provides structured logging and monitoring for the enhanced resume processing pipeline.
 * Integrates with Azure Application Insights for dashboard visualization and alerting.
 */

// Define Attributes interface for telemetry events
interface Attributes {
  [key: string]: string | number | boolean | undefined;
}

export interface ResumeProcessedEvent extends Attributes {
  userId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  processingMethod: 'foundry-document-intelligence' | 'azure-form-recognizer' | 'openai-extraction';
  processingTime: number;
  confidence?: number;
  success: boolean;
  errorMessage?: string;
  retryCount?: number;
  storageProvider: 'firebase' | 'azure-blob';
  hasJobDescription: boolean;
  targetRole?: string;
  targetIndustry?: string;
  experienceLevel?: string;
}

export interface ATSScoreComputedEvent extends Attributes {
  userId: string;
  atsScore: number;
  overallGrade: string;
  processingTime: number;
  keywordScore: number;
  formatScore: number;
  structureScore: number;
  contentScore: number;
  hasJobDescription: boolean;
  targetIndustry?: string;
  recommendationsCount: number;
  criticalIssuesCount: number;
  success: boolean;
  errorMessage?: string;
}

export interface JobMatchComputedEvent extends Attributes {
  userId: string;
  jobMatchScore: number;
  matchGrade: string;
  processingTime: number;
  skillsMatchScore: number;
  experienceMatchScore: number;
  educationMatchScore: number;
  culturalFitScore: number;
  semanticSimilarity: number;
  criticalGapsCount: number;
  missingKeywordsCount: number;
  targetRole?: string;
  experienceLevel?: string;
  success: boolean;
  errorMessage?: string;
}

export interface FoundryModelUsageEvent extends Attributes {
  userId: string;
  modelType: 'document-intelligence' | 'openai-gpt-4' | 'openai-embeddings';
  operation: 'resume-analysis' | 'ats-optimization' | 'job-matching' | 'skills-normalization';
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  pagesProcessed?: number;
  documentsProcessed?: number;
  processingTime: number;
  costEstimate?: number;
  success: boolean;
  errorType?: string;
  rateLimited?: boolean;
}

export interface ResumeProcessingErrorEvent extends Attributes {
  userId: string;
  errorType: 'extraction-failed' | 'ats-analysis-failed' | 'job-matching-failed' | 'storage-failed' | 'validation-failed';
  errorMessage: string;
  errorStack?: string;
  processingMethod: string;
  retryAttempt: number;
  fileName?: string;
  fileSize?: number;
  processingTime: number;
  recovery: 'fallback-used' | 'retry-scheduled' | 'failed-permanently';
}

/**
 * Resume Processing Telemetry Service
 */
class ResumeProcessingTelemetry {
  private telemetry: any;

  constructor() {
    // Initialize Application Insights if available
    if (typeof window !== 'undefined') {
      // Client-side - use React Application Insights
      const { ReactPlugin } = require('@microsoft/applicationinsights-react-js');
      const { ApplicationInsights } = require('@microsoft/applicationinsights-web');
      
      if (process.env.NEXT_PUBLIC_APPINSIGHTS_INSTRUMENTATIONKEY) {
        const reactPlugin = new ReactPlugin();
        this.telemetry = new ApplicationInsights({
          config: {
            instrumentationKey: process.env.NEXT_PUBLIC_APPINSIGHTS_INSTRUMENTATIONKEY,
            extensions: [reactPlugin],
            extensionConfig: {
              [reactPlugin.identifier]: {}
            }
          }
        });
        this.telemetry.loadAppInsights();
      }
    } else {
      // Server-side - use Node.js Application Insights
      try {
        const appInsights = require('applicationinsights');
        
        if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
          appInsights.setup(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING)
            .setAutoDependencyCorrelation(true)
            .setAutoCollectRequests(true)
            .setAutoCollectPerformance(true, true)
            .setAutoCollectExceptions(true)
            .setAutoCollectDependencies(true)
            .setAutoCollectConsole(true)
            .setUseDiskRetryCaching(true)
            .setSendLiveMetrics(true)
            .start();
            
          this.telemetry = appInsights.defaultClient;
        }
      } catch (error) {
        console.warn('Application Insights not available:', error);
      }
    }
  }

  /**
   * Track resume processing completion
   */
  trackResumeProcessed(event: ResumeProcessedEvent): void {
    this.trackEvent('ResumeProcessed', event);
    
    // Track processing time as a metric
    this.trackMetric('ResumeProcessingTime', event.processingTime, {
      processingMethod: event.processingMethod,
      success: event.success.toString(),
      hasJobDescription: event.hasJobDescription.toString()
    });
    
    // Track file size distribution
    this.trackMetric('ResumeFileSize', event.fileSize, {
      mimeType: event.mimeType
    });
    
    console.log(`📊 Resume processed: ${event.fileName} (${event.processingMethod}) in ${event.processingTime}ms`);
  }

  /**
   * Track ATS score computation
   */
  trackATSScoreComputed(event: ATSScoreComputedEvent): void {
    this.trackEvent('ATSScoreComputed', event);
    
    // Track ATS score distribution
    this.trackMetric('ATSScore', event.atsScore, {
      overallGrade: event.overallGrade,
      hasJobDescription: event.hasJobDescription.toString(),
      targetIndustry: event.targetIndustry || 'unknown'
    });
    
    // Track individual component scores
    this.trackMetric('ATSKeywordScore', event.keywordScore);
    this.trackMetric('ATSFormatScore', event.formatScore);
    this.trackMetric('ATSStructureScore', event.structureScore);
    this.trackMetric('ATSContentScore', event.contentScore);
    
    console.log(`🎯 ATS score computed: ${event.atsScore}/100 (${event.overallGrade}) in ${event.processingTime}ms`);
  }

  /**
   * Track job matching computation
   */
  trackJobMatchComputed(event: JobMatchComputedEvent): void {
    this.trackEvent('JobMatchComputed', event);
    
    // Track job match score distribution
    this.trackMetric('JobMatchScore', event.jobMatchScore, {
      matchGrade: event.matchGrade,
      targetRole: event.targetRole || 'unknown',
      experienceLevel: event.experienceLevel || 'unknown'
    });
    
    // Track semantic similarity effectiveness
    this.trackMetric('SemanticSimilarity', event.semanticSimilarity);
    
    // Track skill gaps
    this.trackMetric('CriticalSkillGaps', event.criticalGapsCount);
    this.trackMetric('MissingKeywords', event.missingKeywordsCount);
    
    console.log(`🎯 Job match computed: ${event.jobMatchScore}/100 (${event.matchGrade}) in ${event.processingTime}ms`);
  }

  /**
   * Track Foundry model usage for billing and quota monitoring
   */
  trackFoundryModelUsage(event: FoundryModelUsageEvent): void {
    this.trackEvent('FoundryModelUsage', event);
    
    // Track token usage for cost monitoring
    if (event.totalTokens) {
      this.trackMetric('FoundryTokensUsed', event.totalTokens, {
        modelType: event.modelType,
        operation: event.operation
      });
    }
    
    // Track pages processed for Document Intelligence
    if (event.pagesProcessed) {
      this.trackMetric('FoundryPagesProcessed', event.pagesProcessed, {
        modelType: event.modelType
      });
    }
    
    // Track estimated cost
    if (event.costEstimate) {
      this.trackMetric('FoundryCostEstimate', event.costEstimate, {
        modelType: event.modelType,
        operation: event.operation
      });
    }
    
    console.log(`💰 Foundry usage: ${event.modelType} (${event.operation}) - ${event.totalTokens || event.pagesProcessed} units`);
  }

  /**
   * Track processing errors
   */
  trackResumeProcessingError(event: ResumeProcessingErrorEvent): void {
    this.trackEvent('ResumeProcessingError', event);
    
    // Track error frequency by type
    this.trackMetric('ResumeProcessingErrors', 1, {
      errorType: event.errorType,
      processingMethod: event.processingMethod,
      recovery: event.recovery
    });
    
    console.error(`❌ Resume processing error: ${event.errorType} - ${event.errorMessage}`);
  }

  /**
   * Track custom metric
   */
  trackMetric(name: string, value: number, properties?: Record<string, string>): void {
    if (this.telemetry) {
      if (typeof window !== 'undefined') {
        // Client-side
        this.telemetry.trackMetric({ name, average: value }, properties);
      } else {
        // Server-side
        this.telemetry.trackMetric({ name, value }, properties);
      }
    }
  }

  /**
   * Track custom event
   */
  trackEvent(name: string, properties: Record<string, any>): void {
    if (this.telemetry) {
      // Convert all property values to strings for Application Insights
      const stringProperties: Record<string, string> = {};
      Object.entries(properties).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          stringProperties[key] = typeof value === 'string' ? value : JSON.stringify(value);
        }
      });

      if (typeof window !== 'undefined') {
        // Client-side
        this.telemetry.trackEvent({ name }, stringProperties);
      } else {
        // Server-side
        this.telemetry.trackEvent({ name, properties: stringProperties });
      }
    }
    
    // Also log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔍 Event: ${name}`, properties);
    }
  }

  /**
   * Track dependency call (external service calls)
   */
  trackDependency(
    name: string,
    command: string,
    startTime: number,
    duration: number,
    success: boolean,
    properties?: Record<string, string>
  ): void {
    if (this.telemetry && typeof window === 'undefined') {
      // Server-side only
      this.telemetry.trackDependency({
        name,
        data: command,
        startTime: new Date(startTime),
        duration,
        success,
        properties
      });
    }
  }

  /**
   * Create performance tracking wrapper for async operations
   */
  withPerformanceTracking<T>(
    operationName: string,
    operation: () => Promise<T>,
    additionalProperties?: Record<string, string>
  ): Promise<T> {
    const startTime = Date.now();
    
    return operation()
      .then(result => {
        const duration = Date.now() - startTime;
        
        this.trackMetric(`${operationName}Duration`, duration, additionalProperties);
        this.trackDependency(
          operationName,
          'internal-operation',
          startTime,
          duration,
          true,
          additionalProperties
        );
        
        return result;
      })
      .catch(error => {
        const duration = Date.now() - startTime;
        
        this.trackMetric(`${operationName}Duration`, duration, {
          ...additionalProperties,
          success: 'false'
        });
        
        this.trackDependency(
          operationName,
          'internal-operation',
          startTime,
          duration,
          false,
          {
            ...additionalProperties,
            error: error.message
          }
        );
        
        throw error;
      });
  }

  /**
   * Flush telemetry (useful for serverless environments)
   */
  flush(): void {
    if (this.telemetry) {
      if (typeof window !== 'undefined') {
        // Client-side
        this.telemetry.flush();
      } else {
        // Server-side
        this.telemetry.flush();
      }
    }
  }
}

// Export singleton instance
export const resumeProcessingTelemetry = new ResumeProcessingTelemetry();

// Export helper functions
export function createResumeProcessedEvent(
  userId: string,
  fileName: string,
  fileSize: number,
  mimeType: string,
  processingMethod: ResumeProcessedEvent['processingMethod'],
  processingTime: number,
  success: boolean,
  options: Partial<ResumeProcessedEvent> = {}
): ResumeProcessedEvent {
  return {
    userId,
    fileName,
    fileSize,
    mimeType,
    processingMethod,
    processingTime,
    success,
    storageProvider: 'firebase', // default
    hasJobDescription: false, // default
    ...options
  };
}

export function createATSScoreComputedEvent(
  userId: string,
  atsScore: number,
  overallGrade: string,
  processingTime: number,
  componentScores: {
    keywordScore: number;
    formatScore: number;
    structureScore: number;
    contentScore: number;
  },
  options: Partial<ATSScoreComputedEvent> = {}
): ATSScoreComputedEvent {
  return {
    userId,
    atsScore,
    overallGrade,
    processingTime,
    ...componentScores,
    hasJobDescription: false, // default
    recommendationsCount: 0, // default
    criticalIssuesCount: 0, // default
    success: true, // default
    ...options
  };
}

export function createJobMatchComputedEvent(
  userId: string,
  jobMatchScore: number,
  matchGrade: string,
  processingTime: number,
  componentScores: {
    skillsMatchScore: number;
    experienceMatchScore: number;
    educationMatchScore: number;
    culturalFitScore: number;
    semanticSimilarity: number;
  },
  options: Partial<JobMatchComputedEvent> = {}
): JobMatchComputedEvent {
  return {
    userId,
    jobMatchScore,
    matchGrade,
    processingTime,
    ...componentScores,
    criticalGapsCount: 0, // default
    missingKeywordsCount: 0, // default
    success: true, // default
    ...options
  };
}
