import { NextRequest, NextResponse } from 'next/server';
import { azureSpeechService } from '@/lib/services/azure-speech-service';
import { fetchAzureSecrets } from '@/lib/azure-config';
import { spawn } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

/**
 * Supported audio formats for the API
 */
const SUPPORTED_AUDIO_TYPES = [
  'audio/wav',
  'audio/webm',
  'audio/ogg',
  'audio/webm;codecs=opus',
  'audio/ogg;codecs=opus',
  'audio/webm;codecs=pcm'
];

/**
 * Transcode audio file to WAV format using FFmpeg
 */
async function transcodeToWAV(audioBuffer: ArrayBuffer, sourceFormat: string): Promise<ArrayBuffer> {
  const tempId = randomUUID();
  const inputPath = join(tmpdir(), `input_${tempId}.${getFileExtension(sourceFormat)}`);
  const outputPath = join(tmpdir(), `output_${tempId}.wav`);
  
  try {
    console.log('🔄 Starting transcoding process:', { sourceFormat, inputPath, outputPath });
    
    // Write input file
    await writeFile(inputPath, Buffer.from(audioBuffer));
    
    // Run FFmpeg transcoding
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', inputPath,
        '-acodec', 'pcm_s16le',  // 16-bit PCM
        '-ar', '16000',          // 16kHz sample rate
        '-ac', '1',              // Mono channel
        '-y',                    // Overwrite output file
        outputPath
      ]);
      
      let errorOutput = '';
      
      ffmpeg.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log('✅ FFmpeg transcoding completed successfully');
          resolve();
        } else {
          console.error('❌ FFmpeg transcoding failed:', errorOutput);
          reject(new Error(`FFmpeg failed with code ${code}: ${errorOutput}`));
        }
      });
      
      ffmpeg.on('error', (error) => {
        console.error('❌ FFmpeg spawn error:', error);
        reject(error);
      });
    });
    
    // Read transcoded file
    const fs = await import('fs/promises');
    const transcodedBuffer = await fs.readFile(outputPath);
    
    console.log('📊 Transcoded audio details:', {
      originalSize: audioBuffer.byteLength,
      transcodedSize: transcodedBuffer.byteLength
    });
    
    return transcodedBuffer.buffer.slice(transcodedBuffer.byteOffset, transcodedBuffer.byteOffset + transcodedBuffer.byteLength);
    
  } finally {
    // Clean up temporary files
    try {
      await unlink(inputPath);
      await unlink(outputPath);
    } catch (cleanupError) {
      console.warn('⚠️ Failed to clean up temporary files:', cleanupError);
    }
  }
}

/**
 * Get file extension from MIME type
 */
function getFileExtension(mimeType: string): string {
  const cleanType = mimeType.split(';')[0].toLowerCase();
  switch (cleanType) {
    case 'audio/webm': return 'webm';
    case 'audio/ogg': return 'ogg';
    case 'audio/wav': return 'wav';
    default: return 'webm';
  }
}

/**
 * Check if the audio buffer is a valid WAV file
 */
function isValidWAV(audioBuffer: ArrayBuffer): boolean {
  if (audioBuffer.byteLength < 44) return false;
  
  const headerView = new DataView(audioBuffer);
  const riffCheck = new TextDecoder().decode(headerView.buffer.slice(0, 4));
  const waveCheck = new TextDecoder().decode(headerView.buffer.slice(8, 12));
  
  return riffCheck === 'RIFF' && waveCheck === 'WAVE';
}

/**
 * Handle streaming audio data to Azure Speech Service for transcription
 */
export async function POST(request: NextRequest) {
  const requestId = randomUUID();
  
  try {
    console.log('📤 [TRACE] /api/voice/stream POST request received', {
      requestId,
      timestamp: new Date().toISOString(),
      headers: Object.fromEntries(request.headers.entries()),
      url: request.url
    });
    
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    
    if (!audioFile) {
      console.error('❌ No audio file provided');
      return NextResponse.json(
        { 
          success: true,
          text: '',
          confidence: 0,
          error: 'No audio file provided'
        }
      );
    }

    console.log('📁 Audio file details:', {
      name: audioFile.name,
      size: audioFile.size,
      type: audioFile.type
    });

    // Check if we have valid audio data
    if (audioFile.size === 0) {
      console.error('❌ Empty audio file received');
      return NextResponse.json(
        { 
          success: true,
          text: '',
          confidence: 0,
          error: 'Empty audio file received'
        }
      );
    }

    // Initialize Azure Speech Service if needed
    if (!azureSpeechService.isReady()) {
      const speechInitialized = await azureSpeechService.initialize();
      if (!speechInitialized) {
        return NextResponse.json(
          { 
            success: true,
            text: '',
            confidence: 0,
            error: 'Failed to initialize Azure Speech service'
          }
        );
      }
    }

    // Validate audio format
    const audioMimeType = audioFile.type.toLowerCase();
    const isSupportedFormat = SUPPORTED_AUDIO_TYPES.some(type => 
      audioMimeType.startsWith(type.toLowerCase()) || audioMimeType === type.toLowerCase()
    );
    
    if (!isSupportedFormat) {
      console.error('❌ Unsupported audio format:', audioMimeType);
      return NextResponse.json(
        { 
          success: true,
          text: '',
          confidence: 0, 
          error: `Unsupported audio format: ${audioMimeType}. Supported formats: ${SUPPORTED_AUDIO_TYPES.join(', ')}`,
          details: { receivedType: audioMimeType, supportedTypes: SUPPORTED_AUDIO_TYPES }
        }
      );
    }

    // Convert File to ArrayBuffer
    let audioBuffer = await audioFile.arrayBuffer();
    console.log('📊 Original audio buffer details:', {
      byteLength: audioBuffer.byteLength,
      mimeType: audioMimeType,
      firstFewBytes: Array.from(new Uint8Array(audioBuffer.slice(0, 16))).map(b => b.toString(16).padStart(2, '0')).join(' ')
    });
    
    // Check if we need to transcode
    const isWAV = isValidWAV(audioBuffer);
    
    if (!isWAV) {
      console.log('🔄 Non-WAV format detected, transcoding to WAV...', { originalFormat: audioMimeType });
      
      try {
        audioBuffer = await transcodeToWAV(audioBuffer, audioMimeType);
        console.log('✅ Transcoding completed successfully');
      } catch (transcodeError) {
        console.error('❌ Transcoding failed:', transcodeError);
        return NextResponse.json(
          { 
            success: true,
            text: '',
            confidence: 0, 
            error: 'Failed to transcode audio to WAV format',
            details: transcodeError instanceof Error ? transcodeError.message : 'Unknown transcoding error'
          }
        );
      }
    } else {
      console.log('✅ Valid WAV format detected, no transcoding needed');
    }
    
    // Extract WAV format details (after potential transcoding)
    const headerView = new DataView(audioBuffer);
    const audioFormat = headerView.getUint16(20, true);
    const numChannels = headerView.getUint16(22, true);
    const sampleRate = headerView.getUint32(24, true);
    const bitsPerSample = headerView.getUint16(34, true);
    
    console.log('🎵 WAV file details:', {
      audioFormat,
      numChannels,
      sampleRate,
      bitsPerSample,
      duration: (audioBuffer.byteLength - 44) / (sampleRate * numChannels * (bitsPerSample / 8))
    });
    
    // Create audio config with explicit format specification
    let audioConfig;
    
    // Process audio with the new helper
    try {
      console.log('🎙️ [TRACE] Sending audio to Azure Speech Service', {
        requestId,
        audioSize: audioBuffer.byteLength,
        timestamp: new Date().toISOString()
      });
      
      const recognitionResult = await azureSpeechService.processAudioWithAzureSpeech(audioBuffer);
      
      if (recognitionResult) {
        console.log('✅ [TRACE] Speech processed successfully', {
          requestId,
          text: recognitionResult.text,
          confidence: recognitionResult.confidence,
          timestamp: new Date().toISOString()
        });
        
        return NextResponse.json({
          success: true,
          text: recognitionResult.text,
          confidence: recognitionResult.confidence
        });
      } else {
        console.log('⚠️ [TRACE] No speech recognized, returning empty text', {
          requestId,
          audioSize: audioBuffer.byteLength,
          timestamp: new Date().toISOString()
        });
        
        // Always return success with empty text if no speech detected
        // Surface error separately for monitoring
        return NextResponse.json({
          success: true,
          text: '',
          confidence: 0,
          warning: 'No speech recognized in audio',
          requestId
        });
      }
    } catch (error) {
      console.error('❌ [TRACE] Error processing audio', {
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      });
      
      // Return success with empty text and surface error separately
      return NextResponse.json({
        success: true,
        text: '',
        confidence: 0,
        error: 'Error processing audio',
        errorDetails: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
    }

  } catch (error) {
    console.error('❌ Error in voice streaming API:', error);
    return NextResponse.json(
      { 
        success: true,
        text: '',
        confidence: 0,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    );
  }
}

/**
 * Health check for the streaming endpoint
 */
export async function GET() {
  try {
    const secrets = await fetchAzureSecrets();
    const isConfigured = !!(secrets.speechKey && secrets.speechEndpoint);
    
    return NextResponse.json({
      status: 'healthy',
      speechServiceConfigured: isConfigured,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { 
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
