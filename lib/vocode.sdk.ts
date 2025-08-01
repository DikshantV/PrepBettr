import { useConversation } from 'vocode';
import { EventEmitter } from 'events';

// ConversationClient to match @vocode/react interface pattern
export class ConversationClient extends EventEmitter {
    private apiKey: string;
    private currentConfig: any = null;
    private conversationHook: any = null;
    private isActive: boolean = false;

    constructor(config: { apiKey: string }) {
        super();
        this.apiKey = config.apiKey;
        
        if (!this.apiKey) {
            console.error('❌ NEXT_PUBLIC_VOCODE_API_KEY is not set in environment variables');
            throw new Error('NEXT_PUBLIC_VOCODE_API_KEY is required');
        }
        
        console.log('🔑 Vocode API Key configured:', this.apiKey ? 'YES' : 'NO');
        console.log('🔑 Vocode API Key length:', this.apiKey?.length || 0);
    }

    /**
     * Start a conversation with the given configuration
     * Thin facade over the existing Vocode hook interface
     */
    async start(config: any): Promise<any> {
        try {
            console.log('🚀 Starting Vocode conversation with config:', config);
            
            this.currentConfig = {
                vocodeConfig: {
                    apiKey: this.apiKey,
                    conversationId: config.conversationId,
                },
                audioDeviceConfig: {
                    inputDeviceId: config.inputDeviceId,
                    outputSamplingRate: config.outputSamplingRate || 24000,
                },
                transcriberConfig: config.transcriberConfig || {
                    type: "transcriber_deepgram",
                    model: "nova-2",
                    language: "en-US",
                },
                agentConfig: config.agentConfig || {
                    type: "agent_echo",
                },
                synthesizerConfig: config.synthesizerConfig || {
                    type: "synthesizer_eleven_labs",
                    voice_id: "pNInz6obpgDQGcFmaJgB",
                },
            };
            
            this.isActive = true;
            this.emit('call-start');
            
            return { success: true, config: this.currentConfig };
        } catch (error) {
            console.error('❌ Failed to start Vocode conversation:', error);
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Stop the current conversation
     * Thin facade over the existing interface
     */
    async stop(): Promise<void> {
        try {
            console.log('🛑 Stopping Vocode conversation');
            
            this.isActive = false;
            this.currentConfig = null;
            this.emit('call-end');
        } catch (error) {
            console.error('❌ Error stopping Vocode conversation:', error);
            this.emit('error', error);
        }
    }

    /**
     * Check if conversation is currently active
     */
    isConversationActive(): boolean {
        return this.isActive;
    }

    /**
     * Get current configuration
     */
    getCurrentConfig(): any {
        return this.currentConfig;
    }
}

// Vocode SDK Configuration
const vocodeApiKey = process.env.NEXT_PUBLIC_VOCODE_API_KEY;
const vocodeBaseUrl = process.env.NEXT_PUBLIC_VOCODE_BASE_URL || 'https://api.vocode.dev';

// Types for Vocode integration
interface VocodeStartOptions {
    variableValues: any;
    clientMessages: any[];
    serverMessages: any[];
}

interface VocodeMessage {
    type: string;
    role?: string;
    transcript?: string;
    transcriptType?: string;
    functionCall?: {
        name: string;
        parameters: any;
    };
}

class VocodeSDK extends EventEmitter {
    private apiKey: string;
    private baseUrl: string;
    private currentCall: string | null = null;
    private mediaRecorder: MediaRecorder | null = null;
    private audioStream: MediaStream | null = null;
    private websocket: WebSocket | null = null;
    private isConnected: boolean = false;

    constructor(apiKey: string, baseUrl: string = 'https://api.vocode.dev') {
        super();
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
    }

    /**
     * Start a Vocode conversation
     * Replicates VAPI's start method
     */
    async start(assistantId: string, options: VocodeStartOptions): Promise<any> {
        try {
            console.log('🚀 Starting Vocode conversation with assistant:', assistantId);
            console.log('🔧 Options:', options);

            // Initialize media stream for audio input
            await this.initializeAudioStream();
            
            // Create conversation session
            const sessionResponse = await fetch(`${this.baseUrl}/conversations`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    assistant_id: assistantId,
                    variable_values: options.variableValues,
                    client_messages: options.clientMessages,
                    server_messages: options.serverMessages
                })
            });

            if (!sessionResponse.ok) {
                const error = await sessionResponse.text();
                throw new Error(`Failed to create Vocode session: ${error}`);
            }

            const sessionData = await sessionResponse.json();
            this.currentCall = sessionData.conversation_id;

            // Establish WebSocket connection for real-time communication
            await this.connectWebSocket(sessionData.websocket_url || `${this.baseUrl.replace('http', 'ws')}/conversations/${this.currentCall}/ws`);
            
            // Start audio recording and streaming
            this.startAudioStreaming();

            this.emit('call-start');
            
            return sessionData;
        } catch (error) {
            console.error('❌ Failed to start Vocode conversation:', error);
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Stop the current Vocode conversation
     * Replicates VAPI's stop method
     */
    async stop(): Promise<void> {
        try {
            console.log('🛑 Stopping Vocode conversation');

            // Stop audio streaming
            this.stopAudioStreaming();

            // Close WebSocket connection
            if (this.websocket) {
                this.websocket.close();
                this.websocket = null;
            }

            // End conversation session
            if (this.currentCall) {
                await fetch(`${this.baseUrl}/conversations/${this.currentCall}/end`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                });
            }

            this.currentCall = null;
            this.isConnected = false;
            this.emit('call-end');
        } catch (error) {
            console.error('❌ Error stopping Vocode conversation:', error);
            this.emit('error', error);
        }
    }

    /**
     * Initialize audio stream for microphone input
     */
    private async initializeAudioStream(): Promise<void> {
        try {
            this.audioStream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    sampleRate: 16000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });
            console.log('🎤 Audio stream initialized');
        } catch (error) {
            console.error('❌ Failed to initialize audio stream:', error);
            throw new Error('Microphone access required for Vocode conversation');
        }
    }

    /**
     * Start audio streaming to Vocode
     */
    private startAudioStreaming(): void {
        if (!this.audioStream) return;

        try {
            this.mediaRecorder = new MediaRecorder(this.audioStream, {
                mimeType: 'audio/webm;codecs=opus'
            });

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0 && this.websocket?.readyState === WebSocket.OPEN) {
                    // Convert audio data to base64 and send via WebSocket
                    const reader = new FileReader();
                    reader.onload = () => {
                        const audioData = reader.result as string;
                        this.websocket?.send(JSON.stringify({
                            type: 'audio',
                            data: audioData.split(',')[1] // Remove data:audio/webm;base64, prefix
                        }));
                    };
                    reader.readAsDataURL(event.data);
                }
            };

            this.mediaRecorder.start(100); // Send audio chunks every 100ms
            console.log('🎤 Audio streaming started');
        } catch (error) {
            console.error('❌ Failed to start audio streaming:', error);
            this.emit('error', error);
        }
    }

    /**
     * Stop audio streaming
     */
    private stopAudioStreaming(): void {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
            this.mediaRecorder = null;
        }

        if (this.audioStream) {
            this.audioStream.getTracks().forEach(track => track.stop());
            this.audioStream = null;
        }
        console.log('🎤 Audio streaming stopped');
    }

    /**
     * Connect to Vocode WebSocket for real-time communication
     */
    private async connectWebSocket(websocketUrl: string): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                this.websocket = new WebSocket(websocketUrl);

                this.websocket.onopen = () => {
                    console.log('🔌 WebSocket connected to Vocode');
                    this.isConnected = true;
                    resolve();
                };

                this.websocket.onmessage = (event) => {
                    try {
                        const message = JSON.parse(event.data) as VocodeMessage;
                        this.handleWebSocketMessage(message);
                    } catch (error) {
                        console.error('❌ Error parsing WebSocket message:', error);
                    }
                };

                this.websocket.onerror = (error) => {
                    console.error('❌ WebSocket error:', error);
                    this.emit('error', error);
                    reject(error);
                };

                this.websocket.onclose = () => {
                    console.log('🔌 WebSocket disconnected from Vocode');
                    this.isConnected = false;
                };

            } catch (error) {
                console.error('❌ Failed to connect WebSocket:', error);
                reject(error);
            }
        });
    }

    /**
     * Handle incoming WebSocket messages from Vocode
     */
    private handleWebSocketMessage(message: VocodeMessage): void {
        console.log('📨 Vocode message received:', message);

        switch (message.type) {
            case 'transcript':
                this.emit('message', message);
                break;
            
            case 'function-call':
                this.emit('message', message);
                break;
            
            case 'speech-start':
                this.emit('speech-start');
                break;
            
            case 'speech-end':
                this.emit('speech-end');
                break;
            
            case 'audio':
                // Handle incoming audio for playback
                this.playAudio(message);
                break;
            
            case 'error':
                this.emit('error', new Error(message.transcript || 'Vocode error'));
                break;
            
            default:
                console.log('🔍 Unknown message type:', message.type);
                this.emit('message', message);
        }
    }

    /**
     * Play audio response from Vocode
     */
    private async playAudio(message: any): Promise<void> {
        try {
            if (message.data) {
                const audioData = atob(message.data);
                const audioBuffer = new ArrayBuffer(audioData.length);
                const audioView = new Uint8Array(audioBuffer);
                
                for (let i = 0; i < audioData.length; i++) {
                    audioView[i] = audioData.charCodeAt(i);
                }

                const audioContext = new AudioContext();
                const decodedBuffer = await audioContext.decodeAudioData(audioBuffer);
                const source = audioContext.createBufferSource();
                source.buffer = decodedBuffer;
                source.connect(audioContext.destination);
                source.start();
            }
        } catch (error) {
            console.error('❌ Error playing audio:', error);
        }
    }

    /**
     * Get current call status
     */
    isActive(): boolean {
        return this.isConnected && this.currentCall !== null;
    }

    /**
     * Send a text message to the conversation
     */
    async sendMessage(text: string): Promise<void> {
        if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
            throw new Error('WebSocket not connected');
        }

        this.websocket.send(JSON.stringify({
            type: 'text',
            content: text
        }));
    }

    /**
     * Add event listener (replicates VAPI's on method)
     */
    on(event: string, listener: (...args: any[]) => void): this {
        return super.on(event, listener);
    }

    /**
     * Remove event listener (replicates VAPI's off method)
     */
    off(event: string, listener: (...args: any[]) => void): this {
        return super.off(event, listener);
    }
}

// Export singleton instance
export const vocode = new VocodeSDK(vocodeApiKey!, vocodeBaseUrl);
