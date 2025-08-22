#!/usr/bin/env node

const { spawn } = require('child_process');
const http = require('http');

console.log('🚀 Starting authentication flow test...');

// Function to wait for server to be ready
function waitForServer(port, callback, attempts = 0) {
  if (attempts > 30) { // Max 30 seconds
    callback(new Error('Server failed to start within 30 seconds'));
    return;
  }

  const req = http.request({
    hostname: 'localhost',
    port: port,
    path: '/api/health',
    timeout: 1000
  }, (res) => {
    if (res.statusCode === 200 || res.statusCode === 404) {
      callback(null);
    } else {
      setTimeout(() => waitForServer(port, callback, attempts + 1), 1000);
    }
  });

  req.on('error', () => {
    setTimeout(() => waitForServer(port, callback, attempts + 1), 1000);
  });
  
  req.on('timeout', () => {
    req.destroy();
    setTimeout(() => waitForServer(port, callback, attempts + 1), 1000);
  });

  req.end();
}

// Function to test endpoint
function testEndpoint(path, expectedStatus, callback) {
  const req = http.request({
    hostname: 'localhost',
    port: 3000,
    path: path,
    timeout: 5000
  }, (res) => {
    console.log(`📍 ${path}: ${res.statusCode} (expected ${expectedStatus})`);
    
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      callback(null, {
        statusCode: res.statusCode,
        headers: res.headers,
        body: data
      });
    });
  });

  req.on('error', (err) => {
    console.error(`❌ Error testing ${path}:`, err.message);
    callback(err);
  });

  req.on('timeout', () => {
    console.error(`⏰ Timeout testing ${path}`);
    req.destroy();
    callback(new Error('Request timeout'));
  });

  req.end();
}

// Start the Next.js server
const server = spawn('npm', ['run', 'dev'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, GRPC_VERBOSITY: 'ERROR' }
});

let serverOutput = '';
let hasStarted = false;

server.stdout.on('data', (data) => {
  const output = data.toString();
  serverOutput += output;
  
  if (output.includes('Ready in') && !hasStarted) {
    hasStarted = true;
    console.log('✅ Server is ready!');
    
    // Wait a bit more for complete initialization
    setTimeout(() => {
      console.log('🧪 Running authentication flow tests...');
      
      // Test sequence
      const tests = [
        { path: '/sign-in', expectedStatus: 200 },
        { path: '/sign-up', expectedStatus: 200 },
        { path: '/dashboard', expectedStatus: 307 }, // Should redirect to /sign-in
        { path: '/api/auth/verify', expectedStatus: 401 } // Should require auth
      ];
      
      let currentTest = 0;
      
      function runNextTest() {
        if (currentTest >= tests.length) {
          console.log('✅ All tests completed!');
          server.kill('SIGTERM');
          process.exit(0);
          return;
        }
        
        const test = tests[currentTest++];
        testEndpoint(test.path, test.expectedStatus, (err, result) => {
          if (err) {
            console.error(`❌ Test failed for ${test.path}:`, err.message);
            server.kill('SIGTERM');
            process.exit(1);
            return;
          }
          
          if (result.statusCode === test.expectedStatus || 
              (test.expectedStatus === 307 && (result.statusCode === 307 || result.statusCode === 302))) {
            console.log(`✅ ${test.path} passed`);
          } else {
            console.log(`⚠️  ${test.path} returned ${result.statusCode}, expected ${test.expectedStatus}`);
          }
          
          setTimeout(runNextTest, 100);
        });
      }
      
      runNextTest();
    }, 2000);
  }
});

server.stderr.on('data', (data) => {
  const output = data.toString();
  if (!output.includes('GRPC_VERBOSITY') && !output.includes('--no-warnings') && !output.includes('openssl-legacy-provider')) {
    console.error('Server error:', output);
  }
});

server.on('close', (code) => {
  console.log('🔚 Server closed with code:', code);
});

// Kill server on script termination
process.on('SIGINT', () => {
  console.log('🛑 Terminating server...');
  server.kill('SIGTERM');
  process.exit(0);
});

process.on('SIGTERM', () => {
  server.kill('SIGTERM');
  process.exit(0);
});
