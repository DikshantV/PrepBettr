// tests/factories/subscription-factories.js

import { faker } from '@faker-js/faker';
import { sandboxConfig, SANDBOX_TEST_ACCOUNTS, SANDBOX_PLAN_IDS } from '@/lib/paypal-sandbox-config';
import paypalClient, { createSubscriptionPayload } from '@/lib/paypal-client';
import { PAYPAL_PLANS } from '@/lib/paypal-config';

/**
 * Test Data Factories for PayPal Subscription Testing
 * Creates mock data for users, subscriptions, license keys, and webhook events
 */

// User Factory
export class UserFactory {
  static create(overrides = {}) {
    return {
      id: faker.string.uuid(),
      email: faker.internet.email(),
      name: faker.person.fullName(),
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      createdAt: new Date(),
      updatedAt: new Date(),
      emailVerified: true,
      // PayPal specific fields
      paypalCustomerId: null,
      paypalEmail: null,
      ...overrides
    };
  }

  static createWithPayPal(accountType = 'BUYER_US', overrides = {}) {
    const testAccount = SANDBOX_TEST_ACCOUNTS[accountType];
    return this.create({
      email: testAccount.email,
      paypalEmail: testAccount.email,
      country: testAccount.country,
      currency: testAccount.currency,
      ...overrides
    });
  }

  static createBatch(count, overrides = {}) {
    return Array.from({ length: count }, () => this.create(overrides));
  }
}

// Subscription Factory
export class SubscriptionFactory {
  static create(overrides = {}) {
    const planKey = overrides.planKey || 'INDIVIDUAL_MONTHLY';
    const planConfig = PAYPAL_PLANS[planKey];
    
    return {
      id: faker.string.uuid(),
      userId: overrides.userId || faker.string.uuid(),
      planId: planKey.toLowerCase().replace('_', '-'),
      status: 'active',
      provider: 'paypal',
      
      // PayPal specific fields
      paypalSubscriptionId: `I-${faker.string.alphanumeric(15).toUpperCase()}`,
      paypalPlanId: SANDBOX_PLAN_IDS[planKey],
      paypalStatus: 'ACTIVE',
      paypalCustomerId: null,
      
      // Billing information
      currentPeriodStart: new Date(),
      currentPeriodEnd: this.calculateNextBillingDate(planConfig?.billing_cycle || 'MONTHLY'),
      nextBillingTime: this.calculateNextBillingDate(planConfig?.billing_cycle || 'MONTHLY'),
      lastPaymentAmount: planConfig?.price || 49.00,
      lastPaymentTime: new Date(),
      
      // Subscription metadata
      cancelAtPeriodEnd: false,
      failedPaymentCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      
      ...overrides
    };
  }

  static createWithTrial(planKey = 'INDIVIDUAL_MONTHLY', overrides = {}) {
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 7);
    
    return this.create({
      planKey,
      status: 'trialing',
      paypalStatus: 'ACTIVE',
      trialEnd: trialEndDate,
      currentPeriodStart: new Date(),
      currentPeriodEnd: trialEndDate,
      nextBillingTime: trialEndDate,
      lastPaymentAmount: 0,
      ...overrides
    });
  }

  static createCancelled(planKey = 'INDIVIDUAL_MONTHLY', overrides = {}) {
    return this.create({
      planKey,
      status: 'cancelled',
      paypalStatus: 'CANCELLED',
      cancelledAt: new Date(),
      cancelAtPeriodEnd: false,
      ...overrides
    });
  }

  static createExpired(planKey = 'INDIVIDUAL_MONTHLY', overrides = {}) {
    const expiredDate = new Date();
    expiredDate.setDate(expiredDate.getDate() - 1);
    
    return this.create({
      planKey,
      status: 'expired',
      paypalStatus: 'EXPIRED',
      currentPeriodEnd: expiredDate,
      expiredAt: expiredDate,
      ...overrides
    });
  }

  static calculateNextBillingDate(billingCycle) {
    const nextBilling = new Date();
    if (billingCycle === 'YEARLY') {
      nextBilling.setFullYear(nextBilling.getFullYear() + 1);
    } else {
      nextBilling.setMonth(nextBilling.getMonth() + 1);
    }
    return nextBilling;
  }

  static createBatch(count, planKey = 'INDIVIDUAL_MONTHLY', overrides = {}) {
    return Array.from({ length: count }, () => this.create({ planKey, ...overrides }));
  }
}

// License Key Factory (based on Dodo Payments License Key system)
export class LicenseKeyFactory {
  static create(overrides = {}) {
    return {
      id: faker.string.uuid(),
      userId: overrides.userId || faker.string.uuid(),
      subscriptionId: overrides.subscriptionId || faker.string.uuid(),
      
      // License key details
      licenseKey: this.generateLicenseKey(),
      status: 'active',
      activatedAt: new Date(),
      expiresAt: this.calculateExpirationDate(),
      
      // Usage limits based on plan
      limits: {
        resumeProcessing: overrides.limits?.resumeProcessing || 10,
        interviewSessions: overrides.limits?.interviewSessions || 20,
        coverLetters: overrides.limits?.coverLetters || 5
      },
      
      // Current usage
      usage: {
        resumeProcessingCount: 0,
        interviewSessionsCount: 0,
        coverLettersCount: 0,
        resetDate: new Date()
      },
      
      createdAt: new Date(),
      updatedAt: new Date(),
      
      ...overrides
    };
  }

  static createForPlan(planKey, overrides = {}) {
    const planConfig = PAYPAL_PLANS[planKey];
    const limits = planConfig?.limits || {};
    
    return this.create({
      limits: {
        resumeProcessing: limits.resumeProcessing,
        interviewSessions: limits.interviewSessions,
        coverLetters: limits.coverLetters
      },
      ...overrides
    });
  }

  static createExpired(overrides = {}) {
    const expiredDate = new Date();
    expiredDate.setDate(expiredDate.getDate() - 1);
    
    return this.create({
      status: 'expired',
      expiresAt: expiredDate,
      ...overrides
    });
  }

  static createSuspended(overrides = {}) {
    return this.create({
      status: 'suspended',
      suspendedAt: new Date(),
      suspensionReason: 'Payment failure',
      ...overrides
    });
  }

  static generateLicenseKey() {
    // Generate a license key in format: PREP-XXXX-XXXX-XXXX
    const segments = Array.from({ length: 3 }, () => 
      faker.string.alphanumeric(4).toUpperCase()
    );
    return `PREP-${segments.join('-')}`;
  }

  static calculateExpirationDate(months = 1) {
    const expiration = new Date();
    expiration.setMonth(expiration.getMonth() + months);
    return expiration;
  }
}

// PayPal API Response Factory
export class PayPalResponseFactory {
  static createSubscription(planKey = 'INDIVIDUAL_MONTHLY', status = 'ACTIVE', overrides = {}) {
    const planId = SANDBOX_PLAN_IDS[planKey];
    const subscriptionId = `I-${faker.string.alphanumeric(15).toUpperCase()}`;
    
    return {
      id: subscriptionId,
      status: status,
      status_update_time: new Date().toISOString(),
      plan_id: planId,
      start_time: new Date().toISOString(),
      create_time: new Date().toISOString(),
      update_time: new Date().toISOString(),
      
      subscriber: {
        name: {
          given_name: faker.person.firstName(),
          surname: faker.person.lastName()
        },
        email_address: faker.internet.email(),
        payer_id: `${faker.string.alphanumeric(13).toUpperCase()}`
      },
      
      billing_info: {
        outstanding_balance: {
              currency_code: 'USD',
          value: '0.00'
        },
        cycle_executions: [
          {
            tenure_type: 'TRIAL',
            sequence: 1,
            cycles_completed: status === 'ACTIVE' ? 1 : 0,
            cycles_remaining: status === 'ACTIVE' ? 0 : 1,
            current_pricing_scheme_version: 1,
            total_cycles: 1
          },
          {
            tenure_type: 'REGULAR',
            sequence: 2,
            cycles_completed: 0,
            cycles_remaining: 0,
            current_pricing_scheme_version: 1,
            total_cycles: 0
          }
        ],
        last_payment: status === 'ACTIVE' ? {
          amount: {
            currency_code: 'USD',
            value: '0.00'
          },
          time: new Date().toISOString()
        } : undefined,
        next_billing_time: status === 'ACTIVE' ? 
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() : 
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      },
      
      links: [
        {
          href: `https://api.sandbox.paypal.com/v1/billing/subscriptions/${subscriptionId}`,
          rel: 'self',
          method: 'GET'
        },
        {
          href: `https://www.sandbox.paypal.com/webapps/billing/subscriptions?ba_token=${subscriptionId}`,
          rel: 'approve',
          method: 'GET'
        }
      ],
      
      ...overrides
    };
  }

  static createWebhookEvent(eventType, subscriptionData, overrides = {}) {
    return {
      id: `WH-${Date.now()}-${faker.string.alphanumeric(10)}`,
      event_type: eventType,
      resource_type: 'subscription',
      resource_version: '2.0',
      create_time: new Date().toISOString(),
      summary: `Subscription ${eventType.replace('BILLING.SUBSCRIPTION.', '').toLowerCase()}`,
      
      resource: {
        ...subscriptionData,
        status_update_time: new Date().toISOString()
      },
      
      links: [
        {
          href: `https://api.sandbox.paypal.com/v1/notifications/webhooks-events/${faker.string.alphanumeric(20)}`,
          rel: 'self',
          method: 'GET'
        }
      ],
      
      event_version: '1.0',
      
      ...overrides
    };
  }

  static createPaymentEvent(eventType, paymentId, amount = '49.00', overrides = {}) {
    return {
      id: `WH-${Date.now()}-${faker.string.alphanumeric(10)}`,
      event_type: eventType,
      resource_type: 'sale',
      resource_version: '2.0',
      create_time: new Date().toISOString(),
      summary: `Payment ${eventType.replace('PAYMENT.SALE.', '').toLowerCase()}`,
      
      resource: {
        id: paymentId || `PAY${faker.string.alphanumeric(15)}`,
        amount: {
          total: amount,
          currency: 'USD'
        },
        state: eventType === 'PAYMENT.SALE.COMPLETED' ? 'completed' : 'denied',
        create_time: new Date().toISOString(),
        update_time: new Date().toISOString(),
        billing_agreement_id: `I-${faker.string.alphanumeric(15).toUpperCase()}`,
        ...overrides.resource
      },
      
      ...overrides
    };
  }
}

// Test Scenario Builder
export class TestScenarioBuilder {
  constructor() {
    this.users = [];
    this.subscriptions = [];
    this.licenseKeys = [];
    this.webhookEvents = [];
  }

  withUser(overrides = {}) {
    const user = UserFactory.create(overrides);
    this.users.push(user);
    return { user, builder: this };
  }

  withPayPalUser(accountType = 'BUYER_US', overrides = {}) {
    const user = UserFactory.createWithPayPal(accountType, overrides);
    this.users.push(user);
    return { user, builder: this };
  }

  withSubscription(userId, planKey = 'INDIVIDUAL_MONTHLY', overrides = {}) {
    const subscription = SubscriptionFactory.create({ userId, planKey, ...overrides });
    this.subscriptions.push(subscription);
    return { subscription, builder: this };
  }

  withTrialSubscription(userId, planKey = 'INDIVIDUAL_MONTHLY', overrides = {}) {
    const subscription = SubscriptionFactory.createWithTrial(planKey, { userId, ...overrides });
    this.subscriptions.push(subscription);
    return { subscription, builder: this };
  }

  withLicenseKey(userId, subscriptionId, planKey = 'INDIVIDUAL_MONTHLY', overrides = {}) {
    const licenseKey = LicenseKeyFactory.createForPlan(planKey, { 
      userId, 
      subscriptionId, 
      ...overrides 
    });
    this.licenseKeys.push(licenseKey);
    return { licenseKey, builder: this };
  }

  withWebhookEvent(eventType, subscriptionId, overrides = {}) {
    const subscription = this.subscriptions.find(s => s.paypalSubscriptionId === subscriptionId);
    const subscriptionData = subscription ? PayPalResponseFactory.createSubscription(
      subscription.planKey, 
      subscription.paypalStatus,
      { id: subscriptionId }
    ) : { id: subscriptionId };
    
    const webhookEvent = PayPalResponseFactory.createWebhookEvent(eventType, subscriptionData, overrides);
    this.webhookEvents.push(webhookEvent);
    return { webhookEvent, builder: this };
  }

  build() {
    return {
      users: this.users,
      subscriptions: this.subscriptions,
      licenseKeys: this.licenseKeys,
      webhookEvents: this.webhookEvents
    };
  }

  buildForScenario(scenarioName) {
    const scenarios = {
      'happy_path_individual': this.buildHappyPathIndividual(),
      'happy_path_enterprise': this.buildHappyPathEnterprise(),
      'trial_to_active': this.buildTrialToActive(),
      'cancellation': this.buildCancellation(),
      'payment_failure': this.buildPaymentFailure(),
      'upgrade_flow': this.buildUpgradeFlow(),
      'downgrade_flow': this.buildDowngradeFlow()
    };
    
    return scenarios[scenarioName] || this.build();
  }

  buildHappyPathIndividual() {
    const { user } = this.withPayPalUser('BUYER_US');
    const { subscription } = this.withTrialSubscription(user.id, 'INDIVIDUAL_MONTHLY');
    const { licenseKey } = this.withLicenseKey(user.id, subscription.id, 'INDIVIDUAL_MONTHLY');
    
    this.withWebhookEvent('BILLING.SUBSCRIPTION.CREATED', subscription.paypalSubscriptionId);
    this.withWebhookEvent('BILLING.SUBSCRIPTION.ACTIVATED', subscription.paypalSubscriptionId);
    
    return this.build();
  }

  buildHappyPathEnterprise() {
    const { user } = this.withPayPalUser('BUYER_US');
    const { subscription } = this.withTrialSubscription(user.id, 'ENTERPRISE_YEARLY');
    const { licenseKey } = this.withLicenseKey(user.id, subscription.id, 'ENTERPRISE_YEARLY');
    
    this.withWebhookEvent('BILLING.SUBSCRIPTION.CREATED', subscription.paypalSubscriptionId);
    this.withWebhookEvent('BILLING.SUBSCRIPTION.ACTIVATED', subscription.paypalSubscriptionId);
    
    return this.build();
  }

  buildTrialToActive() {
    const { user } = this.withPayPalUser('BUYER_US');
    const { subscription } = this.withTrialSubscription(user.id, 'INDIVIDUAL_MONTHLY');
    
    // Simulate trial completion and first payment
    this.withWebhookEvent('BILLING.SUBSCRIPTION.CREATED', subscription.paypalSubscriptionId);
    this.withWebhookEvent('BILLING.SUBSCRIPTION.ACTIVATED', subscription.paypalSubscriptionId);
    this.withWebhookEvent('PAYMENT.SALE.COMPLETED', subscription.paypalSubscriptionId);
    
    return this.build();
  }

  buildCancellation() {
    const { user } = this.withPayPalUser('BUYER_US');
    const { subscription } = this.withSubscription(user.id, 'INDIVIDUAL_MONTHLY', {
      status: 'cancelled',
      paypalStatus: 'CANCELLED'
    });
    
    this.withWebhookEvent('BILLING.SUBSCRIPTION.CANCELLED', subscription.paypalSubscriptionId);
    
    return this.build();
  }

  buildPaymentFailure() {
    const { user } = this.withPayPalUser('BUYER_US');
    const { subscription } = this.withSubscription(user.id, 'INDIVIDUAL_MONTHLY');
    
    this.withWebhookEvent('PAYMENT.SALE.DENIED', subscription.paypalSubscriptionId);
    
    return this.build();
  }

  buildUpgradeFlow() {
    const { user } = this.withPayPalUser('BUYER_US');
    
    // Start with Individual Monthly
    const { subscription: oldSub } = this.withSubscription(user.id, 'INDIVIDUAL_MONTHLY', {
      status: 'cancelled',
      paypalStatus: 'CANCELLED'
    });
    
    // Upgrade to Enterprise Monthly
    const { subscription: newSub } = this.withSubscription(user.id, 'ENTERPRISE_MONTHLY');
    const { licenseKey } = this.withLicenseKey(user.id, newSub.id, 'ENTERPRISE_MONTHLY');
    
    this.withWebhookEvent('BILLING.SUBSCRIPTION.CANCELLED', oldSub.paypalSubscriptionId);
    this.withWebhookEvent('BILLING.SUBSCRIPTION.CREATED', newSub.paypalSubscriptionId);
    this.withWebhookEvent('BILLING.SUBSCRIPTION.ACTIVATED', newSub.paypalSubscriptionId);
    
    return this.build();
  }

  buildDowngradeFlow() {
    const { user } = this.withPayPalUser('BUYER_US');
    
    // Start with Enterprise Yearly
    const { subscription: oldSub } = this.withSubscription(user.id, 'ENTERPRISE_YEARLY', {
      status: 'cancelled',
      paypalStatus: 'CANCELLED'
    });
    
    // Downgrade to Individual Monthly
    const { subscription: newSub } = this.withSubscription(user.id, 'INDIVIDUAL_MONTHLY');
    const { licenseKey } = this.withLicenseKey(user.id, newSub.id, 'INDIVIDUAL_MONTHLY');
    
    this.withWebhookEvent('BILLING.SUBSCRIPTION.CANCELLED', oldSub.paypalSubscriptionId);
    this.withWebhookEvent('BILLING.SUBSCRIPTION.CREATED', newSub.paypalSubscriptionId);
    this.withWebhookEvent('BILLING.SUBSCRIPTION.ACTIVATED', newSub.paypalSubscriptionId);
    
    return this.build();
  }
}

// API Testing Utilities
export class PayPalTestUtils {
  static async createTestSubscription(planKey = 'INDIVIDUAL_MONTHLY', accountType = 'BUYER_US') {
    const testAccount = SANDBOX_TEST_ACCOUNTS[accountType];
    const planId = SANDBOX_PLAN_IDS[planKey];
    const returnUrls = sandboxConfig.getReturnUrls();
    
    const subscriptionPayload = createSubscriptionPayload(
      planId,
      {
        email: testAccount.email,
        name: `Test User ${Date.now()}`
      },
      returnUrls.return_url,
      returnUrls.cancel_url
    );
    
    try {
      const subscription = await paypalClient.createSubscription(subscriptionPayload);
      return {
        subscription,
        approvalUrl: subscription.links?.find(link => link.rel === 'approve')?.href,
        planKey,
        accountType
      };
    } catch (error) {
      console.error('Test subscription creation failed:', error);
      throw error;
    }
  }

  static async simulateWebhookEvent(eventType, subscriptionId) {
    const webhookEvent = PayPalResponseFactory.createWebhookEvent(
      eventType,
      { id: subscriptionId }
    );
    
    // Send to local webhook endpoint
    const response = await fetch('http://localhost:3000/api/webhooks/paypal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'PAYPAL-TRANSMISSION-ID': faker.string.alphanumeric(36),
        'PAYPAL-CERT-ID': faker.string.alphanumeric(36),
        'PAYPAL-AUTH-ALGO': 'SHA256withRSA',
        'PAYPAL-TRANSMISSION-SIG': faker.string.alphanumeric(256),
        'PAYPAL-TRANSMISSION-TIME': new Date().toISOString()
      },
      body: JSON.stringify(webhookEvent)
    });
    
    return { response, webhookEvent };
  }
}

// Export all factories and utilities
export default {
  UserFactory,
  SubscriptionFactory,
  LicenseKeyFactory,
  PayPalResponseFactory,
  TestScenarioBuilder,
  PayPalTestUtils
};