"use client";

import Image from "next/image";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { vocode } from "@/lib/vocode.sdk";
import { vocodeOpenSource } from "@/lib/vocode-opensource";
// import { vapi } from "@/lib/vapi.sdk"; // Commented out for Vocode testing
import { vocodeInterviewer } from "@/constants";
import { createFeedback } from "@/lib/actions/general.action";

// Import Vocode types
import type { Message, FunctionCallMessage, GenerateAssistantVariables, InterviewWorkflowVariables } from "@/types/vocode";

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
        // This function is now a placeholder as Vocode directly calls the webhook.
        // We can add client-side logic here if needed, but for now, we just log it.
        console.log('Vocode Function Call received on client:', message.functionCall);
    }, []);

    useEffect(() => {
        const onCallStart = () => {
            setCallStatus(CallStatus.ACTIVE);
        };

        const onCallEnd = () => {
            setCallStatus(CallStatus.FINISHED);
        };

        const onMessage = (message: Message) => {
            console.log('📨 Vocode Message received:', message);
            if (message.type === "transcript" && message.transcriptType === "final") {
                const newMessage = { role: message.role, content: message.transcript };
                console.log('📝 Adding transcript message:', newMessage);
                setMessages((prev) => [...prev, newMessage]);
            } else if (message.type === "function-call") {
                console.log('🔧 Vocode Function call received:', message);
                // Handle Vocode function calls for interview generation
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
            console.error("❌ Vocode Error:", error);
            console.error("❌ Error details:", JSON.stringify(error, null, 2));
            setCallStatus(CallStatus.INACTIVE);
            alert(`Vocode Error: ${error.message}`);
        };

    // Use Vocode and select between hosted or open source
    const hasVocodeHostedKeys = process.env.NEXT_PUBLIC_VOCODE_API_KEY && process.env.NEXT_PUBLIC_VOCODE_ASSISTANT_ID;
    const activeSDK = hasVocodeHostedKeys ? vocode : vocodeOpenSource;

    activeSDK.on("call-start", onCallStart);
    activeSDK.on("call-end", onCallEnd);
    activeSDK.on("message", onMessage);
    activeSDK.on("speech-start", onSpeechStart);
    activeSDK.on("speech-end", onSpeechEnd);
    activeSDK.on("error", onError);

        return () => {
            // Clean up event listeners based on which SDK is active
            if (activeSDK === vocodeOpenSource) {
                activeSDK.off("call-start", onCallStart);
                activeSDK.off("call-end", onCallEnd);
                activeSDK.off("message", onMessage);
                activeSDK.off("speech-start", onSpeechStart);
                activeSDK.off("speech-end", onSpeechEnd);
                activeSDK.off("error", onError);
            } else {
                activeSDK.off("conversation-start", onCallStart);
                activeSDK.off("conversation-end", onCallEnd);
                activeSDK.off("message", onMessage);
                activeSDK.off("speech-start", onSpeechStart);
                activeSDK.off("speech-end", onSpeechEnd);
                activeSDK.off("error", onError);
            }
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
        console.log('🚀 Starting call with type:', type);

        // Get the active SDK based on configuration
        const voiceProvider = process.env.NEXT_PUBLIC_VOICE_PROVIDER;
        const hasVocodeHostedKeys = process.env.NEXT_PUBLIC_VOCODE_API_KEY && process.env.NEXT_PUBLIC_VOCODE_ASSISTANT_ID;
        
        let activeSDK;
        if (hasVocodeHostedKeys) {
            activeSDK = vocode; // Use hosted Vocode service
        } else {
            activeSDK = vocodeOpenSource; // Use open source implementation
        }

        // Extract first name for workflow placeholders
        const firstName = userName.split(' ')[0];

        try {
            if (type === "generate") {
                // Generate Interview Assistant
                if (activeSDK === vocodeOpenSource) {
                    // Use open source Vocode with interviewer config for generation
                    await activeSDK.start(vocodeInterviewer, {
                        variableValues: {
                            username: firstName,
                            candidateName: firstName
                        },
                        clientMessages: [],
                        serverMessages: [],
                    });
                } else {
                    // Use hosted Vocode assistant
                    const assistantId = process.env.NEXT_PUBLIC_VOCODE_ASSISTANT_ID;
                    if (!assistantId) {
                        console.error('❌ NEXT_PUBLIC_VOCODE_ASSISTANT_ID is not set');
                        setCallStatus(CallStatus.INACTIVE);
                        return;
                    }
                    
                    await activeSDK.start(assistantId, {
                        variableValues: {
                            username: firstName,
                        } as GenerateAssistantVariables,
                        clientMessages: [],
                        serverMessages: [],
                    });
                }
            } else {
                // Regular Interview
                let formattedQuestions = "";
                if (questions) {
                    formattedQuestions = questions
                        .map((question) => `- ${question}`)
                        .join("\n");
                }

                if (activeSDK === vocodeOpenSource) {
                    // Open source Vocode
                    await activeSDK.start(vocodeInterviewer, {
                        variableValues: {
                            questions: formattedQuestions,
                            candidateName: firstName,
                        },
                        clientMessages: [],
                        serverMessages: [],
                    });
                } else {
                    // Hosted Vocode or VAPI
                    await activeSDK.start(vocodeInterviewer, {
                        variableValues: {
                            questions: formattedQuestions,
                            candidateName: firstName,
                        } as InterviewWorkflowVariables,
                        clientMessages: [],
                        serverMessages: [],
                    });
                }
            }
            
            console.log('✅ Call started successfully');
        } catch (error) {
            console.error('❌ Failed to start call:', error);
            setCallStatus(CallStatus.INACTIVE);
            alert(`Failed to start interview: ${error.message}`);
        }
    };

const handleDisconnect = async () => {
    try {
        setCallStatus(CallStatus.FINISHED);
        
        // Get the active SDK and stop it
        const voiceProvider = process.env.NEXT_PUBLIC_VOICE_PROVIDER;
        const hasVocodeHostedKeys = process.env.NEXT_PUBLIC_VOCODE_API_KEY && process.env.NEXT_PUBLIC_VOCODE_ASSISTANT_ID;
        
        let activeSDK;
        if (hasVocodeHostedKeys) {
            activeSDK = vocode;
        } else {
            activeSDK = vocodeOpenSource;
        }
        
        await activeSDK.stop();
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
                    <div className="dark-gradient rounded-2xl min-h-12 px-5 py-3 flex flex-col border-l-4 border-blue-500">
                        <div className="transcript-header mb-3">
                            <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 text-left">Live Transcript</h4>
                        </div>
                        <div className="transcript-messages max-h-40 overflow-y-auto space-y-2">
                            {messages.map((message, index) => (
                                <div 
                                    key={index}
                                    className={cn(
                                        "transcript-message p-2 rounded-lg",
                                        message.role === "assistant" 
                                            ? "bg-blue-50 dark:bg-blue-900/20" 
                                            : "bg-gray-50 dark:bg-gray-800/50"
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