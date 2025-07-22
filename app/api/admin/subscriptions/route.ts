import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { subscriptionService } from '@/lib/services/subscription-service';
import { ExtendedUser, PlanType, PlanStatus } from '@/types/subscription';

// Helper function to check if user is admin (you'll need to implement this based on your auth system)
async function isAdmin(request: NextRequest): Promise<boolean> {
  // TODO: Implement proper admin authentication
  // For now, return true - you should implement proper admin role checking
  // This might involve checking a JWT token for admin role, or checking against a list of admin emails
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
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '25');
    const planFilter = url.searchParams.get('plan') as PlanType | null;
    const statusFilter = url.searchParams.get('status') as PlanStatus | null;

    // Build query
    let query = db.collection('users').orderBy('createdAt', 'desc');
    
    if (planFilter) {
      query = query.where('plan', '==', planFilter);
    }
    
    if (statusFilter) {
      query = query.where('planStatus', '==', statusFilter);
    }

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query.offset(offset).limit(limit);

    const snapshot = await query.get();
    
    // Get total count for pagination
    let totalQuery = db.collection('users');
    if (planFilter) {
      totalQuery = totalQuery.where('plan', '==', planFilter);
    }
    if (statusFilter) {
      totalQuery = totalQuery.where('planStatus', '==', statusFilter);
    }
    const totalSnapshot = await totalQuery.count().get();
    const total = totalSnapshot.data().count;

    // Process user data and get usage counters
    const subscriptions = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const userData = doc.data();
        const userId = doc.id;

        // Get usage counters for this user
        const usage = await subscriptionService.getUserUsage(userId);

        return {
          userId,
          email: userData.email,
          name: userData.name,
          plan: userData.plan || 'free',
          planStatus: userData.planStatus || 'active',
          currentPeriodEnd: userData.currentPeriodEnd?.toDate() || null,
          dodoCustomerId: userData.dodoCustomerId || null,
          dodoSubscriptionId: userData.dodoSubscriptionId || null,
          createdAt: userData.createdAt?.toDate() || null,
          lastLogin: userData.lastLogin?.toDate() || null,
          usage: usage || null
        };
      })
    );

    return NextResponse.json({
      subscriptions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Admin subscriptions error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
