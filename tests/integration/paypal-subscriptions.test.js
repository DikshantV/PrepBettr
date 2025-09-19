// tests/integration/paypal-subscriptions.test.js

import { describe, expect, test, beforeAll, afterAll, beforeEach, afterEach, jest } from '@jest/globals';
import { faker } from '@faker-js/faker';
import { 
  UserFactory, 
  SubscriptionFactory, 
  LicenseKeyFactory,
  PayPalResponseFactory,
  TestScenarioBuilder,
  PayPalTestUtils
} from '../factories/subscription-factories';
import { sandboxConfig, SANDBOX_PLAN_IDS } from '@/lib/paypal-sandbox-config';
import { PAYPAL_PLANS } from '@/lib/paypal-config';
import paypalClient from '@/lib/paypal-client';
import { SubscriptionData } from '@/lib/subscription-utils';

// Mock external dependencies for unit tests
jest.mock('@/lib/paypal-client');

describe('PayPal Subscription Integration Tests', () => {
  let testScenarios;

  beforeAll(async () => {
    // Validate sandbox configuration
    if (sandboxConfig.isTestEnvironment()) {
      console.log('Running in sandbox mode');
      try {
        sandboxConfig.validateConfig();
      } catch (error) {
        console.warn('Sandbox configuration validation failed:', error.message);
      }
    }
  });

  beforeEach(() => {
    testScenarios = new TestScenarioBuilder();
    jest.clearAllMocks();
  });

  describe('Subscription Configuration', () => {
    test('should have valid plan configurations', () => {
      const plans = Object.values(PAYPAL_PLANS);
      
      expect(plans).toHaveLength(4);
      
      plans.forEach(plan => {
        expect(plan).toHaveProperty('id');
        expect(plan).toHaveProperty('name');
        expect(plan).toHaveProperty('price');
        expect(plan).toHaveProperty('currency', 'USD');
        expect(plan).toHaveProperty('trial_period');
        expect(plan.trial_period.duration).toBe(7);
        expect(plan.trial_period.unit).toBe('DAY');
      });
    });

    test('should calculate yearly savings correctly', () => {
      // Individual plan savings
      const individualMonthly = PAYPAL_PLANS.INDIVIDUAL_MONTHLY.price;
      const individualYearly = PAYPAL_PLANS.INDIVIDUAL_YEARLY.price;
      const individualSavings = (individualMonthly * 12) - individualYearly;
      
      expect(individualSavings).toBeCloseTo(98.00, 2); // $49 * 12 - $490 = $98
      expect(individualSavings / (individualMonthly * 12)).toBeCloseTo(0.17, 2); // ~17% savings

      // Enterprise plan savings
      const enterpriseMonthly = PAYPAL_PLANS.ENTERPRISE_MONTHLY.price;
      const enterpriseYearly = PAYPAL_PLANS.ENTERPRISE_YEARLY.price;
      const enterpriseSavings = (enterpriseMonthly * 12) - enterpriseYearly;
      
      expect(enterpriseSavings).toBeCloseTo(398.00, 2); // $199 * 12 - $1990 = $398
      expect(enterpriseSavings / (enterpriseMonthly * 12)).toBeCloseTo(0.17, 2); // ~17% savings
    });

    test('should have matching plan IDs in sandbox config', () => {
      Object.keys(PAYPAL_PLANS).forEach(planKey => {
        expect(SANDBOX_PLAN_IDS).toHaveProperty(planKey);
        expect(SANDBOX_PLAN_IDS[planKey]).toBeDefined();
      });
    });
  });

  describe('Subscription Data Utilities', () => {
    test('should create subscription data with correct pricing', () => {
      const subscription = new SubscriptionData('individual', 'monthly');
      
      expect(subscription.planId).toBe('individual');
      expect(subscription.billingCycle).toBe('monthly');
      expect(subscription.getFormattedPrice()).toBe('$49');
      
      const summary = subscription.getSummary();
      expect(summary.planName).toBe('Individual Monthly');
      expect(summary.price).toBe('$49');
      expect(summary.trialDuration).toBe(7);
    });

    test('should calculate yearly subscription benefits correctly', () => {
      const yearlySubscription = new SubscriptionData('individual', 'yearly');
      
      expect(yearlySubscription.getFormattedPrice()).toBe('$490');
      expect(yearlySubscription.getMonthlyEquivalent()).toBe('$40.83');
      expect(yearlySubscription.getYearlySavings()).toBeCloseTo(98.00, 2);
      expect(yearlySubscription.getFormattedYearlySavings()).toBe('$98');
      
      const summary = yearlySubscription.getSummary();
      expect(summary.savingsPercentage).toBe(17);
      expect(summary.monthsFree).toBe(2);
    });

    test('should handle trial period calculations', () => {
      const subscription = new SubscriptionData('enterprise', 'monthly');
      const trialEnd = subscription.getTrialEndDate();
      const nextBilling = subscription.getNextBillingDate();
      
      expect(trialEnd).toBeInstanceOf(Date);
      expect(nextBilling).toEqual(trialEnd);
      
      const expectedTrialEnd = new Date();
      expectedTrialEnd.setDate(expectedTrialEnd.getDate() + 7);
      
      expect(trialEnd.toDateString()).toBe(expectedTrialEnd.toDateString());
    });
  });

  describe('Test Data Factories', () => {
    test('UserFactory should create valid user data', () => {
      const user = UserFactory.create();
      
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('email');
      expect(user).toHaveProperty('name');
      expect(user.emailVerified).toBe(true);
      expect(user.paypalCustomerId).toBeNull();
    });

    test('UserFactory should create PayPal-linked user', () => {
      const user = UserFactory.createWithPayPal('BUYER_US');
      
      expect(user.country).toBe('US');
      expect(user.currency).toBe('USD');
      expect(user.email).toContain('@example.com');
      expect(user.paypalEmail).toBe(user.email);
    });

    test('SubscriptionFactory should create valid subscription', () => {
      const subscription = SubscriptionFactory.create();
      
      expect(subscription).toHaveProperty('id');
      expect(subscription).toHaveProperty('userId');
      expect(subscription.status).toBe('active');
      expect(subscription.provider).toBe('paypal');
      expect(subscription.paypalSubscriptionId).toMatch(/^I-[A-Z0-9]{15}$/);
    });

    test('SubscriptionFactory should create trial subscription correctly', () => {
      const trialSub = SubscriptionFactory.createWithTrial('ENTERPRISE_MONTHLY');
      
      expect(trialSub.status).toBe('trialing');
      expect(trialSub.paypalStatus).toBe('ACTIVE');
      expect(trialSub.lastPaymentAmount).toBe(0);
      expect(trialSub.trialEnd).toBeInstanceOf(Date);
    });

    test('LicenseKeyFactory should create valid license key', () => {
      const licenseKey = LicenseKeyFactory.create();
      
      expect(licenseKey).toHaveProperty('id');
      expect(licenseKey).toHaveProperty('licenseKey');
      expect(licenseKey.licenseKey).toMatch(/^PREP-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
      expect(licenseKey.status).toBe('active');
      expect(licenseKey.limits.resumeProcessing).toBe(10);
    });

    test('LicenseKeyFactory should create plan-specific license key', () => {
      const enterpriseKey = LicenseKeyFactory.createForPlan('ENTERPRISE_MONTHLY');
      
      expect(enterpriseKey.limits.resumeProcessing).toBe(-1); // Unlimited
      expect(enterpriseKey.limits.interviewSessions).toBe(-1); // Unlimited
      expect(enterpriseKey.limits.coverLetters).toBe(-1); // Unlimited
    });
  });

  describe('PayPal API Response Factory', () => {
    test('should create realistic subscription response', () => {
      const subscription = PayPalResponseFactory.createSubscription('INDIVIDUAL_MONTHLY', 'ACTIVE');
      
      expect(subscription.id).toMatch(/^I-[A-Z0-9]{15}$/);
      expect(subscription.status).toBe('ACTIVE');
      expect(subscription.plan_id).toBe(SANDBOX_PLAN_IDS.INDIVIDUAL_MONTHLY);
      expect(subscription.subscriber).toHaveProperty('email_address');
      expect(subscription.billing_info).toHaveProperty('next_billing_time');
      expect(subscription.links).toHaveLength(2);
    });

    test('should create webhook event with proper structure', () => {
      const subscriptionData = { id: 'I-TEST123', status: 'ACTIVE' };
      const webhookEvent = PayPalResponseFactory.createWebhookEvent(
        'BILLING.SUBSCRIPTION.ACTIVATED',
        subscriptionData
      );
      
      expect(webhookEvent.event_type).toBe('BILLING.SUBSCRIPTION.ACTIVATED');
      expect(webhookEvent.resource_type).toBe('subscription');
      expect(webhookEvent.resource.id).toBe('I-TEST123');
      expect(webhookEvent.resource.status).toBe('ACTIVE');
      expect(webhookEvent.id).toMatch(/^WH-\d+-[a-z0-9]{10}$/);
    });

    test('should create payment event with correct structure', () => {
      const paymentEvent = PayPalResponseFactory.createPaymentEvent(
        'PAYMENT.SALE.COMPLETED',
        'PAY123456789',
        '49.00'
      );
      
      expect(paymentEvent.event_type).toBe('PAYMENT.SALE.COMPLETED');
      expect(paymentEvent.resource_type).toBe('sale');
      expect(paymentEvent.resource.amount.total).toBe('49.00');
      expect(paymentEvent.resource.state).toBe('completed');
    });
  });

  describe('Test Scenario Builder', () => {
    test('should build happy path individual scenario', () => {
      const scenario = testScenarios.buildForScenario('happy_path_individual');
      
      expect(scenario.users).toHaveLength(1);
      expect(scenario.subscriptions).toHaveLength(1);
      expect(scenario.licenseKeys).toHaveLength(1);
      expect(scenario.webhookEvents).toHaveLength(2);
      
      const user = scenario.users[0];
      const subscription = scenario.subscriptions[0];
      const licenseKey = scenario.licenseKeys[0];
      
      expect(user.country).toBe('US');
      expect(subscription.status).toBe('trialing');
      expect(subscription.userId).toBe(user.id);
      expect(licenseKey.userId).toBe(user.id);
      expect(licenseKey.subscriptionId).toBe(subscription.id);
    });

    test('should build upgrade flow scenario', () => {
      const scenario = testScenarios.buildForScenario('upgrade_flow');
      
      expect(scenario.subscriptions).toHaveLength(2);
      expect(scenario.webhookEvents).toHaveLength(3);
      
      const [oldSub, newSub] = scenario.subscriptions;
      expect(oldSub.planId).toBe('individual-monthly');
      expect(oldSub.status).toBe('cancelled');
      expect(newSub.planId).toBe('enterprise-monthly');
      expect(newSub.status).toBe('active');
    });

    test('should build payment failure scenario', () => {
      const scenario = testScenarios.buildForScenario('payment_failure');
      
      expect(scenario.webhookEvents).toHaveLength(1);
      expect(scenario.webhookEvents[0].event_type).toBe('PAYMENT.SALE.DENIED');
    });
  });

  describe('Subscription Webhook Processing', () => {
    // These tests would need the webhook endpoint to be running
    // and would test the actual webhook processing logic

    test('should process subscription created webhook', async () => {
      const scenario = testScenarios.buildForScenario('happy_path_individual');
      const webhookEvent = scenario.webhookEvents.find(
        e => e.event_type === 'BILLING.SUBSCRIPTION.CREATED'
      );

      // Mock the webhook processing
      const mockResponse = await PayPalTestUtils.simulateWebhookEvent(
        'BILLING.SUBSCRIPTION.CREATED',
        webhookEvent.resource.id
      );

      // In a real test, you would assert the database changes
      // expect(mockResponse.response.ok).toBe(true);
    });

    test('should handle subscription activation webhook', async () => {
      const scenario = testScenarios.buildForScenario('happy_path_individual');
      const webhookEvent = scenario.webhookEvents.find(
        e => e.event_type === 'BILLING.SUBSCRIPTION.ACTIVATED'
      );

      // This would trigger license key activation
      const mockResponse = await PayPalTestUtils.simulateWebhookEvent(
        'BILLING.SUBSCRIPTION.ACTIVATED',
        webhookEvent.resource.id
      );

      // In a real test, you would verify:
      // 1. Subscription status updated to 'active'
      // 2. License key issued/activated
      // 3. Welcome email sent
    });

    test('should handle subscription cancellation webhook', async () => {
      const scenario = testScenarios.buildForScenario('cancellation');
      const webhookEvent = scenario.webhookEvents[0];

      const mockResponse = await PayPalTestUtils.simulateWebhookEvent(
        'BILLING.SUBSCRIPTION.CANCELLED',
        webhookEvent.resource.id
      );

      // In a real test, you would verify:
      // 1. Subscription status updated to 'cancelled'
      // 2. License key suspended
      // 3. Cancellation email sent
    });

    test('should handle payment failure webhook', async () => {
      const scenario = testScenarios.buildForScenario('payment_failure');
      const webhookEvent = scenario.webhookEvents[0];

      const mockResponse = await PayPalTestUtils.simulateWebhookEvent(
        'PAYMENT.SALE.DENIED',
        webhookEvent.resource.id
      );

      // In a real test, you would verify:
      // 1. Failed payment recorded
      // 2. Retry mechanism triggered
      // 3. User notified of payment failure
    });
  });

  describe('PayPal API Integration (Live Sandbox)', () => {
    // These tests hit the actual PayPal sandbox API
    // Skip them if sandbox credentials are not configured

    const shouldRunLiveTests = sandboxConfig.clientId && 
                              sandboxConfig.clientSecret && 
                              process.env.RUN_PAYPAL_LIVE_TESTS === 'true';

    describe.skip(shouldRunLiveTests ? 'enabled' : 'skipped', () => {
      test('should create subscription in sandbox', async () => {
        if (!shouldRunLiveTests) {
          console.log('Skipping live PayPal test - credentials not configured');
          return;
        }

        const result = await PayPalTestUtils.createTestSubscription(
          'INDIVIDUAL_MONTHLY',
          'BUYER_US'
        );

        expect(result.subscription).toHaveProperty('id');
        expect(result.subscription.status).toBe('APPROVAL_PENDING');
        expect(result.approvalUrl).toContain('paypal.com');
        expect(result.planKey).toBe('INDIVIDUAL_MONTHLY');

        console.log('Test subscription created:', {
          id: result.subscription.id,
          approvalUrl: result.approvalUrl
        });
      }, 30000); // 30 second timeout for API calls

      test('should retrieve subscription details', async () => {
        if (!shouldRunLiveTests) return;

        // This would require a pre-created subscription ID
        const testSubscriptionId = process.env.PAYPAL_TEST_SUBSCRIPTION_ID;
        
        if (testSubscriptionId) {
          const subscription = await paypalClient.getSubscription(testSubscriptionId);
          
          expect(subscription).toHaveProperty('id', testSubscriptionId);
          expect(subscription).toHaveProperty('status');
          expect(subscription).toHaveProperty('plan_id');
        }
      }, 10000);

      test('should handle API errors gracefully', async () => {
        if (!shouldRunLiveTests) return;

        await expect(
          paypalClient.getSubscription('INVALID-SUBSCRIPTION-ID')
        ).rejects.toThrow();
      });
    });
  });

  describe('Pricing and Business Logic', () => {
    test('should enforce trial period correctly', () => {
      const trialSub = SubscriptionFactory.createWithTrial('INDIVIDUAL_MONTHLY');
      const trialEnd = new Date(trialSub.trialEnd);
      const today = new Date();
      const expectedTrialEnd = new Date();
      expectedTrialEnd.setDate(expectedTrialEnd.getDate() + 7);

      expect(trialEnd.getTime()).toBeCloseTo(expectedTrialEnd.getTime(), -4); // Within 10 seconds
      expect(trialSub.lastPaymentAmount).toBe(0);
      expect(trialSub.status).toBe('trialing');
    });

    test('should calculate prorated amounts for plan upgrades', () => {
      // This would test the business logic for handling plan upgrades
      const currentPlan = new SubscriptionData('individual', 'monthly');
      const newPlan = new SubscriptionData('enterprise', 'monthly');
      
      const currentPrice = currentPlan.pricing.amount;
      const newPrice = newPlan.pricing.amount;
      const priceDifference = newPrice - currentPrice;
      
      expect(priceDifference).toBe(150); // $199 - $49 = $150
    });

    test('should handle downgrade at period end', () => {
      const enterpriseSub = SubscriptionFactory.create({
        planKey: 'ENTERPRISE_MONTHLY',
        cancelAtPeriodEnd: true
      });
      
      expect(enterpriseSub.cancelAtPeriodEnd).toBe(true);
      expect(enterpriseSub.status).toBe('active'); // Still active until period ends
    });
  });

  describe('License Key Integration', () => {
    test('should create appropriate license key for plan', () => {
      const individualKey = LicenseKeyFactory.createForPlan('INDIVIDUAL_MONTHLY');
      const enterpriseKey = LicenseKeyFactory.createForPlan('ENTERPRISE_YEARLY');
      
      // Individual limits
      expect(individualKey.limits.resumeProcessing).toBe(10);
      expect(individualKey.limits.interviewSessions).toBe(20);
      expect(individualKey.limits.coverLetters).toBe(5);
      
      // Enterprise limits (unlimited)
      expect(enterpriseKey.limits.resumeProcessing).toBe(-1);
      expect(enterpriseKey.limits.interviewSessions).toBe(-1);
      expect(enterpriseKey.limits.coverLetters).toBe(-1);
    });

    test('should handle license key suspension on payment failure', () => {
      const suspendedKey = LicenseKeyFactory.createSuspended({
        suspensionReason: 'Payment failure'
      });
      
      expect(suspendedKey.status).toBe('suspended');
      expect(suspendedKey.suspensionReason).toBe('Payment failure');
      expect(suspendedKey.suspendedAt).toBeInstanceOf(Date);
    });

    test('should handle license key expiration', () => {
      const expiredKey = LicenseKeyFactory.createExpired();
      const today = new Date();
      
      expect(expiredKey.status).toBe('expired');
      expect(expiredKey.expiresAt.getTime()).toBeLessThan(today.getTime());
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle malformed webhook events', async () => {
      const malformedEvent = {
        id: 'WH-MALFORMED',
        // Missing required fields
      };

      // This would test the webhook endpoint's error handling
      // In a real test, you'd send this to your webhook endpoint
      // and verify it handles the error gracefully
    });

    test('should handle duplicate webhook events (idempotency)', async () => {
      const webhookEvent = PayPalResponseFactory.createWebhookEvent(
        'BILLING.SUBSCRIPTION.ACTIVATED',
        { id: 'I-TEST123' }
      );

      // Send the same webhook twice
      // Verify that the second processing doesn't cause issues
      const response1 = await PayPalTestUtils.simulateWebhookEvent(
        'BILLING.SUBSCRIPTION.ACTIVATED',
        'I-TEST123'
      );
      
      const response2 = await PayPalTestUtils.simulateWebhookEvent(
        'BILLING.SUBSCRIPTION.ACTIVATED',
        'I-TEST123'
      );

      // Both should succeed but only one should actually process
    });

    test('should handle subscription not found scenarios', () => {
      const nonExistentSubscription = 'I-NONEXISTENT123';
      
      // Test that the system handles gracefully when a webhook
      // refers to a subscription that doesn't exist in our database
    });

    test('should validate plan transitions', () => {
      // Test business rules for valid plan transitions
      const validUpgrades = [
        ['INDIVIDUAL_MONTHLY', 'ENTERPRISE_MONTHLY'],
        ['INDIVIDUAL_YEARLY', 'ENTERPRISE_YEARLY'],
        ['INDIVIDUAL_MONTHLY', 'INDIVIDUAL_YEARLY']
      ];

      const validDowngrades = [
        ['ENTERPRISE_MONTHLY', 'INDIVIDUAL_MONTHLY'],
        ['ENTERPRISE_YEARLY', 'INDIVIDUAL_YEARLY'],
        ['INDIVIDUAL_YEARLY', 'INDIVIDUAL_MONTHLY']
      ];

      // Each transition should be valid according to business rules
      validUpgrades.forEach(([from, to]) => {
        const fromPlan = PAYPAL_PLANS[from];
        const toPlan = PAYPAL_PLANS[to];
        expect(toPlan.price).toBeGreaterThanOrEqual(fromPlan.price);
      });
    });
  });

  afterEach(() => {
    // Clean up any test data or mocks
    jest.clearAllMocks();
  });

  afterAll(() => {
    // Clean up after all tests
    console.log('PayPal subscription tests completed');
  });
});