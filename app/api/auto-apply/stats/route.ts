import { NextRequest, NextResponse } from 'next/server';

/**
 * Auto-Apply Statistics API
 * Returns real-time statistics for the auto-apply dashboard
 */

export async function GET(request: NextRequest) {
  try {
    // For development, return mock data
    // In production, this would connect to Azure Cosmos DB or other data source
    const mockStats = {
      totalApplications: 247,
      todayApplications: 12,
      weeklyApplications: 48,
      pendingApplications: 8,
      interviewRequests: 15,
      averageRelevancyScore: 82.5,
      successRate: 18.2,
      portalStats: {
        linkedin: { applications: 156, successRate: 22.4 },
        indeed: { applications: 91, successRate: 14.3 },
        theirstack: { applications: 0, successRate: 0 },
        generic: { applications: 0, successRate: 0 }
      },
      creditUsage: {
        used: 247,
        total: 1000,
        percentage: 24.7,
        monthlyReset: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString(),
        lastUpdated: new Date().toISOString()
      }
    };

    return NextResponse.json(mockStats);
  } catch (error) {
    console.error('Error fetching auto-apply stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch statistics' }, 
      { status: 500 }
    );
  }
}
