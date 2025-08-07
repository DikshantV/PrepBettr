"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DisplayTechIcons from "@/components/DisplayTechIcons";
import { useRealtimeInterview } from "@/lib/hooks/useRealtimeFirestore";
import { OptimisticUpdateIndicator } from "@/components/ui/LoadingStates";
import { useState } from "react";
import useSWR, { mutate } from "swr";

interface InterviewCardRealtimeProps {
  interviewId: string;
  role?: string;
  type?: string;
  techstack?: string;
  createdAt?: any;
  isOwner?: boolean;
  className?: string;
}

export default function InterviewCardRealtime({
  interviewId,
  role: initialRole,
  type: initialType,
  techstack: initialTechstack,
  createdAt: initialCreatedAt,
  isOwner = false,
  className
}: InterviewCardRealtimeProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Use real-time hook to get latest data
  const { 
    data: interview, 
    isLoading, 
    error 
  } = useRealtimeInterview(interviewId);

  // Use latest data from real-time hook or fall back to initial props
  const role = interview?.role || initialRole || "Loading...";
  const type = interview?.type || initialType || "";
  const techstack = interview?.techstack || initialTechstack || "";
  const createdAt = interview?.createdAt || initialCreatedAt;
  const finalized = interview?.finalized || false;
  const status = interview?.status || "draft";

  // Show loading skeleton if we don't have any data
  if (isLoading && !interview && !initialRole) {
    return (
      <Card className={`w-full animate-pulse ${className}`}>
        <CardHeader className="space-y-2">
          <div className="flex justify-between items-start">
            <div className="h-5 w-32 bg-muted rounded" />
            <div className="h-4 w-16 bg-muted rounded" />
          </div>
          <div className="h-4 w-24 bg-muted rounded" />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <div className="h-6 w-16 bg-muted rounded" />
            <div className="h-6 w-20 bg-muted rounded" />
            <div className="h-6 w-18 bg-muted rounded" />
          </div>
          <div className="flex justify-between items-center">
            <div className="h-4 w-28 bg-muted rounded" />
            <div className="h-8 w-24 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "Recent";
    
    let date: Date;
    if (timestamp?.toDate) {
      date = timestamp.toDate();
    } else if (timestamp?.seconds) {
      date = new Date(timestamp.seconds * 1000);
    } else {
      date = new Date(timestamp);
    }
    
    return date.toLocaleDateString();
  };

  const getStatusColor = () => {
    switch (status) {
      case 'completed':
      case 'finalized':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'draft':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const getStatusText = () => {
    if (finalized) return 'Completed';
    switch (status) {
      case 'in_progress':
        return 'In Progress';
      case 'completed':
        return 'Ready to Review';
      case 'draft':
        return 'Draft';
      default:
        return 'Available';
    }
  };

  // Handle optimistic updates for actions like favoriting, etc.
  const handleOptimisticAction = async (action: string) => {
    setIsUpdating(true);
    try {
      // Perform action
      // This would be your API call
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      
      // The real-time listener will update the data automatically
      
    } catch (error) {
      console.error('Action failed:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card className={`w-full hover:shadow-lg transition-all duration-200 ${className}`}>
      <CardHeader className="space-y-2">
        <div className="flex justify-between items-start">
          <CardTitle className="line-clamp-2">{role}</CardTitle>
          <div className="flex items-center gap-2">
            {isUpdating && (
              <OptimisticUpdateIndicator isPending={true} message="Updating..." />
            )}
            <Badge variant="secondary" className={`text-xs ${getStatusColor()}`}>
              {getStatusText()}
            </Badge>
          </div>
        </div>
        
        {type && (
          <Badge variant="outline" className="w-fit text-xs">
            {type}
          </Badge>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Tech Stack */}
        {techstack && (
          <div className="flex flex-wrap gap-2">
            <DisplayTechIcons techStack={techstack.split(',')} />
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between items-center pt-2">
          <span className="text-sm text-muted-foreground">
            Created {formatDate(createdAt)}
            {isOwner && finalized && (
              <span className="ml-2 text-green-600">✓ Public</span>
            )}
          </span>
          
          <div className="flex gap-2">
            {finalized && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/dashboard/interview/${interviewId}/feedback`}>
                  View Feedback
                </Link>
              </Button>
            )}
            
            <Button size="sm" asChild>
              <Link href={`/dashboard/interview/${interviewId}`}>
                {isOwner ? 'Continue' : 'Practice'}
              </Link>
            </Button>
          </div>
        </div>

        {/* Real-time indicator */}
        {!isLoading && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            <span>Live updates</span>
          </div>
        )}
      </CardContent>

      {error && (
        <CardContent className="pt-0">
          <div className="text-xs text-red-500 bg-red-50 p-2 rounded">
            Failed to load latest data. Showing cached version.
          </div>
        </CardContent>
      )}
    </Card>
  );
}
