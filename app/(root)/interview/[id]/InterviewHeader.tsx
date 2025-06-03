"use client";

import Image from "next/image";
import { getRandomInterviewCover } from "@/lib/utils";
import DisplayTechIcons from "@/components/DisplayTechIcons";

interface InterviewHeaderProps {
    role: string;
    techstack: string[];
    type: string;
    onToggleEditor: () => void;
}

export default function InterviewHeader({ 
    role, 
    techstack, 
    type, 
    onToggleEditor 
}: InterviewHeaderProps) {
    return (
        <div className="flex items-center gap-4 pb-4">
            <Image
                src={getRandomInterviewCover()}
                alt="cover-image"
                width={40}
                height={40}
                className="rounded-full object-cover size-[40px]"
            />
            <h3 className="capitalize text-xl font-semibold">{role} Interview</h3>
            <div className="h-6 w-px bg-gray-300 mx-2"></div>
            <DisplayTechIcons techStack={techstack} />
            <p className="bg-dark-200 px-4 py-2 rounded-lg h-fit">
                {type}
            </p>
            <div className="flex-1"></div>
            <button
                onClick={onToggleEditor}
                className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="Toggle code editor"
                title="Toggle code editor"
            >
                <svg 
                    className="w-6 h-6" 
                    aria-hidden="true" 
                    xmlns="http://www.w3.org/2000/svg" 
                    width="24" 
                    height="24" 
                    fill="none" 
                    viewBox="0 0 24 24"
                >
                    <path 
                        stroke="currentColor" 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth="2" 
                        d="m8 8-4 4 4 4m8 0 4-4-4-4m-2-3-4 14"
                    />
                </svg>
            </button>
        </div>
    );
}
