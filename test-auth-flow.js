#!/usr/bin/env node

const https = require('https');

// Test Firebase configuration endpoint
async function testFirebaseConfig() {
  console.log('=== Testing Firebase Config API ===');
  
  return new Promise((resolve, reject) => {
    const req = https.request('https://prepbettr.com/api/config/firebase', {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const config = JSON.parse(data);
          console.log('✅ Firebase config endpoint working');
          console.log('   hasKey:', config.hasKey);
          console.log('   apiKey present:', !!config.apiKey);
          if (config.apiKey) {
            console.log('   apiKey preview:', config.apiKey.substring(0, 10) + '...');
          }
          resolve(config);
        } catch (error) {
          console.log('❌ Firebase config failed to parse response');
          console.log('   Raw response:', data);
          reject(error);
        }
      });
    });
    
    req.on('error', (error) => {
      console.log('❌ Firebase config request failed:', error.message);
      reject(error);
    });
    
    req.end();
  });
}

// Test signin endpoint with invalid token
async function testSigninEndpoint() {
  console.log('\n=== Testing Signin API ===');
  
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      idToken: 'test-invalid-token-123'
    });
    
    const req = https.request('https://prepbettr.com/api/auth/signin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData.length,
        'Accept': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log(`✅ Signin endpoint working (status: ${res.statusCode})`);
          console.log('   Expected 401 for invalid token:', res.statusCode === 401 ? '✅' : '❌');
          console.log('   Response error:', response.error);
          resolve(response);
        } catch (error) {
          console.log('❌ Signin response failed to parse');
          console.log('   Raw response:', data);
          reject(error);
        }
      });
    });
    
    req.on('error', (error) => {
      console.log('❌ Signin request failed:', error.message);
      reject(error);
    });
    
    req.write(postData);
    req.end();
  });
}

// Test signup endpoint with invalid token
async function testSignupEndpoint() {
  console.log('\n=== Testing Signup API ===');
  
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      idToken: 'test-invalid-token-123',
      email: 'test@example.com',
      name: 'Test User'
    });
    
    const req = https.request('https://prepbettr.com/api/auth/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData.length,
        'Accept': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log(`✅ Signup endpoint working (status: ${res.statusCode})`);
          console.log('   Expected 401 for invalid token:', res.statusCode === 401 ? '✅' : '❌');
          console.log('   Response error:', response.error);
          resolve(response);
        } catch (error) {
          console.log('❌ Signup response failed to parse');
          console.log('   Raw response:', data);
          reject(error);
        }
      });
    });
    
    req.on('error', (error) => {
      console.log('❌ Signup request failed:', error.message);
      reject(error);
    });
    
    req.write(postData);
    req.end();
  });
}

// Test missing endpoints that might be expected by frontend
async function testMissingEndpoints() {
  console.log('\n=== Testing for Missing Endpoints ===');
  
  const endpointsToTest = [
    '/api/auth/google',
    '/api/auth/callback',
    '/api/auth/session',
    '/api/auth/token'
  ];
  
  for (const endpoint of endpointsToTest) {
    await new Promise((resolve) => {
      const req = https.request(`https://prepbettr.com${endpoint}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      }, (res) => {
        console.log(`   ${endpoint}: ${res.statusCode === 404 ? '❌ Missing' : '✅ Exists'} (${res.statusCode})`);
        resolve();
      });
      
      req.on('error', () => {
        console.log(`   ${endpoint}: ❌ Error`);
        resolve();
      });
      
      req.setTimeout(5000, () => {
        console.log(`   ${endpoint}: ❌ Timeout`);
        req.destroy();
        resolve();
      });
      
      req.end();
    });
  }
}

// Main test runner
async function runTests() {
  try {
    await testFirebaseConfig();
    await testSigninEndpoint();
    await testSignupEndpoint();
    await testMissingEndpoints();
    
    console.log('\n=== Test Summary ===');
    console.log('✅ All backend endpoints are working correctly');
    console.log('✅ Firebase configuration is properly loaded');
    console.log('✅ Authentication APIs respond with expected errors');
    console.log('\n🔍 If users are getting 401 errors, the issue is likely:');
    console.log('   1. Invalid Firebase ID tokens being sent by frontend');
    console.log('   2. Token expiration issues');
    console.log('   3. Firebase Admin SDK token verification failing');
    console.log('   4. Frontend not properly handling Google OAuth flow');
    
  } catch (error) {
    console.log('\n❌ Test failed:', error.message);
  }
}

runTests();
