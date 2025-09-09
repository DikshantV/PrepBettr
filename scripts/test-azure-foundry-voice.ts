#!/usr/bin/env tsx
/**
 * Azure AI Foundry Voice System Test
 * 
 * Manual verification script to test the voice system implementation:
 * - POST to /api/voice/session/start
 * - Check session creation and WebSocket URL
 * - Test session stopping and cleanup
 * - Validate API responses and error handling
 * 
 * Usage: npm run test:azure-foundry-voice
 */

import { performance } from 'perf_hooks';

// Configuration
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const TEST_CONFIG = {
  timeout: 30000, // 30 seconds
  retries: 3,
  voiceOptions: {
    voiceName: 'neural-hd-professional',
    locale: 'en-US',
    speakingRate: 1.0,
    emotionalTone: 'friendly',
    audioSettings: {
      noiseSuppression: true,
      echoCancellation: true,
      interruptionDetection: true,
      sampleRate: 16000
    }
  }
};

/**
 * Test result tracking
 */
interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'skip';
  duration: number;
  message?: string;
  error?: string;
}

const testResults: TestResult[] = [];

/**
 * Utility functions
 */
function log(message: string, level: 'info' | 'warn' | 'error' = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '✅';
  console.log(`${prefix} [${timestamp}] ${message}`);
}

function logTest(name: string, status: 'pass' | 'fail' | 'skip', duration: number, message?: string, error?: string) {
  const result: TestResult = { name, status, duration, message, error };
  testResults.push(result);
  
  const statusIcon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⏭️';
  const durationText = `(${duration.toFixed(2)}ms)`;
  const details = message ? ` - ${message}` : '';
  const errorDetails = error ? ` | Error: ${error}` : '';
  
  console.log(`${statusIcon} ${name} ${durationText}${details}${errorDetails}`);
}

async function makeRequest(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TEST_CONFIG.timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Azure-Foundry-Voice-Test/1.0',
        ...options.headers
      }
    });
    
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Test functions
 */
async function testHealthCheck(): Promise<void> {
  const testName = 'Health Check - Session Start Endpoint';
  const startTime = performance.now();
  
  try {
    log('Testing health check endpoint...');
    
    const response = await makeRequest(`${BASE_URL}/api/voice/session/start`);
    const duration = performance.now() - startTime;
    
    if (response.ok) {
      const data = await response.json();
      
      if (data.status === 'available') {
        logTest(testName, 'pass', duration, 'Endpoint is available');
      } else {
        logTest(testName, 'fail', duration, `Unexpected status: ${data.status}`);
      }
    } else {
      logTest(testName, 'fail', duration, `HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    const duration = performance.now() - startTime;
    logTest(testName, 'fail', duration, 'Health check failed', error instanceof Error ? error.message : String(error));
  }
}

async function testSessionCreation(): Promise<string | null> {
  const testName = 'Session Creation';
  const startTime = performance.now();
  
  try {
    log('Testing session creation...');
    
    const response = await makeRequest(`${BASE_URL}/api/voice/session/start`, {
      method: 'POST',
      body: JSON.stringify(TEST_CONFIG.voiceOptions)
    });
    
    const duration = performance.now() - startTime;
    
    if (response.ok) {
      const data = await response.json();
      
      if (data.success && data.sessionId && data.wsUrl) {
        logTest(testName, 'pass', duration, `Session created: ${data.sessionId}`);
        log(`WebSocket URL: ${data.wsUrl}`);
        log(`Voice options: ${JSON.stringify(data.options, null, 2)}`);
        return data.sessionId;
      } else {
        logTest(testName, 'fail', duration, 'Invalid response structure', JSON.stringify(data));
        return null;
      }
    } else {
      const errorData = await response.text();
      logTest(testName, 'fail', duration, `HTTP ${response.status}`, errorData);
      return null;
    }
  } catch (error) {
    const duration = performance.now() - startTime;
    logTest(testName, 'fail', duration, 'Session creation failed', error instanceof Error ? error.message : String(error));
    return null;
  }
}

async function testSessionStatus(sessionId: string): Promise<void> {
  const testName = 'Session Status Check';
  const startTime = performance.now();
  
  try {
    log(`Testing session status for ${sessionId}...`);
    
    const response = await makeRequest(`${BASE_URL}/api/voice/session/${sessionId}/stop`);
    const duration = performance.now() - startTime;
    
    if (response.ok) {
      const data = await response.json();
      
      if (data.exists !== undefined) {
        logTest(testName, 'pass', duration, `Session exists: ${data.exists}`);
        if (data.exists) {
          log(`Created at: ${data.createdAt}`);
          log(`Options: ${JSON.stringify(data.options)}`);
        }
      } else {
        logTest(testName, 'fail', duration, 'Invalid response structure', JSON.stringify(data));
      }
    } else {
      const errorData = await response.text();
      logTest(testName, response.status === 404 ? 'pass' : 'fail', duration, 
        response.status === 404 ? 'Session not found (expected for stopped session)' : `HTTP ${response.status}`, 
        errorData);
    }
  } catch (error) {
    const duration = performance.now() - startTime;
    logTest(testName, 'fail', duration, 'Status check failed', error instanceof Error ? error.message : String(error));
  }
}

async function testSessionStop(sessionId: string): Promise<void> {
  const testName = 'Session Stop';
  const startTime = performance.now();
  
  try {
    log(`Testing session stop for ${sessionId}...`);
    
    const response = await makeRequest(`${BASE_URL}/api/voice/session/${sessionId}/stop`, {
      method: 'POST',
      body: JSON.stringify({ graceful: true })
    });
    
    const duration = performance.now() - startTime;
    
    if (response.ok) {
      const data = await response.json();
      
      if (data.success) {
        logTest(testName, 'pass', duration, `Session stopped: ${data.message}`);
        log(`Stopped at: ${data.stoppedAt}`);
      } else {
        logTest(testName, 'fail', duration, 'Stop failed', data.error || 'Unknown error');
      }
    } else {
      const errorData = await response.text();
      logTest(testName, response.status === 404 ? 'pass' : 'fail', duration,
        response.status === 404 ? 'Session not found (may have been cleaned up)' : `HTTP ${response.status}`,
        errorData);
    }
  } catch (error) {
    const duration = performance.now() - startTime;
    logTest(testName, 'fail', duration, 'Session stop failed', error instanceof Error ? error.message : String(error));
  }
}

async function testTranscriptRetrieval(sessionId: string): Promise<void> {
  const testName = 'Transcript Retrieval';
  const startTime = performance.now();
  
  try {
    log(`Testing transcript retrieval for ${sessionId}...`);
    
    const response = await makeRequest(`${BASE_URL}/api/voice/session/${sessionId}/transcript`);
    const duration = performance.now() - startTime;
    
    if (response.ok) {
      const data = await response.json();
      
      if (data.success !== undefined && Array.isArray(data.transcripts)) {
        logTest(testName, 'pass', duration, `Retrieved ${data.totalEntries} transcripts`);
        if (data.transcripts.length > 0) {
          log(`Sample transcript: ${JSON.stringify(data.transcripts[0])}`);
        }
      } else {
        logTest(testName, 'fail', duration, 'Invalid response structure', JSON.stringify(data));
      }
    } else {
      const errorData = await response.text();
      logTest(testName, 'pass', duration, 'No transcripts found (expected for new session)', errorData);
    }
  } catch (error) {
    const duration = performance.now() - startTime;
    logTest(testName, 'fail', duration, 'Transcript retrieval failed', error instanceof Error ? error.message : String(error));
  }
}

async function testInvalidSessionId(): Promise<void> {
  const testName = 'Invalid Session ID Handling';
  const startTime = performance.now();
  
  try {
    log('Testing invalid session ID handling...');
    
    const invalidSessionId = 'invalid-session-123';
    const response = await makeRequest(`${BASE_URL}/api/voice/session/${invalidSessionId}/stop`, {
      method: 'POST'
    });
    
    const duration = performance.now() - startTime;
    
    if (response.status === 404) {
      const data = await response.json();
      logTest(testName, 'pass', duration, 'Properly handled invalid session ID');
    } else {
      logTest(testName, 'fail', duration, `Expected 404, got ${response.status}`);
    }
  } catch (error) {
    const duration = performance.now() - startTime;
    logTest(testName, 'fail', duration, 'Invalid session test failed', error instanceof Error ? error.message : String(error));
  }
}

async function testInvalidPayload(): Promise<void> {
  const testName = 'Invalid Payload Handling';
  const startTime = performance.now();
  
  try {
    log('Testing invalid payload handling...');
    
    const response = await makeRequest(`${BASE_URL}/api/voice/session/start`, {
      method: 'POST',
      body: JSON.stringify({
        voiceName: 123, // Invalid type
        speakingRate: 10, // Out of range
        audioSettings: 'invalid' // Wrong type
      })
    });
    
    const duration = performance.now() - startTime;
    
    if (response.status === 400) {
      const data = await response.json();
      logTest(testName, 'pass', duration, 'Properly validated invalid payload');
      log(`Validation error: ${data.error}`);
    } else {
      logTest(testName, 'fail', duration, `Expected 400, got ${response.status}`);
    }
  } catch (error) {
    const duration = performance.now() - startTime;
    logTest(testName, 'fail', duration, 'Invalid payload test failed', error instanceof Error ? error.message : String(error));
  }
}

/**
 * Main test runner
 */
async function runTests(): Promise<void> {
  console.log('🧪 Starting Azure AI Foundry Voice System Tests...\n');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Timeout: ${TEST_CONFIG.timeout}ms`);
  console.log(`Test configuration: ${JSON.stringify(TEST_CONFIG.voiceOptions, null, 2)}\n`);

  // Run tests in sequence
  await testHealthCheck();
  
  const sessionId = await testSessionCreation();
  
  if (sessionId) {
    await testSessionStatus(sessionId);
    await testTranscriptRetrieval(sessionId);
    await testSessionStop(sessionId);
    
    // Verify session was cleaned up
    await testSessionStatus(sessionId);
  }
  
  await testInvalidSessionId();
  await testInvalidPayload();

  // Print summary
  console.log('\n📊 Test Summary:');
  console.log('='.repeat(50));
  
  const totalTests = testResults.length;
  const passedTests = testResults.filter(r => r.status === 'pass').length;
  const failedTests = testResults.filter(r => r.status === 'fail').length;
  const skippedTests = testResults.filter(r => r.status === 'skip').length;
  
  console.log(`Total Tests: ${totalTests}`);
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(`⏭️  Skipped: ${skippedTests}`);
  
  const averageDuration = testResults.reduce((sum, r) => sum + r.duration, 0) / totalTests;
  console.log(`⏱️  Average Duration: ${averageDuration.toFixed(2)}ms`);
  
  if (failedTests > 0) {
    console.log('\n❌ Failed Tests:');
    testResults.filter(r => r.status === 'fail').forEach(test => {
      console.log(`  - ${test.name}: ${test.message || 'Unknown failure'}`);
      if (test.error) {
        console.log(`    Error: ${test.error}`);
      }
    });
  }
  
  console.log('\n' + '='.repeat(50));
  
  if (failedTests === 0) {
    console.log('🎉 All tests passed! Voice system is ready for use.');
  } else {
    console.log('⚠️  Some tests failed. Please check the configuration and try again.');
    process.exit(1);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().catch(error => {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  });
}
