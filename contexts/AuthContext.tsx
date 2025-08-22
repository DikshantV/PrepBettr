"use client";

import { createContext, useContext, ReactNode, useEffect, useState } from "react";
import { AuthenticatedUser } from '@/lib/middleware/authMiddleware-unified';

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
      // Skip auth checks on authentication pages to prevent API loops
      const isAuthPage = typeof window !== 'undefined' && 
        ['/sign-in', '/sign-up'].includes(window.location.pathname);
      
      if (isAuthPage) {
        console.log('🚫 Auth check skipped: on authentication page');
        if (mounted) {
          setUser(null);
          setLoading(false);
        }
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
          if (mounted) {
            setUser(null);
            setLoading(false);
          }
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
                if (mounted && cached.verified && cached.user) {
                  setUser(cached.user);
                }
                if (mounted) {
                  setLoading(false);
                }
                return;
              } else {
                // Remove expired cache
                localStorage.removeItem(cacheKey);
              }
            } catch (error) {
              // Invalid cache, remove it
              localStorage.removeItem(cacheKey);
            }
          }
          
          console.log('🔍 Verifying auth token via API');
          const response = await fetch('/api/auth/verify', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (response.ok) {
            const userData = await response.json();
            
            // Cache successful verification
            const cacheData = {
              verified: true,
              user: userData.user,
              timestamp: Date.now()
            };
            localStorage.setItem(cacheKey, JSON.stringify(cacheData));
            
            if (mounted) {
              setUser(userData.user);
            }
          } else {
            // Cache failed verification temporarily (1 min)
            const cacheData = {
              verified: false,
              user: null,
              timestamp: Date.now() - (14 * 60 * 1000) // Expire quickly for failed attempts
            };
            localStorage.setItem(cacheKey, JSON.stringify(cacheData));
            
            localStorage.removeItem('auth_token');
            if (mounted) {
              setUser(null);
            }
          }
        } else if (sessionCookie) {
          // If we have session cookie but no token, consider user logged in
          // but with minimal user data
          if (mounted) {
            setUser({ uid: 'session-user', email: 'unknown@session.com', email_verified: false });
          }
        }
      } catch (error) {
        console.error('Auth state check failed:', error);
        if (mounted) {
          setUser(null);
        }
      } finally {
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
