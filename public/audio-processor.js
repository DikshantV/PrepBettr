class AudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.bufferSize = 4096;
        this.buffer = new Float32Array(this.bufferSize);
        this.bufferIndex = 0;
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        
        if (input.length > 0) {
            const inputChannel = input[0];
            
            // Calculate RMS for current input chunk
            let rmsSum = 0;
            for (let i = 0; i < inputChannel.length; i++) {
                this.buffer[this.bufferIndex] = inputChannel[i];
                rmsSum += inputChannel[i] * inputChannel[i];
                this.bufferIndex++;
                
                // When buffer is full, send it to main thread
                if (this.bufferIndex >= this.bufferSize) {
                    // Create a copy of the buffer to send
                    const audioData = new Float32Array(this.buffer);
                    this.port.postMessage({
                        type: 'audiodata',
                        audioData: audioData
                    });
                    
                    // Reset buffer
                    this.bufferIndex = 0;
                }
            }
            
            // Calculate and send RMS level for this chunk
            const rms = Math.sqrt(rmsSum / inputChannel.length);
            this.port.postMessage({
                type: 'level',
                rms: rms
            });
        }
        
        // Keep the processor alive
        return true;
    }
}

registerProcessor('audio-processor', AudioProcessor);
