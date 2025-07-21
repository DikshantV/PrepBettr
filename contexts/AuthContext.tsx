"use client";

import { createContext, useContext, ReactNode } from "react";

// Define the auth context interface
interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Create the context with default values
const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: false,
});

// AuthProvider props interface
interface AuthProviderProps {
  children: ReactNode;
  user: User | null;
  isLoading?: boolean;
}

// AuthProvider component that wraps client components
export function AuthProvider({ children, user, isLoading = false }: AuthProviderProps) {
  const contextValue: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
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
