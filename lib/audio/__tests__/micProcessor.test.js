const { MicProcessor } = require('../micProcessor.js');

describe('MicProcessor', () => {
  let processor;
  let input;
  let output;
  let parameters;

  beforeEach(() => {
    processor = new MicProcessor();
    input = [[]]; // Empty input since we're simulating
    output = [];
    parameters = {};
  });

  test('should initialize without error', () => {
    expect(processor).toBeDefined();
  });

  test('should process input without error', () => {
    const result = processor.process(input, output, parameters);
    expect(result).toBe(true);
  });

  test('should not process if no shared buffer is set', () => {
    const result = processor.process(input, output, parameters);

    // Simulate an input
    input[0] = [0.5];
    const nextResult = processor.process(input, output, parameters);
    expect(nextResult).toBe(true);
    expect(processor.sharedBufferView).toBeNull();
  });

  test('should process and queue frames when shared buffer is set', () => {
    // Set up shared buffer
    const sharedBuffer = new SharedArrayBuffer(3200 * Int16Array.BYTES_PER_ELEMENT); // enough buffer for 2 frames & header
    const sharedBufferView = new Int16Array(sharedBuffer);
    processor.port.onmessage({ data: { type: 'setSharedBuffer', buffer: sharedBuffer } });

    // Simulate an input
    input[0] = [0.5];
    while (!processor.process(input, output, parameters)) {
      input[0].push(0.5); // Fill with samples
      if (processor.outputIndex >= processor.frameSize) break;
    }

    // Check if buffer is written
    const currentWriteIndex = Atomics.load(sharedBufferView, 0);
    expect(currentWriteIndex).toBeGreaterThan(0); // Ensure some data has been written
  });

  test('writeFrameToSharedBuffer should handle full buffers gracefully', () => {
    // Simulate a full buffer
    const sharedBuffer = new SharedArrayBuffer(3200 * Int16Array.BYTES_PER_ELEMENT);
    const sharedBufferView = new Int16Array(sharedBuffer);
    Atomics.store(sharedBufferView, 0, 1600 * 2); // Simulate full buffer
    Atomics.store(sharedBufferView, 1, 0); // Read index at start

    processor.port.onmessage({ data: { type: 'setSharedBuffer', buffer: sharedBuffer } });

    // Fill output buffer
    processor.outputBuffer.fill(1);
    processor.writeFrameToSharedBuffer();

    // Buffer should remain unchanged
    const currentWriteIndex = Atomics.load(sharedBufferView, 0);
    expect(currentWriteIndex).toBe(1600 * 2);
  });
});
