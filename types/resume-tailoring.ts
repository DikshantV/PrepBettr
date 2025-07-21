/**
 * Data models and types for Resume Tailoring feature
 * Defines interfaces for resume analysis, job descriptions, and API responses
 */

// Base interfaces
export interface User {
  id: string;
  email: string;
  name: string;
}

// File upload interfaces
export interface FileUpload {
  file: File;
  name: string;
  size: number;
  type: string;
}

export interface UploadedFile {
  id: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  path: string;
  uploadedAt: string;
  userId: string;
}

// Job description interfaces
export interface JobDescription {
  id: string;
  source: 'upload' | 'paste' | 'url';
  content: string;
  title?: string;
  company?: string;
  location?: string;
  requirements?: string[];
  skills?: string[];
  extractedAt: string;
  userId: string;
}

export interface JobDescriptionInput {
  source: 'upload' | 'paste' | 'url';
  content?: string; // For paste
  url?: string; // For URL
  file?: File; // For upload
}

// Resume interfaces
export interface ResumeData {
  id: string;
  originalContent: string;
  tailoredContent?: string;
  personalInfo: {
    name: string;
    email: string;
    phone?: string;
    address?: string;
    linkedin?: string;
    github?: string;
  };
  sections: {
    summary?: string;
    experience: ExperienceItem[];
    education: EducationItem[];
    skills: string[];
    certifications?: CertificationItem[];
    projects?: ProjectItem[];
  };
  metadata: {
    originalFileName: string;
    uploadedAt: string;
    lastModified: string;
    userId: string;
  };
}

export interface ExperienceItem {
  title: string;
  company: string;
  location?: string;
  startDate: string;
  endDate?: string;
  current: boolean;
  description: string[];
  achievements?: string[];
}

export interface EducationItem {
  degree: string;
  institution: string;
  location?: string;
  graduationDate?: string;
  gpa?: string;
  relevant_coursework?: string[];
}

export interface CertificationItem {
  name: string;
  issuer: string;
  date?: string;
  expirationDate?: string;
  credentialId?: string;
}

export interface ProjectItem {
  name: string;
  description: string;
  technologies: string[];
  url?: string;
  startDate?: string;
  endDate?: string;
}

// Analysis and tailoring interfaces
export interface AnalysisResult {
  id: string;
  resumeId: string;
  jobDescriptionId: string;
  matchScore: number; // 0-100
  keywordMatches: string[];
  missingKeywords: string[];
  recommendations: Recommendation[];
  atsCompatibility: ATSCompatibility;
  analyzedAt: string;
  userId: string;
}

export interface Recommendation {
  type: 'add_keyword' | 'improve_section' | 'rewrite_bullet' | 'add_section' | 'format_improvement';
  section: string;
  priority: 'high' | 'medium' | 'low';
  description: string;
  suggestion: string;
  impact?: string;
}

export interface ATSCompatibility {
  score: number; // 0-100
  issues: ATSIssue[];
  recommendations: string[];
}

export interface ATSIssue {
  type: 'formatting' | 'keywords' | 'structure' | 'content';
  severity: 'critical' | 'warning' | 'info';
  description: string;
  solution: string;
}

// Tailored resume interface
export interface TailoredResume {
  id: string;
  originalResumeId: string;
  analysisId: string;
  tailoredContent: string;
  improvements: AppliedImprovement[];
  finalScore: number;
  generatedAt: string;
  userId: string;
}

export interface AppliedImprovement {
  recommendationId: string;
  type: string;
  section: string;
  originalText?: string;
  improvedText: string;
  impact: string;
}

// API Response interfaces
export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface FileUploadResponse {
  fileId: string;
  filename: string;
  size: number;
  uploadUrl?: string;
}

export interface ResumeAnalysisResponse {
  analysisId: string;
  matchScore: number;
  recommendations: Recommendation[];
  atsScore: number;
  processingTime: number;
}

export interface TailorResumeResponse {
  tailoredResumeId: string;
  downloadUrl: string;
  previewUrl: string;
  improvementSummary: {
    keywordsAdded: number;
    sectionsImproved: number;
    atsScoreImprovement: number;
  };
}

// Process status tracking
export interface ProcessStatus {
  id: string;
  userId: string;
  type: 'upload' | 'analysis' | 'tailoring' | 'generation';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  message: string;
  error?: string;
  startedAt: string;
  completedAt?: string;
  result?: any;
}

// Configuration interfaces
export interface TailoringConfig {
  targetRole?: string;
  industryFocus?: string;
  experienceLevel: 'entry' | 'mid' | 'senior' | 'executive';
  emphasizeKeywords: boolean;
  includeATSOptimization: boolean;
  preserveFormatting: boolean;
  maxLength?: number; // in pages
}

// Gemini API interfaces
export interface GeminiAnalysisPrompt {
  resumeContent: string;
  jobDescription: string;
  config: TailoringConfig;
}

export interface GeminiResponse {
  analysis: {
    matchScore: number;
    keywordAnalysis: {
      matched: string[];
      missing: string[];
      suggested: string[];
    };
    sectionFeedback: {
      [section: string]: {
        score: number;
        feedback: string;
        improvements: string[];
      };
    };
    atsCompatibility: {
      score: number;
      issues: string[];
      recommendations: string[];
    };
  };
  tailoredResume: {
    content: string;
    improvements: {
      section: string;
      changes: string[];
      rationale: string;
    }[];
  };
}

// Error interfaces
export interface ProcessingError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
  userId: string;
  operation: string;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
}

// Frontend component props
export interface ResumeUploaderProps {
  onFileUpload: (file: UploadedFile) => void;
  onError: (error: string) => void;
  maxSize?: number; // in MB
  acceptedTypes?: string[];
}

export interface JobDescriptionInputProps {
  onJobDescriptionSubmit: (jobDesc: JobDescription) => void;
  onError: (error: string) => void;
}

export interface AnalysisResultsProps {
  analysis: AnalysisResult;
  onTailorResume: () => void;
}

export interface PreviewModalProps {
  tailoredResume: TailoredResume;
  onDownload: () => void;
  onClose: () => void;
}

// Utility types
export type UploadSource = 'local' | 'url' | 'paste';
export type ProcessingStage = 'upload' | 'parse' | 'analyze' | 'tailor' | 'generate';
export type FileType = 'pdf' | 'doc' | 'docx' | 'txt';
export type ContentSection = 'summary' | 'experience' | 'education' | 'skills' | 'projects' | 'certifications';
