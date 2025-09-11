/**
 * Audio processing utilities for voice interview system
 * Extracted from Agent.tsx to reduce redundancy and improve maintainability
 */

import { logger } from '../utils/logger';
import { AudioError, reportError } from '../utils/error-utils';

// Audio configuration constants
export const AUDIO_CONFIG = {
  SAMPLE_RATE: 16000,
  CHANNEL_COUNT: 1,
  RING_BUFFER_SIZE: 32,
  SILENCE_THRESHOLD_RMS: 0.01, // -40 dB ≈ 0.01 linear
  SILENCE_WINDOW_MS: 200,
  CHUNK_SIZE: 4096,
  RECORDING_TIMEOUT_MS: 8000
} as const;

/**
 * Get the best supported MIME type for MediaRecorder
 */
export const getSupportedMimeType = (): string | null => {
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
      logger.success(`Selected MIME type: ${mimeType}`);
      return mimeType;
    }
  }
  
  logger.warn('No preferred MIME types supported, using default');
  return null;
};

/**
 * Trim initial silence from audio chunks
 */
export const trimInitialSilence = (
  audioChunks: Float32Array[], 
  sampleRate: number
): { 
  trimmedChunks: Float32Array[]; 
  hasNonSilence: boolean; 
} => {
  const windowSamples = Math.floor(sampleRate * AUDIO_CONFIG.SILENCE_WINDOW_MS / 1000);
  
  // Concatenate all chunks for analysis
  const totalLength = audioChunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const combinedAudio = new Float32Array(totalLength);
  let offset = 0;
  
  for (const chunk of audioChunks) {
    combinedAudio.set(chunk, offset);
    offset += chunk.length;
  }
  
  let startIndex = 0;
  let hasNonSilence = false;
  
  // Find first non-silent window
  for (let i = 0; i <= combinedAudio.length - windowSamples; i += windowSamples / 4) {
    let windowRMS = 0;
    const actualWindowSize = Math.min(windowSamples, combinedAudio.length - i);
    
    for (let j = 0; j < actualWindowSize; j++) {
      windowRMS += combinedAudio[i + j] * combinedAudio[i + j];
    }
    windowRMS = Math.sqrt(windowRMS / actualWindowSize);

    if (windowRMS > AUDIO_CONFIG.SILENCE_THRESHOLD_RMS) {
      startIndex = i;
      hasNonSilence = true;
      logger.audio.process(`Non-silence detected at sample ${startIndex}, RMS: ${windowRMS.toFixed(4)}`);
      break;
    }
  }
  
  if (!hasNonSilence) {
    logger.warn('No speech detected in audio');
    return { trimmedChunks: [], hasNonSilence: false };
  }
  
  const trimmedAudio = combinedAudio.slice(startIndex);
  
  // Split back into chunks for consistent processing
  const trimmedChunks: Float32Array[] = [];
  for (let i = 0; i < trimmedAudio.length; i += AUDIO_CONFIG.CHUNK_SIZE) {
    const chunk = trimmedAudio.slice(i, i + AUDIO_CONFIG.CHUNK_SIZE);
    trimmedChunks.push(chunk);
  }
  
  logger.audio.process(`Silence trimmed - processed ${trimmedChunks.length} chunks`);
  return { trimmedChunks, hasNonSilence };
};

/**
 * Convert Float32Array chunks to WAV blob
 */
export const convertToWav = (audioChunks: Float32Array[], sampleRate: number): Blob => {
  try {
    const totalLength = audioChunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const combinedAudio = new Float32Array(totalLength);
    let offset = 0;
    
    for (const chunk of audioChunks) {
      combinedAudio.set(chunk, offset);
      offset += chunk.length;
    }

    // Convert float samples to 16-bit PCM
    const pcmData = new Int16Array(combinedAudio.length);
    for (let i = 0; i < combinedAudio.length; i++) {
      const sample = Math.max(-1, Math.min(1, combinedAudio[i]));
      pcmData[i] = sample * 32767;
    }

    // Create WAV header
    const wavHeader = createWavHeader(pcmData.length, sampleRate);
    const wavBlob = new Blob([wavHeader, pcmData], { type: 'audio/wav' });
    
    logger.audio.process(`WAV conversion complete - ${wavBlob.size} bytes`);
    return wavBlob;
  } catch (error) {
    throw new AudioError('WAV conversion failed', { error, chunksLength: audioChunks.length });
  }
};

/**
 * Create WAV file header
 */
const createWavHeader = (dataLength: number, sampleRate: number): ArrayBuffer => {
  const wavHeader = new ArrayBuffer(44);
  const view = new DataView(wavHeader);

  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataLength * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);                    // PCM format
  view.setUint16(22, 1, true);                    // mono
  view.setUint32(24, sampleRate, true);           // sample rate
  view.setUint32(28, sampleRate * 2, true);       // byte rate
  view.setUint16(32, 2, true);                    // block align
  view.setUint16(34, 16, true);                   // bits per sample
  writeString(36, 'data');
  view.setUint32(40, dataLength * 2, true);

  return wavHeader;
};

/**
 * Prepare audio for upload - combines trimming and WAV conversion
 */
export const prepareAudioForUpload = (
  audioChunks: Float32Array[], 
  sampleRate: number
): { blob: Blob; hasValidAudio: boolean } => {
  if (!audioChunks || audioChunks.length === 0) {
    logger.warn('No audio chunks provided for processing');
    return { blob: new Blob(), hasValidAudio: false };
  }

  try {
    const { trimmedChunks, hasNonSilence } = trimInitialSilence(audioChunks, sampleRate);
    
    if (!hasNonSilence || trimmedChunks.length === 0) {
      logger.warn('No valid speech detected in audio');
      return { blob: new Blob(), hasValidAudio: false };
    }

    const wavBlob = convertToWav(trimmedChunks, sampleRate);
    return { blob: wavBlob, hasValidAudio: true };
  } catch (error) {
    reportError(error, 'Audio preparation failed', { 
      chunksProvided: audioChunks.length,
      sampleRate 
    });
    return { blob: new Blob(), hasValidAudio: false };
  }
};

/**
 * Setup audio context with optimal settings
 */
export const createOptimizedAudioContext = async (): Promise<{
  context: AudioContext;
  source: MediaStreamAudioSourceNode;
  workletNode: AudioWorkletNode;
  cleanup: () => Promise<void>;
}> => {
  try {
    // Get microphone stream
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: false,
        sampleRate: AUDIO_CONFIG.SAMPLE_RATE,
        channelCount: AUDIO_CONFIG.CHANNEL_COUNT,
      }
    });

    // Create audio context
    const context = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: AUDIO_CONFIG.SAMPLE_RATE
    });

    // Load audio worklet
    await context.audioWorklet.addModule('/audio-processor.js');

    const source = context.createMediaStreamSource(stream);
    const workletNode = new AudioWorkletNode(context, 'audio-processor');
    
    source.connect(workletNode);

    const cleanup = async () => {
      logger.audio.process('Cleaning up audio resources');
      
      source.disconnect();
      workletNode.port.onmessage = null;
      
      if (context.state !== 'closed') {
        await context.close();
      }
      
      stream.getTracks().forEach(track => track.stop());
    };

    logger.success('Audio context setup complete');
    return { context, source, workletNode, cleanup };
  } catch (error) {
    throw new AudioError('Failed to setup audio context', { error });
  }
};

/**
 * Resume suspended audio context (for tab visibility changes)
 */
export const resumeAudioContext = async (context: AudioContext): Promise<void> => {
  if (context.state === 'suspended') {
    try {
      await context.resume();
      logger.success('AudioContext resumed');
    } catch (error) {
      throw new AudioError('Failed to resume AudioContext', { error });
    }
  }
};

/**
 * Dispose of audio resources safely
 */
export const disposeAudioResources = async (
  resources: {
    context?: AudioContext | null;
    stream?: MediaStream | null;
    workletNode?: AudioWorkletNode | null;
    source?: MediaStreamAudioSourceNode | null;
  }
): Promise<void> => {
  const { context, stream, workletNode, source } = resources;
  
  try {
    if (source) {
      source.disconnect();
    }
    
    if (workletNode) {
      workletNode.port.onmessage = null;
    }
    
    if (context && context.state !== 'closed') {
      await context.close();
    }
    
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    
    logger.success('Audio resources disposed');
  } catch (error) {
    reportError(error, 'Failed to dispose audio resources', resources);
  }
};
