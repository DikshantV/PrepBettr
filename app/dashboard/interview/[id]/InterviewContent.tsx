"use client";

import { useState } from 'react';
import Agent from "@/components/Agent";
import { CodeEditorWrapper } from "@/components/CodeEditorWrapper";
import InterviewHeader from "./InterviewHeader";

interface Question {
    id: string;
    content: string;
    type: string;
    difficulty: string;
    techStack: string[];
}

interface InterviewContentProps {
    interview: {
        id: string;
        role: string;
        type: string;
        questions: Question[];
        techstack: string[];
        createdAt: string;
    };
    feedback: {
        id: string;
        overall: string;
        strengths: string[];
        areasForImprovement: string[];
    } | null;
    user: {
        id: string;
        name: string;
        email: string;
    };
}

export default function InterviewContent({ interview, user }: InterviewContentProps) {
    const [isEditorExpanded, setIsEditorExpanded] = useState(false);

    const toggleEditor = () => {
        setIsEditorExpanded(!isEditorExpanded);
    };

    return (
        <div className="space-y-6 p-6 max-w-7xl mx-auto w-full">
            {/* Header Section */}
            <div className="overflow-hidden">
                <InterviewHeader 
                    role={interview.role}
                    techstack={interview.techstack}
                    type={interview.type}
                    onToggleEditor={toggleEditor}
                />
            </div>
            
            {/* Main Content Section */}
            <div className="space-y-6">
                {/* Agent Section */}
                <div className="p-2">
                    <h3 className="text-lg font-semibold text-white mb-4">Interview Session</h3>
                    <div className="space-y-4">
                        <Agent 
                            interviewId={interview.id}
                            type={interview.type}
                            questions={interview.questions.map(q => q.content)}
                            userName={user.name}
                            userId={user.id}
                        />
                    </div>
                </div>
                
                {/* Code Editor Section */}
                {isEditorExpanded && (
                    <div className="p-2">
                        <h3 className="text-lg font-semibold text-white mb-4">Code Editor</h3>
                        <CodeEditorWrapper />
                    </div>
                )}
            </div>
        </div>
    );
}
