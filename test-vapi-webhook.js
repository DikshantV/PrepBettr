const crypto = require('crypto');
const { config } = require('dotenv');

config({ path: '.env.local' });

// Test payload that simulates what VAPI would send
const testPayload = {
  message: {
    type: 'function-call',
    functionCall: {
      name: 'generate_interview_questions',
      parameters: {
        role: 'Software Engineer',
        interview_type: 'technical',
        experience_level: 'mid-level',
        question_count: 5,
        technologies: 'JavaScript,React,Node.js'
      }
    }
  }
};

// Create signature like VAPI would
const secret = process.env.VAPI_WEBHOOK_SECRET;
const body = JSON.stringify(testPayload);
const timestamp = Math.floor(Date.now() / 1000).toString(); // Current timestamp in seconds
const messageToSign = timestamp + body; // VAPI signature format: timestamp + payload
const signature = crypto.createHmac('sha256', secret).update(messageToSign, 'utf8').digest('hex');

console.log('Test payload:', JSON.stringify(testPayload, null, 2));
console.log('Expected signature:', signature);
console.log('Webhook secret configured:', !!secret);

// Test the webhook locally
async function testWebhook() {
  const url = 'http://localhost:3000/api/vapi/webhook';
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-vapi-signature': signature,
        'x-vapi-timestamp': timestamp
      },
      body: body
    });
    
    const result = await response.text();
    console.log('Response status:', response.status);
    console.log('Response:', result);
  } catch (error) {
    console.error('Error testing webhook:', error.message);
  }
}

testWebhook();
