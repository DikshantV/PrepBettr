/**
 * Audio utility functions for voice processing
 */

/**
 * Trims initial silence from a Float32Array audio buffer
 * @param float32Array - The audio data as Float32Array
 * @param sampleRate - Sample rate of the audio (e.g., 16000)
 * @returns Trimmed Float32Array with silence removed from the beginning
 */
export const trimInitialSilence = (float32Array: Float32Array, sampleRate: number): Float32Array => {
    const thresholdRMS = 0.01; // -40 dB ≈ 0.01 linear
    const windowSamples = Math.floor(sampleRate * 0.2); // 200ms window
    
    if (float32Array.length === 0) {
        console.warn('Empty audio array provided to trimInitialSilence');
        return float32Array;
    }
    
    if (windowSamples > float32Array.length) {
        console.warn('Window size larger than audio length, returning original audio');
        return float32Array;
    }
    
    let startIndex = 0;
    
    // Scan through the audio with overlapping windows
    for (let i = 0; i <= float32Array.length - windowSamples; i += Math.floor(windowSamples / 4)) { // 25% overlap
        let windowRMS = 0;
        
        // Calculate RMS for the current window
        for (let j = 0; j < windowSamples && (i + j) < float32Array.length; j++) {
            windowRMS += float32Array[i + j] * float32Array[i + j];
        }
        windowRMS = Math.sqrt(windowRMS / windowSamples);

        // If RMS exceeds threshold, we found non-silence
        if (windowRMS > thresholdRMS) {
            startIndex = i;
            console.log(`🎤 Non-silence detected at sample ${startIndex}, RMS: ${windowRMS.toFixed(4)}`);
            break;
        }
    }

    console.log(`Silence trimmed. Starting at sample: ${startIndex} of ${float32Array.length}`);
    return float32Array.slice(startIndex);
};

/**
 * Trims initial silence from multiple Float32Array chunks
 * @param audioChunks - Array of Float32Array chunks
 * @param sampleRate - Sample rate of the audio (e.g., 16000)
 * @returns Array of trimmed Float32Array chunks
 */
export const trimInitialSilenceFromChunks = (audioChunks: Float32Array[], sampleRate: number): Float32Array[] => {
    if (audioChunks.length === 0) {
        console.warn('Empty audio chunks array provided to trimInitialSilenceFromChunks');
        return audioChunks;
    }
    
    // Concatenate all chunks for analysis
    const totalLength = audioChunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const combinedAudio = new Float32Array(totalLength);
    let offset = 0;
    
    for (const chunk of audioChunks) {
        combinedAudio.set(chunk, offset);
        offset += chunk.length;
    }
    
    // Trim the combined audio
    const trimmedAudio = trimInitialSilence(combinedAudio, sampleRate);
    
    // Split back into chunks for consistent processing
    const chunkSize = 4096;
    const trimmedChunks: Float32Array[] = [];
    
    for (let i = 0; i < trimmedAudio.length; i += chunkSize) {
        trimmedChunks.push(trimmedAudio.slice(i, i + chunkSize));
    }
    
    return trimmedChunks;
};

/**
 * Calculate RMS (Root Mean Square) value for an audio buffer
 * @param audioData - Float32Array audio data
 * @returns RMS value (0.0 to 1.0)
 */
export const calculateRMS = (audioData: Float32Array): number => {
    if (audioData.length === 0) return 0;
    
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
        sum += audioData[i] * audioData[i];
    }
    
    return Math.sqrt(sum / audioData.length);
};

/**
 * Convert RMS linear value to decibels
 * @param rms - RMS linear value (0.0 to 1.0)
 * @returns dB value
 */
export const rmsToDecibels = (rms: number): number => {
    if (rms <= 0) return -Infinity;
    return 20 * Math.log10(rms);
};

/**
 * Convert decibels to RMS linear value
 * @param dB - Decibel value
 * @returns RMS linear value (0.0 to 1.0)
 */
export const decibelsToRMS = (dB: number): number => {
    if (dB === -Infinity) return 0;
    return Math.pow(10, dB / 20);
};
