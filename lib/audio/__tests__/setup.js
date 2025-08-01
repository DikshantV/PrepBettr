// Setup for audio tests

// Mock SharedArrayBuffer if not available
if (typeof SharedArrayBuffer === 'undefined') {
  global.SharedArrayBuffer = ArrayBuffer;
}

// Mock Atomics if not available  
if (typeof Atomics === 'undefined') {
  global.Atomics = {
    store: function(buffer, index, value) {
      buffer[index] = value;
    },
    load: function(buffer, index) {
      return buffer[index];
    }
  };
}

// Enhanced URL mock for import.meta.url scenarios
global.URL = class MockURL {
  constructor(url, base) {
    if (base) {
      // Handle relative URLs - for tests just return the url
      this.href = url;
    } else {
      this.href = url;
    }
  }
};

// Mock import.meta if needed
if (typeof global.importMeta === 'undefined') {
  global.importMeta = {
    url: 'file:///mock/test/path'
  };
}

// Mock AudioWorkletProcessor
global.AudioWorkletProcessor = class MockAudioWorkletProcessor {
  constructor() {
    this.port = {
      postMessage: jest.fn(),
      onmessage: null
    };
  }
};

// Mock registerProcessor
global.registerProcessor = jest.fn();
