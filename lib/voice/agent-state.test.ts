/**
 * Unit tests for Agent state reducer
 * Validates state transitions and selectors
 */

import {
  InterviewState,
  AudioState,
  AgentState,
  agentReducer,
  initialAgentState,
  selectIsRecording,
  selectIsProcessing,
  selectIsSpeaking,
  selectIsWaiting,
  selectIsInterviewActive,
  selectIsInterviewFinished,
  selectCanStartRecording,
  selectShouldShowFeedback,
  createStartInterviewAction,
  createEndInterviewAction,
  createAddUserMessageAction,
  createAddAIMessageAction,
  createUserSpokeAction,
  createProcessingCompleteAction
} from './agent-state';
import { SavedMessage } from '@/lib/types/voice';

describe('Agent State Reducer', () => {
  // Test initial state
  test('should initialize with correct default state', () => {
    expect(initialAgentState).toEqual({
      interviewState: InterviewState.READY,
      audioState: AudioState.IDLE,
      messages: [],
      questionNumber: 0,
      hasUserSpoken: false,
      isInterviewComplete: false,
      userImage: "",
      feedbackGenerated: false,
      generatedFeedbackId: null,
      audioStream: null,
    });
  });

  // Test individual actions
  test('SET_INTERVIEW_STATE should update interview state', () => {
    const action = { type: 'SET_INTERVIEW_STATE' as const, payload: InterviewState.ACTIVE };
    const nextState = agentReducer(initialAgentState, action);
    
    expect(nextState.interviewState).toBe(InterviewState.ACTIVE);
  });

  test('SET_AUDIO_STATE should update audio state', () => {
    const action = { type: 'SET_AUDIO_STATE' as const, payload: AudioState.RECORDING };
    const nextState = agentReducer(initialAgentState, action);
    
    expect(nextState.audioState).toBe(AudioState.RECORDING);
  });

  test('ADD_MESSAGE should append a message', () => {
    const message: SavedMessage = { role: 'user' as const, content: 'Hello' };
    const action = { type: 'ADD_MESSAGE' as const, payload: message };
    const nextState = agentReducer(initialAgentState, action);
    
    expect(nextState.messages).toEqual([message]);
  });

  test('ADD_MESSAGES should append multiple messages', () => {
    const messages: SavedMessage[] = [
      { role: 'user' as const, content: 'Hello' },
      { role: 'assistant' as const, content: 'Hi there' }
    ];
    const action = { type: 'ADD_MESSAGES' as const, payload: messages };
    const nextState = agentReducer(initialAgentState, action);
    
    expect(nextState.messages).toEqual(messages);
  });

  test('SET_USER_SPOKEN should update hasUserSpoken flag', () => {
    const action = { type: 'SET_USER_SPOKEN' as const, payload: true };
    const nextState = agentReducer(initialAgentState, action);
    
    expect(nextState.hasUserSpoken).toBe(true);
  });

  test('SET_FEEDBACK_GENERATED should update feedback state', () => {
    const action = { 
      type: 'SET_FEEDBACK_GENERATED' as const, 
      payload: { generated: true, id: 'feedback-123' } 
    };
    const nextState = agentReducer(initialAgentState, action);
    
    expect(nextState.feedbackGenerated).toBe(true);
    expect(nextState.generatedFeedbackId).toBe('feedback-123');
  });

  test('END_INTERVIEW should reset to finished state', () => {
    // Set up an active interview first
    let state = { 
      ...initialAgentState, 
      interviewState: InterviewState.ACTIVE,
      audioState: AudioState.SPEAKING,
      audioStream: {} as MediaStream
    };
    
    const action = { type: 'END_INTERVIEW' as const };
    const nextState = agentReducer(state, action);
    
    expect(nextState.interviewState).toBe(InterviewState.FINISHED);
    expect(nextState.audioState).toBe(AudioState.IDLE);
    expect(nextState.audioStream).toBeNull();
  });

  test('RESET_INTERVIEW should reset state but preserve user image', () => {
    // Set up an active state with multiple changes
    let state: AgentState = { 
      ...initialAgentState, 
      interviewState: InterviewState.ACTIVE,
      audioState: AudioState.SPEAKING,
      messages: [{ role: 'user' as const, content: 'Hello' }],
      hasUserSpoken: true,
      userImage: 'user-profile.jpg'
    };
    
    const action = { type: 'RESET_INTERVIEW' as const };
    const nextState = agentReducer(state, action);
    
    // Should reset everything except userImage
    expect(nextState.interviewState).toBe(InterviewState.READY);
    expect(nextState.audioState).toBe(AudioState.IDLE);
    expect(nextState.messages).toEqual([]);
    expect(nextState.hasUserSpoken).toBe(false);
    expect(nextState.userImage).toBe('user-profile.jpg'); // Preserved
  });

  // Test action creators
  test('createStartInterviewAction should create the correct action', () => {
    const action = createStartInterviewAction();
    expect(action).toEqual({
      type: 'SET_INTERVIEW_STATE',
      payload: InterviewState.ACTIVE
    });
  });

  test('createEndInterviewAction should create the correct action', () => {
    const action = createEndInterviewAction();
    expect(action).toEqual({
      type: 'END_INTERVIEW'
    });
  });

  test('createAddUserMessageAction should create the correct action', () => {
    const action = createAddUserMessageAction('Hello there');
    expect(action).toEqual({
      type: 'ADD_MESSAGE',
      payload: { role: 'user', content: 'Hello there' }
    });
  });

  test('createAddAIMessageAction should create the correct action', () => {
    const action = createAddAIMessageAction('I am the AI assistant');
    expect(action).toEqual({
      type: 'ADD_MESSAGE',
      payload: { role: 'assistant', content: 'I am the AI assistant' }
    });
  });

  test('createUserSpokeAction should create the correct action', () => {
    const action = createUserSpokeAction();
    expect(action).toEqual({
      type: 'SET_USER_SPOKEN',
      payload: true
    });
  });

  test('createProcessingCompleteAction should create multiple actions', () => {
    const actions = createProcessingCompleteAction(
      'AI response', 
      2, // question number
      false // not complete
    );
    
    expect(actions).toEqual([
      { 
        type: 'ADD_MESSAGE', 
        payload: { role: 'assistant', content: 'AI response' } 
      },
      { type: 'RESET_TO_WAITING' },
      { type: 'SET_QUESTION_NUMBER', payload: 2 },
      { type: 'SET_INTERVIEW_COMPLETE', payload: false }
    ]);
  });

  // Test selectors
  test('selectIsRecording should return correct boolean', () => {
    const recordingState: AgentState = {
      ...initialAgentState,
      audioState: AudioState.RECORDING
    };
    
    expect(selectIsRecording(recordingState)).toBe(true);
    expect(selectIsRecording(initialAgentState)).toBe(false);
  });

  test('selectIsProcessing should return correct boolean', () => {
    const processingState: AgentState = {
      ...initialAgentState,
      audioState: AudioState.PROCESSING
    };
    
    expect(selectIsProcessing(processingState)).toBe(true);
    expect(selectIsProcessing(initialAgentState)).toBe(false);
  });

  test('selectIsSpeaking should return correct boolean', () => {
    const speakingState: AgentState = {
      ...initialAgentState,
      audioState: AudioState.SPEAKING
    };
    
    expect(selectIsSpeaking(speakingState)).toBe(true);
    expect(selectIsSpeaking(initialAgentState)).toBe(false);
  });

  test('selectIsWaiting should return correct boolean', () => {
    const waitingState: AgentState = {
      ...initialAgentState,
      audioState: AudioState.WAITING
    };
    
    expect(selectIsWaiting(waitingState)).toBe(true);
    expect(selectIsWaiting(initialAgentState)).toBe(false);
  });

  test('selectCanStartRecording should return true only when active and waiting', () => {
    const readyState: AgentState = {
      ...initialAgentState,
      interviewState: InterviewState.READY
    };
    
    const activeWaitingState: AgentState = {
      ...initialAgentState,
      interviewState: InterviewState.ACTIVE,
      audioState: AudioState.WAITING
    };
    
    const activeRecordingState: AgentState = {
      ...initialAgentState,
      interviewState: InterviewState.ACTIVE,
      audioState: AudioState.RECORDING
    };
    
    expect(selectCanStartRecording(readyState)).toBe(false);
    expect(selectCanStartRecording(activeWaitingState)).toBe(true);
    expect(selectCanStartRecording(activeRecordingState)).toBe(false);
  });

  test('selectShouldShowFeedback should return true when feedback is ready', () => {
    const noFeedbackState: AgentState = {
      ...initialAgentState,
      interviewState: InterviewState.FINISHED,
      feedbackGenerated: false
    };
    
    const pendingFeedbackState: AgentState = {
      ...initialAgentState,
      interviewState: InterviewState.FINISHED,
      feedbackGenerated: true,
      generatedFeedbackId: null
    };
    
    const completeFeedbackState: AgentState = {
      ...initialAgentState,
      interviewState: InterviewState.FINISHED,
      feedbackGenerated: true,
      generatedFeedbackId: 'feedback-123'
    };
    
    expect(selectShouldShowFeedback(noFeedbackState)).toBe(false);
    expect(selectShouldShowFeedback(pendingFeedbackState)).toBe(false);
    expect(selectShouldShowFeedback(completeFeedbackState)).toBe(true);
  });

  // Test full interview lifecycle transitions
  test('should handle complete interview lifecycle', () => {
    // Start with initial state
    let state = initialAgentState;
    
    // 1. Start interview
    state = agentReducer(state, createStartInterviewAction());
    expect(state.interviewState).toBe(InterviewState.ACTIVE);
    
    // 2. Set audio state to waiting for user
    state = agentReducer(state, { type: 'RESET_TO_WAITING' });
    expect(state.audioState).toBe(AudioState.WAITING);
    
    // 3. Start recording
    state = agentReducer(state, { type: 'START_RECORDING' });
    expect(state.audioState).toBe(AudioState.RECORDING);
    
    // 4. Stop recording
    state = agentReducer(state, { type: 'STOP_RECORDING' });
    expect(state.audioState).toBe(AudioState.PROCESSING);
    
    // 5. Start speaking
    state = agentReducer(state, { type: 'START_SPEAKING' });
    expect(state.audioState).toBe(AudioState.SPEAKING);
    
    // 6. Add user and AI messages
    state = agentReducer(state, createAddUserMessageAction('Hello, I am applying for a job'));
    state = agentReducer(state, createAddAIMessageAction('Tell me about your experience'));
    expect(state.messages.length).toBe(2);
    
    // 7. Reset to waiting state
    state = agentReducer(state, { type: 'RESET_TO_WAITING' });
    expect(state.audioState).toBe(AudioState.WAITING);
    
    // 8. Mark interview as complete
    state = agentReducer(state, { type: 'SET_INTERVIEW_COMPLETE', payload: true });
    expect(state.isInterviewComplete).toBe(true);
    
    // 9. End interview
    state = agentReducer(state, createEndInterviewAction());
    expect(state.interviewState).toBe(InterviewState.FINISHED);
    expect(state.audioState).toBe(AudioState.IDLE);
    
    // 10. Generate feedback
    state = agentReducer(state, { 
      type: 'SET_FEEDBACK_GENERATED', 
      payload: { generated: true, id: 'feedback-123' } 
    });
    expect(state.feedbackGenerated).toBe(true);
    expect(state.generatedFeedbackId).toBe('feedback-123');
    
    // Verify selectors
    expect(selectIsInterviewFinished(state)).toBe(true);
    expect(selectShouldShowFeedback(state)).toBe(true);
  });
});
