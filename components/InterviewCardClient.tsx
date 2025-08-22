"use client";

import dayjs from "dayjs";
import Link from "next/link";
import Image from "next/image";

import { Button } from "./ui/button";
import DisplayTechIcons from "./DisplayTechIcons";
import { TechIconName, techIconMap } from "./tech-icons";
import { useServerFeedback } from "@/lib/hooks/useServerFeedback";
import { useAuth } from "@/contexts/AuthContext";
import { setCommunityInterviewInStorage } from "@/lib/utils/communityInterviewStorage";

import { cn, getRandomInterviewCover } from "@/lib/utils";

interface InterviewCardClientProps {
    interviewId?: string;
    role: string;
    type: string;
    techstack: string[];
    createdAt?: string;
    companyLogo?: string;
    level?: string;
    context?: 'dashboard' | 'community-mock-interview';
    isCommunityCard?: boolean;
}

const InterviewCardClient = ({
    interviewId,
    role,
    type,
    techstack,
    createdAt,
    companyLogo,
    level,
    context = 'dashboard',
    isCommunityCard = false,
}: InterviewCardClientProps) => {
    const { user } = useAuth();
    const userId = user?.uid;
    
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

    // Determine link URLs based on context
    const getInterviewLink = () => {
        if (context === 'community-mock-interview') {
            // Store community interview data in localStorage for persistence
            setCommunityInterviewInStorage({
                id: interviewId || '',
                role,
                type,
                techstack,
                level,
                createdAt,
                companyLogo
            });
            
            return `/community-mock-interview/interview?id=${interviewId}&role=${encodeURIComponent(role)}&type=${encodeURIComponent(type)}&level=${encodeURIComponent(level || '')}&techstack=${encodeURIComponent(techstack.join(','))}`;
        }
        return `/dashboard/interview/${interviewId}`;
    };

    const getFeedbackLink = () => {
        if (context === 'community-mock-interview') {
            // For community mock interviews, we might want different feedback behavior
            // For now, keep the dashboard feedback link but this can be customized later
            return `/dashboard/interview/${interviewId}/feedback`;
        }
        return `/dashboard/interview/${interviewId}/feedback`;
    };

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

                        {/* Hide score for community cards */}
                        {!isCommunityCard && (
                            <div className="flex flex-row gap-2 items-center">
                                <Image src="/star.svg" width={22} height={22} alt="star" />
                                <p>
                                    {feedbackLoading 
                                        ? "..." 
                                        : feedback?.totalScore || "---"
                                    }/100
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Feedback or Placeholder Text */}
                    {!isCommunityCard && (
                        <p className="line-clamp-2 mt-5">
                            {feedbackLoading
                                ? "Loading feedback..."
                                : feedback?.finalAssessment ||
                                  "You haven't taken this interview yet. Take it now to improve your skills."}
                        </p>
                    )}
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

                    {/* For community cards, always show "Take Interview" button */}
                    {isCommunityCard ? (
                        <Button className="btn-primary">
                            <Link href={getInterviewLink()}>
                                Take Interview
                            </Link>
                        </Button>
                    ) : (
                        /* For regular cards, show feedback or take interview based on feedback status */
                        feedback ? (
                            <Button className="btn-primary">
                                <Link href={getFeedbackLink()}>
                                    Check Feedback
                                </Link>
                            </Button>
                        ) : (
                            <Button className="btn-primary">
                                <Link href={getInterviewLink()}>
                                    Take Interview
                                </Link>
                            </Button>
                        )
                    )}
                </div>
            </div>
        </div>
    );
};

export default InterviewCardClient;
