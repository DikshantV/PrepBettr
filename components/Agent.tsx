"use client";

import Image from "next/image";
import { useReducer, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// Feature flag support for Azure AI Foundry voice system
import { useFeatureFlag } from "@/lib/hooks/useUnifiedConfig";
import FoundryVoiceAgent from "./FoundryVoiceAgent";

import { cn } from "@/lib/utils";
import { createFeedback } from "@/lib/actions/general.action";
import { logger } from "@/lib/utils/logger";
import { handleAsyncError, showErrorNotification } from "@/lib/utils/error-utils";
import {
  AgentState,
  InterviewState,
  AudioState, 
  agentReducer,
  initialAgentState,
  selectIsRecording,
  selectIsProcessing,
  selectIsSpeaking,
  selectIsWaiting,
  selectIsInterviewActive,
  selectIsInterviewFinished,
  selectShouldShowFeedback,
  createStartInterviewAction,
  createEndInterviewAction,
  createAddUserMessageAction,
  createAddAIMessageAction,
  createUserSpokeAction
} from "@/lib/voice/agent-state";
import {
  AUDIO_CONFIG,
  prepareAudioForUpload,
  createOptimizedAudioContext,
  resumeAudioContext,
  disposeAudioResources
} from "@/lib/voice/audio-utils";
import {
  InterviewContext,
  speechToText,
  startConversation,
  processAndPlayResponse,
  endConversation,
  playAIResponse,
  playDirectAudioWithFallback
} from "@/lib/voice/azure-adapters";
import { SavedMessage } from "@/lib/types/voice";

interface ExtractedResumeData {
    personalInfo?: {
        name?: string;
        email?: string;
        phone?: string;
        address?: string;
        linkedin?: string;
        github?: string;
        website?: string;
    };
    summary?: string;
    skills?: string[];
    experience?: any[];
    education?: any[];
    projects?: any[];
    certifications?: any[];
    languages?: any[];
}

interface AgentProps {
    userName: string;
    userId: string;
    interviewId?: string;
    feedbackId?: string;
    type: string;
    questions?: string[];
    profileImage?: string;
    resumeInfo?: ExtractedResumeData;
    resumeQuestions?: string[];
}

const Agent = ({
    userName,
    userId,
    interviewId,
    feedbackId,
    type,
    questions,
    resumeInfo,
    resumeQuestions,
}: AgentProps) => {
    // Check for Azure AI Foundry voice system feature flag
    const { enabled: useFoundryVoice, loading: flagLoading } = useFeatureFlag('voiceInterviewV2');
    
    // Show loading state while feature flag is being fetched
    if (flagLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-lg text-gray-600 dark:text-gray-300">
                    Loading interview system...
                </div>
            </div>
        );
    }
    
    // Use Azure AI Foundry voice system if feature flag is enabled
    if (useFoundryVoice) {
        console.log('🚀 [Agent] Using Azure AI Foundry voice system');
        return (
            <FoundryVoiceAgent
                userName={userName}
                userId={userId}
                interviewId={interviewId}
                feedbackId={feedbackId}
                type={type}
                questions={questions}
                resumeInfo={resumeInfo}
                resumeQuestions={resumeQuestions}
            />
        );
    }
    
    // Fall back to legacy Speech SDK + OpenAI system
    console.log('📻 [Agent] Using legacy Speech SDK + OpenAI system');
    
    const router = useRouter();
    const [state, dispatch] = useReducer(agentReducer, initialAgentState);
    
    // Audio recording state
    const audioSamplesRef = useRef<Float32Array[]>([]);
    const isCurrentlyRecordingRef = useRef<boolean>(false);
    const recordingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const audioCleanupRef = useRef<(() => Promise<void>) | null>(null);
    
    // Voice activity detection state
    const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastVoiceActivityRef = useRef<number>(0);
    const SILENCE_DURATION_MS = 2000; // Stop recording after 2 seconds of silence

    // Derived selectors from state
    const isRecording = selectIsRecording(state);
    const isProcessing = selectIsProcessing(state);
    const isSpeaking = selectIsSpeaking(state);
    const isWaiting = selectIsWaiting(state);
    const isInterviewActive = selectIsInterviewActive(state);
    const isInterviewFinished = selectIsInterviewFinished(state);
    const shouldShowFeedback = selectShouldShowFeedback(state);

    // Load user profile image with fallbacks
    useEffect(() => {
        const loadUserProfileImage = async () => {
            try {
                // Use existing auth endpoint that returns user data
                const response = await fetch("/api/auth/user");
                if (response.ok) {
                    const userData = await response.json();
                    const user = userData?.user;
                    
                    if (user) {
                        // Try multiple sources for profile image
                        const profileImage = 
                            user.photoURL || // Firebase photoURL
                            user.image || // Custom image field
                            user.avatar || // Avatar field
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.name || userName)}&background=6366f1&color=fff&size=40`; // Generated avatar fallback
                        
                        if (profileImage) {
                            dispatch({ type: 'SET_USER_IMAGE', payload: profileImage });
                        }
                    }
                } else {
                    // Silently fall back to generated avatar if auth fails
                    const fallbackImage = `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=6366f1&color=fff&size=40`;
                    dispatch({ type: 'SET_USER_IMAGE', payload: fallbackImage });
                }
            } catch (error) {
                // Generate fallback avatar instead of logging error
                // This prevents console spam for a non-critical feature
                const fallbackImage = `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=6366f1&color=fff&size=40`;
                dispatch({ type: 'SET_USER_IMAGE', payload: fallbackImage });
            }
        };
        
        // Add timeout to prevent hanging requests
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Profile image request timeout')), 5000);
        });
        
        Promise.race([loadUserProfileImage(), timeoutPromise])
            .catch(() => {
                // Timeout fallback - use generated avatar
                const fallbackImage = `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=6366f1&color=fff&size=40`;
                dispatch({ type: 'SET_USER_IMAGE', payload: fallbackImage });
            });
    }, [userName]);
    
    // Handle tab visibility changes for audio context
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (!document.hidden && (window as any).audioContext) {
                handleAsyncError(
                    () => resumeAudioContext((window as any).audioContext),
                    'Failed to resume audio context on tab focus'
                );
            }
        };
        
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, []);

    const handleEndInterview = async (): Promise<void> => {
        try {
            logger.info('Ending interview', { totalMessages: state.messages.length, questionNumber: state.questionNumber });
            
            dispatch(createEndInterviewAction());
            
            // Generate summary if possible
            await handleAsyncError(
                async () => {
                    const summaryData = await endConversation();
                    if (summaryData.summary) {
                        logger.info('Interview summary generated', { summaryLength: summaryData.summary.length });
                    }
                },
                'Failed to generate interview summary'
            );
            
            // Clean up audio resources
            if (audioCleanupRef.current) {
                await audioCleanupRef.current();
                audioCleanupRef.current = null;
            }
            
            // Clean up global window functions
            delete (window as any).audioContext;
            delete (window as any).startAudioContextRecording;
            delete (window as any).stopAudioContextRecording;
            
            // Clear recording timeout if active
            if (recordingTimeoutRef.current) {
                clearTimeout(recordingTimeoutRef.current);
                recordingTimeoutRef.current = null;
            }
            
            logger.success('Interview ended successfully');
        } catch (error) {
            logger.error('Failed to end interview properly', error);
            dispatch(createEndInterviewAction()); // Force end on error
        }
    };

    // Auto-end interview when complete
    useEffect(() => {
        if (state.isInterviewComplete && isInterviewActive) {
            logger.success('Interview completed - auto-ending in 2 seconds');
            const timeoutId = setTimeout(() => {
                handleEndInterview();
            }, 2000);
            return () => clearTimeout(timeoutId);
        }
    }, [state.isInterviewComplete, isInterviewActive]);

    // Generate feedback when interview finishes
    useEffect(() => {
        if (isInterviewFinished && state.messages.length > 0 && interviewId && type !== "generate") {
            handleAsyncError(
                async () => {
                    const { success, feedbackId: id } = await createFeedback({
                        interviewId: interviewId!,
                        userId: userId!,
                        transcript: state.messages,
                        feedbackId,
                    });
                    
                    if (success && id) {
                        dispatch({ 
                            type: 'SET_FEEDBACK_GENERATED', 
                            payload: { generated: true, id } 
                        });
                        logger.success('Feedback generated successfully', { id });
                    }
                },
                'Failed to generate feedback'
            );
        }
        // No cleanup needed for this effect
    }, [isInterviewFinished, state.messages.length, interviewId, userId, type, feedbackId]);

    /**
     * Process audio recording and handle transcription
     */
    const processAudioRecording = async (audioChunks: Float32Array[], sampleRate: number): Promise<void> => {
        const { blob, hasValidAudio } = prepareAudioForUpload(audioChunks, sampleRate);
        
        if (!hasValidAudio) {
            logger.warn('No valid audio detected, resuming waiting state');
            dispatch({ type: 'RESET_TO_WAITING' });
            return;
        }

        try {
            // Convert to text
            const transcript = await speechToText(blob);
            
            if (!transcript?.trim()) {
                logger.warn('Empty transcript received');
                dispatch({ type: 'RESET_TO_WAITING' });
                return;
            }

            // Mark user as having spoken if first speech detected
            if (!state.hasUserSpoken) {
                dispatch(createUserSpokeAction());
            }

            // Process conversation with AI
            await handleConversationTurn(transcript);

        } catch (error) {
            logger.error('Audio processing failed', error);
            dispatch({ type: 'RESET_TO_WAITING' });
            showErrorNotification(error instanceof Error ? error : new Error('Audio processing failed'));
        }
    };

    /**
     * Handle conversation turn with Azure services
     */
    const handleConversationTurn = async (userTranscript: string): Promise<void> => {
        try {
            console.log('🎯 [AGENT] Starting conversation turn with transcript:', userTranscript.substring(0, 50) + '...');
            
            const response = await processAndPlayResponse(
                userTranscript,
                () => {
                    console.log('🎯 [AGENT] AI response started - dispatching START_SPEAKING');
                    dispatch({ type: 'START_SPEAKING' });
                },
                () => {
                    console.log('🎯 [AGENT] AI response completed - dispatching RESET_TO_WAITING');
                    dispatch({ type: 'RESET_TO_WAITING' });
                    
                    // Use response data after it's available
                    setTimeout(() => {
                        if (!response.isComplete && !state.isInterviewComplete && (window as any).startAudioContextRecording) {
                            logger.audio.record('Auto-starting recording after AI response');
                            setTimeout(() => {
                                if ((window as any).startAudioContextRecording) {
                                    console.log('🎯 [AGENT] Auto-starting recording after AI response');
                                    (window as any).startAudioContextRecording();
                                }
                            }, 500);
                        }
                    }, 100); // Small delay to ensure response is available
                },
                (error) => {
                    console.warn('🎯 [AGENT] Audio playback had issues:', error.message);
                    logger.warn('Audio playback had issues, continuing conversation', error);
                    dispatch({ type: 'RESET_TO_WAITING' });
                    
                    // Use response data after it's available  
                    setTimeout(() => {
                        if (!response.isComplete && !state.isInterviewComplete && (window as any).startAudioContextRecording) {
                            logger.audio.record('Continuing recording despite audio issues');
                            setTimeout(() => {
                                if ((window as any).startAudioContextRecording) {
                                    console.log('🎯 [AGENT] Continuing recording despite audio issues');
                                    (window as any).startAudioContextRecording();
                                }
                            }, 1000);
                        }
                    }, 100);
                }
            );

            console.log('🎯 [AGENT] Got response:', {
                questionNumber: response.questionNumber,
                isComplete: response.isComplete,
                userMessageLength: response.userMessage.content.length,
                aiMessageLength: response.aiMessage.content.length
            });

            const { userMessage, aiMessage, questionNumber, isComplete } = response;

            // Update state with messages and progress
            dispatch({ type: 'ADD_MESSAGES', payload: [userMessage, aiMessage] });
            
            if (questionNumber !== undefined) {
                dispatch({ type: 'SET_QUESTION_NUMBER', payload: questionNumber });
            }
            
            if (isComplete !== undefined) {
                dispatch({ type: 'SET_INTERVIEW_COMPLETE', payload: isComplete });
            }

        } catch (error) {
            console.error('🎯 [AGENT] Conversation processing failed:', error);
            logger.error('Conversation processing failed', error instanceof Error ? error : new Error('Conversation failed'));
            dispatch({ type: 'RESET_TO_WAITING' });
            showErrorNotification(error instanceof Error ? error : new Error('Conversation failed'));
        }
    };

    const handleStartInterview = async (): Promise<void> => {
        try {
            logger.info('Starting Azure-powered voice interview', { userName, type, interviewId });
            
            dispatch(createStartInterviewAction());

            // Setup optimized audio context
            const { context, source, workletNode, cleanup } = await createOptimizedAudioContext();
            
            // Store cleanup function
            audioCleanupRef.current = cleanup;
            (window as any).audioContext = context;
            
            dispatch({ type: 'SET_AUDIO_STREAM', payload: context.state as any }); // Store reference

            // Build interview context
            const interviewContext: InterviewContext = {
                userName,
                questions: resumeQuestions || questions,
                type,
                userId,
                interviewId,
                feedbackId,
                resumeInfo: resumeInfo ? {
                    hasResume: true,
                    candidateName: resumeInfo.personalInfo?.name || userName,
                    summary: resumeInfo.summary,
                    skills: resumeInfo.skills?.join(', ') || '',
                    experience: resumeInfo.experience?.map(exp => 
                        `${exp.position} at ${exp.company} (${exp.startDate} - ${exp.endDate || 'Present'})`
                    ).join(', ') || '',
                    education: resumeInfo.education?.map(edu => 
                        `${edu.degree} in ${edu.field} from ${edu.institution}`
                    ).join(', ') || '',
                    yearsOfExperience: resumeInfo.experience?.length || 0
                } : {
                    hasResume: false
                }
            };

            // Start conversation with Azure
            console.log('🎯 [AGENT DEBUG] About to start conversation...');
            const data = await startConversation(interviewContext);
            console.log('🎯 [AGENT DEBUG] Received conversation data:', {
                messageLength: data.message?.length,
                questionNumber: data.questionNumber,
                isComplete: data.isComplete,
                hasAudio: data.hasAudio
            });
            
            // Update state with initial AI message and progress
            console.log('🎯 [AGENT DEBUG] Adding AI message to state...');
            dispatch(createAddAIMessageAction(data.message));
            
            if (data.questionNumber !== undefined) {
                dispatch({ type: 'SET_QUESTION_NUMBER', payload: data.questionNumber });
            }
            
            if (data.isComplete !== undefined) {
                dispatch({ type: 'SET_INTERVIEW_COMPLETE', payload: data.isComplete });
            }

            // Setup audio recording handlers with voice activity detection
            workletNode.port.onmessage = (event) => {
                if (event.data.type === 'audiodata' && isCurrentlyRecordingRef.current) {
                    audioSamplesRef.current.push(new Float32Array(event.data.audioData));
                    logger.audio.record(`Audio chunk received (${event.data.audioData.length} samples)`);
                } else if (event.data.type === 'level') {
                    const rms = event.data.rms;
                    
                    if (isCurrentlyRecordingRef.current) {
                        if (rms > 0.01) {
                            // Voice detected - reset silence timeout
                            lastVoiceActivityRef.current = Date.now();
                            if (silenceTimeoutRef.current) {
                                clearTimeout(silenceTimeoutRef.current);
                                silenceTimeoutRef.current = null;
                            }
                            logger.audio.record(`Voice activity: RMS ${rms.toFixed(4)}`);
                        } else if (lastVoiceActivityRef.current > 0) {
                            // Check if we've been silent for too long
                            const silenceDuration = Date.now() - lastVoiceActivityRef.current;
                            
                            if (silenceDuration > SILENCE_DURATION_MS && !silenceTimeoutRef.current) {
                                logger.audio.record('Voice activity stopped - auto-stopping recording');
                                silenceTimeoutRef.current = setTimeout(() => {
                                    if (isCurrentlyRecordingRef.current && (window as any).stopAudioContextRecording) {
                                        logger.audio.record('Auto-stopping recording after silence');
                                        (window as any).stopAudioContextRecording();
                                    }
                                }, 100); // Small delay to ensure clean stop
                            }
                        }
                    }
                }
            };

            const startRecording = () => {
                if (isCurrentlyRecordingRef.current) return;
                
                logger.audio.record('Starting audio recording');
                audioSamplesRef.current = [];
                isCurrentlyRecordingRef.current = true;
                dispatch({ type: 'START_RECORDING' });

                recordingTimeoutRef.current = setTimeout(() => {
                    logger.warn('Recording timeout reached (8s)');
                    stopRecording();
                }, 30000); // Increased to 30 seconds for better user experience
            };

            const stopRecording = () => {
                if (!isCurrentlyRecordingRef.current) return;
                
                logger.audio.record('Stopping audio recording');
                isCurrentlyRecordingRef.current = false;
                dispatch({ type: 'STOP_RECORDING' });
                
                if (recordingTimeoutRef.current) {
                    clearTimeout(recordingTimeoutRef.current);
                    recordingTimeoutRef.current = null;
                }
                
                if (audioSamplesRef.current.length > 0) {
                    processAudioRecording(audioSamplesRef.current, context.sampleRate);
                }
            };

            // Store global functions for manual control
            (window as any).startAudioContextRecording = startRecording;
            (window as any).stopAudioContextRecording = stopRecording;

            // Play opening message and setup auto-recording
            await handleAsyncError(
                async () => {
                    if (data.hasAudio) {
                        await playDirectAudioWithFallback(
                            data.audioData!,
                            data.message,
                            () => dispatch({ type: 'START_SPEAKING' }),
                            () => {
                                dispatch({ type: 'RESET_TO_WAITING' });
                                // Auto-start recording for initial greeting
                                if (data.questionNumber === 0) {
                                    logger.audio.record('Auto-starting recording after greeting');
                                    startRecording();
                                }
                            }
                        );
                    } else {
                        await playAIResponse(
                            data.message,
                            () => dispatch({ type: 'START_SPEAKING' }),
                            () => {
                                dispatch({ type: 'RESET_TO_WAITING' });
                                // Auto-start recording after opening message (first question)
                                if ((data.questionNumber || 0) <= 1 && !data.isComplete) {
                                    logger.audio.record('Auto-starting recording after AI greeting');
                                    setTimeout(() => startRecording(), 1000); // Small delay
                                }
                            }
                        );
                    }
                },
                'Failed to play opening message'
            );
            
            logger.success('Voice interview started successfully');

        } catch (error) {
            logger.error('Failed to start interview', error);
            dispatch({ type: 'SET_INTERVIEW_STATE', payload: InterviewState.READY });
            showErrorNotification(error instanceof Error ? error : new Error('Failed to start interview'));
        }
    };


    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (audioCleanupRef.current) {
                audioCleanupRef.current();
            }
            if (recordingTimeoutRef.current) {
                clearTimeout(recordingTimeoutRef.current);
            }
        };
    }, []);

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
                        {isProcessing && <span className="animate-speak bg-blue-500" />}
                        {isRecording && <span className="animate-speak bg-red-500" />}
                    </div>
                    <h3>AI Interviewer</h3>
                </div>

                {/* User Profile Card */}
                <div className="card-border">
                    <div className="card-content">
                        <div className="relative w-[120px] h-[120px] rounded-full overflow-hidden">
                            {state.userImage ? (
                                <Image
                                    src={state.userImage}
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
                                <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-full">
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

            {state.messages.length > 0 && (
                <div className="transcript-border">
                    <div className="dark-gradient rounded-2xl min-h-12 px-5 py-3 flex flex-col border-l-4 border-blue-500">
                        <div className="transcript-header mb-3">
                            <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 text-left">Live Transcript</h4>
                        </div>
                        <div className="transcript-messages max-h-40 overflow-y-auto space-y-2">
                            {state.messages.map((message, index) => (
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

            {/* Simple Interview Controls */}
            <div className="w-full flex justify-center gap-4">
                {!isInterviewActive ? (
                    <>
                        <button className="relative btn-call" onClick={handleStartInterview}>
                            <span className="relative">
                                Start Interview
                            </span>
                        </button>
                        {shouldShowFeedback && (
                            <button 
                                className="btn-secondary" 
                                onClick={() => router.push(`/dashboard/interview/${interviewId}/feedback`)}
                            >
                                View Feedback
                            </button>
                        )}
                    </>
                ) : (
                    <>
                        <button className="btn-disconnect" onClick={handleEndInterview}>
                            End Interview
                        </button>
                        

                    </>
                )}
            </div>
        </>
    );
};

export default Agent;
