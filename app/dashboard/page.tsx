export const dynamic = 'force-dynamic';

import Link from "next/link";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import InterviewCard from "@/components/InterviewCard";

import { getCurrentUser } from "@/lib/actions/auth.action";
import {
    getInterviewsByUserId,
    getLatestInterviews,
} from "@/lib/actions/general.action";

async function Home() {
    const user = await getCurrentUser();

    if (!user) {
        return (
            <>
                <section className="card-cta">
                    <div className="flex flex-col gap-6 max-w-lg">
                        <h2>Get Interview-Ready with AI-Powered Practice & Feedback</h2>
                        <p className="text-lg">
                            Please sign in to access your interviews
                        </p>
                    </div>
                </section>
            </>
        );
    }

    const [userInterviews, allInterviews] = await Promise.all([
        getInterviewsByUserId(user.id),
        getLatestInterviews({ userId: user.id }),
    ]);

    const hasPastInterviews = userInterviews.length > 0;
    const hasUpcomingInterviews = allInterviews && allInterviews.length > 0;

    return (
        <>
            <section className="card-cta">
                <div className="flex flex-col gap-6 max-w-lg">
                    <h2>Get Interview-Ready with AI-Powered Practice & Feedback</h2>
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
                <h2>Your Interviews</h2>

                <div className="interviews-section">
                    {!user ? (
                        <p className="text-center py-8">
                            <Link href="/sign-in" className="text-primary hover:underline">
                                Sign in
                            </Link> to view your past interviews
                        </p>
                    ) : hasPastInterviews ? (
                        userInterviews.map((interview) => (
                            <InterviewCard
                                key={interview.id}
                                userId={user?.id}
                                interviewId={interview.id}
                                role={interview.role}
                                type={interview.type}
                                techstack={interview.techstack}
                                createdAt={interview.createdAt}
                            />
                        ))
                    ) : (
                        <p>You haven&apos;t taken any interviews yet</p>
                    )}
                </div>
            </section>

            <section className="flex flex-col gap-6 mt-8">
                <h2>Take Interviews</h2>

                <div className="interviews-section">
                    {!user ? (
                        <p className="text-center py-8">
                            <Link href="/sign-in" className="text-primary hover:underline">
                                Sign in
                            </Link> to view all interviews
                        </p>
                    ) : hasUpcomingInterviews ? (
                        allInterviews.map((interview) => (
                            <InterviewCard
                                key={interview.id}
                                userId={user?.id}
                                interviewId={interview.id}
                                role={interview.role}
                                type={interview.type}
                                techstack={interview.techstack}
                                createdAt={interview.createdAt}
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

export default Home;