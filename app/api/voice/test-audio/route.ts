import { NextRequest, NextResponse } from 'next/server';
import { azureSpeechService } from '@/lib/services/azure-speech-service';
import { fetchAzureSecrets } from '@/lib/azure-config';
import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';

/**
 * Generate a test WAV file with known audio content for testing Azure Speech Service
 */
export async function GET() {
  try {
    // Generate a simple test tone WAV file (440Hz sine wave for 2 seconds)
    const sampleRate = 16000;
    const duration = 2; // seconds
    const frequency = 440; // Hz (A note)
    const amplitude = 0.3;
    
    const samples = sampleRate * duration;
    const buffer = new ArrayBuffer(44 + samples * 2);
    const view = new DataView(buffer);
    
    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + samples * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, samples * 2, true);
    
    // Generate sine wave audio data
    let offset = 44;
    for (let i = 0; i < samples; i++) {
      const sample = Math.sin(2 * Math.PI * frequency * i / sampleRate) * amplitude;
      const intSample = Math.max(-32767, Math.min(32767, sample * 32767));
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
    
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Disposition': 'attachment; filename="test-tone.wav"',
        'Content-Length': buffer.byteLength.toString(),
      },
    });
    
  } catch (error) {
    console.error('❌ Error generating test audio:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate test audio',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Test Azure Speech Service with a known good audio file
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Testing Azure Speech Service with known audio');
    
    // Get Azure Speech Service credentials
    const secrets = await fetchAzureSecrets(true);
    console.log('🔑 Azure secrets status:', {
      speechKey: secrets.speechKey ? 'SET' : 'MISSING',
      speechEndpoint: secrets.speechEndpoint ? 'SET' : 'MISSING'
    });
    
    if (!secrets.speechKey || !secrets.speechEndpoint) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Azure Speech Service not configured',
          details: {
            speechKey: !!secrets.speechKey,
            speechEndpoint: !!secrets.speechEndpoint
          }
        },
        { status: 500 }
      );
    }

    // Extract region from endpoint
    const region = secrets.speechEndpoint.match(/https:\/\/([^.]+)/)?.[1] || 'eastus2';
    
    // Configure Azure Speech Service
    const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(secrets.speechKey, region);
    speechConfig.speechRecognitionLanguage = 'en-US';
    speechConfig.setProperty(SpeechSDK.PropertyId.SpeechServiceResponse_RequestDetailedResultTrueFalse, 'true');
    
    // Generate test audio with spoken text
    console.log('🎵 Generating test speech audio...');
    
    // Create synthesizer to generate speech audio for testing
    const synthesizer = new SpeechSDK.SpeechSynthesizer(speechConfig);
    
    return new Promise((resolve) => {
      const testText = "Hello, this is a test of the Azure Speech Service recognition system.";
      
      synthesizer.speakTextAsync(
        testText,
        (synthesisResult) => {
          if (synthesisResult.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
            console.log('✅ Speech synthesis completed');
            
            // Now test recognition on the synthesized audio
            const audioBuffer = synthesisResult.audioData;
            console.log('📊 Generated audio buffer size:', audioBuffer.byteLength);
            
            // Create push stream for recognition
            const pushStream = SpeechSDK.AudioInputStream.createPushStream();
            pushStream.write(Buffer.from(audioBuffer));
            pushStream.close();
            
              // Use the new helper to process speech
              azureSpeechService.processAudioWithAzureSpeech(audioBuffer)
                .then((recognitionResult) => {
                  console.log('🔍 Recognition result:', recognitionResult);
                  let response;

                  if (recognitionResult) {
                    console.log(`✅ Speech recognized: ${recognitionResult.text}`);
                    response = NextResponse.json({
                      success: true,
                      originalText: testText,
                      recognizedText: recognitionResult.text,
                      confidence: recognitionResult.confidence,
                      audioSize: audioBuffer.byteLength,
                      reason: recognitionResult.reason,
                      testStatus: 'PASSED'
                    });
                  } else {
                    console.log('❌ No speech recognized');
                    response = NextResponse.json({
                      success: false,
                      originalText: testText,
                      error: 'No speech recognized in test',
                      audioSize: audioBuffer.byteLength,
                      testStatus: 'FAILED'
                    }, { status: 400 });
                  }

                  synthesizer.close();
                  resolve(response);
                })
                .catch((error) => {
                  console.error('❌ Recognition error:', error);
                  synthesizer.close();
                  resolve(NextResponse.json({
                    success: false,
                    originalText: testText,
                    error: 'Speech recognition failed in test',
                    details: error.toString(),
                    testStatus: 'ERROR'
                  }, { status: 500 }));
                });
          } else {
            console.error('❌ Speech synthesis failed:', synthesisResult.reason);
            synthesizer.close();
            resolve(NextResponse.json({
              success: false,
              error: 'Speech synthesis failed',
              reason: synthesisResult.reason,
              testStatus: 'SYNTHESIS_FAILED'
            }, { status: 500 }));
          }
        },
        (error) => {
          console.error('❌ Synthesis error:', error);
          synthesizer.close();
          resolve(NextResponse.json({
            success: false,
            error: 'Speech synthesis error',
            details: error.toString(),
            testStatus: 'SYNTHESIS_ERROR'
          }, { status: 500 }));
        }
      );
    });

  } catch (error) {
    console.error('❌ Error in test audio API:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
        testStatus: 'EXCEPTION'
      },
      { status: 500 }
    );
  }
}
