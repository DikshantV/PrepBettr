// app/api/notifications/test/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { notificationService } from '@/lib/services/notification-service';
import { jobNotificationIntegration } from '@/lib/services/job-notification-integration';
import { awsSESService } from '@/lib/services/aws-ses-service';

export async function POST(request: NextRequest) {
  try {
    const { type, userId, email, userName } = await request.json();

    if (!type) {
      return NextResponse.json(
        { error: 'Notification type is required' },
        { status: 400 }
      );
    }

    if (!userId || !email || !userName) {
      return NextResponse.json(
        { error: 'userId, email, and userName are required' },
        { status: 400 }
      );
    }

    let result;

    switch (type) {
      case 'job_discovered':
        result = await testJobDiscoveredNotification(userId, email, userName);
        break;
        
      case 'application_submitted':
        result = await testApplicationSubmittedNotification(userId, email, userName);
        break;
        
      case 'follow_up_reminder':
        result = await testFollowUpReminderNotification(userId, email, userName);
        break;
        
      case 'daily_summary':
        result = await testDailySummaryNotification(userId, email, userName);
        break;
        
      case 'ses_connection':
        result = await testSESConnection();
        break;
        
      default:
        return NextResponse.json(
          { error: `Unknown notification type: ${type}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      message: `Test ${type} notification completed`,
      result
    });

  } catch (error) {
    console.error('Error testing notification:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to test notification' },
      { status: 500 }
    );
  }
}

/**
 * Test job discovered notification
 */
async function testJobDiscoveredNotification(userId: string, email: string, userName: string) {
  const testJobData = {
    jobId: 'test-job-001',
    jobTitle: 'Senior Full Stack Developer',
    company: 'TechInnovate Inc.',
    location: 'San Francisco, CA (Remote)',
    salary: {
      min: 120000,
      max: 160000,
      currency: 'USD',
      period: 'yearly'
    },
    relevancyScore: 92,
    matchedSkills: ['React', 'TypeScript', 'Node.js', 'AWS', 'GraphQL'],
    jobUrl: 'https://example.com/job/test-001',
    portal: 'LinkedIn'
  };

  return await notificationService.notifyJobDiscovered(
    userId,
    email,
    userName,
    testJobData
  );
}

/**
 * Test application submitted notification
 */
async function testApplicationSubmittedNotification(userId: string, email: string, userName: string) {
  const testApplicationData = {
    applicationId: 'test-app-001',
    jobId: 'test-job-001',
    jobTitle: 'Senior Full Stack Developer',
    company: 'TechInnovate Inc.',
    submittedAt: new Date(),
    autoApplied: true,
    coverLetterUsed: true,
    resumeTailored: true,
    relevancyScore: 92
  };

  return await notificationService.notifyApplicationSubmitted(
    userId,
    email,
    userName,
    testApplicationData
  );
}

/**
 * Test follow-up reminder notification
 */
async function testFollowUpReminderNotification(userId: string, email: string, userName: string) {
  const testFollowUpData = {
    applicationId: 'test-app-001',
    jobTitle: 'Senior Full Stack Developer',
    company: 'TechInnovate Inc.',
    appliedDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    followUpType: 'initial' as const,
    suggestedMessage: `Subject: Following up on Senior Full Stack Developer application

Dear Hiring Manager,

I hope this email finds you well. I wanted to follow up on my application for the Senior Full Stack Developer position at TechInnovate Inc., which I submitted 3 days ago.

I remain very interested in this opportunity and believe my experience in React, TypeScript, and Node.js would be valuable to your team. I would welcome the opportunity to discuss how I can contribute to TechInnovate Inc.'s success.

Thank you for your time and consideration.

Best regards,
${userName}`
  };

  return await notificationService.notifyFollowUpReminder(
    userId,
    email,
    userName,
    testFollowUpData
  );
}

/**
 * Test daily summary notification
 */
async function testDailySummaryNotification(userId: string, email: string, userName: string) {
  const testSummaryData = {
    date: new Date(),
    jobsFound: 12,
    applicationsSubmitted: 3,
    followUpsSent: 2,
    upcomingFollowUps: 5,
    topJobs: [
      {
        jobId: 'test-job-001',
        jobTitle: 'Senior Full Stack Developer',
        company: 'TechInnovate Inc.',
        location: 'San Francisco, CA',
        relevancyScore: 92,
        matchedSkills: ['React', 'TypeScript', 'Node.js'],
        portal: 'LinkedIn'
      },
      {
        jobId: 'test-job-002',
        jobTitle: 'React Developer',
        company: 'StartupXYZ',
        location: 'Remote',
        salary: {
          min: 100000,
          max: 130000,
          currency: 'USD',
          period: 'yearly'
        },
        relevancyScore: 88,
        matchedSkills: ['React', 'JavaScript', 'CSS'],
        portal: 'Indeed'
      },
      {
        jobId: 'test-job-003',
        jobTitle: 'Frontend Engineer',
        company: 'BigTech Corp',
        location: 'Seattle, WA',
        relevancyScore: 85,
        matchedSkills: ['React', 'TypeScript'],
        portal: 'AngelList'
      }
    ]
  };

  return await notificationService.notifyDailySummary(
    userId,
    email,
    userName,
    testSummaryData
  );
}

/**
 * Test AWS SES connection
 */
async function testSESConnection() {
  return await awsSESService.testConnection();
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Get notification statistics for the user
    const stats = await notificationService.getNotificationStats(userId, 30);
    const history = await notificationService.getNotificationHistory(userId, { limit: 10 });

    return NextResponse.json({
      success: true,
      stats,
      recentNotifications: history.map(notification => ({
        id: notification.id,
        type: notification.type,
        recipient: notification.recipient,
        subject: notification.subject,
        status: notification.status,
        createdAt: notification.createdAt,
        sentAt: notification.sentAt,
        error: notification.error
      }))
    });

  } catch (error) {
    console.error('Error getting notification stats:', error);
    return NextResponse.json(
      { error: 'Failed to get notification statistics' },
      { status: 500 }
    );
  }
}
