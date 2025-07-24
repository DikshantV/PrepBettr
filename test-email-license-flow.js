#!/usr/bin/env node

// test-email-license-flow.js
// Simple test script for email verification and license key flow

const BASE_URL = 'http://localhost:3000';
const TEST_USER_ID = 'test-user-' + Date.now();
const TEST_EMAIL = 'test@example.com';

async function makeRequest(action, additionalData = {}) {
  const url = `${BASE_URL}/api/test/email-license-flow`;
  
  const requestData = {
    action,
    userId: TEST_USER_ID,
    email: TEST_EMAIL,
    ...additionalData
  };

  console.log(`\n🔄 ${action.toUpperCase()}`);
  console.log('Request:', JSON.stringify(requestData, null, 2));

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData)
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Success:', JSON.stringify(result, null, 2));
      return result;
    } else {
      console.log('❌ Error:', JSON.stringify(result, null, 2));
      return null;
    }
  } catch (error) {
    console.log('💥 Network Error:', error.message);
    return null;
  }
}

async function runTest(testName) {
  console.log(`\n🚀 Running ${testName} Test`);
  console.log(`👤 Test User: ${TEST_USER_ID}`);
  console.log(`📧 Test Email: ${TEST_EMAIL}`);
  console.log('='.repeat(50));

  switch (testName) {
    case 'full':
      return await makeRequest('full_flow_test');
      
    case 'step-by-step':
      // Step by step testing
      let result;
      
      result = await makeRequest('setup_test_user');
      if (!result) return;
      
      result = await makeRequest('send_verification');
      if (!result) return;
      
      result = await makeRequest('verify_email');
      if (!result) return;
      
      result = await makeRequest('create_license_key');
      if (!result) return;
      
      const licenseKey = result?.data?.licenseKey;
      if (!licenseKey) {
        console.log('❌ No license key returned');
        return;
      }
      
      result = await makeRequest('activate_license', { licenseKey });
      if (!result) return;
      
      result = await makeRequest('check_status');
      if (!result) return;
      
      console.log('\n✅ Step-by-step test completed!');
      break;
      
    case 'check':
      await makeRequest('check_status');
      break;
      
    case 'cleanup':
      await makeRequest('cleanup');
      break;
      
    default:
      console.log('❌ Unknown test type. Available: full, step-by-step, check, cleanup');
  }
}

// Get command line arguments
const args = process.argv.slice(2);
const testType = args[0] || 'full';

// Check if server is running
fetch(`${BASE_URL}/api/test/email-license-flow`)
  .then(response => response.json())
  .then(() => {
    console.log('✅ Server is running');
    return runTest(testType);
  })
  .catch(error => {
    console.log('❌ Server is not running or not accessible');
    console.log('Please make sure your Next.js server is running with: npm run dev');
    console.log('Error:', error.message);
  });

console.log(`
📖 Usage:
  node test-email-license-flow.js [test-type]

Test types:
  full         - Run complete flow test (default)
  step-by-step - Run step by step with individual API calls
  check        - Check current user status
  cleanup      - Clean up test data

Examples:
  node test-email-license-flow.js full
  node test-email-license-flow.js step-by-step
  node test-email-license-flow.js cleanup
`);
