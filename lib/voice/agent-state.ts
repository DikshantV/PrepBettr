/**
 * Centralized state management for Agent component
 * Replaces scattered useState calls with a unified reducer pattern
 */

import { SavedMessage } from '@/lib/types/voice';

// Interview state enum
export enum InterviewState {
  READY = "READY",
  ACTIVE = "ACTIVE", 
  FINISHED = "FINISHED",
}

// Audio processing state
export enum AudioState {
  IDLE = "IDLE",
  RECORDING = "RECORDING",
  PROCESSING = "PROCESSING", 
  SPEAKING = "SPEAKING",
  WAITING = "WAITING",
}

// Complete agent state interface
export interface AgentState {
  // Core interview state
  interviewState: InterviewState;
  audioState: AudioState;
  messages: SavedMessage[];
  questionNumber: number;
  
  // User interaction tracking
  hasUserSpoken: boolean;
  isInterviewComplete: boolean;
  
  // UI state
  userImage: string;
  
  // Feedback management
  feedbackGenerated: boolean;
  generatedFeedbackId: string | null;
  
  // Audio resources (references only, not state)
  audioStream: MediaStream | null;
}

// Action types for state updates
export type AgentAction =
  | { type: 'SET_INTERVIEW_STATE'; payload: InterviewState }
  | { type: 'SET_AUDIO_STATE'; payload: AudioState }
  | { type: 'ADD_MESSAGE'; payload: SavedMessage }
  | { type: 'ADD_MESSAGES'; payload: SavedMessage[] }
  | { type: 'SET_USER_SPOKEN'; payload: boolean }
  | { type: 'SET_QUESTION_NUMBER'; payload: number }
  | { type: 'SET_INTERVIEW_COMPLETE'; payload: boolean }
  | { type: 'SET_USER_IMAGE'; payload: string }
  | { type: 'SET_FEEDBACK_GENERATED'; payload: { generated: boolean; id: string | null } }
  | { type: 'SET_AUDIO_STREAM'; payload: MediaStream | null }
  | { type: 'RESET_INTERVIEW' }
  | { type: 'START_RECORDING' }
  | { type: 'STOP_RECORDING' }
  | { type: 'START_AI_PROCESSING' }
  | { type: 'START_SPEAKING' }
  | { type: 'RESET_TO_WAITING' }
  | { type: 'END_INTERVIEW' };

// Initial state
export const initialAgentState: AgentState = {
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
};

// State reducer with comprehensive action handling
export const agentReducer = (state: AgentState, action: AgentAction): AgentState => {
  switch (action.type) {
    case 'SET_INTERVIEW_STATE':
      return { ...state, interviewState: action.payload };
      
    case 'SET_AUDIO_STATE':
      return { ...state, audioState: action.payload };
      
    case 'ADD_MESSAGE':
      return { 
        ...state, 
        messages: [...state.messages, action.payload] 
      };
      
    case 'ADD_MESSAGES':
      return { 
        ...state, 
        messages: [...state.messages, ...action.payload] 
      };
      
    case 'SET_USER_SPOKEN':
      return { ...state, hasUserSpoken: action.payload };
      
    case 'SET_QUESTION_NUMBER':
      return { ...state, questionNumber: action.payload };
      
    case 'SET_INTERVIEW_COMPLETE':
      return { ...state, isInterviewComplete: action.payload };
      
    case 'SET_USER_IMAGE':
      return { ...state, userImage: action.payload };
      
    case 'SET_FEEDBACK_GENERATED':
      return { 
        ...state, 
        feedbackGenerated: action.payload.generated,
        generatedFeedbackId: action.payload.id 
      };
      
    case 'SET_AUDIO_STREAM':
      return { ...state, audioStream: action.payload };
      
    case 'START_RECORDING':
      return { 
        ...state, 
        audioState: AudioState.RECORDING 
      };
      
    case 'STOP_RECORDING':
      return { 
        ...state, 
        audioState: AudioState.PROCESSING 
      };
      
    case 'START_AI_PROCESSING':
      return { 
        ...state, 
        audioState: AudioState.PROCESSING 
      };
      
    case 'START_SPEAKING':
      return { 
        ...state, 
        audioState: AudioState.SPEAKING 
      };
      
    case 'RESET_TO_WAITING':
      return { 
        ...state, 
        audioState: AudioState.WAITING 
      };
      
    case 'END_INTERVIEW':
      return { 
        ...state, 
        interviewState: InterviewState.FINISHED,
        audioState: AudioState.IDLE,
        audioStream: null 
      };
      
    case 'RESET_INTERVIEW':
      return {
        ...initialAgentState,
        userImage: state.userImage, // Preserve user image across resets
      };
      
    default:
      return state;
  }
};

// Derived state selectors (computed properties)
export const selectIsRecording = (state: AgentState): boolean => 
  state.audioState === AudioState.RECORDING;

export const selectIsProcessing = (state: AgentState): boolean => 
  state.audioState === AudioState.PROCESSING;

export const selectIsSpeaking = (state: AgentState): boolean => 
  state.audioState === AudioState.SPEAKING;

export const selectIsWaiting = (state: AgentState): boolean => 
  state.audioState === AudioState.WAITING;

export const selectIsInterviewActive = (state: AgentState): boolean => 
  state.interviewState === InterviewState.ACTIVE;

export const selectIsInterviewFinished = (state: AgentState): boolean => 
  state.interviewState === InterviewState.FINISHED;

export const selectCanStartRecording = (state: AgentState): boolean => 
  state.interviewState === InterviewState.ACTIVE && 
  state.audioState === AudioState.WAITING;

export const selectShouldShowFeedback = (state: AgentState): boolean => 
  state.feedbackGenerated && 
  state.generatedFeedbackId !== null &&
  state.interviewState === InterviewState.FINISHED;

// Action creators for common state transitions
export const createStartInterviewAction = (): AgentAction => ({ 
  type: 'SET_INTERVIEW_STATE', 
  payload: InterviewState.ACTIVE 
});

export const createEndInterviewAction = (): AgentAction => ({ 
  type: 'END_INTERVIEW' 
});

export const createStartRecordingAction = (): AgentAction => ({ 
  type: 'START_RECORDING' 
});

export const createStopRecordingAction = (): AgentAction => ({ 
  type: 'STOP_RECORDING' 
});

export const createAddUserMessageAction = (content: string): AgentAction => ({
  type: 'ADD_MESSAGE',
  payload: { role: 'user', content }
});

export const createAddAIMessageAction = (content: string): AgentAction => ({
  type: 'ADD_MESSAGE', 
  payload: { role: 'assistant', content }
});

export const createUserSpokeAction = (): AgentAction => ({
  type: 'SET_USER_SPOKEN',
  payload: true
});

export const createProcessingCompleteAction = (
  aiMessage: string,
  questionNumber?: number,
  isComplete?: boolean
): AgentAction[] => {
  const actions: AgentAction[] = [
    { type: 'ADD_MESSAGE', payload: { role: 'assistant', content: aiMessage } },
    { type: 'RESET_TO_WAITING' }
  ];
  
  if (questionNumber !== undefined) {
    actions.push({ type: 'SET_QUESTION_NUMBER', payload: questionNumber });
  }
  
  if (isComplete !== undefined) {
    actions.push({ type: 'SET_INTERVIEW_COMPLETE', payload: isComplete });
  }
  
  return actions;
};
