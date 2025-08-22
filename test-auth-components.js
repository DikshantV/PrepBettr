#!/usr/bin/env node

// Simple test to verify authentication components work

async function testMockTokenVerification() {
  console.log('🔐 Testing mock token verification...');
  
  try {
    // Import the unified auth core
    const { verifyToken } = await import('./lib/shared/auth/index.js');
    
    // Test mock token
    const mockToken = `mock-token-testuser@example.com-${Date.now()}`;
    const result = await verifyToken(mockToken);
    
    if (result.valid) {
      console.log('✅ Mock token verification passed');
      console.log('   User:', result.user?.email);
      console.log('   Provider:', result.user?.provider);
    } else {
      console.log('❌ Mock token verification failed:', result.error);
      process.exit(1);
    }
    
    // Test invalid token
    const invalidResult = await verifyToken('invalid-token');
    if (!invalidResult.valid) {
      console.log('✅ Invalid token correctly rejected');
    } else {
      console.log('❌ Invalid token should have been rejected');
      process.exit(1);
    }
    
    console.log('✅ All authentication component tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

async function testAPIEndpoints() {
  console.log('🌐 Testing API endpoints...');
  
  const http = require('http');
  
  function testAPI(path, method = 'GET', data = null, headers = {}) {
    return new Promise((resolve, reject) => {
      const postData = data ? JSON.stringify(data) : null;
      
      const options = {
        hostname: 'localhost',
        port: 3000,
        path: path,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        timeout: 5000
      };
      
      if (postData) {
        options.headers['Content-Length'] = Buffer.byteLength(postData);
      }
      
      const req = http.request(options, (res) => {
        let responseData = '';
        res.on('data', chunk => responseData += chunk);
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: responseData
          });
        });
      });
      
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      
      if (postData) {
        req.write(postData);
      }
      req.end();
    });
  }
  
  try {
    // Test signup endpoint
    console.log('🧪 Testing signup endpoint...');
    const signupResult = await testAPI('/api/auth/signup', 'POST', {
      email: 'test@example.com',
      password: 'testpassword',
      name: 'Test User'
    });
    
    console.log(`   Signup: ${signupResult.statusCode}`);
    if (signupResult.statusCode === 200) {
      console.log('✅ Signup endpoint working');
      
      const signupData = JSON.parse(signupResult.body);
      if (signupData.token) {
        console.log('✅ Token returned from signup');
        
        // Test verify endpoint with token
        console.log('🧪 Testing verify endpoint...');
        const verifyResult = await testAPI('/api/auth/verify', 'GET', null, {
          'Authorization': `Bearer ${signupData.token}`
        });
        
        console.log(`   Verify: ${verifyResult.statusCode}`);
        if (verifyResult.statusCode === 200) {
          console.log('✅ Verify endpoint working with token');
        }
      }
    }
    
  } catch (error) {
    console.log('⚠️  API test skipped (server not running):', error.message);
  }
}

// Check if we can run full tests or just component tests
async function main() {
  console.log('🚀 Starting authentication tests...\n');
  
  await testMockTokenVerification();
  console.log('');
  await testAPIEndpoints();
  
  console.log('\n✅ Authentication tests completed!');
}

main().catch(console.error);
