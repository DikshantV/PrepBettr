// lib/services/job-notification-integration.ts

import { notificationService, JobDiscoveredData, ApplicationSubmittedData, FollowUpReminderData, DailySummaryData } from './notification-service';
import { getAdminFirestore } from '@/lib/firebase/admin';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  skills?: string[];
  experience?: Array<{
    position: string;
    company: string;
    technologies?: string[];
  }>;
  targetRoles?: string[];
  summary?: string;
  emailVerified?: boolean;
  notificationPreferences?: {
    jobDiscovered: boolean;
    applicationSubmitted: boolean;
    followUpReminder: boolean;
    dailySummary: boolean;
    weeklyReport: boolean;
    emailFrequency: 'immediate' | 'hourly' | 'daily';
  };
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
    period: string;
  };
  jobType: string;
  workArrangement: string;
  description: string;
  requirements?: string[];
  responsibilities?: string[];
  postedDate: string;
  jobPortal: {
    name: string;
    logo: string;
    website: string;
    supportsAutoApply: boolean;
  };
  originalUrl?: string;
  applicationStatus: string;
  relevancyScore?: number;
  matchedSkills?: string[];
  missingSkills?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Application {
  id: string;
  userId: string;
  jobId: string;
  status: 'applied' | 'in_progress' | 'interview' | 'rejected' | 'accepted';
  appliedAt: Date;
  coverLetter?: string;
  tailoredResume?: string;
  relevancyScore?: number;
  portal?: string;
  jobTitle: string;
  company: string;
  autoApplied?: boolean;
  coverLetterUsed?: boolean;
  resumeTailored?: boolean;
}

export class JobNotificationIntegration {
  private db: Awaited<ReturnType<typeof getAdminFirestore>> | null = null;
  
  private async getDB() {
    if (!this.db) {
      this.db = await getAdminFirestore();
    }
    return this.db;
  }

  /**
   * Send job discovered notification
   * Called from jobSearchWorker when new relevant jobs are found
   */
  async notifyJobsDiscovered(
    userId: string,
    jobs: JobListing[]
  ): Promise<void> {
    try {
      // Get user profile and preferences
      const userProfile = await this.getUserProfile(userId);
      if (!userProfile || !userProfile.emailVerified) {
        console.log(`Skipping job discovered notifications for user ${userId}: email not verified`);
        return;
      }

      // Check notification preferences
      if (!userProfile.notificationPreferences?.jobDiscovered) {
        console.log(`Skipping job discovered notifications for user ${userId}: disabled in preferences`);
        return;
      }

      // Process notifications based on email frequency preference
      const emailFrequency = userProfile.notificationPreferences?.emailFrequency || 'immediate';
      
      if (emailFrequency === 'immediate') {
        // Send individual notifications for high-scoring jobs
        const highScoringJobs = jobs.filter(job => (job.relevancyScore || 0) >= 80);
        
        for (const job of highScoringJobs.slice(0, 3)) { // Limit to top 3 to avoid spam
          await this.sendJobDiscoveredNotification(userProfile, job);
        }
      } else {
        // Store jobs for batched processing
        await this.storePendingJobNotifications(userId, jobs);
      }

      console.log(`Processed job discovered notifications for user ${userId}: ${jobs.length} jobs`);

    } catch (error) {
      console.error('Error in notifyJobsDiscovered:', error);
    }
  }

  /**
   * Send application submitted notification
   * Called from applicationWorker when application is successfully submitted
   */
  async notifyApplicationSubmitted(
    userId: string,
    application: Application
  ): Promise<void> {
    try {
      // Get user profile and preferences
      const userProfile = await this.getUserProfile(userId);
      if (!userProfile || !userProfile.emailVerified) {
        console.log(`Skipping application submitted notification for user ${userId}: email not verified`);
        return;
      }

      // Check notification preferences
      if (!userProfile.notificationPreferences?.applicationSubmitted) {
        console.log(`Skipping application submitted notification for user ${userId}: disabled in preferences`);
        return;
      }

      const applicationData: ApplicationSubmittedData = {
        applicationId: application.id,
        jobId: application.jobId,
        jobTitle: application.jobTitle,
        company: application.company,
        submittedAt: application.appliedAt,
        autoApplied: application.autoApplied || false,
        coverLetterUsed: application.coverLetterUsed || false,
        resumeTailored: application.resumeTailored || false,
        relevancyScore: application.relevancyScore || 0
      };

      await notificationService.notifyApplicationSubmitted(
        userId,
        userProfile.email,
        userProfile.name,
        applicationData
      );

      console.log(`Sent application submitted notification for user ${userId}, job ${application.jobId}`);

    } catch (error) {
      console.error('Error in notifyApplicationSubmitted:', error);
    }
  }

  /**
   * Send follow-up reminder notification
   * Called from followUpWorker when it's time for a follow-up
   */
  async notifyFollowUpReminder(
    userId: string,
    application: Application,
    followUpType: 'initial' | 'second' | 'thank_you' | 'status_check',
    suggestedMessage?: string
  ): Promise<void> {
    try {
      // Get user profile and preferences
      const userProfile = await this.getUserProfile(userId);
      if (!userProfile || !userProfile.emailVerified) {
        console.log(`Skipping follow-up reminder for user ${userId}: email not verified`);
        return;
      }

      // Check notification preferences
      if (!userProfile.notificationPreferences?.followUpReminder) {
        console.log(`Skipping follow-up reminder for user ${userId}: disabled in preferences`);
        return;
      }

      const followUpData: FollowUpReminderData = {
        applicationId: application.id,
        jobTitle: application.jobTitle,
        company: application.company,
        appliedDate: application.appliedAt,
        followUpType,
        suggestedMessage
      };

      await notificationService.notifyFollowUpReminder(
        userId,
        userProfile.email,
        userProfile.name,
        followUpData
      );

      console.log(`Sent follow-up reminder for user ${userId}, application ${application.id}, type ${followUpType}`);

    } catch (error) {
      console.error('Error in notifyFollowUpReminder:', error);
    }
  }

  /**
   * Send daily summary notification
   * Called by a scheduled job to send daily activity summaries
   */
  async sendDailySummaries(): Promise<void> {
    try {
      // Get all users with daily summary enabled
      const db = await this.getDB();
      const usersSnapshot = await db
        .collection('users')
        .where('emailVerified', '==', true)
        .where('notificationPreferences.dailySummary', '==', true)
        .get();

      console.log(`Processing daily summaries for ${usersSnapshot.docs.length} users`);

      for (const userDoc of usersSnapshot.docs) {
        try {
          const userId = (userDoc as any).id;
          const userData = (userDoc as any).data() as UserProfile;

          const summaryData = await this.generateDailySummary(userId);
          
          // Only send if there's activity to report
          if (summaryData.jobsFound > 0 || summaryData.applicationsSubmitted > 0 || summaryData.followUpsSent > 0 || summaryData.upcomingFollowUps > 0) {
            await notificationService.notifyDailySummary(
              userId,
              userData.email,
              userData.name,
              summaryData
            );

            console.log(`Sent daily summary to user ${userId}`);
          }
        } catch (userError) {
          console.error(`Error sending daily summary for user ${(userDoc as any).id}:`, userError);
        }
      }

    } catch (error) {
      console.error('Error in sendDailySummaries:', error);
    }
  }

  /**
   * Process batched notifications for users with hourly/daily frequency preferences
   */
  async processBatchedNotifications(): Promise<void> {
    try {
      // Get users with pending job notifications
      const db = await this.getDB();
      const pendingSnapshot = await db
        .collection('pending_job_notifications')
        .where('processed', '==', false)
        .get();

      const batchedByUser: Record<string, JobListing[]> = {};

      // Group by user
      pendingSnapshot.docs.forEach((doc: any) => {
        const data = doc.data() as any;
        const userId = data.userId;
        
        if (!batchedByUser[userId]) {
          batchedByUser[userId] = [];
        }
        
        batchedByUser[userId].push(...data.jobs);
      });

      // Process each user's batched notifications
      for (const [userId, jobs] of Object.entries(batchedByUser)) {
        try {
          const userProfile = await this.getUserProfile(userId);
          if (!userProfile) continue;

          const emailFrequency = userProfile.notificationPreferences?.emailFrequency || 'immediate';
          const now = new Date();
          const lastSent = await this.getLastBatchNotificationTime(userId);

          let shouldSend = false;

          if (emailFrequency === 'hourly' && (!lastSent || now.getTime() - lastSent.getTime() >= 60 * 60 * 1000)) {
            shouldSend = true;
          } else if (emailFrequency === 'daily' && (!lastSent || now.getTime() - lastSent.getTime() >= 24 * 60 * 60 * 1000)) {
            shouldSend = true;
          }

          if (shouldSend && jobs.length > 0) {
            // Send batch notification with top jobs
            const topJobs = jobs
              .sort((a, b) => (b.relevancyScore || 0) - (a.relevancyScore || 0))
              .slice(0, 5);

            for (const job of topJobs.slice(0, 3)) { // Send individual notifications for top 3
              await this.sendJobDiscoveredNotification(userProfile, job);
            }

            // Mark as processed and update last sent time
            await this.markBatchNotificationsProcessed(userId);
            await this.updateLastBatchNotificationTime(userId, now);

            console.log(`Sent batched notifications to user ${userId}: ${topJobs.length} jobs`);
          }
        } catch (userError) {
          console.error(`Error processing batched notifications for user ${userId}:`, userError);
        }
      }

    } catch (error) {
      console.error('Error in processBatchedNotifications:', error);
    }
  }

  /**
   * Send individual job discovered notification
   */
  private async sendJobDiscoveredNotification(
    userProfile: UserProfile,
    job: JobListing
  ): Promise<void> {
    const jobData: JobDiscoveredData = {
      jobId: job.id,
      jobTitle: job.title,
      company: job.company,
      location: job.location,
      salary: job.salary,
      relevancyScore: job.relevancyScore || 0,
      matchedSkills: job.matchedSkills || [],
      jobUrl: job.originalUrl,
      portal: job.jobPortal.name
    };

    await notificationService.notifyJobDiscovered(
      userProfile.id,
      userProfile.email,
      userProfile.name,
      jobData
    );
  }

  /**
   * Get user profile with notification preferences
   */
  private async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const db = await this.getDB();
      const userDoc = await db.collection('users').doc(userId).get();
      
      if (!userDoc.exists) {
        return null;
      }

      const userData = userDoc.data() as any;
      
      // Set default notification preferences if not exist
      const defaultNotificationPreferences = {
        jobDiscovered: true,
        applicationSubmitted: true,
        followUpReminder: true,
        dailySummary: true,
        weeklyReport: false,
        emailFrequency: 'immediate' as const
      };

      return {
        id: userId,
        name: userData?.name || 'User',
        email: userData?.email || '',
        skills: userData?.skills || [],
        experience: userData?.experience || [],
        targetRoles: userData?.targetRoles || [],
        summary: userData?.summary || '',
        emailVerified: userData?.emailVerified || false,
        notificationPreferences: {
          ...defaultNotificationPreferences,
          ...userData?.notificationPreferences
        }
      };

    } catch (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
  }

  /**
   * Generate daily summary data for a user
   */
  private async generateDailySummary(userId: string): Promise<DailySummaryData> {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    try {
      const db = await this.getDB();
      // Get today's discovered jobs
      const jobsSnapshot = await db
        .collection('discovered_jobs')
        .where('userId', '==', userId)
        .where('createdAt', '>=', startOfDay)
        .where('createdAt', '<', endOfDay)
        .orderBy('relevancyScore', 'desc')
        .limit(10)
        .get();

      // Get today's applications
      const applicationsSnapshot = await db
        .collection('applications')
        .where('userId', '==', userId)
        .where('appliedAt', '>=', startOfDay)
        .where('appliedAt', '<', endOfDay)
        .get();

      // Get today's follow-ups sent (from notification events)
      const followUpsSnapshot = await db
        .collection('notification_events')
        .where('userId', '==', userId)
        .where('type', '==', 'follow_up_reminder')
        .where('status', '==', 'sent')
        .where('createdAt', '>=', startOfDay)
        .where('createdAt', '<', endOfDay)
        .get();

      // Get upcoming follow-ups (next 7 days)
      const upcomingDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      const upcomingFollowUpsSnapshot = await db
        .collection('follow_up_reminders')
        .where('userId', '==', userId)
        .where('scheduledDate', '>=', today)
        .where('scheduledDate', '<', upcomingDate)
        .where('processed', '==', false)
        .get();

      // Convert discovered jobs to JobDiscoveredData format
      const topJobs: JobDiscoveredData[] = jobsSnapshot.docs.map((doc: any) => {
        const data = doc.data() as any;
        return {
          jobId: doc.id,
          jobTitle: data.title || '',
          company: data.company || '',
          location: data.location || '',
          salary: data.salary,
          relevancyScore: data.relevancyScore || 0,
          matchedSkills: data.matchedSkills || [],
          jobUrl: data.originalUrl,
          portal: data.jobPortal?.name || 'Unknown'
        };
      });

      return {
        date: today,
        jobsFound: jobsSnapshot.docs.length,
        applicationsSubmitted: applicationsSnapshot.docs.length,
        followUpsSent: followUpsSnapshot.docs.length,
        upcomingFollowUps: upcomingFollowUpsSnapshot.docs.length,
        topJobs
      };

    } catch (error) {
      console.error('Error generating daily summary:', error);
      return {
        date: today,
        jobsFound: 0,
        applicationsSubmitted: 0,
        followUpsSent: 0,
        upcomingFollowUps: 0,
        topJobs: []
      };
    }
  }

  /**
   * Store pending job notifications for batched processing
   */
  private async storePendingJobNotifications(userId: string, jobs: JobListing[]): Promise<void> {
    try {
      const db = await this.getDB();
      await db.collection('pending_job_notifications').add({
        userId,
        jobs,
        createdAt: new Date(),
        processed: false
      });
    } catch (error) {
      console.error('Error storing pending job notifications:', error);
    }
  }

  /**
   * Get last batch notification time for a user
   */
  private async getLastBatchNotificationTime(userId: string): Promise<Date | null> {
    try {
      const db = await this.getDB();
      const doc = await db.collection('batch_notification_tracking').doc(userId).get();
      
      if (doc.exists) {
        const data = doc.data() as any;
        return data?.lastSentAt?.toDate() || null;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting last batch notification time:', error);
      return null;
    }
  }

  /**
   * Update last batch notification time for a user
   */
  private async updateLastBatchNotificationTime(userId: string, time: Date): Promise<void> {
    try {
      const db = await this.getDB();
      await db.collection('batch_notification_tracking').doc(userId).set({
        lastSentAt: time,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error updating last batch notification time:', error);
    }
  }

  /**
   * Mark batched notifications as processed
   */
  private async markBatchNotificationsProcessed(userId: string): Promise<void> {
    try {
      const db = await this.getDB();
      const snapshot = await db
        .collection('pending_job_notifications')
        .where('userId', '==', userId)
        .where('processed', '==', false)
        .get();

      const batch = db.batch();
      snapshot.docs.forEach((doc: any) => {
        batch.update(doc.ref, { processed: true, processedAt: new Date() });
      });

      await batch.commit();
    } catch (error) {
      console.error('Error marking batch notifications as processed:', error);
    }
  }
}

// Export singleton instance
export const jobNotificationIntegration = new JobNotificationIntegration();
