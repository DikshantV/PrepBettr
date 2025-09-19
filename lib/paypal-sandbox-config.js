// lib/paypal-sandbox-config.js

/**
 * PayPal Sandbox Configuration
 * Contains sandbox-specific settings, plan IDs, and test account information
 */

// Sandbox plan IDs (to be updated when plans are created in PayPal Dashboard)
export const SANDBOX_PLAN_IDS = {
  INDIVIDUAL_MONTHLY: process.env.PAYPAL_INDIVIDUAL_MONTHLY_PLAN_ID || 'P-5ML4271244454362WXNWU5NQ',
  INDIVIDUAL_YEARLY: process.env.PAYPAL_INDIVIDUAL_YEARLY_PLAN_ID || 'P-9JS89134P6442442WXNWU6UQ',
  ENTERPRISE_MONTHLY: process.env.PAYPAL_ENTERPRISE_MONTHLY_PLAN_ID || 'P-1ML4271244454362WXNWU7NQ',
  ENTERPRISE_YEARLY: process.env.PAYPAL_ENTERPRISE_YEARLY_PLAN_ID || 'P-4JS89134P6442442WXNWU8UQ'
};

// Sandbox test accounts for automated testing
export const SANDBOX_TEST_ACCOUNTS = {
  BUSINESS: {
    email: process.env.PAYPAL_SANDBOX_BUSINESS_EMAIL || 'sb-business@example.com',
    password: process.env.PAYPAL_SANDBOX_BUSINESS_PASSWORD || 'testpass123'
  },
  BUYER_US: {
    email: process.env.PAYPAL_SANDBOX_BUYER_US_EMAIL || 'sb-buyer-us@example.com',
    password: process.env.PAYPAL_SANDBOX_BUYER_US_PASSWORD || 'testpass123',
    country: 'US',
    currency: 'USD'
  },
  BUYER_EU: {
    email: process.env.PAYPAL_SANDBOX_BUYER_EU_EMAIL || 'sb-buyer-eu@example.com', 
    password: process.env.PAYPAL_SANDBOX_BUYER_EU_PASSWORD || 'testpass123',
    country: 'GB',
    currency: 'USD' // Still using USD for consistency
  }
};

// Webhook configuration for sandbox
export const SANDBOX_WEBHOOK_CONFIG = {
  webhookId: process.env.PAYPAL_SANDBOX_WEBHOOK_ID || '',
  url: process.env.PAYPAL_SANDBOX_WEBHOOK_URL || 'https://your-ngrok-url.ngrok.io/api/webhooks/paypal',
  events: [
    'BILLING.SUBSCRIPTION.CREATED',
    'BILLING.SUBSCRIPTION.ACTIVATED', 
    'BILLING.SUBSCRIPTION.UPDATED',
    'BILLING.SUBSCRIPTION.CANCELLED',
    'BILLING.SUBSCRIPTION.SUSPENDED',
    'BILLING.SUBSCRIPTION.RE-ACTIVATED',
    'BILLING.SUBSCRIPTION.EXPIRED',
    'PAYMENT.SALE.COMPLETED',
    'PAYMENT.SALE.DENIED',
    'PAYMENT.CAPTURE.COMPLETED',
    'PAYMENT.CAPTURE.DENIED',
    'PAYMENT.CAPTURE.REFUNDED'
  ]
};

// Test scenarios configuration
export const TEST_SCENARIOS = {
  HAPPY_PATH: {
    name: 'Happy Path Subscription Flow',
    plans: ['INDIVIDUAL_MONTHLY', 'INDIVIDUAL_YEARLY', 'ENTERPRISE_MONTHLY', 'ENTERPRISE_YEARLY'],
    buyer: 'BUYER_US',
    expectedFlow: ['created', 'approval_pending', 'active']
  },
  INTERNATIONAL: {
    name: 'International User Subscription',
    plans: ['INDIVIDUAL_YEARLY', 'ENTERPRISE_YEARLY'],
    buyer: 'BUYER_EU',
    expectedFlow: ['created', 'approval_pending', 'active']
  },
  PLAN_UPGRADES: {
    name: 'Plan Upgrade Scenarios',
    upgrades: [
      { from: 'INDIVIDUAL_MONTHLY', to: 'ENTERPRISE_MONTHLY' },
      { from: 'INDIVIDUAL_YEARLY', to: 'ENTERPRISE_YEARLY' },
      { from: 'INDIVIDUAL_MONTHLY', to: 'INDIVIDUAL_YEARLY' },
      { from: 'ENTERPRISE_MONTHLY', to: 'ENTERPRISE_YEARLY' }
    ],
    buyer: 'BUYER_US'
  },
  PLAN_DOWNGRADES: {
    name: 'Plan Downgrade Scenarios', 
    downgrades: [
      { from: 'ENTERPRISE_MONTHLY', to: 'INDIVIDUAL_MONTHLY' },
      { from: 'ENTERPRISE_YEARLY', to: 'INDIVIDUAL_YEARLY' },
      { from: 'INDIVIDUAL_YEARLY', to: 'INDIVIDUAL_MONTHLY' },
      { from: 'ENTERPRISE_YEARLY', to: 'ENTERPRISE_MONTHLY' }
    ],
    buyer: 'BUYER_US'
  },
  CANCELLATION: {
    name: 'Subscription Cancellation',
    cancellationTypes: ['immediate', 'end_of_period'],
    plans: ['INDIVIDUAL_MONTHLY', 'ENTERPRISE_YEARLY'],
    buyer: 'BUYER_US'
  },
  PAYMENT_FAILURES: {
    name: 'Payment Failure Scenarios',
    failureTypes: ['insufficient_funds', 'invalid_payment_method', 'expired_card'],
    plans: ['INDIVIDUAL_MONTHLY', 'ENTERPRISE_MONTHLY'],
    buyer: 'BUYER_US'
  }
};

// Environment configuration helper
export class PayPalSandboxConfig {
  constructor() {
    this.mode = process.env.PAYPAL_MODE || 'sandbox';
    this.clientId = this.getSandboxClientId();
    this.clientSecret = this.getSandboxClientSecret();
    this.webhookId = SANDBOX_WEBHOOK_CONFIG.webhookId;
    this.webhookUrl = SANDBOX_WEBHOOK_CONFIG.url;
  }

  getSandboxClientId() {
    if (this.mode === 'production') {
      return process.env.PAYPAL_CLIENT_ID;
    }
    return process.env.PAYPAL_SANDBOX_CLIENT_ID || process.env.PAYPAL_CLIENT_ID;
  }

  getSandboxClientSecret() {
    if (this.mode === 'production') {
      return process.env.PAYPAL_CLIENT_SECRET;
    }
    return process.env.PAYPAL_SANDBOX_CLIENT_SECRET || process.env.PAYPAL_CLIENT_SECRET;
  }

  getPlanId(planKey) {
    return SANDBOX_PLAN_IDS[planKey] || null;
  }

  getTestAccount(accountType) {
    return SANDBOX_TEST_ACCOUNTS[accountType] || null;
  }

  validateConfig() {
    const errors = [];

    if (!this.clientId) {
      errors.push('PayPal sandbox client ID is missing');
    }

    if (!this.clientSecret) {
      errors.push('PayPal sandbox client secret is missing'); 
    }

    if (!this.webhookId && this.mode === 'sandbox') {
      console.warn('PayPal sandbox webhook ID is missing - webhook testing will be limited');
    }

    // Validate plan IDs
    Object.entries(SANDBOX_PLAN_IDS).forEach(([key, value]) => {
      if (!value || value.includes('example')) {
        errors.push(`PayPal plan ID for ${key} needs to be configured`);
      }
    });

    if (errors.length > 0) {
      throw new Error(`PayPal sandbox configuration errors:\n${errors.join('\n')}`);
    }

    return true;
  }

  isTestEnvironment() {
    return this.mode === 'sandbox' || process.env.NODE_ENV === 'test';
  }

  getReturnUrls(baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000') {
    return {
      return_url: `${baseUrl}/subscription/success`,
      cancel_url: `${baseUrl}/subscription/cancel`
    };
  }
}

// Export singleton instance
export const sandboxConfig = new PayPalSandboxConfig();

// Helper functions for testing
export const testHelpers = {
  // Generate test user data
  generateTestUser(accountType = 'BUYER_US') {
    const account = SANDBOX_TEST_ACCOUNTS[accountType];
    return {
      email: account.email,
      name: `Test User ${Date.now()}`,
      country: account.country,
      currency: account.currency
    };
  },

  // Generate test subscription data
  generateTestSubscription(planKey = 'INDIVIDUAL_MONTHLY', accountType = 'BUYER_US') {
    const user = this.generateTestUser(accountType);
    const planId = sandboxConfig.getPlanId(planKey);
    const returnUrls = sandboxConfig.getReturnUrls();

    return {
      plan_id: planId,
      user,
      ...returnUrls,
      metadata: {
        test: true,
        planKey,
        accountType,
        createdAt: new Date().toISOString()
      }
    };
  },

  // Get webhook event template
  getWebhookEventTemplate(eventType, subscriptionId) {
    return {
      id: `WH-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      event_type: eventType,
      resource_type: 'subscription',
      summary: `Subscription ${eventType.toLowerCase()}`,
      resource: {
        id: subscriptionId,
        status: this.getStatusFromEvent(eventType),
        status_update_time: new Date().toISOString()
      },
      create_time: new Date().toISOString(),
      event_version: '1.0'
    };
  },

  getStatusFromEvent(eventType) {
    const statusMap = {
      'BILLING.SUBSCRIPTION.CREATED': 'APPROVAL_PENDING',
      'BILLING.SUBSCRIPTION.ACTIVATED': 'ACTIVE',
      'BILLING.SUBSCRIPTION.CANCELLED': 'CANCELLED', 
      'BILLING.SUBSCRIPTION.SUSPENDED': 'SUSPENDED',
      'BILLING.SUBSCRIPTION.RE-ACTIVATED': 'ACTIVE',
      'BILLING.SUBSCRIPTION.EXPIRED': 'EXPIRED'
    };
    return statusMap[eventType] || 'ACTIVE';
  }
};

export default sandboxConfig;