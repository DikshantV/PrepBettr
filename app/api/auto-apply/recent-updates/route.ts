import { NextRequest, NextResponse } from 'next/server';

/**
 * Auto-Apply Recent Updates API
 * Returns recent application updates for the dashboard
 */

export async function GET(request: NextRequest) {
  try {
    // For development, return mock data
    // In production, this would fetch from Azure Cosmos DB or other data source
    const mockUpdates = [
      {
        id: 'update-001',
        jobTitle: 'Senior Software Engineer',
        company: 'TechCorp',
        status: 'applied',
        timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 minutes ago
        portal: 'LinkedIn',
        relevancyScore: 92,
        applicationUrl: 'https://linkedin.com/jobs/123456',
        message: 'Application submitted successfully'
      },
      {
        id: 'update-002',
        jobTitle: 'Full Stack Developer',
        company: 'StartupXYZ',
        status: 'failed',
        timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(), // 45 minutes ago
        portal: 'Indeed',
        relevancyScore: 78,
        applicationUrl: 'https://indeed.com/job/456789',
        message: 'Failed to submit: missing required field',
        errorDetails: 'Phone number field was not found on the application form',
        screenshotUrl: '/screenshots/failed-app-002.png'
      },
      {
        id: 'update-003',
        jobTitle: 'React Developer',
        company: 'WebDev Inc',
        status: 'applied',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        portal: 'LinkedIn',
        relevancyScore: 85,
        applicationUrl: 'https://linkedin.com/jobs/789012',
        message: 'Application submitted with cover letter'
      },
      {
        id: 'update-004',
        jobTitle: 'Frontend Engineer',
        company: 'Design Co',
        status: 'interview_requested',
        timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
        portal: 'LinkedIn',
        relevancyScore: 90,
        applicationUrl: 'https://linkedin.com/jobs/345678',
        message: 'Interview invitation received!',
        interviewDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() // 3 days from now
      },
      {
        id: 'update-005',
        jobTitle: 'Software Engineer',
        company: 'BigTech',
        status: 'applied',
        timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
        portal: 'Indeed',
        relevancyScore: 88,
        applicationUrl: 'https://indeed.com/job/567890',
        message: 'Application submitted successfully'
      }
    ];

    return NextResponse.json(mockUpdates);
  } catch (error) {
    console.error('Error fetching auto-apply updates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recent updates' }, 
      { status: 500 }
    );
  }
}
