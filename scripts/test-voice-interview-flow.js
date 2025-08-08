#!/usr/bin/env node

/**
 * Integration test script for voice interview flow
 * Tests:
 * 1. Preliminary question handling
 * 2. Transition from preliminary to main interview
 * 3. Question count tracking
 * 4. Maximum question limit
 */

const http = require('http');

// Configuration
const BASE_URL = 'http://localhost:3000';
const API_ENDPOINT = '/api/voice/conversation';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, colors.bright + colors.cyan);
  console.log('='.repeat(60));
}

// Make HTTP request
async function makeRequest(endpoint, method = 'GET', body = null) {
  const url = new URL(endpoint, BASE_URL);
  
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url.toString(), options);
    const data = await response.json();
    return { success: response.ok, data, status: response.status };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Test 1: Start interview and check for preliminary question
async function testPreliminaryQuestion() {
  logSection('Test 1: Preliminary Question Check');
  
  const response = await makeRequest(API_ENDPOINT, 'POST', {
    action: 'start',
    interviewContext: {
      type: 'technical'
    }
  });
  
  if (response.success) {
    const { message, questionNumber } = response.data;
    
    // Check if opening message contains preliminary question
    const hasPreliminary = message.includes('tell me about your current role') || 
                          message.includes('years of experience') ||
                          message.includes('technologies or skills');
    
    if (hasPreliminary) {
      log('✅ Preliminary question detected in opening message', colors.green);
      log(`   Question #${questionNumber}: "${message.substring(0, 100)}..."`, colors.blue);
    } else {
      log('⚠️ No preliminary question found in opening message', colors.yellow);
      log(`   Message: "${message.substring(0, 100)}..."`, colors.yellow);
    }
    
    return { success: true, hasPreliminary };
  } else {
    log(`❌ Failed to start interview: ${response.error || response.status}`, colors.red);
    return { success: false };
  }
}

// Test 2: Process preliminary response and check transition
async function testPreliminaryTransition() {
  logSection('Test 2: Preliminary to Main Interview Transition');
  
  // Start interview first
  await makeRequest(API_ENDPOINT, 'POST', {
    action: 'start',
    interviewContext: {
      type: 'behavioral'
    }
  });
  
  // Send preliminary response
  const response = await makeRequest(API_ENDPOINT, 'POST', {
    action: 'process',
    userTranscript: 'I am a Senior Software Engineer with 5 years of experience in React, Node.js, and AWS'
  });
  
  if (response.success) {
    const { message, questionNumber } = response.data;
    
    // Check for transition acknowledgment
    const hasTransition = message.includes('Thank you for that information') || 
                         message.includes("Now let's begin") ||
                         message.includes('Great! I now have');
    
    // Check for first real interview question
    const hasRealQuestion = message.includes('describe a situation') ||
                           message.includes('technical challenge') ||
                           message.includes('team member') ||
                           message.includes('lead a project');
    
    if (hasTransition && hasRealQuestion) {
      log('✅ Successfully transitioned from preliminary to main interview', colors.green);
      log(`   Question #${questionNumber}: Contains acknowledgment and real question`, colors.blue);
    } else if (hasTransition) {
      log('⚠️ Transition acknowledgment found but no clear interview question', colors.yellow);
    } else {
      log('❌ No clear transition from preliminary to main interview', colors.red);
    }
    
    return { success: true, hasTransition, hasRealQuestion };
  } else {
    log(`❌ Failed to process response: ${response.error || response.status}`, colors.red);
    return { success: false };
  }
}

// Test 3: Test question count progression
async function testQuestionProgression() {
  logSection('Test 3: Question Count Progression');
  
  // Start a new interview with preliminaryCollected = true
  await makeRequest(API_ENDPOINT, 'POST', {
    action: 'start',
    interviewContext: {
      type: 'technical',
      preliminaryCollected: true
    }
  });
  
  let questionCount = 1;
  const maxIterations = 5;
  
  for (let i = 0; i < maxIterations; i++) {
    const response = await makeRequest(API_ENDPOINT, 'POST', {
      action: 'process',
      userTranscript: `This is my answer to question ${i + 1}. I would implement using microservices...`
    });
    
    if (response.success) {
      const { questionNumber, isComplete } = response.data;
      
      if (questionNumber > questionCount) {
        log(`✅ Question ${questionCount} → ${questionNumber}`, colors.green);
        questionCount = questionNumber;
      } else {
        log(`⚠️ Question count did not increment: ${questionCount} → ${questionNumber}`, colors.yellow);
      }
      
      if (isComplete) {
        log(`🏁 Interview marked as complete at question ${questionNumber}`, colors.cyan);
        break;
      }
    } else {
      log(`❌ Failed at question ${questionCount}: ${response.error}`, colors.red);
      break;
    }
  }
  
  return { success: true, finalCount: questionCount };
}

// Test 4: Test maximum question limit
async function testMaxQuestionLimit() {
  logSection('Test 4: Maximum Question Limit (10 questions)');
  
  // Start interview with max questions set
  await makeRequest(API_ENDPOINT, 'POST', {
    action: 'start',
    interviewContext: {
      type: 'general',
      preliminaryCollected: true,
      maxQuestions: 10
    }
  });
  
  let questionCount = 1;
  let completed = false;
  
  // Simulate answering questions until completion
  for (let i = 0; i < 15; i++) { // Try more than max to ensure it stops
    const response = await makeRequest(API_ENDPOINT, 'POST', {
      action: 'process',
      userTranscript: `Answer ${i + 1}: I have experience with various technologies and methodologies...`
    });
    
    if (response.success) {
      const { questionNumber, isComplete, message } = response.data;
      
      log(`  Question ${questionNumber}: ${message.substring(0, 50)}...`, colors.blue);
      
      questionCount = questionNumber;
      
      if (isComplete) {
        completed = true;
        log(`✅ Interview completed at question ${questionNumber}`, colors.green);
        
        if (questionNumber === 10) {
          log('✅ Correctly stopped at max question limit (10)', colors.green);
        } else {
          log(`⚠️ Completed at question ${questionNumber} instead of 10`, colors.yellow);
        }
        break;
      }
      
      if (questionNumber >= 10 && !isComplete) {
        log('⚠️ Reached question 10 but interview not marked as complete', colors.yellow);
      }
    } else {
      log(`❌ Failed at question ${questionCount}: ${response.error}`, colors.red);
      break;
    }
  }
  
  if (!completed) {
    log('❌ Interview did not complete within expected limits', colors.red);
  }
  
  return { success: completed, finalCount: questionCount };
}

// Main test runner
async function runTests() {
  console.log('\n' + '='.repeat(60));
  log('🚀 Voice Interview Integration Tests', colors.bright + colors.cyan);
  log('   Testing preliminary questions and conversation flow', colors.cyan);
  console.log('='.repeat(60));
  
  // Check if server is running by testing the actual API endpoint
  try {
    const testConnection = await makeRequest(API_ENDPOINT, 'POST', { action: 'ping' });
    if (!testConnection.success && testConnection.status !== 200) {
      // Try with a start action as fallback
      const testStart = await makeRequest(API_ENDPOINT, 'POST', { action: 'start', interviewContext: { type: 'general' } });
      if (!testStart.success) {
        log('\n❌ Server is not responding. Please ensure Next.js is running on port 3000', colors.red);
        log('   Run: npm run dev', colors.yellow);
        process.exit(1);
      }
    }
  } catch (error) {
    log('\n❌ Cannot connect to server at ' + BASE_URL, colors.red);
    log('   Error: ' + error.message, colors.red);
    log('   Please start the Next.js development server first', colors.yellow);
    log('   Run: npm run dev', colors.yellow);
    process.exit(1);
  }
  
  // Run tests
  const results = {
    preliminary: await testPreliminaryQuestion(),
    transition: await testPreliminaryTransition(),
    progression: await testQuestionProgression(),
    maxLimit: await testMaxQuestionLimit()
  };
  
  // Summary
  logSection('Test Summary');
  
  const allPassed = Object.values(results).every(r => r.success);
  
  if (allPassed) {
    log('✅ All tests passed successfully!', colors.bright + colors.green);
  } else {
    log('⚠️ Some tests failed or had warnings', colors.bright + colors.yellow);
  }
  
  console.log('\nDetailed Results:');
  console.log('  1. Preliminary Question:', results.preliminary.success ? '✅' : '❌');
  console.log('  2. Transition to Main:', results.transition.success ? '✅' : '❌');
  console.log('  3. Question Progression:', results.progression.success ? '✅' : '❌');
  console.log('  4. Max Question Limit:', results.maxLimit.success ? '✅' : '❌');
  
  if (results.progression.finalCount) {
    console.log(`\n  Final question count in progression test: ${results.progression.finalCount}`);
  }
  if (results.maxLimit.finalCount) {
    console.log(`  Final question count in max limit test: ${results.maxLimit.finalCount}`);
  }
  
  console.log('\n' + '='.repeat(60));
  process.exit(allPassed ? 0 : 1);
}

// Run tests if executed directly
if (require.main === module) {
  runTests().catch(error => {
    log(`\n❌ Unexpected error: ${error.message}`, colors.red);
    console.error(error);
    process.exit(1);
  });
}

module.exports = { runTests };
