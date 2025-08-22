/**
 * Performance Validation Script for PrepBettr Optimization
 * 
 * Validates performance improvements after implementing:
 * - Redis caching layer
 * - Cosmos DB optimization 
 * - Function cold start reduction
 * - CDN integration
 * 
 * Usage: k6 run --vus 10 --duration 2m performance-validation.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// ===== CUSTOM METRICS =====

const errorRate = new Rate('error_rate');
const cacheHitRate = new Rate('cache_hit_rate');
const cosmosRUConsumption = new Trend('cosmos_ru_consumption');
const functionColdStarts = new Counter('function_cold_starts');
const redisLatency = new Trend('redis_latency');

// ===== CONFIGURATION =====

const BASE_URL = __ENV.BASE_URL || 'https://prepbettr-dev.azurewebsites.net';

// Performance thresholds (post-optimization targets)
const THRESHOLDS = {
  // API Response Times
  http_req_duration: ['p(95)<1000', 'p(99)<2000'],  // 95% under 1s, 99% under 2s
  
  // Error Rates
  http_req_failed: ['rate<0.05'],  // Less than 5% error rate
  error_rate: ['rate<0.05'],       // Custom error tracking
  
  // Cache Performance
  cache_hit_rate: ['rate>0.8'],    // Cache hit rate above 80%
  redis_latency: ['p(95)<50'],     // Redis latency under 50ms
  
  // Database Performance
  cosmos_ru_consumption: ['p(95)<100'],  // RU consumption under 100 per request
  
  // Function Performance
  function_cold_starts: ['count<10'],    // Less than 10 cold starts total
};

export const options = {
  stages: [
    { duration: '30s', target: 5 },   // Warm up
    { duration: '1m', target: 10 },   // Normal load
    { duration: '30s', target: 20 },  // Peak load
    { duration: '30s', target: 0 },   // Cool down
  ],
  
  thresholds: THRESHOLDS,
  
  // Additional options
  maxRedirects: 4,
  batch: 10,
  batchPerHost: 6,
  
  ext: {
    loadimpact: {
      name: 'PrepBettr Performance Validation',
      distribution: {
        'amazon:us:ashburn': { loadZone: 'amazon:us:ashburn', percent: 50 },
        'amazon:us:palo alto': { loadZone: 'amazon:us:palo alto', percent: 50 },
      },
    },
  },
};

// ===== TEST DATA =====

const TEST_USERS = [
  { email: 'test1@example.com', userId: 'user_001' },
  { email: 'test2@example.com', userId: 'user_002' },
  { email: 'test3@example.com', userId: 'user_003' },
];

const TEST_SCENARIOS = [
  'frontend-engineer',
  'backend-engineer', 
  'fullstack-developer',
  'data-scientist',
  'product-manager'
];

// ===== HELPER FUNCTIONS =====

function getAuthHeaders() {
  // In a real scenario, you'd authenticate and get a token
  return {
    'Authorization': 'Bearer test-token',
    'Content-Type': 'application/json',
    'User-Agent': 'k6-performance-test/1.0'
  };
}

function trackCachePerformance(response) {
  const cacheStatus = response.headers['X-Cache-Status'] || 'miss';
  cacheHitRate.add(cacheStatus === 'hit');
  
  if (response.headers['X-Redis-Latency']) {
    redisLatency.add(parseFloat(response.headers['X-Redis-Latency']));
  }
}

function trackCosmosMetrics(response) {
  if (response.headers['X-Cosmos-RU']) {
    cosmosRUConsumption.add(parseFloat(response.headers['X-Cosmos-RU']));
  }
}

function trackFunctionMetrics(response) {
  if (response.headers['X-Cold-Start'] === 'true') {
    functionColdStarts.add(1);
  }
}

// ===== TEST SCENARIOS =====

export default function() {
  const testUser = TEST_USERS[Math.floor(Math.random() * TEST_USERS.length)];
  const scenario = TEST_SCENARIOS[Math.floor(Math.random() * TEST_SCENARIOS.length)];
  
  // Test 1: Health Check (should be cached)
  testHealthEndpoints();
  
  // Test 2: Authentication Flow
  testAuthenticationFlow(testUser);
  
  // Test 3: Configuration API (Redis cached)
  testConfigurationAPI();
  
  // Test 4: Interview Creation (Cosmos DB write)
  testInterviewCreation(testUser, scenario);
  
  // Test 5: Interview Retrieval (Cosmos DB read + cache)
  testInterviewRetrieval(testUser);
  
  // Test 6: Static Asset Loading (CDN)
  testStaticAssets();
  
  // Test 7: Voice Interview API (Functions)
  testVoiceInterviewAPI(testUser);
  
  sleep(1);
}

function testHealthEndpoints() {
  const endpoints = [
    '/api/health',
    '/api/health/redis', 
    '/api/health/cosmos',
    '/api/health/azure'
  ];
  
  endpoints.forEach(endpoint => {
    const response = http.get(`${BASE_URL}${endpoint}`, {
      headers: getAuthHeaders(),
      tags: { test: 'health-check' }
    });
    
    const success = check(response, {
      'health check status is 200': (r) => r.status === 200,
      'health check response time < 500ms': (r) => r.timings.duration < 500,
      'health check has proper format': (r) => {
        const body = JSON.parse(r.body);
        return body.hasOwnProperty('healthy') && body.hasOwnProperty('timestamp');
      }
    });
    
    errorRate.add(!success);
    trackCachePerformance(response);
  });
}

function testAuthenticationFlow(user) {
  // Simulate login
  const loginPayload = {
    email: user.email,
    password: 'test-password'
  };
  
  const loginResponse = http.post(`${BASE_URL}/api/auth/login`, 
    JSON.stringify(loginPayload), 
    {
      headers: getAuthHeaders(),
      tags: { test: 'auth-login' }
    }
  );
  
  const success = check(loginResponse, {
    'login status is 200': (r) => r.status === 200,
    'login response time < 1000ms': (r) => r.timings.duration < 1000,
    'login returns token': (r) => {
      const body = JSON.parse(r.body);
      return body.token && body.token.length > 0;
    }
  });
  
  errorRate.add(!success);
  trackFunctionMetrics(loginResponse);
  
  // Test token validation
  if (success) {
    const token = JSON.parse(loginResponse.body).token;
    
    const validateResponse = http.get(`${BASE_URL}/api/auth/validate`, {
      headers: {
        ...getAuthHeaders(),
        'Authorization': `Bearer ${token}`
      },
      tags: { test: 'auth-validate' }
    });
    
    check(validateResponse, {
      'token validation status is 200': (r) => r.status === 200,
      'token validation response time < 300ms': (r) => r.timings.duration < 300
    });
    
    trackCachePerformance(validateResponse);
  }
}

function testConfigurationAPI() {
  const configEndpoints = [
    '/api/config/features',
    '/api/config/quotas',
    '/api/config/core'
  ];
  
  configEndpoints.forEach(endpoint => {
    const response = http.get(`${BASE_URL}${endpoint}`, {
      headers: getAuthHeaders(),
      tags: { test: 'config-api' }
    });
    
    const success = check(response, {
      'config API status is 200': (r) => r.status === 200,
      'config API response time < 200ms': (r) => r.timings.duration < 200,
      'config API returns JSON': (r) => {
        try {
          JSON.parse(r.body);
          return true;
        } catch {
          return false;
        }
      }
    });
    
    errorRate.add(!success);
    trackCachePerformance(response);
    trackCosmosMetrics(response);
  });
}

function testInterviewCreation(user, scenario) {
  const interviewPayload = {
    userId: user.userId,
    type: 'technical',
    jobRole: scenario,
    companyName: 'Test Company',
    difficulty: 'medium',
    duration: 30
  };
  
  const response = http.post(`${BASE_URL}/api/interviews/create`,
    JSON.stringify(interviewPayload),
    {
      headers: getAuthHeaders(),
      tags: { test: 'interview-create' }
    }
  );
  
  const success = check(response, {
    'interview creation status is 201': (r) => r.status === 201,
    'interview creation response time < 1500ms': (r) => r.timings.duration < 1500,
    'interview creation returns ID': (r) => {
      const body = JSON.parse(r.body);
      return body.interviewId && body.interviewId.length > 0;
    }
  });
  
  errorRate.add(!success);
  trackCosmosMetrics(response);
  trackFunctionMetrics(response);
}

function testInterviewRetrieval(user) {
  const response = http.get(`${BASE_URL}/api/interviews?userId=${user.userId}`, {
    headers: getAuthHeaders(),
    tags: { test: 'interview-retrieve' }
  });
  
  const success = check(response, {
    'interview retrieval status is 200': (r) => r.status === 200,
    'interview retrieval response time < 800ms': (r) => r.timings.duration < 800,
    'interview retrieval returns array': (r) => {
      const body = JSON.parse(r.body);
      return Array.isArray(body.interviews);
    }
  });
  
  errorRate.add(!success);
  trackCachePerformance(response);
  trackCosmosMetrics(response);
}

function testStaticAssets() {
  const staticAssets = [
    '/_next/static/css/app.css',
    '/_next/static/js/app.js',
    '/images/logo.png',
    '/favicon.ico'
  ];
  
  staticAssets.forEach(asset => {
    const response = http.get(`${BASE_URL}${asset}`, {
      tags: { test: 'static-assets' }
    });
    
    check(response, {
      'static asset loads successfully': (r) => r.status === 200,
      'static asset response time < 300ms': (r) => r.timings.duration < 300,
      'static asset has cache headers': (r) => {
        return r.headers['Cache-Control'] || r.headers['CDN-Cache-Status'];
      }
    });
  });
}

function testVoiceInterviewAPI(user) {
  // Test voice interview session creation
  const sessionPayload = {
    userId: user.userId,
    interviewType: 'voice',
    language: 'en-US'
  };
  
  const sessionResponse = http.post(`${BASE_URL}/api/voice/session`,
    JSON.stringify(sessionPayload),
    {
      headers: getAuthHeaders(),
      tags: { test: 'voice-session' }
    }
  );
  
  const success = check(sessionResponse, {
    'voice session creation status is 200': (r) => r.status === 200,
    'voice session response time < 2000ms': (r) => r.timings.duration < 2000,
    'voice session returns session ID': (r) => {
      const body = JSON.parse(r.body);
      return body.sessionId && body.sessionId.length > 0;
    }
  });
  
  errorRate.add(!success);
  trackFunctionMetrics(sessionResponse);
  
  if (success) {
    const sessionId = JSON.parse(sessionResponse.body).sessionId;
    
    // Test speech processing endpoint
    const speechPayload = {
      sessionId: sessionId,
      audioData: 'base64-encoded-audio-data',
      timestamp: Date.now()
    };
    
    const speechResponse = http.post(`${BASE_URL}/api/voice/process`,
      JSON.stringify(speechPayload),
      {
        headers: getAuthHeaders(),
        tags: { test: 'voice-processing' }
      }
    );
    
    check(speechResponse, {
      'speech processing status is 200': (r) => r.status === 200,
      'speech processing response time < 3000ms': (r) => r.timings.duration < 3000
    });
    
    trackFunctionMetrics(speechResponse);
  }
}

// ===== SETUP AND TEARDOWN =====

export function setup() {
  console.log('🚀 Starting PrepBettr Performance Validation');
  console.log(`Target: ${BASE_URL}`);
  console.log('Validating optimizations:');
  console.log('- Redis caching layer');
  console.log('- Cosmos DB optimization');
  console.log('- Function cold start reduction');
  console.log('- CDN integration');
  
  // Warm up critical endpoints
  const warmupEndpoints = [
    '/api/health',
    '/api/config/features',
    '/api/auth/validate'
  ];
  
  warmupEndpoints.forEach(endpoint => {
    http.get(`${BASE_URL}${endpoint}`, { tags: { test: 'warmup' } });
  });
  
  return { timestamp: Date.now() };
}

export function teardown(data) {
  console.log('📊 Performance Validation Complete');
  console.log(`Test Duration: ${(Date.now() - data.timestamp) / 1000}s`);
  
  // Summary recommendations based on results
  console.log('\n🎯 Optimization Recommendations:');
  console.log('- Monitor Redis hit rate (target: >80%)');
  console.log('- Track Cosmos RU consumption (target: <100 RU/req)');
  console.log('- Minimize function cold starts');
  console.log('- Ensure CDN cache headers are set');
  console.log('- Monitor P95 latency across all endpoints');
}

// ===== SMOKE TEST =====

export function handleSummary(data) {
  return {
    'performance-summary.json': JSON.stringify(data, null, 2),
    stdout: `
📊 PrepBettr Performance Validation Results
==========================================

🎯 Key Metrics:
- Average Response Time: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms
- P95 Response Time: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms
- Error Rate: ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%
- Cache Hit Rate: ${data.metrics.cache_hit_rate ? (data.metrics.cache_hit_rate.values.rate * 100).toFixed(2) : 'N/A'}%

${data.metrics.checks.values.rate >= 0.95 ? '✅ PASSED' : '❌ FAILED'} - Overall Performance Validation
${data.metrics.http_req_duration.values['p(95)'] < 1000 ? '✅ PASSED' : '❌ FAILED'} - Response Time Target (P95 < 1000ms)
${data.metrics.http_req_failed.values.rate < 0.05 ? '✅ PASSED' : '❌ FAILED'} - Error Rate Target (<5%)
${data.metrics.cache_hit_rate && data.metrics.cache_hit_rate.values.rate > 0.8 ? '✅ PASSED' : '⚠️  REVIEW'} - Cache Performance (>80% hit rate)

🔧 Next Steps:
${data.metrics.checks.values.rate < 0.95 ? '- Investigate failed checks and optimize slow endpoints' : ''}
${data.metrics.cache_hit_rate && data.metrics.cache_hit_rate.values.rate <= 0.8 ? '- Improve cache strategy and TTL settings' : ''}
${data.metrics.http_req_duration.values['p(95)'] >= 1000 ? '- Optimize slow endpoints and database queries' : ''}
${data.metrics.http_req_failed.values.rate >= 0.05 ? '- Fix error-prone endpoints and improve error handling' : ''}
`
  };
}
