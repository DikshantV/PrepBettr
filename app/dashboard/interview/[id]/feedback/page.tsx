"use client";

import dayjs from "dayjs";
import Link from "next/link";
import Image from "next/image";
import { redirect, useParams } from "next/navigation";
import { useInterview } from "@/lib/hooks/useFirestore";
import { useServerFeedback } from "@/lib/hooks/useServerFeedback";
import { Button } from "@/components/ui/button";
import { useLoading } from "@/contexts/LoadingContext";
import { useEffect } from "react";

const Feedback = () => {
    const params = useParams();
    const id = params?.id as string;
    const { feedback, loading: feedbackLoading, error: feedbackError } = useServerFeedback(id);
    const { interview, loading: interviewLoading, error: interviewError } = useInterview(id);

    if (!interviewLoading && !interview) redirect("/");

    // Show error message if feedback loading failed
    if (feedbackError) {
        return (
            <section className="section-feedback">
                <div className="flex flex-row justify-center">
                    <h1 className="text-4xl font-semibold text-white">
                        Error Loading Feedback
                    </h1>
                </div>
                <div className="feedback-content">
                    <p className="text-red-400 text-center">
                        {feedbackError}
                    </p>
                    <div className="buttons mt-8">
                        <Button asChild className="btn-secondary flex-1">
                            <Link href="/dashboard" className="flex w-full justify-center">
                                <p className="text-sm font-semibold text-primary-200 text-center">
                                    Back to dashboard
                                </p>
                            </Link>
                        </Button>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="section-feedback">
            <div className="flex flex-row justify-center">
                <h1 className="text-4xl font-semibold text-white">
                    Feedback on the Interview -{" "}
                    <span className="capitalize">{interview?.role || "Loading..."}</span> Interview
                </h1>
            </div>

            {!feedbackLoading ? (
                <div className="feedback-content">
                    <div className="flex flex-row justify-center ">
                        <div className="flex flex-row gap-5">
                            {/* Overall Impression */}
                            <div className="flex flex-row gap-2 items-center">
                                <Image src="/star.svg" width={22} height={22} alt="star" />
                                <p>
                                    Overall Impression:{" "}
                                    <span className="text-primary-200 font-bold">
                                        {feedback?.totalScore || "---"}
                                    </span>
                                    /100
                                </p>
                            </div>

                            {/* Date */}
                            <div className="flex flex-row gap-2">
                                <Image src="/calendar.svg" width={22} height={22} alt="calendar" />
                                <p>
                                    {feedback?.createdAt
                                        ? dayjs(feedback.createdAt).format("MMM D, YYYY h:mm A")
                                        : "N/A"}
                                </p>
                            </div>
                        </div>
                    </div>

                    <hr />

                    <p>{feedback?.finalAssessment || "No assessment available."}</p>

                    {/* Interview Breakdown */}
                    <div className="flex flex-col gap-4">
                        <h2 className="text-white">Breakdown of the Interview:</h2>
                        {feedback?.categoryScores?.map((category, index) => (
                            <div key={index}>
                                <p className="font-bold">
                                    {index + 1}. {category.name} ({category.score}/100)
                                </p>
                                <p>{category.comment}</p>
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-col gap-3">
                        <h3 className="text-white">Strengths</h3>
                        <ul>
                            {feedback?.strengths?.map((strength, index) => (
                                <li key={index}>{strength}</li>
                            ))}
                        </ul>
                    </div>

                    <div className="flex flex-col gap-3">
                        <h3 className="text-white">Areas for Improvement</h3>
                        <ul>
                            {feedback?.areasForImprovement?.map((area, index) => (
                                <li key={index}>{area}</li>
                            ))}
                        </ul>
                    </div>
                </div>
            ) : (
                null // Global loader handles this
            )}

            <div className="buttons">
                <Button asChild className="btn-secondary flex-1">
                    <Link href="/dashboard" className="flex w-full justify-center">
                        <p className="text-sm font-semibold text-primary-200 text-center">
                            Back to dashboard
                        </p>
                    </Link>
                </Button>

                <Button asChild className="btn-primary flex-1">
                    <Link
                        href={`/dashboard/interview/${id}`}
                        className="flex w-full justify-center"
                    >
                        <p className="text-sm font-semibold text-black text-center">
                            Retake Interview
                        </p>
                    </Link>
                </Button>
            </div>
        </section>
    );
};

export default Feedback;