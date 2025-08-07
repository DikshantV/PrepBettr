import Bottleneck from 'bottleneck';
import { getAzureTokenService, AzureADConfig } from '../lib/services/azure-token-service';
import { JobListing, JobSearchFilters, ApplicationStatus } from '../types/auto-apply';

interface WellfoundJobSearchParams {
  q?: string; // Keywords
  location?: string;
  remote?: 'true' | 'false';
  job_type?: 'full-time' | 'part-time' | 'contract' | 'internship';
  experience?: 'junior' | 'mid' | 'senior' | 'lead' | 'c-level';
  role?: string;
  company_size?: 'startup' | 'small' | 'medium' | 'large';
  stage?: 'seed' | 'series-a' | 'series-b' | 'series-c' | 'growth';
  market?: string;
  salary_min?: number;
  salary_max?: number;
  equity_min?: number;
  equity_max?: number;
  page?: number;
  per_page?: number;
}

interface WellfoundJobResponse {
  jobs: WellfoundJob[];
  total: number;
  page: number;
  per_page: number;
  last_page: number;
}

interface WellfoundJob {
  id: number;
  title: string;
  description: string;
  job_type: string;
  remote: boolean;
  salary_min?: number;
  salary_max?: number;
  equity_min?: number;
  equity_max?: number;
  experience_level: string;
  created_at: string;
  updated_at: string;
  apply_url: string;
  company: {
    id: number;
    name: string;
    angellist_url: string;
    logo_url?: string;
    location?: string;
    company_size?: string;
    stage?: string;
    markets: string[];
  };
  location?: {
    name: string;
  };
}

interface WellfoundProfileInfo {
  id: number;
  name: string;
  email: string;
  bio?: string;
  locations: string[];
  roles: string[];
  skills: string[];
  avatar_url?: string;
}

interface WellfoundApplicationResponse {
  id: number;
  status: string;
  created_at: string;
  updated_at: string;
  message?: string;
}

export class WellfoundPortal {
  private tokenService = getAzureTokenService();
  private rateLimiter: Bottleneck;
  private baseUrl = 'https://api.wellfound.com/1';
  private azureAdConfig: AzureADConfig | null = null;

  constructor() {
    // Wellfound/AngelList API rate limits: More generous than LinkedIn
    // 1000 requests per hour per authenticated user
    this.rateLimiter = new Bottleneck({
      minTime: 3600, // Minimum 3.6 seconds between requests (1000 requests/hour)
      maxConcurrent: 2, // Allow 2 concurrent requests
      reservoir: 1000, // 1000 requests per hour
      reservoirRefreshAmount: 1000,
      reservoirRefreshInterval: 60 * 60 * 1000, // Refresh every hour
    });
  }

  /**
   * Initialize Wellfound portal with Azure AD configuration
   */
  async initialize(): Promise<void> {
    this.azureAdConfig = await this.tokenService.getAzureADConfig('wellfound');
    if (!this.azureAdConfig) {
      throw new Error('Wellfound Azure AD configuration not found. Please configure OAuth app first.');
    }
  }

  /**
   * Generate OAuth authorization URL for Wellfound
   */
  generateAuthUrl(userId: string, state?: string): string {
    if (!this.azureAdConfig) {
      throw new Error('Wellfound portal not initialized');
    }

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.azureAdConfig.clientId,
      redirect_uri: this.azureAdConfig.redirectUri,
      state: state || userId,
      scope: this.azureAdConfig.scopes.join(' '),
    });

    return `https://angel.co/api/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForTokens(code: string, userId: string): Promise<boolean> {
    if (!this.azureAdConfig) {
      throw new Error('Wellfound portal not initialized');
    }

    try {
      const response = await fetch('https://angel.co/api/oauth/token', {
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

      await this.tokenService.storeTokens('wellfound', userId, tokens);
      return true;
    } catch (error) {
      console.error('Wellfound token exchange error:', error);
      return false;
    }
  }

  /**
   * Get authenticated user profile
   */
  async getProfile(userId: string): Promise<WellfoundProfileInfo | null> {
    if (!this.azureAdConfig) {
      throw new Error('Wellfound portal not initialized');
    }

    const accessToken = await this.tokenService.getValidAccessToken('wellfound', userId, this.azureAdConfig);
    if (!accessToken) {
      throw new Error('No valid Wellfound access token found');
    }

    try {
      const response = await this.rateLimiter.schedule(async () => {
        return fetch(`${this.baseUrl}/me`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });
      });

      if (!response.ok) {
        throw new Error(`Wellfound profile fetch failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Wellfound profile fetch error:', error);
      return null;
    }
  }

  /**
   * Search for jobs on Wellfound
   */
  async searchJobs(userId: string, filters: JobSearchFilters): Promise<JobListing[]> {
    if (!this.azureAdConfig) {
      throw new Error('Wellfound portal not initialized');
    }

    const accessToken = await this.tokenService.getValidAccessToken('wellfound', userId, this.azureAdConfig);
    if (!accessToken) {
      throw new Error('No valid Wellfound access token found');
    }

    const searchParams: WellfoundJobSearchParams = {
      q: filters.keywords.join(' '),
      location: filters.locations[0] || '',
      job_type: this.mapJobTypeToWellfound(filters.jobTypes[0]),
      experience: this.mapExperienceLevelToWellfound(filters.experienceLevel[0]),
      remote: filters.workArrangements.includes('remote') ? 'true' : 'false',
      salary_min: filters.salaryRange?.min,
      salary_max: filters.salaryRange?.max,
      per_page: 50, // Maximum per request
      page: 1,
    };

    try {
      const queryParams = new URLSearchParams();
      Object.entries(searchParams).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          queryParams.append(key, value.toString());
        }
      });

      const response = await this.rateLimiter.schedule(async () => {
        return fetch(`${this.baseUrl}/jobs/search?${queryParams.toString()}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });
      });

      if (!response.ok) {
        throw new Error(`Wellfound job search failed: ${response.status}`);
      }

      const data: WellfoundJobResponse = await response.json();
      return this.transformWellfoundJobsToJobListings(data.jobs);
    } catch (error) {
      console.error('Wellfound job search error:', error);
      return [];
    }
  }

  /**
   * Apply to a job on Wellfound
   */
  async applyToJob(userId: string, jobId: string, applicationData: {
    message?: string;
    resume_url?: string;
  }): Promise<{ success: boolean; message: string }> {
    if (!this.azureAdConfig) {
      throw new Error('Wellfound portal not initialized');
    }

    const accessToken = await this.tokenService.getValidAccessToken('wellfound', userId, this.azureAdConfig);
    if (!accessToken) {
      return { success: false, message: 'No valid Wellfound access token found' };
    }

    try {
      const response = await this.rateLimiter.schedule(async () => {
        return fetch(`${this.baseUrl}/jobs/${jobId}/apply`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: applicationData.message || 'I am interested in this position and would love to discuss my qualifications further.',
            resume_url: applicationData.resume_url,
          }),
        });
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Wellfound job application failed: ${response.status} - ${errorData.error || response.statusText}`);
      }

      const result: WellfoundApplicationResponse = await response.json();
      return { 
        success: true, 
        message: `Application submitted successfully. Application ID: ${result.id}` 
      };
    } catch (error) {
      console.error('Wellfound job application error:', error);
      return { success: false, message: `Application failed: ${error}` };
    }
  }

  /**
   * Get application status for a job
   */
  async getApplicationStatus(userId: string, jobId: string): Promise<ApplicationStatus> {
    if (!this.azureAdConfig) {
      throw new Error('Wellfound portal not initialized');
    }

    const accessToken = await this.tokenService.getValidAccessToken('wellfound', userId, this.azureAdConfig);
    if (!accessToken) {
      return 'discovered';
    }

    try {
      const response = await this.rateLimiter.schedule(async () => {
        return fetch(`${this.baseUrl}/jobs/${jobId}/applications/mine`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });
      });

      if (!response.ok) {
        return 'discovered';
      }

      const data: WellfoundApplicationResponse = await response.json();
      return this.mapWellfoundStatusToApplicationStatus(data.status);
    } catch (error) {
      console.error('Wellfound application status error:', error);
      return 'discovered';
    }
  }

  /**
   * Get detailed job information
   */
  async getJobDetails(userId: string, jobId: string): Promise<WellfoundJob | null> {
    if (!this.azureAdConfig) {
      throw new Error('Wellfound portal not initialized');
    }

    const accessToken = await this.tokenService.getValidAccessToken('wellfound', userId, this.azureAdConfig);
    if (!accessToken) {
      return null;
    }

    try {
      const response = await this.rateLimiter.schedule(async () => {
        return fetch(`${this.baseUrl}/jobs/${jobId}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });
      });

      if (!response.ok) {
        throw new Error(`Wellfound job details fetch failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Wellfound job details error:', error);
      return null;
    }
  }

  /**
   * Check if user is connected to Wellfound
   */
  async isConnected(userId: string): Promise<boolean> {
    const tokens = await this.tokenService.getTokens('wellfound', userId);
    return tokens !== null && tokens.expiresAt > Date.now();
  }

  /**
   * Disconnect user from Wellfound
   */
  async disconnect(userId: string): Promise<void> {
    await this.tokenService.deleteTokens('wellfound', userId);
  }

  // Helper methods for mapping between our types and Wellfound types
  private mapJobTypeToWellfound(jobType?: string): WellfoundJobSearchParams['job_type'] {
    switch (jobType) {
      case 'full-time': return 'full-time';
      case 'part-time': return 'part-time';
      case 'contract': return 'contract';
      case 'internship': return 'internship';
      default: return 'full-time';
    }
  }

  private mapExperienceLevelToWellfound(level?: string): WellfoundJobSearchParams['experience'] {
    switch (level) {
      case 'entry-level': return 'junior';
      case 'associate': return 'mid';
      case 'mid-senior': return 'senior';
      case 'director': return 'lead';
      case 'executive': return 'c-level';
      default: return 'mid';
    }
  }

  private mapWellfoundStatusToApplicationStatus(wellfoundStatus: string): ApplicationStatus {
    switch (wellfoundStatus?.toLowerCase()) {
      case 'applied': return 'applied';
      case 'viewed': return 'application_viewed';
      case 'interviewing': return 'interview_request';
      case 'hired': return 'interview_request'; // Map hired to interview_request as closest match
      case 'rejected': return 'rejected';
      case 'withdrawn': return 'withdrawn';
      default: return 'discovered';
    }
  }

  private transformWellfoundJobsToJobListings(wellfoundJobs: WellfoundJob[]): JobListing[] {
    return wellfoundJobs.map((job) => {
      const salaryInfo = this.buildSalaryInfo(job);
      
      return {
        id: job.id.toString(),
        title: job.title,
        company: job.company.name,
        location: job.location?.name || job.company.location || 'Remote',
        salary: salaryInfo,
        jobType: this.mapWellfoundJobTypeToOur(job.job_type) as any,
        workArrangement: job.remote ? 'remote' : 'onsite' as any,
        description: job.description || 'No description available',
        requirements: [], // Would need to parse from description
        responsibilities: [], // Would need to parse from description
        benefits: undefined,
        postedDate: job.created_at,
        applicationDeadline: undefined,
        jobPortal: {
          name: 'AngelList', // Wellfound was formerly AngelList
          logo: '/icons/angellist.svg',
          website: 'https://wellfound.com',
          supportsAutoApply: true,
        },
        originalUrl: job.apply_url || `https://wellfound.com/jobs/${job.id}`,
        companyLogo: job.company.logo_url,
        relevancyScore: undefined,
        matchedSkills: [],
        missingSkills: [],
        applicationStatus: 'discovered',
        createdAt: job.created_at,
        updatedAt: job.updated_at,
      };
    });
  }

  private buildSalaryInfo(job: WellfoundJob) {
    if (job.salary_min || job.salary_max) {
      return {
        min: job.salary_min,
        max: job.salary_max,
        currency: 'USD', // Wellfound typically uses USD
        period: 'yearly' as const,
      };
    }
    return undefined;
  }

  private mapWellfoundJobTypeToOur(jobType: string): string {
    switch (jobType?.toLowerCase()) {
      case 'full-time': return 'full-time';
      case 'part-time': return 'part-time';
      case 'contract': return 'contract';
      case 'internship': return 'internship';
      default: return 'full-time';
    }
  }

  /**
   * Get company details
   */
  async getCompanyDetails(userId: string, companyId: string): Promise<any> {
    if (!this.azureAdConfig) {
      throw new Error('Wellfound portal not initialized');
    }

    const accessToken = await this.tokenService.getValidAccessToken('wellfound', userId, this.azureAdConfig);
    if (!accessToken) {
      return null;
    }

    try {
      const response = await this.rateLimiter.schedule(async () => {
        return fetch(`${this.baseUrl}/companies/${companyId}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });
      });

      if (!response.ok) {
        throw new Error(`Wellfound company details fetch failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Wellfound company details error:', error);
      return null;
    }
  }

  /**
   * Get user's applications history
   */
  async getApplicationHistory(userId: string): Promise<WellfoundApplicationResponse[]> {
    if (!this.azureAdConfig) {
      throw new Error('Wellfound portal not initialized');
    }

    const accessToken = await this.tokenService.getValidAccessToken('wellfound', userId, this.azureAdConfig);
    if (!accessToken) {
      return [];
    }

    try {
      const response = await this.rateLimiter.schedule(async () => {
        return fetch(`${this.baseUrl}/me/applications`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });
      });

      if (!response.ok) {
        throw new Error(`Wellfound applications fetch failed: ${response.status}`);
      }

      const data = await response.json();
      return data.applications || [];
    } catch (error) {
      console.error('Wellfound applications history error:', error);
      return [];
    }
  }
}

// Singleton instance
let wellfoundPortalInstance: WellfoundPortal | null = null;

export function getWellfoundPortal(): WellfoundPortal {
  if (!wellfoundPortalInstance) {
    wellfoundPortalInstance = new WellfoundPortal();
  }
  return wellfoundPortalInstance;
}
