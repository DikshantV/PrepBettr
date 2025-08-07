"use client";

import Link from "next/link";
import Image from "next/image";
import { Suspense, useState } from "react";

import { Button } from "@/components/ui/button";
import InterviewCardClient from "@/components/InterviewCardClient";
import { useAuth } from "@/contexts/AuthContext";
import { 
  useRealtimeUserInterviews, 
  useRealtimePublicInterviews 
} from "@/lib/hooks/useRealtimeFirestore";
import {
  DataSuspense,
  DashboardSkeleton,
  InterviewCardSkeleton
} from "@/components/ui/LoadingStates";
import { Card, CardContent } from "@/components/ui/card";

interface DashboardClientRealtimeProps {
  // We can still accept initial data as fallback
  initialUserInterviews?: Interview[];
  initialPublicInterviews?: Interview[];
}

export default function DashboardClientRealtime({ 
  initialUserInterviews = [],
  initialPublicInterviews = []
}: DashboardClientRealtimeProps) {
  const { user, loading: authLoading } = useAuth();
  
  // Real-time hooks with SWR caching
  const {
    data: userInterviews,
    isLoading: userInterviewsLoading,
    error: userInterviewsError
  } = useRealtimeUserInterviews();

  const {
    data: publicInterviews,
    isLoading: publicInterviewsLoading,
    error: publicInterviewsError
  } = useRealtimePublicInterviews(8); // Load more for dashboard

  // Show loading state while auth is being determined
  if (authLoading) {
    return <DashboardSkeleton />;
  }

  // Show sign in message only if not loading and no user
  if (!user) {
    return (
      <section className="card-cta">
        <div className="flex flex-col gap-6 max-w-lg">
          <h2 className="text-white dark:text-white">Get Interview-Ready with AI-Powered Practice & Feedback</h2>
          <p className="text-lg">
            Please sign in to access your interviews
          </p>
        </div>
      </section>
    );
  }

  const hasUserInterviews = userInterviews.length > 0;
  const hasPublicInterviews = publicInterviews.length > 0;

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <section className="card-cta">
        <div className="flex flex-col gap-6 max-w-lg">
          <h2 className="text-white dark:text-white">Get Interview-Ready with AI-Powered Practice & Feedback</h2>
          <p className="text-lg">
            Practice real interview questions & get instant feedback
          </p>

          <Button asChild className="btn-primary max-sm:w-full">
            <Link href="/dashboard/interview">Start an Interview</Link>
          </Button>
        </div>

        <Image
          src="/robot.png"
          alt="robo-dude"
          width={400}
          height={400}
          className="max-sm:hidden"
        />
      </section>

      {/* Your Recent Interviews */}
      {user && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-white dark:text-white">Your Recent Interviews</h2>
          </div>

          <DataSuspense
            isLoading={userInterviewsLoading}
            error={userInterviewsError}
            isEmpty={!hasUserInterviews}
            emptyMessage="You haven't created any interviews yet. Start your first interview above!"
            fallback={
              <div className="interviews-section">
                {Array.from({ length: 3 }).map((_, i) => (
                  <InterviewCardSkeleton key={i} />
                ))}
              </div>
            }
          >
            <div className="interviews-section">
              {userInterviews.slice(0, 6).map((interview) => (
                <InterviewCardClient
                  key={interview.id}
                  interviewId={interview.id}
                  role={interview.role}
                  type={interview.type}
                  techstack={interview.techstack}
                  createdAt={interview.createdAt}
                  isOwner={true}
                />
              ))}
            </div>
            
            {userInterviews.length > 6 && (
              <div className="text-center">
                <Button variant="outline" asChild>
                  <Link href="/dashboard/interviews">View All Your Interviews</Link>
                </Button>
              </div>
            )}
          </DataSuspense>
        </section>
      )}

      {/* Mock Interviews (Public) */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-white dark:text-white">Community Mock Interviews</h2>
        </div>

        <DataSuspense
          isLoading={publicInterviewsLoading}
          error={publicInterviewsError}
          isEmpty={!hasPublicInterviews}
          emptyMessage="No public interviews available at the moment."
          fallback={
            <div className="interviews-section">
              {Array.from({ length: 4 }).map((_, i) => (
                <InterviewCardSkeleton key={i} />
              ))}
            </div>
          }
        >
          <div className="interviews-section">
            {publicInterviews.slice(0, 8).map((interview) => (
              <InterviewCardClient
                key={interview.id}
                interviewId={interview.id}
                role={interview.role}
                type={interview.type}
                techstack={interview.techstack}
                createdAt={interview.createdAt}
                isOwner={false}
              />
            ))}
          </div>
        </DataSuspense>
      </section>

      {/* Real-time Stats Card */}
      <Card className="bg-muted/50">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-2xl font-bold text-primary">
                {userInterviewsLoading ? "..." : userInterviews.length}
              </div>
              <div className="text-sm text-muted-foreground">Your Interviews</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">
                {publicInterviewsLoading ? "..." : publicInterviews.length}
              </div>
              <div className="text-sm text-muted-foreground">Community Interviews</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">
                {userInterviewsLoading ? "..." : userInterviews.filter(i => i.finalized).length}
              </div>
              <div className="text-sm text-muted-foreground">Completed</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
