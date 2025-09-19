// lib/paypal-config.js

/**
 * PayPal Subscription Plans Configuration
 * Defines all available subscription plans with pricing, features, and billing cycles
 */

const CURRENCY = 'USD';

// Plan pricing configuration
const PRICING = {
  INDIVIDUAL: {
    MONTHLY: 49.00,
    YEARLY: 490.00  // $49 * 10 months (2 months free)
  },
  ENTERPRISE: {
    MONTHLY: 199.00,
    YEARLY: 1990.00  // $199 * 10 months (2 months free)
  }
};

// Feature definitions for each plan type
const FEATURES = {
  INDIVIDUAL: [
    'Resume processing and optimization',
    'AI-powered interview preparation',
    'Cover letter generation',
    'Basic career insights',
    'Email support',
    'Up to 10 resumes per month',
    'Up to 20 interview sessions per month',
    'Up to 5 cover letters per month'
  ],
  ENTERPRISE: [
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
  ]
};

// Usage limits for each plan type
const LIMITS = {
  INDIVIDUAL: {
    resumeProcessing: 10,
    interviewSessions: 20,
    coverLetters: 5
  },
  ENTERPRISE: {
    resumeProcessing: -1, // -1 means unlimited
    interviewSessions: -1,
    coverLetters: -1
  }
};

// Trial period configuration (7-day free trial)
const TRIAL_PERIOD = {
  duration: 7,
  unit: 'DAY'
};

// PayPal subscription plan configurations
export const PAYPAL_PLANS = {
  // Individual Monthly Plan
  INDIVIDUAL_MONTHLY: {
    id: 'individual-monthly',
    name: 'Individual Monthly',
    description: 'Perfect for job seekers who want comprehensive career preparation tools',
    type: 'INDIVIDUAL',
    billing_cycle: 'MONTHLY',
    price: PRICING.INDIVIDUAL.MONTHLY,
    currency: CURRENCY,
    interval: 'MONTH',
    interval_count: 1,
    trial_period: TRIAL_PERIOD,
    features: FEATURES.INDIVIDUAL,
    limits: LIMITS.INDIVIDUAL,
    paypal_plan_details: {
      product_id: '', // Will be set when creating the product
      name: 'PrepBettr Individual Monthly',
      description: 'Monthly subscription for individual users with comprehensive career preparation tools',
      status: 'ACTIVE',
      billing_cycles: [
        // Trial period
        {
          frequency: {
            interval_unit: 'DAY',
            interval_count: 7
          },
          tenure_type: 'TRIAL',
          sequence: 1,
          total_cycles: 1,
          pricing_scheme: {
            fixed_price: {
              value: '0',
              currency_code: CURRENCY
            }
          }
        },
        // Regular billing
        {
          frequency: {
            interval_unit: 'MONTH',
            interval_count: 1
          },
          tenure_type: 'REGULAR',
          sequence: 2,
          total_cycles: 0, // 0 means infinite cycles
          pricing_scheme: {
            fixed_price: {
              value: PRICING.INDIVIDUAL.MONTHLY.toString(),
              currency_code: CURRENCY
            }
          }
        }
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee_failure_action: 'CONTINUE',
        payment_failure_threshold: 3
      }
    }
  },

  // Individual Yearly Plan
  INDIVIDUAL_YEARLY: {
    id: 'individual-yearly',
    name: 'Individual Yearly',
    description: 'Best value for individual users - save 2 months with yearly billing',
    type: 'INDIVIDUAL',
    billing_cycle: 'YEARLY',
    price: PRICING.INDIVIDUAL.YEARLY,
    currency: CURRENCY,
    interval: 'YEAR',
    interval_count: 1,
    trial_period: TRIAL_PERIOD,
    features: FEATURES.INDIVIDUAL,
    limits: LIMITS.INDIVIDUAL,
    paypal_plan_details: {
      product_id: '', // Will be set when creating the product
      name: 'PrepBettr Individual Yearly',
      description: 'Yearly subscription for individual users - 2 months free compared to monthly billing',
      status: 'ACTIVE',
      billing_cycles: [
        // Trial period
        {
          frequency: {
            interval_unit: 'DAY',
            interval_count: 7
          },
          tenure_type: 'TRIAL',
          sequence: 1,
          total_cycles: 1,
          pricing_scheme: {
            fixed_price: {
              value: '0',
              currency_code: CURRENCY
            }
          }
        },
        // Regular billing
        {
          frequency: {
            interval_unit: 'YEAR',
            interval_count: 1
          },
          tenure_type: 'REGULAR',
          sequence: 2,
          total_cycles: 0, // 0 means infinite cycles
          pricing_scheme: {
            fixed_price: {
              value: PRICING.INDIVIDUAL.YEARLY.toString(),
              currency_code: CURRENCY
            }
          }
        }
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee_failure_action: 'CONTINUE',
        payment_failure_threshold: 3
      }
    }
  },

  // Enterprise Monthly Plan
  ENTERPRISE_MONTHLY: {
    id: 'enterprise-monthly',
    name: 'Enterprise Monthly',
    description: 'Unlimited access for teams and organizations with advanced features',
    type: 'ENTERPRISE',
    billing_cycle: 'MONTHLY',
    price: PRICING.ENTERPRISE.MONTHLY,
    currency: CURRENCY,
    interval: 'MONTH',
    interval_count: 1,
    trial_period: TRIAL_PERIOD,
    features: FEATURES.ENTERPRISE,
    limits: LIMITS.ENTERPRISE,
    paypal_plan_details: {
      product_id: '', // Will be set when creating the product
      name: 'PrepBettr Enterprise Monthly',
      description: 'Monthly subscription for enterprise users with unlimited access and advanced features',
      status: 'ACTIVE',
      billing_cycles: [
        // Trial period
        {
          frequency: {
            interval_unit: 'DAY',
            interval_count: 7
          },
          tenure_type: 'TRIAL',
          sequence: 1,
          total_cycles: 1,
          pricing_scheme: {
            fixed_price: {
              value: '0',
              currency_code: CURRENCY
            }
          }
        },
        // Regular billing
        {
          frequency: {
            interval_unit: 'MONTH',
            interval_count: 1
          },
          tenure_type: 'REGULAR',
          sequence: 2,
          total_cycles: 0, // 0 means infinite cycles
          pricing_scheme: {
            fixed_price: {
              value: PRICING.ENTERPRISE.MONTHLY.toString(),
              currency_code: CURRENCY
            }
          }
        }
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee_failure_action: 'CONTINUE',
        payment_failure_threshold: 3
      }
    }
  },

  // Enterprise Yearly Plan
  ENTERPRISE_YEARLY: {
    id: 'enterprise-yearly',
    name: 'Enterprise Yearly',
    description: 'Best value for enterprise - save 2 months with yearly billing',
    type: 'ENTERPRISE',
    billing_cycle: 'YEARLY',
    price: PRICING.ENTERPRISE.YEARLY,
    currency: CURRENCY,
    interval: 'YEAR',
    interval_count: 1,
    trial_period: TRIAL_PERIOD,
    features: FEATURES.ENTERPRISE,
    limits: LIMITS.ENTERPRISE,
    paypal_plan_details: {
      product_id: '', // Will be set when creating the product
      name: 'PrepBettr Enterprise Yearly',
      description: 'Yearly subscription for enterprise users - 2 months free compared to monthly billing',
      status: 'ACTIVE',
      billing_cycles: [
        // Trial period
        {
          frequency: {
            interval_unit: 'DAY',
            interval_count: 7
          },
          tenure_type: 'TRIAL',
          sequence: 1,
          total_cycles: 1,
          pricing_scheme: {
            fixed_price: {
              value: '0',
              currency_code: CURRENCY
            }
          }
        },
        // Regular billing
        {
          frequency: {
            interval_unit: 'YEAR',
            interval_count: 1
          },
          tenure_type: 'REGULAR',
          sequence: 2,
          total_cycles: 0, // 0 means infinite cycles
          pricing_scheme: {
            fixed_price: {
              value: PRICING.ENTERPRISE.YEARLY.toString(),
              currency_code: CURRENCY
            }
          }
        }
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee_failure_action: 'CONTINUE',
        payment_failure_threshold: 3
      }
    }
  }
};

// Helper function to get plan by ID
export const getPlanById = (planId) => {
  return Object.values(PAYPAL_PLANS).find(plan => plan.id === planId);
};

// Helper function to get plans by type
export const getPlansByType = (type) => {
  return Object.values(PAYPAL_PLANS).filter(plan => plan.type === type);
};

// Helper function to get all available plans
export const getAllPlans = () => {
  return Object.values(PAYPAL_PLANS);
};

// Helper function to calculate yearly savings
export const getYearlySavings = (type) => {
  const monthly = type === 'INDIVIDUAL' ? PRICING.INDIVIDUAL.MONTHLY : PRICING.ENTERPRISE.MONTHLY;
  const yearly = type === 'INDIVIDUAL' ? PRICING.INDIVIDUAL.YEARLY : PRICING.ENTERPRISE.YEARLY;
  return (monthly * 12) - yearly;
};

// Export constants for easy access
export { PRICING, FEATURES, LIMITS, TRIAL_PERIOD, CURRENCY };
