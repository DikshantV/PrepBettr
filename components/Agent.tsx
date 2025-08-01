"use client";

import Image from "next/image";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { vapi } from "@/lib/vapi.sdk";
import { interviewer } from "@/constants";
import { createFeedback } from "@/lib/actions/general.action";

// Import VAPI types
import type { Message, FunctionCallMessage, GenerateAssistantVariables, InterviewWorkflowVariables } from "@/types/vapi";

enum CallStatus {
    INACTIVE = "INACTIVE",
    CONNECTING = "CONNECTING",
    ACTIVE = "ACTIVE",
    FINISHED = "FINISHED",
}

interface SavedMessage {
    role: "user" | "system" | "assistant";
    content: string;
}

interface AgentProps {
    userName: string;
    userId: string;
    interviewId?: string;
    feedbackId?: string;
    type: string;
    questions?: string[];
    profileImage?: string;
}

const Agent = ({
                   userName,
                   userId,
                   interviewId,
                   feedbackId,
                   type,
                   questions,
               }: AgentProps) => {
    const router = useRouter();
    const [callStatus, setCallStatus] = useState<CallStatus>(CallStatus.INACTIVE);
    const [messages, setMessages] = useState<SavedMessage[]>([]);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [lastMessage, setLastMessage] = useState<string>("");
    const [userImage, setUserImage] = useState<string>("");
    const [feedbackGenerated, setFeedbackGenerated] = useState(false);
    const [generatedFeedbackId, setGeneratedFeedbackId] = useState<string | null>(null);

    useEffect(() => {
        fetch("/api/profile/me")
            .then(async (res) => {
                if (res.ok) {
                    const data = await res.json();
                    if (data?.image) {
                        setUserImage(data.image);
                    }
                }
            })
            .catch(console.error);
    }, []);

    const handleFunctionCall = useCallback(async (message: FunctionCallMessage) => {
        // This function is now a placeholder as VAPI directly calls the webhook.
        // We can add client-side logic here if needed, but for now, we just log it.
        console.log('VAPI Function Call received on client:', message.functionCall);
    }, []);

    useEffect(() => {
        const onCallStart = () => {
            setCallStatus(CallStatus.ACTIVE);
        };

        const onCallEnd = () => {
            setCallStatus(CallStatus.FINISHED);
        };

        const onMessage = (message: Message) => {
            console.log('📨 VAPI Message received:', message);
            if (message.type === "transcript" && message.transcriptType === "final") {
                const newMessage = { role: message.role, content: message.transcript };
                console.log('📝 Adding transcript message:', newMessage);
                setMessages((prev) => [...prev, newMessage]);
            } else if (message.type === "function-call") {
                console.log('🔧 VAPI Function call received:', message);
                // Handle VAPI function calls for interview generation
                handleFunctionCall(message);
            } else {
                console.log('🔍 Other message type:', message.type, message);
            }
        };

        const onSpeechStart = () => {
            console.log("🎤 Speech start");
            setIsSpeaking(true);
        };

        const onSpeechEnd = () => {
            console.log("🎤 Speech end");
            setIsSpeaking(false);
        };

        const onError = (error: Error) => {
            console.error("❌ VAPI Error:", error);
            console.error("❌ Error details:", JSON.stringify(error, null, 2));
            setCallStatus(CallStatus.INACTIVE);
            alert(`VAPI Error: ${error.message}`);
        };

        vapi.on("call-start", onCallStart);
        vapi.on("call-end", onCallEnd);
        vapi.on("message", onMessage);
        vapi.on("speech-start", onSpeechStart);
        vapi.on("speech-end", onSpeechEnd);
        vapi.on("error", onError);

        return () => {
            vapi.off("call-start", onCallStart);
            vapi.off("call-end", onCallEnd);
            vapi.off("message", onMessage);
            vapi.off("speech-start", onSpeechStart);
            vapi.off("speech-end", onSpeechEnd);
            vapi.off("error", onError);
        };
    }, [handleFunctionCall]);

    useEffect(() => {
        if (messages.length > 0) {
            setLastMessage(messages[messages.length - 1].content);
        }

        const handleGenerateFeedback = async (messages: SavedMessage[]) => {
            console.log("handleGenerateFeedback");

            const { success, feedbackId: id } = await createFeedback({
                interviewId: interviewId!,
                userId: userId!,
                transcript: messages,
                feedbackId,
            });

            if (success && id) {
                setFeedbackGenerated(true);
                setGeneratedFeedbackId(id);
                console.log("Feedback generated successfully:", id);
            } else {
                console.log("Error saving feedback");
            }
        };

        if (callStatus === CallStatus.FINISHED) {
            if (type === "generate") {
                // For generate type, don't redirect anywhere - stay on current page
                console.log("Interview generation completed");
            } else if (interviewId && messages.length > 0) {
                // Only generate feedback if we have an interviewId and messages
                handleGenerateFeedback(messages);
            }
        }
    }, [messages, callStatus, feedbackId, interviewId, router, type, userId]);

    const handleCall = async () => {
        setCallStatus(CallStatus.CONNECTING);
        console.log('🚀 Starting VAPI call with type:', type);

        // VAPI Variable Contract: Extract first name for workflow placeholders
        // This value maps to {{firstName}} and {{candidateName}} in VAPI workflows
        const firstName = userName.split(' ')[0];

        if (type === "generate") {
            // Generate Interview Assistant
            // Uses VAPI Assistant for dynamic question generation and personalized greeting
            const assistantId = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;
            const assistantConfig = {
                variableValues: {
                    username: firstName, // → {{username}} placeholder in VAPI assistant (sends firstName as username)
                } as GenerateAssistantVariables,
                clientMessages: [],
                serverMessages: [],
            };
            
            console.log('🔧 VAPI Debug - Assistant ID:', assistantId);
            console.log('🔧 VAPI Debug - Config:', assistantConfig);
            console.log('🔧 VAPI Debug - firstName:', firstName);
            console.log('🔧 VAPI Debug - Type:', type);
            console.log('🔧 VAPI Debug - UserName:', userName);
            console.log('🔧 VAPI Debug - UserID:', userId);
            
            if (!assistantId) {
                console.error('❌ NEXT_PUBLIC_VAPI_ASSISTANT_ID is not set in environment variables');
                console.error('❌ Available env vars:', Object.keys(process.env).filter(key => key.includes('VAPI')));
                setCallStatus(CallStatus.INACTIVE);
                return;
            }
            
            try {
                console.log('🎯 Starting VAPI assistant with config:', {
                    assistantId,
                    variableValues: { username: firstName },
                    clientMessages: [],
                    serverMessages: []
                });
                
                const result = await vapi.start(assistantId, {
                    variableValues: {
                        username: firstName, // → {{username}} placeholder in VAPI assistant (sends firstName as username)
                    },
                    clientMessages: [],
                    serverMessages: [],
                });
                
                console.log('✅ VAPI start result:', result);
            } catch (error) {
                console.error('❌ Failed to start VAPI assistant:', error);
                console.error('❌ Error details:', JSON.stringify(error, null, 2));
                console.error('❌ Error message:', error.message);
                console.error('❌ Error stack:', error.stack);
                setCallStatus(CallStatus.INACTIVE);
                alert(`Failed to start interview: ${error.message}`);
                return;
            }
        } else {
            // Format questions for VAPI workflow consumption
            // Questions are formatted as bulleted list for voice assistant readability
            let formattedQuestions = "";
            if (questions) {
                formattedQuestions = questions
                    .map((question) => `- ${question}`)
                    .join("\n");
            }

            // Interview Workflow Variables
            // Maps to VAPI placeholders: {{questions}}, {{candidateName}}
            await vapi.start(interviewer, {
                variableValues: {
                    questions: formattedQuestions,  // → {{questions}} in VAPI workflow
                    candidateName: firstName,       // → {{candidateName}} in VAPI workflow greeting
                } as InterviewWorkflowVariables,
                clientMessages: [],
                serverMessages: [],
            });
        }
    };

const handleDisconnect = async () => {
    try {
        setCallStatus(CallStatus.FINISHED);
        vapi.stop();
        // Don't redirect - let user stay on interview page
    } catch (error) {
        console.error('Error ending call:', error);
        setCallStatus(CallStatus.FINISHED);
    }
};

    return (
        <>
            <div className="call-view">
                {/* AI Interviewer Card */}
                <div className="card-interviewer">
                    <div className="avatar">
                        <Image
                            src="/ai-avatar.png"
                            alt="profile-image"
                            width={65}
                            height={54}
                            className="object-cover"
                        />
                        {isSpeaking && <span className="animate-speak" />}
                    </div>
                    <h3>AI Interviewer</h3>
                </div>

                {/* User Profile Card */}
                <div className="card-border">
                    <div className="card-content">
                        <div className="relative w-[120px] h-[120px] rounded-full overflow-hidden">
                            {userImage ? (
                                <Image
                                    src={userImage}
                                    alt="profile-image"
                                    fill
                                    sizes="120px"
                                    className="object-cover"
                                    onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.onerror = null;
                                        target.src = "/user-avatar.png";
                                    }}
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800">
                                    <svg 
                                        className="w-12 h-12 text-gray-500" 
                                        aria-hidden="true" 
                                        xmlns="http://www.w3.org/2000/svg" 
                                        fill="none" 
                                        viewBox="0 0 24 24"
                                    >
                                        <path 
                                            stroke="currentColor" 
                                            strokeLinecap="round" 
                                            strokeLinejoin="round" 
                                            strokeWidth="2" 
                                            d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 0a8.949 8.949 0 0 0 4.951-1.488A3.987 3.987 0 0 0 13 16h-2a3.987 3.987 0 0 0-3.951 3.512A8.948 8.948 0 0 0 12 21Zm3-11a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                                        />
                                    </svg>
                                </div>
                            )}
                        </div>
                        <h3>{userName}</h3>
                    </div>
                </div>
            </div>

            {messages.length > 0 && (
                <div className="transcript-border">
                    <div className="transcript">
                        <div className="transcript-header">
                            <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">Live Transcript</h4>
                        </div>
                        <div className="transcript-messages max-h-40 overflow-y-auto space-y-2">
                            {messages.map((message, index) => (
                                <div 
                                    key={index}
                                    className={cn(
                                        "transcript-message p-2 rounded-lg",
                                        message.role === "assistant" 
                                            ? "bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-500" 
                                            : "bg-gray-50 dark:bg-gray-800/50 border-l-2 border-gray-400"
                                    )}
                                >
                                    <div className="flex items-start space-x-2">
                                        <span className={cn(
                                            "text-xs font-medium uppercase tracking-wide",
                                            message.role === "assistant" 
                                                ? "text-blue-600 dark:text-blue-400" 
                                                : "text-gray-600 dark:text-gray-400"
                                        )}>
                                            {message.role === "assistant" ? "AI" : "You"}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-800 dark:text-gray-200 mt-1">
                                        {message.content}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <div className="w-full flex justify-center gap-4">
                {callStatus !== "ACTIVE" ? (
                    <>
                        <button className="relative btn-call" onClick={() => handleCall()}>
                            <span
                                className={cn(
                                    "absolute animate-ping rounded-full opacity-75",
                                    callStatus !== "CONNECTING" && "hidden"
                                )}
                            />
                            <span className="relative">
                                {callStatus === "INACTIVE" || callStatus === "FINISHED"
                                    ? "Call"
                                    : ". . ."}
                            </span>
                        </button>
                        {feedbackGenerated && generatedFeedbackId && (
                            <button 
                                className="btn-secondary" 
                                onClick={() => router.push(`/dashboard/interview/${interviewId}/feedback`)}
                            >
                                View Feedback
                            </button>
                        )}
                    </>
                ) : (
                    <button className="btn-disconnect" onClick={() => handleDisconnect()}>
                        End
                    </button>
                )}
            </div>
        </>
    );
};

export default Agent;