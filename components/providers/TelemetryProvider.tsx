"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { telemetry } from '@/lib/utils/telemetry-stub';

interface TelemetryContextValue {
  trackPageView: (name: string, properties?: { [key: string]: string }) => Promise<void>;
  trackEvent: (name: string, properties?: { [key: string]: string }, measurements?: { [key: string]: number }) => Promise<void>;
  trackUserAction: (action: string, feature: string, properties?: { [key: string]: string }) => Promise<void>;
  trackFeatureUsage: (featureName: string, properties?: { [key: string]: string }) => Promise<void>;
  trackButtonClick: (buttonName: string, properties?: { [key: string]: string }) => Promise<void>;
  trackFormSubmission: (formName: string, success?: boolean, properties?: { [key: string]: string }) => Promise<void>;
  trackInterviewCompletion: (interviewId: string, questionCount: number, duration: number, score?: number) => Promise<void>;
  trackResumeUpload: (fileSize: number, mimeType: string, processingTime: number) => Promise<void>;
  trackError: (error: Error, context?: { [key: string]: string }) => Promise<void>;
  isInitialized: boolean;
}

const TelemetryContext = createContext<TelemetryContextValue | null>(null);

interface TelemetryProviderProps {
  children: React.ReactNode;
}

export function TelemetryProvider({ children }: TelemetryProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    const initTelemetry = async () => {
      try {
        await telemetry.initialize();
        setIsInitialized(true);

        // Track initial page view
        await telemetry.trackPageView({
          name: document.title,
          uri: window.location.pathname + window.location.search,
          userId: user?.uid,
          isLoggedIn: !!user
        });
      } catch (error) {
        console.error('Failed to initialize telemetry:', error);
      }
    };

    initTelemetry();
  }, [user]);

  // Set user context when user changes
  useEffect(() => {
    const updateUserContext = async () => {
      if (!isInitialized) return;

      if (user) {
        await telemetry.setUser(user.uid, user.email || undefined, {
          isEmailVerified: user.email_verified?.toString() || 'false',
          creationTime: 'unknown' // metadata not available in AuthenticatedUser type
        });
      } else {
        await telemetry.clearUser();
      }
    };

    updateUserContext();
  }, [user, isInitialized]);

  // Track route changes
  useEffect(() => {
    if (!isInitialized) return;

    const handleRouteChange = async (url: string) => {
      await telemetry.trackPageView({
        name: document.title,
        uri: url,
        userId: user?.uid,
        isLoggedIn: !!user
      });
    };

    // For Next.js app router, we need to listen for navigation events differently
    // This is a simplified version - you might need to adjust based on your routing setup
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function(...args) {
      originalPushState.apply(this, args);
      handleRouteChange(window.location.pathname + window.location.search);
    };

    window.history.replaceState = function(...args) {
      originalReplaceState.apply(this, args);
      handleRouteChange(window.location.pathname + window.location.search);
    };

    window.addEventListener('popstate', () => {
      handleRouteChange(window.location.pathname + window.location.search);
    });

    return () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      window.removeEventListener('popstate', () => {});
    };
  }, [isInitialized, user]);

  const contextValue: TelemetryContextValue = {
    trackPageView: async (name: string, properties?: { [key: string]: string }) => {
      await telemetry.trackPageView({
        name,
        uri: window.location.pathname + window.location.search,
        userId: user?.uid,
        isLoggedIn: !!user,
        properties
      });
    },

    trackEvent: async (name: string, properties?: { [key: string]: string }, measurements?: { [key: string]: number }) => {
      await telemetry.trackEvent({
        name,
        properties: {
          userId: user?.uid || 'anonymous',
          ...properties
        },
        measurements
      });
    },

    trackUserAction: async (action: string, feature: string, properties?: { [key: string]: string }) => {
      await telemetry.trackUserAction({
        action,
        feature,
        userId: user?.uid,
        properties
      });
    },

    trackFeatureUsage: async (featureName: string, properties?: { [key: string]: string }) => {
      await telemetry.trackFeatureUsage(featureName, user?.uid, properties);
    },

    trackButtonClick: async (buttonName: string, properties?: { [key: string]: string }) => {
      await telemetry.trackButtonClick(buttonName, window.location.pathname, user?.uid, properties);
    },

    trackFormSubmission: async (formName: string, success?: boolean, properties?: { [key: string]: string }) => {
      await telemetry.trackFormSubmission(formName, user?.uid, success, properties);
    },

    trackInterviewCompletion: async (interviewId: string, questionCount: number, duration: number, score?: number) => {
      if (!user?.uid) return;
      await telemetry.trackInterviewCompletion(user.uid, interviewId, questionCount, duration, score);
    },

    trackResumeUpload: async (fileSize: number, mimeType: string, processingTime: number) => {
      if (!user?.uid) return;
      await telemetry.trackResumeUpload(user.uid, fileSize, mimeType, processingTime);
    },

    trackError: async (error: Error, context?: { [key: string]: string }) => {
      await telemetry.trackError({
        error,
        userId: user?.uid,
        context
      });
    },

    isInitialized
  };

  return (
    <TelemetryContext.Provider value={contextValue}>
      {children}
    </TelemetryContext.Provider>
  );
}

export function useTelemetry(): TelemetryContextValue {
  const context = useContext(TelemetryContext);
  if (!context) {
    throw new Error('useTelemetry must be used within a TelemetryProvider');
  }
  return context;
}

export default TelemetryProvider;
