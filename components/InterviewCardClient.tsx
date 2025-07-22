"use client";

import dayjs from "dayjs";
import Link from "next/link";
import Image from "next/image";

import { Button } from "./ui/button";
import DisplayTechIcons from "./DisplayTechIcons";
import { useFeedback } from "@/lib/hooks/useFirestore";
import { useAuth } from "@/contexts/AuthContext";
import { RequireQuota } from "@/components/RequireQuota";

import { cn, getRandomInterviewCover } from "@/lib/utils";

interface InterviewCardClientProps {
    interviewId?: string;
    role: string;
    type: string;
    techstack: string[];
    createdAt?: string;
}

const InterviewCardClient = ({
    interviewId,
    role,
    type,
    techstack,
    createdAt,
}: InterviewCardClientProps) => {
    const { user } = useAuth();
    const userId = user?.id;
    
    const { feedback, loading: feedbackLoading } = useFeedback(
        userId && interviewId ? interviewId : null
    );

    const normalizedType = /mix/gi.test(type) ? "Mixed" : type;

    const badgeColor =
        {
            Behavioral: "bg-light-400",
            Mixed: "bg-light-600",
            Technical: "bg-light-800",
        }[normalizedType] || "bg-light-600";

    const formattedDate = dayjs(
        feedback?.createdAt || createdAt || new Date('2024-01-01')
    ).format("MMM D, YYYY");

    return (
        <div className="card-border w-[360px] max-sm:w-full min-h-96">
            <div className="card-interview">
                <div>
                    {/* Type Badge */}
                    <div
                        className={cn(
                            "absolute top-0 right-0 w-fit px-4 py-2 rounded-bl-lg",
                            badgeColor
                        )}
                    >
                        <p className="badge-text ">{normalizedType}</p>
                    </div>

                    {/* Cover Image */}
                    <Image
                        src={getRandomInterviewCover(interviewId)}
                        alt="cover-image"
                        width={90}
                        height={90}
                        className="rounded-full object-fit size-[90px]"
                    />

                    {/* Interview Role */}
                    <h3 className="mt-5 capitalize">{role} Interview</h3>

                    {/* Date & Score */}
                    <div className="flex flex-row gap-5 mt-3">
                        <div className="flex flex-row gap-2">
                            <Image
                                src="/calendar.svg"
                                width={22}
                                height={22}
                                alt="calendar"
                            />
                            <p>{formattedDate}</p>
                        </div>

                        <div className="flex flex-row gap-2 items-center">
                            <Image src="/star.svg" width={22} height={22} alt="star" />
                            <p>
                                {feedbackLoading 
                                    ? "..." 
                                    : feedback?.totalScore || "---"
                                }/100
                            </p>
                        </div>
                    </div>

                    {/* Feedback or Placeholder Text */}
                    <p className="line-clamp-2 mt-5">
                        {feedbackLoading
                            ? "Loading feedback..."
                            : feedback?.finalAssessment ||
                              "You haven't taken this interview yet. Take it now to improve your skills."}
                    </p>
                </div>

                <div className="flex flex-row justify-between items-center">
                    <DisplayTechIcons 
                        techStack={techstack} 
                        maxIcons={4}
                        iconSize="sm"
                        showTooltip={true}
                    />

                    {feedback ? (
                        <Button className="btn-primary">
                            <Link href={`/dashboard/interview/${interviewId}/feedback`}>
                                Check Feedback
                            </Link>
                        </Button>
                    ) : (
                        <RequireQuota 
                            feature="interviews"
                            fallback={
                                <Button className="btn-primary">
                                    <Link href={`/dashboard/interview/${interviewId}`}>
                                        View Interview
                                    </Link>
                                </Button>
                            }
                        >
                            <Button className="btn-primary">
                                <Link href={`/dashboard/interview/${interviewId}`}>
                                    Take Interview
                                </Link>
                            </Button>
                        </RequireQuota>
                    )}
                </div>
            </div>
        </div>
    );
};

export default InterviewCardClient;
