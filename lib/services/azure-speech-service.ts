import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';
import { fetchAzureSecrets } from '@/lib/azure-config';

export interface SpeechRecognitionResult {
  text: string;
  confidence: number;
  reason: string;
}

export interface SpeechSynthesisOptions {
  voiceName?: string;
  rate?: string;
  pitch?: string;
}

export class AzureSpeechService {
  private speechConfig: SpeechSDK.SpeechConfig | null = null;
  private recognizer: SpeechSDK.SpeechRecognizer | null = null;
  private synthesizer: SpeechSDK.SpeechSynthesizer | null = null;
  private isInitialized = false;

  /**
   * Initialize the Azure Speech Service
   */
  async initialize(): Promise<boolean> {
    try {
      const secrets = await fetchAzureSecrets();
      
      if (!secrets.speechKey || !secrets.speechEndpoint) {
        console.warn('⚠️ Azure Speech credentials not available');
        return false;
      }

      // Extract region from endpoint (e.g., https://westus.api.cognitive.microsoft.com -> westus)
      const region = secrets.speechEndpoint.match(/https:\/\/([^.]+)/)?.[1] || 'westus';

      this.speechConfig = SpeechSDK.SpeechConfig.fromSubscription(secrets.speechKey, region);
      
      // Enhanced Speech Recognition Configuration
      this.speechConfig.speechRecognitionLanguage = 'en-US';
      this.speechConfig.setProperty(SpeechSDK.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs, '15000'); // Extended to 15s
      this.speechConfig.setProperty(SpeechSDK.PropertyId.SpeechServiceConnection_EndSilenceTimeoutMs, '2000');
      this.speechConfig.setProperty(SpeechSDK.PropertyId.Speech_SegmentationSilenceTimeoutMs, '2000');
      this.speechConfig.setProperty(SpeechSDK.PropertyId.SpeechServiceResponse_DiarizeIntermediateResults, 'true');
      this.speechConfig.setProperty(SpeechSDK.PropertyId.SpeechServiceResponse_RequestDetailedResultTrueFalse, 'true');
      this.speechConfig.setProperty(SpeechSDK.PropertyId.SpeechServiceConnection_RecoMode, 'CONVERSATION');
      
      // Enhanced Speech Synthesis Configuration
      this.speechConfig.speechSynthesisVoiceName = 'en-US-AriaNeural'; // More natural sounding
      this.speechConfig.speechSynthesisOutputFormat = SpeechSDK.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3;

      this.isInitialized = true;
      console.log('✅ Azure Speech Service initialized');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Azure Speech Service:', error);
      return false;
    }
  }

  /**
   * Start continuous speech recognition
   */
  async startContinuousRecognition(
    onRecognized: (result: SpeechRecognitionResult) => void,
    onError?: (error: string) => void
  ): Promise<boolean> {
    if (!this.isInitialized || !this.speechConfig) {
      console.error('❌ Azure Speech Service not initialized');
      return false;
    }

    try {
      const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
      this.recognizer = new SpeechSDK.SpeechRecognizer(this.speechConfig, audioConfig);

      this.recognizer.recognized = (s, e) => {
        if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech && e.result.text) {
          onRecognized({
            text: e.result.text,
            confidence: e.result.properties?.getProperty(SpeechSDK.PropertyId.SpeechServiceResponse_JsonResult) ? 1.0 : 0.8,
            reason: 'RecognizedSpeech'
          });
        }
      };

      this.recognizer.canceled = (s, e) => {
        console.log(`❌ Recognition canceled: ${e.reason}`);
        if (e.reason === SpeechSDK.CancellationReason.Error && onError) {
          onError(e.errorDetails || 'Unknown error');
        }
        this.stopContinuousRecognition();
      };

      this.recognizer.sessionStopped = (s, e) => {
        console.log('🛑 Recognition session stopped');
        this.stopContinuousRecognition();
      };

      await this.recognizer.startContinuousRecognitionAsync();
      console.log('🎤 Started continuous speech recognition');
      return true;
    } catch (error: any) {
      console.error('❌ Failed to start speech recognition:', error);
      if (onError) {
        onError(error.message || 'Failed to start speech recognition');
      }
      return false;
    }
  }

  /**
   * Stop continuous speech recognition
   */
  async stopContinuousRecognition(): Promise<void> {
    if (this.recognizer) {
      try {
        await this.recognizer.stopContinuousRecognitionAsync();
        this.recognizer.close();
        this.recognizer = null;
        console.log('🛑 Stopped speech recognition');
      } catch (error) {
        console.error('❌ Error stopping speech recognition:', error);
      }
    }
  }

  /**
   * Synthesize speech from text
   */
  async synthesizeSpeech(
    text: string,
    options: SpeechSynthesisOptions = {}
  ): Promise<ArrayBuffer | null> {
    if (!this.isInitialized || !this.speechConfig) {
      console.error('❌ Azure Speech Service not initialized');
      return null;
    }

    try {
      const audioConfig = SpeechSDK.AudioConfig.fromDefaultSpeakerOutput();
      this.synthesizer = new SpeechSDK.SpeechSynthesizer(this.speechConfig, audioConfig);

      const voiceName = options.voiceName || 'en-US-SaraNeural';
      const rate = options.rate || '1.0';
      const pitch = options.pitch || '0Hz';

      // Sanitize text for SSML
      const sanitizedText = this.sanitizeTextForSSML(text);

      const ssml = `
        <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
          <voice name="${voiceName}">
            <prosody rate="${rate}" pitch="${pitch}">
              ${sanitizedText}
            </prosody>
          </voice>
        </speak>
      `;

      return new Promise((resolve, reject) => {
        this.synthesizer!.speakSsmlAsync(
          ssml,
          (result) => {
            if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
              console.log('✅ Speech synthesis completed');
              resolve(result.audioData);
            } else {
              console.error('❌ Speech synthesis failed:', result.errorDetails);
              reject(new Error(result.errorDetails || 'Speech synthesis failed'));
            }
            this.synthesizer?.close();
            this.synthesizer = null;
          },
          (error) => {
            console.error('❌ Speech synthesis error:', error);
            reject(error);
            this.synthesizer?.close();
            this.synthesizer = null;
          }
        );
      });
    } catch (error) {
      console.error('❌ Failed to synthesize speech:', error);
      return null;
    }
  }

  /**
   * Sanitize text for SSML to handle special characters and emojis
   */
  private sanitizeTextForSSML(text: string): string {
    return text
      // Remove or replace emojis and special unicode characters
      .replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '')
      // Escape XML special characters (but NOT apostrophes - they cause TTS to say "apos")
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      // NOTE: We intentionally do NOT escape apostrophes with &apos; as TTS reads it as "apos"
      // Single quotes/apostrophes are safe in SSML content and will be pronounced correctly
      // .replace(/'/g, '&apos;')  // REMOVED - causes "apos" pronunciation
      // Remove problematic symbols that might cause parsing issues
      .replace(/[@#$%^&*()]/g, ' ')
      // Clean up multiple spaces
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Process audio with Azure Speech using continuous recognition for better silence handling
   */
  async processAudioWithAzureSpeech(audioBuffer: ArrayBuffer): Promise<SpeechRecognitionResult | null> {
    if (!this.isInitialized || !this.speechConfig) {
      console.error('❌ Azure Speech Service not initialized');
      return null;
    }

    try {
      // Create push stream for the audio
      const pushStream = SpeechSDK.AudioInputStream.createPushStream();
      const buffer = new Uint8Array(audioBuffer);
      pushStream.write(buffer as any); // Azure SDK expects ArrayBuffer but Uint8Array is compatible
      pushStream.close();
      
      const audioConfig = SpeechSDK.AudioConfig.fromStreamInput(pushStream);
      const recognizer = new SpeechSDK.SpeechRecognizer(this.speechConfig, audioConfig);

      // Use continuous recognition instead of recognizeOnceAsync
      return new Promise((resolve, reject) => {
        let hasRecognizedSpeech = false;
        let finalResult: SpeechRecognitionResult | null = null;
        
        // Set maximum duration (65 seconds) to prevent hanging
        const maxDurationTimer = setTimeout(() => {
          console.log('⏱️ Maximum recognition duration reached, stopping...');
          recognizer.stopContinuousRecognitionAsync();
          if (!hasRecognizedSpeech) {
            resolve(null);
          }
        }, 65000);

        // Handle final recognized results
        recognizer.recognized = (sender, event) => {
          if (event.result.reason === SpeechSDK.ResultReason.RecognizedSpeech && event.result.text) {
            console.log(`✅ Speech recognized: ${event.result.text}`);
            hasRecognizedSpeech = true;
            
            finalResult = {
              text: event.result.text,
              confidence: event.result.properties?.getProperty(SpeechSDK.PropertyId.SpeechServiceResponse_JsonResult) ? 1.0 : 0.8,
              reason: 'RecognizedSpeech'
            };
            
            // Stop recognition after first meaningful result
            clearTimeout(maxDurationTimer);
            recognizer.stopContinuousRecognitionAsync();
          }
        };

        // Handle session stopped
        recognizer.sessionStopped = (sender, event) => {
          console.log('🛑 Recognition session stopped');
          clearTimeout(maxDurationTimer);
          recognizer.close();
          resolve(finalResult);
        };

        // Handle cancellation/errors
        recognizer.canceled = (sender, event) => {
          console.log(`❌ Recognition canceled: ${event.reason}`);
          clearTimeout(maxDurationTimer);
          recognizer.stopContinuousRecognitionAsync();
          
          if (event.reason === SpeechSDK.CancellationReason.Error) {
            console.error('Recognition error:', event.errorDetails);
            reject(new Error(event.errorDetails || 'Unknown recognition error'));
          } else {
            resolve(finalResult);
          }
        };

        // Start continuous recognition
        recognizer.startContinuousRecognitionAsync(
          () => {
            console.log('🎤 Started continuous recognition for audio processing');
          },
          (error) => {
            console.error('❌ Failed to start continuous recognition:', error);
            clearTimeout(maxDurationTimer);
            recognizer.close();
            reject(new Error(error));
          }
        );
      });
    } catch (error) {
      console.error('❌ Failed to process audio with Azure Speech:', error);
      return null;
    }
  }

  /**
   * Check if the service is initialized and ready
   */
  isReady(): boolean {
    return this.isInitialized && this.speechConfig !== null;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.stopContinuousRecognition();
    if (this.synthesizer) {
      this.synthesizer.close();
      this.synthesizer = null;
    }
    this.speechConfig = null;
    this.isInitialized = false;
    console.log('🧹 Azure Speech Service disposed');
  }
}

// Export singleton instance
export const azureSpeechService = new AzureSpeechService();
