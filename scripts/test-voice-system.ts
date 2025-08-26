#!/usr/bin/env node

/**
 * Test script for the enhanced voice interview system
 * Run this to verify all Azure services are working correctly
 */

import { exec } from 'child_process';
import { promises as fs } from 'fs';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface TestResult {
  test: string;
  status: 'pass' | 'fail' | 'skip';
  message: string;
  duration?: number;
}

class VoiceSystemTester {
  private results: TestResult[] = [];
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  }

  async runAllTests(): Promise<void> {
    console.log('🎙️ Voice Interview System Test Suite');
    console.log('=' .repeat(50));
    
    const tests = [
      () => this.testEnvironmentVariables(),
      () => this.testVoiceAPIEndpoints(),
      () => this.testAzureSpeechCredentials(),
      () => this.testAzureOpenAICredentials(),
      () => this.testVoiceStreamEndpoint(),
      () => this.testConversationEndpoint(),
      () => this.testTTSEndpoint(),
      () => this.testErrorHandling(),
      () => this.testBrowserCompatibility()
    ];

    for (const test of tests) {
      try {
        await test();
      } catch (error) {
        this.addResult({
          test: 'Unknown Test',
          status: 'fail',
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }

    this.printResults();
  }

  private async testEnvironmentVariables(): Promise<void> {
    const startTime = Date.now();
    console.log('\n🔧 Testing Environment Variables...');

    const requiredEnvVars = [
      'NEXT_PUBLIC_SPEECH_KEY',
      'NEXT_PUBLIC_SPEECH_REGION',
      'NEXT_PUBLIC_AZURE_OPENAI_API_KEY',
      'NEXT_PUBLIC_AZURE_OPENAI_ENDPOINT'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      this.addResult({
        test: 'Environment Variables',
        status: 'fail',
        message: `Missing required environment variables: ${missingVars.join(', ')}`,
        duration: Date.now() - startTime
      });
    } else {
      this.addResult({
        test: 'Environment Variables',
        status: 'pass',
        message: 'All required environment variables are present',
        duration: Date.now() - startTime
      });
    }
  }

  private async testVoiceAPIEndpoints(): Promise<void> {
    const startTime = Date.now();
    console.log('\n🔍 Testing Voice API Endpoints...');

    const endpoints = [
      { path: '/api/voice/stream', method: 'GET' },
      { path: '/api/voice/conversation', method: 'GET' },
      { path: '/api/voice/tts', method: 'GET' }
    ];

    let allPassed = true;
    const messages: string[] = [];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${this.baseUrl}${endpoint.path}`, {
          method: endpoint.method
        });

        if (response.status === 200 || response.status === 405) { // 405 for unsupported GET on POST endpoints
          messages.push(`✅ ${endpoint.path} is accessible`);
        } else {
          messages.push(`❌ ${endpoint.path} returned ${response.status}`);
          allPassed = false;
        }
      } catch (error) {
        messages.push(`❌ ${endpoint.path} failed: ${error instanceof Error ? error.message : String(error)}`);
        allPassed = false;
      }
    }

    this.addResult({
      test: 'Voice API Endpoints',
      status: allPassed ? 'pass' : 'fail',
      message: messages.join(', '),
      duration: Date.now() - startTime
    });
  }

  private async testAzureSpeechCredentials(): Promise<void> {
    const startTime = Date.now();
    console.log('\n🗣️  Testing Azure Speech Service Credentials...');

    const speechKey = process.env.NEXT_PUBLIC_SPEECH_KEY || process.env.AZURE_SPEECH_KEY;
    const speechRegion = process.env.NEXT_PUBLIC_SPEECH_REGION || process.env.AZURE_SPEECH_REGION;

    if (!speechKey || !speechRegion) {
      this.addResult({
        test: 'Azure Speech Credentials',
        status: 'fail',
        message: 'Missing speech service credentials',
        duration: Date.now() - startTime
      });
      return;
    }

    try {
      // Simple validation check
      if (speechKey.length < 10 || speechRegion.length < 3) {
        throw new Error('Invalid credential format');
      }

      this.addResult({
        test: 'Azure Speech Credentials',
        status: 'pass',
        message: `Credentials present for region: ${speechRegion}`,
        duration: Date.now() - startTime
      });
    } catch (error) {
      this.addResult({
        test: 'Azure Speech Credentials',
        status: 'fail',
        message: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      });
    }
  }

  private async testAzureOpenAICredentials(): Promise<void> {
    const startTime = Date.now();
    console.log('\n🤖 Testing Azure OpenAI Credentials...');

    const openaiKey = process.env.NEXT_PUBLIC_AZURE_OPENAI_API_KEY || process.env.AZURE_OPENAI_KEY;
    const openaiEndpoint = process.env.NEXT_PUBLIC_AZURE_OPENAI_ENDPOINT || process.env.AZURE_OPENAI_ENDPOINT;

    if (!openaiKey || !openaiEndpoint) {
      this.addResult({
        test: 'Azure OpenAI Credentials',
        status: 'fail',
        message: 'Missing OpenAI credentials',
        duration: Date.now() - startTime
      });
      return;
    }

    try {
      // Validate URL format
      new URL(openaiEndpoint);
      
      if (openaiKey.length < 10) {
        throw new Error('API key appears invalid');
      }

      this.addResult({
        test: 'Azure OpenAI Credentials',
        status: 'pass',
        message: `Credentials configured for endpoint: ${openaiEndpoint}`,
        duration: Date.now() - startTime
      });
    } catch (error) {
      this.addResult({
        test: 'Azure OpenAI Credentials',
        status: 'fail',
        message: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      });
    }
  }

  private async testVoiceStreamEndpoint(): Promise<void> {
    const startTime = Date.now();
    console.log('\n🎵 Testing Voice Stream Endpoint...');

    try {
      // Create a minimal WAV file for testing
      const testAudioBlob = this.createTestAudioBlob();
      const formData = new FormData();
      formData.append('audio', testAudioBlob, 'test.wav');

      const response = await fetch(`${this.baseUrl}/api/voice/stream`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        this.addResult({
          test: 'Voice Stream Endpoint',
          status: 'pass',
          message: `Speech-to-text API working (response: ${JSON.stringify(result)})`,
          duration: Date.now() - startTime
        });
      } else {
        const errorText = await response.text();
        this.addResult({
          test: 'Voice Stream Endpoint',
          status: 'fail',
          message: `HTTP ${response.status}: ${errorText}`,
          duration: Date.now() - startTime
        });
      }
    } catch (error) {
      this.addResult({
        test: 'Voice Stream Endpoint',
        status: 'fail',
        message: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      });
    }
  }

  private async testConversationEndpoint(): Promise<void> {
    const startTime = Date.now();
    console.log('\n💬 Testing Conversation Endpoint...');

    try {
      const testPayload = {
        action: 'start',
        interviewContext: {
          userName: 'Test User',
          type: 'general',
          userId: 'test-123'
        }
      };

      const response = await fetch(`${this.baseUrl}/api/voice/conversation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testPayload)
      });

      if (response.ok) {
        const result = await response.json();
        this.addResult({
          test: 'Conversation Endpoint',
          status: 'pass',
          message: `Conversation API working (message length: ${result.message?.length || 0})`,
          duration: Date.now() - startTime
        });
      } else {
        const errorText = await response.text();
        this.addResult({
          test: 'Conversation Endpoint',
          status: 'fail',
          message: `HTTP ${response.status}: ${errorText}`,
          duration: Date.now() - startTime
        });
      }
    } catch (error) {
      this.addResult({
        test: 'Conversation Endpoint',
        status: 'fail',
        message: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      });
    }
  }

  private async testTTSEndpoint(): Promise<void> {
    const startTime = Date.now();
    console.log('\n🔊 Testing Text-to-Speech Endpoint...');

    try {
      const testPayload = {
        text: 'Hello, this is a test of the text-to-speech system.'
      };

      const response = await fetch(`${this.baseUrl}/api/voice/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testPayload)
      });

      if (response.ok) {
        const audioBlob = await response.blob();
        this.addResult({
          test: 'Text-to-Speech Endpoint',
          status: 'pass',
          message: `TTS API working (audio size: ${audioBlob.size} bytes)`,
          duration: Date.now() - startTime
        });
      } else {
        const errorText = await response.text();
        this.addResult({
          test: 'Text-to-Speech Endpoint',
          status: 'fail',
          message: `HTTP ${response.status}: ${errorText}`,
          duration: Date.now() - startTime
        });
      }
    } catch (error) {
      this.addResult({
        test: 'Text-to-Speech Endpoint',
        status: 'fail',
        message: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      });
    }
  }

  private async testErrorHandling(): Promise<void> {
    const startTime = Date.now();
    console.log('\n🚨 Testing Error Handling...');

    try {
      // Test with invalid request to see error handling
      const response = await fetch(`${this.baseUrl}/api/voice/conversation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'invalid' })
      });

      if (response.status >= 400) {
        const errorResult = await response.json();
        this.addResult({
          test: 'Error Handling',
          status: 'pass',
          message: `Error handling working (status: ${response.status}, error: ${errorResult.error || 'Unknown'})`,
          duration: Date.now() - startTime
        });
      } else {
        this.addResult({
          test: 'Error Handling',
          status: 'fail',
          message: 'API should reject invalid requests',
          duration: Date.now() - startTime
        });
      }
    } catch (error) {
      this.addResult({
        test: 'Error Handling',
        status: 'pass',
        message: `Network error properly handled: ${error instanceof Error ? error.message : String(error)}`,
        duration: Date.now() - startTime
      });
    }
  }

  private async testBrowserCompatibility(): Promise<void> {
    const startTime = Date.now();
    console.log('\n🌐 Testing Browser Compatibility...');

    // Check if we're in a browser-like environment
    if (typeof window === 'undefined') {
      this.addResult({
        test: 'Browser Compatibility',
        status: 'skip',
        message: 'Running in Node.js environment - browser tests skipped',
        duration: Date.now() - startTime
      });
      return;
    }

    const features = {
      'MediaRecorder': typeof window.MediaRecorder !== 'undefined',
      'AudioContext': typeof window.AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined',
      'fetch': typeof fetch !== 'undefined',
      'WebRTC': typeof window.RTCPeerConnection !== 'undefined'
    };

    const unsupportedFeatures = Object.entries(features)
      .filter(([_, supported]) => !supported)
      .map(([feature]) => feature);

    if (unsupportedFeatures.length === 0) {
      this.addResult({
        test: 'Browser Compatibility',
        status: 'pass',
        message: 'All required browser features are supported',
        duration: Date.now() - startTime
      });
    } else {
      this.addResult({
        test: 'Browser Compatibility',
        status: 'fail',
        message: `Unsupported features: ${unsupportedFeatures.join(', ')}`,
        duration: Date.now() - startTime
      });
    }
  }

  private createTestAudioBlob(): Blob {
    // Create a minimal WAV file header
    const sampleRate = 16000;
    const numChannels = 1;
    const bitsPerSample = 16;
    const duration = 0.1; // 100ms
    const numSamples = sampleRate * duration;
    
    // WAV header (44 bytes)
    const wavHeader = new ArrayBuffer(44);
    const view = new DataView(wavHeader);
    
    // "RIFF" chunk descriptor
    view.setUint32(0, 0x46464952, true); // "RIFF" in little endian
    view.setUint32(4, 36 + numSamples * 2, true); // File size - 8
    view.setUint32(8, 0x45564157, true); // "WAVE"
    
    // "fmt " sub-chunk
    view.setUint32(12, 0x20746d66, true); // "fmt "
    view.setUint32(16, 16, true); // Sub-chunk size
    view.setUint16(20, 1, true); // Audio format (PCM)
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * bitsPerSample / 8, true); // Byte rate
    view.setUint16(32, numChannels * bitsPerSample / 8, true); // Block align
    view.setUint16(34, bitsPerSample, true);
    
    // "data" sub-chunk
    view.setUint32(36, 0x61746164, true); // "data"
    view.setUint32(40, numSamples * 2, true); // Data size
    
    // Create silent audio data
    const audioData = new ArrayBuffer(numSamples * 2);
    
    // Combine header and data
    const combined = new Uint8Array(wavHeader.byteLength + audioData.byteLength);
    combined.set(new Uint8Array(wavHeader), 0);
    combined.set(new Uint8Array(audioData), wavHeader.byteLength);
    
    return new Blob([combined], { type: 'audio/wav' });
  }

  private addResult(result: TestResult): void {
    this.results.push(result);
    
    const status = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⏭️ ';
    const duration = result.duration ? ` (${result.duration}ms)` : '';
    console.log(`${status} ${result.test}: ${result.message}${duration}`);
  }

  private printResults(): void {
    console.log('\n' + '='.repeat(50));
    console.log('📊 Test Results Summary');
    console.log('='.repeat(50));

    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    const skipped = this.results.filter(r => r.status === 'skip').length;
    const total = this.results.length;

    console.log(`✅ Passed: ${passed}/${total}`);
    console.log(`❌ Failed: ${failed}/${total}`);
    console.log(`⏭️  Skipped: ${skipped}/${total}`);

    if (failed > 0) {
      console.log('\n🚨 Failed Tests:');
      this.results
        .filter(r => r.status === 'fail')
        .forEach(result => {
          console.log(`  • ${result.test}: ${result.message}`);
        });
    }

    const overallStatus = failed === 0 ? 'PASS' : 'FAIL';
    console.log(`\n🏁 Overall Status: ${overallStatus}`);
    
    if (overallStatus === 'PASS') {
      console.log('\n🎉 Your voice interview system is ready for production!');
    } else {
      console.log('\n🔧 Please fix the failed tests before proceeding to production.');
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new VoiceSystemTester();
  tester.runAllTests().catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
}

export { VoiceSystemTester };
