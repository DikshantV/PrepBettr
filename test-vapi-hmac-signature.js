const crypto = require('crypto');

// Test HMAC signature generation and verification
function generateHMACSignature(payload, timestamp, secret, messageId = null) {
  let messageToSign = timestamp + payload;
  if (messageId) {
    messageToSign += messageId;
  }
  
  const signature = crypto
    .createHmac('sha256', secret)
    .update(messageToSign, 'utf8')
    .digest('hex');
    
  return `sha256=${signature}`;
}

function verifySignature(payload, signature, timestamp, secret, messageId = null) {
  try {
    const cleanSignature = signature.replace(/^sha256=/, '');
    
    let messageToSign = timestamp + payload;
    if (messageId) {
      messageToSign += messageId;
    }
    
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(messageToSign, 'utf8')
      .digest('hex');
    
    // Check if signatures have the same length before comparing
    if (cleanSignature.length !== expectedSignature.length) {
      return false;
    }
    
    return crypto.timingSafeEqual(
      Buffer.from(cleanSignature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    console.error('Signature verification error:', error.message);
    return false;
  }
}

// Test configuration
const testSecret = 'c4f377abcdf1aa99ea162c340fd6cdabc2c13eac7a2e3f7abb4f63b404c9fea0';
const testPayload = JSON.stringify({
  message: {
    type: 'function-call',
    functionCall: {
      name: 'generate_interview_questions',
      parameters: {
        role: 'Software Engineer',
        interview_type: 'technical',
        experience_level: 'mid',
        question_count: 5
      }
    }
  }
});
const testTimestamp = Math.floor(Date.now() / 1000).toString();
const testMessageId = 'msg_12345';

console.log('🧪 Testing VAPI HMAC Signature Verification\n');

// Test 1: Basic signature generation and verification
console.log('Test 1: Basic signature (without message ID)');
const signature1 = generateHMACSignature(testPayload, testTimestamp, testSecret);
const isValid1 = verifySignature(testPayload, signature1, testTimestamp, testSecret);
console.log(`✅ Generated signature: ${signature1}`);
console.log(`✅ Verification result: ${isValid1 ? 'VALID' : 'INVALID'}\n`);

// Test 2: Signature with message ID
console.log('Test 2: Signature with message ID');
const signature2 = generateHMACSignature(testPayload, testTimestamp, testSecret, testMessageId);
const isValid2 = verifySignature(testPayload, signature2, testTimestamp, testSecret, testMessageId);
console.log(`✅ Generated signature: ${signature2}`);
console.log(`✅ Verification result: ${isValid2 ? 'VALID' : 'INVALID'}\n`);

// Test 3: Invalid signature
console.log('Test 3: Invalid signature verification');
const invalidSignature = 'sha256=invalid_signature_here';
const isValid3 = verifySignature(testPayload, invalidSignature, testTimestamp, testSecret);
console.log(`❌ Invalid signature verification: ${isValid3 ? 'VALID' : 'INVALID'}\n`);

// Test 4: Timestamp validation
console.log('Test 4: Timestamp validation');
const oldTimestamp = (Math.floor(Date.now() / 1000) - 400).toString(); // 400 seconds ago
const signatureOld = generateHMACSignature(testPayload, oldTimestamp, testSecret);
console.log(`⏰ Old timestamp: ${oldTimestamp}`);
console.log(`⏰ Current timestamp: ${Math.floor(Date.now() / 1000)}`);
console.log(`⏰ Difference: ${Math.floor(Date.now() / 1000) - parseInt(oldTimestamp)} seconds\n`);

// Simulate webhook request
console.log('🔍 Simulated webhook request headers:');
console.log(`X-VAPI-Signature: ${signature1}`);
console.log(`X-VAPI-Timestamp: ${testTimestamp}`);
console.log(`X-VAPI-Message-ID: ${testMessageId}`);
console.log(`Content-Type: application/json\n`);

console.log('📝 Test payload:');
console.log(testPayload);
