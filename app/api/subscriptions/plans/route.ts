import { NextRequest, NextResponse } from 'next/server';

// Static subscription plans configuration
const SUBSCRIPTION_PLANS = {
  individual: {
    name: 'Individual',
    description: 'Perfect for job seekers',
    monthly: {
      price: 49,
      planId: 'individual-monthly',
      savings: null
    },
    yearly: {
      price: 490,
      planId: 'individual-yearly',
      savings: 17,
      monthlyEquivalent: 40.83
    },
    features: [
      'Resume processing and optimization',
      'AI-powered interview preparation',
      'Cover letter generation',
      'Basic career insights',
      'Email support',
      'Up to 10 resumes per month',
      'Up to 20 interview sessions per month',
      'Up to 5 cover letters per month'
    ],
    popular: false,
    recommended: false,
    limits: {
      resumes: 10,
      interviews: 20,
      coverLetters: 5
    }
  },
  enterprise: {
    name: 'Enterprise',
    description: 'For teams and organizations',
    monthly: {
      price: 199,
      planId: 'enterprise-monthly',
      savings: null
    },
    yearly: {
      price: 1990,
      planId: 'enterprise-yearly',
      savings: 17,
      monthlyEquivalent: 165.83
    },
    features: [
      'Everything in Individual plan',
      'Unlimited resume processing',
      'Unlimited interview sessions',
      'Unlimited cover letters',
      'Advanced career analytics',
      'Priority support',
      'Custom branding options',
      'Team collaboration features',
      'API access',
      'Dedicated account manager'
    ],
    popular: true,
    recommended: true,
    limits: {
      resumes: -1, // Unlimited
      interviews: -1, // Unlimited
      coverLetters: -1 // Unlimited
    }
  }
};

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const planId = url.searchParams.get('planId');
    const format = url.searchParams.get('format') || 'full';

    // Return specific plan if requested
    if (planId) {
      const plan = SUBSCRIPTION_PLANS[planId as keyof typeof SUBSCRIPTION_PLANS];
      if (!plan) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Plan not found',
            availablePlans: Object.keys(SUBSCRIPTION_PLANS)
          }, 
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        plan: {
          id: planId,
          ...plan
        },
        timestamp: new Date().toISOString()
      });
    }

    // Return all plans with optional format optimization
    let plans: any = SUBSCRIPTION_PLANS;

    if (format === 'summary') {
      // Return minimal plan data for performance
      plans = Object.fromEntries(
        Object.entries(SUBSCRIPTION_PLANS).map(([key, plan]) => [
          key,
          {
            name: plan.name,
            description: plan.description,
            monthly: { price: plan.monthly.price, planId: plan.monthly.planId },
            yearly: { 
              price: plan.yearly.price, 
              planId: plan.yearly.planId,
              monthlyEquivalent: plan.yearly.monthlyEquivalent,
              savings: plan.yearly.savings
            },
            popular: plan.popular,
            recommended: plan.recommended
          }
        ])
      );
    }

    return NextResponse.json({
      success: true,
      plans,
      meta: {
        count: Object.keys(plans).length,
        format,
        timestamp: new Date().toISOString(),
        cacheHint: {
          maxAge: 900, // 15 minutes
          staleWhileRevalidate: 3600 // 1 hour
        }
      }
    }, {
      headers: {
        'Cache-Control': 'public, max-age=900, stale-while-revalidate=3600',
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('Subscription plans API error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' 
          ? (error as Error).message 
          : 'Unable to fetch subscription plans'
      },
      { status: 500 }
    );
  }
}

// HEAD request for cache validation
export async function HEAD(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Cache-Control': 'public, max-age=900, stale-while-revalidate=3600',
      'Last-Modified': new Date().toUTCString()
    }
  });
}
