"use client";

import { useEffect, useState } from 'react';
import { Button } from './ui/button';

export default function DiagnosticAuth() {
  const [logs, setLogs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const addLog = (message: string) => {
    console.log(message);
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const testFirebaseConfig = async () => {
    setIsLoading(true);
    setLogs([]);
    
    try {
      addLog('🔍 Testing Firebase configuration...');
      
      // Test 1: Check environment variables
      addLog(`ENV - NEXT_PUBLIC_FIREBASE_API_KEY: ${process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? 'Present' : 'Missing'}`);
      addLog(`ENV - NEXT_PUBLIC_FIREBASE_PROJECT_ID: ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'Missing'}`);
      addLog(`ENV - NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: ${process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'Missing'}`);
      
      // Test 2: Check Firebase config endpoint
      addLog('📡 Fetching Firebase config from API...');
      try {
        const response = await fetch('/api/config/firebase');
        if (response.ok) {
          const config = await response.json();
          addLog(`✅ Firebase config API successful`);
          addLog(`API Config - hasApiKey: ${!!config.apiKey}`);
          addLog(`API Config - projectId: ${config.projectId}`);
          addLog(`API Config - authDomain: ${config.authDomain}`);
        } else {
          addLog(`❌ Firebase config API failed: ${response.status} ${response.statusText}`);
        }
      } catch (error) {
        addLog(`❌ Firebase config API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Test 3: Try to initialize Firebase manually
      addLog('🔥 Testing Firebase initialization...');
      try {
        const { initializeApp } = await import('firebase/app');
        const { getAuth, GoogleAuthProvider } = await import('firebase/auth');
        
        const firebaseConfig = {
          apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
          authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "prepbettr.firebaseapp.com",
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "prepbettr",
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "prepbettr.firebasestorage.app",
          messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
          appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
        };
        
        addLog(`🔥 Firebase config to be used: ${JSON.stringify(firebaseConfig, null, 2)}`);
        
        // Test if we can initialize the app
        const app = initializeApp(firebaseConfig, 'diagnostic-test');
        addLog('✅ Firebase app initialized successfully');
        
        // Test if we can get auth
        const auth = getAuth(app);
        addLog('✅ Firebase Auth initialized successfully');
        
        // Test Google provider
        const googleProvider = new GoogleAuthProvider();
        addLog('✅ Google Auth Provider initialized successfully');
        
      } catch (firebaseError) {
        addLog(`❌ Firebase initialization error: ${firebaseError instanceof Error ? firebaseError.message : 'Unknown error'}`);
        if (firebaseError instanceof Error) {
          addLog(`❌ Firebase error stack: ${firebaseError.stack}`);
        }
      }

      // Test 4: Network connectivity to Firebase
      addLog('🌐 Testing network connectivity to Firebase...');
      try {
        const response = await fetch('https://firebase.googleapis.com/v1/projects/prepbettr');
        addLog(`Firebase API connectivity: ${response.status}`);
      } catch (networkError) {
        addLog(`❌ Firebase network test failed: ${networkError instanceof Error ? networkError.message : 'Unknown error'}`);
      }

      // Test 5: Check Google Auth URLs
      addLog('🔍 Testing Google Auth endpoints...');
      try {
        const response = await fetch('https://accounts.google.com/o/oauth2/v2/auth', { method: 'HEAD' });
        addLog(`Google Auth connectivity: ${response.status}`);
      } catch (googleError) {
        addLog(`❌ Google Auth test failed: ${googleError instanceof Error ? googleError.message : 'Unknown error'}`);
      }

    } catch (error) {
      addLog(`❌ Diagnostic test error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testGoogleSignIn = async () => {
    setIsLoading(true);
    addLog('🔐 Testing Google Sign-In...');
    
    try {
      const { initializeApp, getApps } = await import('firebase/app');
      const { getAuth, GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
      
      // Get or create Firebase app
      let app;
      const existingApps = getApps();
      if (existingApps.length > 0) {
        app = existingApps[0];
        addLog('✅ Using existing Firebase app');
      } else {
        const firebaseConfig = {
          apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
          authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "prepbettr.firebaseapp.com",
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "prepbettr",
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "prepbettr.firebasestorage.app",
          messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
          appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
        };
        
        app = initializeApp(firebaseConfig, 'diagnostic-signin-test');
        addLog('✅ Created new Firebase app for sign-in test');
      }
      
      const auth = getAuth(app);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      
      addLog('🔐 Attempting Google sign-in popup...');
      const result = await signInWithPopup(auth, provider);
      
      if (result.user) {
        addLog(`✅ Google sign-in successful!`);
        addLog(`User: ${result.user.email} (${result.user.uid})`);
        
        // Get ID token
        const idToken = await result.user.getIdToken();
        addLog(`✅ ID token obtained: ${idToken.substring(0, 50)}...`);
        
      } else {
        addLog('❌ Google sign-in failed: No user returned');
      }
      
    } catch (error) {
      addLog(`❌ Google sign-in error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      if (error instanceof Error) {
        addLog(`❌ Error code: ${(error as any).code}`);
        addLog(`❌ Error stack: ${error.stack}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-gray-900 text-white">
      <h2 className="text-2xl font-bold mb-6">Firebase Authentication Diagnostics</h2>
      
      <div className="space-y-4 mb-6">
        <Button 
          onClick={testFirebaseConfig}
          disabled={isLoading}
          className="mr-4"
        >
          {isLoading ? 'Testing...' : 'Test Firebase Configuration'}
        </Button>
        
        <Button 
          onClick={testGoogleSignIn}
          disabled={isLoading}
          variant="secondary"
        >
          {isLoading ? 'Testing...' : 'Test Google Sign-In'}
        </Button>
      </div>

      {logs.length > 0 && (
        <div className="bg-black p-4 rounded-lg overflow-y-auto max-h-96">
          <h3 className="text-lg font-semibold mb-2">Diagnostic Logs:</h3>
          {logs.map((log, index) => (
            <div key={index} className="text-sm font-mono mb-1">
              {log}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}