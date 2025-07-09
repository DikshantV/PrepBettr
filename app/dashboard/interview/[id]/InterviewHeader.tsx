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
        <div className="flex flex-col w-full mb-6">
            <div className="flex items-center gap-4 p-4">
                <div className="flex items-center gap-4 flex-1">
                    <Image
                        src={getRandomInterviewCover()}
                        alt="cover-image"
                        width={48}
                        height={48}
                        className="rounded-full object-cover border-2 border-primary/20"
                    />
                    <div className="border-l border-gray-600 h-10 mx-2"></div>
                    <div>
                        <h2 className="text-2xl font-bold capitalize text-white">{role} Interview</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <DisplayTechIcons techStack={techstack} />
                            <span className="text-sm text-gray-400">•</span>
                            <span className="text-sm text-gray-300">{type} Interview</span>
                        </div>
                    </div>
                </div>
                
                <button
                    onClick={onToggleEditor}
                    className="p-2.5 text-gray-400 hover:text-white hover:bg-dark-300 rounded-lg transition-colors border border-dark-300 hover:border-gray-600"
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
        </div>
    );
}
