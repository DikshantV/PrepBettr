import { NextRequest, NextResponse } from 'next/server';
import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';
import { logger } from '@/lib/utils/logger';
import { handleAsyncError } from '@/lib/utils/error-utils';

/**
 * Azure Speech-to-Text API Endpoint
 * Converts audio blobs to text using Azure Speech Services
 */
export async function POST(request: NextRequest) {
  return handleAsyncError(async () => {
    logger.api.request('POST /api/voice/stream', 'Processing audio for speech-to-text');

    try {
      const formData = await request.formData();
      const audioFile = formData.get('audio') as File;

      if (!audioFile) {
        return NextResponse.json(
          { error: 'No audio file provided' },
          { status: 400 }
        );
      }

      // Validate audio file
      const validTypes = ['audio/wav', 'audio/webm', 'audio/mp4', 'audio/ogg'];
      if (!validTypes.includes(audioFile.type)) {
        logger.warn('Invalid audio type received', { type: audioFile.type });
        return NextResponse.json(
          { error: `Invalid audio type: ${audioFile.type}. Supported: ${validTypes.join(', ')}` },
          { status: 400 }
        );
      }

      // Get Azure Speech credentials
      const speechKey = process.env.NEXT_PUBLIC_SPEECH_KEY || process.env.AZURE_SPEECH_KEY;
      const speechRegion = process.env.NEXT_PUBLIC_SPEECH_REGION || process.env.AZURE_SPEECH_REGION;

      if (!speechKey || !speechRegion) {
        logger.error('Azure Speech Service credentials not found');
        return NextResponse.json(
          { error: 'Speech service configuration error' },
          { status: 500 }
        );
      }

      // Convert File to ArrayBuffer
      const audioBuffer = await audioFile.arrayBuffer();
      const audioData = new Uint8Array(audioBuffer);

      // Configure Azure Speech SDK
      const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(speechKey, speechRegion);
      speechConfig.speechRecognitionLanguage = 'en-US';
      speechConfig.enableDictation = true;

      // Create audio stream from buffer
      const audioFormat = SpeechSDK.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1);
      const audioStream = SpeechSDK.AudioInputStream.createPushStream(audioFormat);
      
      // Push audio data to stream
      audioStream.write(audioData);
      audioStream.close();

      const audioConfig = SpeechSDK.AudioConfig.fromStreamInput(audioStream);
      const recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);

      // Perform speech recognition
      const result = await new Promise<SpeechSDK.SpeechRecognitionResult>((resolve, reject) => {
        recognizer.recognizeOnceAsync(
          (result) => {
            recognizer.close();
            resolve(result);
          },
          (error) => {
            recognizer.close();
            reject(error);
          }
        );
      });

      // Process recognition result
      if (result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
        const transcript = result.text.trim();
        
        logger.api.response('POST /api/voice/stream', 200, {
          transcriptLength: transcript.length,
          audioSize: audioFile.size
        });

        return NextResponse.json({
          text: transcript,
          confidence: 0.95, // Azure doesn't always provide confidence, use default
          duration: audioFile.size / 16000 // Rough estimation
        });
      } else if (result.reason === SpeechSDK.ResultReason.NoMatch) {
        logger.warn('No speech detected in audio', { audioSize: audioFile.size });
        return NextResponse.json({
          text: '',
          confidence: 0,
          error: 'No speech detected'
        });
      } else {
        const errorMessage = `Speech recognition failed: ${result.reason}`;
        logger.error(errorMessage, { reason: result.reason });
        return NextResponse.json(
          { error: errorMessage },
          { status: 422 }
        );
      }

    } catch (error) {
      logger.error('Speech-to-text processing failed', error instanceof Error ? error : new Error(String(error)));
      
      // Provide helpful error responses
      if (error instanceof Error) {
        if (error.message.includes('authentication')) {
          return NextResponse.json(
            { error: 'Speech service authentication failed' },
            { status: 401 }
          );
        }
        if (error.message.includes('quota')) {
          return NextResponse.json(
            { error: 'Speech service quota exceeded' },
            { status: 429 }
          );
        }
      }

      return NextResponse.json(
        { error: 'Internal speech processing error' },
        { status: 500 }
      );
    }
  });
}

/**
 * Health check endpoint for speech service
 */
export async function GET() {
  return NextResponse.json({
    service: 'Azure Speech-to-Text',
    status: 'available',
    timestamp: new Date().toISOString()
  });
}
