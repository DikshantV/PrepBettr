import { NextRequest, NextResponse } from 'next/server';
import { subscriptionService } from '@/lib/services/subscription-service';
import { PlanType, PlanStatus } from '@/types/subscription';

// Helper function to check if user is admin
async function isAdmin(request: NextRequest): Promise<boolean> {
  // TODO: Implement proper admin authentication
  return true;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  const { userId } = await context.params;
  try {
    // Check admin authentication
    if (!(await isAdmin(request))) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }
    const body = await request.json();
    const { action, data } = body;

    switch (action) {
      case 'resetCounters':
        await subscriptionService.resetUsageCounters(userId);
        return NextResponse.json({
          success: true,
          message: 'Usage counters reset successfully'
        });

      case 'compPremium':
        const { durationDays = 30 } = data || {};
        const periodEnd = new Date();
        periodEnd.setDate(periodEnd.getDate() + durationDays);

        await subscriptionService.updateUserSubscription(userId, {
          plan: 'premium',
          planStatus: 'active',
          currentPeriodEnd: periodEnd
        });

        // Log the comp action
        await subscriptionService.logSubscriptionEvent({
          eventId: `comp-${userId}-${Date.now()}`,
          userId,
          eventType: 'admin_comp_premium',
          rawWebhookData: { action: 'comp_premium', duration_days: durationDays },
          parsedData: {
            plan: 'premium',
            status: 'active',
            currentPeriodEnd: periodEnd
          },
          processed: true
        });

        return NextResponse.json({
          success: true,
          message: `Premium access granted for ${durationDays} days`
        });

      case 'changePlan':
        const { plan, status } = data;
        if (!plan || !status) {
          return NextResponse.json(
            { error: 'Plan and status are required' },
            { status: 400 }
          );
        }

        await subscriptionService.updateUserSubscription(userId, {
          plan: plan as PlanType,
          planStatus: status as PlanStatus
        });

        // Log the plan change
        await subscriptionService.logSubscriptionEvent({
          eventId: `admin-change-${userId}-${Date.now()}`,
          userId,
          eventType: 'admin_plan_change',
          rawWebhookData: { action: 'plan_change', plan, status },
          parsedData: {
            plan: plan as PlanType,
            status: status as PlanStatus
          },
          processed: true
        });

        return NextResponse.json({
          success: true,
          message: 'Plan updated successfully'
        });

      case 'setPeriodEnd':
        const { periodEnd: newPeriodEnd } = data;
        if (!newPeriodEnd) {
          return NextResponse.json(
            { error: 'Period end date is required' },
            { status: 400 }
          );
        }

        await subscriptionService.updateUserSubscription(userId, {
          currentPeriodEnd: new Date(newPeriodEnd)
        });

        return NextResponse.json({
          success: true,
          message: 'Period end date updated successfully'
        });

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Admin user action error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
