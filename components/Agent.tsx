"use client";

import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { azureInterviewer } from "@/constants";
import { createFeedback } from "@/lib/actions/general.action";

enum InterviewState {
    READY = "READY",
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
    const [interviewState, setInterviewState] = useState<InterviewState>(InterviewState.READY);
    const [messages, setMessages] = useState<SavedMessage[]>([]);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [userImage, setUserImage] = useState<string>("");
    const [feedbackGenerated, setFeedbackGenerated] = useState(false);
    const [generatedFeedbackId, setGeneratedFeedbackId] = useState<string | null>(null);
    const [isProcessingAI, setIsProcessingAI] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
    const [isWaitingForUser, setIsWaitingForUser] = useState(false);
    const [hasUserSpoken, setHasUserSpoken] = useState(false);
    
    // Use useRef to persist audio nodes and prevent garbage collection
    const audioContextRef = useRef<AudioContext | null>(null);
    const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const workletNodeRef = useRef<AudioWorkletNode | null>(null);
    const audioStreamRef = useRef<MediaStream | null>(null);
    const recordingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const audioSamplesRef = useRef<Float32Array[]>([]);
    const isCurrentlyRecordingRef = useRef<boolean>(false);
    const hasDetectedNonSilenceRef = useRef<boolean>(false);
    const ringBufferRef = useRef<Float32Array[]>([]);

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
    
    // Add visibility change listener to handle tab switches
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (!document.hidden && audioContextRef.current) {
                // Resume AudioContext when tab becomes visible
                if (audioContextRef.current.state === 'suspended') {
                    audioContextRef.current.resume().then(() => {
                        console.log('✅ AudioContext resumed after tab became visible');
                    }).catch(error => {
                        console.error('❌ Failed to resume AudioContext:', error);
                    });
                }
            }
        };
        
        document.addEventListener('visibilitychange', handleVisibilityChange);
        
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    /**
     * Get the best supported MIME type for MediaRecorder
     */
    const getSupportedMimeType = (): string | null => {
        const preferredTypes = [
            'audio/webm;codecs=pcm',     // Best: PCM in WebM container
            'audio/wav',                 // Good: WAV format
            'audio/webm;codecs=opus',    // Fallback: Opus in WebM (needs transcoding)
            'audio/webm',                // Fallback: Default WebM
            'audio/ogg;codecs=opus',     // Fallback: Opus in OGG (needs transcoding)
            'audio/ogg',                 // Fallback: Default OGG
        ];
        
        for (const mimeType of preferredTypes) {
            if (MediaRecorder.isTypeSupported(mimeType)) {
                console.log('✅ Selected MIME type:', mimeType);
                return mimeType;
            }
        }
        
        console.warn('⚠️ No preferred MIME types supported, using default');
        return null;
    };

    /**
     * Maintain a ring-buffer of raw Float32 PCM chunks
     */
    let ringBuffer: Float32Array[] = [];
    const ringBufferSize = 32; // Capacity to hold multiple chunks
    let hasDetectedNonSilence = false;

    const trimInitialSilence = (audioChunks: Float32Array[], sampleRate: number): Float32Array[] => {
        const thresholdRMS = 0.01; // -40 dB ≈ 0.01 linear
        const windowSamples = Math.floor(sampleRate * 0.2); // 200ms window
        
        // Concatenate all chunks for analysis
        const totalLength = audioChunks.reduce((acc, chunk) => acc + chunk.length, 0);
        const combinedAudio = new Float32Array(totalLength);
        let offset = 0;
        for (const chunk of audioChunks) {
            combinedAudio.set(chunk, offset);
            offset += chunk.length;
        }
        
        let startIndex = 0;
        for (let i = 0; i <= combinedAudio.length - windowSamples; i += windowSamples / 4) { // 25% overlap
            let windowRMS = 0;
            for (let j = 0; j < windowSamples && (i + j) < combinedAudio.length; j++) {
                windowRMS += combinedAudio[i + j] * combinedAudio[i + j];
            }
            windowRMS = Math.sqrt(windowRMS / windowSamples);

            if (windowRMS > thresholdRMS) {
                startIndex = i;
                console.log(`🎤 Non-silence detected at sample ${startIndex}, RMS: ${windowRMS.toFixed(4)}`);
                
                // Set hasUserSpoken flag when non-silence is detected
                if (!hasUserSpoken) {
                    setHasUserSpoken(true);
                    hasDetectedNonSilence = true;
                    console.log('🎙️ First user speech detected - microphone will stop after AI response');
                }
                break;
            }
        }

        console.log(`Silence trimmed. Starting at sample: ${startIndex} of ${combinedAudio.length}`);
        const trimmedAudio = combinedAudio.slice(startIndex);
        
        // Split back into chunks for consistent processing
        const chunkSize = 4096;
        const trimmedChunks: Float32Array[] = [];
        for (let i = 0; i < trimmedAudio.length; i += chunkSize) {
            const chunk = trimmedAudio.slice(i, i + chunkSize);
            trimmedChunks.push(chunk);
        }
        
        return trimmedChunks;
    };

    /**
     * Convert Float32Array chunks to WAV blob
     */
    const convertToWav = (audioChunks: Float32Array[], sampleRate: number): Blob => {
        const totalLength = audioChunks.reduce((acc, chunk) => acc + chunk.length, 0);
        const combinedAudio = new Float32Array(totalLength);
        let offset = 0;
        for (const chunk of audioChunks) {
            combinedAudio.set(chunk, offset);
            offset += chunk.length;
        }

        // Convert float samples to 16-bit PCM
        const pcmData = new Int16Array(combinedAudio.length);
        for (let i = 0; i < combinedAudio.length; i++) {
            const sample = Math.max(-1, Math.min(1, combinedAudio[i]));
            pcmData[i] = sample * 32767;
        }

        // Create WAV header
        const wavHeader = new ArrayBuffer(44);
        const view = new DataView(wavHeader);

        const writeString = (offset: number, string: string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        writeString(0, 'RIFF');
        view.setUint32(4, 36 + pcmData.length * 2, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeString(36, 'data');
        view.setUint32(40, pcmData.length * 2, true);

        return new Blob([wavHeader, pcmData], { type: 'audio/wav' });
    };

    /**
     * Send audio to backend for speech-to-text processing
     */
    const sendAudioToBackend = async (audioBlob: Blob): Promise<void> => {
        try {
            const formData = new FormData();
            formData.append('audio', audioBlob, 'recording.wav');

            console.log('📤 Uploading audio to speech-to-text service...');
            
            // Retry logic with exponential backoff
            let attempt = 0;
            const maxAttempts = 3;
            let result;

            while (attempt < maxAttempts) {
                try {
                    const response = await fetch('/api/voice/stream', {
                        method: 'POST',
                        body: formData,
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }

                    result = await response.json();
                    console.log('📥 Speech-to-text result:', result);
                    break;
                } catch (error) {
                    attempt++;
                    console.error(`❌ Attempt ${attempt} failed:`, error);
                    
                    if (attempt < maxAttempts) {
                        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
                        console.log(`⏳ Retrying in ${delay}ms...`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    } else {
                        throw error;
                    }
                }
            }

            // Hard failure if text is undefined to prevent silent drops
            if (result.text === undefined) {
                throw new Error('Speech-to-text response missing text field - preventing silent drop');
            }

            const transcript = result.text;
            if (!transcript || transcript.trim().length === 0) {
                console.log('⚠️ Empty transcript received');
                setIsWaitingForUser(true);
                return;
            }

            console.log('✅ Transcript received:', transcript);

            // Add user message to conversation
            const userMessage: SavedMessage = { role: "user", content: transcript };
            setMessages(prev => [...prev, userMessage]);

            // Process with AI
            setIsProcessingAI(true);
            await processWithAI([...messages, userMessage]);

        } catch (error) {
            console.error('❌ Error sending audio to backend:', error);
            setIsWaitingForUser(true);
            alert(`Error processing audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    /**
     * Process conversation with Azure OpenAI and get response
     */
    const processWithAI = async (conversationHistory: SavedMessage[]): Promise<void> => {
        try {
            const response = await fetch('/api/voice/conversation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages: conversationHistory,
                    userName,
                    questions,
                    type,
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('🤖 AI response received:', data);

            const aiMessage: SavedMessage = { role: "assistant", content: data.response };
            setMessages(prev => [...prev, aiMessage]);

            // Convert AI response to speech and play it
            await playAIResponse(data.response);

        } catch (error) {
            console.error('❌ Error processing with AI:', error);
            setIsProcessingAI(false);
            setIsWaitingForUser(true);
        }
    };

    /**
     * Convert text to speech using Azure Speech Services and play it
     */
    const playAIResponse = async (text: string): Promise<void> => {
        try {
            setIsSpeaking(true);
            
            const response = await fetch('/api/voice/tts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text }),
            });

            if (!response.ok) {
                throw new Error(`TTS failed: ${response.statusText}`);
            }

            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);

            audio.onended = () => {
                console.log('🔊 AI response playback completed');
                setIsSpeaking(false);
                setIsProcessingAI(false);
                setIsWaitingForUser(true);
                
                // Clean up the object URL
                URL.revokeObjectURL(audioUrl);
            };

            audio.onerror = (error) => {
                console.error('❌ Audio playback error:', error);
                setIsSpeaking(false);
                setIsProcessingAI(false);
                setIsWaitingForUser(true);
                URL.revokeObjectURL(audioUrl);
            };

            await audio.play();
            
        } catch (error) {
            console.error('❌ Error playing AI response:', error);
            setIsSpeaking(false);
            setIsProcessingAI(false);
            setIsWaitingForUser(true);
        }
    };

    const startInterview = async () => {
        try {
            setInterviewState(InterviewState.ACTIVE);
            console.log('🎙️ Starting Azure-powered voice interview...');

            // Request microphone permission
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: false,
                    sampleRate: 16000,
                    channelCount: 1,
                }
            });

            audioStreamRef.current = stream;
            setAudioStream(stream);

            // Create AudioContext for recording
            const context = new (window.AudioContext || (window as any).webkitAudioContext)({
                sampleRate: 16000
            });
            audioContextRef.current = context;

            // Load the audio processor worklet
            await context.audioWorklet.addModule('/audio-processor.js');

            const micSource = context.createMediaStreamSource(stream);
            const workletNode = new AudioWorkletNode(context, 'audio-processor');
            
            micSourceRef.current = micSource;
            workletNodeRef.current = workletNode;

            micSource.connect(workletNode);

            let recordingTimeoutId: NodeJS.Timeout | null = null;

            // Handle audio data from worklet
            workletNode.port.onmessage = (event) => {
                if (event.data.type === 'audio') {
                    const audioData = event.data.audioData as Float32Array;
                    
                    if (isCurrentlyRecordingRef.current) {
                        audioSamplesRef.current.push(new Float32Array(audioData));
                    }
                }
            };

            const startAudioContextRecording = () => {
                console.log('🎤 Starting recording...');
                audioSamplesRef.current = [];
                isCurrentlyRecordingRef.current = true;
                setIsRecording(true);
                setIsWaitingForUser(false);

                // Set a timeout to stop recording after 30 seconds
                recordingTimeoutId = setTimeout(() => {
                    console.log('⏱️ Recording timeout reached');
                    stopAudioContextRecording();
                }, 30000);
            };

            const stopAudioContextRecording = () => {
                if (!isCurrentlyRecordingRef.current) {
                    console.log('⚠️ Recording already stopped');
                    return;
                }

                console.log('⏹️ Stopping recording...');
                isCurrentlyRecordingRef.current = false;
                setIsRecording(false);

                if (recordingTimeoutId) {
                    clearTimeout(recordingTimeoutId);
                    recordingTimeoutId = null;
                }

                if (audioSamplesRef.current.length > 0) {
                    console.log(`📊 Processing ${audioSamplesRef.current.length} audio chunks`);
                    
                    // Trim silence and convert to WAV
                    const trimmedChunks = trimInitialSilence(audioSamplesRef.current, context.sampleRate);
                    const audioBlob = convertToWav(trimmedChunks, context.sampleRate);
                    
                    // Send to backend for processing
                    sendAudioToBackend(audioBlob);
                } else {
                    console.log('⚠️ No audio data recorded');
                    setIsWaitingForUser(true);
                }
            };

            const cleanup = async () => {
                console.log('🧹 Cleaning up audio resources...');
                if (recordingTimeoutId) {
                    clearTimeout(recordingTimeoutId);
                    recordingTimeoutId = null;
                }
                micSource?.disconnect();
                if (workletNode) {
                    workletNode.port.onmessage = null;
                }
                // Guard AudioContext.close() calls
                if (context && context.state !== 'closed') {
                    await context.close();
                }
                stream.getTracks().forEach(track => track.stop());
                setAudioStream(null);
            };
            
            // Store functions for later cleanup
            (window as any).audioRecorderCleanup = cleanup;
            (window as any).startAudioContextRecording = startAudioContextRecording;
            (window as any).stopAudioContextRecording = stopAudioContextRecording;
            
            // Start with AI introduction
            const introMessage = azureInterviewer.first_message.replace('{{candidateName}}', userName);
            await playAIResponse(introMessage);
            
            console.log('✅ Voice interview started successfully');

        } catch (error) {
            console.error('❌ Error during voice interview start:', error);
            setInterviewState(InterviewState.READY);
            alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    const endInterview = async () => {
        try {
            setInterviewState(InterviewState.FINISHED);
            
            // Handle AudioContext cleanup
            if ((window as any).audioRecorderCleanup) {
                (window as any).audioRecorderCleanup();
                delete (window as any).audioRecorderCleanup;
                delete (window as any).startAudioContextRecording;
                delete (window as any).stopAudioContextRecording;
            }
            
            // Stop the audio stream if it exists
            if (audioStream) {
                audioStream.getTracks().forEach(track => track.stop());
                setAudioStream(null);
            }
            
            // Clean up AudioContext with guard
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                await audioContextRef.current.close();
                audioContextRef.current = null;
            }
            
            setIsRecording(false);
            setIsWaitingForUser(false);
            setHasUserSpoken(false);

            console.log('✅ Voice interview ended');
        } catch (error) {
            console.error('Error ending interview:', error);
            setInterviewState(InterviewState.FINISHED);
        }
    };

    useEffect(() => {

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

        if (interviewState === InterviewState.FINISHED) {
            if (type === "generate") {
                // For generate type, don't redirect anywhere - stay on current page
                console.log("Interview generation completed");
            } else if (interviewId && messages.length > 0) {
                // Only generate feedback if we have an interviewId and messages
                handleGenerateFeedback(messages);
            }
        }
    }, [messages, interviewState, feedbackId, interviewId, router, type, userId]);

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
                    {isProcessingAI && (
                        <div className="mt-2">
                            <span className="text-xs text-blue-600 dark:text-blue-400">Processing...</span>
                        </div>
                    )}
                    {isWaitingForUser && (
                        <div className="mt-2">
                            <span className="text-xs text-green-600 dark:text-green-400 animate-pulse">
                                {hasUserSpoken ? '🎤 Listening...' : '🎙️ Microphone open - speak anytime'}
                            </span>
                        </div>
                    )}
                    {isRecording && !isWaitingForUser && (
                        <div className="mt-2">
                            <span className="text-xs text-red-600 dark:text-red-400 animate-pulse">🔴 Recording...</span>
                        </div>
                    )}
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
                {interviewState !== InterviewState.ACTIVE ? (
                    <>
                        <button className="relative btn-call" onClick={() => startInterview()}>
                            <span className="relative">
                                Start Interview
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
                    <>
                        <button className="btn-disconnect" onClick={() => endInterview()}>
                            End Interview
                        </button>
                        {/* Debug button to manually stop recording */}
                        {isRecording && (
                            <button 
                                className="btn-secondary" 
                                onClick={() => {
                                    console.log('🔧 Manual recording stop triggered');
                                    if ((window as any).stopAudioContextRecording) {
                                        (window as any).stopAudioContextRecording();
                                    }
                                }}
                            >
                                Stop & Process Audio
                            </button>
                        )}
                    </>
                )}
            </div>
        </>
    );
};

export default Agent;
