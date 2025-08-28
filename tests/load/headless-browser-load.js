import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
export const errorRate = new Rate('errors');
export const successRate = new Rate('application_success');
export const applicationDuration = new Trend('application_duration');
export const rateLimitCounter = new Counter('rate_limit_hits');
export const browserLaunchTime = new Trend('browser_launch_time');

// Test configuration
export const options = {
  stages: [
    { duration: '1m', target: 10 }, // Ramp up to 10 VUs over 1 minute
    { duration: '2m', target: 15 }, // Stay at 15 VUs for 2 minutes  
    { duration: '1m', target: 5 },  // Scale down to 5 VUs
    { duration: '1m', target: 0 },  // Cool down
  ],
  thresholds: {
    http_req_duration: ['p(95)<30000'], // 95% of requests must complete within 30 seconds
    http_req_failed: ['rate<0.15'],     // Error rate must be less than 15%
    'application_success': ['rate>0.8'], // Application success rate must be over 80%
    'errors': ['rate<0.1'],             // General error rate must be under 10%
  },
};

// Configuration from environment variables
const BASE_URL = __ENV.AZURE_BROWSER_SERVICE_ENDPOINT || 'https://prepbettr-functions-app.azurewebsites.net';
const API_KEY = __ENV.AZURE_FUNCTION_API_KEY || '';

// Test data
const testJobs = [
  {
    id: 'load-test-job-1',
    title: 'Software Engineer - Load Test',
    company: 'K6 Test Company',
    final_url: 'https://linkedin.com/jobs/view/load-test-1',
    easy_apply: true,
    jobPortal: { name: 'LinkedIn' }
  },
  {
    id: 'load-test-job-2', 
    title: 'Frontend Developer - Load Test',
    company: 'K6 Frontend Corp',
    final_url: 'https://indeed.com/viewjob?jk=load-test-2',
    easy_apply: true,
    jobPortal: { name: 'Indeed' }
  },
  {
    id: 'load-test-job-3',
    title: 'Full Stack Engineer - Load Test', 
    company: 'K6 Tech Solutions',
    final_url: 'https://theirstack.com/job/load-test-3',
    easy_apply: true,
    jobPortal: { name: 'TheirStack' }
  }
];

const testUserProfile = {
  id: `load-test-user-${__VU}-${Math.random().toString(36).substring(7)}`,
  firstName: 'LoadTest',
  lastName: `User${__VU}`,
  email: `loadtest.user${__VU}@example.com`,
  phone: '+1234567890',
  resume: 'This is a test resume for load testing purposes. Experience includes software development, testing, and automation.',
  skills: ['JavaScript', 'Node.js', 'Testing', 'Load Testing'],
  experienceYears: 3,
  workAuthorization: 'Yes',
  expectedSalary: '$80,000'
};

/**
 * Setup function - runs once per VU at the beginning
 */
export function setup() {
  // Health check before starting load test
  console.log('🔍 Performing health check before load test...');
  
  const healthResponse = http.get(`${BASE_URL}/api/health/azure`, {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  
  const healthOk = check(healthResponse, {
    'health check status is 200': (r) => r.status === 200,
    'health check indicates healthy': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.status === 'healthy' || body.overall === 'healthy';
      } catch {
        return false;
      }
    }
  });
  
  if (!healthOk) {
    throw new Error('Health check failed - aborting load test');
  }
  
  console.log('✅ Health check passed - starting load test');
  return { healthCheckPassed: true };
}

/**
 * Main test function - runs for each iteration of each VU
 */
export default function(data) {
  const startTime = Date.now();
  
  // Select a random job for this iteration
  const job = testJobs[Math.floor(Math.random() * testJobs.length)];
  
  // Prepare the application request payload
  const applicationPayload = {
    jobListing: {
      ...job,
      id: `${job.id}-${__VU}-${__ITER}`
    },
    userProfile: {
      ...testUserProfile,
      id: `${testUserProfile.id}-${__ITER}`
    },
    options: {
      timeout: 120000,
      screenshots: false, // Disable screenshots for load testing
      retryOnFailure: true
    }
  };
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
      'User-Agent': 'K6-LoadTest/1.0'
    },
    timeout: '300s' // 5 minute timeout for the entire application process
  };
  
  console.log(`🚀 VU ${__VU}, Iteration ${__ITER}: Submitting application for ${job.title}`);
  
  // Make the application request
  const response = http.post(
    `${BASE_URL}/api/headless-browser/apply`, 
    JSON.stringify(applicationPayload),
    params
  );
  
  const duration = Date.now() - startTime;
  applicationDuration.add(duration);
  
  // Parse response
  let responseBody = {};
  try {
    responseBody = JSON.parse(response.body);
  } catch (e) {
    console.error(`Failed to parse response body: ${response.body}`);
  }
  
  // Check response status and content
  const checks = check(response, {
    'status is 200 or 202': (r) => r.status === 200 || r.status === 202,
    'status is not 4xx': (r) => !(r.status >= 400 && r.status < 500),
    'response has application ID': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.applicationId && body.applicationId.length > 0;
      } catch {
        return false;
      }
    },
    'response time under 5 minutes': (r) => r.timings.duration < 300000
  });
  
  // Track specific metrics
  if (response.status === 429) {
    rateLimitCounter.add(1);
    console.log(`⏳ VU ${__VU}: Rate limited`);
  }
  
  if (responseBody.success) {
    successRate.add(1);
    console.log(`✅ VU ${__VU}: Application successful - ${responseBody.applicationId}`);
    
    if (responseBody.duration) {
      browserLaunchTime.add(responseBody.duration);
    }
  } else {
    successRate.add(0);
    console.log(`❌ VU ${__VU}: Application failed - ${responseBody.message || 'Unknown error'}`);
  }
  
  if (!checks) {
    errorRate.add(1);
    console.error(`💥 VU ${__VU}: Request failed - Status: ${response.status}, Body: ${response.body.substring(0, 200)}`);
  } else {
    errorRate.add(0);
  }
  
  // Log detailed response for debugging (sample only)
  if (__ITER === 0 && __VU === 1) {
    console.log(`📊 Sample Response (VU ${__VU}):`, JSON.stringify(responseBody, null, 2));
  }
  
  // Add some think time between requests
  sleep(Math.random() * 2 + 1); // Sleep 1-3 seconds
}

/**
 * Teardown function - runs once at the end of the test
 */
export function teardown(data) {
  console.log('🏁 Load test completed');
  
  // Final health check
  const finalHealthResponse = http.get(`${BASE_URL}/api/health/azure`, {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  
  const finalHealthOk = check(finalHealthResponse, {
    'final health check status is 200': (r) => r.status === 200,
    'final health check indicates healthy': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.status === 'healthy' || body.overall === 'healthy';
      } catch {
        return false;
      }
    }
  });
  
  if (finalHealthOk) {
    console.log('✅ Final health check passed - system stable after load test');
  } else {
    console.error('❌ Final health check failed - system may be degraded');
  }
}

/**
 * Custom summary function for detailed reporting
 */
export function handleSummary(data) {
  return {
    'test-reports/load-test-summary.json': JSON.stringify(data, null, 2),
    'test-reports/load-test-summary.html': generateHtmlReport(data),
    stdout: generateConsoleReport(data),
  };
}

function generateConsoleReport(data) {
  const report = `
🏁 Load Test Summary - Headless Browser Automation
═══════════════════════════════════════════════════

📊 Request Metrics:
   Total Requests: ${data.metrics.http_reqs.values.count}
   Success Rate: ${(100 - data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%
   Avg Duration: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms
   P95 Duration: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms

🎯 Application Metrics:
   Applications Success Rate: ${(data.metrics.application_success?.values.rate * 100 || 0).toFixed(2)}%
   Avg Application Duration: ${data.metrics.application_duration?.values.avg || 0}ms
   Browser Launch Time P95: ${data.metrics.browser_launch_time?.values['p(95)'] || 0}ms

⚡ Rate Limiting:
   Rate Limit Hits: ${data.metrics.rate_limit_hits?.values.count || 0}
   Error Rate: ${(data.metrics.errors?.values.rate * 100 || 0).toFixed(2)}%

🔍 Thresholds:
${Object.entries(data.thresholds || {}).map(([name, threshold]) => 
  `   ${name}: ${threshold.passes ? '✅ PASS' : '❌ FAIL'}`
).join('\n')}

⏱️  Test Duration: ${((data.state.testRunDurationMs || 0) / 1000).toFixed(2)}s
  `;
  
  return report;
}

function generateHtmlReport(data) {
  return `
<!DOCTYPE html>
<html>
<head>
  <title>Headless Browser Load Test Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
    h2 { color: #34495e; margin-top: 30px; }
    .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 20px 0; }
    .metric-card { background: #ecf0f1; padding: 15px; border-radius: 6px; border-left: 4px solid #3498db; }
    .metric-value { font-size: 24px; font-weight: bold; color: #2c3e50; }
    .metric-label { color: #7f8c8d; margin-top: 5px; }
    .pass { color: #27ae60; }
    .fail { color: #e74c3c; }
    .summary-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    .summary-table th, .summary-table td { padding: 10px; text-align: left; border-bottom: 1px solid #bdc3c7; }
    .summary-table th { background: #34495e; color: white; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🚀 Headless Browser Automation - Load Test Report</h1>
    
    <div class="metric-grid">
      <div class="metric-card">
        <div class="metric-value">${data.metrics.http_reqs.values.count}</div>
        <div class="metric-label">Total Requests</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">${(100 - data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%</div>
        <div class="metric-label">Success Rate</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">${(data.metrics.application_success?.values.rate * 100 || 0).toFixed(2)}%</div>
        <div class="metric-label">Application Success Rate</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">${data.metrics.http_req_duration.values['p(95)'].toFixed(0)}ms</div>
        <div class="metric-label">P95 Response Time</div>
      </div>
    </div>
    
    <h2>📈 Performance Metrics</h2>
    <table class="summary-table">
      <tr>
        <th>Metric</th>
        <th>Average</th>
        <th>Min</th>
        <th>Max</th>
        <th>P95</th>
      </tr>
      <tr>
        <td>HTTP Request Duration</td>
        <td>${data.metrics.http_req_duration.values.avg.toFixed(2)}ms</td>
        <td>${data.metrics.http_req_duration.values.min.toFixed(2)}ms</td>
        <td>${data.metrics.http_req_duration.values.max.toFixed(2)}ms</td>
        <td>${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms</td>
      </tr>
      ${data.metrics.application_duration ? `
      <tr>
        <td>Application Duration</td>
        <td>${data.metrics.application_duration.values.avg.toFixed(2)}ms</td>
        <td>${data.metrics.application_duration.values.min.toFixed(2)}ms</td>
        <td>${data.metrics.application_duration.values.max.toFixed(2)}ms</td>
        <td>${data.metrics.application_duration.values['p(95)'].toFixed(2)}ms</td>
      </tr>
      ` : ''}
    </table>
    
    <h2>🎯 Threshold Results</h2>
    <table class="summary-table">
      <tr>
        <th>Threshold</th>
        <th>Result</th>
        <th>Value</th>
      </tr>
      ${Object.entries(data.thresholds || {}).map(([name, threshold]) => `
      <tr>
        <td>${name}</td>
        <td class="${threshold.passes ? 'pass' : 'fail'}">${threshold.passes ? '✅ PASS' : '❌ FAIL'}</td>
        <td>${threshold.value || 'N/A'}</td>
      </tr>
      `).join('')}
    </table>
    
    <div style="margin-top: 30px; padding: 15px; background: #ecf0f1; border-radius: 6px;">
      <strong>Test Duration:</strong> ${((data.state.testRunDurationMs || 0) / 1000).toFixed(2)} seconds<br>
      <strong>Generated:</strong> ${new Date().toISOString()}<br>
      <strong>Environment:</strong> ${__ENV.ENVIRONMENT || 'Production'}
    </div>
  </div>
</body>
</html>
  `;
}
