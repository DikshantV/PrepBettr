import Bottleneck from 'bottleneck';
import { JobListing, JobSearchFilters, ApplicationStatus } from '../types/auto-apply';
import { getAdminFirestore } from '../lib/firebase/admin';

// TheirStack API interfaces
interface TheirStackJobSearchPayload {
  filters: {
    keywords?: string[];
    locations?: string[];
    jobTypes?: string[];
    workArrangements?: string[];
    salaryRange?: {
      min?: number;
      max?: number;
      currency?: string;
    };
    experienceLevel?: string[];
    companySize?: string[];
    datePosted?: string;
  };
  page: number;
  limit: number;
}

interface TheirStackJobResponse {
  jobs: TheirStackJob[];
  totalCount: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

interface TheirStackJob {
  id: string;
  title: string;
  company: {
    name: string;
    logo?: string;
    size?: string;
    location?: string;
  };
  location: string;
  salary?: {
    min?: number;
    max?: number;
    currency?: string;
    period?: 'hourly' | 'monthly' | 'yearly';
  };
  jobType: string;
  workArrangement: string;
  description: string;
  requirements?: string[];
  responsibilities?: string[];
  benefits?: string[];
  postedDate: string;
  applicationDeadline?: string;
  originalUrl: string;
}

interface TheirStackCreditsUsage {
  month: string; // YYYY-MM format
  creditsUsed: number;
  lastUpdated: Date;
}

export class TheirStackPortal {
  private rateLimiter: Bottleneck;
  private baseUrl = 'https://api.theirstack.com';
  private firestore: any = null;

  constructor() {
    // TheirStack API rate limits: 300 requests per minute
    // Bottleneck configuration for rate limiting
    this.rateLimiter = new Bottleneck({
      minTime: 220, // Minimum 220ms between requests (300 req/min = 200ms, add buffer)
      maxConcurrent: 1, // Only 1 concurrent request to avoid rate limit breaches
      reservoir: 300, // 300 requests per minute
      reservoirRefreshAmount: 300,
      reservoirRefreshInterval: 60000, // Refresh every minute
    });

    // Initialize Firestore lazily
    this.initializeFirestore();
  }

  private async initializeFirestore(): Promise<void> {
    try {
      this.firestore = await getAdminFirestore();
    } catch (error) {
      console.error('❌ Failed to initialize Firestore for TheirStack portal:', error);
    }
  }

  /**
   * Search for jobs on TheirStack with rate limiting and credit tracking
   */
  async searchJobs(userId: string, filters: JobSearchFilters, page: number = 1, limit: number = 50): Promise<JobListing[]> {
    const apiKey = process.env.THEIRSTACK_API_KEY;
    
    if (!apiKey) {
      this.logError('theirStackSearchError', 'TheirStack API key not configured', { userId, filters });
      throw new Error('TheirStack API key not configured. Please add THEIRSTACK_API_KEY to your environment variables.');
    }

    // Transform our filters to TheirStack API format
    const searchPayload: TheirStackJobSearchPayload = {
      filters: {
        keywords: filters.keywords,
        locations: filters.locations,
        jobTypes: filters.jobTypes,
        workArrangements: filters.workArrangements,
        salaryRange: filters.salaryRange,
        experienceLevel: filters.experienceLevel,
        companySize: filters.companySize,
        datePosted: filters.datePosted
      },
      page,
      limit
    };

    try {
      // Execute search with rate limiting
      const response = await this.rateLimiter.schedule(async () => {
        return fetch(`${this.baseUrl}/v1/jobs/search`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'User-Agent': 'PrepBettr/1.0 (Job Search Automation)',
          },
          body: JSON.stringify(searchPayload)
        });
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        const errorMessage = `TheirStack API error: ${response.status} ${response.statusText} - ${errorText}`;
        
        this.logError('theirStackSearchError', errorMessage, {
          userId,
          statusCode: response.status,
          statusText: response.statusText,
          filters,
          page,
          limit
        });
        
        throw new Error(errorMessage);
      }

      const data: TheirStackJobResponse = await response.json();
      
      // Track credit usage (1 credit per job returned)
      const creditsUsed = data.jobs.length;
      await this.trackCreditUsage(userId, creditsUsed);

      // Transform TheirStack jobs to our JobListing format
      const jobListings = this.transformTheirStackJobsToJobListings(data.jobs);

      // Log successful search
      this.logSuccess('theirStackSearchSuccess', 'TheirStack job search completed successfully', {
        userId,
        jobsFound: jobListings.length,
        totalCount: data.totalCount,
        page,
        limit,
        creditsUsed,
        hasMore: data.hasMore
      });

      return jobListings;

    } catch (error) {
      if (error instanceof Bottleneck.BottleneckError) {
        // Rate limit breach detected
        this.logError('theirStackRateLimitBreach', 'TheirStack rate limit exceeded', {
          userId,
          error: error.message,
          filters
        });
        throw new Error('TheirStack rate limit exceeded. Please try again later.');
      }

      // Re-throw other errors
      this.logError('theirStackSearchError', `TheirStack search failed: ${error}`, {
        userId,
        error: error instanceof Error ? error.message : String(error),
        filters,
        page,
        limit
      });
      
      throw error;
    }
  }

  /**
   * Track credit usage in Firestore
   */
  private async trackCreditUsage(userId: string, creditsUsed: number): Promise<void> {
    if (!this.firestore || creditsUsed === 0) return;

    try {
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
      const docPath = `usage/theirstackCredits/${currentMonth}`;
      
      const docRef = this.firestore.collection('usage').doc('theirstackCredits').collection('monthly').doc(currentMonth);
      
      await docRef.set({
        month: currentMonth,
        creditsUsed: this.firestore.FieldValue.increment(creditsUsed),
        lastUpdated: new Date(),
        userId: userId // Track which user used credits
      }, { merge: true });

      // Check credit usage and emit warnings
      const updatedDoc = await docRef.get();
      const totalCreditsUsed = updatedDoc.data()?.creditsUsed || creditsUsed;
      
      // Emit warnings based on usage
      if (totalCreditsUsed >= 500) {
        this.logError('theirStackCreditsExceeded', 'TheirStack credits exceeded maximum threshold', {
          userId,
          creditsUsed: totalCreditsUsed,
          threshold: 500,
          month: currentMonth
        });
      } else if (totalCreditsUsed >= 160) { // 80% of 200 free credits
        this.logWarning('theirStackCreditsWarning', 'TheirStack credits approaching limit', {
          userId,
          creditsUsed: totalCreditsUsed,
          threshold: 160,
          freeLimit: 200,
          month: currentMonth
        });
      }

      // Track metric for Application Insights
      this.logMetric('theirStackCreditsUsed', creditsUsed, {
        userId,
        month: currentMonth,
        totalCreditsThisMonth: totalCreditsUsed
      });

    } catch (error) {
      console.error('❌ Failed to track TheirStack credit usage:', error);
    }
  }

  /**
   * Get credit usage for a specific month
   */
  async getCreditsUsage(month?: string): Promise<TheirStackCreditsUsage | null> {
    if (!this.firestore) return null;

    try {
      const targetMonth = month || new Date().toISOString().slice(0, 7);
      const docRef = this.firestore.collection('usage').doc('theirstackCredits').collection('monthly').doc(targetMonth);
      const doc = await docRef.get();

      if (doc.exists) {
        const data = doc.data();
        return {
          month: targetMonth,
          creditsUsed: data.creditsUsed || 0,
          lastUpdated: data.lastUpdated?.toDate() || new Date()
        };
      }

      return {
        month: targetMonth,
        creditsUsed: 0,
        lastUpdated: new Date()
      };
    } catch (error) {
      console.error('❌ Failed to get TheirStack credits usage:', error);
      return null;
    }
  }

  /**
   * Transform TheirStack jobs to our JobListing format
   */
  private transformTheirStackJobsToJobListings(theirStackJobs: TheirStackJob[]): JobListing[] {
    return theirStackJobs.map((job, index) => {
      const jobListing: JobListing = {
        id: job.id || `theirstack-${Date.now()}-${index}`,
        title: job.title || 'Untitled Position',
        company: job.company?.name || 'Unknown Company',
        location: job.location || 'Location not specified',
        salary: job.salary ? {
          min: job.salary.min,
          max: job.salary.max,
          currency: job.salary.currency || 'USD',
          period: job.salary.period || 'yearly'
        } : undefined,
        jobType: this.mapJobTypeToOur(job.jobType) as any,
        workArrangement: this.mapWorkArrangementToOur(job.workArrangement) as any,
        description: job.description || 'No description available',
        requirements: job.requirements || [],
        responsibilities: job.responsibilities || [],
        benefits: job.benefits,
        postedDate: job.postedDate || new Date().toISOString(),
        applicationDeadline: job.applicationDeadline,
        jobPortal: {
          name: 'TheirStack',
          logo: '/icons/theirstack.svg',
          website: 'https://theirstack.com',
          supportsAutoApply: true,
        },
        originalUrl: job.originalUrl || `https://theirstack.com/jobs/${job.id}`,
        companyLogo: job.company?.logo,
        relevancyScore: undefined, // Will be calculated later
        matchedSkills: [],
        missingSkills: [],
        applicationStatus: 'discovered',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      return jobListing;
    });
  }

  /**
   * Map TheirStack job types to our format
   */
  private mapJobTypeToOur(jobType: string): string {
    switch (jobType?.toLowerCase()) {
      case 'full-time':
      case 'fulltime':
        return 'full-time';
      case 'part-time':
      case 'parttime':
        return 'part-time';
      case 'contract':
      case 'contractor':
        return 'contract';
      case 'internship':
      case 'intern':
        return 'internship';
      default:
        return 'full-time';
    }
  }

  /**
   * Map TheirStack work arrangements to our format
   */
  private mapWorkArrangementToOur(workArrangement: string): string {
    switch (workArrangement?.toLowerCase()) {
      case 'remote':
        return 'remote';
      case 'hybrid':
        return 'hybrid';
      case 'onsite':
      case 'on-site':
      case 'office':
        return 'onsite';
      default:
        return 'onsite';
    }
  }

  /**
   * Log successful operations with structured logging for Application Insights
   */
  private logSuccess(eventName: string, message: string, properties: any = {}): void {
    const logData = {
      level: 'info',
      eventName,
      message,
      properties: {
        portal: 'TheirStack',
        timestamp: new Date().toISOString(),
        ...properties
      }
    };

    console.log('APPINSIGHTS', JSON.stringify(logData));
  }

  /**
   * Log errors with structured logging for Application Insights
   */
  private logError(eventName: string, message: string, properties: any = {}): void {
    const logData = {
      level: 'error',
      eventName,
      message,
      properties: {
        portal: 'TheirStack',
        timestamp: new Date().toISOString(),
        ...properties
      }
    };

    console.log('APPINSIGHTS', JSON.stringify(logData));
  }

  /**
   * Log warnings with structured logging for Application Insights
   */
  private logWarning(eventName: string, message: string, properties: any = {}): void {
    const logData = {
      level: 'warning',
      eventName,
      message,
      properties: {
        portal: 'TheirStack',
        timestamp: new Date().toISOString(),
        ...properties
      }
    };

    console.log('APPINSIGHTS', JSON.stringify(logData));
  }

  /**
   * Log custom metrics for Application Insights
   */
  private logMetric(metricName: string, value: number, properties: any = {}): void {
    const metricData = {
      type: 'metric',
      name: metricName,
      value,
      properties: {
        portal: 'TheirStack',
        timestamp: new Date().toISOString(),
        ...properties
      }
    };

    console.log('APPINSIGHTS', JSON.stringify(metricData));
  }

  /**
   * Check if TheirStack is properly configured
   */
  isConfigured(): boolean {
    return !!process.env.THEIRSTACK_API_KEY;
  }

  /**
   * Health check for TheirStack portal
   */
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    if (!this.isConfigured()) {
      return { healthy: false, message: 'TheirStack API key not configured' };
    }

    try {
      // Try a minimal API call to check connectivity
      const response = await this.rateLimiter.schedule(async () => {
        return fetch(`${this.baseUrl}/v1/health`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${process.env.THEIRSTACK_API_KEY}`,
            'User-Agent': 'PrepBettr/1.0 (Health Check)',
          }
        });
      });

      return {
        healthy: response.ok,
        message: response.ok ? 'TheirStack API accessible' : `HTTP ${response.status}: ${response.statusText}`
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Health check failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}

// Singleton instance
let theirStackPortalInstance: TheirStackPortal | null = null;

export function getTheirStackPortal(): TheirStackPortal {
  if (!theirStackPortalInstance) {
    theirStackPortalInstance = new TheirStackPortal();
  }
  return theirStackPortalInstance;
}

export default TheirStackPortal;
