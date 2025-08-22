"use client";

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface DebugInfo {
  cookieExists: boolean;
  cookieValue: string;
  authState: any;
  currentPath: string;
}

// Deep equality check for debug info to prevent unnecessary updates
function deepEqual(a: DebugInfo | null, b: DebugInfo | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  
  return (
    a.cookieExists === b.cookieExists &&
    a.cookieValue === b.cookieValue &&
    a.currentPath === b.currentPath &&
    JSON.stringify(a.authState) === JSON.stringify(b.authState)
  );
}

export default function AuthDebugInfo() {
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const auth = useAuth();

  // Memoize auth state to prevent unnecessary updates
  const memoizedAuthState = useMemo(() => ({
    user: auth.user ? { uid: auth.user.uid, email: auth.user.email } : null,
    loading: auth.loading,
    isAuthenticated: auth.isAuthenticated
  }), [auth.user?.uid, auth.user?.email, auth.loading, auth.isAuthenticated]);

  const updateDebugInfo = useCallback(() => {
    // Check for session cookie
    const cookies = document.cookie.split(';').reduce((acc, cookie) => {
      const [name, value] = cookie.trim().split('=');
      acc[name] = value;
      return acc;
    }, {} as Record<string, string>);

    const newDebugInfo: DebugInfo = {
      cookieExists: !!cookies.session,
      cookieValue: cookies.session ? `${cookies.session.substring(0, 20)}...` : 'Not found',
      authState: memoizedAuthState,
      currentPath: window.location.pathname
    };

    // Only update state if the debug info actually changed
    setDebugInfo(prevDebugInfo => {
      if (deepEqual(prevDebugInfo, newDebugInfo)) {
        return prevDebugInfo; // No change, prevent re-render
      }
      return newDebugInfo;
    });
  }, [memoizedAuthState]);

  useEffect(() => {
    // Update immediately when memoized auth state changes
    updateDebugInfo();
  }, [updateDebugInfo]); // Only depend on the memoized callback

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
