/**
 * Document interface definitions for the data layer
 * These interfaces define the structure of documents across Firestore and Cosmos DB
 */

// Base document interface with common fields
export interface IBaseDocument {
  id: string;
  createdDate: string;
  updatedDate: string;
}

// Resume document interface
export interface IResumeDocument extends IBaseDocument {
  userId: string;
  fileName: string;
  uploadDate: string;
  fileSize?: number;
  fileType?: string;
  fileUrl?: string;
  extractedText?: string;
  skills?: string[];
  experience?: string[];
  education?: string[];
  atsScore?: number;
  atsAnalysis?: {
    score: number;
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
    keywordMatches: string[];
    missingKeywords: string[];
  };
  processedByFoundry?: boolean;
  foundryAnalysis?: {
    extractedData: any;
    structuredData: any;
    qualityScore: number;
    errors?: string[];
  };
  metadata?: {
    [key: string]: any;
  };
}

// Usage tracking document interface
export interface IUsageDocument extends IBaseDocument {
  userId: string;
  feature: string;
  count: number;
  date: string;
  metadata?: {
    [key: string]: any;
  };
}

// Interview session document interface
export interface IInterviewDocument extends IBaseDocument {
  userId: string;
  resumeId?: string;
  sessionId: string;
  type: 'community' | 'voice' | 'text';
  status: 'active' | 'completed' | 'cancelled';
  startTime: string;
  endTime?: string;
  duration?: number;
  questions: IInterviewQuestion[];
  responses: IInterviewResponse[];
  score?: number;
  feedback?: string;
  metadata?: {
    [key: string]: any;
  };
}

// Interview question interface
export interface IInterviewQuestion {
  id: string;
  question: string;
  type: 'technical' | 'behavioral' | 'situational' | 'general';
  difficulty?: 'easy' | 'medium' | 'hard';
  expectedAnswerPoints?: string[];
  timeLimit?: number;
  order: number;
}

// Interview response interface
export interface IInterviewResponse {
  questionId: string;
  response: string;
  responseTime?: number;
  score?: number;
  feedback?: string;
  timestamp: string;
}

// Job application document interface
export interface IJobApplicationDocument extends IBaseDocument {
  userId: string;
  jobTitle: string;
  companyName: string;
  jobDescription?: string;
  applicationDate: string;
  status: 'applied' | 'interview' | 'offer' | 'rejected' | 'withdrawn';
  applicationUrl?: string;
  resumeId?: string;
  coverLetterId?: string;
  notes?: string;
  followUpDate?: string;
  interviewDate?: string;
  metadata?: {
    [key: string]: any;
  };
}

// User profile document interface
export interface IUserProfileDocument extends IBaseDocument {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profilePicture?: string;
  phone?: string;
  location?: string;
  linkedInUrl?: string;
  portfolioUrl?: string;
  targetRoles?: string[];
  preferredLocation?: string;
  experienceLevel?: 'entry' | 'mid' | 'senior' | 'executive';
  skills?: string[];
  industries?: string[];
  subscription?: {
    type: 'free' | 'premium';
    startDate?: string;
    endDate?: string;
    features?: string[];
  };
  preferences?: {
    notifications: boolean;
    emailUpdates: boolean;
    theme?: 'light' | 'dark';
    language?: string;
  };
  metadata?: {
    [key: string]: any;
  };
}

// Migration tracking document interface
export interface IMigrationDocument extends IBaseDocument {
  migrationId: string;
  type: 'firestore-to-cosmos' | 'cosmos-to-firestore' | 'sync';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: string;
  endTime?: string;
  collections: string[];
  totalDocuments: number;
  processedDocuments: number;
  failedDocuments: number;
  errors: string[];
  configuration: {
    batchSize: number;
    parallelism: number;
    retryAttempts: number;
    sourceEndpoint?: string;
    targetEndpoint?: string;
  };
  metadata?: {
    [key: string]: any;
  };
}

// Audit log document interface
export interface IAuditLogDocument extends IBaseDocument {
  userId?: string;
  action: string;
  resourceType: string;
  resourceId: string;
  changes?: {
    before?: any;
    after?: any;
  };
  timestamp: string;
  source: 'firestore' | 'cosmos' | 'api' | 'migration';
  userAgent?: string;
  ipAddress?: string;
  metadata?: {
    [key: string]: any;
  };
}

// Configuration document interface
export interface IConfigDocument extends IBaseDocument {
  key: string;
  value: any;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  environment?: 'development' | 'staging' | 'production';
  description?: string;
  lastModifiedBy?: string;
  isEncrypted?: boolean;
  tags?: string[];
  metadata?: {
    [key: string]: any;
  };
}

// Union type for all document types
export type AllDocumentTypes = 
  | IResumeDocument 
  | IUsageDocument 
  | IInterviewDocument 
  | IJobApplicationDocument 
  | IUserProfileDocument 
  | IMigrationDocument 
  | IAuditLogDocument 
  | IConfigDocument;

// Type guards for document types
export function isResumeDocument(doc: any): doc is IResumeDocument {
  return doc && typeof doc.userId === 'string' && typeof doc.fileName === 'string';
}

export function isUsageDocument(doc: any): doc is IUsageDocument {
  return doc && typeof doc.userId === 'string' && typeof doc.feature === 'string';
}

export function isInterviewDocument(doc: any): doc is IInterviewDocument {
  return doc && typeof doc.userId === 'string' && typeof doc.sessionId === 'string';
}

export function isJobApplicationDocument(doc: any): doc is IJobApplicationDocument {
  return doc && typeof doc.userId === 'string' && typeof doc.jobTitle === 'string';
}

export function isUserProfileDocument(doc: any): doc is IUserProfileDocument {
  return doc && typeof doc.userId === 'string' && typeof doc.email === 'string';
}

export function isMigrationDocument(doc: any): doc is IMigrationDocument {
  return doc && typeof doc.migrationId === 'string' && typeof doc.type === 'string';
}

export function isAuditLogDocument(doc: any): doc is IAuditLogDocument {
  return doc && typeof doc.action === 'string' && typeof doc.resourceType === 'string';
}

export function isConfigDocument(doc: any): doc is IConfigDocument {
  return doc && typeof doc.key === 'string' && doc.value !== undefined;
}