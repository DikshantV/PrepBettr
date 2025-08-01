import { MicCapture } from '../micCapture';

// Mock AudioContext and related APIs for testing
class MockAudioContext {
  sampleRate = 48000;
  state = 'running';
  
  audioWorklet = {
    addModule: jest.fn().mockResolvedValue(undefined)
  };
  
  createMediaStreamSource = jest.fn().mockReturnValue({
    connect: jest.fn(),
    disconnect: jest.fn()
  });
  
  resume = jest.fn().mockResolvedValue(undefined);
  close = jest.fn().mockResolvedValue(undefined);
}

class MockAudioWorkletNode {
  port = {
    postMessage: jest.fn(),
    onmessage: null
  };
  
  connect = jest.fn();
  disconnect = jest.fn();
  
  constructor(context, processorName) {}
}

class MockMediaStream {
  getTracks = jest.fn().mockReturnValue([
    { stop: jest.fn() }
  ]);
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
(global as any).AudioContext = MockAudioContext;
(global as any).AudioWorkletNode = MockAudioWorkletNode;
(global as any).URL = class {
  href: string;
  constructor(url: string, base?: string) {
    this.href = url;
  }
};

describe('MicCapture', () => {
  let micCapture: MicCapture;
  
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
  
  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      await expect(micCapture.initialize()).resolves.not.toThrow();
      expect(mockGetUserMedia).toHaveBeenCalledWith({
        audio: {
          sampleRate: 48000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
    });
    
    test('should throw error if initialization fails', async () => {
      mockGetUserMedia.mockRejectedValue(new Error('Permission denied'));
      await expect(micCapture.initialize()).rejects.toThrow('Failed to initialize microphone capture');
    });
  });
  
  describe('Capture Control', () => {
    beforeEach(async () => {
      await micCapture.initialize();
    });
    
    test('should start capture successfully', async () => {
      await expect(micCapture.startCapture()).resolves.not.toThrow();
      expect(micCapture.capturing).toBe(true);
    });
    
    test('should stop capture successfully', async () => {
      await micCapture.startCapture();
      micCapture.stopCapture();
      expect(micCapture.capturing).toBe(false);
    });
    
    test('should throw error when starting capture without initialization', async () => {
      const uninitializedCapture = new MicCapture();
      await expect(uninitializedCapture.startCapture()).rejects.toThrow('MicCapture not initialized');
    });
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
      (micCapture as any).sharedBufferView = sharedBufferView;
      (micCapture as any).isCapturing = true;
      
      // Read one frame using the private readFrame method
      const frame = (micCapture as any).readFrame();
      
      expect(frame).not.toBeNull();
      expect(frame.length).toBe(frameSize);
      
      // Verify that the data matches our sine wave (no byte-order flip)
      for (let i = 0; i < Math.min(testSamples, frame.length); i++) {
        expect(frame[i]).toBe(sineWave[i]);
      }
      
      // Test byte conversion to Uint8Array
      micCapture.stopCapture();
      (micCapture as any).isCapturing = true;
      
      // Get one frame from the async iterator
      const iterator = micCapture.read();
      const result = await iterator.next();
      
      expect(result.done).toBe(false);
      expect(result.value).toBeInstanceOf(Uint8Array);
      expect(result.value!.length).toBe(frameSize * 2); // 2 bytes per sample
      
      // Verify byte order (little-endian)
      const uint8Frame = result.value!;
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
    
    test('should handle empty buffer gracefully', async () => {
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
      
      (micCapture as any).sharedBufferView = sharedBufferView;
      
      // Read frame from empty buffer
      const frame = (micCapture as any).readFrame();
      expect(frame).toBeNull();
    });
  });
  
  describe('Resource Cleanup', () => {
    test('should dispose resources properly', async () => {
      await micCapture.initialize();
      await micCapture.startCapture();
      
      await expect(micCapture.dispose()).resolves.not.toThrow();
      expect(micCapture.capturing).toBe(false);
    });
  });
