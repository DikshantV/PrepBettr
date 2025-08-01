import { MicCapture } from './micCapture';

/**
 * Example usage of the MicCapture class
 * This demonstrates how to capture microphone audio and process the frames
 */
export async function exampleMicrophoneCapture() {
  const micCapture = new MicCapture();
  
  try {
    // Initialize the microphone capture system
    await micCapture.initialize();
    console.log(`Initialized microphone capture:`);
    console.log(`- Sample rate: ${micCapture.sampleRate} Hz`);
    console.log(`- Frame size: ${micCapture.frameSize} samples (${micCapture.frameSize / micCapture.sampleRate * 1000}ms)`);
    
    // Start capturing audio
    await micCapture.startCapture();
    console.log('Started capturing audio...');
    
    let frameCount = 0;
    const maxFrames = 50; // Capture 50 frames (5 seconds at 100ms per frame)
    
    // Read frames using the async iterator
    for await (const audioFrame of micCapture.read()) {
      frameCount++;
      
      console.log(`Frame ${frameCount}: ${audioFrame.length} bytes`);
      
      // Here you could process the audioFrame (Uint8Array)
      // For example:
      // - Send to speech recognition service
      // - Store for playback
      // - Analyze audio levels
      // - Convert back to Int16Array for audio processing
      
      const samples = new Int16Array(audioFrame.buffer);
      const rms = calculateRMS(samples);
      console.log(`  RMS level: ${rms.toFixed(2)}`);
      
      if (frameCount >= maxFrames) {
        break;
      }
    }
    
    console.log(`Captured ${frameCount} frames`);
    
  } catch (error) {
    console.error('Error during microphone capture:', error);
  } finally {
    // Clean up resources
    await micCapture.dispose();
    console.log('Microphone capture disposed');
  }
}

/**
 * Calculate RMS (Root Mean Square) level of audio samples
 * This gives a measure of the audio signal's power/volume
 */
function calculateRMS(samples: Int16Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i];
  }
  return Math.sqrt(sum / samples.length);
}

// Example of how to use with manual frame processing
export async function exampleManualFrameProcessing() {
  const micCapture = new MicCapture();
  
  try {
    await micCapture.initialize();
    await micCapture.startCapture();
    
    // Manual frame reading (alternative to async iterator)
    const processingLoop = setInterval(() => {
      const frame = micCapture.readFrame();
      
      if (frame) {
        console.log(`Got frame with ${frame.length} samples`);
        
        // Convert to Uint8Array if needed for transmission
        const uint8Frame = new Uint8Array(frame.length * 2);
        for (let i = 0; i < frame.length; i++) {
          const sample = frame[i];
          uint8Frame[i * 2] = sample & 0xFF;
          uint8Frame[i * 2 + 1] = (sample >> 8) & 0xFF;
        }
        
        // Process uint8Frame...
      }
    }, 50); // Check for frames every 50ms
    
    // Stop after 5 seconds
    setTimeout(() => {
      clearInterval(processingLoop);
      micCapture.dispose();
    }, 5000);
    
  } catch (error) {
    console.error('Error:', error);
    await micCapture.dispose();
  }
}
