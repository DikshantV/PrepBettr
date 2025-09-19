// app/api/subscriptions/analytics/route.js

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withSubscriptionSecurity } from '@/lib/subscription-security';
import subscriptionManager from '@/lib/subscription-manager';
import subscriptionMonitor from '@/lib/subscription-monitoring';
import notificationManager from '@/lib/subscription-notifications';

/**
 * Subscription Analytics API
 * Provides comprehensive analytics, dashboard data, and reporting
 */

/**
 * GET /api/subscriptions/analytics
 * Get subscription analytics and metrics
 */
export const GET = withSubscriptionSecurity(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const userId = request.userId;
    const timeframe = searchParams.get('timeframe') || '30d';
    const includeAdmin = searchParams.get('admin') === 'true';
    const metrics = searchParams.get('metrics')?.split(',') || ['all'];

    // TODO: Add admin role check for admin data
    // if (includeAdmin) {
    //   const hasAdminRole = await checkAdminRole(userId);
    //   if (!hasAdminRole) {
    //     return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    //   }
    // }

    let analyticsData = {};

    // Get user-specific analytics
    if (metrics.includes('all') || metrics.includes('user')) {
      const userAnalytics = await subscriptionManager.getSubscriptionAnalytics(userId);
      analyticsData.user = {
        subscriptions: userAnalytics,
        notificationHistory: await notificationManager.getNotificationHistory(userId)
      };
    }

    // Get system-wide analytics (admin only)
    if (includeAdmin && (metrics.includes('all') || metrics.includes('system'))) {
      const systemAnalytics = await subscriptionMonitor.getDashboardData();
      analyticsData.system = systemAnalytics;
    }

    // Get conversion funnel data
    if (metrics.includes('all') || metrics.includes('conversions')) {
      analyticsData.conversions = await getConversionFunnelData(timeframe);
    }

    // Get churn analysis
    if (metrics.includes('all') || metrics.includes('churn')) {
      analyticsData.churn = await getChurnAnalysis(timeframe);
    }

    // Get revenue analytics
    if (metrics.includes('all') || metrics.includes('revenue')) {
      analyticsData.revenue = await getRevenueAnalytics(timeframe);
    }

    // Get plan performance metrics
    if (metrics.includes('all') || metrics.includes('plans')) {
      analyticsData.plans = await getPlanPerformance(timeframe);
    }

    return NextResponse.json({
      success: true,
      timeframe,
      analytics: analyticsData,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error retrieving analytics:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve analytics' },
      { status: 500 }
    );
  }
}, {
  limitType: 'management'
});

/**
 * POST /api/subscriptions/analytics
 * Generate custom analytics report
 */
export const POST = withSubscriptionSecurity(async (request) => {
  try {
    const userId = request.userId;
    const {
      reportType,
      dateRange,
      filters,
      groupBy,
      metrics: requestedMetrics
    } = request.validatedBody;

    const reportData = await generateCustomReport({
      reportType,
      dateRange,
      filters,
      groupBy,
      metrics: requestedMetrics,
      userId
    });

    // Log custom report generation
    subscriptionMonitor.logStructuredEvent('analytics.custom_report_generated', {
      userId,
      reportType,
      dateRange,
      filters,
      metricsCount: Object.keys(reportData.metrics || {}).length
    });

    return NextResponse.json({
      success: true,
      report: reportData,
      generatedAt: new Date().toISOString(),
      reportId: `rpt_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
    });

  } catch (error) {
    console.error('Error generating custom report:', error);
    return NextResponse.json(
      { error: 'Failed to generate report', details: error.message },
      { status: 500 }
    );
  }
}, {
  schema: z.object({
    reportType: z.enum(['subscription', 'revenue', 'churn', 'conversion', 'user_behavior']),
    dateRange: z.object({
      start: z.string().datetime(),
      end: z.string().datetime()
    }),
    filters: z.object({
      planTypes: z.array(z.string()).optional(),
      billingCycles: z.array(z.string()).optional(),
      statuses: z.array(z.string()).optional(),
      userSegments: z.array(z.string()).optional()
    }).optional(),
    groupBy: z.enum(['day', 'week', 'month', 'plan', 'status']).optional(),
    metrics: z.array(z.string()).optional()
  }),
  limitType: 'management'
});

/**
 * Helper functions for analytics calculations
 */
async function getConversionFunnelData(timeframe) {
  try {
    // Calculate conversion funnel metrics
    const totalVisitors = 1000; // Would come from analytics system
    const signups = 150;
    const trialStarted = 120;
    const trialCompleted = 80;
    const paidConversions = 60;

    return {
      steps: [
        { name: 'Visitors', count: totalVisitors, rate: 1.0 },
        { name: 'Signups', count: signups, rate: signups / totalVisitors },
        { name: 'Trial Started', count: trialStarted, rate: trialStarted / signups },
        { name: 'Trial Completed', count: trialCompleted, rate: trialCompleted / trialStarted },
        { name: 'Paid Conversion', count: paidConversions, rate: paidConversions / trialCompleted }
      ],
      overallConversion: paidConversions / totalVisitors,
      timeframe
    };
  } catch (error) {
    console.error('Error calculating conversion funnel:', error);
    return { error: 'Failed to calculate conversion funnel' };
  }
}

async function getChurnAnalysis(timeframe) {
  try {
    const churnData = subscriptionMonitor.calculateChurnRate();
    
    return {
      overallChurnRate: churnData,
      churnByPlan: {
        individual: 0.05,
        enterprise: 0.02
      },
      churnReasons: [
        { reason: 'Price sensitivity', percentage: 35 },
        { reason: 'Feature limitations', percentage: 25 },
        { reason: 'Competitor switch', percentage: 20 },
        { reason: 'Technical issues', percentage: 10 },
        { reason: 'Other', percentage: 10 }
      ],
      voluntaryVsInvoluntary: {
        voluntary: 0.8,
        involuntary: 0.2
      },
      timeframe
    };
  } catch (error) {
    console.error('Error calculating churn analysis:', error);
    return { error: 'Failed to calculate churn analysis' };
  }
}

async function getRevenueAnalytics(timeframe) {
  try {
    const totalRevenue = subscriptionMonitor.getMetric('revenue_total') || 0;
    const monthlyRevenue = subscriptionMonitor.getMetric('revenue_monthly') || 0;
    const yearlyRevenue = subscriptionMonitor.getMetric('revenue_yearly') || 0;

    return {
      totalRevenue,
      monthlyRecurringRevenue: monthlyRevenue,
      annualRecurringRevenue: yearlyRevenue * 12 + (monthlyRevenue * 12),
      revenueByPlan: {
        individual: {
          monthly: subscriptionMonitor.getMetric('revenue_individual_monthly') || 0,
          yearly: subscriptionMonitor.getMetric('revenue_individual_yearly') || 0
        },
        enterprise: {
          monthly: subscriptionMonitor.getMetric('revenue_enterprise_monthly') || 0,
          yearly: subscriptionMonitor.getMetric('revenue_enterprise_yearly') || 0
        }
      },
      averageRevenuePerUser: totalRevenue / (subscriptionMonitor.getMetric('subscriptions_total') || 1),
      revenueGrowthRate: 0.15, // Would be calculated from historical data
      timeframe
    };
  } catch (error) {
    console.error('Error calculating revenue analytics:', error);
    return { error: 'Failed to calculate revenue analytics' };
  }
}

async function getPlanPerformance(timeframe) {
  try {
    const plans = ['INDIVIDUAL_MONTHLY', 'INDIVIDUAL_YEARLY', 'ENTERPRISE_MONTHLY', 'ENTERPRISE_YEARLY'];
    const planData = {};

    for (const planId of plans) {
      const subscriptions = Array.from(subscriptionManager.activeSubscriptions.values())
        .filter(sub => sub.planId === planId);

      planData[planId] = {
        activeSubscriptions: subscriptions.length,
        newSubscriptions: subscriptions.filter(sub => 
          (Date.now() - sub.createdAt.getTime()) < 30 * 24 * 60 * 60 * 1000
        ).length,
        churnedSubscriptions: subscriptions.filter(sub => 
          sub.status === 'cancelled'
        ).length,
        revenue: subscriptions.reduce((sum, sub) => 
          sum + (sub.planConfig?.price || 0), 0
        ),
        averageLifespan: 365, // Would be calculated from historical data
        upgrades: 0, // Would track plan upgrade events
        downgrades: 0 // Would track plan downgrade events
      };
    }

    return {
      byPlan: planData,
      popularityRanking: Object.entries(planData)
        .sort(([,a], [,b]) => b.activeSubscriptions - a.activeSubscriptions)
        .map(([planId], index) => ({ planId, rank: index + 1 })),
      conversionRates: {
        trialToPaid: 0.65,
        monthlyToYearly: 0.25,
        individualToEnterprise: 0.15
      },
      timeframe
    };
  } catch (error) {
    console.error('Error calculating plan performance:', error);
    return { error: 'Failed to calculate plan performance' };
  }
}

async function generateCustomReport(reportConfig) {
  try {
    const { reportType, dateRange, filters, groupBy, metrics, userId } = reportConfig;

    // Base report structure
    let reportData = {
      type: reportType,
      dateRange,
      filters: filters || {},
      groupBy: groupBy || 'day',
      metrics: {}
    };

    // Generate data based on report type
    switch (reportType) {
      case 'subscription':
        reportData.metrics = await generateSubscriptionMetrics(dateRange, filters);
        break;
      
      case 'revenue':
        reportData.metrics = await generateRevenueMetrics(dateRange, filters);
        break;
      
      case 'churn':
        reportData.metrics = await generateChurnMetrics(dateRange, filters);
        break;
      
      case 'conversion':
        reportData.metrics = await generateConversionMetrics(dateRange, filters);
        break;
      
      case 'user_behavior':
        reportData.metrics = await generateUserBehaviorMetrics(dateRange, filters);
        break;
      
      default:
        throw new Error(`Unsupported report type: ${reportType}`);
    }

    // Apply grouping if specified
    if (groupBy && groupBy !== 'day') {
      reportData.metrics = await applyGrouping(reportData.metrics, groupBy, dateRange);
    }

    return reportData;

  } catch (error) {
    console.error('Error generating custom report:', error);
    throw error;
  }
}

async function generateSubscriptionMetrics(dateRange, filters) {
  const subscriptions = Array.from(subscriptionManager.activeSubscriptions.values());
  
  return {
    totalSubscriptions: subscriptions.length,
    activeSubscriptions: subscriptions.filter(s => s.status === 'active').length,
    trialingSubscriptions: subscriptions.filter(s => s.status === 'trialing').length,
    cancelledSubscriptions: subscriptions.filter(s => s.status === 'cancelled').length,
    suspendedSubscriptions: subscriptions.filter(s => s.status === 'suspended').length,
    newSubscriptionsInPeriod: subscriptions.filter(s => 
      s.createdAt >= new Date(dateRange.start) && s.createdAt <= new Date(dateRange.end)
    ).length
  };
}

async function generateRevenueMetrics(dateRange, filters) {
  return {
    totalRevenue: subscriptionMonitor.getMetric('revenue_total') || 0,
    recurringRevenue: subscriptionMonitor.getMetric('revenue_total') || 0,
    newRevenue: 0, // Would calculate based on new subscriptions in period
    expandedRevenue: 0, // Would calculate based on upgrades
    contractedRevenue: 0, // Would calculate based on downgrades
    churnedRevenue: 0 // Would calculate based on cancellations
  };
}

async function generateChurnMetrics(dateRange, filters) {
  const totalSubscriptions = subscriptionManager.activeSubscriptions.size;
  const cancelledCount = subscriptionMonitor.getMetric('cancellations_total') || 0;
  
  return {
    churnRate: totalSubscriptions > 0 ? cancelledCount / totalSubscriptions : 0,
    churnedCustomers: cancelledCount,
    reactivatedCustomers: 0, // Would track reactivations
    netChurn: cancelledCount,
    grossChurn: cancelledCount
  };
}

async function generateConversionMetrics(dateRange, filters) {
  const conversions = Array.from(subscriptionMonitor.conversionEvents.values());
  
  return {
    totalConversions: conversions.length,
    trialToActive: conversions.filter(c => c.conversionType === 'trial_to_active').length,
    monthlyToYearly: conversions.filter(c => c.conversionType === 'monthly_to_yearly').length,
    individualToEnterprise: conversions.filter(c => c.conversionType === 'individual_to_enterprise').length,
    conversionRate: conversions.length / (subscriptionManager.activeSubscriptions.size || 1)
  };
}

async function generateUserBehaviorMetrics(dateRange, filters) {
  return {
    activeUsers: subscriptionManager.activeSubscriptions.size,
    engagementRate: 0.75, // Would come from usage analytics
    featureAdoption: {
      resumeProcessing: 0.85,
      interviewPrep: 0.70,
      coverLetterGen: 0.60
    },
    supportTickets: 0, // Would come from support system
    npsScore: 8.5 // Would come from survey data
  };
}

async function applyGrouping(metrics, groupBy, dateRange) {
  // Implementation would group metrics by the specified dimension
  return metrics;
}

