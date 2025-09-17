/**
 * Notification Domain Types
 * 
 * Extracted from the large notification-service.ts file.
 * Contains all type definitions used across the notification system.
 */

export interface NotificationEvent {
  id?: string;
  userId: string;
  type: NotificationType;
  channel: NotificationChannel;
  recipient: string;
  subject: string;
  content: string;
  templateUsed?: string;
  metadata?: Record<string, any>;
  status: NotificationStatus;
  createdAt: Date;
  sentAt?: Date;
  updatedAt?: Date;
  error?: string;
  messageId?: string;
  jobId?: string;
  applicationId?: string;
}

export type NotificationType = 
  | 'job_discovered'
  | 'application_submitted'
  | 'follow_up_reminder'
  | 'interview_scheduled'
  | 'application_status_update'
  | 'daily_summary'
  | 'weekly_report'
  | 'search_completed'
  | 'quota_warning'
  | 'welcome'
  | 'verification'
  | 'premium_upgrade';

export type NotificationChannel = 'email' | 'sms' | 'push' | 'in_app';

export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'bounced' | 'delivered';

export interface JobDiscoveredData {
  jobId: string;
  jobTitle: string;
  company: string;
  location: string;
  salary?: {
    min?: number;
    max?: number;
    currency: string;
    period: string;
  };
  relevancyScore: number;
  matchedSkills: string[];
  jobUrl?: string;
  portal: string;
}

export interface ApplicationSubmittedData {
  applicationId: string;
  jobId: string;
  jobTitle: string;
  company: string;
  submittedAt: Date;
  autoApplied: boolean;
  coverLetterUsed: boolean;
  resumeTailored: boolean;
  relevancyScore: number;
}

export interface FollowUpReminderData {
  applicationId: string;
  jobTitle: string;
  company: string;
  appliedDate: Date;
  followUpType: 'initial' | 'second' | 'thank_you' | 'status_check';
  suggestedMessage?: string;
}

export interface DailySummaryData {
  date: Date;
  jobsFound: number;
  applicationsSubmitted: number;
  followUpsSent: number;
  upcomingFollowUps: number;
  topJobs: JobDiscoveredData[];
}

export interface NotificationResult {
  success: boolean;
  error?: string;
  messageId?: string;
}

export interface EmailMessage {
  to: string;
  subject: string;
  content: string;
  html?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface EmailTemplateData {
  userName: string;
  [key: string]: any;
}

export type EmailTemplateType = 
  | 'job_discovered'
  | 'application_submitted'
  | 'follow_up_reminder'
  | 'daily_summary';

export interface NotificationHistoryOptions {
  limit?: number;
  type?: NotificationType;
  status?: NotificationStatus;
  startDate?: Date;
  endDate?: Date;
}

export interface NotificationStats {
  total: number;
  sent: number;
  failed: number;
  byType: Record<NotificationType, number>;
}

export interface NotificationCleanupResult {
  deleted: number;
}