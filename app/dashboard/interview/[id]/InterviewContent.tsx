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
        <div className="space-y-1">
            <InterviewHeader 
                role={interview.role}
                techstack={interview.techstack}
                type={interview.type}
                onToggleEditor={toggleEditor}
            />
            
            <Agent 
                interviewId={interview.id}
                type={interview.type}
                questions={interview.questions.map(q => q.content)}
                userName={user.name}
                userId={user.id}
            />
            
            {isEditorExpanded && <CodeEditorWrapper />}
        </div>
    );
}
