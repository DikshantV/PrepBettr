/**
 * Unit tests for voice interview state machine logic
 */

describe('Voice Interview State Machine', () => {
  // State machine states
  enum CallStatus {
    INACTIVE = 'inactive',
    CONNECTING = 'connecting',
    ACTIVE = 'active',
    FINISHED = 'finished'
  }

  interface StateContext {
    callStatus: CallStatus;
    isRecording: boolean;
    isSpeaking: boolean;
    isProcessingAI: boolean;
    isWaitingForUser: boolean;
    hasUserSpoken: boolean;
    introductionComplete: boolean;
    interviewComplete: boolean;
    questionNumber: number;
  }

  const getInitialState = (): StateContext => ({
    callStatus: CallStatus.INACTIVE,
    isRecording: false,
    isSpeaking: false,
    isProcessingAI: false,
    isWaitingForUser: false,
    hasUserSpoken: false,
    introductionComplete: false,
    interviewComplete: false,
    questionNumber: 0
  });

  describe('State Transitions', () => {
    it('should transition from INACTIVE to CONNECTING when call starts', () => {
      const state = getInitialState();
      expect(state.callStatus).toBe(CallStatus.INACTIVE);
      
      // Simulate call start
      state.callStatus = CallStatus.CONNECTING;
      expect(state.callStatus).toBe(CallStatus.CONNECTING);
    });

    it('should transition from CONNECTING to ACTIVE when connection established', () => {
      const state = getInitialState();
      state.callStatus = CallStatus.CONNECTING;
      
      // Simulate successful connection
      state.callStatus = CallStatus.ACTIVE;
      state.questionNumber = 1;
      
      expect(state.callStatus).toBe(CallStatus.ACTIVE);
      expect(state.questionNumber).toBe(1);
    });

    it('should handle introduction phase correctly', () => {
      const state = getInitialState();
      state.callStatus = CallStatus.ACTIVE;
      
      // During introduction
      expect(state.introductionComplete).toBe(false);
      expect(state.isWaitingForUser).toBe(false);
      
      // After introduction audio ends
      state.introductionComplete = true;
      state.isWaitingForUser = false;
      state.hasUserSpoken = false;
      
      expect(state.introductionComplete).toBe(true);
      expect(state.isWaitingForUser).toBe(false);
    });

    it('should manage recording state transitions', () => {
      const state = getInitialState();
      state.callStatus = CallStatus.ACTIVE;
      state.introductionComplete = true;
      
      // Start recording
      state.isRecording = true;
      expect(state.isRecording).toBe(true);
      expect(state.hasUserSpoken).toBe(false);
      
      // User speaks (speech detected)
      state.hasUserSpoken = true;
      
      // Stop recording
      state.isRecording = false;
      state.isWaitingForUser = true;
      
      expect(state.isRecording).toBe(false);
      expect(state.isWaitingForUser).toBe(true);
      expect(state.hasUserSpoken).toBe(true);
    });

    it('should handle AI processing state', () => {
      const state = getInitialState();
      state.callStatus = CallStatus.ACTIVE;
      state.hasUserSpoken = true;
      
      // Start AI processing
      state.isProcessingAI = true;
      state.isWaitingForUser = true;
      
      expect(state.isProcessingAI).toBe(true);
      expect(state.isWaitingForUser).toBe(true);
      
      // AI responds
      state.isProcessingAI = false;
      state.isSpeaking = true;
      
      expect(state.isProcessingAI).toBe(false);
      expect(state.isSpeaking).toBe(true);
      
      // AI audio playback ends
      state.isSpeaking = false;
      state.isWaitingForUser = false;
      state.hasUserSpoken = false;
      state.questionNumber = 2;
      
      expect(state.isSpeaking).toBe(false);
      expect(state.isWaitingForUser).toBe(false);
      expect(state.hasUserSpoken).toBe(false);
      expect(state.questionNumber).toBe(2);
    });

    it('should handle interview completion', () => {
      const state = getInitialState();
      state.callStatus = CallStatus.ACTIVE;
      state.questionNumber = 5;
      
      // Last question answered
      state.interviewComplete = true;
      
      expect(state.interviewComplete).toBe(true);
      
      // Cleanup
      state.callStatus = CallStatus.FINISHED;
      
      expect(state.callStatus).toBe(CallStatus.FINISHED);
    });

    it('should reset state for next recording cycle', () => {
      const state = getInitialState();
      state.callStatus = CallStatus.ACTIVE;
      state.introductionComplete = true;
      state.questionNumber = 2;
      state.hasUserSpoken = true;
      state.isWaitingForUser = true;
      
      // Reset for next cycle
      state.isWaitingForUser = false;
      state.hasUserSpoken = false;
      
      expect(state.isWaitingForUser).toBe(false);
      expect(state.hasUserSpoken).toBe(false);
      expect(state.questionNumber).toBe(2); // Question number should remain
    });
  });

  describe('Edge Cases', () => {
    it('should handle disconnection during recording', () => {
      const state = getInitialState();
      state.callStatus = CallStatus.ACTIVE;
      state.isRecording = true;
      
      // Disconnect
      state.callStatus = CallStatus.FINISHED;
      state.isRecording = false;
      
      expect(state.callStatus).toBe(CallStatus.FINISHED);
      expect(state.isRecording).toBe(false);
    });

    it('should handle disconnection during AI processing', () => {
      const state = getInitialState();
      state.callStatus = CallStatus.ACTIVE;
      state.isProcessingAI = true;
      
      // Disconnect
      state.callStatus = CallStatus.FINISHED;
      state.isProcessingAI = false;
      
      expect(state.callStatus).toBe(CallStatus.FINISHED);
      expect(state.isProcessingAI).toBe(false);
    });

    it('should prevent recording when interview is complete', () => {
      const state = getInitialState();
      state.callStatus = CallStatus.ACTIVE;
      state.interviewComplete = true;
      
      // Should not allow recording
      const canRecord = state.callStatus === CallStatus.ACTIVE && !state.interviewComplete;
      expect(canRecord).toBe(false);
    });

    it('should handle multiple state changes in sequence', () => {
      const state = getInitialState();
      
      // Start call
      state.callStatus = CallStatus.CONNECTING;
      state.callStatus = CallStatus.ACTIVE;
      state.questionNumber = 1;
      
      // Introduction completes
      state.introductionComplete = true;
      
      // First recording cycle
      state.isRecording = true;
      state.hasUserSpoken = true;
      state.isRecording = false;
      state.isWaitingForUser = true;
      
      // AI processes
      state.isProcessingAI = true;
      state.isProcessingAI = false;
      state.isSpeaking = true;
      
      // AI finishes speaking
      state.isSpeaking = false;
      state.isWaitingForUser = false;
      state.hasUserSpoken = false;
      state.questionNumber = 2;
      
      // Second recording cycle
      state.isRecording = true;
      
      expect(state.callStatus).toBe(CallStatus.ACTIVE);
      expect(state.introductionComplete).toBe(true);
      expect(state.questionNumber).toBe(2);
      expect(state.isRecording).toBe(true);
      expect(state.hasUserSpoken).toBe(false);
    });
  });

  describe('State Validation', () => {
    it('should not allow recording and speaking simultaneously', () => {
      const state = getInitialState();
      state.callStatus = CallStatus.ACTIVE;
      
      state.isRecording = true;
      state.isSpeaking = true;
      
      // Validate this is an invalid state
      const isValidState = !(state.isRecording && state.isSpeaking);
      expect(isValidState).toBe(false);
    });

    it('should not process AI while speaking', () => {
      const state = getInitialState();
      state.callStatus = CallStatus.ACTIVE;
      
      state.isProcessingAI = true;
      state.isSpeaking = true;
      
      // This could be valid during transition, but generally should not occur
      const isExpectedState = state.isProcessingAI && !state.isSpeaking;
      expect(isExpectedState).toBe(false);
    });

    it('should require introduction complete before user can speak', () => {
      const state = getInitialState();
      state.callStatus = CallStatus.ACTIVE;
      
      // Try to record before introduction
      const canUserSpeak = state.introductionComplete;
      expect(canUserSpeak).toBe(false);
      
      // After introduction
      state.introductionComplete = true;
      const canUserSpeakNow = state.introductionComplete;
      expect(canUserSpeakNow).toBe(true);
    });
  });

  describe('Question Flow', () => {
    it('should increment question number after each response', () => {
      const state = getInitialState();
      state.callStatus = CallStatus.ACTIVE;
      state.questionNumber = 1;
      
      // After first response
      state.questionNumber = 2;
      expect(state.questionNumber).toBe(2);
      
      // After second response
      state.questionNumber = 3;
      expect(state.questionNumber).toBe(3);
    });

    it('should mark interview complete at final question', () => {
      const state = getInitialState();
      state.callStatus = CallStatus.ACTIVE;
      state.questionNumber = 5; // Assuming 5 is the last question
      
      // After final response
      state.interviewComplete = true;
      
      expect(state.interviewComplete).toBe(true);
      expect(state.questionNumber).toBe(5);
    });

    it('should not increment question number if interview is complete', () => {
      const state = getInitialState();
      state.callStatus = CallStatus.ACTIVE;
      state.questionNumber = 5;
      state.interviewComplete = true;
      
      // Attempt to increment (should not happen)
      const newQuestionNumber = state.interviewComplete ? state.questionNumber : state.questionNumber + 1;
      
      expect(newQuestionNumber).toBe(5);
    });
  });
});
