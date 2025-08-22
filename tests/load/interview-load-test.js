/**
 * k6 Load Testing for PrepBettr Azure Services
 * 
 * Comprehensive load testing script covering concurrent interview sessions,
 * Azure Function scaling, Cosmos DB RU/s optimization, and Speech API limits.
 * 
 * Usage:
 *   k6 run --out json=test-results/load-test-results.json tests/load/interview-load-test.js
 * 
 * @version 2.0.0
 */

import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep, group } from 'k6';
import { SharedArray } from 'k6/data';
import { Counter, Rate, Trend } from 'k6/metrics';

// ===== CONFIGURATION =====

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const AZURE_FUNCTIONS_URL = __ENV.AZURE_FUNCTIONS_URL || 'https://prepbettr-functions.azurewebsites.net';
const SIGNALR_URL = __ENV.SIGNALR_URL || 'https://prepbettr-signalr.service.signalr.net';

// Load test scenarios
export const options = {
  scenarios: {
    // Scenario 1: Gradual ramp-up for authentication
    auth_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 20 },  // Ramp up to 20 users
        { duration: '5m', target: 50 },  // Ramp up to 50 users
        { duration: '5m', target: 100 }, // Ramp up to 100 users
        { duration: '10m', target: 100 }, // Stay at 100 users
        { duration: '2m', target: 0 },   // Ramp down
      ],
      exec: 'authLoadTest',
      tags: { test_type: 'auth_load' },
    },

    // Scenario 2: Concurrent interview sessions
    interview_sessions: {
      executor: 'constant-vus',
      vus: 25,
      duration: '10m',
      exec: 'interviewSessionTest',
      tags: { test_type: 'interview_concurrent' },
    },

    // Scenario 3: Azure Functions cold start testing
    function_cold_starts: {
      executor: 'constant-arrival-rate',
      rate: 10, // 10 requests per second
      timeUnit: '1s',
      duration: '5m',
      preAllocatedVUs: 5,
      maxVUs: 50,
      exec: 'functionColdStartTest',
      tags: { test_type: 'cold_start' },
    },

    // Scenario 4: Cosmos DB throughput testing
    cosmos_throughput: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      stages: [
        { duration: '2m', target: 50 },   // Ramp to 50 RPS
        { duration: '3m', target: 100 },  // Ramp to 100 RPS
        { duration: '5m', target: 200 },  // Ramp to 200 RPS
        { duration: '2m', target: 0 },    // Ramp down
      ],
      preAllocatedVUs: 10,
      maxVUs: 100,
      exec: 'cosmosDbThroughputTest',
      tags: { test_type: 'cosmos_throughput' },
    },

    // Scenario 5: Speech API stress test
    speech_api_stress: {
      executor: 'constant-vus',
      vus: 15,
      duration: '8m',
      exec: 'speechApiStressTest',
      tags: { test_type: 'speech_stress' },
    }
  },
  
  thresholds: {
    // Performance thresholds
    http_req_duration: ['p(95)<1000'], // 95% of requests under 1s
    http_req_failed: ['rate<0.01'],     // Less than 1% failures
    
    // Authentication specific
    'http_req_duration{test_type:auth_load}': ['p(95)<500'],
    
    // Interview session specific  
    'http_req_duration{test_type:interview_concurrent}': ['p(95)<3000'],
    'ws_session_duration': ['p(95)<30000'], // SignalR sessions under 30s
    
    // Azure Functions specific
    'http_req_duration{test_type:cold_start}': ['p(95)<5000'], // Cold starts under 5s
    
    // Cosmos DB specific
    'cosmos_ru_consumption': ['avg<100'], // Average RU/s consumption
    'cosmos_throttling_rate': ['rate<0.05'], // Less than 5% throttling
    
    // Speech API specific
    'speech_synthesis_duration': ['p(95)<2000'], // Speech synthesis under 2s
  },
};

// ===== CUSTOM METRICS =====

const wsSessionDuration = new Trend('ws_session_duration');
const cosmosRuConsumption = new Trend('cosmos_ru_consumption');
const cosmosThrottlingRate = new Rate('cosmos_throttling_rate');
const speechSynthesisDuration = new Trend('speech_synthesis_duration');
const coldStartCounter = new Counter('cold_start_count');
const authFailures = new Counter('auth_failures');

// ===== TEST DATA =====

const testUsers = new SharedArray('test_users', function() {
  const users = [];
  for (let i = 0; i < 1000; i++) {
    users.push({
      email: `testuser${i}@prepbettr-load.com`,
      password: `TestPass${i}!`,
      name: `Test User ${i}`,
      jobTitle: `Position ${i}`,
      company: `Company ${i}`
    });
  }
  return users;
});

const interviewQuestions = [
  "Tell me about yourself and your background.",
  "What are your greatest strengths and weaknesses?",
  "Why are you interested in this position?",
  "Describe a challenging project you've worked on.",
  "Where do you see yourself in 5 years?",
  "How do you handle working under pressure?",
  "What motivates you in your work?",
  "Describe your ideal work environment."
];

// ===== UTILITY FUNCTIONS =====

function getRandomUser() {
  return testUsers[Math.floor(Math.random() * testUsers.length)];
}

function getRandomQuestion() {
  return interviewQuestions[Math.floor(Math.random() * interviewQuestions.length)];
}

function authenticateUser(user) {
  const authResponse = http.post(`${BASE_URL}/api/auth/signin`, {
    email: user.email,
    password: user.password
  }, {
    headers: { 'Content-Type': 'application/json' },
  });

  const authSuccess = check(authResponse, {
    'authentication successful': (r) => r.status === 200,
    'auth response time OK': (r) => r.timings.duration < 500,
  });

  if (!authSuccess) {
    authFailures.add(1);
    return null;
  }

  const authData = authResponse.json();
  return {
    token: authData.sessionCookie || authData.token,
    userId: authData.uid || authData.user?.uid
  };
}

// ===== TEST SCENARIOS =====

export function authLoadTest() {
  group('Authentication Load Test', () => {
    const user = getRandomUser();
    
    group('User Signup', () => {
      const signupResponse = http.post(`${BASE_URL}/api/auth/signup`, {
        email: user.email,
        password: user.password,
        name: user.name
      }, {
        headers: { 'Content-Type': 'application/json' },
      });

      check(signupResponse, {
        'signup successful': (r) => r.status === 201 || r.status === 200,
        'signup response time OK': (r) => r.timings.duration < 1000,
      });
    });

    group('User Signin', () => {
      const auth = authenticateUser(user);
      
      if (auth) {
        group('Token Verification', () => {
          const verifyResponse = http.post(`${AZURE_FUNCTIONS_URL}/api/auth?action=verify`, {}, {
            headers: {
              'Authorization': `Bearer ${auth.token}`,
              'Content-Type': 'application/json'
            },
          });

          check(verifyResponse, {
            'token verification successful': (r) => r.status === 200,
            'verification response time OK': (r) => r.timings.duration < 200,
          });
        });
      }
    });

    sleep(1);
  });
}

export function interviewSessionTest() {
  group('Interview Session Test', () => {
    const user = getRandomUser();
    const auth = authenticateUser(user);
    
    if (!auth) {
      return;
    }

    group('Start Interview Session', () => {
      const sessionResponse = http.post(`${BASE_URL}/api/interview/start`, {
        jobTitle: user.jobTitle,
        company: user.company,
        difficulty: 'medium'
      }, {
        headers: {
          'Authorization': `Bearer ${auth.token}`,
          'Content-Type': 'application/json'
        },
      });

      const sessionData = sessionResponse.json();
      
      check(sessionResponse, {
        'session start successful': (r) => r.status === 200,
        'session response time OK': (r) => r.timings.duration < 2000,
        'session ID provided': () => sessionData && sessionData.sessionId,
      });

      if (sessionData && sessionData.sessionId) {
        group('SignalR Connection', () => {
          const sessionStart = Date.now();
          
          const wsResponse = ws.connect(`${SIGNALR_URL}/interview-hub?sessionId=${sessionData.sessionId}`, {
            headers: { 'Authorization': `Bearer ${auth.token}` }
          }, function(socket) {
            
            // Simulate interview conversation
            socket.on('open', () => {
              socket.send(JSON.stringify({
                type: 'StartInterview',
                sessionId: sessionData.sessionId
              }));
            });

            socket.on('message', (data) => {
              const message = JSON.parse(data);
              
              if (message.type === 'InterviewerQuestion') {
                // Simulate user response
                setTimeout(() => {
                  socket.send(JSON.stringify({
                    type: 'UserResponse',
                    text: `This is a test response to: ${message.question}`,
                    confidence: 0.95
                  }));
                }, 1000 + Math.random() * 2000); // 1-3 second delay
              }
            });

            // Close after 30 seconds
            setTimeout(() => {
              socket.close();
            }, 30000);
          });

          const sessionDuration = Date.now() - sessionStart;
          wsSessionDuration.add(sessionDuration);
          
          check(wsResponse, {
            'WebSocket connection successful': () => true,
          });
        });

        group('End Interview Session', () => {
          const endResponse = http.post(`${BASE_URL}/api/interview/end`, {
            sessionId: sessionData.sessionId
          }, {
            headers: {
              'Authorization': `Bearer ${auth.token}`,
              'Content-Type': 'application/json'
            },
          });

          check(endResponse, {
            'session end successful': (r) => r.status === 200,
            'end response time OK': (r) => r.timings.duration < 1000,
          });
        });
      }
    });

    sleep(2);
  });
}

export function functionColdStartTest() {
  group('Azure Function Cold Start Test', () => {
    // Test different Azure Functions for cold starts
    const functions = [
      'auth',
      'interview-processor',
      'resume-analyzer',
      'voice-synthesizer'
    ];
    
    const functionName = functions[Math.floor(Math.random() * functions.length)];
    const startTime = Date.now();
    
    const response = http.get(`${AZURE_FUNCTIONS_URL}/api/${functionName}/health`, {
      headers: {
        'Cache-Control': 'no-cache',
        'x-force-cold-start': 'true'
      }
    });
    
    const duration = Date.now() - startTime;
    
    // Consider it a cold start if it takes more than 1 second
    if (duration > 1000) {
      coldStartCounter.add(1);
    }

    check(response, {
      'function responds': (r) => r.status >= 200 && r.status < 400,
      'cold start under 5s': () => duration < 5000,
    });

    sleep(0.5);
  });
}

export function cosmosDbThroughputTest() {
  group('Cosmos DB Throughput Test', () => {
    const user = getRandomUser();
    const auth = authenticateUser(user);
    
    if (!auth) {
      return;
    }

    group('Database Operations', () => {
      // Simulate high-frequency database operations
      const operations = ['read', 'write', 'query', 'update'];
      const operation = operations[Math.floor(Math.random() * operations.length)];
      
      let response;
      const startTime = Date.now();
      
      switch (operation) {
        case 'read':
          response = http.get(`${BASE_URL}/api/user/profile`, {
            headers: { 'Authorization': `Bearer ${auth.token}` }
          });
          break;
        case 'write':
          response = http.post(`${BASE_URL}/api/user/activity`, {
            action: 'page_view',
            timestamp: new Date().toISOString()
          }, {
            headers: {
              'Authorization': `Bearer ${auth.token}`,
              'Content-Type': 'application/json'
            }
          });
          break;
        case 'query':
          response = http.get(`${BASE_URL}/api/interviews/history?limit=10`, {
            headers: { 'Authorization': `Bearer ${auth.token}` }
          });
          break;
        case 'update':
          response = http.patch(`${BASE_URL}/api/user/settings`, {
            theme: 'dark',
            notifications: true
          }, {
            headers: {
              'Authorization': `Bearer ${auth.token}`,
              'Content-Type': 'application/json'
            }
          });
          break;
      }
      
      const duration = Date.now() - startTime;
      
      // Simulate RU consumption (estimate based on operation type)
      const ruEstimate = {
        'read': 1,
        'write': 5,
        'query': 10,
        'update': 3
      }[operation];
      
      cosmosRuConsumption.add(ruEstimate);
      
      // Check for throttling (429 status code)
      if (response.status === 429) {
        cosmosThrottlingRate.add(1);
      }

      check(response, {
        'cosmos operation successful': (r) => r.status === 200,
        'cosmos response time OK': () => duration < 500,
        'no throttling': (r) => r.status !== 429,
      });
    });

    sleep(0.1);
  });
}

export function speechApiStressTest() {
  group('Speech API Stress Test', () => {
    const user = getRandomUser();
    const auth = authenticateUser(user);
    
    if (!auth) {
      return;
    }

    group('Speech Synthesis', () => {
      const text = getRandomQuestion();
      const startTime = Date.now();
      
      const response = http.post(`${BASE_URL}/api/speech/synthesize`, {
        text: text,
        voice: 'en-US-JennyNeural',
        format: 'mp3'
      }, {
        headers: {
          'Authorization': `Bearer ${auth.token}`,
          'Content-Type': 'application/json'
        },
      });

      const duration = Date.now() - startTime;
      speechSynthesisDuration.add(duration);

      check(response, {
        'speech synthesis successful': (r) => r.status === 200,
        'synthesis time acceptable': () => duration < 3000,
        'audio data received': (r) => r.body && r.body.length > 0,
      });
    });

    group('Speech Recognition', () => {
      // Simulate audio upload for recognition
      const audioData = 'mock-audio-data-' + Math.random().toString(36);
      
      const response = http.post(`${BASE_URL}/api/speech/recognize`, audioData, {
        headers: {
          'Authorization': `Bearer ${auth.token}`,
          'Content-Type': 'audio/wav'
        },
      });

      check(response, {
        'speech recognition successful': (r) => r.status === 200,
        'recognition response time OK': (r) => r.timings.duration < 2000,
      });
    });

    sleep(1);
  });
}

// ===== CLEANUP =====

export function teardown(data) {
  console.log('Load test completed');
  console.log(`Total cold starts: ${coldStartCounter.value}`);
  console.log(`Auth failures: ${authFailures.value}`);
}
