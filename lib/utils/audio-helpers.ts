/**
 * Audio utility helper functions for voice conversation system
 */

/**
 * Play audio from byte array data
 * @param bytes - Audio data as number array or Uint8Array
 * @param mimeType - MIME type of the audio (default: 'audio/wav')
 * @returns Promise that resolves when audio finishes playing
 */
export async function playAudioBuffer(
  bytes: number[] | Uint8Array,
  mimeType: string = 'audio/wav'
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // Convert to Uint8Array if needed
      const audioArray = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      
      // Create blob from audio data
      const audioBlob = new Blob([audioArray], { type: mimeType });
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Create and configure audio element
      const audio = new Audio(audioUrl);
      
      // Set up event listeners
      audio.onended = () => {
        console.log('🔊 Audio playback completed');
        URL.revokeObjectURL(audioUrl);
        resolve();
      };
      
      audio.onerror = (error) => {
        console.error('❌ Audio playback error:', error);
        URL.revokeObjectURL(audioUrl);
        reject(new Error('Audio playback failed'));
      };
      
      // Start playback
      audio.play().catch((error) => {
        console.error('❌ Failed to start audio playback:', error);
        URL.revokeObjectURL(audioUrl);
        reject(error);
      });
    } catch (error) {
      console.error('❌ Error creating audio from buffer:', error);
      reject(error);
    }
  });
}

/**
 * Create an audio blob from byte array
 * @param bytes - Audio data as number array or Uint8Array
 * @param mimeType - MIME type of the audio (default: 'audio/wav')
 * @returns Audio blob
 */
export function createAudioBlob(
  bytes: number[] | Uint8Array,
  mimeType: string = 'audio/wav'
): Blob {
  const audioArray = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return new Blob([audioArray], { type: mimeType });
}

/**
 * Play audio from blob with promise support
 * @param audioBlob - Audio blob to play
 * @returns Promise that resolves when audio finishes playing
 */
export async function playAudioBlob(audioBlob: Blob): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      audio.onended = () => {
        console.log('🔊 Audio blob playback completed');
        URL.revokeObjectURL(audioUrl);
        resolve();
      };
      
      audio.onerror = (error) => {
        console.error('❌ Audio blob playback error:', error);
        URL.revokeObjectURL(audioUrl);
        reject(new Error('Audio blob playback failed'));
      };
      
      audio.play().catch((error) => {
        console.error('❌ Failed to start audio blob playback:', error);
        URL.revokeObjectURL(audioUrl);
        reject(error);
      });
    } catch (error) {
      console.error('❌ Error playing audio blob:', error);
      reject(error);
    }
  });
}

/**
 * Validate audio buffer data
 * @param bytes - Audio data to validate
 * @returns Whether the audio data is valid
 */
export function validateAudioBuffer(bytes: number[] | Uint8Array | null | undefined): boolean {
  if (!bytes) return false;
  if (Array.isArray(bytes)) return bytes.length > 0;
  if (bytes instanceof Uint8Array) return bytes.length > 0;
  return false;
}

/**
 * Convert audio buffer to different formats
 * @param bytes - Source audio data
 * @param fromMimeType - Source MIME type
 * @param toMimeType - Target MIME type
 * @returns Promise that resolves with converted audio buffer
 */
export async function convertAudioBuffer(
  bytes: number[] | Uint8Array,
  fromMimeType: string,
  toMimeType: string
): Promise<Uint8Array> {
  // For now, return as-is since conversion would require audio processing libraries
  // This is a placeholder for future audio format conversion functionality
  console.warn(`Audio conversion from ${fromMimeType} to ${toMimeType} not implemented yet`);
  return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
}

/**
 * Get audio buffer duration (if possible to determine from header)
 * @param bytes - Audio data
 * @param mimeType - MIME type of the audio
 * @returns Duration in seconds, or null if cannot be determined
 */
export function getAudioBufferDuration(
  bytes: number[] | Uint8Array,
  mimeType: string = 'audio/wav'
): number | null {
  try {
    const audioArray = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    
    if (mimeType === 'audio/wav' && audioArray.length >= 44) {
      // Parse WAV header for duration
      const view = new DataView(audioArray.buffer);
      
      // Check for RIFF header
      const riffHeader = String.fromCharCode(...audioArray.slice(0, 4));
      if (riffHeader !== 'RIFF') return null;
      
      // Get sample rate (offset 24, 4 bytes, little endian)
      const sampleRate = view.getUint32(24, true);
      
      // Get data chunk size (we need to find the data chunk)
      // This is a simplified version - real WAV parsing is more complex
      const dataSize = audioArray.length - 44; // Assume standard 44-byte header
      const duration = dataSize / (sampleRate * 2); // Assume 16-bit mono
      
      return duration;
    }
    
    return null;
  } catch (error) {
    console.error('❌ Error getting audio buffer duration:', error);
    return null;
  }
}

/**
 * Preload audio buffer for faster playback
 * @param bytes - Audio data
 * @param mimeType - MIME type of the audio
 * @returns Audio element ready for playback
 */
export function preloadAudioBuffer(
  bytes: number[] | Uint8Array,
  mimeType: string = 'audio/wav'
): HTMLAudioElement {
  const audioArray = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const audioBlob = new Blob([audioArray], { type: mimeType });
  const audioUrl = URL.createObjectURL(audioBlob);
  
  const audio = new Audio(audioUrl);
  audio.preload = 'auto';
  
  // Store cleanup function on the audio element
  (audio as any).__cleanup = () => URL.revokeObjectURL(audioUrl);
  
  return audio;
}

/**
 * Cleanup preloaded audio element
 * @param audio - Audio element to cleanup
 */
export function cleanupPreloadedAudio(audio: HTMLAudioElement): void {
  if ((audio as any).__cleanup) {
    (audio as any).__cleanup();
    delete (audio as any).__cleanup;
  }
}
