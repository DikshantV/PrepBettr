"use client";

import Image from "next/image";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { vocode } from "@/lib/vocode.sdk";
import { vocodeOpenSource } from "@/lib/vocode-opensource";
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
    const [isProcessingAI, setIsProcessingAI] = useState(false);
    const [questionNumber, setQuestionNumber] = useState(0);
    const [interviewComplete, setInterviewComplete] = useState(false);
    const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
    const [audioWorkletNode, setAudioWorkletNode] = useState<AudioWorkletNode | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
    const [isWaitingForUser, setIsWaitingForUser] = useState(false);
    const [useMediaRecorderFallback, setUseMediaRecorderFallback] = useState(false);

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
     * Create MediaRecorder with optimal settings
     */
    const createMediaRecorder = (stream: MediaStream): { recorder: MediaRecorder; mimeType: string } => {
        const mimeType = getSupportedMimeType();
        let recorder: MediaRecorder;
        
        if (mimeType) {
            recorder = new MediaRecorder(stream, { mimeType });
        } else {
            recorder = new MediaRecorder(stream);
        }
        
        return { recorder, mimeType: mimeType || 'audio/webm' };
    };

    const sendAudioToBackend = async (audioBlob: Blob) => {
        console.log('Uploading audio to the backend', audioBlob);    
        console.log('Audio Blob size:', audioBlob.size);    
        console.log('Audio Blob type:', audioBlob.type);
        const formData = new FormData();
        formData.append('audio', audioBlob, 'audio.wav');

        try {
            setIsProcessingAI(true);
            const response = await fetch('/api/voice/stream', {
                method: 'POST',
                body: formData
            });

            console.log('Backend response status:', response.status);
            console.log('Backend response headers:', Object.fromEntries(response.headers.entries()));
            
            let result;
            try {
                result = await response.json();
                console.log('Backend response data:', JSON.stringify(result, null, 2));
            } catch (parseError) {
                console.error('Failed to parse JSON response:', parseError);
                const responseClone = response.clone();
                const rawText = await responseClone.text();
                console.log('Raw response text:', rawText);
                throw new Error('Invalid JSON response from server');
            }

            if (result.success) {
                console.log('✅ Speech recognition successful:', result.text);
                setMessages((prev) => [...prev, { role: 'user', content: result.text }]);
                
                // Process the user transcript with the conversation API
                const processResult = await fetch('/api/voice/conversation', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'process', userTranscript: result.text })
                });

                const processResponse = await processResult.json();

                if (processResponse.success) {
                    setMessages((prev) => [...prev, { role: 'assistant', content: processResponse.message }]);
                    setQuestionNumber(processResponse.questionNumber);
                    setInterviewComplete(processResponse.isComplete);

                    // Play the AI response audio and wait for completion
                    if (processResponse.hasAudio && processResponse.audioData) {
                        const audioBlob = new Blob([new Uint8Array(processResponse.audioData)], { type: 'audio/wav' });
                        const audioUrl = URL.createObjectURL(audioBlob);
                        const audio = new Audio(audioUrl);
                        
                        // Set flag to indicate AI is speaking
                        setIsSpeaking(true);
                        
                        audio.onended = () => {
                            console.log('✅ AI audio playback finished');
                            setIsSpeaking(false);
                            setIsWaitingForUser(true);
                            
                            // Wait a brief moment for user to start speaking, then start recording
                            setTimeout(() => {
                                if (isWaitingForUser && callStatus === CallStatus.ACTIVE) {
                                    console.log('🎙️ Ready for user input - starting recording');
                                    setIsWaitingForUser(false);
                                    // Start AudioContext recording
                                    startAudioContextRecording();
                                }
                            }, 500);
                        };
                        
                        audio.onerror = () => {
                            console.error('❌ Error playing AI audio');
                            setIsSpeaking(false);
                        };
                        
                        audio.play().catch(error => {
                            console.error('❌ Failed to play AI audio:', error);
                            setIsSpeaking(false);
                        });
                    }
                } else {
                    console.error('Failed to process user response:', processResponse.error);
                }
            } else {
                console.error('❌ Speech recognition failed:', {
                    success: result.success,
                    error: result.error,
                    reason: result.reason,
                    errorDetails: result.errorDetails,
                    fullResult: result
                });
            }
        } catch (error) {
            console.error('Error sending audio to backend:', error);
        } finally {
            setIsProcessingAI(false);
        }
    };

    const handleCall = async () => {
        setCallStatus(CallStatus.CONNECTING);
        console.log('🚀 Starting voice interview with type:', type);

        if (!navigator.mediaDevices || !window.AudioContext) { 
            console.error('Media devices API or AudioContext not supported');
            setCallStatus(CallStatus.INACTIVE);
            alert('Your browser does not support audio recording.');
            return;
        }

        try {
            // Start the conversation first
            const startResult = await fetch('/api/voice/conversation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'start', 
                    interviewContext: { 
                        type: type === 'technical' ? 'technical' : type === 'behavioral' ? 'behavioral' : 'general',
                        maxQuestions: 5 
                    } 
                })
            });

            const startResponse = await startResult.json();
            if (startResponse.success) {
                setMessages((prev) => [...prev, { role: 'assistant', content: startResponse.message }]);
                setQuestionNumber(startResponse.questionNumber || 1);
                
                // Play the opening audio
                if (startResponse.hasAudio && startResponse.audioData) {
                    const audioBlob = new Blob([new Uint8Array(startResponse.audioData)], { type: 'audio/wav' });
                    const audioUrl = URL.createObjectURL(audioBlob);
                    const audio = new Audio(audioUrl);
                    
                    audio.onended = () => {
                        console.log('Introduction complete');
                        setIsWaitingForUser(true);
                        console.log('🎙️ User input can begin once ready.');
                    };

                    audio.onerror = () => {
                        console.error('❌ Error playing introduction audio');
                    };

                    audio.play();
                }
            }

            // Start audio recording with AudioContext and manual WAV encoding (with MediaRecorder fallback)
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    sampleRate: 16000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true
                },
            });
            
            console.log('✅ Microphone access granted');
            setAudioStream(stream);
            
            // Create AudioContext with 16kHz sample rate for Azure compatibility
            let context: AudioContext | null = null;
            let source: MediaStreamAudioSourceNode | null = null;
            let workletNode: AudioWorkletNode | null = null;
            let audioSamples: Float32Array[] = [];
            let isCurrentlyRecording = false;
            let recordingTimeoutId: NodeJS.Timeout | null = null;
            
            try {
                context = new AudioContext({ sampleRate: 16000 });
                setAudioContext(context);
                
                // Load the AudioWorklet module
                await context.audioWorklet.addModule('/audio-processor.js');
                
                source = context.createMediaStreamSource(stream);
                workletNode = new AudioWorkletNode(context, 'audio-processor');
                
                console.log('AudioContext created with sample rate:', context.sampleRate);
            } catch (error) {
                console.error('Failed to create AudioContext or AudioWorklet:', error);
                throw error;
            }
            
            // Convert Float32Array to WAV blob
            const createWAVBlob = (audioData: Float32Array[], sampleRate: number) => {
                const length = audioData.reduce((acc, chunk) => acc + chunk.length, 0);
                const buffer = new ArrayBuffer(44 + length * 2);
                const view = new DataView(buffer);
                
                // WAV header
                const writeString = (offset: number, string: string) => {
                    for (let i = 0; i < string.length; i++) {
                        view.setUint8(offset + i, string.charCodeAt(i));
                    }
                };
                
                writeString(0, 'RIFF');
                view.setUint32(4, 36 + length * 2, true);
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
                view.setUint32(40, length * 2, true);
                
                // Convert Float32 to Int16 and write to buffer
                let offset = 44;
                for (const chunk of audioData) {
                    for (let i = 0; i < chunk.length; i++) {
                        const sample = Math.max(-1, Math.min(1, chunk[i]));
                        view.setInt16(offset, sample * 0x7FFF, true);
                        offset += 2;
                    }
                }
                
                return new Blob([buffer], { type: 'audio/wav' });
            };
            
            const startAudioContextRecording = () => {
                console.log('Starting AudioContext recording...');
                audioSamples = [];
                isCurrentlyRecording = true;
                setIsRecording(true);

                // Set up message handler for AudioWorklet
                if (workletNode) {
                    workletNode.port.onmessage = (event) => {
                        if (!isCurrentlyRecording) return;
                        if (event.data.type === 'audiodata') {
                            audioSamples.push(event.data.audioData);
                        }
                    };
                }

                source?.connect(workletNode!);
                // Note: AudioWorkletNode doesn't need to connect to destination for processing

                recordingTimeoutId = setTimeout(() => {
                    stopAudioContextRecording();
                }, 8000); // Record for 8 seconds
            };

            const stopAudioContextRecording = async () => {
                console.log('Stopping AudioContext recording...');
                isCurrentlyRecording = false;
                setIsRecording(false);

                // Disconnect worklet node instead of processor
                source?.disconnect();
                if (workletNode) {
                    workletNode.port.onmessage = null;
                }

                if (recordingTimeoutId) {
                    clearTimeout(recordingTimeoutId);
                    recordingTimeoutId = null;
                }

                // Convert samples to WAV blob
                const audioBlob = createWAVBlob(audioSamples, context?.sampleRate!);
                console.log('Created WAV Blob:', audioBlob.size, 'bytes');

                // Validate WAV format
                try {
                    const buffer = await audioBlob.arrayBuffer();
                    const header = new DataView(buffer).getUint32(0, false);
                    if (header !== 0x52494646 /* "RIFF" */) {
                        throw new Error('Invalid RIFF header');
                    }
                    
                    // Verify sample rate and channels
                    const view = new DataView(buffer);
                    const fileSampleRate = view.getUint32(24, true);
                    const fileChannels = view.getUint16(22, true);
                    
                    console.log('WAV validation:', {
                        sampleRate: fileSampleRate,
                        channels: fileChannels,
                        expectedSampleRate: context?.sampleRate,
                        expectedChannels: 1
                    });
                    
                    if (fileSampleRate !== context?.sampleRate) {
                        console.warn('Sample rate mismatch in WAV file');
                    }
                    if (fileChannels !== 1) {
                        console.warn('Channel count mismatch in WAV file');
                    }
                } catch (validationError) {
                    console.error('WAV validation failed:', validationError);
                    return;
                }

                // Safety check for audio data
                if (!audioBlob || audioBlob.size === 0) {
                    console.error('No audio data captured or audio data is empty');
                    return;
                }

                // Process audio with backend API
                await sendAudioToBackend(audioBlob);
            };
            
            // Note: Azure Speech processing is now handled server-side via /api/voice/stream
            // This ensures credentials are secure and not exposed to the browser
            
            // Function to process user transcript
            const processUserTranscript = async (transcript: string) => {
                try {
                    const processResult = await fetch('/api/voice/conversation', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'process', userTranscript: transcript })
                    });

                    const processResponse = await processResult.json();

                    if (processResponse.success) {
                        setMessages((prev) => [...prev, { role: 'assistant', content: processResponse.message }]);
                        setQuestionNumber(processResponse.questionNumber);
                        setInterviewComplete(processResponse.isComplete);

                        // Play the AI response audio
                        if (processResponse.hasAudio && processResponse.audioData) {
                            const audioBlob = new Blob([new Uint8Array(processResponse.audioData)], { type: 'audio/wav' });
                            const audioUrl = URL.createObjectURL(audioBlob);
                            const audio = new Audio(audioUrl);
                            
                            setIsSpeaking(true);
                            
                            audio.onended = () => {
                                console.log('✅ AI audio playback finished');
                                setIsSpeaking(false);
                                setIsWaitingForUser(true);
                                
                                // Wait before starting next recording
                                setTimeout(() => {
                                    if (isWaitingForUser && callStatus === CallStatus.ACTIVE) {
                                        console.log('🎙️ Ready for user input - starting recording');
                                        setIsWaitingForUser(false);
                                        startAudioContextRecording();
                                    }
                                }, 500);
                            };
                            
                            audio.onerror = () => {
                                console.error('❌ Error playing AI audio');
                                setIsSpeaking(false);
                            };
                            
                            audio.play().catch(error => {
                                console.error('❌ Failed to play AI audio:', error);
                                setIsSpeaking(false);
                            });
                        }
                    } else {
                        console.error('Failed to process user response:', processResponse.error);
                    }
                } catch (error) {
                    console.error('Error processing user transcript:', error);
                }
            };
            
            // Store cleanup function for AudioContext
            const cleanup = async () => {
                isCurrentlyRecording = false;
                setIsRecording(false);
                if (recordingTimeoutId) {
                    clearTimeout(recordingTimeoutId);
                    recordingTimeoutId = null;
                }
                source?.disconnect();
                if (workletNode) {
                    workletNode.port.onmessage = null;
                }
                // Guard AudioContext.close() calls
                if (context && context.state !== 'closed') {
                    await context.close();
                }
                stream.getTracks().forEach(track => track.stop());
                setAudioContext(null);
                setAudioStream(null);
            };
            
            // Store functions in a custom object for later cleanup
            (window as any).audioRecorderCleanup = cleanup;
            (window as any).startAudioContextRecording = startAudioContextRecording;
            (window as any).stopAudioContextRecording = stopAudioContextRecording;
            
            // Start first recording
            startAudioContextRecording();
            
            // Set up continuous recording cycle
            const recordingInterval = setInterval(() => {
                if (callStatus === CallStatus.ACTIVE && !isCurrentlyRecording) {
                    startAudioContextRecording();
                } else if (callStatus !== CallStatus.ACTIVE) {
                    clearInterval(recordingInterval);
                    cleanup();
                }
            }, 9000); // Allow 8 second recording + 1 second buffer

            setCallStatus(CallStatus.ACTIVE);
            console.log('✅ Voice interview started successfully');

        } catch (error) {
            console.error('❌ Error during voice interview start:', error);
            setCallStatus(CallStatus.INACTIVE);
            alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    const handleDisconnect = async () => {
        try {
            setCallStatus(CallStatus.FINISHED);
            
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
            if (audioContext && audioContext.state !== 'closed') {
                await audioContext.close();
                setAudioContext(null);
            }
            
            setIsRecording(false);
            setIsWaitingForUser(false);

            console.log('✅ Voice interview ended');
        } catch (error) {
            console.error('Error ending call:', error);
            setCallStatus(CallStatus.FINISHED);
        }
    };

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
                            <span className="text-xs text-green-600 dark:text-green-400 animate-pulse">🎤 Listening...</span>
                        </div>
                    )}
                    {questionNumber > 0 && (
                        <div className="mt-1">
                            <span className="text-xs text-gray-500">Question {questionNumber}</span>
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
                                    ? "Start Interview"
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
                        End Interview
                    </button>
                )}
            </div>
        </>
    );
};

export default Agent;
