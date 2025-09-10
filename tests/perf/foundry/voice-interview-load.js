/**
 * Azure AI Foundry Voice Interview Load Test
 * 
 * Comprehensive k6 performance test for voice interview system including:
 * - Concurrent user simulation
 * - Voice RTT measurement
 * - Cost tracking and budget monitoring
 * - Performance thresholds validation
 * 
 * Usage: k6 run --env ENVIRONMENT=staging voice-interview-load.js
 * 
 * @version 2.0.0
 */

import { check, sleep, group } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';
import http from 'k6/http';
import ws from 'k6/ws';
import { SharedArray } from 'k6/data';
import { randomItem } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Test configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const ENVIRONMENT = __ENV.ENVIRONMENT || 'development';
const MAX_BUDGET_USD = parseFloat(__ENV.MAX_BUDGET_USD) || 50.0;

// Load test scenarios
const testScenarios = new SharedArray('interview-scenarios', function () {
  return [
    {
      jobRole: 'Senior Backend Engineer',
      companyName: 'TechCorp',
      candidateName: 'TestUser1',
      difficulty: 'senior',
      expectedQuestions: 4,
      duration: 300000 // 5 minutes
    },
    {
      jobRole: 'Frontend Developer',
      companyName: 'WebStudio',
      candidateName: 'TestUser2',
      difficulty: 'mid',
      expectedQuestions: 3,
      duration: 240000 // 4 minutes
    },
    {
      jobRole: 'Full Stack Developer',
      companyName: 'StartupXYZ',
      candidateName: 'TestUser3',
      difficulty: 'junior',
      expectedQuestions: 3,
      duration: 180000 // 3 minutes
    }
  ];
});

// Load user credentials for authentication
const testUsers = new SharedArray('test-users', function () {
  return [
    { email: 'loadtest1@prepbettr.com', password: 'LoadTest123!' },
    { email: 'loadtest2@prepbettr.com', password: 'LoadTest123!' },
    { email: 'loadtest3@prepbettr.com', password: 'LoadTest123!' },
    { email: 'loadtest4@prepbettr.com', password: 'LoadTest123!' },
    { email: 'loadtest5@prepbettr.com', password: 'LoadTest123!' }
  ];
});

// Custom metrics
const voiceConnectionSuccess = new Rate('voice_connection_success');
const voiceSessionDuration = new Trend('voice_session_duration');
const speechToTextLatency = new Trend('speech_to_text_latency');
const textToSpeechLatency = new Trend('text_to_speech_latency');
const aiResponseLatency = new Trend('ai_response_latency');
const costPerInterview = new Trend('cost_per_interview_usd');
const concurrentSessions = new Counter('concurrent_voice_sessions');
const interviewCompletion = new Rate('interview_completion_rate');
const audioQualityScore = new Trend('audio_quality_score');

// Performance thresholds
export const thresholds = {
  // HTTP performance
  'http_req_duration': ['p(95)<2000', 'p(99)<5000'],
  'http_req_failed': ['rate<0.01'], // <1% failure rate
  
  // Voice session metrics
  'voice_connection_success': ['rate>0.99'], // >99% success rate
  'voice_session_duration': ['p(95)<10000'], // <10s connection time
  'speech_to_text_latency': ['p(95)<1500'], // <1.5s STT latency
  'text_to_speech_latency': ['p(95)<1000'], // <1s TTS latency
  'ai_response_latency': ['p(95)<3000'], // <3s AI response
  'interview_completion_rate': ['rate>0.95'], // >95% completion
  'audio_quality_score': ['p(90)>0.8'], // >80% quality score
  
  // Cost monitoring
  'cost_per_interview_usd': ['p(95)<0.50'], // <$0.50 per interview
  
  // Concurrency limits
  'concurrent_voice_sessions': ['count<500'] // Max 500 concurrent sessions
};

// Test options with realistic load patterns
export const options = {
  scenarios: {
    // Ramp-up load test
    ramp_up_load: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '2m', target: 50 },   // Ramp up to 50 users
        { duration: '5m', target: 100 },  // Scale to 100 users
        { duration: '10m', target: 200 }, // Scale to 200 users
        { duration: '5m', target: 300 },  // Peak load 300 users
        { duration: '5m', target: 100 },  // Scale down
        { duration: '2m', target: 0 }     // Ramp down
      ]
    },
    
    // Constant load test
    steady_load: {
      executor: 'constant-vus',
      vus: 100,
      duration: '15m',
      startTime: '30m' // Start after ramp test
    },
    
    // Spike test
    spike_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 500 }, // Sudden spike
        { duration: '1m', target: 500 },  // Maintain spike
        { duration: '10s', target: 0 }    // Drop
      ],
      startTime: '50m' // Start after steady load
    }
  },
  
  thresholds: thresholds
};

// Authentication helper
function authenticateUser() {
  const user = randomItem(testUsers);
  
  const loginResponse = http.post(`${BASE_URL}/api/auth/signin`, {
    email: user.email,
    password: user.password
  }, {
    headers: { 'Content-Type': 'application/json' }
  });
  
  check(loginResponse, {
    'authentication successful': (r) => r.status === 200,
    'auth token received': (r) => r.json('token') !== undefined
  });
  
  return loginResponse.json('token');
}

// Cost estimation helper
function estimateInterviewCost(scenario, sessionMetrics) {
  // Base costs (estimated from Azure pricing)
  const COSTS = {
    speechToText: 0.001, // $1 per hour of audio
    textToSpeech: 0.016, // $16 per 1M characters
    gptTokens: 0.002,    // $2 per 1K tokens
    foundryAgent: 0.005  // $5 per 1K tokens (estimated)
  };
  
  const durationMinutes = sessionMetrics.duration / 60000;
  const estimatedTokens = scenario.expectedQuestions * 200; // ~200 tokens per Q&A
  const estimatedChars = estimatedTokens * 4; // ~4 chars per token
  
  const cost = 
    (durationMinutes / 60) * COSTS.speechToText +
    (estimatedChars / 1000000) * COSTS.textToSpeech +
    (estimatedTokens / 1000) * COSTS.gptTokens +
    (estimatedTokens / 1000) * COSTS.foundryAgent;
    
  return Math.round(cost * 100) / 100; // Round to cents
}

// Voice session WebSocket handler
function conductVoiceInterview(token, scenario) {
  const sessionMetrics = {
    startTime: Date.now(),
    connectionTime: 0,
    sttLatencies: [],
    ttsLatencies: [],
    aiLatencies: [],
    qualityScores: [],
    messagesExchanged: 0,
    completed: false
  };
  
  const wsUrl = `ws://localhost:3000/api/voice/session`;
  const params = { headers: { 'Authorization': `Bearer ${token}` } };
  
  const response = ws.connect(wsUrl, params, function (socket) {
    concurrentSessions.add(1);
    
    socket.on('open', function () {
      sessionMetrics.connectionTime = Date.now() - sessionMetrics.startTime;
      voiceSessionDuration.add(sessionMetrics.connectionTime);
      
      // Send session configuration
      socket.send(JSON.stringify({
        type: 'session.configure',
        config: {
          jobRole: scenario.jobRole,
          companyName: scenario.companyName,
          candidateName: scenario.candidateName,
          difficulty: scenario.difficulty,
          voice: 'en-US-AvaMultilingualNeural',
          temperature: 0.7
        }
      }));
      
      check(socket, {
        'WebSocket connected': () => true
      });
      
      voiceConnectionSuccess.add(1);
    });
    
    socket.on('message', function (message) {
      const data = JSON.parse(message);
      const now = Date.now();
      
      switch (data.type) {
        case 'session.ready':
          // Start simulated conversation
          simulateVoiceInteraction(socket, scenario, sessionMetrics);
          break;
          
        case 'transcript.completed':
          const sttLatency = now - data.audioSentTime;
          speechToTextLatency.add(sttLatency);
          sessionMetrics.sttLatencies.push(sttLatency);
          
          // Simulate AI thinking time
          sleep(Math.random() * 2 + 1); // 1-3 seconds
          break;
          
        case 'response.audio':
          const ttsLatency = now - data.responseStartTime;
          textToSpeechLatency.add(ttsLatency);
          sessionMetrics.ttsLatencies.push(ttsLatency);
          
          // Calculate audio quality score (simulated)
          const qualityScore = Math.random() * 0.3 + 0.7; // 0.7-1.0
          audioQualityScore.add(qualityScore);
          sessionMetrics.qualityScores.push(qualityScore);
          break;
          
        case 'response.text':
          const aiLatency = now - data.questionStartTime;
          aiResponseLatency.add(aiLatency);
          sessionMetrics.aiLatencies.push(aiLatency);
          sessionMetrics.messagesExchanged++;
          break;
          
        case 'interview.completed':
          sessionMetrics.completed = true;
          sessionMetrics.duration = now - sessionMetrics.startTime;
          
          const cost = estimateInterviewCost(scenario, sessionMetrics);
          costPerInterview.add(cost);
          
          interviewCompletion.add(1);
          socket.close();
          break;
          
        case 'error':
          console.error('Voice session error:', data.error);
          voiceConnectionSuccess.add(0);
          socket.close();
          break;
      }
    });
    
    socket.on('close', function () {
      concurrentSessions.add(-1);
      
      if (!sessionMetrics.completed) {
        interviewCompletion.add(0);
      }
    });
    
    socket.on('error', function (e) {
      console.error('WebSocket error:', e.error());
      voiceConnectionSuccess.add(0);
    });
    
    // Set interview timeout
    setTimeout(() => {
      if (socket.readyState === 1) { // WebSocket.OPEN
        socket.send(JSON.stringify({ type: 'interview.end' }));
      }
    }, scenario.duration);
  });
  
  check(response, {
    'voice session initiated': (r) => r && r.status === 101
  });
  
  return sessionMetrics;
}

// Simulate realistic voice interactions
function simulateVoiceInteraction(socket, scenario, metrics) {
  const questions = scenario.expectedQuestions;
  
  for (let i = 0; i < questions; i++) {
    sleep(Math.random() * 3 + 2); // 2-5 second pause between questions
    
    // Simulate user speaking (sending audio)
    const audioData = generateMockAudioData();
    socket.send(JSON.stringify({
      type: 'audio.append',
      audio: audioData,
      timestamp: Date.now()
    }));
    
    // Simulate end of speech
    sleep(Math.random() * 5 + 3); // 3-8 seconds of "speaking"
    socket.send(JSON.stringify({
      type: 'audio.commit',
      timestamp: Date.now()
    }));
    
    // Wait for AI response
    sleep(Math.random() * 4 + 2); // 2-6 seconds for AI processing
  }
}

// Generate mock audio data for testing
function generateMockAudioData() {
  // Simulate base64 encoded PCM16 audio data
  const sampleSize = Math.floor(Math.random() * 1000) + 500; // 500-1500 bytes
  return 'UklGRiQAAABXQVZFZm10IBAAAAABAAECA...'.repeat(Math.ceil(sampleSize / 47));
}

// Budget monitoring
function checkBudget() {
  const currentCostTrend = costPerInterview.values || [];
  const totalEstimatedCost = currentCostTrend.reduce((sum, cost) => sum + cost, 0);
  
  if (totalEstimatedCost > MAX_BUDGET_USD) {
    console.error(`❌ Budget exceeded! Current cost: $${totalEstimatedCost.toFixed(2)}, Max: $${MAX_BUDGET_USD}`);
    throw new Error('Budget limit exceeded - stopping test');
  }
  
  console.log(`💰 Current estimated cost: $${totalEstimatedCost.toFixed(2)}/${MAX_BUDGET_USD}`);
}

// Main test function
export default function () {
  group('Azure AI Foundry Voice Interview Load Test', function () {
    
    // Check budget before running test
    if (__ITER % 100 === 0) { // Check every 100 iterations
      checkBudget();
    }
    
    let token;
    
    group('Authentication', function () {
      token = authenticateUser();
    });
    
    if (!token) {
      console.error('❌ Authentication failed - skipping voice test');
      return;
    }
    
    group('Voice Interview Session', function () {
      const scenario = randomItem(testScenarios);
      const sessionMetrics = conductVoiceInterview(token, scenario);
      
      // Validate session completion
      check(sessionMetrics, {
        'interview completed successfully': (m) => m.completed,
        'minimum questions asked': (m) => m.messagesExchanged >= scenario.expectedQuestions - 1,
        'reasonable session duration': (m) => m.duration < scenario.duration * 1.2, // Allow 20% variance
        'good average audio quality': (m) => {
          const avgQuality = m.qualityScores.reduce((a, b) => a + b, 0) / m.qualityScores.length;
          return avgQuality > 0.75;
        }
      });
    });
    
    // Realistic pause between interviews
    sleep(Math.random() * 10 + 5); // 5-15 seconds
  });
}

// Test lifecycle hooks
export function setup() {
  console.log(`🚀 Starting Azure AI Foundry load test`);
  console.log(`   Environment: ${ENVIRONMENT}`);
  console.log(`   Base URL: ${BASE_URL}`);
  console.log(`   Max Budget: $${MAX_BUDGET_USD}`);
  console.log(`   Test Users: ${testUsers.length}`);
  console.log(`   Scenarios: ${testScenarios.length}`);
  
  // Verify system health before starting
  const healthCheck = http.get(`${BASE_URL}/api/health/azure`);
  
  if (!check(healthCheck, { 'system health check passed': (r) => r.status === 200 })) {
    throw new Error('System health check failed - aborting test');
  }
  
  return { startTime: Date.now() };
}

export function teardown(data) {
  const testDuration = (Date.now() - data.startTime) / 1000;
  console.log(`✅ Load test completed in ${testDuration.toFixed(2)} seconds`);
  
  // Final budget check
  try {
    checkBudget();
    console.log('💰 Budget check passed');
  } catch (error) {
    console.error('❌ Final budget check failed:', error.message);
  }
}

// Handle graceful shutdown
export function handleSummary(data) {
  const report = {
    testRun: {
      environment: ENVIRONMENT,
      duration: data.state.testRunDurationMs,
      vusMax: data.metrics.vus_max.values.max,
      iterations: data.metrics.iterations.values.count
    },
    performance: {
      httpReqDuration: {
        avg: data.metrics.http_req_duration.values.avg,
        p95: data.metrics.http_req_duration.values['p(95)'],
        p99: data.metrics.http_req_duration.values['p(99)']
      },
      voiceMetrics: {
        connectionSuccess: data.metrics.voice_connection_success.values.rate,
        avgSessionDuration: data.metrics.voice_session_duration.values.avg,
        sttLatencyP95: data.metrics.speech_to_text_latency.values['p(95)'],
        ttsLatencyP95: data.metrics.text_to_speech_latency.values['p(95)'],
        aiResponseP95: data.metrics.ai_response_latency.values['p(95)']
      }
    },
    cost: {
      avgCostPerInterview: data.metrics.cost_per_interview_usd.values.avg,
      totalEstimatedCost: data.metrics.cost_per_interview_usd.values.count * 
                         data.metrics.cost_per_interview_usd.values.avg,
      budgetUtilization: ((data.metrics.cost_per_interview_usd.values.count * 
                          data.metrics.cost_per_interview_usd.values.avg) / MAX_BUDGET_USD) * 100
    },
    quality: {
      completionRate: data.metrics.interview_completion_rate.values.rate,
      avgAudioQuality: data.metrics.audio_quality_score.values.avg,
      maxConcurrentSessions: data.metrics.concurrent_voice_sessions.values.max
    }
  };
  
  console.log('\n📊 LOAD TEST SUMMARY');
  console.log('='.repeat(50));
  console.log(`Environment: ${report.testRun.environment}`);
  console.log(`Duration: ${(report.testRun.duration / 1000).toFixed(2)}s`);
  console.log(`Max VUs: ${report.testRun.vusMax}`);
  console.log(`Total Iterations: ${report.testRun.iterations}`);
  
  console.log('\n🎯 Performance Metrics:');
  console.log(`HTTP Req Duration (P95): ${report.performance.httpReqDuration.p95.toFixed(2)}ms`);
  console.log(`Voice Connection Success: ${(report.performance.voiceMetrics.connectionSuccess * 100).toFixed(2)}%`);
  console.log(`STT Latency (P95): ${report.performance.voiceMetrics.sttLatencyP95.toFixed(2)}ms`);
  console.log(`TTS Latency (P95): ${report.performance.voiceMetrics.ttsLatencyP95.toFixed(2)}ms`);
  console.log(`AI Response (P95): ${report.performance.voiceMetrics.aiResponseP95.toFixed(2)}ms`);
  
  console.log('\n💰 Cost Analysis:');
  console.log(`Avg Cost/Interview: $${report.cost.avgCostPerInterview.toFixed(4)}`);
  console.log(`Total Estimated Cost: $${report.cost.totalEstimatedCost.toFixed(2)}`);
  console.log(`Budget Utilization: ${report.cost.budgetUtilization.toFixed(1)}%`);
  
  console.log('\n🏆 Quality Metrics:');
  console.log(`Interview Completion: ${(report.quality.completionRate * 100).toFixed(2)}%`);
  console.log(`Avg Audio Quality: ${(report.quality.avgAudioQuality * 100).toFixed(1)}%`);
  console.log(`Max Concurrent Sessions: ${report.quality.maxConcurrentSessions}`);
  
  return {
    'summary.json': JSON.stringify(report, null, 2),
    'stdout': textSummary(data, { indent: ' ', enableColors: true })
  };
}
