// test-webhook-signature.js
// Tool to test webhook signature generation and verification

const crypto = require('crypto');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function generateWebhookSignature(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

async function testWebhookSignature() {
  console.log('🔐 Webhook Signature Test Tool\n');
  
  return new Promise((resolve) => {
    rl.question('Enter your Dodo webhook secret: ', (secret) => {
      if (!secret || secret === 'your_webhook_secret') {
        console.log('❌ Please enter a valid webhook secret from your Dodo Payments dashboard');
        rl.close();
        resolve();
        return;
      }

      console.log('\n📝 Testing with webhook secret:', secret.substring(0, 8) + '...');
      
      // Sample webhook payload
      const testPayload = {
        id: 'evt_test_' + Date.now(),
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test_' + Date.now(),
            amount: 2999, // $29.99
            currency: 'usd',
            status: 'succeeded',
            current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
            metadata: {
              userId: 'test_user_123',
              plan: 'premium'
            }
          }
        }
      };

      const payloadString = JSON.stringify(testPayload);
      const signature = generateWebhookSignature(payloadString, secret);

      console.log('\n✅ Generated test webhook data:');
      console.log('Payload:', payloadString);
      console.log('Signature:', signature);
      
      console.log('\n🧪 Testing webhook endpoint...');
      
      // Test the webhook endpoint
      testWebhookEndpoint(payloadString, signature).then(() => {
        console.log('\n💡 To update your .env.local file:');
        console.log(`DODO_WEBHOOK_SECRET="${secret}"`);
        
        rl.close();
        resolve();
      });
    });
  });
}

async function testWebhookEndpoint(payload, signature) {
  try {
    const fetch = (await import('node-fetch')).default;
    
    const response = await fetch('http://localhost:3002/api/webhooks/dodo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-dodo-signature': signature
      },
      body: payload
    });

    const data = await response.json();
    
    console.log(`Status: ${response.status}`);
    
    if (response.status === 200 && data.received) {
      console.log('✅ Webhook test successful!');
      console.log('Response:', data);
    } else if (response.status === 401) {
      console.log('❌ Webhook signature verification failed');
      console.log('This might mean:');
      console.log('- The webhook secret is incorrect');
      console.log('- The signature generation algorithm doesn\'t match');
    } else if (response.status === 500) {
      console.log('⚠️  Server configuration issue:', data.error);
      console.log('Make sure DODO_WEBHOOK_SECRET is set in .env.local');
    } else {
      console.log('⚠️  Unexpected response:', data);
    }
    
  } catch (error) {
    console.log('❌ Failed to test webhook endpoint:', error.message);
    console.log('Make sure your server is running on port 3002');
  }
}

// Command line usage
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    await testWebhookSignature();
  } else if (args.length >= 1) {
    const secret = args[0];
    console.log('🔐 Testing with provided webhook secret...');
    
    const testPayload = {
      id: 'evt_cli_test_' + Date.now(),
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_cli_test_' + Date.now(),
          amount: 2999,
          currency: 'usd',
          status: 'succeeded',
          metadata: {
            userId: 'cli_test_user',
            plan: 'premium'
          }
        }
      }
    };

    const payloadString = JSON.stringify(testPayload);
    const signature = generateWebhookSignature(payloadString, secret);
    
    console.log('Generated signature:', signature);
    await testWebhookEndpoint(payloadString, signature);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  generateWebhookSignature,
  testWebhookEndpoint
};
