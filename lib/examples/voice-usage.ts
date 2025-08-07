/**
 * Example demonstrating usage of voice conversation types and audio helpers
 */

import { 
  ConversationStartResponse, 
  ConversationProcessResponse,
  SavedMessage,
  InterviewContext 
} from '@/lib/types/voice';
import { playAudioBuffer, validateAudioBuffer } from '@/lib/utils/audio-helpers';

// Example: Type-safe conversation responses
function handleConversationStart(response: ConversationStartResponse) {
  console.log('Conversation started:', {
    message: response.message,
    questionNumber: response.questionNumber,
    isComplete: response.isComplete,
    hasAudio: response.hasAudio
  });
  
  if (response.hasAudio && validateAudioBuffer(response.audioData)) {
    playAudioBuffer(response.audioData!)
      .then(() => console.log('Opening message played'))
      .catch(error => console.error('Audio playback failed:', error));
  }
}

function handleConversationProcess(response: ConversationProcessResponse) {
  console.log('Response processed:', {
    message: response.message,
    questionNumber: response.questionNumber,
    isComplete: response.isComplete,
    followUpSuggestions: response.followUpSuggestions,
    hasAudio: response.hasAudio
  });
  
  if (response.hasAudio && validateAudioBuffer(response.audioData)) {
    playAudioBuffer(response.audioData!)
      .then(() => console.log('AI response played'))
      .catch(error => console.error('Audio playback failed:', error));
  }
}

// Example: Working with message history
function addToConversationHistory(
  messages: SavedMessage[], 
  newMessage: SavedMessage
): SavedMessage[] {
  return [
    ...messages,
    {
      ...newMessage,
      timestamp: new Date().toISOString(),
    }
  ];
}

// Example: Type-safe interview context
function createTechnicalInterview(): InterviewContext {
  return {
    type: 'technical',
    position: 'Senior Frontend Developer',
    company: 'Tech Corp',
    difficulty: 'medium',
    maxQuestions: 8,
    currentQuestionCount: 0
  };
}

// Example: Audio processing workflow
async function processAudioResponse(audioData: number[] | null) {
  if (!validateAudioBuffer(audioData)) {
    console.warn('Invalid audio data received');
    return;
  }
  
  try {
    console.log('Playing audio response...');
    await playAudioBuffer(audioData!);
    console.log('Audio playback completed successfully');
  } catch (error) {
    console.error('Audio processing failed:', error);
    // Could implement TTS fallback here
  }
}

// Example exports for demonstration
export {
  handleConversationStart,
  handleConversationProcess,
  addToConversationHistory,
  createTechnicalInterview,
  processAudioResponse
};
