class MicCapture {
  constructor() {
    this.audioContext = null;
    this.mediaStream = null;
    this.sourceNode = null;
    this.workletNode = null;
    this.sharedBuffer = null;
    this.sharedBufferView = null;
    this.isCapturing = false;
    
    // Buffer parameters
    this.SAMPLE_RATE = 16000;
    this.FRAME_SIZE = Math.floor(this.SAMPLE_RATE * 0.1); // 100ms = 1600 samples
    this.BUFFER_FRAMES = 10; // Buffer for 1 second
    this.HEADER_SIZE = 2; // writeIndex, readIndex
  }
  
  /**
   * Initialize the microphone capture system
   */
  async initialize() {
    try {
      // Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 48000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      // Create AudioContext
      this.audioContext = new AudioContext({ sampleRate: 48000 });
      
      // Load the audio worklet
      let workletUrl;
      try {
        // Try to use import.meta.url if available (ES modules)
        const metaUrl = globalThis.importMeta?.url || globalThis.import?.meta?.url;
        if (metaUrl) {
          workletUrl = new URL('./micProcessor.js', metaUrl);
        } else {
          // Fallback for testing environments and other cases
          workletUrl = { href: './micProcessor.js' };
        }
      } catch {
        // Fallback for any errors
        workletUrl = { href: './micProcessor.js' };
      }
      await this.audioContext.audioWorklet.addModule(workletUrl.href);
      
      // Create shared buffer for communication
      const bufferSize = this.HEADER_SIZE + (this.FRAME_SIZE * this.BUFFER_FRAMES);
      this.sharedBuffer = new SharedArrayBuffer(bufferSize * Int16Array.BYTES_PER_ELEMENT);
      this.sharedBufferView = new Int16Array(this.sharedBuffer);
      
      // Initialize buffer indices
      Atomics.store(this.sharedBufferView, 0, 0); // writeIndex
      Atomics.store(this.sharedBufferView, 1, 0); // readIndex
      
      // Create audio nodes
      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.workletNode = new AudioWorkletNode(this.audioContext, 'mic-processor');
      
      // Send shared buffer to worklet
      this.workletNode.port.postMessage({
        type: 'setSharedBuffer',
        buffer: this.sharedBuffer
      });
      
      // Connect the audio graph
      this.sourceNode.connect(this.workletNode);
      
    } catch (error) {
      throw new Error(`Failed to initialize microphone capture: ${error}`);
    }
  }
  
  /**
   * Start capturing audio
   */
  async startCapture() {
    if (!this.audioContext || !this.workletNode) {
      throw new Error('MicCapture not initialized. Call initialize() first.');
    }
    
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    
    this.isCapturing = true;
  }
  
  /**
   * Stop capturing audio
   */
  stopCapture() {
    this.isCapturing = false;
  }
  
  /**
   * Async iterator that yields Uint8Array frames of ≤100ms audio data
   */
  async *read() {
    if (!this.sharedBufferView) {
      throw new Error('MicCapture not initialized. Call initialize() first.');
    }
    
    while (this.isCapturing) {
      const frame = this.readFrame();
      if (frame) {
        // Convert Int16Array to Uint8Array (little-endian byte order)
        const uint8Frame = new Uint8Array(frame.length * 2);
        for (let i = 0; i < frame.length; i++) {
          const sample = frame[i];
          uint8Frame[i * 2] = sample & 0xFF;         // Low byte
          uint8Frame[i * 2 + 1] = (sample >> 8) & 0xFF; // High byte
        }
        yield uint8Frame;
      } else {
        // No data available, wait a bit before trying again
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
  }
  
  /**
   * Read a single frame from the shared buffer
   */
  readFrame() {
    if (!this.sharedBufferView) return null;
    
    const writeIndex = Atomics.load(this.sharedBufferView, 0);
    const readIndex = Atomics.load(this.sharedBufferView, 1);
    
    // Check if data is available
    if (readIndex === writeIndex) {
      return null; // No data available
    }
    
    const bufferSize = this.sharedBufferView.length - this.HEADER_SIZE;
    const frame = new Int16Array(this.FRAME_SIZE);
    
    // Read frame from shared buffer
    for (let i = 0; i < this.FRAME_SIZE; i++) {
      const bufferIndex = this.HEADER_SIZE + ((readIndex + i) % bufferSize);
      frame[i] = this.sharedBufferView[bufferIndex];
    }
    
    // Update read index atomically
    const nextReadIndex = (readIndex + this.FRAME_SIZE) % bufferSize;
    Atomics.store(this.sharedBufferView, 1, nextReadIndex);
    
    return frame;
  }
  
  /**
   * Cleanup resources
   */
  async dispose() {
    this.stopCapture();
    
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }
    
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    
    this.sharedBuffer = null;
    this.sharedBufferView = null;
  }
  
  /**
   * Get the current capture status
   */
  get capturing() {
    return this.isCapturing;
  }
  
  /**
   * Get the sample rate
   */
  get sampleRate() {
    return this.SAMPLE_RATE;
  }
  
  /**
   * Get the frame size in samples
   */
  get frameSize() {
    return this.FRAME_SIZE;
  }
}

// Export for both CommonJS and ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MicCapture };
} else if (typeof exports !== 'undefined') {
  exports.MicCapture = MicCapture;
}
