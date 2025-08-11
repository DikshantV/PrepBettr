"use client";

import dayjs from "dayjs";
import Link from "next/link";
import Image from "next/image";

import { Button } from "./ui/button";
import DisplayTechIcons from "./DisplayTechIcons";
import { TechIconName, techIconMap } from "./tech-icons";
import { useServerFeedback } from "@/lib/hooks/useServerFeedback";
import { useAuth } from "@/contexts/AuthContext";

import { cn, getRandomInterviewCover } from "@/lib/utils";

interface InterviewCardClientProps {
    interviewId?: string;
    role: string;
    type: string;
    techstack: string[];
    createdAt?: string;
    companyLogo?: string;
    level?: string;
}

const InterviewCardClient = ({
    interviewId,
    role,
    type,
    techstack,
    createdAt,
    companyLogo,
    level,
}: InterviewCardClientProps) => {
    const { user } = useAuth();
    const userId = user?.id;
    
    const { feedback, loading: feedbackLoading } = useServerFeedback(
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
        <div className="card-border w-[360px] max-sm:w-full h-96">
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

                    {/* Cover Image - Company Logo or Fallback - Standardized Size */}
                    <div className="size-20 relative">
                        <Image
                            src={companyLogo || getRandomInterviewCover(interviewId)}
                            alt={`${role} logo`}
                            fill
                            className="object-contain rounded-full ring-1 ring-white/10"
                        />
                    </div>

                    {/* Interview Role with Level */}
                    <h3 className="mt-5 capitalize text-white">
                        {role}{level ? ` - ${level}` : ''} Interview
                    </h3>

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
                    <div className="flex flex-row gap-1">
                        {techstack.slice(0, 4).map((tech, index) => {
                            // Check if the tech string is a valid TechIconName
                            const isValidTechIcon = tech in techIconMap;
                            return isValidTechIcon ? (
                                <DisplayTechIcons key={index} name={tech as TechIconName} size={20} />
                            ) : null;
                        }).filter(Boolean)}
                    </div>

                    {feedback ? (
                        <Button className="btn-primary">
                            <Link href={`/dashboard/interview/${interviewId}/feedback`}>
                                Check Feedback
                            </Link>
                        </Button>
                    ) : (
                        <Button className="btn-primary">
                            <Link href={`/dashboard/interview/${interviewId}`}>
                                Take Interview
                            </Link>
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default InterviewCardClient;
