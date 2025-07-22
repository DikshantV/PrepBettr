import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

// Helper function to check if user is admin
async function isAdmin(request: NextRequest): Promise<boolean> {
  // TODO: Implement proper admin authentication
  return true;
}

export async function GET(request: NextRequest) {
  try {
    // Check admin authentication
    if (!(await isAdmin(request))) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const db = getAdminFirestore();
    const url = new URL(request.url);
    const period = url.searchParams.get('period') || '30'; // days
    const periodDays = parseInt(period);
    
    const now = new Date();
    const startDate = new Date(now.getTime() - (periodDays * 24 * 60 * 60 * 1000));

    // Get revenue data from subscription_events
    const revenueSnapshot = await db
      .collection('subscription_events')
      .where('timestamp', '>=', startDate)
      .where('eventType', 'in', ['subscription.created', 'invoice.payment_succeeded'])
      .orderBy('timestamp', 'asc')
      .get();

    // Process revenue data by day
    const revenueByDay: { [date: string]: number } = {};
    let totalRevenue = 0;

    revenueSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const date = data.timestamp.toDate().toISOString().split('T')[0];
      const amount = data.parsedData?.amount || 0;
      
      if (!revenueByDay[date]) {
        revenueByDay[date] = 0;
      }
      revenueByDay[date] += amount;
      totalRevenue += amount;
    });

    // Get active subscriptions count by plan
    const usersSnapshot = await db.collection('users').get();
    const subscriptionCounts = {
      free: 0,
      premium: 0,
      total: 0
    };

    const activeSubscriptions = {
      active: 0,
      canceled: 0,
      past_due: 0,
      incomplete: 0,
      trialing: 0
    };

    usersSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const plan = data.plan || 'free';
      const status = data.planStatus || 'active';
      
      subscriptionCounts[plan as keyof typeof subscriptionCounts]++;
      subscriptionCounts.total++;
      
      if (activeSubscriptions.hasOwnProperty(status)) {
        activeSubscriptions[status as keyof typeof activeSubscriptions]++;
      }
    });

    // Calculate churn rate (simplified - users who canceled in the last period)
    const churnEventsSnapshot = await db
      .collection('subscription_events')
      .where('timestamp', '>=', startDate)
      .where('eventType', '==', 'subscription.canceled')
      .get();

    const churnedUsers = churnEventsSnapshot.size;
    const churnRate = subscriptionCounts.total > 0 ? (churnedUsers / subscriptionCounts.total) * 100 : 0;

    // Get user growth data
    const userGrowthSnapshot = await db
      .collection('users')
      .where('createdAt', '>=', startDate)
      .orderBy('createdAt', 'asc')
      .get();

    const userGrowthByDay: { [date: string]: number } = {};
    userGrowthSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const date = data.createdAt?.toDate().toISOString().split('T')[0] || '';
      if (date) {
        if (!userGrowthByDay[date]) {
          userGrowthByDay[date] = 0;
        }
        userGrowthByDay[date]++;
      }
    });

    // Recent subscription events for activity feed
    const recentEventsSnapshot = await db
      .collection('subscription_events')
      .orderBy('timestamp', 'desc')
      .limit(20)
      .get();

    const recentEvents = recentEventsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        eventType: data.eventType,
        userId: data.userId,
        timestamp: data.timestamp.toDate(),
        parsedData: data.parsedData
      };
    });

    // Calculate MRR (Monthly Recurring Revenue) estimate
    const premiumUsers = subscriptionCounts.premium;
    const estimatedMRR = premiumUsers * 29.99; // Assuming $29.99/month premium plan

    return NextResponse.json({
      revenue: {
        total: totalRevenue / 100, // Convert cents to dollars
        byDay: Object.entries(revenueByDay).map(([date, amount]) => ({
          date,
          amount: amount / 100
        }))
      },
      subscriptions: {
        byPlan: subscriptionCounts,
        byStatus: activeSubscriptions,
        mrr: estimatedMRR
      },
      churn: {
        rate: churnRate,
        count: churnedUsers,
        period: periodDays
      },
      userGrowth: {
        total: userGrowthSnapshot.size,
        byDay: Object.entries(userGrowthByDay).map(([date, count]) => ({
          date,
          count
        }))
      },
      recentEvents,
      period: {
        days: periodDays,
        start: startDate.toISOString(),
        end: now.toISOString()
      }
    });

  } catch (error) {
    console.error('Admin analytics error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
