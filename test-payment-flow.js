// test-payment-flow.js
// Interactive payment flow testing script

import fetch from 'node-fetch';
import crypto from 'crypto';

const BASE_URL = 'http://localhost:3000';  // Adjust port as needed

// Mock data for testing
const MOCK_USER_DATA = {
  uid: 'test-user-' + Date.now(),
  email: 'testuser@example.com',
  name: 'Test User'
};

const WEBHOOK_SECRET = process.env.DODO_WEBHOOK_SECRET || 'test-webhook-secret';

class PaymentFlowTester {
  constructor() {
    this.sessionCookie = null;
    this.checkoutUrl = null;
    this.subscriptionId = null;
  }

  // Utility method to make authenticated requests
  async makeRequest(endpoint, options = {}) {
    const url = `${BASE_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.sessionCookie) {
      headers['Cookie'] = `session=${this.sessionCookie}`;
    }

    const response = await fetch(url, {
      ...options,
      headers
    });

    const data = await response.json();
    return { response, data };
  }

  // Test 1: Create checkout session
  async testCreateCheckout() {
    console.log('\n🧪 Test 1: Creating checkout session...');
    
    try {
      const { response, data } = await this.makeRequest('/api/payments/create-checkout', {
        method: 'POST',
        body: JSON.stringify({
          uid: MOCK_USER_DATA.uid
        })
      });

      console.log(`   Status: ${response.status}`);
      
      if (response.status === 401) {
        console.log('   ⚠️  Authentication required - this is expected without a session cookie');
        return false;
      }

      if (data.checkoutUrl) {
        this.checkoutUrl = data.checkoutUrl;
        this.subscriptionId = data.subscriptionId;
        console.log('   ✅ Checkout URL created:', data.checkoutUrl);
        console.log('   📝 Subscription ID:', data.subscriptionId);
        return true;
      } else {
        console.log('   ❌ Failed to create checkout:', data.error);
        return false;
      }
    } catch (error) {
      console.log('   ❌ Request failed:', error.message);
      return false;
    }
  }

  // Test 2: Test webhook signature verification
  async testWebhookVerification() {
    console.log('\n🧪 Test 2: Testing webhook signature verification...');

    const webhookPayload = {
      id: 'evt_' + crypto.randomUUID(),
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_' + crypto.randomUUID(),
          amount: 2999, // $29.99
          currency: 'usd',
          status: 'succeeded',
          current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days from now
          metadata: {
            userId: MOCK_USER_DATA.uid,
            plan: 'premium'
          }
        }
      }
    };

    const body = JSON.stringify(webhookPayload);
    const signature = crypto.createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');

    try {
      const response = await fetch(`${BASE_URL}/api/webhooks/dodo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-dodo-signature': signature
        },
        body: body
      });

      const data = await response.json();
      console.log(`   Status: ${response.status}`);
      
      if (response.status === 200 && data.received) {
        console.log('   ✅ Webhook processed successfully');
        console.log('   📝 Response:', data);
        return true;
      } else {
        console.log('   ❌ Webhook failed:', data);
        return false;
      }
    } catch (error) {
      console.log('   ❌ Webhook test failed:', error.message);
      return false;
    }
  }

  // Test 3: Test invalid webhook signature
  async testInvalidWebhookSignature() {
    console.log('\n🧪 Test 3: Testing invalid webhook signature...');

    const webhookPayload = {
      id: 'evt_invalid',
      type: 'payment_intent.succeeded',
      data: { object: {} }
    };

    try {
      const response = await fetch(`${BASE_URL}/api/webhooks/dodo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-dodo-signature': 'invalid_signature'
        },
        body: JSON.stringify(webhookPayload)
      });

      console.log(`   Status: ${response.status}`);
      
      if (response.status === 401) {
        console.log('   ✅ Invalid signature correctly rejected');
        return true;
      } else {
        console.log('   ❌ Invalid signature was not rejected');
        return false;
      }
    } catch (error) {
      console.log('   ❌ Test failed:', error.message);
      return false;
    }
  }

  // Test 4: Test subscription events
  async testSubscriptionWebhooks() {
    console.log('\n🧪 Test 4: Testing subscription webhook events...');

    const subscriptionEvents = [
      {
        type: 'subscription.created',
        subscription: {
          id: 'sub_' + crypto.randomUUID(),
          customer: 'cus_' + crypto.randomUUID(),
          status: 'active',
          current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
          plan: { id: 'premium', nickname: 'premium' },
          metadata: { userId: MOCK_USER_DATA.uid, plan: 'premium' }
        }
      },
      {
        type: 'subscription.canceled',
        subscription: {
          id: 'sub_' + crypto.randomUUID(),
          customer: 'cus_' + crypto.randomUUID(),
          status: 'canceled',
          current_period_end: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days grace period
          plan: { id: 'premium', nickname: 'premium' },
          metadata: { userId: MOCK_USER_DATA.uid, plan: 'premium' }
        }
      }
    ];

    let allPassed = true;

    for (const eventData of subscriptionEvents) {
      console.log(`   Testing ${eventData.type}...`);

      const webhookPayload = {
        id: 'evt_' + crypto.randomUUID(),
        type: eventData.type,
        data: {
          object: eventData.subscription
        }
      };

      const body = JSON.stringify(webhookPayload);
      const signature = crypto.createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');

      try {
        const response = await fetch(`${BASE_URL}/api/webhooks/dodo`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-dodo-signature': signature
          },
          body: body
        });

        const data = await response.json();
        
        if (response.status === 200 && data.received) {
          console.log(`   ✅ ${eventData.type} processed successfully`);
        } else {
          console.log(`   ❌ ${eventData.type} failed:`, data);
          allPassed = false;
        }
      } catch (error) {
        console.log(`   ❌ ${eventData.type} test failed:`, error.message);
        allPassed = false;
      }

      // Wait between events
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return allPassed;
  }

  // Test 5: Test customer portal access
  async testCustomerPortal() {
    console.log('\n🧪 Test 5: Testing customer portal access...');

    try {
      const { response, data } = await this.makeRequest('/api/payments/portal-link', {
        method: 'GET'
      });

      console.log(`   Status: ${response.status}`);
      
      if (response.status === 401) {
        console.log('   ⚠️  Authentication required - this is expected without a session cookie');
        return false;
      }

      if (data.portalUrl) {
        console.log('   ✅ Portal URL created:', data.portalUrl);
        return true;
      } else {
        console.log('   ❌ Failed to create portal URL:', data.error);
        return false;
      }
    } catch (error) {
      console.log('   ❌ Portal test failed:', error.message);
      return false;
    }
  }

  // Test 6: Test quota enforcement after payment
  async testQuotaAfterPayment() {
    console.log('\n🧪 Test 6: Testing quota enforcement after payment...');
    
    console.log('   Setting NODE_ENV to production for quota testing...');
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      // Test interview generation endpoint
      const response = await fetch(`${BASE_URL}/api/vapi/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'technical',
          role: 'Software Engineer',
          level: 'Senior',
          techstack: 'React, Node.js',
          amount: 5
        })
      });

      console.log(`   Status: ${response.status}`);
      
      if (response.status === 401) {
        console.log('   ✅ Authentication required for quota-protected endpoint');
        return true;
      } else if (response.status === 402) {
        console.log('   ✅ Quota limit enforced (Payment Required)');
        const data = await response.json();
        console.log('   📝 Quota message:', data.upgradeMessage);
        return true;
      } else {
        console.log('   ⚠️  Unexpected response - quota may not be enforced');
        return false;
      }
    } catch (error) {
      console.log('   ❌ Quota test failed:', error.message);
      return false;
    } finally {
      // Restore original NODE_ENV
      process.env.NODE_ENV = originalEnv;
    }
  }

  // Run all tests
  async runAllTests() {
    console.log('🚀 Starting Payment Flow Tests');
    console.log('='*60);
    
    const results = {
      createCheckout: await this.testCreateCheckout(),
      webhookVerification: await this.testWebhookVerification(),
      invalidWebhook: await this.testInvalidWebhookSignature(),
      subscriptionWebhooks: await this.testSubscriptionWebhooks(),
      customerPortal: await this.testCustomerPortal(),
      quotaAfterPayment: await this.testQuotaAfterPayment()
    };

    console.log('\n📋 Test Results Summary:');
    console.log('='*40);
    
    const totalTests = Object.keys(results).length;
    const passedTests = Object.values(results).filter(Boolean).length;
    const failedTests = totalTests - passedTests;

    Object.entries(results).forEach(([test, passed]) => {
      const icon = passed ? '✅' : '❌';
      const status = passed ? 'PASSED' : 'FAILED';
      console.log(`${icon} ${test}: ${status}`);
    });

    console.log(`\n📊 Summary: ${passedTests}/${totalTests} tests passed`);
    
    if (failedTests > 0) {
      console.log(`\n⚠️  ${failedTests} tests failed. Check the following:`);
      console.log('- Ensure the server is running on the correct port');
      console.log('- Check environment variables (DODO_PAYMENTS_API_KEY, DODO_WEBHOOK_SECRET)');
      console.log('- Verify authentication system is properly configured');
      console.log('- Check Firebase/Firestore connection');
    }

    console.log('\n🔗 Next Steps:');
    console.log('1. For manual testing, use the checkout URLs generated above');
    console.log('2. Test the complete flow with actual Dodo Payments sandbox');
    console.log('3. Verify webhook endpoints are accessible from Dodo Payments');
    console.log('4. Test quota enforcement with real user sessions');

    return { passed: passedTests, failed: failedTests, total: totalTests };
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new PaymentFlowTester();
  tester.runAllTests().catch(console.error);
}

export default PaymentFlowTester;
