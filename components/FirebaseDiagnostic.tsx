"use client";

import { useEffect, useState } from 'react';
import { useFirebaseReady } from '@/components/FirebaseClientInit';
import { isFirebaseReady } from '@/firebase/client';

export default function FirebaseDiagnostic() {
  const { ready: contextReady, error: contextError } = useFirebaseReady();
  const [clientReady, setClientReady] = useState(false);
  const [envVars, setEnvVars] = useState<any>({});
  const [windowGlobals, setWindowGlobals] = useState<any>({});

  useEffect(() => {
    // Check client readiness
    setClientReady(isFirebaseReady());

    // Check environment variables
    setEnvVars({
      apiKey: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      projectId: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      authDomain: !!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    });

    // Check window globals
    if (typeof window !== 'undefined') {
      const firebaseConfig = (window as any).__FIREBASE_CONFIG__;
      setWindowGlobals({
        apiKey: !!(firebaseConfig?.apiKey || (window as any).__NEXT_FIREBASE_API_KEY__),
        projectId: !!(firebaseConfig?.projectId || (window as any).__NEXT_FIREBASE_PROJECT_ID__),
        authDomain: !!(firebaseConfig?.authDomain || (window as any).__NEXT_FIREBASE_AUTH_DOMAIN__),
        firebaseReady: !!(window as any).__FIREBASE_READY__,
        hasConfig: !!firebaseConfig,
        configKeys: firebaseConfig ? Object.keys(firebaseConfig).length : 0
      });
    }
  }, []);

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 bg-black/90 text-white p-4 rounded-lg text-xs font-mono z-50 max-w-sm">
      <div className="font-bold mb-2">🔥 Firebase Debug Info</div>
      
      <div className="space-y-2">
        <div>
          <div className="text-yellow-400">Context Ready:</div>
          <div>{contextReady ? '✅ Yes' : '❌ No'}</div>
        </div>

        <div>
          <div className="text-yellow-400">Context Error:</div>
          <div>{contextError || 'None'}</div>
        </div>

        <div>
          <div className="text-yellow-400">Client Ready:</div>
          <div>{clientReady ? '✅ Yes' : '❌ No'}</div>
        </div>

        <div>
          <div className="text-yellow-400">Env Variables:</div>
          <div>API Key: {envVars.apiKey ? '✅' : '❌'}</div>
          <div>Project ID: {envVars.projectId ? '✅' : '❌'}</div>
          <div>Auth Domain: {envVars.authDomain ? '✅' : '❌'}</div>
        </div>

        <div>
          <div className="text-yellow-400">Window Globals:</div>
          <div>Config Object: {windowGlobals.hasConfig ? '✅' : '❌'}</div>
          <div>Config Keys: {windowGlobals.configKeys || 0}</div>
          <div>API Key: {windowGlobals.apiKey ? '✅' : '❌'}</div>
          <div>Project ID: {windowGlobals.projectId ? '✅' : '❌'}</div>
          <div>Auth Domain: {windowGlobals.authDomain ? '✅' : '❌'}</div>
          <div>Firebase Ready: {windowGlobals.firebaseReady ? '✅' : '❌'}</div>
        </div>
      </div>
    </div>
  );
}