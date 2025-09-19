"use client";

import { createContext, useContext, ReactNode, useEffect, useState } from "react";
import { AuthenticatedUser } from '@/lib/middleware/authMiddleware-unified';

/**
 * Refresh the current Firebase auth token
 */
async function refreshAuthToken(): Promise<string | null> {
  try {
    // Import Firebase auth dynamically to avoid SSR issues
    const { getCurrentUserIdToken } = await import('@/lib/firebase/auth.js');
    
    console.log('🔄 Attempting to refresh Firebase ID token...');
    
    // Force refresh the Firebase ID token
    const freshToken = await getCurrentUserIdToken(true);
    
    if (freshToken) {
      // Update localStorage with the new token
      localStorage.setItem('auth_token', freshToken);
      console.log('✅ Firebase ID token refreshed successfully');
      return freshToken;
    } else {
      console.warn('⚠️ No fresh token returned from Firebase');
      return null;
    }
  } catch (error) {
    console.error('❌ Token refresh failed:', error);
    
    // If Firebase auth is not available or user is not signed in,
    // clear the auth state completely
    if (error instanceof Error && error.message.includes('No Firebase user signed in')) {
      localStorage.removeItem('auth_token');
      // Clear all caches
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('auth_verification_')) {
          localStorage.removeItem(key);
        }
      });
    }
    
    return null;
  }
}

// Define the auth context interface using our unified user type
interface AuthContextType {
  user: AuthenticatedUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
}

// Create the context with default values
const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAuthenticated: false,
  signOut: async () => {}
});

// AuthProvider props interface
interface AuthProviderProps {
  children: ReactNode;
  initialUser?: AuthenticatedUser | null;
}

// AuthProvider component that manages unified auth state
export function AuthProvider({ children, initialUser }: AuthProviderProps) {
  const [user, setUser] = useState<AuthenticatedUser | null>(initialUser || null);
  const [loading, setLoading] = useState(!initialUser);

  useEffect(() => {
    // Only check auth state once on mount
    let mounted = true;
    
    const checkAuthState = async () => {
      if (process.env.NODE_ENV === 'development') {
        console.debug('🔍 [AuthContext] checkAuthState started', { mounted, initialUser });
      }
      
      // Add a safety timeout to prevent infinite loading
      const timeoutId = setTimeout(() => {
        if (mounted) {
          console.warn('⏰ AuthContext: Auth check timed out after 10 seconds, forcing loading to false');
          setLoading(false);
          setUser(null);
        }
      }, 10000);
      
      // Skip auth checks on authentication and marketing pages to prevent API loops and hydration issues
      const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
      const isAuthPage = ['/sign-in', '/sign-up'].includes(currentPath);
      const isMarketingPage = currentPath === '/' || currentPath.startsWith('/marketing');
      
      if (process.env.NODE_ENV === 'development') {
        console.debug('🔍 [AuthContext] Path check', { currentPath, isAuthPage, isMarketingPage });
      }
      
      if (isAuthPage || isMarketingPage) {
        console.log(`🚫 Auth check skipped: on ${isAuthPage ? 'authentication' : 'marketing'} page (${currentPath})`);
        if (mounted) {
          setUser(null);
          setLoading(false);
        }
        if (process.env.NODE_ENV === 'development') {
          console.debug('🔍 [AuthContext] Early return - auth/marketing page', { mounted });
        }
        clearTimeout(timeoutId);
        return;
      }
      try {
        // First check for session cookie to avoid unnecessary API call
        const cookies = document.cookie.split(';').reduce((acc, cookie) => {
          const [name, value] = cookie.trim().split('=');
          acc[name] = value;
          return acc;
        }, {} as Record<string, string>);
        
        const sessionCookie = cookies.session;
        const token = localStorage.getItem('auth_token');
        
        // If no session cookie and no token, user is not authenticated
        if (!sessionCookie && !token) {
          if (process.env.NODE_ENV === 'development') {
            console.debug('🔍 [AuthContext] No session cookie or token found', { mounted });
          }
          if (mounted) {
            setUser(null);
            setLoading(false);
          }
          clearTimeout(timeoutId);
          return;
        }
        
        // Only verify token if we have one
        if (token) {
          // Check for cached verification result (15 min cache)
          const cacheKey = `auth_verification_${token.substring(0, 10)}`;
          const cachedVerification = localStorage.getItem(cacheKey);
          
          if (cachedVerification) {
            try {
              const cached = JSON.parse(cachedVerification);
              const cacheAge = Date.now() - cached.timestamp;
              
              // Use cached result if less than 15 minutes old
              if (cacheAge < 15 * 60 * 1000) {
                console.log('🚀 Using cached auth verification');
                if (process.env.NODE_ENV === 'development') {
                  console.debug('🔍 [AuthContext] Cache hit', { mounted, verified: cached.verified, hasUser: !!cached.user });
                }
                if (mounted && cached.verified && cached.user) {
                  setUser(cached.user);
                }
                if (mounted) {
                  setLoading(false);
                }
                clearTimeout(timeoutId);
                return;
              } else {
                // Remove expired cache
                if (process.env.NODE_ENV === 'development') {
                  console.debug('🔍 [AuthContext] Cache expired, removing', { cacheAge: cacheAge / 1000 + 's' });
                }
                localStorage.removeItem(cacheKey);
              }
            } catch (error) {
              // Invalid cache, remove it
              localStorage.removeItem(cacheKey);
            }
          }
          
          console.log('🔍 Verifying auth token via API');
          if (process.env.NODE_ENV === 'development') {
            console.debug('🔍 [AuthContext] Making /api/auth/verify request', { tokenLength: token?.length });
          }
          
          // Create AbortController for timeout
          const abortController = new AbortController();
          const requestTimeout = setTimeout(() => abortController.abort(), 5000);
          
          const response = await fetch('/api/auth/verify', {
            headers: {
              'Authorization': `Bearer ${token}`
            },
            signal: abortController.signal
          });
          
          clearTimeout(requestTimeout);
          
          if (response.ok) {
            const userData = await response.json();
            
            if (process.env.NODE_ENV === 'development') {
              console.debug('🔍 [AuthContext] API verification success', { mounted, hasUser: !!userData.user });
            }
            
            // Cache successful verification
            const cacheData = {
              verified: true,
              user: userData.user,
              timestamp: Date.now()
            };
            localStorage.setItem(cacheKey, JSON.stringify(cacheData));
            
            if (mounted) {
              setUser(userData.user);
              setLoading(false);
            }
          } else if (response.status === 401) {
            // Token is invalid/expired, check if server suggests refresh
            const errorData = await response.json().catch(() => ({}));
            const shouldRefresh = errorData.shouldRefresh !== false; // Default to true
            
            console.log('🔄 Token expired/invalid:', errorData.error || 'Unknown error');
            
            if (shouldRefresh) {
              console.log('🔄 Attempting token refresh...');
            
              try {
                const refreshed = await refreshAuthToken();
                if (refreshed && mounted) {
                  // Retry verification with new token
                  const retryAbortController = new AbortController();
                  const retryTimeout = setTimeout(() => retryAbortController.abort(), 5000);
                  
                  const retryResponse = await fetch('/api/auth/verify', {
                    headers: {
                      'Authorization': `Bearer ${refreshed}`
                    },
                    signal: retryAbortController.signal
                  });
                  
                  clearTimeout(retryTimeout);
                  
                  if (retryResponse.ok) {
                    const userData = await retryResponse.json();
                    
                    // Cache successful verification with new token
                    const newCacheKey = `auth_verification_${refreshed.substring(0, 10)}`;
                    const cacheData = {
                      verified: true,
                      user: userData.user,
                      timestamp: Date.now()
                    };
                    localStorage.setItem(newCacheKey, JSON.stringify(cacheData));
                    
                    if (mounted) {
                      setUser(userData.user);
                      setLoading(false);
                    }
                    clearTimeout(timeoutId);
                    return;
                  }
                }
              } catch (refreshError) {
                console.error('🔄 Token refresh failed:', refreshError);
              }
            }
            
            // If refresh failed or not recommended, clear auth state
            localStorage.removeItem('auth_token');
            // Clear all verification caches
            Object.keys(localStorage).forEach(key => {
              if (key.startsWith('auth_verification_')) {
                localStorage.removeItem(key);
              }
            });
            
            if (mounted) {
              setUser(null);
              setLoading(false);
            }
          } else {
            // Other error, cache failed verification temporarily (1 min)
            const cacheData = {
              verified: false,
              user: null,
              timestamp: Date.now() - (14 * 60 * 1000) // Expire quickly for failed attempts
            };
            localStorage.setItem(cacheKey, JSON.stringify(cacheData));
            
            localStorage.removeItem('auth_token');
            if (mounted) {
              setUser(null);
              setLoading(false);
            }
          }
        } else if (sessionCookie) {
          // If we have session cookie but no token, consider user logged in
          // but with minimal user data
          if (mounted) {
            setUser({ uid: 'session-user', email: 'unknown@session.com', email_verified: false });
            setLoading(false);
          }
        }
      } catch (error) {
        clearTimeout(timeoutId);
        console.error('Auth state check failed:', error);
        if (process.env.NODE_ENV === 'development') {
          console.debug('🔍 [AuthContext] Auth check error', { 
            mounted, 
            error: (error as Error).message,
            name: (error as Error).name,
            isAbortError: (error as Error).name === 'AbortError'
          });
        }
        if (mounted) {
          setUser(null);
          setLoading(false);
        }
      } finally {
        clearTimeout(timeoutId);
        if (process.env.NODE_ENV === 'development') {
          console.debug('🔍 [AuthContext] Auth check completed', { mounted });
        }
        if (mounted) {
          setLoading(false);
        }
      }
    };

    if (!initialUser) {
      checkAuthState();
    } else {
      setLoading(false);
    }
    
    return () => {
      mounted = false;
    };
  }, [initialUser]);

  const signOut = async () => {
    try {
      await fetch('/api/auth/signout', { method: 'POST' });
      localStorage.removeItem('auth_token');
      setUser(null);
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const contextValue: AuthContextType = {
    user,
    loading,
    isAuthenticated: !!user,
    signOut
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to use the auth context
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  
  return context;
}

// Export the context for advanced use cases
export { AuthContext };
