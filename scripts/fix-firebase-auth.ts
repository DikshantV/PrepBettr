#!/usr/bin/env npx tsx

/**
 * Firebase Auth Fix Script
 * 
 * This script attempts to fix common Firebase auth/internal-error issues
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

async function checkAndEnableFirebaseAuth() {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

  console.log('🔧 Firebase Auth Fix Script');
  console.log('==========================');
  
  if (!projectId || !apiKey) {
    console.error('❌ Missing Firebase project ID or API key');
    return false;
  }

  console.log(`📁 Project ID: ${projectId}`);
  console.log(`🔑 API Key: ${apiKey.substring(0, 10)}...`);

  // Test different Firebase API endpoints to determine the issue
  const endpoints = [
    {
      name: 'Firebase Management API',
      url: `https://firebase.googleapis.com/v1beta1/projects/${projectId}`,
      headers: { 'Authorization': `Bearer ${apiKey}` }
    },
    {
      name: 'Identity Toolkit API',
      url: `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/config`,
      headers: { 'X-Goog-Api-Key': apiKey }
    },
    {
      name: 'Identity Toolkit API (with key param)',
      url: `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/config?key=${apiKey}`,
      headers: {} as Record<string, string>
    }
  ];

  console.log('\n🔍 Testing Firebase API endpoints...');
  
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint.url, {
        method: 'GET',
        headers: endpoint.headers as HeadersInit
      });
      
      console.log(`\n📡 ${endpoint.name}:`);
      console.log(`   URL: ${endpoint.url}`);
      console.log(`   Status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`   ✅ Success!`);
        console.log(`   Response:`, JSON.stringify(data, null, 2));
        return true;
      } else if (response.status === 403) {
        console.log(`   ❌ Permission denied - API key may lack required permissions`);
      } else if (response.status === 404) {
        console.log(`   ❌ Not found - Firebase Auth may not be enabled for this project`);
      } else {
        const errorText = await response.text();
        console.log(`   ⚠️  Unexpected response: ${errorText.substring(0, 200)}...`);
      }
    } catch (error) {
      console.log(`   ❌ Network error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log('\n🛠️  Suggested fixes:');
  console.log('1. Enable Firebase Authentication in the Firebase Console:');
  console.log('   https://console.firebase.google.com/project/prepbettr/authentication');
  console.log('2. Enable Google sign-in provider');
  console.log('3. Add localhost to authorized domains');
  console.log('4. Verify API key permissions in Google Cloud Console');
  
  return false;
}

async function suggestAlternativeApproach() {
  console.log('\n💡 Alternative Approach: Use Firebase Admin SDK');
  console.log('Since the Web API key has permission issues, we can use Firebase Admin SDK with service account:');
  console.log('\n📝 Steps:');
  console.log('1. Use Firebase Admin SDK for server-side auth verification');
  console.log('2. Implement custom session management');
  console.log('3. Use redirect-based OAuth flow instead of popup');
  
  // Check if we have admin SDK credentials
  const hasAdminCreds = process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL;
  if (hasAdminCreds) {
    console.log('✅ Firebase Admin SDK credentials found in environment');
  } else {
    console.log('⚠️  Firebase Admin SDK credentials not found');
  }
}

async function main() {
  console.log('🚀 Starting Firebase Auth diagnosis and fix...\n');
  
  const authWorking = await checkAndEnableFirebaseAuth();
  
  if (!authWorking) {
    await suggestAlternativeApproach();
    
    console.log('\n🎯 Quick Fix: Try redirect-based auth instead of popup');
    console.log('The auth/internal-error often occurs with popup-based auth.');
    console.log('Redirect-based auth is more reliable.');
  }
  
  console.log('\n✨ Summary:');
  console.log('- Firebase Auth config is not accessible via API');
  console.log('- This is likely a project configuration issue');
  console.log('- Enable Firebase Auth in Firebase Console');
  console.log('- Use redirect-based auth as immediate workaround');
}

if (require.main === module) {
  main().catch(console.error);
}
