/**
 * Debug Firebase Client - Minimal Configuration for Testing
 */

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

// Simple, direct Firebase config
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

console.log('🔥 Debug Firebase Config:', {
  hasApiKey: !!firebaseConfig.apiKey,
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
  storageBucket: firebaseConfig.storageBucket,
  messagingSenderId: firebaseConfig.messagingSenderId,
  appId: firebaseConfig.appId,
  apiKeyPreview: firebaseConfig.apiKey ? firebaseConfig.apiKey.substring(0, 10) + '...' : 'MISSING'
});

// Validate configuration
const missingFields = [];
if (!firebaseConfig.apiKey) missingFields.push('apiKey');
if (!firebaseConfig.authDomain) missingFields.push('authDomain');
if (!firebaseConfig.projectId) missingFields.push('projectId');

if (missingFields.length > 0) {
  console.error('🚨 Missing Firebase configuration fields:', missingFields);
  console.error('🚨 This will cause auth/internal-error!');
} else {
  console.log('✅ All required Firebase configuration fields present');
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export async function debugGoogleAuth() {
  console.log('🧪 Starting DEBUG Google Authentication...');
  console.log('🧪 Current window.location:', window.location.href);
  console.log('🧪 User agent:', navigator.userAgent);
  
  // Test Firebase Auth configuration
  console.log('🧪 Firebase Auth instance:', {
    app: auth.app,
    config: auth.config,
    tenantId: auth.tenantId || 'none'
  });
  
  // Test if we can reach Firebase Auth REST API
  try {
    const testUrl = `https://identitytoolkit.googleapis.com/v1/projects/${firebaseConfig.projectId}?key=${firebaseConfig.apiKey}`;
    console.log('🧪 Testing Firebase Auth REST API...');
    const response = await fetch(testUrl);
    console.log('🧪 Firebase Auth REST API response:', response.status, response.statusText);
    if (!response.ok) {
      const errorText = await response.text();
      console.error('🧪 Firebase Auth REST API error:', errorText.substring(0, 200));
    }
  } catch (restError) {
    console.error('🧪 Firebase Auth REST API test failed:', restError);
  }
  
  try {
    const result = await signInWithPopup(auth, provider);
    console.log('🧪 DEBUG Authentication successful!', {
      uid: result.user.uid,
      email: result.user.email
    });
    return result;
  } catch (error: any) {
    console.error('🧪 DEBUG Authentication failed:');
    console.error('🧪 Error code:', error.code);
    console.error('🧪 Error message:', error.message);
    console.error('🧪 Error details:', {
      code: error.code,
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    throw error;
  }
}