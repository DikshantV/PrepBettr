"use client";

import { useState } from 'react';
import { Button } from './ui/button';

export default function DetailedFirebaseDiagnostic() {
  const [logs, setLogs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const addLog = (message: string, isError = false) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `${timestamp}: ${message}`;
    console.log(logMessage);
    setLogs(prev => [...prev, logMessage]);
  };

  const clearLogs = () => setLogs([]);

  const runCompleteFirebaseTest = async () => {
    setIsLoading(true);
    clearLogs();
    
    addLog('🔍 Starting comprehensive Firebase authentication diagnostic...');
    
    try {
      // Step 1: Check environment variables
      addLog('📋 Step 1: Environment Variables Check');
      const envVars = {
        NEXT_PUBLIC_FIREBASE_API_KEY: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: !!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        NEXT_PUBLIC_FIREBASE_PROJECT_ID: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: !!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: !!process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        NEXT_PUBLIC_FIREBASE_APP_ID: !!process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      };
      
      Object.entries(envVars).forEach(([key, value]) => {
        addLog(`  ${key}: ${value ? '✅ Present' : '❌ Missing'}`);
      });

      // Step 2: Test Firebase Config API
      addLog('🌐 Step 2: Testing Firebase Config API');
      try {
        const response = await fetch('/api/config/firebase');
        if (response.ok) {
          const config = await response.json();
          addLog(`  ✅ Config API successful`);
          addLog(`  📊 API Key: ${config.apiKey ? config.apiKey.substring(0, 20) + '...' : 'Missing'}`);
          addLog(`  📊 Project ID: ${config.projectId}`);
          addLog(`  📊 Auth Domain: ${config.authDomain}`);
        } else {
          addLog(`  ❌ Config API failed: ${response.status}`, true);
        }
      } catch (error) {
        addLog(`  ❌ Config API error: ${error instanceof Error ? error.message : 'Unknown'}`, true);
      }

      // Step 3: Direct Firebase SDK Test
      addLog('🔥 Step 3: Direct Firebase SDK Initialization Test');
      try {
        const { initializeApp, getApps } = await import('firebase/app');
        const { getAuth, GoogleAuthProvider } = await import('firebase/auth');
        
        // Clean up any existing apps first
        const existingApps = getApps();
        if (existingApps.length > 0) {
          addLog(`  🧹 Found ${existingApps.length} existing Firebase app(s), cleaning up...`);
        }

        const firebaseConfig = {
          apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
          authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'prepbettr.firebaseapp.com',
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'prepbettr',
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'prepbettr.firebasestorage.app',
          messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
          appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
        };

        addLog(`  🔧 Initializing Firebase with config:`);
        addLog(`    API Key: ${firebaseConfig.apiKey ? firebaseConfig.apiKey.substring(0, 20) + '...' : 'MISSING'}`);
        addLog(`    Project ID: ${firebaseConfig.projectId}`);
        addLog(`    Auth Domain: ${firebaseConfig.authDomain}`);

        // Initialize Firebase
        const app = initializeApp(firebaseConfig, `diagnostic-${Date.now()}`);
        addLog(`  ✅ Firebase app initialized successfully`);

        // Initialize Auth
        const auth = getAuth(app);
        addLog(`  ✅ Firebase Auth initialized successfully`);

        // Initialize Google Provider
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({
          prompt: 'select_account'
        });
        addLog(`  ✅ Google Auth Provider initialized successfully`);

        // Test auth configuration
        addLog(`  📊 Auth currentUser: ${auth.currentUser ? 'Present' : 'null'}`);
        addLog(`  📊 Auth app: ${auth.app ? 'Present' : 'null'}`);

      } catch (error) {
        addLog(`  ❌ Firebase SDK initialization failed: ${error instanceof Error ? error.message : 'Unknown'}`, true);
        if (error instanceof Error && error.stack) {
          addLog(`  🐛 Stack trace: ${error.stack.split('\n')[0]}`, true);
        }
      }

      // Step 4: Test Firebase Auth Endpoints
      addLog('🌍 Step 4: Testing Firebase Auth Endpoint Connectivity');
      const testEndpoints = [
        `https://identitytoolkit.googleapis.com/v1/projects/${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'prepbettr'}/accounts:createAuthUri?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
        `https://securetoken.googleapis.com/v1/token?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
        'https://firebase.googleapis.com',
        'https://accounts.google.com'
      ];

      for (const endpoint of testEndpoints) {
        try {
          const response = await fetch(endpoint, { 
            method: 'HEAD',
            mode: 'no-cors' // Bypass CORS for connectivity test
          });
          addLog(`  ✅ ${endpoint.split('?')[0]}: Connected`);
        } catch (error) {
          addLog(`  ❌ ${endpoint.split('?')[0]}: ${error instanceof Error ? error.message : 'Failed'}`, true);
        }
      }

      // Step 5: Test Specific Auth Configuration
      addLog('⚙️ Step 5: Testing Firebase Auth Configuration');
      try {
        const testUrl = `https://identitytoolkit.googleapis.com/v1/projects/${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'prepbettr'}:getAuthConfig?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`;
        
        const response = await fetch(testUrl);
        if (response.ok) {
          const authConfig = await response.json();
          addLog(`  ✅ Auth configuration retrieved`);
          addLog(`  📊 Sign-in providers: ${authConfig.signIn?.email?.enabled ? 'Email, ' : ''}${authConfig.signIn?.google?.enabled ? 'Google' : 'None'}`);
        } else {
          const errorText = await response.text();
          addLog(`  ❌ Auth config failed (${response.status}): ${errorText}`, true);
        }
      } catch (error) {
        addLog(`  ❌ Auth config test error: ${error instanceof Error ? error.message : 'Unknown'}`, true);
      }

      // Step 6: Test Google Auth Specific Configuration
      addLog('🔐 Step 6: Testing Google Authentication Flow');
      try {
        const { initializeApp, getApps } = await import('firebase/app');
        const { getAuth, GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
        
        const existingApps = getApps();
        let app;
        
        if (existingApps.length > 0) {
          app = existingApps.find(a => a.name.includes('diagnostic'));
        }
        
        if (!app) {
          const firebaseConfig = {
            apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
            authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'prepbettr.firebaseapp.com',
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'prepbettr',
            storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'prepbettr.firebasestorage.app',
            messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
            appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
          };
          app = initializeApp(firebaseConfig, `google-test-${Date.now()}`);
        }

        const auth = getAuth(app);
        const provider = new GoogleAuthProvider();
        
        addLog('  🎯 Attempting Google sign-in (this will open a popup)...');
        
        // This will actually attempt the sign-in
        const result = await signInWithPopup(auth, provider);
        
        if (result.user) {
          addLog(`  🎉 SUCCESS! Google sign-in completed`);
          addLog(`  👤 User: ${result.user.email} (${result.user.uid})`);
          addLog(`  ✅ Email verified: ${result.user.emailVerified}`);
          
          // Get ID token
          const idToken = await result.user.getIdToken();
          addLog(`  🎟️ ID Token obtained: ${idToken.substring(0, 50)}...`);
          
          // Test token validity
          const parts = idToken.split('.');
          if (parts.length === 3) {
            try {
              const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
              addLog(`  📝 Token issuer: ${payload.iss}`);
              addLog(`  📝 Token audience: ${payload.aud}`);
              addLog(`  📝 Token expires: ${new Date(payload.exp * 1000).toLocaleString()}`);
            } catch (decodeError) {
              addLog(`  ❌ Failed to decode token: ${decodeError}`, true);
            }
          }

          // Sign out for cleanup
          await auth.signOut();
          addLog(`  🚪 Signed out successfully`);

        } else {
          addLog(`  ❌ Google sign-in returned no user`, true);
        }

      } catch (error: any) {
        addLog(`  ❌ Google sign-in test failed: ${error.message}`, true);
        
        // Detailed error analysis
        if (error.code) {
          addLog(`  🏷️ Error Code: ${error.code}`, true);
          
          switch (error.code) {
            case 'auth/internal-error':
              addLog(`  💡 DIAGNOSIS: Internal error - likely Firebase Console configuration issue`, true);
              addLog(`  🔧 CHECK: Is Google authentication enabled in Firebase Console?`, true);
              addLog(`  🔧 CHECK: Are authorized domains configured correctly?`, true);
              break;
            case 'auth/popup-blocked':
              addLog(`  💡 DIAGNOSIS: Browser blocked the popup`, true);
              break;
            case 'auth/popup-closed-by-user':
              addLog(`  💡 DIAGNOSIS: User closed the popup`, true);
              break;
            case 'auth/network-request-failed':
              addLog(`  💡 DIAGNOSIS: Network connectivity issue`, true);
              break;
            case 'auth/unauthorized-domain':
              addLog(`  💡 DIAGNOSIS: Domain not authorized in Firebase Console`, true);
              addLog(`  🔧 FIX: Add 'localhost' to authorized domains in Firebase Console`, true);
              break;
          }
        }

        if (error.stack) {
          addLog(`  🐛 Stack: ${error.stack.split('\n').slice(0, 3).join('; ')}`, true);
        }
      }

      addLog('🏁 Diagnostic completed. Check the logs above for issues.');

    } catch (error) {
      addLog(`❌ Diagnostic failed: ${error instanceof Error ? error.message : 'Unknown error'}`, true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-gray-900 text-white">
      <h2 className="text-2xl font-bold mb-6">🔍 Comprehensive Firebase Auth Diagnostic</h2>
      
      <div className="space-y-4 mb-6">
        <Button 
          onClick={runCompleteFirebaseTest}
          disabled={isLoading}
          className="mr-4"
          size="lg"
        >
          {isLoading ? '🔄 Running Diagnostic...' : '🚀 Run Complete Firebase Test'}
        </Button>
        
        <Button 
          onClick={clearLogs}
          disabled={isLoading}
          variant="outline"
        >
          🧹 Clear Logs
        </Button>
      </div>

      {logs.length > 0 && (
        <div className="bg-black p-4 rounded-lg overflow-y-auto max-h-[600px] font-mono text-sm">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-semibold">📊 Diagnostic Results:</h3>
            <span className="text-gray-400">{logs.length} entries</span>
          </div>
          {logs.map((log, index) => (
            <div 
              key={index} 
              className={`mb-1 ${log.includes('❌') || log.includes('ERROR') ? 'text-red-400' : 
                            log.includes('✅') || log.includes('SUCCESS') ? 'text-green-400' : 
                            log.includes('💡') ? 'text-yellow-400' :
                            log.includes('🔧') ? 'text-blue-400' : 'text-gray-300'}`}
            >
              {log}
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
        <h4 className="text-lg font-semibold mb-2 text-blue-400">🎯 What this test will do:</h4>
        <ul className="text-sm space-y-1 text-blue-200">
          <li>• Check all environment variables</li>
          <li>• Test Firebase configuration API</li>
          <li>• Initialize Firebase SDK directly</li>
          <li>• Test network connectivity to Firebase services</li>
          <li>• Check Firebase project authentication configuration</li>
          <li>• <strong>Actually attempt Google sign-in with detailed error reporting</strong></li>
        </ul>
      </div>
    </div>
  );
}