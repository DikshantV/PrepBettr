/**
 * Repository interface definitions for the data layer
 * These interfaces define the contract for repository implementations
 */

import { RepositoryResult } from './RepositoryResult';

// Base repository interface with common operations
export interface IBaseRepository<T> {
  findById(id: string): Promise<RepositoryResult<T>>;
  create(item: T): Promise<RepositoryResult<T>>;
  update(id: string, item: Partial<T>): Promise<RepositoryResult<T>>;
  delete(id: string): Promise<RepositoryResult<boolean>>;
  batchCreate?(items: T[]): Promise<RepositoryResult<T[]>>;
  batchUpdate?(updates: { id: string; item: Partial<T> }[]): Promise<RepositoryResult<T[]>>;
  batchDelete?(ids: string[]): Promise<RepositoryResult<boolean>>;
}

// Resume repository interface
export interface IResumeRepository<T> extends IBaseRepository<T> {
  findByUserId(userId: string): Promise<RepositoryResult<T[]>>;
  findByFileName(fileName: string, userId: string): Promise<RepositoryResult<T>>;
  findBySkills(skills: string[], userId?: string): Promise<RepositoryResult<T[]>>;
  findRecentByUserId(userId: string, limit?: number): Promise<RepositoryResult<T[]>>;
  updateATSScore(id: string, score: number): Promise<RepositoryResult<T>>;
  updateProcessingStatus(id: string, status: boolean, analysis?: any): Promise<RepositoryResult<T>>;
  searchByContent(query: string, userId?: string): Promise<RepositoryResult<T[]>>;
  getAnalytics(userId: string): Promise<RepositoryResult<{
    totalResumes: number;
    avgATSScore: number;
    topSkills: string[];
    recentUploads: number;
  }>>;
}

// Usage repository interface
export interface IUsageRepository<T> extends IBaseRepository<T> {
  findByUserId(userId: string): Promise<RepositoryResult<T[]>>;
  findByUserIdAndFeature(userId: string, feature: string): Promise<RepositoryResult<T>>;
  findByFeature(feature: string): Promise<RepositoryResult<T[]>>;
  incrementUsage(userId: string, feature: string, amount?: number): Promise<RepositoryResult<T>>;
  decrementUsage(userId: string, feature: string, amount?: number): Promise<RepositoryResult<T>>;
  resetUsage(userId: string, feature?: string): Promise<RepositoryResult<boolean>>;
  getTotalUsage(userId: string): Promise<RepositoryResult<{
    totalUsage: number;
    usageByFeature: { [feature: string]: number };
    lastUsageDate: string;
  }>>;
  getUsageHistory(userId: string, fromDate?: string, toDate?: string): Promise<RepositoryResult<T[]>>;
  getBulkUsage(userIds: string[]): Promise<RepositoryResult<{ [userId: string]: T[] }>>;
}

// Interview repository interface
export interface IInterviewRepository<T> extends IBaseRepository<T> {
  findByUserId(userId: string): Promise<RepositoryResult<T[]>>;
  findBySessionId(sessionId: string): Promise<RepositoryResult<T>>;
  findByStatus(status: string, userId?: string): Promise<RepositoryResult<T[]>>;
  findActiveInterviews(userId: string): Promise<RepositoryResult<T[]>>;
  updateStatus(id: string, status: string): Promise<RepositoryResult<T>>;
  addResponse(id: string, response: any): Promise<RepositoryResult<T>>;
  completeInterview(id: string, score?: number, feedback?: string): Promise<RepositoryResult<T>>;
  getInterviewStats(userId: string): Promise<RepositoryResult<{
    totalInterviews: number;
    completedInterviews: number;
    averageScore: number;
    averageDuration: number;
  }>>;
}

// Job application repository interface
export interface IJobApplicationRepository<T> extends IBaseRepository<T> {
  findByUserId(userId: string): Promise<RepositoryResult<T[]>>;
  findByStatus(status: string, userId: string): Promise<RepositoryResult<T[]>>;
  findByCompany(companyName: string, userId: string): Promise<RepositoryResult<T[]>>;
  findByDateRange(userId: string, fromDate: string, toDate: string): Promise<RepositoryResult<T[]>>;
  updateStatus(id: string, status: string, notes?: string): Promise<RepositoryResult<T>>;
  searchApplications(userId: string, query: string): Promise<RepositoryResult<T[]>>;
  getApplicationStats(userId: string): Promise<RepositoryResult<{
    totalApplications: number;
    applicationsByStatus: { [status: string]: number };
    recentApplications: number;
    topCompanies: string[];
  }>>;
}

// User profile repository interface
export interface IUserProfileRepository<T> extends IBaseRepository<T> {
  findByUserId(userId: string): Promise<RepositoryResult<T>>;
  findByEmail(email: string): Promise<RepositoryResult<T>>;
  updateProfile(userId: string, profile: Partial<T>): Promise<RepositoryResult<T>>;
  updateSubscription(userId: string, subscription: any): Promise<RepositoryResult<T>>;
  updatePreferences(userId: string, preferences: any): Promise<RepositoryResult<T>>;
  searchUsers(query: string): Promise<RepositoryResult<T[]>>;
  getUsersBySubscription(subscriptionType: string): Promise<RepositoryResult<T[]>>;
}

// Migration repository interface
export interface IMigrationRepository<T> extends IBaseRepository<T> {
  findByMigrationId(migrationId: string): Promise<RepositoryResult<T>>;
  findByStatus(status: string): Promise<RepositoryResult<T[]>>;
  findByType(type: string): Promise<RepositoryResult<T[]>>;
  findActive(): Promise<RepositoryResult<T[]>>;
  updateProgress(id: string, progress: {
    processedDocuments: number;
    failedDocuments: number;
    errors?: string[];
  }): Promise<RepositoryResult<T>>;
  completeMigration(id: string, success: boolean): Promise<RepositoryResult<T>>;
  cancelMigration(id: string): Promise<RepositoryResult<T>>;
}

// Audit log repository interface
export interface IAuditLogRepository<T> extends IBaseRepository<T> {
  findByUserId(userId: string): Promise<RepositoryResult<T[]>>;
  findByAction(action: string): Promise<RepositoryResult<T[]>>;
  findByResourceType(resourceType: string): Promise<RepositoryResult<T[]>>;
  findByResourceId(resourceId: string): Promise<RepositoryResult<T[]>>;
  findByDateRange(fromDate: string, toDate: string): Promise<RepositoryResult<T[]>>;
  findBySource(source: string): Promise<RepositoryResult<T[]>>;
  logAction(userId: string, action: string, resourceType: string, resourceId: string, 
           changes?: any, metadata?: any): Promise<RepositoryResult<T>>;
  cleanupOldLogs(olderThanDays: number): Promise<RepositoryResult<boolean>>;
}

// Configuration repository interface
export interface IConfigRepository<T> extends IBaseRepository<T> {
  findByKey(key: string): Promise<RepositoryResult<T>>;
  findByEnvironment(environment: string): Promise<RepositoryResult<T[]>>;
  findByTags(tags: string[]): Promise<RepositoryResult<T[]>>;
  setConfig(key: string, value: any, type: string, options?: {
    environment?: string;
    description?: string;
    tags?: string[];
    isEncrypted?: boolean;
  }): Promise<RepositoryResult<T>>;
  getConfigValue<V>(key: string, defaultValue?: V): Promise<RepositoryResult<V>>;
  deleteConfig(key: string): Promise<RepositoryResult<boolean>>;
  getAllConfigs(environment?: string): Promise<RepositoryResult<T[]>>;
}

// Generic query interface
export interface IQueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  filters?: {
    field: string;
    operator: '==' | '!=' | '>' | '>=' | '<' | '<=' | 'in' | 'not-in' | 'array-contains';
    value: any;
  }[];
}

// Extended repository interface with query support
export interface IQueryableRepository<T> extends IBaseRepository<T> {
  query(options: IQueryOptions): Promise<RepositoryResult<T[]>>;
  count(filters?: IQueryOptions['filters']): Promise<RepositoryResult<number>>;
}

// Batch operation interface
export interface IBatchOperation<T> {
  operations: {
    type: 'create' | 'update' | 'delete';
    id?: string;
    data?: T | Partial<T>;
  }[];
  transactional?: boolean;
}

// Batch repository interface
export interface IBatchRepository<T> extends IBaseRepository<T> {
  executeBatch(operations: IBatchOperation<T>): Promise<RepositoryResult<{
    successful: number;
    failed: number;
    errors: string[];
  }>>;
}

// Health check interface
export interface IRepositoryHealth {
  isHealthy: boolean;
  latency?: number;
  error?: string;
  timestamp: string;
  details?: {
    connectionStatus: string;
    lastOperation?: string;
    operationCount?: number;
  };
}

// Repository with health check capability
export interface IHealthCheckable {
  checkHealth(): Promise<IRepositoryHealth>;
}

// Full-featured repository interface combining all capabilities
export interface IFullRepository<T> 
  extends IQueryableRepository<T>, 
          IBatchRepository<T>, 
          IHealthCheckable {
}

// Type definitions for common repository operations
export type CreateOperation<T> = {
  type: 'create';
  data: T;
};

export type UpdateOperation<T> = {
  type: 'update';
  id: string;
  data: Partial<T>;
};

export type DeleteOperation = {
  type: 'delete';
  id: string;
};

export type RepositoryOperation<T> = CreateOperation<T> | UpdateOperation<T> | DeleteOperation;