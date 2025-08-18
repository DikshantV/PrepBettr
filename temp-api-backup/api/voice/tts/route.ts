import { NextRequest, NextResponse } from 'next/server';
import { azureSpeechService } from '@/lib/services/azure-speech-service';

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Text is required for synthesis' },
        { status: 400 }
      );
    }

    // Initialize speech service if not already done
    if (!azureSpeechService.isReady()) {
      const initialized = await azureSpeechService.initialize();
      if (!initialized) {
        return NextResponse.json(
          { error: 'Failed to initialize Azure Speech service' },
          { status: 500 }
        );
      }
    }

    // Generate speech audio
    const audioBuffer = await azureSpeechService.synthesizeSpeech(text);
    
    if (!audioBuffer) {
      return NextResponse.json(
        { error: 'Failed to synthesize speech' },
        { status: 500 }
      );
    }

    // Return audio as blob
    return new Response(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': audioBuffer.byteLength.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });

  } catch (error) {
    console.error('❌ Error in TTS API:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Health check for TTS service
    const isReady = azureSpeechService.isReady();
    
    return NextResponse.json({
      status: isReady ? 'ready' : 'not_ready',
      service: 'azure-speech-tts',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Error in TTS health check:', error);
    return NextResponse.json(
      { 
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
