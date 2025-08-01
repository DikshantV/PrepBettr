const crypto = require('crypto');

// Configuration
const webhookUrl = 'http://localhost:3000/api/vapi/webhook';
const secret = 'c4f377abcdf1aa99ea162c340fd6cdabc2c13eac7a2e3f7abb4f63b404c9fea0';

// Test payload
const payload = JSON.stringify({
  message: {
    type: 'function-call',
    functionCall: {
      name: 'generate_interview_questions',
      parameters: {
        role: 'Software Engineer',
        interview_type: 'technical',
        experience_level: 'mid',
        question_count: 5,
        technologies: ['JavaScript', 'React', 'Node.js']
      }
    }
  }
});

const timestamp = Math.floor(Date.now() / 1000).toString();
const messageId = 'msg_test_' + Date.now();

// Generate HMAC signature
function generateSignature(payload, timestamp, secret, messageId) {
  const messageToSign = timestamp + payload + messageId;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(messageToSign, 'utf8')
    .digest('hex');
  return `sha256=${signature}`;
}

const signature = generateSignature(payload, timestamp, secret, messageId);

console.log('🚀 Testing VAPI Webhook with HMAC Authentication\n');
console.log('📝 Request Details:');
console.log(`URL: ${webhookUrl}`);
console.log(`Timestamp: ${timestamp}`);
console.log(`Message ID: ${messageId}`);
console.log(`Signature: ${signature}`);
console.log('');

// Generate curl command
const curlCommand = `curl -X POST "${webhookUrl}" \\
  -H "Content-Type: application/json" \\
  -H "X-VAPI-Signature: ${signature}" \\
  -H "X-VAPI-Timestamp: ${timestamp}" \\
  -H "X-VAPI-Message-ID: ${messageId}" \\
  -d '${payload}'`;

console.log('💻 Curl Command:');
console.log(curlCommand);
console.log('');

console.log('🔧 To test manually, run the curl command above or start your Next.js server:');
console.log('npm run dev');
console.log('');

// Also create a test with invalid signature
const invalidSignature = 'sha256=invalid_signature_123';
const invalidCurlCommand = `curl -X POST "${webhookUrl}" \\
  -H "Content-Type: application/json" \\
  -H "X-VAPI-Signature: ${invalidSignature}" \\
  -H "X-VAPI-Timestamp: ${timestamp}" \\
  -H "X-VAPI-Message-ID: ${messageId}" \\
  -d '${payload}'`;

console.log('❌ Test with Invalid Signature:');
console.log(invalidCurlCommand);
