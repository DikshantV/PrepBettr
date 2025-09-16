#!/usr/bin/env node
/**
 * Simple signup test script
 * Tests both success and duplicate email scenarios
 */

const BASE_URL = 'http://localhost:3000';

async function testSignup(email, password, name, expectError = false) {
  try {
    const response = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, name }),
    });

    const data = await response.json();
    
    console.log(`\n📧 Testing: ${email}`);
    console.log(`🎯 Expected: ${expectError ? 'Error' : 'Success'}`);
    console.log(`📊 Status: ${response.status}`);
    console.log(`📝 Response:`, JSON.stringify(data, null, 2));
    
    if (expectError) {
      if (!response.ok) {
        console.log(`✅ Error case handled correctly!`);
        return true;
      } else {
        console.log(`❌ Expected error but got success`);
        return false;
      }
    } else {
      if (response.ok) {
        console.log(`✅ Success case handled correctly!`);
        return true;
      } else {
        console.log(`❌ Expected success but got error`);
        return false;
      }
    }
  } catch (error) {
    console.log(`❌ Request failed:`, error.message);
    return false;
  }
}

async function runTests() {
  console.log('🧪 Running PrepBettr Signup Tests');
  console.log('==================================');
  
  // Generate unique email for new user test
  const uniqueEmail = `testuser${Date.now()}@example.com`;
  
  const results = [];
  
  // Test 1: New user signup (should succeed)
  results.push(await testSignup(uniqueEmail, 'password123', 'Test User', false));
  
  // Test 2: Duplicate email signup (should fail with proper error)
  results.push(await testSignup(uniqueEmail, 'password123', 'Test User', true));
  
  // Test 3: Invalid email (should fail)
  results.push(await testSignup('invalid-email', 'password123', 'Test User', true));
  
  console.log('\n📋 Test Results Summary:');
  console.log('========================');
  const passed = results.filter(r => r).length;
  const total = results.length;
  console.log(`✅ Passed: ${passed}/${total}`);
  console.log(`❌ Failed: ${total - passed}/${total}`);
  
  if (passed === total) {
    console.log('🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('💥 Some tests failed!');
    process.exit(1);
  }
}

// Check if server is running
async function checkServerHealth() {
  try {
    const response = await fetch(`${BASE_URL}/api/health/auth`);
    if (response.ok) {
      console.log('✅ Auth service is healthy');
      return true;
    } else {
      console.log('❌ Auth service health check failed');
      return false;
    }
  } catch (error) {
    console.log('❌ Cannot connect to server. Is it running on port 3000?');
    return false;
  }
}

// Main execution
async function main() {
  console.log('🏥 Checking server health...');
  const isHealthy = await checkServerHealth();
  
  if (!isHealthy) {
    console.log('\n💡 Start the server with: npm run dev');
    process.exit(1);
  }
  
  console.log(''); // Empty line for readability
  await runTests();
}

main().catch(console.error);