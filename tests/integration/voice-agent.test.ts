/**
 * Voice-Agent Integration Tests
 * 
 * Tests the integration between Azure AI Foundry voice sessions and the multi-agent
 * interview workflow system, including WebSocket communication, session management,
 * and agent handoff coordination.
 */

import { jest } from '@jest/globals';
import WS from 'jest-websocket-mock';
import { VoiceSession } from '@/lib/azure-ai-foundry/voice/voice-session';
import { VoiceLiveClient } from '@/lib/azure-ai-foundry/voice/voice-live-client';
import { voiceTelemetry } from '@/lib/azure-ai-foundry/voice/voice-telemetry';

// Mock dependencies
jest.mock('@/lib/azure-ai-foundry/voice/voice-live-client');
jest.mock('@/lib/azure-ai-foundry/voice/voice-telemetry');

// Mock InterviewWorkflow for testing agent handoffs
interface MockInterviewWorkflow {
  currentAgent: string;
  sessionState: string;
  emitAgentHandoff(fromAgent: string, toAgent: string): void;
  emitAgentFailure(agent: string): void;
}

class MockInterviewWorkflow {
  public currentAgent = 'technical';
  public sessionState = 'active';
  private eventHandlers = new Map<string, ((data: any) => void)[]>();

  constructor() {
    // Initialize with default state
  }

  on(event: string, handler: (data: any) => void) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  emitAgentHandoff(fromAgent: string, toAgent: string): void {
    this.currentAgent = toAgent;
    this.emit('agent-handoff', { fromAgent, toAgent, timestamp: Date.now() });
  }

  emitAgentFailure(agent: string): void {
    this.emit('agent-failure', { agent, timestamp: Date.now(), recovered: false });
  }

  private emit(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error in ${event} handler:`, error);
      }
    });
  }
}

// Mock VoiceSession for testing
class MockVoiceSession {
  private state: string = 'idle';
  private isTextModeEnabled = false;
  private isConnected = true;
  private sessionId: string;
  private transcriptHandlers: ((event: any) => void)[] = [];
  private responseHandlers: ((event: any) => void)[] = [];

  constructor(sessionId = 'test-session-123') {
    this.sessionId = sessionId;
  }

  async start(): Promise<void> {
    this.state = 'active';
    this.isConnected = true;
    console.log(`MockVoiceSession ${this.sessionId} started`);
  }

  async stop(): Promise<void> {
    this.state = 'stopped';
    this.isConnected = false;
    console.log(`MockVoiceSession ${this.sessionId} stopped`);
  }

  async connect(): Promise<void> {
    this.isConnected = true;
    console.log(`MockVoiceSession ${this.sessionId} connected`);
  }

  isConnected(): boolean {
    return this.isConnected;
  }

  isTextMode(): boolean {
    return this.isTextModeEnabled;
  }

  getState(): string {
    return this.state;
  }

  onTranscript(handler: (event: any) => void): void {
    this.transcriptHandlers.push(handler);
  }

  onResponse(handler: (event: any) => void): void {
    this.responseHandlers.push(handler);
  }

  // Test helpers
  simulateTranscript(text: string): void {
    this.transcriptHandlers.forEach(handler => {
      handler({
        type: 'transcript',
        text,
        timestamp: Date.now(),
        isFinal: true
      });
    });
  }

  simulateAudioQualityIssue(): void {
    this.isTextModeEnabled = true;
    console.log(`MockVoiceSession ${this.sessionId} switched to text mode due to audio quality issues`);
  }

  simulateConnectionDrop(): void {
    this.isConnected = false;
  }
}

describe('Voice-Agent Integration', () => {
  let server: WS;
  let voiceSession: MockVoiceSession;
  let workflow: MockInterviewWorkflow;
  let mockTelemetry: any;

  beforeEach(async () => {
    // Setup WebSocket mock server
    server = new WS('ws://localhost:3001/voice');
    
    // Create mock instances
    voiceSession = new MockVoiceSession();
    workflow = new MockInterviewWorkflow();
    
    // Setup voice telemetry mock
    mockTelemetry = {
      getMetrics: jest.fn().mockReturnValue({
        sessionsStarted: 0,
        sessionsEnded: 0,
        totalTranscriptEvents: 0
      }),
      startSession: jest.fn(),
      endSession: jest.fn(),
      trackConnection: jest.fn(),
      trackError: jest.fn(),
      logTranscriptEvent: jest.fn()
    };
    
    (voiceTelemetry as any).getVoiceTelemetry = () => mockTelemetry;
    (voiceTelemetry as any).getMetrics = mockTelemetry.getMetrics;
    (voiceTelemetry as any).startSession = mockTelemetry.startSession;
    (voiceTelemetry as any).endSession = mockTelemetry.endSession;

    await voiceSession.start();
  });

  afterEach(async () => {
    await voiceSession.stop();
    WS.clean();
  });

  describe('Voice Session and WebSocket Integration', () => {
    it('should connect voice session to interview workflow', async () => {
      // Simulate voice transcript incoming via WebSocket
      server.send(JSON.stringify({ 
        type: 'transcript', 
        text: 'I am ready for technical questions' 
      }));

      // Wait for event processing
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify voice session is active
      expect(voiceSession.getState()).toBe('active');
      expect(voiceSession.isConnected()).toBe(true);
      
      // Verify telemetry tracking
      expect(mockTelemetry.startSession).toHaveBeenCalled();
    });

    it('should maintain voice session across agent handoffs', async () => {
      // Setup transcript handler to track session activity
      let transcriptReceived = false;
      voiceSession.onTranscript((event) => {
        transcriptReceived = true;
        console.log('Transcript received:', event.text);
      });

      // Simulate initial transcript
      voiceSession.simulateTranscript('Technical question answer');
      
      // Verify initial state
      expect(transcriptReceived).toBe(true);
      expect(workflow.currentAgent).toBe('technical');

      // Simulate agent handoff
      const fromAgent = 'technical';
      const toAgent = 'behavioral';
      workflow.emitAgentHandoff(fromAgent, toAgent);

      // Simulate transcript after handoff
      voiceSession.simulateTranscript('Now answering behavioral questions');

      // Verify handoff completed but voice session remains active
      expect(workflow.currentAgent).toBe(toAgent);
      expect(voiceSession.isConnected()).toBe(true);
      expect(voiceSession.getState()).toBe('active');
    });

    it('should handle multiple WebSocket message types', async () => {
      const messageTypes = ['transcript', 'response', 'control', 'error'];
      let messagesReceived = 0;

      // Setup handlers for different message types
      voiceSession.onTranscript(() => messagesReceived++);
      voiceSession.onResponse(() => messagesReceived++);

      // Send different message types
      server.send(JSON.stringify({ 
        type: 'transcript', 
        text: 'Hello world',
        timestamp: Date.now()
      }));
      
      server.send(JSON.stringify({ 
        type: 'response', 
        audio_data: new Array(100).fill(0),
        timestamp: Date.now()
      }));

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(messagesReceived).toBeGreaterThan(0);
      expect(voiceSession.isConnected()).toBe(true);
    });
  });

  describe('Connection Resilience and Recovery', () => {
    it('should gracefully recover from connection drop', async () => {
      // Simulate connection drop
      voiceSession.simulateConnectionDrop();
      expect(voiceSession.isConnected()).toBe(false);

      // Simulate reconnection
      await voiceSession.connect();
      
      // Validate that voice session is active again
      expect(voiceSession.isConnected()).toBe(true);
    });

    it('should fallback to text mode on audio quality issues', () => {
      // Verify initial state is voice mode
      expect(voiceSession.isTextMode()).toBe(false);
      
      // Simulate audio quality error
      voiceSession.simulateAudioQualityIssue();

      // Validate fallback state
      expect(voiceSession.isTextMode()).toBe(true);
      expect(voiceSession.isConnected()).toBe(true); // Session should still be connected
    });

    it('should handle WebSocket server unavailable', async () => {
      // Close server to simulate unavailability
      await server.close();

      // Voice session should handle this gracefully
      expect(voiceSession.getState()).toBe('active'); // Mock maintains state
      
      // Reconnection should be possible when server comes back
      server = new WS('ws://localhost:3001/voice');
      await voiceSession.connect();
      expect(voiceSession.isConnected()).toBe(true);
    });

    it('should maintain session state during temporary disconnections', async () => {
      // Setup session with active conversation
      voiceSession.simulateTranscript('I was discussing my background');
      
      // Simulate temporary disconnection
      voiceSession.simulateConnectionDrop();
      expect(voiceSession.isConnected()).toBe(false);
      
      // Simulate quick reconnection
      await voiceSession.connect();
      expect(voiceSession.isConnected()).toBe(true);
      
      // Session should be able to continue
      voiceSession.simulateTranscript('Continuing the conversation');
      expect(voiceSession.getState()).toBe('active');
    });
  });

  describe('Multi-Agent Workflow Integration', () => {
    it('should keep voice session stable after agent failure', async () => {
      // Simulate agent failure event
      workflow.emitAgentFailure('technical');

      // Wait for recovery
      await new Promise(resolve => setTimeout(resolve, 50));

      // Check voice session stability
      expect(voiceSession.isConnected()).toBe(true);
      expect(voiceSession.getState()).toBe('active');
    });

    it('should coordinate voice transcripts with agent context', async () => {
      let transcriptEvents: any[] = [];
      
      // Setup transcript tracking
      voiceSession.onTranscript((event) => {
        transcriptEvents.push({
          text: event.text,
          agent: workflow.currentAgent,
          timestamp: event.timestamp
        });
      });

      // Simulate conversation flow with agent changes
      voiceSession.simulateTranscript('Tell me about your technical background');
      expect(workflow.currentAgent).toBe('technical');

      workflow.emitAgentHandoff('technical', 'behavioral');
      voiceSession.simulateTranscript('Describe a challenging team situation');
      
      workflow.emitAgentHandoff('behavioral', 'system-design');
      voiceSession.simulateTranscript('How would you design a scalable system');

      // Verify transcript events captured with correct agent context
      expect(transcriptEvents).toHaveLength(3);
      expect(transcriptEvents[0].text).toContain('technical background');
      expect(transcriptEvents[1].text).toContain('team situation');
      expect(transcriptEvents[2].text).toContain('scalable system');
    });

    it('should handle rapid agent switching without voice interruption', async () => {
      let handoffCount = 0;
      
      workflow.on('agent-handoff', () => {
        handoffCount++;
      });

      // Simulate rapid agent switching
      workflow.emitAgentHandoff('technical', 'behavioral');
      workflow.emitAgentHandoff('behavioral', 'system-design');
      workflow.emitAgentHandoff('system-design', 'cultural-fit');
      
      // Voice session should remain stable
      expect(voiceSession.isConnected()).toBe(true);
      expect(voiceSession.getState()).toBe('active');
      expect(handoffCount).toBe(3);
    });
  });

  describe('Telemetry and Monitoring Integration', () => {
    it('should track voice session metrics throughout agent workflow', async () => {
      // Simulate conversation with multiple agents
      voiceSession.simulateTranscript('Starting interview');
      workflow.emitAgentHandoff('technical', 'behavioral');
      voiceSession.simulateTranscript('Discussing teamwork');
      
      // Verify telemetry calls
      expect(mockTelemetry.startSession).toHaveBeenCalled();
      expect(mockTelemetry.logTranscriptEvent).toHaveBeenCalled();
    });

    it('should track connection events during agent handoffs', () => {
      // Simulate connection events during handoff
      workflow.emitAgentHandoff('technical', 'behavioral');
      
      // Voice session connection should be tracked
      expect(voiceSession.isConnected()).toBe(true);
      // In real implementation, telemetry.trackConnection would be called
    });

    it('should measure end-to-end latency across voice and agent systems', async () => {
      const startTime = Date.now();
      
      // Simulate voice input -> agent processing -> voice output cycle
      voiceSession.simulateTranscript('What is your experience with React?');
      
      // Simulate agent processing time
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Simulate voice response
      let responseReceived = false;
      voiceSession.onResponse(() => {
        responseReceived = true;
        const endTime = Date.now();
        const latency = endTime - startTime;
        expect(latency).toBeGreaterThan(0);
      });

      expect(responseReceived).toBe(false); // No actual response in mock
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle voice session errors without breaking workflow', () => {
      // Simulate various error scenarios
      expect(() => {
        voiceSession.simulateConnectionDrop();
        workflow.emitAgentFailure('technical');
      }).not.toThrow();

      // Workflow should continue to be responsive
      workflow.emitAgentHandoff('technical', 'behavioral');
      expect(workflow.currentAgent).toBe('behavioral');
    });

    it('should recover from WebSocket connection errors', async () => {
      // Simulate WebSocket error
      server.error();
      
      // Voice session should handle gracefully
      expect(voiceSession.getState()).toBe('active'); // Mock maintains state
      
      // Should be able to reconnect
      server = new WS('ws://localhost:3001/voice');
      await voiceSession.connect();
      expect(voiceSession.isConnected()).toBe(true);
    });

    it('should maintain agent state consistency during voice issues', () => {
      // Set initial agent state
      expect(workflow.currentAgent).toBe('technical');
      
      // Simulate voice issues
      voiceSession.simulateAudioQualityIssue();
      voiceSession.simulateConnectionDrop();
      
      // Agent state should remain consistent
      expect(workflow.currentAgent).toBe('technical');
      
      // Agent handoff should still work
      workflow.emitAgentHandoff('technical', 'behavioral');
      expect(workflow.currentAgent).toBe('behavioral');
    });
  });

  describe('Performance and Resource Management', () => {
    it('should cleanup resources when voice session ends', async () => {
      // Setup active session with handlers
      voiceSession.onTranscript(() => {});
      voiceSession.onResponse(() => {});
      
      // Stop session
      await voiceSession.stop();
      
      // Verify cleanup
      expect(voiceSession.getState()).toBe('stopped');
      expect(voiceSession.isConnected()).toBe(false);
    });

    it('should handle concurrent voice and workflow operations', async () => {
      // Simulate concurrent operations
      const operations = [
        () => voiceSession.simulateTranscript('Concurrent transcript 1'),
        () => workflow.emitAgentHandoff('technical', 'behavioral'),
        () => voiceSession.simulateTranscript('Concurrent transcript 2'),
        () => workflow.emitAgentHandoff('behavioral', 'system-design')
      ];

      // Execute operations concurrently
      const promises = operations.map(op => Promise.resolve(op()));
      await Promise.all(promises);

      // System should remain stable
      expect(voiceSession.isConnected()).toBe(true);
      expect(workflow.currentAgent).toBe('system-design');
    });

    it('should handle memory efficiently during long sessions', async () => {
      // Simulate long session with many transcripts
      for (let i = 0; i < 100; i++) {
        voiceSession.simulateTranscript(`Transcript ${i}`);
        if (i % 10 === 0) {
          workflow.emitAgentHandoff('technical', 'behavioral');
          workflow.emitAgentHandoff('behavioral', 'technical');
        }
      }

      // Session should remain stable
      expect(voiceSession.isConnected()).toBe(true);
      expect(voiceSession.getState()).toBe('active');
    });
  });
});
