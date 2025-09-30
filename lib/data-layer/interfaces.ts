/**
 * Data Layer Abstraction - Core Interfaces
 * 
 * This file defines the contracts for the unified data access layer.
 * Follows SOLID principles with clear separation of concerns.
 */

// =============================================================================
// Core Data Store Interface
// =============================================================================

export interface IDataStore {
  initialize(): Promise<void>;
  healthCheck(): Promise<{ healthy: boolean; details: Record<string, any> }>;
  close?(): Promise<void>;
}

// =============================================================================
// Document Operations Interface
// =============================================================================

export interface IDocumentRepository<T> {
  create(data: Omit<T, 'id' | '_partitionKey'>): Promise<string>;
  get(id: string, partitionKey: string): Promise<T | null>;
  update(id: string, partitionKey: string, updates: Partial<T>): Promise<void>;
  delete(id: string, partitionKey: string): Promise<void>;
  query(querySpec: QuerySpec, partitionKey?: string): Promise<T[]>;
  batchCreate(documents: Omit<T, '_partitionKey'>[]): Promise<void>;
  batchDelete(ids: Array<{ id: string; partitionKey: string }>): Promise<void>;
}

// =============================================================================
// Query Specifications
// =============================================================================

export interface QuerySpec {
  query: string;
  parameters: Array<{ name: string; value: any }>;
  orderBy?: Array<{ field: string; direction: 'asc' | 'desc' }>;
  limit?: number;
  offset?: number;
}

// =============================================================================
// Document Models
// =============================================================================

export interface BaseDocument {
  id: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  _partitionKey?: string;
}

export interface ResumeDocument extends BaseDocument {
  fileName: string;
  fileUrl: string;
  filePath?: string;
  sasUrl?: string;
  blobName?: string;
  extractedData: {
    personalInfo: Record<string, any>;
    summary?: string;
    skills: string[];
    experience: Array<Record<string, any>>;
    education: Array<Record<string, any>>;
    projects?: Array<Record<string, any>>;
    certifications?: Array<Record<string, any>>;
    languages?: string[];
  };
  interviewQuestions: string[];
  atsScore?: number;
  jobMatchScore?: number;
  missingKeywords?: string[];
  processorVersion: 'foundry-v1' | 'legacy-v1';
  jobDescription?: string;
  metadata: {
    fileSize: number;
    uploadDate: Date;
    lastModified: Date;
    mimeType: string;
    storageProvider: 'firebase' | 'azure-blob';
    processingMethod?: string;
    processingTime?: number;
    confidence?: number;
  };
}

export interface InterviewDocument extends BaseDocument {
  jobTitle: string;
  company: string;
  jobDescription?: string;
  questions: Array<{
    question: string;
    answer?: string;
    category: string;
    difficulty: 'easy' | 'medium' | 'hard';
  }>;
  finalized: boolean;
  feedbackGenerated?: boolean;
  sessionMetadata?: {
    duration?: number;
    completionRate?: number;
    averageResponseTime?: number;
  };
}

export interface UsageDocument extends BaseDocument {
  interviews: {
    count: number;
    limit: number;
    lastReset?: Date;
  };
  resumes: {
    count: number;
    limit: number;
    lastReset?: Date;
  };
  plan: 'free' | 'premium';
  resetSchedule?: 'monthly' | 'never';
}

export interface UserConsentDocument extends BaseDocument {
  analytics: boolean;
  marketing: boolean;
  functional: boolean;
  consentDate: Date;
  ipAddress?: string;
  userAgent?: string;
  version: string; // Privacy policy version
  lastUpdated: Date;
}

export interface AuditLogDocument extends BaseDocument {
  action: string;
  featureName?: string;
  timestamp: Date;
  severity: 'info' | 'warning' | 'error' | 'critical';
  metadata?: Record<string, any>;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  result: 'success' | 'failure' | 'partial';
}

export interface NotificationEventDocument extends BaseDocument {
  type: 'email' | 'sms' | 'push' | 'webhook';
  channel: string;
  recipient: string;
  subject: string;
  content: string;
  templateUsed?: string;
  metadata?: Record<string, any>;
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced';
  sentAt?: Date;
  deliveredAt?: Date;
  error?: string;
  messageId?: string;
  retryCount?: number;
  maxRetries?: number;
}

export interface PaymentDocument extends BaseDocument {
  subscriptionId: string;
  planId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled' | 'refunded';
  paymentMethod: string;
  transactionId?: string;
  gatewayResponse?: Record<string, any>;
  billingCycle: 'monthly' | 'yearly';
  nextBillingDate?: Date;
  cancelledAt?: Date;
  refundedAt?: Date;
  refundAmount?: number;
}

// =============================================================================
// Repository Interfaces
// =============================================================================

export interface IResumeRepository extends IDocumentRepository<ResumeDocument> {
  getUserResumes(userId: string): Promise<ResumeDocument[]>;
  getUserLatestResume(userId: string): Promise<ResumeDocument | null>;
  getResumesByProcessor(processorVersion: 'foundry-v1' | 'legacy-v1'): Promise<ResumeDocument[]>;
  searchBySkills(skills: string[]): Promise<ResumeDocument[]>;
  getHighAtsScores(minScore: number): Promise<ResumeDocument[]>;
}

export interface IInterviewRepository extends IDocumentRepository<InterviewDocument> {
  getUserInterviews(userId: string): Promise<InterviewDocument[]>;
  getPublicInterviews(userId: string, limit?: number): Promise<InterviewDocument[]>;
  getInterviewsByCompany(company: string): Promise<InterviewDocument[]>;
  getFinalizedInterviews(userId: string): Promise<InterviewDocument[]>;
  searchByJobTitle(jobTitle: string): Promise<InterviewDocument[]>;
}

export interface IUsageRepository extends IDocumentRepository<UsageDocument> {
  getUserUsage(userId: string): Promise<UsageDocument | null>;
  initializeUserUsage(userId: string, plan: 'free' | 'premium'): Promise<void>;
  incrementUsage(userId: string, type: 'interviews' | 'resumes'): Promise<void>;
  checkUsageLimit(userId: string, type: 'interviews' | 'resumes'): Promise<boolean>;
  resetUsageCounters(userId: string): Promise<void>;
  getUsersNearLimit(type: 'interviews' | 'resumes', threshold: number): Promise<UsageDocument[]>;
}

export interface IUserConsentRepository extends IDocumentRepository<UserConsentDocument> {
  getUserConsent(userId: string): Promise<UserConsentDocument | null>;
  updateConsent(userId: string, consent: Partial<UserConsentDocument>): Promise<void>;
  getUsersWithConsent(consentType: 'analytics' | 'marketing' | 'functional'): Promise<UserConsentDocument[]>;
  getExpiredConsents(olderThanDays: number): Promise<UserConsentDocument[]>;
}

export interface IAuditLogRepository extends IDocumentRepository<AuditLogDocument> {
  logAction(userId: string, action: string, metadata?: Record<string, any>): Promise<void>;
  getUserAuditLogs(userId: string, limit?: number): Promise<AuditLogDocument[]>;
  getAuditLogsByAction(action: string, timeRange?: { start: Date; end: Date }): Promise<AuditLogDocument[]>;
  getAuditLogsByFeature(featureName: string, timeRange?: { start: Date; end: Date }): Promise<AuditLogDocument[]>;
  getCriticalAuditLogs(timeRange?: { start: Date; end: Date }): Promise<AuditLogDocument[]>;
}

export interface INotificationRepository extends IDocumentRepository<NotificationEventDocument> {
  getUserNotifications(userId: string, limit?: number): Promise<NotificationEventDocument[]>;
  getPendingNotifications(): Promise<NotificationEventDocument[]>;
  getFailedNotifications(maxRetries?: number): Promise<NotificationEventDocument[]>;
  updateNotificationStatus(id: string, userId: string, status: NotificationEventDocument['status'], metadata?: Record<string, any>): Promise<void>;
  scheduleNotification(userId: string, notification: Omit<NotificationEventDocument, 'id' | 'userId' | 'createdAt' | 'updatedAt' | '_partitionKey'>): Promise<string>;
  getNotificationsByType(type: NotificationEventDocument['type'], timeRange?: { start: Date; end: Date }): Promise<NotificationEventDocument[]>;
}

export interface IPaymentRepository extends IDocumentRepository<PaymentDocument> {
  getUserPayments(userId: string): Promise<PaymentDocument[]>;
  getPaymentBySubscription(subscriptionId: string): Promise<PaymentDocument[]>;
  getActiveSubscriptions(): Promise<PaymentDocument[]>;
  getFailedPayments(timeRange?: { start: Date; end: Date }): Promise<PaymentDocument[]>;
  updatePaymentStatus(id: string, userId: string, status: PaymentDocument['status'], metadata?: Record<string, any>): Promise<void>;
  getUpcomingRenewals(daysAhead: number): Promise<PaymentDocument[]>;
}

// =============================================================================
// Data Store Provider Interface
// =============================================================================

export interface IDataStoreProvider extends IDataStore {
  // Repository factory methods
  getResumeRepository(): IResumeRepository;
  getInterviewRepository(): IInterviewRepository;
  getUsageRepository(): IUsageRepository;
  getUserConsentRepository(): IUserConsentRepository;
  getAuditLogRepository(): IAuditLogRepository;
  getNotificationRepository(): INotificationRepository;
  getPaymentRepository(): IPaymentRepository;
  
  // Generic document operations
  createDocument<T>(containerName: string, document: T): Promise<string>;
  getDocument<T>(containerName: string, id: string, partitionKey: string): Promise<T | null>;
  updateDocument<T>(containerName: string, id: string, partitionKey: string, updates: Partial<T>): Promise<void>;
  deleteDocument(containerName: string, id: string, partitionKey: string): Promise<void>;
  queryDocuments<T>(containerName: string, querySpec: QuerySpec, partitionKey?: string): Promise<T[]>;
  
  // GDPR operations
  deleteAllUserData(userId: string): Promise<string[]>;
}

// =============================================================================
// Configuration Interfaces
// =============================================================================

export interface DataStoreConfig {
  provider: 'cosmos' | 'firestore' | 'hybrid';
  connectionString?: string;
  databaseName?: string;
  enableDualWrite?: boolean;
  enableFallback?: boolean;
  retryOptions?: {
    maxRetries: number;
    backoffMultiplier: number;
    maxBackoffMs: number;
  };
  performance?: {
    enableCaching: boolean;
    cacheTimeoutMs: number;
    batchSize: number;
  };
}

// =============================================================================
// Error Types
// =============================================================================

export class DataStoreError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, any>,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'DataStoreError';
  }
}

export class DocumentNotFoundError extends DataStoreError {
  constructor(id: string, containerName: string) {
    super(`Document not found: ${id} in ${containerName}`, 'DOCUMENT_NOT_FOUND');
  }
}

export class ConflictError extends DataStoreError {
  constructor(id: string, containerName: string) {
    super(`Document already exists: ${id} in ${containerName}`, 'CONFLICT');
  }
}

export class QuotaExceededError extends DataStoreError {
  constructor(userId: string, quotaType: string) {
    super(`Quota exceeded for user ${userId}: ${quotaType}`, 'QUOTA_EXCEEDED');
  }
}

export class ValidationError extends DataStoreError {
  constructor(message: string, validationErrors: string[]) {
    super(message, 'VALIDATION_ERROR', { validationErrors });
  }
}

// =============================================================================
// Utility Types
// =============================================================================

export type DocumentType = 'resume' | 'interview' | 'usage' | 'consent' | 'audit' | 'notification' | 'payment';

export interface MigrationInfo {
  sourceProvider: 'firestore' | 'cosmos';
  targetProvider: 'firestore' | 'cosmos';
  migrationDate: Date;
  batchSize: number;
  totalDocuments: number;
  migratedDocuments: number;
  failedDocuments: number;
  errors: Array<{
    documentId: string;
    error: string;
    timestamp: Date;
  }>;
}

export interface DualWriteMetadata {
  primaryWrite: boolean;
  secondaryWrite: boolean;
  primaryProvider: 'cosmos' | 'firestore';
  secondaryProvider: 'cosmos' | 'firestore';
  syncTimestamp: Date;
  conflicts?: Array<{
    field: string;
    primaryValue: any;
    secondaryValue: any;
  }>;
}

// =============================================================================
// Feature Flags Interface
// =============================================================================

export interface DataLayerFeatureFlags {
  azureDataLayer: boolean;
  enableDualWrite: boolean;
  enableFallback: boolean;
  migrateResumes: boolean;
  migrateInterviews: boolean;
  migrateUsage: boolean;
  migrateConsents: boolean;
  migrateAuditLogs: boolean;
  migrateNotifications: boolean;
  migratePayments: boolean;
}