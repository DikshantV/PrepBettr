import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';
import { fetchAzureSecrets } from '../../../lib/azure-config-browser';

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
      this.speechConfig.speechRecognitionLanguage = 'en-US';
      this.speechConfig.speechSynthesisVoiceName = 'en-US-SaraNeural';

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
    } catch (error) {
      console.error('❌ Failed to start speech recognition:', error);
      if (onError) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        onError(errorMessage || 'Failed to start speech recognition');
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

      const ssml = `
        <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
          <voice name="${voiceName}">
            <prosody rate="${rate}" pitch="${pitch}">
              ${text}
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
