"use client";

import { createContext, useContext, ReactNode, useState } from "react";

// Define the usage context interface  
interface UsageContextType {
  apiCalls: number;
  incrementApiCalls: () => void;
  resetUsage: () => void;
}

// Create the context with default values
const UsageContext = createContext<UsageContextType>({
  apiCalls: 0,
  incrementApiCalls: () => {},
  resetUsage: () => {},
});

// UsageProvider props interface
interface UsageProviderProps {
  children: ReactNode;
}

// UsageProvider component that manages usage state
export function UsageProvider({ children }: UsageProviderProps) {
  const [apiCalls, setApiCalls] = useState(0);

  const incrementApiCalls = () => {
    setApiCalls(prev => prev + 1);
  };

  const resetUsage = () => {
    setApiCalls(0);
  };

  const contextValue: UsageContextType = {
    apiCalls,
    incrementApiCalls,
    resetUsage,
  };

  return (
    <UsageContext.Provider value={contextValue}>
      {children}
    </UsageContext.Provider>
  );
}

// Custom hook to use the usage context
export function useUsage(): UsageContextType {
  const context = useContext(UsageContext);
  
  if (context === undefined) {
    throw new Error("useUsage must be used within a UsageProvider");
  }
  
  return context;
}

// Export the context for advanced use cases
export { UsageContext };
