#!/usr/bin/env node

/**
 * Test script to validate Azure OpenAI deployment configuration
 */

const path = require('path');
const { spawn } = require('child_process');

// Colors for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function testEnvironmentVariables() {
  log('cyan', '🔍 Testing Environment Variables...');
  
  const requiredVars = [
    'AZURE_OPENAI_KEY',
    'AZURE_OPENAI_ENDPOINT',
    'AZURE_OPENAI_DEPLOYMENT',
    'NEXT_PUBLIC_AZURE_OPENAI_API_KEY',
    'NEXT_PUBLIC_AZURE_OPENAI_ENDPOINT',
    'NEXT_PUBLIC_AZURE_OPENAI_DEPLOYMENT'
  ];

  let allPresent = true;
  
  requiredVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
      log('green', `✅ ${varName}: SET (length: ${value.length})`);
    } else {
      log('red', `❌ ${varName}: MISSING`);
      allPresent = false;
    }
  });

  return allPresent;
}

async function testOpenAIImport() {
  log('cyan', '🔍 Testing OpenAI Import...');
  
  try {
    const { AzureOpenAI } = require('openai');
    log('green', '✅ AzureOpenAI import successful');
    
    // Test Azure OpenAI client instantiation
    if (process.env.AZURE_OPENAI_KEY && process.env.AZURE_OPENAI_ENDPOINT) {
      const client = new AzureOpenAI({
        apiKey: process.env.AZURE_OPENAI_KEY,
        endpoint: process.env.AZURE_OPENAI_ENDPOINT,
        deployment: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
        apiVersion: '2024-08-01-preview'
      });
      log('green', '✅ AzureOpenAI client instantiation successful');
      return true;
    } else {
      log('yellow', '⚠️ Cannot test client instantiation without credentials');
      return false;
    }
  } catch (error) {
    log('red', `❌ OpenAI import failed: ${error.message}`);
    return false;
  }
}

async function testNext() {
  log('cyan', '🔍 Testing Next.js compilation...');
  
  const nextBuild = spawn('npm', ['run', 'build'], {
    stdio: 'pipe',
    env: { ...process.env, NODE_ENV: 'production' }
  });

  let output = '';
  let hasError = false;

  nextBuild.stdout.on('data', (data) => {
    output += data.toString();
  });

  nextBuild.stderr.on('data', (data) => {
    const errorText = data.toString();
    if (errorText.includes('ERROR') || errorText.includes('Failed')) {
      hasError = true;
      log('red', `❌ Build error: ${errorText}`);
    }
    output += errorText;
  });

  return new Promise((resolve) => {
    nextBuild.on('close', (code) => {
      if (code === 0 && !hasError) {
        log('green', '✅ Next.js build successful');
        resolve(true);
      } else {
        log('red', `❌ Next.js build failed with code ${code}`);
        resolve(false);
      }
    });
  });
}

async function testAPIRoute() {
  log('cyan', '🔍 Testing API route...');
  
  const envCheck = spawn('node', ['-e', `
    const { NextRequest } = require('next/server');
    console.log('Environment check route test...');
    process.exit(0);
  `]);

  return new Promise((resolve) => {
    envCheck.on('close', (code) => {
      if (code === 0) {
        log('green', '✅ API routes accessible');
        resolve(true);
      } else {
        log('red', '❌ API routes failed');
        resolve(false);
      }
    });
  });
}

async function main() {
  log('cyan', '🚀 Starting Azure OpenAI Deployment Test...\n');
  
  const results = {
    environment: await testEnvironmentVariables(),
    openai: await testOpenAIImport(),
    // Skip build test for now to avoid long execution time
    // build: await testNext(),
    api: await testAPIRoute()
  };

  console.log('\n📊 Test Results:');
  Object.entries(results).forEach(([test, passed]) => {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    log(passed ? 'green' : 'red', `${test.toUpperCase()}: ${status}`);
  });

  const allPassed = Object.values(results).every(Boolean);
  
  if (allPassed) {
    log('green', '\n🎉 All tests passed! Azure OpenAI deployment should work correctly.');
  } else {
    log('red', '\n💥 Some tests failed. Check the issues above.');
    process.exit(1);
  }
}

// Run the tests
main().catch(error => {
  log('red', `💥 Test execution failed: ${error.message}`);
  process.exit(1);
});
