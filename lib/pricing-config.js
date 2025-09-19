// lib/pricing-config.js

/**
 * PrepBettr Pricing Structure and Configuration
 * Centralized pricing logic with 17% yearly savings (2 months free)
 */

// Calculate yearly pricing with 17% savings (2 months free)
const calculateYearlyPrice = (monthlyPrice) => {
  return monthlyPrice * 10; // 12 months - 2 free months = 10 months
};

const calculateMonthlyEquivalent = (yearlyPrice) => {
  return yearlyPrice / 12;
};

export const PREPBETTR_PRICING = {
  INDIVIDUAL: {
    monthly: {
      amount: 49.00,
      currency: 'USD',
      interval: 'month',
      savings: null,
      displayPrice: '$49',
      paypalPlanId: process.env.PAYPAL_INDIVIDUAL_MONTHLY_PLAN_ID || 'individual-monthly'
    },
    yearly: {
      amount: calculateYearlyPrice(49), // $490
      currency: 'USD', 
      interval: 'year',
      monthlyEquivalent: calculateMonthlyEquivalent(calculateYearlyPrice(49)), // $40.83
      savings: 17,
      monthsFree: 2,
      displayPrice: '$490',
      displayMonthlyEquivalent: '$40.83',
      paypalPlanId: process.env.PAYPAL_INDIVIDUAL_YEARLY_PLAN_ID || 'individual-yearly'
    }
  },
  ENTERPRISE: {
    monthly: {
      amount: 199.00,
      currency: 'USD',
      interval: 'month',
      savings: null,
      displayPrice: '$199',
      paypalPlanId: process.env.PAYPAL_ENTERPRISE_MONTHLY_PLAN_ID || 'enterprise-monthly'
    },
    yearly: {
      amount: calculateYearlyPrice(199), // $1990
      currency: 'USD',
      interval: 'year', 
      monthlyEquivalent: calculateMonthlyEquivalent(calculateYearlyPrice(199)), // $165.83
      savings: 17,
      monthsFree: 2,
      displayPrice: '$1990',
      displayMonthlyEquivalent: '$165.83',
      paypalPlanId: process.env.PAYPAL_ENTERPRISE_YEARLY_PLAN_ID || 'enterprise-yearly'
    }
  }
};

// Plan definitions with features and limits
export const PREPBETTR_PLANS = {
  individual: {
    id: 'individual',
    name: 'Individual',
    description: 'Perfect for job seekers',
    category: 'personal',
    icon: 'zap',
    popular: false,
    recommended: false,
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
    limits: {
      resumes: 10,
      interviews: 20,
      coverLetters: 5,
      users: 1
    },
    pricing: PREPBETTR_PRICING.INDIVIDUAL,
    trial: {
      enabled: true,
      duration: 7,
      unit: 'days'
    }
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For teams and organizations',
    category: 'business',
    icon: 'building2',
    popular: true,
    recommended: true,
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
    limits: {
      resumes: -1, // -1 means unlimited
      interviews: -1,
      coverLetters: -1,
      users: -1
    },
    pricing: PREPBETTR_PRICING.ENTERPRISE,
    trial: {
      enabled: true,
      duration: 7,
      unit: 'days'
    }
  }
};

// Utility functions for pricing calculations
export const pricingUtils = {
  /**
   * Format price for display
   */
  formatPrice(amount, currency = 'USD', options = {}) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: options.showCents ? 2 : 0,
      maximumFractionDigits: options.showCents ? 2 : 2,
      ...options
    }).format(amount);
  },

  /**
   * Calculate total yearly savings
   */
  calculateYearlySavings(planType) {
    const pricing = PREPBETTR_PRICING[planType.toUpperCase()];
    if (!pricing) return 0;
    
    const monthlyTotal = pricing.monthly.amount * 12;
    const yearlyPrice = pricing.yearly.amount;
    return monthlyTotal - yearlyPrice;
  },

  /**
   * Get formatted yearly savings
   */
  getFormattedYearlySavings(planType) {
    const savings = this.calculateYearlySavings(planType);
    return savings > 0 ? this.formatPrice(savings) : null;
  },

  /**
   * Calculate savings percentage
   */
  calculateSavingsPercentage(planType) {
    const pricing = PREPBETTR_PRICING[planType.toUpperCase()];
    if (!pricing) return 0;
    
    const monthlyTotal = pricing.monthly.amount * 12;
    const yearlyPrice = pricing.yearly.amount;
    return Math.round(((monthlyTotal - yearlyPrice) / monthlyTotal) * 100);
  },

  /**
   * Get plan by ID
   */
  getPlan(planId) {
    return PREPBETTR_PLANS[planId] || null;
  },

  /**
   * Get all plans
   */
  getAllPlans() {
    return Object.values(PREPBETTR_PLANS);
  },

  /**
   * Get popular plans
   */
  getPopularPlans() {
    return Object.values(PREPBETTR_PLANS).filter(plan => plan.popular);
  },

  /**
   * Get recommended plans
   */
  getRecommendedPlans() {
    return Object.values(PREPBETTR_PLANS).filter(plan => plan.recommended);
  },

  /**
   * Compare two plans
   */
  comparePlans(planId1, planId2) {
    const plan1 = PREPBETTR_PLANS[planId1];
    const plan2 = PREPBETTR_PLANS[planId2];
    
    if (!plan1 || !plan2) return null;
    
    return {
      plan1: {
        name: plan1.name,
        monthlyPrice: plan1.pricing.monthly.amount,
        yearlyPrice: plan1.pricing.yearly.amount,
        features: plan1.features.length
      },
      plan2: {
        name: plan2.name,
        monthlyPrice: plan2.pricing.monthly.amount,
        yearlyPrice: plan2.pricing.yearly.amount,
        features: plan2.features.length
      },
      difference: {
        monthly: plan2.pricing.monthly.amount - plan1.pricing.monthly.amount,
        yearly: plan2.pricing.yearly.amount - plan1.pricing.yearly.amount,
        features: plan2.features.length - plan1.features.length
      }
    };
  },

  /**
   * Validate pricing configuration
   */
  validatePricing() {
    const errors = [];
    
    Object.entries(PREPBETTR_PRICING).forEach(([planType, pricing]) => {
      // Validate monthly pricing
      if (!pricing.monthly?.amount || pricing.monthly.amount <= 0) {
        errors.push(`Invalid monthly amount for ${planType}`);
      }
      
      // Validate yearly pricing
      if (!pricing.yearly?.amount || pricing.yearly.amount <= 0) {
        errors.push(`Invalid yearly amount for ${planType}`);
      }
      
      // Validate savings calculation
      const expectedYearly = pricing.monthly.amount * 10; // 2 months free
      if (Math.abs(pricing.yearly.amount - expectedYearly) > 0.01) {
        errors.push(`Yearly pricing for ${planType} doesn't match expected savings`);
      }
      
      // Validate monthly equivalent
      const expectedMonthlyEquiv = pricing.yearly.amount / 12;
      if (Math.abs(pricing.yearly.monthlyEquivalent - expectedMonthlyEquiv) > 0.01) {
        errors.push(`Monthly equivalent for ${planType} doesn't match calculation`);
      }
    });
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
};

// Export default configuration
export default {
  pricing: PREPBETTR_PRICING,
  plans: PREPBETTR_PLANS,
  utils: pricingUtils
};

// Validation check on import
if (process.env.NODE_ENV !== 'production') {
  const validation = pricingUtils.validatePricing();
  if (!validation.isValid) {
    console.warn('Pricing configuration validation failed:', validation.errors);
  }
}