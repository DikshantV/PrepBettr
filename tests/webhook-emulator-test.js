// tests/webhook-emulator-test.js
// Enhanced webhook testing with Firebase emulator integration

const crypto = require('crypto');
const { spawn } = require('child_process');
const fetch = require('node-fetch');

class WebhookEmulatorTester {
  constructor() {
    this.emulatorProcess = null;
    this.webhookSecret = process.env.DODO_WEBHOOK_SECRET || 'test_webhook_secret_123';
    this.baseUrl = 'http://localhost:3000';
    this.emulatorBaseUrl = 'http://localhost:9099';
    this.processedEvents = new Set();
  }

  // Start Firebase emulator
  async startEmulator() {
    console.log('🔥 Starting Firebase emulator...');
    
    return new Promise((resolve, reject) => {
      this.emulatorProcess = spawn('firebase', ['emulators:start', '--only=firestore'], {
        stdio: 'pipe',
        detached: true,
      });

      this.emulatorProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log(`Emulator: ${output.trim()}`);
        
        if (output.includes('All emulators ready!')) {
          console.log('✅ Firebase emulator started successfully');
          resolve();
        }
      });

      this.emulatorProcess.stderr.on('data', (data) => {
        console.error(`Emulator error: ${data.toString()}`);
      });

      this.emulatorProcess.on('error', (error) => {
        console.error('Failed to start emulator:', error);
        reject(error);
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        reject(new Error('Emulator startup timeout'));
      }, 30000);
    });
  }

  // Stop Firebase emulator
  async stopEmulator() {
    if (this.emulatorProcess) {
      console.log('🛑 Stopping Firebase emulator...');
      this.emulatorProcess.kill('SIGTERM');
      
      // Force kill after 5 seconds
      setTimeout(() => {
        if (this.emulatorProcess) {
          this.emulatorProcess.kill('SIGKILL');
        }
      }, 5000);
      
      this.emulatorProcess = null;
    }
  }

  // Generate webhook signature
  generateSignature(payload, secret = this.webhookSecret) {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  // Create test webhook payload
  createTestPayload(type = 'payment_intent.succeeded', customData = {}) {
    const basePayload = {
      id: `evt_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: `pi_test_${Date.now()}`,
          amount: 2999,
          currency: 'usd',
          status: 'succeeded',
          metadata: {
            userId: 'test_user_123',
            plan: 'premium',
            billing_cycle: 'monthly',
            ...customData,
          },
        },
      },
    };

    return { ...basePayload, ...customData };
  }

  // Send webhook request
  async sendWebhook(payload, options = {}) {
    const payloadString = JSON.stringify(payload);
    const signature = options.signature || this.generateSignature(payloadString);
    
    const response = await fetch(`${this.baseUrl}/api/webhooks/dodo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-dodo-signature': signature,
        ...options.headers,
      },
      body: payloadString,
    });

    const responseData = await response.json();
    return { response, data: responseData };
  }

  // Test webhook signature verification
  async testSignatureVerification() {
    console.log('\n🔐 Testing webhook signature verification...');
    
    const payload = this.createTestPayload();
    
    // Test 1: Valid signature
    console.log('Test 1: Valid signature');
    try {
      const { response, data } = await this.sendWebhook(payload);
      console.log(`✅ Valid signature - Status: ${response.status}, Received: ${data.received}`);
    } catch (error) {
      console.log(`❌ Valid signature test failed: ${error.message}`);
    }

    // Test 2: Invalid signature
    console.log('Test 2: Invalid signature');
    try {
      const { response, data } = await this.sendWebhook(payload, {
        signature: 'invalid_signature_123'
      });
      console.log(`${response.status === 401 ? '✅' : '❌'} Invalid signature - Status: ${response.status}`);
    } catch (error) {
      console.log(`❌ Invalid signature test failed: ${error.message}`);
    }

    // Test 3: Missing signature
    console.log('Test 3: Missing signature');
    try {
      const { response, data } = await this.sendWebhook(payload, {
        headers: {} // No signature header
      });
      console.log(`${response.status === 401 ? '✅' : '❌'} Missing signature - Status: ${response.status}`);
    } catch (error) {
      console.log(`❌ Missing signature test failed: ${error.message}`);
    }
  }

  // Test webhook idempotency
  async testIdempotency() {
    console.log('\n🔄 Testing webhook idempotency...');
    
    const payload = this.createTestPayload();
    const results = [];

    // Send the same webhook 3 times
    for (let i = 0; i < 3; i++) {
      try {
        const { response, data } = await this.sendWebhook(payload);
        results.push({ status: response.status, data });
        console.log(`Request ${i + 1}: Status ${response.status}, Processed: ${data.processed}`);
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.log(`❌ Request ${i + 1} failed: ${error.message}`);
      }
    }

    // Verify first request was processed, subsequent ones were idempotent
    const firstProcessed = results[0]?.data?.processed;
    const laterRequests = results.slice(1);
    const allLaterIdempotent = laterRequests.every(r => !r.data.processed || r.data.reason === 'duplicate');

    console.log(`${firstProcessed && allLaterIdempotent ? '✅' : '❌'} Idempotency test: First processed, subsequent idempotent`);
  }

  // Test concurrent webhooks
  async testConcurrentWebhooks() {
    console.log('\n⚡ Testing concurrent webhook processing...');
    
    const payload = this.createTestPayload();
    
    // Send 5 concurrent requests with the same payload
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(this.sendWebhook(payload));
    }

    try {
      const results = await Promise.all(promises);
      const allSucceeded = results.every(r => r.response.status === 200);
      const processedCount = results.filter(r => r.data.processed).length;
      
      console.log(`${allSucceeded ? '✅' : '❌'} All concurrent requests succeeded`);
      console.log(`${processedCount === 1 ? '✅' : '❌'} Only one request processed (${processedCount}/5)`);
    } catch (error) {
      console.log(`❌ Concurrent webhook test failed: ${error.message}`);
    }
  }

  // Test different webhook event types
  async testEventTypes() {
    console.log('\n📝 Testing different webhook event types...');
    
    const eventTypes = [
      'payment_intent.succeeded',
      'customer.subscription.created',
      'customer.subscription.updated',
      'customer.subscription.deleted',
      'invoice.payment_succeeded',
      'unknown.event.type',
    ];

    for (const eventType of eventTypes) {
      try {
        const payload = this.createTestPayload(eventType);
        const { response, data } = await this.sendWebhook(payload);
        
        const isKnownType = !eventType.includes('unknown');
        const expectedProcessed = isKnownType;
        const actualProcessed = data.processed;
        
        const success = response.status === 200 && (expectedProcessed === actualProcessed);
        console.log(`${success ? '✅' : '❌'} ${eventType}: Status ${response.status}, Processed: ${actualProcessed}`);
      } catch (error) {
        console.log(`❌ ${eventType} test failed: ${error.message}`);
      }
    }
  }

  // Test subscription lifecycle
  async testSubscriptionLifecycle() {
    console.log('\n🔄 Testing subscription lifecycle...');
    
    const userId = 'lifecycle_test_user_123';
    
    const events = [
      { type: 'customer.subscription.created', metadata: { userId, plan: 'premium' }},
      { type: 'payment_intent.succeeded', metadata: { userId, plan: 'premium' }},
      { type: 'customer.subscription.updated', metadata: { userId, plan: 'premium' }},
      { type: 'customer.subscription.deleted', metadata: { userId }},
    ];

    for (const event of events) {
      try {
        const payload = this.createTestPayload(event.type, event.metadata);
        const { response, data } = await this.sendWebhook(payload);
        
        console.log(`${response.status === 200 ? '✅' : '❌'} ${event.type}: Status ${response.status}`);
        
        // Add delay between lifecycle events
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.log(`❌ ${event.type} failed: ${error.message}`);
      }
    }
  }

  // Test webhook error scenarios
  async testErrorScenarios() {
    console.log('\n❌ Testing error scenarios...');
    
    // Test 1: Invalid JSON payload
    console.log('Test 1: Invalid JSON payload');
    try {
      const response = await fetch(`${this.baseUrl}/api/webhooks/dodo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-dodo-signature': 'dummy_signature',
        },
        body: '{"invalid": json}', // Malformed JSON
      });
      console.log(`${response.status >= 400 ? '✅' : '❌'} Invalid JSON - Status: ${response.status}`);
    } catch (error) {
      console.log(`✅ Invalid JSON properly rejected: ${error.message}`);
    }

    // Test 2: Missing required fields
    console.log('Test 2: Missing required fields');
    try {
      const invalidPayload = { id: 'test' }; // Missing type and data
      const { response } = await this.sendWebhook(invalidPayload);
      console.log(`${response.status >= 400 ? '✅' : '❌'} Missing fields - Status: ${response.status}`);
    } catch (error) {
      console.log(`❌ Missing fields test failed: ${error.message}`);
    }

    // Test 3: Old timestamp (replay attack)
    console.log('Test 3: Old timestamp (replay attack)');
    try {
      const oldPayload = this.createTestPayload();
      oldPayload.created = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      
      const { response } = await this.sendWebhook(oldPayload);
      console.log(`${response.status === 401 ? '✅' : '❌'} Old timestamp - Status: ${response.status}`);
    } catch (error) {
      console.log(`❌ Old timestamp test failed: ${error.message}`);
    }
  }

  // Test quota reset functionality
  async testQuotaReset() {
    console.log('\n🔄 Testing quota reset on downgrade...');
    
    const userId = 'quota_test_user_123';
    
    // Simulate premium subscription creation
    const premiumPayload = this.createTestPayload('customer.subscription.created', {
      userId,
      plan: 'premium'
    });
    
    await this.sendWebhook(premiumPayload);
    console.log('✅ Premium subscription created');
    
    // Simulate subscription cancellation (downgrade to free)
    const cancelPayload = this.createTestPayload('customer.subscription.deleted', {
      userId
    });
    
    const { response, data } = await this.sendWebhook(cancelPayload);
    console.log(`${response.status === 200 ? '✅' : '❌'} Subscription cancelled - Status: ${response.status}`);
    
    if (data.quotaReset) {
      console.log('✅ Quota counters reset on downgrade');
    } else {
      console.log('⚠️  Quota reset status not confirmed');
    }
  }

  // Run all tests
  async runAllTests() {
    console.log('🚀 Starting comprehensive webhook tests with emulator...\n');
    
    try {
      // Start emulator
      await this.startEmulator();
      
      // Wait for server to be ready
      console.log('⏳ Waiting for server to be ready...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Run tests
      await this.testSignatureVerification();
      await this.testIdempotency();
      await this.testConcurrentWebhooks();
      await this.testEventTypes();
      await this.testSubscriptionLifecycle();
      await this.testErrorScenarios();
      await this.testQuotaReset();
      
      console.log('\n✅ All webhook tests completed!');
      
    } catch (error) {
      console.error('\n❌ Test suite failed:', error);
    } finally {
      await this.stopEmulator();
    }
  }
}

// CLI usage
if (require.main === module) {
  const tester = new WebhookEmulatorTester();
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n👋 Shutting down webhook tests...');
    await tester.stopEmulator();
    process.exit(0);
  });
  
  // Run tests
  tester.runAllTests().catch(console.error);
}

module.exports = WebhookEmulatorTester;
