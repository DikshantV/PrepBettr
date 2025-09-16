#!/usr/bin/env node
/**
 * Comprehensive Authentication Test Suite
 * Tests both email/password and Google auth flows with error scenarios
 */

const BASE_URL = 'http://localhost:3000';

// Console colors for better output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testHealthCheck() {
  try {
    const response = await fetch(`${BASE_URL}/api/health/auth`);
    const data = await response.json();
    
    if (response.ok && data.status === 'healthy') {
      log('✅ Auth system health check passed', 'green');
      return true;
    } else {
      log('❌ Auth system health check failed', 'red');
      console.log('Response:', data);
      return false;
    }
  } catch (error) {
    log('❌ Cannot connect to auth health endpoint', 'red');
    console.log('Error:', error.message);
    return false;
  }
}

async function testEmailPasswordSignup(email, password, name, expectError = false) {
  try {
    const response = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, name }),
    });

    const data = await response.json();
    
    log(`\n📧 Email/Password Signup Test`, 'cyan');
    log(`   Email: ${email}`);
    log(`   Expected: ${expectError ? 'Error' : 'Success'}`);
    log(`   Status: ${response.status}`);
    
    if (expectError) {
      if (!response.ok) {
        log(`   ✅ Error handled correctly: ${data.error}`, 'green');
        if (data.code) log(`   📝 Error code: ${data.code}`);
        if (data.action) log(`   🎯 Suggested action: ${data.action}`);
        return true;
      } else {
        log(`   ❌ Expected error but got success`, 'red');
        return false;
      }
    } else {
      if (response.ok) {
        log(`   ✅ Success: Account created`, 'green');
        log(`   📝 User ID: ${data.user?.uid}`);
        log(`   📝 Email: ${data.user?.email}`);
        log(`   📝 Plan: ${data.user?.plan}`);
        return true;
      } else {
        log(`   ❌ Expected success but got error: ${data.error}`, 'red');
        return false;
      }
    }
  } catch (error) {
    log(`   ❌ Request failed: ${error.message}`, 'red');
    return false;
  }
}

async function testGoogleSignupFlow() {
  // Note: Google sign-up flow requires actual user interaction with popup
  // This test validates the endpoint exists and handles mock scenarios
  
  log(`\n🔐 Google Auth Flow Test (Endpoint Validation)`, 'cyan');
  
  try {
    // Test with invalid token (should fail gracefully)
    const response = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        idToken: 'invalid-token',
        name: 'Test User',
        email: 'test@gmail.com'
      }),
    });

    const data = await response.json();
    
    if (!response.ok && data.error) {
      log(`   ✅ Invalid Google token properly rejected`, 'green');
      log(`   📝 Error: ${data.error}`);
      return true;
    } else {
      log(`   ❌ Invalid token should have been rejected`, 'red');
      return false;
    }
  } catch (error) {
    log(`   ❌ Google auth test failed: ${error.message}`, 'red');
    return false;
  }
}

async function testFormValidation() {
  log(`\n🔍 Form Validation Tests`, 'cyan');
  
  const validationTests = [
    {
      name: 'Empty email',
      payload: { name: 'Test', email: '', password: 'password123' },
      shouldFail: true
    },
    {
      name: 'Invalid email format',
      payload: { name: 'Test', email: 'not-an-email', password: 'password123' },
      shouldFail: true
    },
    {
      name: 'Short password',
      payload: { name: 'Test', email: 'test@example.com', password: '123' },
      shouldFail: true
    },
    {
      name: 'Missing name',
      payload: { name: '', email: 'test@example.com', password: 'password123' },
      shouldFail: false // Name is optional, will use email prefix
    }
  ];
  
  const results = [];
  
  for (const test of validationTests) {
    try {
      const response = await fetch(`${BASE_URL}/api/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(test.payload),
      });

      const data = await response.json();
      const failed = !response.ok;
      
      if (test.shouldFail === failed) {
        log(`   ✅ ${test.name}: ${failed ? 'Properly rejected' : 'Properly accepted'}`, 'green');
        results.push(true);
      } else {
        log(`   ❌ ${test.name}: Expected ${test.shouldFail ? 'failure' : 'success'} but got ${failed ? 'failure' : 'success'}`, 'red');
        results.push(false);
      }
      
      if (failed && data.error) {
        log(`      📝 Error: ${data.error}`, 'yellow');
      }
    } catch (error) {
      log(`   ❌ ${test.name}: Request failed - ${error.message}`, 'red');
      results.push(false);
    }
  }
  
  return results.every(r => r);
}

async function testErrorScenarios() {
  log(`\n⚠️  Error Scenario Tests`, 'cyan');
  
  const uniqueEmail = `user${Date.now()}@example.com`;
  
  // First create a user
  const createResult = await testEmailPasswordSignup(uniqueEmail, 'password123', 'Test User', false);
  
  if (!createResult) {
    log(`   ❌ Could not create initial user for duplicate test`, 'red');
    return false;
  }
  
  // Now try to create the same user again (should fail)
  const duplicateResult = await testEmailPasswordSignup(uniqueEmail, 'password123', 'Test User', true);
  
  return duplicateResult;
}

async function runComprehensiveTests() {
  log('🧪 Running Comprehensive Authentication Tests', 'bright');
  log('===============================================', 'bright');
  
  const results = [];
  
  // 1. Health Check
  log('\n🏥 System Health Check', 'blue');
  const healthResult = await testHealthCheck();
  results.push(healthResult);
  
  if (!healthResult) {
    log('❌ Cannot proceed with tests - auth system is unhealthy', 'red');
    return false;
  }
  
  // 2. Form Validation
  const validationResult = await testFormValidation();
  results.push(validationResult);
  
  // 3. Email/Password Success Case
  const uniqueEmail = `newuser${Date.now()}@example.com`;
  const successResult = await testEmailPasswordSignup(uniqueEmail, 'strongpassword123', 'New User', false);
  results.push(successResult);
  
  // 4. Error Scenarios
  const errorResult = await testErrorScenarios();
  results.push(errorResult);
  
  // 5. Google Auth Endpoint Validation
  const googleResult = await testGoogleSignupFlow();
  results.push(googleResult);
  
  // Summary
  log('\n📋 Test Results Summary', 'bright');
  log('======================', 'bright');
  
  const testNames = ['Health Check', 'Form Validation', 'Signup Success', 'Error Handling', 'Google Auth'];
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  results.forEach((result, index) => {
    const status = result ? '✅' : '❌';
    const color = result ? 'green' : 'red';
    log(`${status} ${testNames[index]}`, color);
  });
  
  log(`\n📊 Overall: ${passed}/${total} tests passed`, passed === total ? 'green' : 'red');
  
  if (passed === total) {
    log('🎉 All authentication tests passed!', 'green');
    return true;
  } else {
    log('💥 Some tests failed - check the logs above', 'red');
    return false;
  }
}

// Main execution
async function main() {
  const success = await runComprehensiveTests();
  process.exit(success ? 0 : 1);
}

main().catch((error) => {
  log(`💥 Test suite crashed: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});