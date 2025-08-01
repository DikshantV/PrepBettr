const { MicCapture } = require('../micCapture.js');

// Mock AudioContext and related APIs for testing
class MockAudioContext {
  constructor() {
    this.sampleRate = 48000;
    this.state = 'running';
    this.audioWorklet = {
      addModule: jest.fn().mockResolvedValue(undefined)
    };
  }
  
  createMediaStreamSource() {
    return {
      connect: jest.fn(),
      disconnect: jest.fn()
    };
  }
  
  resume() {
    return Promise.resolve();
  }
  
  close() {
    return Promise.resolve();
  }
}

class MockAudioWorkletNode {
  constructor(context, processorName) {
    this.port = {
      postMessage: jest.fn(),
      onmessage: null
    };
  }
  
  connect() {}
  disconnect() {}
}

class MockMediaStream {
  getTracks() {
    return [{ stop: jest.fn() }];
  }
}

// Mock navigator.mediaDevices
const mockGetUserMedia = jest.fn();
Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    getUserMedia: mockGetUserMedia
  },
  configurable: true
});

// Mock global constructors
global.AudioContext = MockAudioContext;
global.AudioWorkletNode = MockAudioWorkletNode;
global.URL = class MockURL {
  constructor(url, base) {
    this.href = url;
  }
};

describe('MicCapture', () => {
  let micCapture;
  
  beforeEach(() => {
    micCapture = new MicCapture();
    mockGetUserMedia.mockResolvedValue(new MockMediaStream());
  });
  
  afterEach(async () => {
    if (micCapture.capturing) {
      await micCapture.dispose();
    }
    jest.clearAllMocks();
  });
  
  describe('Properties', () => {
    test('should return correct sample rate', () => {
      expect(micCapture.sampleRate).toBe(16000);
    });
    
    test('should return correct frame size (100ms at 16kHz)', () => {
      expect(micCapture.frameSize).toBe(1600);
    });
  });
  
  describe('Offline Sine Wave Test', () => {
    test('should process sine wave without byte-order flip', async () => {
      // Create a mock shared buffer for testing
      const frameSize = 1600; // 100ms at 16kHz
      const bufferFrames = 10;
      const headerSize = 2;
      const bufferSize = headerSize + (frameSize * bufferFrames);
      const sharedBuffer = new SharedArrayBuffer(bufferSize * Int16Array.BYTES_PER_ELEMENT);
      const sharedBufferView = new Int16Array(sharedBuffer);
      
      // Initialize buffer indices
      Atomics.store(sharedBufferView, 0, 0); // writeIndex
      Atomics.store(sharedBufferView, 1, 0); // readIndex
      
      // Generate a sine wave at 440Hz (A4) for testing
      const sampleRate = 16000;
      const frequency = 440;
      const amplitude = 16000; // Use a significant amplitude for testing
      const testSamples = frameSize;
      
      // Generate sine wave samples
      const sineWave = new Int16Array(testSamples);
      for (let i = 0; i < testSamples; i++) {
        const t = i / sampleRate;
        const sample = Math.round(amplitude * Math.sin(2 * Math.PI * frequency * t));
        sineWave[i] = Math.max(-32768, Math.min(32767, sample));
      }
      
      // Simulate writing sine wave to shared buffer
      for (let i = 0; i < testSamples; i++) {
        const bufferIndex = headerSize + i;
        sharedBufferView[bufferIndex] = sineWave[i];
      }
      
      // Update write index to indicate data is available
      Atomics.store(sharedBufferView, 0, testSamples);
      
      // Mock the shared buffer in micCapture
      micCapture.sharedBufferView = sharedBufferView;
      micCapture.isCapturing = true;
      
      // Read one frame using the private readFrame method
      const frame = micCapture.readFrame();
      
      expect(frame).not.toBeNull();
      expect(frame.length).toBe(frameSize);
      
      // Verify that the data matches our sine wave (no byte-order flip)
      for (let i = 0; i < Math.min(testSamples, frame.length); i++) {
        expect(frame[i]).toBe(sineWave[i]);
      }
      
      // Test byte conversion manually (not using async iterator for now)
      const uint8Frame = new Uint8Array(frame.length * 2);
      for (let i = 0; i < frame.length; i++) {
        const sample = frame[i];
        uint8Frame[i * 2] = sample & 0xFF;         // Low byte
        uint8Frame[i * 2 + 1] = (sample >> 8) & 0xFF; // High byte
      }
      
      expect(uint8Frame).toBeInstanceOf(Uint8Array);
      expect(uint8Frame.length).toBe(frameSize * 2); // 2 bytes per sample
      
      // Verify byte order (little-endian)
      for (let i = 0; i < Math.min(10, frameSize); i++) { // Test first 10 samples
        const originalSample = sineWave[i];
        const lowByte = uint8Frame[i * 2];
        const highByte = uint8Frame[i * 2 + 1];
        const reconstructedSample = lowByte | (highByte << 8);
        
        // Handle signed 16-bit conversion
        const signedSample = reconstructedSample > 32767 ? reconstructedSample - 65536 : reconstructedSample;
        expect(signedSample).toBe(originalSample);
      }
    });
    
    test('should handle empty buffer gracefully', () => {
      // Mock empty shared buffer
      const frameSize = 1600;
      const bufferFrames = 10;
      const headerSize = 2;
      const bufferSize = headerSize + (frameSize * bufferFrames);
      const sharedBuffer = new SharedArrayBuffer(bufferSize * Int16Array.BYTES_PER_ELEMENT);
      const sharedBufferView = new Int16Array(sharedBuffer);
      
      // Initialize buffer indices (both at 0, indicating empty buffer)
      Atomics.store(sharedBufferView, 0, 0); // writeIndex
      Atomics.store(sharedBufferView, 1, 0); // readIndex
      
      micCapture.sharedBufferView = sharedBufferView;
      
      // Read frame from empty buffer
      const frame = micCapture.readFrame();
      expect(frame).toBeNull();
    });
  });
});
