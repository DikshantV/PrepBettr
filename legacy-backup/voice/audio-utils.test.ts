import { 
  trimInitialSilence, 
  trimInitialSilenceFromChunks,
  calculateRMS, 
  rmsToDecibels, 
  decibelsToRMS 
} from './audio-utils';

describe('Audio Utilities', () => {
  const sampleRate = 16000; // 16kHz sample rate
  
  describe('trimInitialSilence', () => {
    it('should return original audio when array is empty', () => {
      const emptyArray = new Float32Array(0);
      const result = trimInitialSilence(emptyArray, sampleRate);
      expect(result).toEqual(emptyArray);
      expect(result.length).toBe(0);
    });

    it('should return original audio when window size is larger than audio length', () => {
      const shortArray = new Float32Array(100); // Very short audio
      const result = trimInitialSilence(shortArray, sampleRate);
      expect(result).toEqual(shortArray);
      expect(result.length).toBe(100);
    });

    it('should trim silence from the beginning of audio', () => {
      // Create audio with 0.5 seconds of silence, then non-silence
      const silenceSamples = Math.floor(sampleRate * 0.5); // 0.5 seconds
      const nonSilenceSamples = Math.floor(sampleRate * 0.5); // 0.5 seconds
      const totalSamples = silenceSamples + nonSilenceSamples;
      
      const audioData = new Float32Array(totalSamples);
      
      // Fill first half with silence (very low amplitude)
      for (let i = 0; i < silenceSamples; i++) {
        audioData[i] = Math.random() * 0.001; // Very quiet noise
      }
      
      // Fill second half with actual audio (higher amplitude)
      for (let i = silenceSamples; i < totalSamples; i++) {
        audioData[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.3; // 440Hz sine wave
      }
      
      const result = trimInitialSilence(audioData, sampleRate);
      
      // Should have trimmed most of the silence
      expect(result.length).toBeLessThan(audioData.length);
      expect(result.length).toBeGreaterThan(nonSilenceSamples * 0.9); // Allow some margin
    });

    it('should not trim audio that starts with non-silence', () => {
      const samples = Math.floor(sampleRate * 1); // 1 second
      const audioData = new Float32Array(samples);
      
      // Fill with non-silent audio from the start
      for (let i = 0; i < samples; i++) {
        audioData[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.3;
      }
      
      const result = trimInitialSilence(audioData, sampleRate);
      
      // Should return most of the original audio
      expect(result.length).toBeGreaterThan(samples * 0.95);
    });

    it('should handle all-silence audio', () => {
      const samples = Math.floor(sampleRate * 1); // 1 second
      const audioData = new Float32Array(samples);
      
      // Fill with silence
      for (let i = 0; i < samples; i++) {
        audioData[i] = Math.random() * 0.001; // Very quiet noise
      }
      
      const result = trimInitialSilence(audioData, sampleRate);
      
      // Should return original or nearly original since it's all silence
      expect(result.length).toBe(samples);
    });

    it('should detect speech after variable silence durations', () => {
      const testCases = [0.1, 0.3, 0.5, 1.0]; // Different silence durations in seconds
      
      testCases.forEach(silenceDuration => {
        const silenceSamples = Math.floor(sampleRate * silenceDuration);
        const speechSamples = Math.floor(sampleRate * 0.5);
        const totalSamples = silenceSamples + speechSamples;
        
        const audioData = new Float32Array(totalSamples);
        
        // Add silence
        for (let i = 0; i < silenceSamples; i++) {
          audioData[i] = 0;
        }
        
        // Add speech
        for (let i = silenceSamples; i < totalSamples; i++) {
          audioData[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.5;
        }
        
        const result = trimInitialSilence(audioData, sampleRate);
        
        // Should have trimmed the silence
        expect(result.length).toBeLessThanOrEqual(speechSamples + sampleRate * 0.2); // Allow window size margin
      });
    });
  });

  describe('trimInitialSilenceFromChunks', () => {
    it('should handle empty chunks array', () => {
      const emptyChunks: Float32Array[] = [];
      const result = trimInitialSilenceFromChunks(emptyChunks, sampleRate);
      expect(result).toEqual(emptyChunks);
      expect(result.length).toBe(0);
    });

    it('should trim silence from multiple chunks', () => {
      const chunkSize = 4096;
      const chunks: Float32Array[] = [];
      
      // Create 3 chunks: first is silence, second is partial silence, third is speech
      const silenceChunk = new Float32Array(chunkSize);
      for (let i = 0; i < chunkSize; i++) {
        silenceChunk[i] = Math.random() * 0.001;
      }
      chunks.push(silenceChunk);
      
      const partialChunk = new Float32Array(chunkSize);
      for (let i = 0; i < chunkSize / 2; i++) {
        partialChunk[i] = Math.random() * 0.001;
      }
      for (let i = chunkSize / 2; i < chunkSize; i++) {
        partialChunk[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.3;
      }
      chunks.push(partialChunk);
      
      const speechChunk = new Float32Array(chunkSize);
      for (let i = 0; i < chunkSize; i++) {
        speechChunk[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.3;
      }
      chunks.push(speechChunk);
      
      const result = trimInitialSilenceFromChunks(chunks, sampleRate);
      
      // Should have fewer total samples after trimming
      const originalTotal = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const trimmedTotal = result.reduce((sum, chunk) => sum + chunk.length, 0);
      expect(trimmedTotal).toBeLessThan(originalTotal);
    });

    it('should maintain chunk structure after trimming', () => {
      const chunks: Float32Array[] = [];
      const chunkSize = 4096;
      
      // Create chunks with speech from the start
      for (let i = 0; i < 3; i++) {
        const chunk = new Float32Array(chunkSize);
        for (let j = 0; j < chunkSize; j++) {
          chunk[j] = Math.sin(2 * Math.PI * 440 * (i * chunkSize + j) / sampleRate) * 0.3;
        }
        chunks.push(chunk);
      }
      
      const result = trimInitialSilenceFromChunks(chunks, sampleRate);
      
      // Should return chunks (may be re-chunked)
      expect(result.length).toBeGreaterThan(0);
      result.forEach(chunk => {
        expect(chunk).toBeInstanceOf(Float32Array);
        expect(chunk.length).toBeGreaterThan(0);
      });
    });
  });

  describe('calculateRMS', () => {
    it('should return 0 for empty array', () => {
      const emptyArray = new Float32Array(0);
      expect(calculateRMS(emptyArray)).toBe(0);
    });

    it('should return 0 for silent audio', () => {
      const silentAudio = new Float32Array(1000);
      expect(calculateRMS(silentAudio)).toBe(0);
    });

    it('should calculate correct RMS for sine wave', () => {
      const samples = 1000;
      const audioData = new Float32Array(samples);
      const amplitude = 0.5;
      
      for (let i = 0; i < samples; i++) {
        audioData[i] = Math.sin(2 * Math.PI * i / 100) * amplitude;
      }
      
      const rms = calculateRMS(audioData);
      // RMS of sine wave should be approximately amplitude / sqrt(2)
      expect(rms).toBeCloseTo(amplitude / Math.sqrt(2), 2);
    });

    it('should calculate correct RMS for constant signal', () => {
      const audioData = new Float32Array(1000);
      const amplitude = 0.5;
      audioData.fill(amplitude);
      
      const rms = calculateRMS(audioData);
      expect(rms).toBe(amplitude);
    });
  });

  describe('rmsToDecibels', () => {
    it('should return -Infinity for 0 RMS', () => {
      expect(rmsToDecibels(0)).toBe(-Infinity);
    });

    it('should return 0 dB for RMS of 1', () => {
      expect(rmsToDecibels(1)).toBeCloseTo(0, 5);
    });

    it('should return negative dB for RMS less than 1', () => {
      expect(rmsToDecibels(0.5)).toBeCloseTo(-6.02, 1); // -6dB is half amplitude
      expect(rmsToDecibels(0.1)).toBeCloseTo(-20, 1);
      expect(rmsToDecibels(0.01)).toBeCloseTo(-40, 1);
    });

    it('should return positive dB for RMS greater than 1', () => {
      expect(rmsToDecibels(2)).toBeCloseTo(6.02, 1);
      expect(rmsToDecibels(10)).toBeCloseTo(20, 1);
    });
  });

  describe('decibelsToRMS', () => {
    it('should return 0 for -Infinity dB', () => {
      expect(decibelsToRMS(-Infinity)).toBe(0);
    });

    it('should return 1 for 0 dB', () => {
      expect(decibelsToRMS(0)).toBeCloseTo(1, 5);
    });

    it('should convert negative dB correctly', () => {
      expect(decibelsToRMS(-6)).toBeCloseTo(0.501, 2);
      expect(decibelsToRMS(-20)).toBeCloseTo(0.1, 2);
      expect(decibelsToRMS(-40)).toBeCloseTo(0.01, 3);
    });

    it('should convert positive dB correctly', () => {
      expect(decibelsToRMS(6)).toBeCloseTo(1.995, 2);
      expect(decibelsToRMS(20)).toBeCloseTo(10, 1);
    });
  });

  describe('RMS and dB conversion round-trip', () => {
    it('should maintain values through round-trip conversion', () => {
      const testValues = [0.001, 0.01, 0.1, 0.5, 1, 2, 10];
      
      testValues.forEach(originalRMS => {
        const dB = rmsToDecibels(originalRMS);
        const convertedRMS = decibelsToRMS(dB);
        expect(convertedRMS).toBeCloseTo(originalRMS, 5);
      });
    });
  });
});
