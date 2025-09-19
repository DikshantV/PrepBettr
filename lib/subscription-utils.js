// lib/subscription-utils.js

/**
 * Subscription Data Structure and Utility Functions
 * Handles plan selection, pricing calculations, and subscription management
 */

// Plan configurations with detailed information
export const SUBSCRIPTION_PLANS = {
  individual: {
    id: 'individual',
    name: 'Individual',
    description: 'Perfect for job seekers',
    category: 'personal',
    icon: 'zap',
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
      coverLetters: 5
    },
    pricing: {
      monthly: {
        amount: 49.00,
        currency: 'USD',
        interval: 'month',
        paypalPlanId: 'individual-monthly' // Will be updated with actual PayPal plan IDs
      },
      yearly: {
        amount: 490.00,
        currency: 'USD', 
        interval: 'year',
        monthlyEquivalent: 40.83,
        savings: 17,
        monthsFree: 2,
        paypalPlanId: 'individual-yearly'
      }
    },
    trial: {
      enabled: true,
      duration: 7,
      unit: 'days'
    },
    popular: false,
    recommended: false
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For teams and organizations',
    category: 'business',
    icon: 'building2',
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
      coverLetters: -1
    },
    pricing: {
      monthly: {
        amount: 199.00,
        currency: 'USD',
        interval: 'month',
        paypalPlanId: 'enterprise-monthly'
      },
      yearly: {
        amount: 1990.00,
        currency: 'USD',
        interval: 'year', 
        monthlyEquivalent: 165.83,
        savings: 17,
        monthsFree: 2,
        paypalPlanId: 'enterprise-yearly'
      }
    },
    trial: {
      enabled: true,
      duration: 7,
      unit: 'days'
    },
    popular: true,
    recommended: true
  }
};

// Subscription data structure for state management
export class SubscriptionData {
  constructor(planId = 'individual', billingCycle = 'monthly') {
    this.planId = planId;
    this.billingCycle = billingCycle;
    this.plan = SUBSCRIPTION_PLANS[planId];
    this.pricing = this.plan.pricing[billingCycle];
    this.createdAt = new Date();
    this.status = 'pending';
  }

  // Get formatted price
  getFormattedPrice() {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: this.pricing.currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(this.pricing.amount);
  }

  // Get monthly equivalent price for yearly plans
  getMonthlyEquivalent() {
    if (this.billingCycle === 'yearly') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: this.pricing.currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(this.pricing.monthlyEquivalent);
    }
    return this.getFormattedPrice();
  }

  // Calculate yearly savings
  getYearlySavings() {
    if (this.billingCycle !== 'yearly') return 0;
    
    const monthlyPrice = this.plan.pricing.monthly.amount;
    const yearlyPrice = this.pricing.amount;
    const monthlyYearlyTotal = monthlyPrice * 12;
    
    return monthlyYearlyTotal - yearlyPrice;
  }

  // Get formatted yearly savings
  getFormattedYearlySavings() {
    const savings = this.getYearlySavings();
    if (savings <= 0) return null;
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: this.pricing.currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(savings);
  }

  // Get trial end date
  getTrialEndDate() {
    if (!this.plan.trial.enabled) return null;
    
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + this.plan.trial.duration);
    return endDate;
  }

  // Get next billing date (after trial)
  getNextBillingDate() {
    const trialEnd = this.getTrialEndDate();
    if (trialEnd) return trialEnd;
    
    // If no trial, billing starts immediately
    const nextBilling = new Date();
    if (this.billingCycle === 'monthly') {
      nextBilling.setMonth(nextBilling.getMonth() + 1);
    } else {
      nextBilling.setFullYear(nextBilling.getFullYear() + 1);
    }
    return nextBilling;
  }

  // Get subscription summary for display
  getSummary() {
    return {
      planName: `${this.plan.name} ${this.billingCycle === 'yearly' ? 'Yearly' : 'Monthly'}`,
      planId: this.planId,
      billingCycle: this.billingCycle,
      price: this.getFormattedPrice(),
      monthlyEquivalent: this.getMonthlyEquivalent(),
      yearlySavings: this.getFormattedYearlySavings(),
      savingsPercentage: this.billingCycle === 'yearly' ? this.pricing.savings : null,
      monthsFree: this.billingCycle === 'yearly' ? this.pricing.monthsFree : null,
      trialDuration: this.plan.trial.enabled ? this.plan.trial.duration : null,
      trialEndDate: this.getTrialEndDate(),
      nextBillingDate: this.getNextBillingDate(),
      features: this.plan.features,
      limits: this.plan.limits,
      paypalPlanId: this.pricing.paypalPlanId
    };
  }

  // Update plan selection
  updatePlan(planId) {
    if (SUBSCRIPTION_PLANS[planId]) {
      this.planId = planId;
      this.plan = SUBSCRIPTION_PLANS[planId];
      this.pricing = this.plan.pricing[this.billingCycle];
      return true;
    }
    return false;
  }

  // Update billing cycle
  updateBillingCycle(billingCycle) {
    if (this.plan.pricing[billingCycle]) {
      this.billingCycle = billingCycle;
      this.pricing = this.plan.pricing[billingCycle];
      return true;
    }
    return false;
  }

  // Convert to PayPal subscription request format
  toPayPalRequest(userEmail, userName, returnUrl, cancelUrl) {
    return {
      plan_id: this.pricing.paypalPlanId,
      user_email: userEmail,
      user_name: userName,
      return_url: returnUrl,
      cancel_url: cancelUrl,
      start_time: this.plan.trial.enabled ? null : new Date().toISOString(),
      metadata: {
        planId: this.planId,
        billingCycle: this.billingCycle,
        trialEnabled: this.plan.trial.enabled,
        createdAt: this.createdAt.toISOString()
      }
    };
  }

  // Create from PayPal response
  static fromPayPalResponse(paypalData) {
    const metadata = paypalData.metadata || {};
    const subscription = new SubscriptionData(
      metadata.planId || 'individual',
      metadata.billingCycle || 'monthly'
    );
    
    subscription.status = paypalData.status || 'active';
    subscription.paypalSubscriptionId = paypalData.id;
    subscription.paypalStatus = paypalData.status;
    subscription.subscriberEmail = paypalData.subscriber?.email_address;
    subscription.startTime = paypalData.start_time;
    subscription.createTime = paypalData.create_time;
    subscription.updateTime = paypalData.update_time;
    
    return subscription;
  }
}

// Utility functions for subscription management
export const subscriptionUtils = {
  // Get all available plans
  getAllPlans() {
    return Object.values(SUBSCRIPTION_PLANS);
  },

  // Get plan by ID
  getPlan(planId) {
    return SUBSCRIPTION_PLANS[planId] || null;
  },

  // Get popular plans
  getPopularPlans() {
    return Object.values(SUBSCRIPTION_PLANS).filter(plan => plan.popular);
  },

  // Get recommended plans
  getRecommendedPlans() {
    return Object.values(SUBSCRIPTION_PLANS).filter(plan => plan.recommended);
  },

  // Compare two plans
  comparePlans(planId1, planId2) {
    const plan1 = SUBSCRIPTION_PLANS[planId1];
    const plan2 = SUBSCRIPTION_PLANS[planId2];
    
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
      savings: {
        monthly: Math.abs(plan2.pricing.monthly.amount - plan1.pricing.monthly.amount),
        yearly: Math.abs(plan2.pricing.yearly.amount - plan1.pricing.yearly.amount)
      }
    };
  },

  // Calculate total savings across all yearly plans
  getTotalYearlySavings() {
    return Object.values(SUBSCRIPTION_PLANS).reduce((total, plan) => {
      const monthlyYear = plan.pricing.monthly.amount * 12;
      const yearlyPrice = plan.pricing.yearly.amount;
      return total + (monthlyYear - yearlyPrice);
    }, 0);
  },

  // Get subscription status display text
  getStatusDisplay(status) {
    const statusMap = {
      pending: 'Pending Approval',
      active: 'Active',
      cancelled: 'Cancelled', 
      expired: 'Expired',
      suspended: 'Suspended',
      approval_pending: 'Approval Pending'
    };
    return statusMap[status] || status;
  },

  // Format date for display
  formatDate(date, options = {}) {
    if (!date) return null;
    
    const defaultOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      ...options
    };
    
    return new Intl.DateTimeFormat('en-US', defaultOptions).format(
      typeof date === 'string' ? new Date(date) : date
    );
  },

  // Calculate days until next billing
  getDaysUntilBilling(nextBillingDate) {
    if (!nextBillingDate) return null;
    
    const today = new Date();
    const billing = typeof nextBillingDate === 'string' ? new Date(nextBillingDate) : nextBillingDate;
    const diffTime = billing - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(0, diffDays);
  },

  // Get billing frequency text
  getBillingFrequencyText(billingCycle) {
    const frequencyMap = {
      monthly: 'Every month',
      yearly: 'Every year'
    };
    return frequencyMap[billingCycle] || billingCycle;
  }
};

// Export default subscription data class
export default SubscriptionData;
