import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Trend, Rate, Counter } from 'k6/metrics';

// Custom metrics
const interviewGenerationDuration = new Trend('interview_generation_duration');
const resumeProcessingDuration = new Trend('resume_processing_duration');
const voiceSessionDuration = new Trend('voice_session_duration');
const queueProcessingRate = new Rate('queue_processing_success_rate');
const apiErrorRate = new Rate('api_error_rate');
const concurrentUsers = new Counter('concurrent_users');

// Test data
const testJobs = new SharedArray('test_jobs', function () {
  return [
    {
      jobTitle: 'Senior Software Engineer',
      company: 'Tech Corp',
      jobDescription: 'Develop scalable web applications using React and Node.js. 5+ years experience required.',
    },
    {
      jobTitle: 'Frontend Developer',
      company: 'StartupXYZ',
      jobDescription: 'Build modern UI components with React, TypeScript, and Tailwind CSS.',
    },
    {
      jobTitle: 'Full Stack Developer',
      company: 'InnovateLabs',
      jobDescription: 'Work with React, Node.js, PostgreSQL, and AWS. Lead technical initiatives.',
    },
    {
      jobTitle: 'DevOps Engineer',
      company: 'CloudFirst',
      jobDescription: 'Manage CI/CD pipelines, Kubernetes clusters, and infrastructure as code.',
    },
    {
      jobTitle: 'Data Scientist',
      company: 'AI Solutions',
      jobDescription: 'Build ML models using Python, TensorFlow, and work with large datasets.',
    },
  ];
});

// Test configuration based on environment
const BASE_URL = __ENV.BASE_URL || 'https://prepbettr-staging.azurewebsites.net';
const FIRESTORE_EMULATOR = __ENV.FIRESTORE_EMULATOR_HOST || 'localhost:8080';

// Load test stages
export let options = {
  scenarios: {
    // Spike test - sudden increase in load
    spike_test: {
      executor: 'ramping-vus',
      stages: [
        { duration: '30s', target: 50 }, // Ramp up to 50 users
        { duration: '1m', target: 50 },  // Stay at 50 users
        { duration: '30s', target: 0 },  // Ramp down
      ],
      tags: { test_type: 'spike' },
    },
    
    // Load test - sustained load
    load_test: {
      executor: 'constant-vus',
      vus: 20,
      duration: '5m',
      tags: { test_type: 'load' },
    },
    
    // Stress test - beyond normal capacity
    stress_test: {
      executor: 'ramping-vus',
      stages: [
        { duration: '2m', target: 100 }, // Ramp up to 100 users
        { duration: '5m', target: 100 }, // Stay at 100 users
        { duration: '2m', target: 0 },   // Ramp down
      ],
      tags: { test_type: 'stress' },
    },
  },
  
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests under 2s
    http_req_failed: ['rate<0.05'],    // Error rate under 5%
    'interview_generation_duration': ['p(90)<10000'], // 90% under 10s
    'resume_processing_duration': ['p(90)<15000'],    // 90% under 15s
    'queue_processing_success_rate': ['rate>0.95'],   // 95% success rate
  },
};

// Generate authentication token for testing
function getTestToken(userId = null) {
  const testUserId = userId || `load-test-user-${Math.floor(Math.random() * 1000)}`;
  // In real implementation, this would call your auth service
  return `Bearer test-token-${testUserId}`;
}

// Interview generation load test
export function testInterviewGeneration() {
  const jobData = testJobs[Math.floor(Math.random() * testJobs.length)];
  const token = getTestToken();
  
  const payload = JSON.stringify({
    jobTitle: jobData.jobTitle,
    company: jobData.company,
    jobDescription: jobData.jobDescription,
    questionCount: 5,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token,
    },
    tags: { 
      endpoint: 'interview_generation',
      job_title: jobData.jobTitle,
    },
  };

  const startTime = Date.now();
  const response = http.post(`${BASE_URL}/api/interviews/generate`, payload, params);
  const duration = Date.now() - startTime;

  // Record metrics
  interviewGenerationDuration.add(duration);
  concurrentUsers.add(1);

  const success = check(response, {
    'interview generation status is 200': (r) => r.status === 200,
    'interview generation has questions': (r) => {
      try {
        const data = JSON.parse(r.body);
        return data.questions && data.questions.length > 0;
      } catch (e) {
        return false;
      }
    },
    'interview generation response time OK': (r) => duration < 15000,
  });

  queueProcessingRate.add(success);
  
  if (response.status !== 200) {
    apiErrorRate.add(1);
    console.error(`Interview generation failed: ${response.status} ${response.body}`);
  } else {
    apiErrorRate.add(0);
  }

  return success;
}

// Resume processing load test
export function testResumeProcessing() {
  const token = getTestToken();
  
  // Simulate resume upload with mock PDF data
  const resumeContent = 'Mock resume content for load testing. Software Engineer with 5 years experience in React, Node.js, and AWS.';
  
  const payload = {
    fileName: `test-resume-${Date.now()}.pdf`,
    fileContent: resumeContent,
    contentType: 'application/pdf',
  };

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token,
    },
    tags: { 
      endpoint: 'resume_processing',
    },
  };

  const startTime = Date.now();
  const response = http.post(`${BASE_URL}/api/resumes/process`, JSON.stringify(payload), params);
  const duration = Date.now() - startTime;

  // Record metrics
  resumeProcessingDuration.add(duration);

  const success = check(response, {
    'resume processing status is 200': (r) => r.status === 200,
    'resume processing has extracted data': (r) => {
      try {
        const data = JSON.parse(r.body);
        return data.extractedText && data.parsedSections;
      } catch (e) {
        return false;
      }
    },
    'resume processing response time OK': (r) => duration < 20000,
  });

  queueProcessingRate.add(success);
  
  if (response.status !== 200) {
    apiErrorRate.add(1);
  } else {
    apiErrorRate.add(0);
  }

  return success;
}

// Voice interview session load test
export function testVoiceSession() {
  const token = getTestToken();
  
  // Start voice session
  const startPayload = JSON.stringify({
    interviewId: `voice-test-${Date.now()}`,
    language: 'en-US',
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token,
    },
    tags: { 
      endpoint: 'voice_session',
    },
  };

  const startTime = Date.now();
  const startResponse = http.post(`${BASE_URL}/api/voice/session/start`, startPayload, params);
  
  if (startResponse.status !== 200) {
    apiErrorRate.add(1);
    return false;
  }

  const sessionData = JSON.parse(startResponse.body);
  const sessionId = sessionData.sessionId;

  // Simulate voice interaction
  sleep(Math.random() * 2 + 1); // 1-3 second delay
  
  const interactionPayload = JSON.stringify({
    sessionId: sessionId,
    transcript: 'This is a test answer for load testing purposes.',
    action: 'answer_question',
  });

  const interactionResponse = http.post(`${BASE_URL}/api/voice/session/interact`, interactionPayload, params);
  
  // End session
  const endPayload = JSON.stringify({
    sessionId: sessionId,
  });

  const endResponse = http.post(`${BASE_URL}/api/voice/session/end`, endPayload, params);
  const duration = Date.now() - startTime;

  // Record metrics
  voiceSessionDuration.add(duration);

  const success = check(null, {
    'voice session start successful': () => startResponse.status === 200,
    'voice interaction successful': () => interactionResponse.status === 200,
    'voice session end successful': () => endResponse.status === 200,
    'voice session total time OK': () => duration < 30000,
  });

  queueProcessingRate.add(success);
  
  if (!success) {
    apiErrorRate.add(1);
  } else {
    apiErrorRate.add(0);
  }

  return success;
}

// Queue health check
export function testQueueHealth() {
  const params = {
    headers: {
      'Authorization': getTestToken(),
    },
    tags: { 
      endpoint: 'queue_health',
    },
  };

  const response = http.get(`${BASE_URL}/api/queue/health`, params);
  
  return check(response, {
    'queue health check successful': (r) => r.status === 200,
    'queue has capacity': (r) => {
      try {
        const data = JSON.parse(r.body);
        return data.availableCapacity > 0;
      } catch (e) {
        return false;
      }
    },
  });
}

// Database connection test
export function testDatabaseConnection() {
  const params = {
    headers: {
      'Authorization': getTestToken(),
    },
    tags: { 
      endpoint: 'database_health',
    },
  };

  const response = http.get(`${BASE_URL}/api/health/database`, params);
  
  return check(response, {
    'database connection healthy': (r) => r.status === 200,
    'database response time acceptable': (r) => r.timings.duration < 1000,
  });
}

// Main test function
export default function () {
  // Distribute load across different operations
  const operation = Math.random();
  
  if (operation < 0.4) {
    // 40% interview generation
    testInterviewGeneration();
  } else if (operation < 0.7) {
    // 30% resume processing
    testResumeProcessing();
  } else if (operation < 0.9) {
    // 20% voice sessions
    testVoiceSession();
  } else {
    // 10% health checks
    testQueueHealth();
    testDatabaseConnection();
  }

  // Random sleep between 1-5 seconds to simulate real user behavior
  sleep(Math.random() * 4 + 1);
}

// Setup function - runs once before the test
export function setup() {
  console.log('Starting load test setup...');
  
  // Warm up the system
  const warmupResponse = http.get(`${BASE_URL}/api/health`);
  if (warmupResponse.status !== 200) {
    console.error('System health check failed during setup');
  }
  
  // Check queue capacity
  const queueResponse = http.get(`${BASE_URL}/api/queue/health`);
  if (queueResponse.status !== 200) {
    console.error('Queue health check failed during setup');
  }

  console.log('Load test setup completed');
  
  return {
    baseUrl: BASE_URL,
    startTime: Date.now(),
  };
}

// Teardown function - runs once after the test
export function teardown(data) {
  const testDuration = (Date.now() - data.startTime) / 1000;
  console.log(`Load test completed in ${testDuration} seconds`);
  
  // Optional: Clean up test data
  const cleanupResponse = http.post(`${BASE_URL}/api/test/cleanup`, JSON.stringify({
    testSession: 'load-test',
    cleanupTime: new Date().toISOString(),
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': getTestToken('admin'),
    },
  });
  
  if (cleanupResponse.status === 200) {
    console.log('Test cleanup completed successfully');
  } else {
    console.warn('Test cleanup failed or not implemented');
  }
}

// Handle different test scenarios
export function handleSummary(data) {
  const summary = {
    testType: 'Queue Throughput Load Test',
    timestamp: new Date().toISOString(),
    duration: data.metrics.iteration_duration.values.avg,
    throughput: {
      requestsPerSecond: data.metrics.http_reqs.values.rate,
      totalRequests: data.metrics.http_reqs.values.count,
    },
    performance: {
      avgResponseTime: data.metrics.http_req_duration.values.avg,
      p95ResponseTime: data.metrics.http_req_duration.values['p(95)'],
      p99ResponseTime: data.metrics.http_req_duration.values['p(99)'],
    },
    reliability: {
      errorRate: data.metrics.http_req_failed.values.rate,
      successfulRequests: data.metrics.http_reqs.values.count * (1 - data.metrics.http_req_failed.values.rate),
    },
    queueMetrics: {
      interviewGenerationAvg: data.metrics.interview_generation_duration?.values.avg || 0,
      resumeProcessingAvg: data.metrics.resume_processing_duration?.values.avg || 0,
      voiceSessionAvg: data.metrics.voice_session_duration?.values.avg || 0,
      queueSuccessRate: data.metrics.queue_processing_success_rate?.values.rate || 0,
    },
  };

  // Output to both console and file
  console.log(JSON.stringify(summary, null, 2));
  
  return {
    'summary.json': JSON.stringify(summary, null, 2),
    stdout: JSON.stringify(summary, null, 2),
  };
}
