"use client";

import { createContext, useContext, ReactNode, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/firebase/client";
import type { User as FirebaseUser } from "firebase/auth";
import { initializeUser } from "@/lib/utils/jwt-decoder";

// Define the auth context interface
interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
}

// Create the context with default values
const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true, // Start with loading true for SSR consistency
  isAuthenticated: false,
});

// AuthProvider props interface
interface AuthProviderProps {
  children: ReactNode;
  initialUser?: User | null; // Accept initial user from server
}

// Helper function to convert Firebase User to our consistent User format
function convertFirebaseUserToUser(firebaseUser: FirebaseUser): User {
  // Create a token-like object to use with initializeUser for consistency
  const tokenLikeObject = {
    uid: firebaseUser.uid,
    email: firebaseUser.email ?? undefined,
    name: firebaseUser.displayName ?? undefined,
    picture: firebaseUser.photoURL ?? undefined,
    email_verified: firebaseUser.emailVerified,
    // Required fields for DecodedToken interface (not used but needed for type compatibility)
    exp: Math.floor(Date.now() / 1000) + 3600, 
    iat: Math.floor(Date.now() / 1000),
    aud: '',
    iss: 'firebase-client'
  };
  
  return initializeUser(tokenLikeObject);
}

// AuthProvider component that manages auth state
export function AuthProvider({ children, initialUser }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(initialUser || null);
  const [loading, setLoading] = useState(!initialUser); // If we have initial user, don't start loading

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        const userData: User = convertFirebaseUserToUser(firebaseUser);
        setUser(userData);
      } else {
        // Only set user to null if we don't have an initial user from server
        // This prevents clearing the user when Firebase client auth hasn't loaded yet
        if (!initialUser) {
          setUser(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [initialUser]);

  const contextValue: AuthContextType = {
    user,
    loading,
    isAuthenticated: !!user,
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
