import Bottleneck from 'bottleneck';
import { getAzureTokenService, AzureADConfig } from '../lib/services/azure-token-service';
import { JobListing, JobSearchFilters, ApplicationStatus } from '../types/auto-apply';
import { retryWithExponentialBackoff } from '../lib/utils/retry-with-backoff';

interface LinkedInJobSearchParams {
  keywords?: string;
  location?: string;
  distance?: number;
  jobType?: 'C' | 'P' | 'T' | 'I' | 'F' | 'V' | 'O'; // Contract, Part-time, Temporary, Internship, Full-time, Volunteer, Other
  experienceLevel?: '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10'; // 1=Internship, 2=Entry level, 3=Associate, 4=Mid-Senior, 5=Director, 6=Executive
  datePosted?: 'r86400' | 'r604800' | 'r2592000' | ''; // Past 24 hours, Past week, Past month, Any time
  sort?: 'DD' | 'R'; // Date Posted, Relevance
  start?: number;
  count?: number;
}

interface LinkedInJobResponse {
  elements: LinkedInJob[];
  paging: {
    count: number;
    start: number;
    total?: number;
  };
}

interface LinkedInJob {
  entityUrn: string;
  title: string;
  companyDetails: {
    company: {
      name: string;
      entityUrn: string;
    };
  };
  formattedLocation?: string;
  workplaceTypes?: string[];
  employmentStatus?: string;
  jobPostingOperationType?: string;
  listedAt: number;
  expireAt?: number;
  description?: {
    text: string;
  };
}

interface LinkedInProfileInfo {
  id: string;
  firstName: string;
  lastName: string;
  emailAddress: string;
  profilePicture?: {
    displayImage: string;
  };
}

export class LinkedInPortal {
  private tokenService = getAzureTokenService();
  private rateLimiter: Bottleneck;
  private baseUrl = 'https://api.linkedin.com/v2';
  private azureAdConfig: AzureADConfig | null = null;

  constructor() {
    // LinkedIn API rate limits: 500 requests per person per day for job search
    // Be more conservative with our limits
    this.rateLimiter = new Bottleneck({
      minTime: 2000, // Minimum 2 seconds between requests
      maxConcurrent: 1, // Only 1 concurrent request
      reservoir: 400, // 400 requests per day
      reservoirRefreshAmount: 400,
      reservoirRefreshInterval: 24 * 60 * 60 * 1000, // Refresh every 24 hours
    });
  }

  /**
   * Initialize LinkedIn portal with Azure AD configuration
   */
  async initialize(): Promise<void> {
    this.azureAdConfig = await this.tokenService.getAzureADConfig('linkedin');
    if (!this.azureAdConfig) {
      throw new Error('LinkedIn Azure AD configuration not found. Please configure OAuth app first.');
    }
  }

  /**
   * Generate OAuth authorization URL for LinkedIn
   */
  generateAuthUrl(userId: string, state?: string): string {
    if (!this.azureAdConfig) {
      throw new Error('LinkedIn portal not initialized');
    }

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.azureAdConfig.clientId,
      redirect_uri: this.azureAdConfig.redirectUri,
      state: state || userId,
      scope: this.azureAdConfig.scopes.join(' '),
    });

    return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForTokens(code: string, userId: string): Promise<boolean> {
    if (!this.azureAdConfig) {
      throw new Error('LinkedIn portal not initialized');
    }

    try {
      const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: this.azureAdConfig.redirectUri,
          client_id: this.azureAdConfig.clientId,
          client_secret: this.azureAdConfig.clientSecret,
        }).toString(),
      });

      if (!response.ok) {
        throw new Error(`Token exchange failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      const tokens = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || '',
        expiresAt: Date.now() + (data.expires_in * 1000),
        tokenType: data.token_type || 'Bearer',
        scope: data.scope,
      };

      await this.tokenService.storeTokens('linkedin', userId, tokens);
      return true;
    } catch (error) {
      console.error('LinkedIn token exchange error:', error);
      return false;
    }
  }

  /**
   * Get authenticated user profile
   */
  async getProfile(userId: string): Promise<LinkedInProfileInfo | null> {
    if (!this.azureAdConfig) {
      throw new Error('LinkedIn portal not initialized');
    }

    const accessToken = await this.tokenService.getValidAccessToken('linkedin', userId, this.azureAdConfig);
    if (!accessToken) {
      throw new Error('No valid LinkedIn access token found');
    }

    try {
      const response = await this.rateLimiter.schedule(async () => {
        return fetch(`${this.baseUrl}/people/~:(id,firstName,lastName,emailAddress,profilePicture(displayImage))`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });
      });

      if (!response.ok) {
        throw new Error(`LinkedIn profile fetch failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('LinkedIn profile fetch error:', error);
      return null;
    }
  }

  /**
   * Search for jobs on LinkedIn with retry logic and structured logging
   */
  async searchJobs(userId: string, filters: JobSearchFilters): Promise<JobListing[]> {
    if (!this.azureAdConfig) {
      throw new Error('LinkedIn portal not initialized');
    }

    const accessToken = await this.tokenService.getValidAccessToken('linkedin', userId, this.azureAdConfig);
    if (!accessToken) {
      throw new Error('No valid LinkedIn access token found');
    }

    const searchParams: LinkedInJobSearchParams = {
      keywords: filters.keywords.join(' '),
      location: filters.locations[0] || '',
      jobType: this.mapJobTypeToLinkedIn(filters.jobTypes[0]),
      experienceLevel: this.mapExperienceLevelToLinkedIn(filters.experienceLevel[0]),
      datePosted: this.mapDatePostedToLinkedIn(filters.datePosted),
      count: 25, // Maximum per request
      start: 0,
    };

    return await retryWithExponentialBackoff(
      async () => {
        this.logPortalAction(userId, 'job_search', 'started', { searchParams, portal: 'LinkedIn' });
        
        const queryParams = new URLSearchParams();
        Object.entries(searchParams).forEach(([key, value]) => {
          if (value !== undefined && value !== '') {
            queryParams.append(key, value.toString());
          }
        });

        const response = await this.rateLimiter.schedule(async () => {
          return fetch(`${this.baseUrl}/jobSearch?${queryParams.toString()}`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          });
        });

        if (!response.ok) {
          throw new Error(`LinkedIn job search failed: ${response.status} ${response.statusText}`);
        }

        const data: LinkedInJobResponse = await response.json();
        const jobs = this.transformLinkedInJobsToJobListings(data.elements);
        
        this.logPortalAction(userId, 'job_search', 'completed', {
          jobsFound: jobs.length,
          totalResults: data.paging.total,
          portal: 'LinkedIn'
        });
        
        return jobs;
      },
      'linkedin_job_search',
      userId,
      {
        maxRetries: 2,
        baseDelay: 3000, // LinkedIn rate limits are strict
        maxDelay: 30000
      }
    ).catch(error => {
      this.logPortalAction(userId, 'job_search', 'error', {
        error: error.message,
        portal: 'LinkedIn'
      });
      return []; // Return empty array on failure
    });
  }

  /**
   * Apply to a job on LinkedIn (simplified - would need more complex implementation)
   */
  async applyToJob(userId: string, jobId: string, applicationData: any): Promise<{ success: boolean; message: string }> {
    if (!this.azureAdConfig) {
      throw new Error('LinkedIn portal not initialized');
    }

    const accessToken = await this.tokenService.getValidAccessToken('linkedin', userId, this.azureAdConfig);
    if (!accessToken) {
      return { success: false, message: 'No valid LinkedIn access token found' };
    }

    try {
      // Note: LinkedIn's actual job application API is complex and requires special permissions
      // This is a simplified implementation for demonstration
      const response = await this.rateLimiter.schedule(async () => {
        return fetch(`${this.baseUrl}/jobs/${jobId}/application`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            candidateApplication: {
              jobApplication: {
                job: `urn:li:job:${jobId}`,
                ...applicationData,
              },
            },
          }),
        });
      });

      if (!response.ok) {
        throw new Error(`LinkedIn job application failed: ${response.status}`);
      }

      return { success: true, message: 'Application submitted successfully' };
    } catch (error) {
      console.error('LinkedIn job application error:', error);
      return { success: false, message: `Application failed: ${error}` };
    }
  }

  /**
   * Get application status for a job
   */
  async getApplicationStatus(userId: string, jobId: string): Promise<ApplicationStatus> {
    if (!this.azureAdConfig) {
      throw new Error('LinkedIn portal not initialized');
    }

    const accessToken = await this.tokenService.getValidAccessToken('linkedin', userId, this.azureAdConfig);
    if (!accessToken) {
      return 'discovered';
    }

    try {
      const response = await this.rateLimiter.schedule(async () => {
        return fetch(`${this.baseUrl}/jobs/${jobId}/applications`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });
      });

      if (!response.ok) {
        return 'discovered';
      }

      const data = await response.json();
      // Transform LinkedIn application status to our application status
      return this.mapLinkedInStatusToApplicationStatus(data.status);
    } catch (error) {
      console.error('LinkedIn application status error:', error);
      return 'discovered';
    }
  }

  /**
   * Check if user is connected to LinkedIn
   */
  async isConnected(userId: string): Promise<boolean> {
    const tokens = await this.tokenService.getTokens('linkedin', userId);
    return tokens !== null && tokens.expiresAt > Date.now();
  }

  /**
   * Disconnect user from LinkedIn
   */
  async disconnect(userId: string): Promise<void> {
    await this.tokenService.deleteTokens('linkedin', userId);
  }

  // Helper methods for mapping between our types and LinkedIn types
  private mapJobTypeToLinkedIn(jobType?: string): LinkedInJobSearchParams['jobType'] {
    switch (jobType) {
      case 'full-time': return 'F';
      case 'part-time': return 'P';
      case 'contract': return 'C';
      case 'internship': return 'I';
      default: return undefined;
    }
  }

  private mapExperienceLevelToLinkedIn(level?: string): LinkedInJobSearchParams['experienceLevel'] {
    switch (level) {
      case 'entry-level': return '2';
      case 'associate': return '3';
      case 'mid-senior': return '4';
      case 'director': return '5';
      case 'executive': return '6';
      default: return undefined;
    }
  }

  private mapDatePostedToLinkedIn(datePosted: string): LinkedInJobSearchParams['datePosted'] {
    switch (datePosted) {
      case 'past-24-hours': return 'r86400';
      case 'past-week': return 'r604800';
      case 'past-month': return 'r2592000';
      default: return '';
    }
  }

  private mapLinkedInStatusToApplicationStatus(linkedinStatus: string): ApplicationStatus {
    switch (linkedinStatus?.toLowerCase()) {
      case 'submitted': return 'applied';
      case 'viewed': return 'application_viewed';
      case 'interviewing': return 'interview_request';
      case 'rejected': return 'rejected';
      case 'withdrawn': return 'withdrawn';
      default: return 'discovered';
    }
  }

  private transformLinkedInJobsToJobListings(linkedinJobs: LinkedInJob[]): JobListing[] {
    return linkedinJobs.map((job, index) => {
      const jobId = this.extractJobIdFromUrn(job.entityUrn) || `linkedin-${Date.now()}-${index}`;
      
      return {
        id: jobId,
        title: job.title || 'Untitled Position',
        company: job.companyDetails?.company?.name || 'Unknown Company',
        location: job.formattedLocation || 'Location not specified',
        salary: undefined, // LinkedIn often doesn't provide salary in search results
        jobType: this.mapLinkedInJobTypeToOur(job.employmentStatus) as any,
        workArrangement: this.mapWorkplaceTypesToOur(job.workplaceTypes) as any,
        description: job.description?.text || 'No description available',
        requirements: [], // Would need detailed job fetch
        responsibilities: [], // Would need detailed job fetch
        benefits: undefined,
        postedDate: new Date(job.listedAt).toISOString(),
        applicationDeadline: job.expireAt ? new Date(job.expireAt).toISOString() : undefined,
        jobPortal: {
          name: 'LinkedIn',
          logo: '/icons/linkedin.svg',
          website: 'https://linkedin.com',
          supportsAutoApply: true,
        },
        originalUrl: `https://www.linkedin.com/jobs/view/${jobId}`,
        companyLogo: undefined, // Would need company details fetch
        relevancyScore: undefined,
        matchedSkills: [],
        missingSkills: [],
        applicationStatus: 'discovered',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });
  }

  private extractJobIdFromUrn(urn: string): string | null {
    const match = urn.match(/urn:li:job:(\d+)/);
    return match ? match[1] : null;
  }

  private mapLinkedInJobTypeToOur(employmentStatus?: string): string {
    switch (employmentStatus?.toLowerCase()) {
      case 'full_time': return 'full-time';
      case 'part_time': return 'part-time';
      case 'contract': return 'contract';
      case 'internship': return 'internship';
      default: return 'full-time';
    }
  }

  private mapWorkplaceTypesToOur(workplaceTypes?: string[]): string {
    if (!workplaceTypes || workplaceTypes.length === 0) return 'onsite';
    
    if (workplaceTypes.includes('remote')) return 'remote';
    if (workplaceTypes.includes('hybrid')) return 'hybrid';
    return 'onsite';
  }

  /**
   * Log portal actions with structured logging for Application Insights
   */
  private logPortalAction(userId: string, action: string, status: string, details: any = {}): void {
    const logData = {
      level: status === 'error' ? 'error' : 'info',
      message: `LinkedIn portal ${action} ${status}`,
      properties: {
        userId,
        action,
        status,
        portal: 'LinkedIn',
        ...details,
        timestamp: new Date().toISOString()
      }
    };

    const logLevel = status === 'error' ? 'error' : 'log';
    console[logLevel]('PORTAL_ACTION', JSON.stringify(logData));
  }
}

// Singleton instance
let linkedinPortalInstance: LinkedInPortal | null = null;

export function getLinkedInPortal(): LinkedInPortal {
  if (!linkedinPortalInstance) {
    linkedinPortalInstance = new LinkedInPortal();
  }
  return linkedinPortalInstance;
}
