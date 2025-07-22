"use client";

import { createContext, useContext, ReactNode, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/firebase/client";
import type { User as FirebaseUser } from "firebase/auth";

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

// AuthProvider component that manages auth state
export function AuthProvider({ children, initialUser }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(initialUser || null);
  const [loading, setLoading] = useState(!initialUser); // If we have initial user, don't start loading

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        const userData: User = {
          id: firebaseUser.uid,
          name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
          email: firebaseUser.email || '',
          image: firebaseUser.photoURL || undefined,
        };
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
