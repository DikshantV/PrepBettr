// Auto-Apply Job Application Types and Interfaces

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  phone?: string;
  location?: string;
  portfolio?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  skills: string[];
  experience: WorkExperience[];
  education: Education[];
  summary?: string;
  targetRoles: string[];
  salaryRange?: {
    min: number;
    max: number;
    currency: string;
  };
  workPreferences: {
    remote: boolean;
    hybrid: boolean;
    onsite: boolean;
    locations: string[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface WorkExperience {
  id: string;
  company: string;
  position: string;
  startDate: string;
  endDate?: string;
  isCurrent: boolean;
  description: string;
  achievements: string[];
  technologies: string[];
  location?: string;
}

export interface Education {
  id: string;
  institution: string;
  degree: string;
  fieldOfStudy: string;
  startDate: string;
  endDate?: string;
  gpa?: number;
  achievements?: string[];
}

export interface JobListing {
  id: string;
  title: string;
  company: string;
  location: string;
  salary?: {
    min?: number;
    max?: number;
    currency: string;
    period: 'hourly' | 'monthly' | 'yearly';
  };
  jobType: 'full-time' | 'part-time' | 'contract' | 'internship';
  workArrangement: 'remote' | 'hybrid' | 'onsite';
  description: string;
  requirements: string[];
  responsibilities: string[];
  benefits?: string[];
  postedDate: string;
  applicationDeadline?: string;
  jobPortal: JobPortal;
  originalUrl: string;
  companyLogo?: string;
  relevancyScore?: number;
  matchedSkills: string[];
  missingSkills: string[];
  applicationStatus: ApplicationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface JobPortal {
  name: 'LinkedIn' | 'Indeed' | 'Glassdoor' | 'AngelList' | 'RemoteOK' | 'ZipRecruiter' | 'Monster' | 'CareerBuilder' | 'TheirStack';
  logo: string;
  website: string;
  supportsAutoApply: boolean;
}

export type ApplicationStatus = 
  | 'discovered'
  | 'analyzing'
  | 'ready_to_apply'
  | 'applying'
  | 'applied'
  | 'application_viewed'
  | 'interview_request'
  | 'rejected'
  | 'withdrawn'
  | 'expired';

export interface JobApplication {
  id: string;
  userId: string;
  jobId: string;
  status: ApplicationStatus;
  appliedAt?: string;
  coverLetter?: string;
  customResume?: string;
  applicationData: Record<string, any>;
  automationLog: AutomationLogEntry[];
  followUpReminders: FollowUpReminder[];
  createdAt: string;
  updatedAt: string;
}

export interface AutomationLogEntry {
  id: string;
  timestamp: string;
  action: 'job_discovered' | 'relevancy_calculated' | 'application_submitted' | 'error' | 'follow_up_sent';
  status: 'success' | 'error' | 'warning' | 'info';
  message: string;
  details?: Record<string, any>;
}

export interface FollowUpReminder {
  id: string;
  scheduledDate: string;
  type: 'initial_follow_up' | 'second_follow_up' | 'thank_you' | 'status_check';
  sent: boolean;
  sentAt?: string;
}

export interface JobSearchFilters {
  keywords: string[];
  locations: string[];
  jobTypes: Array<'full-time' | 'part-time' | 'contract' | 'internship'>;
  workArrangements: Array<'remote' | 'hybrid' | 'onsite'>;
  salaryRange?: {
    min: number;
    max: number;
    currency: string;
  };
  experienceLevel: Array<'entry-level' | 'associate' | 'mid-senior' | 'director' | 'executive'>;
  companySize: Array<'startup' | 'small' | 'medium' | 'large' | 'enterprise'>;
  datePosted: 'past-24-hours' | 'past-week' | 'past-month' | 'any';
  portals: JobPortal['name'][];
  minimumRelevancyScore: number;
}

export interface JobSearchResults {
  jobs: JobListing[];
  totalCount: number;
  filters: JobSearchFilters;
  searchedAt: string;
  nextSearchScheduled?: string;
}

export interface RelevancyAnalysis {
  jobId: string;
  overallScore: number; // 0-100
  skillsMatch: {
    matched: Array<{ skill: string; weight: number }>;
    missing: Array<{ skill: string; importance: 'high' | 'medium' | 'low' }>;
    additional: string[];
  };
  experienceMatch: {
    score: number;
    analysis: string;
  };
  locationMatch: {
    score: number;
    analysis: string;
  };
  salaryMatch: {
    score: number;
    analysis: string;
  };
  cultureMatch?: {
    score: number;
    analysis: string;
  };
  recommendations: string[];
  tailoredResumeSuggestions: string[];
  coverLetterSuggestions: string[];
}

export interface AutoApplySettings {
  userId: string;
  isEnabled: boolean;
  filters: JobSearchFilters;
  autoApplyThreshold: number; // Minimum relevancy score to auto-apply
  dailyApplicationLimit: number;
  useCustomCoverLetter: boolean;
  coverLetterTemplate?: string;
  useCustomResume: boolean;
  resumeTemplate?: string;
  followUpEnabled: boolean;
  followUpSchedule: {
    initialDays: number;
    secondDays: number;
  };
  notifications: {
    email: boolean;
    newJobsFound: boolean;
    applicationsSubmitted: boolean;
    followUpReminders: boolean;
    errorAlerts: boolean;
  };
  blacklistedCompanies: string[];
  preferredCompanies: string[];
  createdAt: string;
  updatedAt: string;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface JobSearchRequest {
  userId: string;
  filters: JobSearchFilters;
  limit?: number;
  offset?: number;
}

export interface JobAnalysisRequest {
  userId: string;
  jobId: string;
  userProfile: UserProfile;
  jobListing: JobListing;
}

export interface ApplyToJobRequest {
  userId: string;
  jobId: string;
  customCoverLetter?: string;
  customResume?: string;
  applicationData?: Record<string, any>;
}

export interface ParseResumeRequest {
  file: File;
  userId: string;
}

export interface ParseResumeResponse {
  userProfile: Partial<UserProfile>;
  extractedText: string;
  confidence: number;
  warnings: string[];
}

// Dashboard Analytics Types
export interface JobApplicationAnalytics {
  totalApplications: number;
  applicationsByStatus: Record<ApplicationStatus, number>;
  applicationsByPortal: Record<string, number>;
  averageRelevancyScore: number;
  responseRate: number;
  interviewRate: number;
  applicationTrends: Array<{
    date: string;
    applications: number;
    responses: number;
  }>;
  topSkillsInDemand: Array<{
    skill: string;
    count: number;
    trend: 'up' | 'down' | 'stable';
  }>;
}

// Table Column Definitions
export interface JobListingTableColumn {
  key: keyof JobListing | 'actions';
  label: string;
  sortable: boolean;
  filterable: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

// Export interfaces for component props
export interface AutoApplyDashboardProps {
  userProfile: UserProfile;
  settings: AutoApplySettings;
}

export interface JobListingTableProps {
  jobs: JobListing[];
  onApply: (jobId: string) => void;
  onAnalyze: (jobId: string) => void;
  onView: (jobId: string) => void;
  loading?: boolean;
  pagination?: {
    total: number;
    current: number;
    pageSize: number;
    onChange: (page: number) => void;
  };
}

export interface JobFiltersProps {
  filters: JobSearchFilters;
  onChange: (filters: JobSearchFilters) => void;
  onSearch: () => void;
  loading?: boolean;
}

export interface ResumeUploadProps {
  onProfileExtracted: (profile: Partial<UserProfile>) => void;
  loading?: boolean;
}

export interface SettingsFormProps {
  settings: AutoApplySettings;
  onChange: (settings: AutoApplySettings) => void;
  onSave: () => void;
  loading?: boolean;
}

// Constants
export const JOB_PORTALS: JobPortal[] = [
  {
    name: 'LinkedIn',
    logo: '/icons/linkedin.svg',
    website: 'https://linkedin.com',
    supportsAutoApply: true
  },
  {
    name: 'Indeed',
    logo: '/icons/indeed.svg',
    website: 'https://indeed.com',
    supportsAutoApply: true
  },
  {
    name: 'Glassdoor',
    logo: '/icons/glassdoor.svg',
    website: 'https://glassdoor.com',
    supportsAutoApply: false
  },
  {
    name: 'AngelList',
    logo: '/icons/angellist.svg',
    website: 'https://angel.co',
    supportsAutoApply: true
  },
  {
    name: 'RemoteOK',
    logo: '/icons/remoteok.svg',
    website: 'https://remoteok.io',
    supportsAutoApply: false
  },
  {
    name: 'TheirStack',
    logo: '/icons/theirstack.svg',
    website: 'https://theirstack.com',
    supportsAutoApply: true
  }
];

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  'discovered': 'Discovered',
  'analyzing': 'Analyzing',
  'ready_to_apply': 'Ready to Apply',
  'applying': 'Applying',
  'applied': 'Applied',
  'application_viewed': 'Application Viewed',
  'interview_request': 'Interview Request',
  'rejected': 'Rejected',
  'withdrawn': 'Withdrawn',
  'expired': 'Expired'
};

export const APPLICATION_STATUS_COLORS: Record<ApplicationStatus, string> = {
  'discovered': 'bg-blue-500',
  'analyzing': 'bg-yellow-500',
  'ready_to_apply': 'bg-green-500',
  'applying': 'bg-orange-500',
  'applied': 'bg-purple-500',
  'application_viewed': 'bg-indigo-500',
  'interview_request': 'bg-emerald-500',
  'rejected': 'bg-red-500',
  'withdrawn': 'bg-gray-500',
  'expired': 'bg-gray-400'
};
