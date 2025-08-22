/**
 * Firebase Hooks Compatibility Layer
 * 
 * Provides mock hooks for components that still use Firebase hooks
 * Gradually migrate these to Azure-based services
 */

import { useState, useEffect } from 'react';

// Mock Firebase user type
interface FirebaseUser {
  uid: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
}

/**
 * Mock useFirebase hook for compatibility
 * @returns Object with Firebase-like interface
 */
export function useFirebase() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Mock initialization
    setLoading(false);
  }, []);

  return {
    user,
    loading,
    signOut: async () => {
      setUser(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_token');
        sessionStorage.removeItem('auth_token');
      }
    }
  };
}

export default useFirebase;
