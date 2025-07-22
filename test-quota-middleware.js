// test-quota-middleware.js
// Simple test script to verify quota middleware is working

const testEndpoints = [
  {
    name: 'Interview Generation',
    url: 'http://localhost:3002/api/vapi/generate',
    method: 'POST',
    body: {
      type: 'technical',
      role: 'Software Engineer',
      level: 'Senior',
      techstack: 'React, Node.js, TypeScript',
      amount: 5,
      userid: 'test-user-123'
    }
  },
  {
    name: 'Resume Tailoring',
    url: 'http://localhost:3002/api/resume-tailor/analyze',
    method: 'POST',
    body: {
      resumeText: 'John Doe\nSoftware Engineer with 5 years of experience in React and Node.js.\n\nExperience:\n- Frontend Developer at TechCorp (2019-2024)\n- Built responsive web applications using React\n- Collaborated with backend teams using Node.js APIs',
      jobDescription: 'We are looking for a Senior React Developer to join our team. Must have experience with React, TypeScript, and Node.js.'
    }
  },
  {
    name: 'Auto Apply',
    url: 'http://localhost:3002/api/auto-apply/apply',
    method: 'POST',
    body: {
      userId: 'test-user-123',
      jobId: 'job-123',
      customCoverLetter: null,
      customResume: null,
      applicationData: {}
    }
  }
];

async function testEndpoint(endpoint) {
  console.log(`\n🧪 Testing ${endpoint.name}...`);
  
  try {
    const response = await fetch(endpoint.url, {
      method: endpoint.method,
      headers: {
        'Content-Type': 'application/json',
        // No session cookie - should work in dev mode
      },
      body: JSON.stringify(endpoint.body)
    });

    const data = await response.json();
    
    console.log(`   Status: ${response.status}`);
    console.log(`   Success: ${data.success}`);
    
    if (data.error) {
      console.log(`   Error: ${data.error}`);
    }
    
    if (data.upgradeMessage) {
      console.log(`   Quota Message: ${data.upgradeMessage}`);
    }
    
    // Look for dev mode messages in console
    if (process.env.NODE_ENV !== 'production') {
      console.log(`   💡 Should see "[DEV MODE] Skipping quota enforcement" in server logs`);
    }
    
    return { endpoint: endpoint.name, status: response.status, success: data.success };
    
  } catch (error) {
    console.log(`   ❌ Request failed: ${error.message}`);
    return { endpoint: endpoint.name, status: 'ERROR', success: false, error: error.message };
  }
}

async function runTests() {
  console.log('🚀 Testing Quota Middleware Implementation');
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('='*50);
  
  const results = [];
  
  for (const endpoint of testEndpoints) {
    const result = await testEndpoint(endpoint);
    results.push(result);
    
    // Wait between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n📋 Test Summary:');
  console.log('='*30);
  
  results.forEach(result => {
    const statusIcon = result.success ? '✅' : '❌';
    console.log(`${statusIcon} ${result.endpoint}: ${result.status}`);
    if (result.error) {
      console.log(`    Error: ${result.error}`);
    }
  });
  
  console.log('\n💡 Expected Behavior:');
  console.log('- In development mode: All requests should succeed without quota checks');
  console.log('- Server logs should show "[DEV MODE] Skipping quota enforcement" messages');
  console.log('- In production mode: Quota enforcement would be active');
  
  console.log('\n🔍 Next Steps:');
  console.log('1. Check server console for dev mode messages');
  console.log('2. Test in production environment with NODE_ENV=production');
  console.log('3. Verify quota limits are enforced in production');
}

// Run the tests
runTests().catch(console.error);
