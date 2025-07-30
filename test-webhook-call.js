const crypto = require('crypto');
const fetch = require('node-fetch');

// Your webhook details
const WEBHOOK_URL = 'https://www.prepbettr.com/api/vapi/webhook';
const WEBHOOK_SECRET = '5bb0210b0eb58895fc76c7a06746336a84960769a0b1dba36eacda39b1311767';

// Test payload simulating VAPI function call
const testPayload = {
  message: {
    type: 'function-call',
    functionCall: {
      name: 'generate_interview_questions',
      parameters: {
        role: 'Software Engineer',
        interview_type: 'Technical',
        experience_level: 'Mid-level',
        question_count: 3,
        technologies: 'JavaScript, React, Node.js'
      }
    }
  }
};

function generateSignature(payload, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');
}

async function testWebhook() {
  const payloadString = JSON.stringify(testPayload);
  const signature = generateSignature(payloadString, WEBHOOK_SECRET);
  
  console.log('Testing webhook with payload:', JSON.stringify(testPayload, null, 2));
  console.log('Generated signature:', signature);
  
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-vapi-signature': signature
      },
      body: payloadString
    });
    
    const result = await response.text();
    console.log('Response status:', response.status);
    console.log('Response body:', result);
    
    if (response.ok) {
      try {
        const jsonResult = JSON.parse(result);
        console.log('Parsed response:', JSON.stringify(jsonResult, null, 2));
      } catch (e) {
        console.log('Response is not JSON');
      }
    }
    
  } catch (error) {
    console.error('Error testing webhook:', error);
  }
}

testWebhook();
