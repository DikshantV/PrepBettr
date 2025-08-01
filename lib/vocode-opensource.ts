import { EventEmitter } from 'events';
import { VocodeAssistantConfig } from '@/types/vocode';

interface ConversationConfig {
  transcriber: {
    provider: string;
    model?: string;
    language?: string;
    api_key?: string;
  };
  agent: {
    type: string;
    initial_message?: string;
    prompt?: string;
    language?: string;
    model?: {
      provider: string;
      model: string;
      api_key?: string;
      endpoint?: string;
    };
  };
  synthesizer: {
    provider: string;
    voice_id?: string;
    api_key?: string;
    speed?: number;
    stability?: number;
    similarity_boost?: number;
  };
  variable_values?: Record<string, string>;
}

export class VocodeOpenSource extends EventEmitter {
  private mediaRecorder: MediaRecorder | null = null;
  private audioStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private isActive: boolean = false;
  private currentConfig: ConversationConfig | null = null;
  private conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  private audioBuffer: Blob[] = [];
  private lastTranscriptionTime: number = 0;
  
  constructor() {
    super();
  }

  /**
   * Start conversation with open source configuration
   */
  async start(assistantConfig: VocodeAssistantConfig, options: {
    variableValues?: Record<string, string>;
    clientMessages?: any[];
    serverMessages?: any[];
  } = {}): Promise<void> {
    try {
      console.log('🚀 Starting Vocode Open Source conversation');
      
      // Build configuration from assistant config and environment variables
      const config: ConversationConfig = {
        transcriber: {
          provider: assistantConfig.transcriber?.provider || 'deepgram',
          model: assistantConfig.transcriber?.model || 'nova-2',
          language: assistantConfig.transcriber?.language || 'en-US',
          api_key: process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY
        },
        agent: {
          type: 'chat',
          initial_message: this.interpolateVariables(
            assistantConfig.first_message || 'Hello! How can I help you today?', 
            options.variableValues || {}
          ),
          prompt: this.interpolateVariables(
            assistantConfig.system_prompt || 'You are a helpful assistant.',
            options.variableValues || {}
          ),
          model: {
            provider: assistantConfig.model?.provider || 'azure-openai',
            model: assistantConfig.model?.model || 'gpt-4',
            api_key: process.env.NEXT_PUBLIC_AZURE_OPENAI_API_KEY,
            endpoint: process.env.NEXT_PUBLIC_AZURE_OPENAI_ENDPOINT
          }
        },
        synthesizer: {
          provider: assistantConfig.voice?.provider || 'elevenlabs',
          voice_id: assistantConfig.voice?.voice_id || 'sarah',
          api_key: process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY || process.env.AZURE_SPEECH_KEY,
          speed: assistantConfig.voice?.speed || 1.0,
          stability: assistantConfig.voice?.stability || 0.4,
          similarity_boost: assistantConfig.voice?.similarity_boost || 0.8
        },
        variable_values: options.variableValues
      };

      this.currentConfig = config;
      
      // Validate required API keys
      this.validateAPIKeys(config);
      
      // Initialize audio
      await this.initializeAudio();
      
      this.isActive = true;
      this.emit('call-start');
      
      // Send initial message
      if (config.agent.initial_message) {
        setTimeout(() => {
          this.emit('message', {
            type: 'transcript',
            role: 'assistant',
            transcript: config.agent.initial_message,
            transcriptType: 'final'
          });
          
          // Synthesize and play initial message
          this.synthesizeAndPlay(config.agent.initial_message!);
        }, 500);
      }
      
    } catch (error) {
      console.error('❌ Failed to start Vocode Open Source conversation:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Stop the conversation
   */
  async stop(): Promise<void> {
    try {
      console.log('🛑 Stopping Vocode Open Source conversation');
      
      this.stopAudioCapture();
      this.isActive = false;
      this.currentConfig = null;
      this.conversationHistory = [];
      
      this.emit('call-end');
    } catch (error) {
      console.error('❌ Error stopping conversation:', error);
      this.emit('error', error);
    }
  }

  /**
   * Initialize audio capture and processing
   */
  private async initializeAudio(): Promise<void> {
    try {
      // Get microphone access
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      });

      // Set up audio context for playback
      this.audioContext = new AudioContext();
      
      // Set up media recorder for speech recognition
      this.mediaRecorder = new MediaRecorder(this.audioStream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      this.mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          await this.processAudioData(event.data);
        }
      };

      this.mediaRecorder.start(1000); // Capture 1-second chunks
      console.log('🎤 Audio initialized');
    } catch (error) {
      console.error('❌ Failed to initialize audio:', error);
      throw new Error('Microphone access required');
    }
  }

  /**
   * Process captured audio data for speech recognition
   */
  private async processAudioData(audioData: Blob): Promise<void> {
    if (!this.currentConfig || !this.isActive) return;

    try {
      // Only process audio chunks that are large enough (at least 1KB)
      if (audioData.size < 1024) {
        return;
      }

      // Send to speech recognition service
      const transcript = await this.transcribeAudio(audioData);
      
      if (transcript && transcript.trim()) {
        console.log('📝 Transcript:', transcript);
        
        this.emit('speech-start');
        this.emit('message', {
          type: 'transcript',
          role: 'user',
          transcript: transcript,
          transcriptType: 'final'
        });
        this.emit('speech-end');

        // Generate AI response
        const response = await this.generateResponse(transcript);
        
        if (response) {
          this.emit('message', {
            type: 'transcript',
            role: 'assistant',
            transcript: response,
            transcriptType: 'final'
          });

          // Synthesize and play response
          await this.synthesizeAndPlay(response);
        }
      }
    } catch (error) {
      console.error('❌ Error processing audio:', error);
    }
  }

  /**
   * Transcribe audio using Deepgram
   */
  private async transcribeAudio(audioBlob: Blob): Promise<string | null> {
    if (!this.currentConfig?.transcriber.api_key) {
      console.warn('⚠️ No Deepgram API key - using mock transcription');
      return null;
    }

    try {
      // Send raw binary data to Deepgram
      const response = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${this.currentConfig.transcriber.api_key}`,
          'Content-Type': 'audio/webm'
        },
        body: audioBlob
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Deepgram API error:', response.status, errorText);
        return null;
      }

      const result = await response.json();
      const transcript = result.results?.channels?.[0]?.alternatives?.[0]?.transcript;
      
      if (transcript && transcript.trim()) {
        return transcript.trim();
      }
      
      return null;
    } catch (error) {
      console.error('❌ Transcription error:', error);
      return null;
    }
  }

  /**
   * Generate AI response using Azure OpenAI
   */
  private async generateResponse(userInput: string): Promise<string | null> {
    if (!this.currentConfig?.agent.model?.api_key) {
      console.warn('⚠️ No Azure OpenAI API key - using mock response');
      return "I understand you said: " + userInput;
    }

    try {
      this.conversationHistory.push({ role: 'user', content: userInput });

      const messages = [
        { role: 'system', content: this.currentConfig.agent.prompt },
        ...this.conversationHistory
      ];

      // Azure OpenAI uses a different endpoint format
      const endpoint = this.currentConfig.agent.model.endpoint;
      const deploymentName = this.currentConfig.agent.model.model;
      const apiVersion = '2024-02-15-preview'; // Latest stable API version

      if (!endpoint) {
        console.error('❌ AZURE_OPENAI_ENDPOINT is required for Azure OpenAI');
        return "I understand you said: " + userInput;
      }

      const azureUrl = `${endpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion}`;

      const response = await fetch(azureUrl, {
        method: 'POST',
        headers: {
          'api-key': this.currentConfig.agent.model.api_key,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: messages,
          max_tokens: 200,
          temperature: 0.7,
          stream: false
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Azure OpenAI API error:', response.status, errorText);
        return "I'm having trouble processing your request right now.";
      }

      const result = await response.json();
      const aiResponse = result.choices?.[0]?.message?.content;

      if (aiResponse) {
        this.conversationHistory.push({ role: 'assistant', content: aiResponse });
      }

      return aiResponse || null;
    } catch (error) {
      console.error('❌ AI response error:', error);
      return "I'm experiencing some technical difficulties. Please try again.";
    }
  }

  /**
   * Synthesize speech and play audio
   */
  private async synthesizeAndPlay(text: string): Promise<void> {
    if (!this.currentConfig?.synthesizer.api_key) {
      console.warn('⚠️ No TTS API key - skipping audio synthesis');
      return;
    }

    try {
      let audioBlob: Blob;

      if (this.currentConfig.synthesizer.provider === 'elevenlabs') {
        audioBlob = await this.synthesizeWithElevenLabs(text);
      } else if (this.currentConfig.synthesizer.provider === 'azure') {
        audioBlob = await this.synthesizeWithAzure(text);
      } else {
        console.warn('⚠️ Unsupported TTS provider');
        return;
      }

      await this.playAudio(audioBlob);
    } catch (error) {
      console.error('❌ TTS error:', error);
    }
  }

  /**
   * Synthesize speech with ElevenLabs
   */
  private async synthesizeWithElevenLabs(text: string): Promise<Blob> {
    // Use a default ElevenLabs voice ID if 'sarah' is used
    const voiceId = this.currentConfig!.synthesizer.voice_id === 'sarah' 
      ? 'EXAVITQu4vr4xnSDxMaL' // Bella voice ID
      : this.currentConfig!.synthesizer.voice_id;
    
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': this.currentConfig!.synthesizer.api_key!,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: text,
        voice_settings: {
          stability: this.currentConfig!.synthesizer.stability || 0.5,
          similarity_boost: this.currentConfig!.synthesizer.similarity_boost || 0.75
        },
        model_id: 'eleven_monolingual_v1'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ ElevenLabs API error:', response.status, errorText);
      throw new Error(`ElevenLabs synthesis failed: ${response.status}`);
    }

    return await response.blob();
  }

  /**
   * Synthesize speech with Azure
   */
  private async synthesizeWithAzure(text: string): Promise<Blob> {
    const response = await fetch(`https://${process.env.AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': this.currentConfig!.synthesizer.api_key!,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3'
      },
      body: `<speak version='1.0' xml:lang='en-US'><voice xml:lang='en-US' xml:gender='Female' name='en-US-SaraNeural'>${text}</voice></speak>`
    });

    return await response.blob();
  }

  /**
   * Play synthesized audio
   */
  private async playAudio(audioBlob: Blob): Promise<void> {
    if (!this.audioContext) return;

    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      const source = this.audioContext.createBufferSource();
      
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      source.start();
    } catch (error) {
      console.error('❌ Audio playback error:', error);
    }
  }

  /**
   * Stop audio capture
   */
  private stopAudioCapture(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      this.mediaRecorder = null;
    }

    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  /**
   * Interpolate variables in strings
   */
  private interpolateVariables(text: string, variables: Record<string, string>): string {
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return variables[key] || match;
    });
  }

  /**
   * Validate required API keys
   */
  private validateAPIKeys(config: ConversationConfig): void {
    const missing: string[] = [];

    if (!config.transcriber.api_key) {
      missing.push('DEEPGRAM_API_KEY');
    }

    if (!config.agent.model?.api_key) {
      missing.push('AZURE_OPENAI_API_KEY');
    }

    if (!config.agent.model?.endpoint) {
      missing.push('AZURE_OPENAI_ENDPOINT');
    }

    if (!config.synthesizer.api_key) {
      missing.push('ELEVENLABS_API_KEY or AZURE_SPEECH_KEY');
    }

    if (missing.length > 0) {
      console.warn(`⚠️ Missing required keys: ${missing.join(', ')}. Some features will use mock implementations.`);
    }
  }

  /**
   * Check if conversation is active
   */
  isConversationActive(): boolean {
    return this.isActive;
  }
}

// Export singleton instance
export const vocodeOpenSource = new VocodeOpenSource();
