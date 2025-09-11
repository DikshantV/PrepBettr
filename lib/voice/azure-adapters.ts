/**
 * Legacy voice types for API compatibility
 * 
 * NOTE: This file only provides types for backward compatibility with existing API routes.
 * The actual voice processing is now handled by Azure AI Foundry Live Voice API.
 * Client-side audio functions have been removed and consolidated into the new Agent component.
 */

export interface InterviewContext {
  userName: string;
  questions?: string[];
  type: string;
  userId: string;
  interviewId?: string;
  feedbackId?: string;
  resumeInfo?: {
    hasResume: boolean;
    candidateName?: string;
    summary?: string;
    skills?: string;
    experience?: string;
    education?: string;
    yearsOfExperience?: number;
  };
}

export interface ConversationResponse {
  message: string;
  questionNumber?: number;
  isComplete?: boolean;
  hasAudio?: boolean;
  audioData?: number[] | Uint8Array;
}

// Legacy types for backwards compatibility
export interface LegacyAudioContext {
  sampleRate: number;
  state: string;
}

// Deprecated - these functions are no longer implemented
// Use Azure AI Foundry Live Voice API instead
export const speechToText = () => {
  throw new Error('speechToText has been deprecated. Use Azure AI Foundry Live Voice API instead.');
};

export const startConversation = () => {
  throw new Error('startConversation has been deprecated. Use Azure AI Foundry Live Voice API instead.');
};

export const processConversation = () => {
  throw new Error('processConversation has been deprecated. Use Azure AI Foundry Live Voice API instead.');
};

export const endConversation = () => {
  throw new Error('endConversation has been deprecated. Use Azure AI Foundry Live Voice API instead.');
};

export const textToSpeech = () => {
  throw new Error('textToSpeech has been deprecated. Use Azure AI Foundry Live Voice API instead.');
};

export const playAIResponse = () => {
  throw new Error('playAIResponse has been deprecated. Use Azure AI Foundry Live Voice API instead.');
};

export const processAndPlayResponse = () => {
  throw new Error('processAndPlayResponse has been deprecated. Use Azure AI Foundry Live Voice API instead.');
};

export const playDirectAudioWithFallback = () => {
  throw new Error('playDirectAudioWithFallback has been deprecated. Use Azure AI Foundry Live Voice API instead.');
};
