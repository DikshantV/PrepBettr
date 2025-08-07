"use client";

import { ReactNode, Suspense } from 'react';
import { Skeleton } from './skeleton';
import { Card, CardContent, CardHeader } from './card';
import BanterLoader from './BanterLoader';

// Interview card skeleton
export function InterviewCardSkeleton() {
  return (
    <Card className="w-full">
      <CardHeader className="space-y-2">
        <div className="flex justify-between items-start">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-16" />
        </div>
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-18" />
        </div>
        <div className="flex justify-between items-center">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-8 w-24" />
        </div>
      </CardContent>
    </Card>
  );
}

// Dashboard loading skeleton
export function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      {/* Hero section skeleton */}
      <section className="card-cta">
        <div className="flex flex-col gap-6 max-w-lg">
          <Skeleton className="h-12 w-96" />
          <Skeleton className="h-6 w-80" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="max-sm:hidden">
          <Skeleton className="h-80 w-80 rounded-lg" />
        </div>
      </section>

      {/* Interviews section skeleton */}
      <section className="flex flex-col gap-6">
        <Skeleton className="h-8 w-48" />
        <div className="interviews-section">
          {Array.from({ length: 4 }).map((_, i) => (
            <InterviewCardSkeleton key={i} />
          ))}
        </div>
      </section>
    </div>
  );
}

// Feedback page skeleton
export function FeedbackSkeleton() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 p-6">
      {/* Header skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="flex gap-4">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-18" />
        </div>
      </div>

      {/* Feedback cards skeleton */}
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="w-full">
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Interview detail skeleton
export function InterviewDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-20" />
        </div>
      </div>

      {/* Questions */}
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4 space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Real-time status indicator
export function RealtimeStatusIndicator({ 
  isConnected, 
  lastUpdate 
}: { 
  isConnected: boolean; 
  lastUpdate?: Date;
}) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <div 
        className={`w-2 h-2 rounded-full ${
          isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
        }`} 
      />
      <span>
        {isConnected ? 'Live' : 'Disconnected'}
        {lastUpdate && (
          <span className="ml-1">
            • Updated {lastUpdate.toLocaleTimeString()}
          </span>
        )}
      </span>
    </div>
  );
}

// Enhanced suspense wrapper with error boundary
interface DataSuspenseProps {
  children: ReactNode;
  fallback?: ReactNode;
  error?: string | null;
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
}

export function DataSuspense({
  children,
  fallback,
  error,
  isLoading,
  isEmpty = false,
  emptyMessage = "No data available"
}: DataSuspenseProps) {
  // Show error state
  if (error) {
    return (
      <Card className="w-full p-6 text-center">
        <CardContent>
          <div className="text-destructive mb-2">⚠️ Error</div>
          <p className="text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  // Show loading state
  if (isLoading) {
    return fallback || <BanterLoader text="Loading..." />;
  }

  // Show empty state
  if (isEmpty) {
    return (
      <Card className="w-full p-6 text-center">
        <CardContent>
          <div className="text-muted-foreground mb-2">📭</div>
          <p className="text-muted-foreground">{emptyMessage}</p>
        </CardContent>
      </Card>
    );
  }

  // Show data
  return <>{children}</>;
}

// Optimistic update indicator
export function OptimisticUpdateIndicator({ 
  isPending, 
  message = "Saving..." 
}: { 
  isPending: boolean; 
  message?: string;
}) {
  if (!isPending) return null;

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
      <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      <span>{message}</span>
    </div>
  );
}
