/**
 * Extended Firestore Schema for Enhanced Resume Processing
 * 
 * Defines the enhanced schema for storing resume data with ATS analysis,
 * job matching scores, and processor versioning for backward compatibility.
 */

import { FieldValue, Timestamp } from 'firebase-admin/firestore';

// Base resume data structure (existing)
export interface BaseResumeData {
  personalInfo: {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    linkedin?: string;
    github?: string;
    website?: string;
    location?: string;
  };
  summary?: string;
  skills: Array<{
    skill: string;
    category?: 'technical' | 'soft' | 'language' | 'certification' | 'tool';
    proficiency?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    yearsOfExperience?: number;
  }>;
  experience: Array<{
    company: string;
    position: string;
    startDate?: string;
    endDate?: string;
    isCurrent?: boolean;
    location?: string;
    description?: string;
    achievements?: string[];
    technologies?: string[];
    managementScope?: {
      teamSize?: number;
      budget?: string;
      responsibilities?: string[];
    };
    quantifiableResults?: Array<{
      metric: string;
      value: number;
      unit: string;
      impact: string;
    }>;
  }>;
  education: Array<{
    institution: string;
    degree: string;
    field: string;
    startDate?: string;
    endDate?: string;
    gpa?: number;
    location?: string;
    honors?: string[];
    relevantCoursework?: string[];
  }>;
  projects?: Array<{
    name: string;
    description: string;
    technologies?: string[];
    url?: string;
    github?: string;
    startDate?: string;
    endDate?: string;
    role?: string;
    teamSize?: number;
    impact?: string;
  }>;
  certifications?: Array<{
    name: string;
    issuer: string;
    date?: string;
    expiryDate?: string;
    credentialId?: string;
    url?: string;
    status?: 'active' | 'expired' | 'pending';
  }>;
  languages?: Array<{
    name: string;
    proficiency: 'native' | 'fluent' | 'conversational' | 'basic';
    certifications?: string[];
  }>;
  publications?: Array<{
    title: string;
    venue: string;
    date?: string;
    url?: string;
    coAuthors?: string[];
  }>;
  awards?: Array<{
    name: string;
    issuer: string;
    date?: string;
    description?: string;
  }>;
}

// Enhanced resume document structure
export interface EnhancedResumeDocument {
  // User identification
  userId: string;
  
  // File metadata
  fileName: string;
  fileUrl: string;
  filePath?: string;
  sasUrl?: string;
  fileSize?: number;
  mimeType?: string;
  
  // Extracted resume data
  extractedData: BaseResumeData;
  
  // Interview questions
  interviewQuestions: string[];
  
  // Enhanced ATS & Job Matching fields (NEW)
  atsScore?: number;
  jobMatchScore?: number;
  missingKeywords?: string[];
  
  // Raw extraction data (encrypted at-rest)
  rawExtraction?: {
    method: 'foundry-document-intelligence' | 'azure-form-recognizer' | 'openai-extraction';
    confidence?: number;
    processingTime?: number;
    originalText?: string;
    aiResponse?: any;
    boundingBoxes?: any;
    tableStructures?: any;
  };
  
  // Processor versioning for backward compatibility (NEW)
  processorVersion: 'foundry-v1' | 'legacy-v1';
  
  // Job description context (if provided)
  jobDescription?: string;
  targetRole?: string;
  companyName?: string;
  targetIndustry?: string;
  experienceLevel?: 'entry' | 'mid' | 'senior' | 'executive';
  
  // Detailed ATS analysis (NEW)
  atsAnalysis?: {
    overallGrade: string;
    keywordAnalysis: {
      score: number;
      totalKeywords: number;
      matchedKeywords: string[];
      missingKeywords: string[];
      keywordDensity: number;
      recommendations: string[];
    };
    formatAnalysis: {
      score: number;
      issues: Array<{
        type: 'critical' | 'warning' | 'suggestion';
        issue: string;
        solution: string;
        impact: string;
      }>;
      strengths: string[];
    };
    structureAnalysis: {
      score: number;
      missingElements: string[];
      presentElements: string[];
      recommendations: string[];
    };
    contentAnalysis: {
      score: number;
      strengthAreas: string[];
      improvementAreas: string[];
      recommendations: string[];
    };
    prioritizedRecommendations: Array<{
      priority: 'high' | 'medium' | 'low';
      category: 'keywords' | 'formatting' | 'structure' | 'content';
      recommendation: string;
      implementation: string;
      expectedImpact: string;
      timeToImplement: string;
    }>;
  };
  
  // Job matching analysis (NEW)
  jobMatchAnalysis?: {
    matchGrade: string;
    skillsMatch: {
      score: number;
      matchedSkills: Array<{
        skill: string;
        resumeLevel: string;
        requiredLevel: string;
        match: 'exceeds' | 'meets' | 'below';
      }>;
      missingSkills: Array<{
        skill: string;
        importance: 'high' | 'medium' | 'low';
        canLearn: boolean;
        timeToLearn: string;
      }>;
      skillGapAnalysis: {
        criticalGaps: string[];
        niceToHaveGaps: string[];
        strengthAreas: string[];
      };
    };
    experienceMatch: {
      score: number;
      yearsRequired: number;
      yearsCandidate: number;
      yearsMatch: 'exceeds' | 'meets' | 'below';
      industryMatch: {
        score: number;
        relevantIndustries: string[];
        transferableExperience: string[];
      };
      roleSimilarity: {
        score: number;
        similarRoles: string[];
        levelMatch: string;
      };
    };
    educationMatch: {
      score: number;
      degreeMatch: boolean;
      fieldRelevance: 'high' | 'medium' | 'low';
      institutionPrestige: string;
      additionalQualifications: string[];
    };
    culturalFit: {
      score: number;
      indicators: string[];
      concerns: string[];
      strengths: string[];
    };
    recommendations: Array<{
      category: 'skills' | 'experience' | 'education' | 'presentation';
      priority: 'high' | 'medium' | 'low';
      recommendation: string;
      reasoning: string;
      resources: string[];
      timeframe: string;
    }>;
    interviewPreparation: string[];
  };
  
  // Storage provider information
  storageProvider?: 'firebase' | 'azure-blob';
  
  // Timestamps
  uploadDate: Timestamp | FieldValue;
  lastModified: Timestamp | FieldValue;
  lastAnalyzed?: Timestamp | FieldValue;
  
  // Processing metadata
  metadata?: {
    processingMethod?: string;
    processingTime?: number;
    confidence?: number;
    errorCount?: number;
    lastError?: string;
    retryCount?: number;
  };
}

// Collection paths
export const FIRESTORE_PATHS = {
  USERS: 'users',
  PROFILES: 'profiles', // Current collection path
  RESUMES: 'resumes',
  MODEL_USAGE: 'modelUsage',
  CONFIG_AUDIT: 'configAudit'
} as const;

// Migration tracking
export interface MigrationRecord {
  migrationId: string;
  version: string;
  description: string;
  executedAt: Timestamp;
  executedBy: string;
  recordsProcessed: number;
  recordsUpdated: number;
  recordsFailed: number;
  errors?: Array<{
    documentId: string;
    error: string;
    timestamp: Timestamp;
  }>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  durationMs?: number;
}

// Type guards for version checking
export function isEnhancedResumeDocument(doc: any): doc is EnhancedResumeDocument {
  return doc && 
         typeof doc.processorVersion === 'string' &&
         ['foundry-v1', 'legacy-v1'].includes(doc.processorVersion);
}

export function isFoundryProcessedResume(doc: EnhancedResumeDocument): boolean {
  return doc.processorVersion === 'foundry-v1';
}

export function isLegacyProcessedResume(doc: EnhancedResumeDocument): boolean {
  return doc.processorVersion === 'legacy-v1';
}

// Schema validation helpers
export function validateResumeDocument(doc: Partial<EnhancedResumeDocument>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  // Required fields
  if (!doc.userId) errors.push('userId is required');
  if (!doc.fileName) errors.push('fileName is required');
  if (!doc.extractedData) errors.push('extractedData is required');
  if (!doc.processorVersion) errors.push('processorVersion is required');
  
  // Processor version validation
  if (doc.processorVersion && !['foundry-v1', 'legacy-v1'].includes(doc.processorVersion)) {
    errors.push('processorVersion must be "foundry-v1" or "legacy-v1"');
  }
  
  // ATS score validation
  if (doc.atsScore !== undefined && (doc.atsScore < 0 || doc.atsScore > 100)) {
    errors.push('atsScore must be between 0 and 100');
  }
  
  // Job match score validation
  if (doc.jobMatchScore !== undefined && (doc.jobMatchScore < 0 || doc.jobMatchScore > 100)) {
    errors.push('jobMatchScore must be between 0 and 100');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// Default values for new fields
export const DEFAULT_ENHANCED_FIELDS: Partial<EnhancedResumeDocument> = {
  processorVersion: 'legacy-v1',
  missingKeywords: [],
  rawExtraction: undefined,
  atsAnalysis: undefined,
  jobMatchAnalysis: undefined
};

// Firestore security rules schema (for reference)
export const FIRESTORE_SECURITY_RULES_SCHEMA = `
// Enhanced resume document rules
match /profiles/{userId} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
  
  // Validate enhanced fields on write
  allow update: if request.auth != null && 
                   request.auth.uid == userId &&
                   validateEnhancedResumeFields(request.resource.data);
}

function validateEnhancedResumeFields(data) {
  return data.keys().hasAll(['processorVersion']) &&
         data.processorVersion in ['foundry-v1', 'legacy-v1'] &&
         (data.atsScore == null || (data.atsScore >= 0 && data.atsScore <= 100)) &&
         (data.jobMatchScore == null || (data.jobMatchScore >= 0 && data.jobMatchScore <= 100));
}
`;

export type { BaseResumeData, EnhancedResumeDocument, MigrationRecord };
