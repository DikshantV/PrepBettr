/**
 * Test network connectivity to Firebase and Google services
 */

async function testConnectivity() {
  console.log('🔗 Testing network connectivity to Firebase services...');
  
  const tests = [
    {
      name: 'Google DNS',
      url: 'https://dns.google.com/resolve?name=google.com&type=A',
      expected: 'Should return DNS resolution'
    },
    {
      name: 'Firebase Identity Toolkit (Simple)',
      url: 'https://identitytoolkit.googleapis.com/',
      expected: 'Should return 404 (but reachable)'
    },
    {
      name: 'Google APIs',
      url: 'https://www.googleapis.com/',
      expected: 'Should return some response'
    },
    {
      name: 'Firebase Auth Domain',
      url: 'https://prepbettr.firebaseapp.com/',
      expected: 'Should reach Firebase hosting'
    },
    {
      name: 'Google Accounts',
      url: 'https://accounts.google.com/.well-known/openid_configuration',
      expected: 'Should return OpenID configuration'
    }
  ];
  
  for (const test of tests) {
    try {
      console.log(`\n🧪 Testing ${test.name}...`);
      const response = await fetch(test.url, {
        method: 'GET',
        mode: 'cors'
      });
      
      console.log(`✅ ${test.name}: ${response.status} ${response.statusText}`);
      
      if (test.name === 'Google Accounts') {
        const data = await response.json();
        console.log(`📋 OpenID endpoints available: ${Object.keys(data).length}`);
      }
      
    } catch (error) {
      console.error(`❌ ${test.name} FAILED:`, error.message);
      console.error(`   Error type: ${error.name}`);
      
      if (error.message.includes('CORS')) {
        console.error('   🚨 CORS issue detected - this might block Firebase authentication');
      }
      
      if (error.message.includes('Failed to fetch')) {
        console.error('   🚨 Network fetch failed - check firewall/proxy settings');
      }
    }
  }
  
  console.log('\n📊 Network connectivity test complete!');
}

// Run the test
testConnectivity().catch(console.error);