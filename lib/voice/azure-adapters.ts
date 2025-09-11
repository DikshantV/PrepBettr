/**
 * Azure API adapters for speech and conversation services
 * Isolates API calls while maintaining existing signatures
 */

import { logger } from '../utils/logger';
import { withRetry, handleApiError, showErrorNotification } from '../utils/error-utils';
import { validateAudioBuffer, playAudioBuffer } from '../utils/audio-helpers';
import { sanitizeInterviewText } from '../utils/markdown-sanitizer';
import { SavedMessage, ConversationProcessResponse } from '@/lib/types/voice';

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

/**
 * Speech-to-Text adapter with retry logic
 */
export const speechToText = async (audioBlob: Blob): Promise<string> => {
  return withRetry(async () => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.wav');

    logger.api.request('/api/voice/stream', 'POST', { 
      size: audioBlob.size,
      type: audioBlob.type 
    });
    
    const response = await fetch('/api/voice/stream', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw handleApiError(response, 'Speech-to-text');
    }

    const result = await response.json();
    logger.api.response('/api/voice/stream', response.status, { 
      textLength: result.text?.length 
    });

    if (result.text === undefined) {
      throw new Error('Speech-to-text response missing text field');
    }

    return result.text;
  }, 3, 'Speech-to-text');
};

/**
 * Start conversation adapter
 */
export const startConversation = async (
  interviewContext: InterviewContext
): Promise<ConversationResponse> => {
  logger.api.request('/api/voice/conversation', 'POST', { action: 'start' });

  const response = await fetch('/api/voice/conversation', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: "start",
      interviewContext
    }),
  });

  if (!response.ok) {
    throw handleApiError(response, 'Start conversation');
  }

  const data = await response.json();
  logger.api.response('/api/voice/conversation', response.status, { 
    hasAudio: !!data.hasAudio,
    messageLength: data.message?.length 
  });

  return data;
};

/**
 * Process conversation turn adapter  
 */
export const processConversation = async (
  userTranscript: string
): Promise<ConversationResponse> => {
  console.log('🧪 [PROCESS CONVERSATION] Starting with transcript:', {
    length: userTranscript.length,
    preview: userTranscript.substring(0, 100) + '...'
  });
  
  logger.api.request('/api/voice/conversation', 'POST', { 
    action: 'process',
    transcriptLength: userTranscript.length 
  });

  try {
    console.log('🌍 [PROCESS CONVERSATION] Making fetch request to /api/voice/conversation');
    
    const response = await fetch('/api/voice/conversation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: "process",
        userTranscript,
      }),
    });

    console.log('🌍 [PROCESS CONVERSATION] Got response:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [PROCESS CONVERSATION] API error response:', {
        status: response.status,
        statusText: response.statusText,
        errorBody: errorText.substring(0, 500) + '...'
      });
      throw handleApiError(response, 'Process conversation');
    }

    const data = await response.json();
    console.log('✅ [PROCESS CONVERSATION] Successfully parsed JSON response:', {
      hasMessage: !!data.message,
      messageLength: data.message?.length,
      questionNumber: data.questionNumber,
      isComplete: data.isComplete,
      hasAudio: data.hasAudio
    });
    
    logger.api.response('/api/voice/conversation', response.status, {
      hasAudio: !!data.hasAudio,
      messageLength: data.message?.length,
      questionNumber: data.questionNumber,
      isComplete: data.isComplete
    });

    return data;
  } catch (error) {
    console.error('❌ [PROCESS CONVERSATION] Network or parsing error:', {
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
};

/**
 * End conversation adapter
 */
export const endConversation = async (): Promise<{ summary?: string }> => {
  try {
    logger.api.request('/api/voice/conversation', 'POST', { action: 'summary' });

    const response = await fetch('/api/voice/conversation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: "summary",
      }),
    });

    if (response.ok) {
      const data = await response.json();
      logger.api.response('/api/voice/conversation', response.status, {
        hasSummary: !!data.summary
      });
      return data;
    } else {
      logger.warn('Failed to generate interview summary', { status: response.status });
      return {};
    }
  } catch (error) {
    logger.warn('Error generating interview summary', { error: error instanceof Error ? error.message : String(error) });
    return {};
  }
};

/**
 * Text-to-Speech adapter with streaming support
 */
export const textToSpeech = async (
  text: string, 
  options?: { streaming?: boolean; onChunk?: (chunk: ArrayBuffer) => void }
): Promise<Blob> => {
  return withRetry(async () => {
    // Sanitize text to remove Markdown formatting before TTS
    const sanitizedText = sanitizeInterviewText(text);
    
    logger.api.request('/api/voice/tts', 'POST', { 
      originalLength: text.length,
      sanitizedLength: sanitizedText.length,
      hadMarkdown: text !== sanitizedText,
      streaming: options?.streaming || false
    });

    const response = await fetch('/api/voice/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        text: sanitizedText,
        streaming: options?.streaming || false 
      }),
    });

    if (!response.ok) {
      throw handleApiError(response, 'Text-to-speech');
    }

    // Handle streaming response if requested
    if (options?.streaming && options.onChunk && response.body) {
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          chunks.push(value);
          
          // Convert chunk to ArrayBuffer and send to callback
          if (options.onChunk) {
            options.onChunk(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
          }
        }
        
        // Combine all chunks into final blob
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const combined = new Uint8Array(totalLength);
        let offset = 0;
        chunks.forEach(chunk => {
          combined.set(chunk, offset);
          offset += chunk.length;
        });
        
        const audioBlob = new Blob([combined], { type: 'audio/wav' });
        logger.api.response('/api/voice/tts', response.status, { 
          blobSize: audioBlob.size,
          chunksReceived: chunks.length,
          streaming: true
        });
        
        return audioBlob;
        
      } finally {
        reader.releaseLock();
      }
    } else {
      // Standard non-streaming response
      const audioBlob = await response.blob();
      logger.api.response('/api/voice/tts', response.status, { 
        blobSize: audioBlob.size,
        streaming: false 
      });
      
      return audioBlob;
    }
  }, 2, 'Text-to-speech');
};

/**
 * Play AI response using real Azure TTS with fallback handling
 */
export const playAIResponse = async (
  text: string,
  onStart?: () => void,
  onComplete?: () => void,
  onError?: (error: Error) => void
): Promise<void> => {
  console.log('🎯 [AZURE TTS] playAIResponse called', { 
    textLength: text.length, 
    hasOnStart: !!onStart,
    hasOnComplete: !!onComplete 
  });
  
  try {
    // Call onStart callback
    if (onStart) {
      console.log('🎯 [AZURE TTS] Calling onStart callback');
      onStart();
    }
    
    logger.audio.speak('Playing AI response via Azure TTS', { textLength: text.length });
    
    // Get audio from Azure TTS
    const audioBlob = await textToSpeech(text);
    
    if (!audioBlob || audioBlob.size === 0) {
      throw new Error('Empty audio response from TTS service');
    }
    
    console.log('🔊 [AZURE TTS] Playing audio', { 
      text: text.substring(0, 150) + (text.length > 150 ? '...' : ''),
      audioSize: audioBlob.size
    });
    
    // Play the audio using Web Audio API
    await playAudioFromBlob(audioBlob);
    
    console.log('🔊 [AZURE TTS] Audio playback completed');
    logger.audio.speak('Azure TTS playback completed');
    
    // Call onComplete callback
    if (onComplete) {
      console.log('🎯 [AZURE TTS] Calling onComplete callback');
      onComplete();
    }
    
    console.log('🎯 [AZURE TTS] playAIResponse finished successfully');
  } catch (error) {
    console.warn('🔊 [AZURE TTS] TTS service unavailable, using mock audio');
    const audioError = error instanceof Error ? error : new Error('TTS failed');
    logger.warn('Azure TTS not available, using fallback audio simulation');
    
    // Fallback to mock TTS timing simulation
    try {
      // Call onStart if not already called
      if (onStart) {
        onStart();
      }
      
      const wordsCount = text.split(' ').length;
      const readingDuration = Math.max(2500, wordsCount * 120); // 120ms per word, minimum 2.5 seconds
      
      console.log('🔊 [FALLBACK] Using audio simulation', { 
        wordsCount,
        duration: readingDuration + 'ms'
      });
      
      await new Promise(resolve => setTimeout(resolve, readingDuration));
      
      if (onComplete) {
        onComplete();
      }
      
      console.log('🔊 [FALLBACK] Audio simulation completed');
    } catch (fallbackError) {
      logger.warn('Fallback audio simulation failed, continuing anyway');
      // Always call onComplete to prevent conversation from hanging
      if (onComplete) {
        onComplete();
      }
    }
  }
};

/**
 * Play audio from blob using Web Audio API
 */
const playAudioFromBlob = async (audioBlob: Blob): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      // Create audio element for playback
      const audio = new Audio();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      audio.src = audioUrl;
      audio.preload = 'auto';
      
      // Set up event listeners
      audio.addEventListener('ended', () => {
        URL.revokeObjectURL(audioUrl);
        resolve();
      });
      
      audio.addEventListener('error', (error) => {
        URL.revokeObjectURL(audioUrl);
        reject(new Error(`Audio playback failed: ${error.message || 'Unknown error'}`));
      });
      
      // Start playback
      audio.play().catch((error) => {
        URL.revokeObjectURL(audioUrl);
        reject(new Error(`Audio play failed: ${error.message || 'Unknown error'}`));
      });
      
    } catch (error) {
      reject(new Error(`Audio setup failed: ${error instanceof Error ? error.message : String(error)}`));
    }
  });
};

/**
 * Play direct audio buffer with TTS fallback
 */
export const playDirectAudioWithFallback = async (
  audioData: number[] | Uint8Array,
  fallbackText: string,
  onStart?: () => void,
  onComplete?: () => void,
  onError?: (error: Error) => void
): Promise<void> => {
  if (validateAudioBuffer(audioData)) {
    try {
      onStart?.();
      await playAudioBuffer(audioData);
      logger.audio.speak('Direct audio playback completed');
      onComplete?.();
      return;
    } catch (error) {
      logger.warn('Direct audio failed, falling back to TTS', { error: error instanceof Error ? error.message : String(error) });
      // Fall through to TTS fallback
    }
  }

  // TTS fallback
  await playAIResponse(fallbackText, onStart, onComplete, onError);
};

/**
 * Combined conversation processing with audio playback
 */
export const processAndPlayResponse = async (
  userTranscript: string,
  onStart?: () => void,
  onComplete?: () => void,
  onError?: (error: Error) => void
): Promise<{
  userMessage: SavedMessage;
  aiMessage: SavedMessage;
  questionNumber?: number;
  isComplete?: boolean;
}> => {
  try {
    // Process conversation
    const data = await processConversation(userTranscript);
    
    // Create message objects
    const userMessage: SavedMessage = { role: "user", content: userTranscript };
    const aiMessage: SavedMessage = { role: "assistant", content: data.message };

    // Play response audio
    if (data.hasAudio && validateAudioBuffer(data.audioData)) {
      await playDirectAudioWithFallback(
        data.audioData!,
        data.message,
        onStart,
        onComplete,
        onError
      );
    } else {
      await playAIResponse(data.message, onStart, onComplete, onError);
    }

    return {
      userMessage,
      aiMessage,
      questionNumber: data.questionNumber,
      isComplete: data.isComplete
    };
  } catch (error) {
    const processError = error instanceof Error ? error : new Error('Processing failed');
    logger.error('Conversation processing failed', processError, {
      userTranscript: userTranscript.substring(0, 100),
      errorType: processError.name,
      errorMessage: processError.message
    });
    
    // Don't throw the error, instead provide fallback behavior
    console.warn('🔄 Conversation processing failed, attempting graceful recovery');
    
    // Create fallback response to prevent conversation from breaking
    const fallbackUserMessage: SavedMessage = { role: "user", content: userTranscript };
    const fallbackAIMessage: SavedMessage = { 
      role: "assistant", 
      content: "I apologize, I'm having some technical difficulties. Could you please repeat that or try rephrasing your response?" 
    };
    
    // Try to play the fallback response
    try {
      await playAIResponse(fallbackAIMessage.content, onStart, onComplete, onError);
    } catch (audioError) {
      console.warn('🔊 Fallback audio also failed, calling completion anyway');
      if (onComplete) onComplete();
    }
    
    return {
      userMessage: fallbackUserMessage,
      aiMessage: fallbackAIMessage,
      questionNumber: undefined,
      isComplete: false
    };
  }
};
