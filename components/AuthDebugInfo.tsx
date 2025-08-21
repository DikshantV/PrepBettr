"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface DebugInfo {
  cookieExists: boolean;
  cookieValue: string;
  authState: any;
  currentPath: string;
}

export default function AuthDebugInfo() {
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const auth = useAuth();

  useEffect(() => {
    const updateDebugInfo = () => {
      // Check for session cookie
      const cookies = document.cookie.split(';').reduce((acc, cookie) => {
        const [name, value] = cookie.trim().split('=');
        acc[name] = value;
        return acc;
      }, {} as Record<string, string>);

      setDebugInfo({
        cookieExists: !!cookies.session,
        cookieValue: cookies.session ? `${cookies.session.substring(0, 20)}...` : 'Not found',
        authState: {
          user: auth.user ? { uid: auth.user.uid, email: auth.user.email } : null,
          loading: auth.loading,
          isAuthenticated: auth.isAuthenticated
        },
        currentPath: window.location.pathname
      });
    };

    updateDebugInfo();
    
    // Update on route changes
    const interval = setInterval(updateDebugInfo, 1000);
    
    return () => clearInterval(interval);
  }, [auth]);

  if (!debugInfo) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white p-4 rounded-lg text-xs font-mono z-50 max-w-sm">
      <div className="font-bold mb-2">🔍 Auth Debug Info</div>
      <div className="space-y-1">
        <div>Path: {debugInfo.currentPath}</div>
        <div>Cookie: {debugInfo.cookieExists ? '✅' : '❌'} {debugInfo.cookieValue}</div>
        <div>Auth Loading: {debugInfo.authState.loading ? 'Yes' : 'No'}</div>
        <div>Authenticated: {debugInfo.authState.isAuthenticated ? '✅' : '❌'}</div>
        <div>User: {debugInfo.authState.user?.email || 'None'}</div>
      </div>
      <button 
        onClick={() => window.location.href = '/dashboard'}
        className="mt-2 px-2 py-1 bg-blue-600 rounded text-xs"
      >
        Force Navigate to Dashboard
      </button>
    </div>
  );
}
