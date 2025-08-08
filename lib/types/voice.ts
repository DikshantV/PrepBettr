/**
 * TypeScript interfaces for voice conversation system
 */

/**
 * Response interface for conversation start action
 */
export interface ConversationStartResponse {
  success: boolean;
  message: string;
  questionNumber: number;
  isComplete: boolean;
  hasAudio: boolean;
  audioData: number[] | null;
}

/**
 * Response interface for conversation process action
 */
export interface ConversationProcessResponse {
  success: boolean;
  message: string;
  questionNumber: number;
  isComplete: boolean;
  followUpSuggestions?: string[];
  hasAudio: boolean;
  audioData: number[] | null;
}

/**
 * Enhanced SavedMessage interface for conversation messages
 * Includes optional metadata for better message tracking
 */
export interface SavedMessage {
  role: "user" | "system" | "assistant";
  content: string;
  timestamp?: string;
  questionNumber?: number;
  audioData?: number[] | null;
  hasAudio?: boolean;
}

/**
 * Interview context interface for conversation initialization
 */
export interface InterviewContext {
  type: 'technical' | 'behavioral' | 'general';
  position?: string;
  company?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  preliminaryCollected?: boolean; // Default: false - Indicates if preliminary info has been collected
  currentQuestionCount?: number; // Current number of questions asked in the interview
  maxQuestions?: number; // Default: 10 - Maximum number of questions for the interview
  userName?: string;
  userId?: string;
  interviewId?: string;
  feedbackId?: string;
  questions?: string[];
}

/**
 * Voice conversation API request body
 */
export interface VoiceConversationRequest {
  action: 'start' | 'process' | 'summary' | 'clear';
  userTranscript?: string;
  interviewContext?: Partial<InterviewContext>;
}

/**
 * Audio processing result interface
 */
export interface AudioProcessingResult {
  success: boolean;
  audioBlob?: Blob;
  duration?: number;
  sampleRate?: number;
  channels?: number;
  error?: string;
}

/**
 * Speech-to-text response interface
 */
export interface SpeechToTextResponse {
  success: boolean;
  text: string;
  confidence?: number;
  language?: string;
  duration?: number;
  error?: string;
}

/**
 * Text-to-speech request interface
 */
export interface TextToSpeechRequest {
  text: string;
  voice?: string;
  speed?: number;
  pitch?: number;
  outputFormat?: 'audio/wav' | 'audio/mp3' | 'audio/ogg';
}
