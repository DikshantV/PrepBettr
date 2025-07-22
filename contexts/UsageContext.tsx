"use client";

import { createContext, useContext, ReactNode, useEffect, useState, useCallback } from "react";
import { 
  collection, 
  doc, 
  onSnapshot, 
  updateDoc,
  increment,
  serverTimestamp 
} from "firebase/firestore";
import { db } from "@/firebase/client";
import { useAuth } from "@/contexts/AuthContext";
import { UserUsageCounters, UsageCounter } from "@/types/subscription";

// Define the usage context interface
interface UsageContextType {
  usage: UserUsageCounters | null;
  loading: boolean;
  error: string | null;
  // Client-side optimistic updates
  incrementUsageOptimistic: (feature: keyof UserUsageCounters) => void;
  canUseFeature: (feature: keyof UserUsageCounters) => boolean;
  getRemainingCount: (feature: keyof UserUsageCounters) => number;
}

// Create the context with default values
const UsageContext = createContext<UsageContextType>({
  usage: null,
  loading: true,
  error: null,
  incrementUsageOptimistic: () => {},
  canUseFeature: () => false,
  getRemainingCount: () => 0,
});

// UsageProvider props interface
interface UsageProviderProps {
  children: ReactNode;
}

// UsageProvider component that manages usage state with real-time listeners
export function UsageProvider({ children }: UsageProviderProps) {
  const [usage, setUsage] = useState<UserUsageCounters | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, isAuthenticated } = useAuth();

  // Set up real-time listeners for usage counters
  useEffect(() => {
    if (!isAuthenticated || !user) {
      setUsage(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Create listener for the user's usage counters subcollection
    const usageRef = collection(db, 'usage', user.id, 'counters');
    
    const unsubscribe = onSnapshot(
      usageRef,
      (snapshot) => {
        try {
          const usageData: Partial<UserUsageCounters> = {};
          
          snapshot.docs.forEach((doc) => {
            const data = doc.data();
            const counter: UsageCounter = {
              count: data.count || 0,
              limit: data.limit || 0,
              updatedAt: data.updatedAt?.toDate() || new Date()
            };
            
            (usageData as any)[doc.id] = counter;
          });

          // Ensure we have all required counters, even if they don't exist yet
          const completeUsage: UserUsageCounters = {
            interviews: usageData.interviews || { count: 0, limit: 0, updatedAt: new Date() },
            resumeTailor: usageData.resumeTailor || { count: 0, limit: 0, updatedAt: new Date() },
            autoApply: usageData.autoApply || { count: 0, limit: 0, updatedAt: new Date() },
          };

          setUsage(completeUsage);
          setLoading(false);
        } catch (err) {
          console.error('Error processing usage data:', err);
          setError('Failed to process usage data');
          setLoading(false);
        }
      },
      (err) => {
        console.error('Error listening to usage counters:', err);
        setError('Failed to load usage data');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, isAuthenticated]);

  // Optimistic client-side counter increment
  const incrementUsageOptimistic = useCallback(
    async (feature: keyof UserUsageCounters) => {
      if (!user || !usage) return;

      const currentCounter = usage[feature];
      
      // Check if user can use the feature before incrementing
      if (currentCounter.limit !== -1 && currentCounter.count >= currentCounter.limit) {
        return; // Don't increment if limit reached
      }

      // Optimistically update the local state
      setUsage(prev => {
        if (!prev) return prev;
        
        return {
          ...prev,
          [feature]: {
            ...prev[feature],
            count: prev[feature].count + 1,
            updatedAt: new Date()
          }
        };
      });

      // Update Firestore in the background
      try {
        const counterRef = doc(db, 'usage', user.id, 'counters', feature);
        await updateDoc(counterRef, {
          count: increment(1),
          updatedAt: serverTimestamp()
        });
      } catch (err) {
        console.error(`Error updating ${feature} counter:`, err);
        
        // Revert optimistic update on error
        setUsage(prev => {
          if (!prev) return prev;
          
          return {
            ...prev,
            [feature]: {
              ...prev[feature],
              count: Math.max(0, prev[feature].count - 1), // Revert but don't go below 0
            }
          };
        });
      }
    },
    [user, usage]
  );

  // Check if user can use a feature
  const canUseFeature = useCallback(
    (feature: keyof UserUsageCounters): boolean => {
      if (!usage) return false;
      
      const counter = usage[feature];
      return counter.limit === -1 || counter.count < counter.limit;
    },
    [usage]
  );

  // Get remaining count for a feature
  const getRemainingCount = useCallback(
    (feature: keyof UserUsageCounters): number => {
      if (!usage) return 0;
      
      const counter = usage[feature];
      if (counter.limit === -1) return Infinity; // Unlimited
      
      return Math.max(0, counter.limit - counter.count);
    },
    [usage]
  );

  const contextValue: UsageContextType = {
    usage,
    loading,
    error,
    incrementUsageOptimistic,
    canUseFeature,
    getRemainingCount,
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
