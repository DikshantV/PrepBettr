class MicProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    
    // Downsampling parameters
    this.inputSampleRate = 48000;
    this.outputSampleRate = 16000;
    this.downsampleRatio = this.inputSampleRate / this.outputSampleRate; // 3.0
    
    // Buffer for accumulating samples
    this.inputBuffer = [];
    this.sampleIndex = 0;
    
    // Frame size for 100ms at 16kHz = 1600 samples
    this.frameSize = Math.floor(this.outputSampleRate * 0.1); // 1600 samples
    this.outputBuffer = new Int16Array(this.frameSize);
    this.outputIndex = 0;
    
    // SharedArrayBuffer for communication with main thread
    this.sharedBuffer = null;
    this.sharedBufferView = null;
    this.writeIndex = 0;
    
    // Listen for messages from main thread
    this.port.onmessage = (event) => {
      if (event.data.type === 'setSharedBuffer') {
        this.sharedBuffer = event.data.buffer;
        this.sharedBufferView = new Int16Array(this.sharedBuffer);
      }
    };
  }
  
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    
    if (!input || !input[0] || !this.sharedBufferView) {
      return true;
    }
    
    const inputChannel = input[0];
    
    // Process each sample
    for (let i = 0; i < inputChannel.length; i++) {
      this.inputBuffer.push(inputChannel[i]);
      
      // Check if we have enough samples for downsampling
      while (this.inputBuffer.length >= Math.floor(this.sampleIndex + this.downsampleRatio)) {
        // Linear interpolation for downsampling
        const exactIndex = this.sampleIndex;
        const lowerIndex = Math.floor(exactIndex);
        const upperIndex = Math.min(lowerIndex + 1, this.inputBuffer.length - 1);
        const fraction = exactIndex - lowerIndex;
        
        const interpolatedSample = this.inputBuffer[lowerIndex] * (1 - fraction) + 
                                 this.inputBuffer[upperIndex] * fraction;
        
        // Convert to 16-bit PCM
        const pcmSample = Math.max(-32768, Math.min(32767, Math.round(interpolatedSample * 32767)));
        
        this.outputBuffer[this.outputIndex] = pcmSample;
        this.outputIndex++;
        
        // If we have a complete frame, write to shared buffer
        if (this.outputIndex >= this.frameSize) {
          this.writeFrameToSharedBuffer();
          this.outputIndex = 0;
        }
        
        this.sampleIndex += this.downsampleRatio;
      }
      
      // Remove processed samples from input buffer to prevent memory leak
      if (this.inputBuffer.length > this.downsampleRatio * 2) {
        const samplesToRemove = Math.floor(this.sampleIndex);
        this.inputBuffer.splice(0, samplesToRemove);
        this.sampleIndex -= samplesToRemove;
      }
    }
    
    return true;
  }
  
  writeFrameToSharedBuffer() {
    if (!this.sharedBufferView) return;
    
    // SharedBuffer layout: [writeIndex, readIndex, ...data]
    const headerSize = 2;
    const bufferSize = this.sharedBufferView.length - headerSize;
    const currentWriteIndex = Atomics.load(this.sharedBufferView, 0);
    const readIndex = Atomics.load(this.sharedBufferView, 1);
    
    // Check if buffer has space
    const nextWriteIndex = (currentWriteIndex + this.frameSize) % bufferSize;
    if (nextWriteIndex === readIndex) {
      // Buffer full, skip this frame
      return;
    }
    
    // Write frame to shared buffer
    for (let i = 0; i < this.frameSize; i++) {
      const bufferIndex = headerSize + ((currentWriteIndex + i) % bufferSize);
      this.sharedBufferView[bufferIndex] = this.outputBuffer[i];
    }
    
    // Update write index atomically
    Atomics.store(this.sharedBufferView, 0, nextWriteIndex);
    
    // Notify main thread
    this.port.postMessage({ type: 'frameReady', frameSize: this.frameSize });
  }
};

registerProcessor('mic-processor', MicProcessor);

// For unit tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MicProcessor };
}
