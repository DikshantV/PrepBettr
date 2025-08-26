import { NextRequest, NextResponse } from 'next/server';
import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';
import { logger } from '@/lib/utils/logger';
import { handleAsyncError } from '@/lib/utils/error-utils';

interface TTSRequest {
  text: string;
  voice?: string;
  rate?: string;
  pitch?: string;
}

/**
 * Azure Text-to-Speech API Endpoint
 * Converts text to speech using Azure Speech Services
 */
export async function POST(request: NextRequest) {
  return handleAsyncError(async () => {
    try {
      const body: TTSRequest = await request.json();
      const { text, voice = 'en-US-SaraNeural', rate = '1.0', pitch = '0Hz' } = body;

      logger.api.request('POST /api/voice/tts', `Converting text to speech (${text.length} chars)`);

      if (!text || !text.trim()) {
        return NextResponse.json(
          { error: 'Text is required' },
          { status: 400 }
        );
      }

      if (text.length > 5000) {
        return NextResponse.json(
          { error: 'Text too long (max 5000 characters)' },
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

      // Configure Azure Speech SDK
      const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(speechKey, speechRegion);
      speechConfig.speechSynthesisVoiceName = voice;
      speechConfig.speechSynthesisOutputFormat = SpeechSDK.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3;

      // Create synthesizer with null audio config to get raw audio data
      const synthesizer = new SpeechSDK.SpeechSynthesizer(speechConfig, undefined);

      // Create SSML for better control
      const ssml = `
        <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
          <voice name="${voice}">
            <prosody rate="${rate}" pitch="${pitch}">
              ${escapeXml(text)}
            </prosody>
          </voice>
        </speak>
      `.trim();

      // Synthesize speech
      const result = await new Promise<SpeechSDK.SpeechSynthesisResult>((resolve, reject) => {
        synthesizer.speakSsmlAsync(
          ssml,
          (result) => {
            synthesizer.close();
            resolve(result);
          },
          (error) => {
            synthesizer.close();
            reject(error);
          }
        );
      });

      // Process synthesis result
      if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
        const audioData = result.audioData;
        
        logger.api.response('POST /api/voice/tts', 200, {
          textLength: text.length,
          audioSize: audioData.byteLength,
          voice: voice
        });

        // Return audio as blob
        return new NextResponse(audioData, {
          status: 200,
          headers: {
            'Content-Type': 'audio/mpeg',
            'Content-Length': audioData.byteLength.toString(),
            'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
          }
        });

      } else if (result.reason === SpeechSDK.ResultReason.Canceled) {
        const cancellationDetails = SpeechSDK.CancellationDetails.fromResult(result);
        const errorMessage = `TTS canceled: ${cancellationDetails.reason} - ${cancellationDetails.errorDetails}`;
        
        logger.error(errorMessage);
        
        if (cancellationDetails.reason === SpeechSDK.CancellationReason.Error) {
          if (cancellationDetails.errorDetails?.includes('authentication')) {
            return NextResponse.json(
              { error: 'Speech service authentication failed' },
              { status: 401 }
            );
          }
          if (cancellationDetails.errorDetails?.includes('quota')) {
            return NextResponse.json(
              { error: 'Speech service quota exceeded' },
              { status: 429 }
            );
          }
        }

        return NextResponse.json(
          { error: 'Speech synthesis failed' },
          { status: 422 }
        );

      } else {
        const errorMessage = `TTS failed with reason: ${result.reason}`;
        logger.error(errorMessage);
        return NextResponse.json(
          { error: errorMessage },
          { status: 422 }
        );
      }

    } catch (error) {
      logger.error('Text-to-speech processing failed', error instanceof Error ? error : new Error(String(error)));

      // Provide helpful error responses
      if (error instanceof Error) {
        if (error.message.includes('authentication')) {
          return NextResponse.json(
            { error: 'Speech service authentication failed' },
            { status: 401 }
          );
        }
        if (error.message.includes('quota') || error.message.includes('rate limit')) {
          return NextResponse.json(
            { error: 'Speech service quota exceeded' },
            { status: 429 }
          );
        }
        if (error.message.includes('timeout')) {
          return NextResponse.json(
            { error: 'Speech service timeout' },
            { status: 408 }
          );
        }
      }

      return NextResponse.json(
        { error: 'Internal TTS processing error' },
        { status: 500 }
      );
    }
  });
}

/**
 * GET endpoint to list available voices
 */
export async function GET() {
  return NextResponse.json({
    service: 'Azure Text-to-Speech',
    status: 'available',
    availableVoices: [
      {
        name: 'en-US-SaraNeural',
        displayName: 'Sara (Neural)',
        gender: 'Female',
        language: 'en-US'
      },
      {
        name: 'en-US-JennyNeural',
        displayName: 'Jenny (Neural)',
        gender: 'Female', 
        language: 'en-US'
      },
      {
        name: 'en-US-AriaNeural',
        displayName: 'Aria (Neural)',
        gender: 'Female',
        language: 'en-US'
      },
      {
        name: 'en-US-ChristopherNeural',
        displayName: 'Christopher (Neural)',
        gender: 'Male',
        language: 'en-US'
      },
      {
        name: 'en-US-EricNeural',
        displayName: 'Eric (Neural)', 
        gender: 'Male',
        language: 'en-US'
      },
      {
        name: 'en-US-GuyNeural',
        displayName: 'Guy (Neural)',
        gender: 'Male',
        language: 'en-US'
      }
    ],
    timestamp: new Date().toISOString()
  });
}

/**
 * Handle CORS preflight requests
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

/**
 * Escape XML special characters for SSML
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
