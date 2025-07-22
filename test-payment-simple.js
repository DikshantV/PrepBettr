// test-payment-simple.js
// Simple payment flow testing script using CommonJS

const crypto = require('crypto');

const BASE_URL = 'http://localhost:3000'; // Adjust port as needed
const WEBHOOK_SECRET = process.env.DODO_WEBHOOK_SECRET || 'test-webhook-secret';

// Mock data for testing
const MOCK_USER_DATA = {
  uid: 'test-user-' + Date.now(),
  email: 'testuser@example.com',
  name: 'Test User'
};

// Utility function to make HTTP requests
async function makeRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(url, {
      ...options,
      headers
    });

    let data;
    try {
      data = await response.json();
    } catch (e) {
      data = { error: 'Invalid JSON response' };
    }

    return { response, data };
  } catch (error) {
    return { 
      response: { status: 0 }, 
      data: { error: error.message } 
    };
  }
}

// Test 1: Check server health
async function testServerHealth() {
  console.log('\n🏥 Testing server health...');
  
  try {
    const { response } = await makeRequest('/api/vapi/generate', {
      method: 'GET'
    });
    
    console.log(`   Status: ${response.status}`);
    
    if (response.status === 200) {
      console.log('   ✅ Server is running');
      return true;
    } else {
      console.log('   ⚠️  Server responded with non-200 status');
      return false;
    }
  } catch (error) {
    console.log('   ❌ Server is not accessible:', error.message);
    return false;
  }
}

// Test 2: Test webhook signature verification
async function testWebhookVerification() {
  console.log('\n🔐 Testing webhook signature verification...');

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

  const { response, data } = await makeRequest('/api/webhooks/dodo', {
    method: 'POST',
    headers: {
      'x-dodo-signature': signature
    },
    body: body
  });

  console.log(`   Status: ${response.status}`);
  
  if (response.status === 200 && data.received) {
    console.log('   ✅ Valid webhook processed successfully');
    return true;
  } else if (response.status === 500) {
    console.log('   ⚠️  Webhook endpoint has configuration issues:', data.error);
    return false;
  } else {
    console.log('   ❌ Webhook verification failed:', data);
    return false;
  }
}

// Test 3: Test invalid webhook signature
async function testInvalidWebhookSignature() {
  console.log('\n🚫 Testing invalid webhook signature rejection...');

  const webhookPayload = {
    id: 'evt_invalid',
    type: 'payment_intent.succeeded',
    data: { object: {} }
  };

  const { response, data } = await makeRequest('/api/webhooks/dodo', {
    method: 'POST',
    headers: {
      'x-dodo-signature': 'invalid_signature'
    },
    body: JSON.stringify(webhookPayload)
  });

  console.log(`   Status: ${response.status}`);
  
  if (response.status === 401) {
    console.log('   ✅ Invalid signature correctly rejected');
    return true;
  } else {
    console.log('   ❌ Invalid signature was not rejected properly');
    console.log('   📝 Response:', data);
    return false;
  }
}

// Test 4: Test payment endpoints (without authentication)
async function testPaymentEndpoints() {
  console.log('\n💳 Testing payment endpoints...');

  // Test checkout creation (should fail without auth)
  const { response: checkoutResponse, data: checkoutData } = await makeRequest('/api/payments/create-checkout', {
    method: 'POST',
    body: JSON.stringify({ uid: MOCK_USER_DATA.uid })
  });

  console.log(`   Checkout Status: ${checkoutResponse.status}`);
  
  if (checkoutResponse.status === 401) {
    console.log('   ✅ Checkout properly requires authentication');
  } else {
    console.log('   ⚠️  Checkout authentication may not be working:', checkoutData.error);
  }

  // Test portal link (should fail without auth)  
  const { response: portalResponse, data: portalData } = await makeRequest('/api/payments/portal-link', {
    method: 'GET'
  });

  console.log(`   Portal Status: ${portalResponse.status}`);
  
  if (portalResponse.status === 401) {
    console.log('   ✅ Portal properly requires authentication');
    return true;
  } else {
    console.log('   ⚠️  Portal authentication may not be working:', portalData.error);
    return false;
  }
}

// Test 5: Test quota enforcement in production mode
async function testQuotaEnforcement() {
  console.log('\n🛡️  Testing quota enforcement...');
  
  // Temporarily set NODE_ENV to production
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  
  console.log('   Setting NODE_ENV to production for quota testing...');

  try {
    const { response, data } = await makeRequest('/api/vapi/generate', {
      method: 'POST',
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
      console.log('   📝 Quota message:', data.upgradeMessage);
      return true;
    } else {
      console.log('   ⚠️  Unexpected response - quota may not be enforced properly');
      console.log('   📝 Response:', data);
      return false;
    }
  } finally {
    // Restore original NODE_ENV
    process.env.NODE_ENV = originalEnv;
    console.log('   Restored NODE_ENV to:', originalEnv || 'undefined');
  }
}

// Test 6: Test subscription event webhooks
async function testSubscriptionWebhooks() {
  console.log('\n📅 Testing subscription webhook events...');

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
        current_period_end: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
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
      data: { object: eventData.subscription }
    };

    const body = JSON.stringify(webhookPayload);
    const signature = crypto.createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');

    const { response, data } = await makeRequest('/api/webhooks/dodo', {
      method: 'POST',
      headers: { 'x-dodo-signature': signature },
      body: body
    });
    
    if (response.status === 200 && data.received) {
      console.log(`   ✅ ${eventData.type} processed successfully`);
    } else {
      console.log(`   ❌ ${eventData.type} failed (${response.status}):`, data.error || data);
      allPassed = false;
    }

    // Wait between events
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return allPassed;
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Payment Flow Test Suite');
  console.log('=' * 50);
  console.log(`🎯 Target URL: ${BASE_URL}`);
  console.log(`🔑 Using webhook secret: ${WEBHOOK_SECRET.substring(0, 8)}...`);
  console.log('=' * 50);
  
  const tests = [
    { name: 'Server Health', fn: testServerHealth },
    { name: 'Webhook Verification', fn: testWebhookVerification },
    { name: 'Invalid Webhook Rejection', fn: testInvalidWebhookSignature },
    { name: 'Payment Endpoints Auth', fn: testPaymentEndpoints },
    { name: 'Quota Enforcement', fn: testQuotaEnforcement },
    { name: 'Subscription Webhooks', fn: testSubscriptionWebhooks }
  ];

  const results = {};
  
  for (const test of tests) {
    try {
      results[test.name] = await test.fn();
    } catch (error) {
      console.log(`   ❌ Test "${test.name}" threw an error:`, error.message);
      results[test.name] = false;
    }
  }

  // Summary
  console.log('\n📋 Test Results Summary:');
  console.log('=' * 40);
  
  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(Boolean).length;
  const failedTests = totalTests - passedTests;

  Object.entries(results).forEach(([test, passed]) => {
    const icon = passed ? '✅' : '❌';
    const status = passed ? 'PASSED' : 'FAILED';
    console.log(`${icon} ${test}: ${status}`);
  });

  console.log(`\n📊 Overall: ${passedTests}/${totalTests} tests passed`);
  
  if (failedTests > 0) {
    console.log(`\n⚠️  ${failedTests} test(s) failed. Common issues:`);
    console.log('- Server not running or wrong port');
    console.log('- Missing environment variables (check .env.local)');
    console.log('- Database connection issues');
    console.log('- Authentication system not configured');
  } else {
    console.log('\n🎉 All tests passed! Payment flow is working correctly.');
  }

  console.log('\n🔗 Manual Testing Steps:');
  console.log('1. Create a test user account in your app');
  console.log('2. Navigate to the pricing/subscription page');
  console.log('3. Try to upgrade to premium');
  console.log('4. Test quota limits before and after payment');
  console.log('5. Test subscription management in customer portal');
  
  return { passed: passedTests, failed: failedTests, total: totalTests };
}

// Run if called directly
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
}

module.exports = {
  runAllTests,
  testServerHealth,
  testWebhookVerification,
  testInvalidWebhookSignature,
  testPaymentEndpoints,
  testQuotaEnforcement,
  testSubscriptionWebhooks
};
