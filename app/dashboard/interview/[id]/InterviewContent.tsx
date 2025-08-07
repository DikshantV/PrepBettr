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
    const [sessionStarted, setSessionStarted] = useState(false);
    const [micPermissionGranted, setMicPermissionGranted] = useState(false);
    const [isRequestingPermission, setIsRequestingPermission] = useState(false);

    const toggleEditor = () => {
        setIsEditorExpanded(!isEditorExpanded);
    };

    const handleStartInterview = async () => {
        try {
            setIsRequestingPermission(true);
            
            // Request microphone permission first
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: false,
                    sampleRate: 16000,
                    channelCount: 1,
                }
            });
            
            // Stop the stream immediately as we only needed to check permission
            stream.getTracks().forEach(track => track.stop());
            
            setMicPermissionGranted(true);
            setSessionStarted(true);
            
        } catch (error) {
            console.error('Microphone permission denied:', error);
            alert('Microphone permission is required for the voice interview. Please allow microphone access and try again.');
        } finally {
            setIsRequestingPermission(false);
        }
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
                {/* Start Interview Button */}
                {!sessionStarted && (
                    <div className="flex justify-center p-4">
                        <button 
                            onClick={handleStartInterview} 
                            className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                        >
                            Start Interview
                        </button>
                    </div>
                )}

                {/* Agent Section */}
                {sessionStarted && (
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
                )}
                
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
