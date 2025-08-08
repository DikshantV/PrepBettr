"use client";

import Link from "next/link";
import Image from "next/image";
import { useRef } from "react";

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
import { normalizeTechstack } from "@/lib/utils";

export default function DashboardClientRealtime() {
  const { user, loading: authLoading } = useAuth();
  const carouselRef = useRef<HTMLUListElement>(null);
  
  // Real-time hooks with SWR caching
  const {
    data: userInterviews = [],
    isLoading: userInterviewsLoading,
    error: userInterviewsError
  } = useRealtimeUserInterviews();

  const {
    data: publicInterviews = [],
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

  const scrollCarousel = (direction: 'left' | 'right') => {
    if (carouselRef.current) {
      const scrollAmount = direction === 'left' ? -400 : 400;
      carouselRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

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
              {(userInterviews as any[]).slice(0, 6).map((interview: any) => (
                <InterviewCardClient
                  key={interview.id}
                  interviewId={interview.id}
                  role={interview.role}
                  type={interview.type}
                  techstack={normalizeTechstack(interview.techstack)}
                  createdAt={interview.createdAt}
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

      {/* Mock Interviews (Public) - Horizontal Carousel */}
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
            <div className="relative">
              <ul className="flex overflow-x-auto scroll-snap-x gap-4 no-scrollbar">
                {Array.from({ length: 4 }).map((_, i) => (
                  <li key={i} className="flex-shrink-0 w-[360px] scroll-snap-start">
                    <InterviewCardSkeleton />
                  </li>
                ))}
              </ul>
            </div>
          }
        >
          <div className="relative">
            {/* Carousel Container */}
            <ul 
              ref={carouselRef}
              className="flex overflow-x-auto scroll-snap-x gap-4 no-scrollbar"
            >
              {(publicInterviews as any[]).slice(0, 8).map((interview: any) => (
                <li key={interview.id} className="flex-shrink-0 w-[360px] scroll-snap-start">
                  <InterviewCardClient
                    interviewId={interview.id}
                    role={interview.role}
                    type={interview.type}
                    techstack={normalizeTechstack(interview.techstack)}
                    createdAt={interview.createdAt}
                  />
                </li>
              ))}
            </ul>

            {/* Navigation Buttons - Positioned on the right side */}
            {publicInterviews.length > 3 && (
              <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-16 z-10 flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="bg-background/80 backdrop-blur-sm"
                  onClick={() => scrollCarousel('left')}
                  aria-label="Previous interviews"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="bg-background/80 backdrop-blur-sm"
                  onClick={() => scrollCarousel('right')}
                  aria-label="Next interviews"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </Button>
              </div>
            )}
          </div>
        </DataSuspense>
      </section>

    </div>
  );
}
