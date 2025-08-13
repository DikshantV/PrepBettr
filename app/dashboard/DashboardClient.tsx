"use client";

import Link from "next/link";
import Image from "next/image";
import BanterLoader from "@/components/ui/BanterLoader";

import { Button } from "@/components/ui/button";
import InterviewCardClient from "@/components/InterviewCardClient";
import { useAuth } from "@/contexts/AuthContext";

interface DashboardClientProps {
  userInterviews: Interview[];
  publicInterviews: Interview[];
}

export default function DashboardClient({ userInterviews, publicInterviews }: DashboardClientProps) {
    const { user, loading } = useAuth();

    // Show loading state while auth is being determined
    if (loading) {
        return (
            <>
                <BanterLoader overlay text="Loading your dashboard..." />
                <section className="card-cta">
                    <div className="flex flex-col items-center gap-6 max-w-lg">
                        <h2 className="text-white dark:text-white text-center">Get Interview-Ready with AI-Powered Practice & Feedback</h2>
                        <p className="text-lg text-white text-center">
                            Please wait while we load your dashboard...
                        </p>
                    </div>
                </section>
            </>
        );
    }

    // Show sign in message only if not loading and no user
    if (!user) {
        return (
            <>
                <section className="card-cta">
                    <div className="flex flex-col gap-6 max-w-lg">
                        <h2 className="text-white dark:text-white">Get Interview-Ready with AI-Powered Practice & Feedback</h2>
                        <p className="text-lg">
                            Please sign in to access your interviews
                        </p>
                    </div>
                </section>
            </>
        );
    }

    const hasPastInterviews = userInterviews.length > 0;
    const hasPublicInterviews = publicInterviews && publicInterviews.length > 0;

    return (
        <>
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


            <section className="flex flex-col gap-6 mt-8">
                <h2 className="text-white dark:text-white">Mock Interviews</h2>

                <div className="interviews-section">
                    {hasPublicInterviews ? (
                        publicInterviews.slice(0, 4).map((interview) => (
                            <InterviewCardClient
                                key={interview.id}
                                interviewId={interview.id}
                                role={interview.role || interview.jobTitle || 'Unknown Role'}
                                type={interview.type || 'technical'}
                                techstack={Array.isArray(interview.techstack) ? interview.techstack : interview.techstack ? [interview.techstack] : []}
                                createdAt={typeof interview.createdAt === 'string' ? interview.createdAt : interview.createdAt.toISOString()}
                            />
                        ))
                    ) : (
                        <p>There are no interviews available</p>
                    )}
                </div>
            </section>
        </>
    );
}
