var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function () { return this; }, i;
    function awaitReturn(f) { return function (v) { return Promise.resolve(v).then(f, reject); }; }
    function verb(n, f) { if (g[n]) { i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; if (f) i[n] = f(i[n]); } }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
export class MicCapture {
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
        var _a, _b, _c;
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
                const metaUrl = ((_a = globalThis.importMeta) === null || _a === void 0 ? void 0 : _a.url) || ((_c = (_b = globalThis.import) === null || _b === void 0 ? void 0 : _b.meta) === null || _c === void 0 ? void 0 : _c.url);
                if (metaUrl) {
                    workletUrl = new URL('./micProcessor.js', metaUrl);
                }
                else {
                    // Fallback for testing environments and other cases
                    workletUrl = { href: './micProcessor.js' };
                }
            }
            catch (_d) {
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
        }
        catch (error) {
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
    read() {
        return __asyncGenerator(this, arguments, function* read_1() {
            if (!this.sharedBufferView) {
                throw new Error('MicCapture not initialized. Call initialize() first.');
            }
            while (this.isCapturing) {
                const frame = yield __await(this.readFrame());
                if (frame) {
                    // Convert Int16Array to Uint8Array (little-endian byte order)
                    const uint8Frame = new Uint8Array(frame.length * 2);
                    for (let i = 0; i < frame.length; i++) {
                        const sample = frame[i];
                        uint8Frame[i * 2] = sample & 0xFF; // Low byte
                        uint8Frame[i * 2 + 1] = (sample >> 8) & 0xFF; // High byte
                    }
                    yield yield __await(uint8Frame);
                }
                else {
                    // No data available, wait a bit before trying again
                    yield __await(new Promise(resolve => setTimeout(resolve, 10)));
                }
            }
        });
    }
    /**
     * Read a single frame from the shared buffer
     */
    readFrame() {
        if (!this.sharedBufferView)
            return null;
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
