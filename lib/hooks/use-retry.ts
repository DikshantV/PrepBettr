/**
 * Client-side React Hooks for Retry Operations
 * 
 * Provides React hooks that integrate with the retry middleware system
 * for handling voice conversation, file upload, and other API operations
 * with automatic retry logic and loading states.
 * 
 * Features:
 * - React hooks with loading/error state management
 * - Automatic retry with exponential backoff
 * - AbortController integration for cancellation
 * - Toast notifications for user feedback
 * - TypeScript support with structured errors
 * 
 * @version 1.0.0
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { 
  withRetry, 
  retryFetch, 
  RetryConfig, 
  RetryResult, 
  VOICE_SERVICE_RETRY_CONFIG, 
  FILE_UPLOAD_RETRY_CONFIG,
  QUICK_RETRY_CONFIG,
  DEFAULT_RETRY_CONFIG
} from '@/lib/utils/retry-middleware';
import { 
  StructuredError, 
  APIResponse, 
  ErrorCode, 
  toStructuredError,
  isRetryableError 
} from '@/lib/utils/structured-errors';

// ===== HOOK TYPES =====

export interface UseRetryState<T> {
  /** The result data if successful */
  data: T | null;
  
  /** Current error if any */
  error: StructuredError | null;
  
  /** Loading state */
  loading: boolean;
  
  /** Number of retry attempts made */
  retryCount: number;
  
  /** Total duration of operation in milliseconds */
  totalDuration: number;
  
  /** Whether operation was successful */
  success: boolean;
}

export interface UseRetryActions {
  /** Cancel ongoing operation */
  cancel: () => void;
  
  /** Reset state to initial values */
  reset: () => void;
  
  /** Check if operation can be cancelled */
  canCancel: boolean;
}

export interface UseRetryOptions<T> extends Partial<RetryConfig> {
  /** Show toast notifications for errors and retries */
  showToasts?: boolean;
  
  /** Custom error handler */
  onError?: (error: StructuredError) => void;
  
  /** Custom success handler */
  onSuccess?: (data: T) => void;
  
  /** Custom retry handler */
  onRetry?: (error: StructuredError, attempt: number, delay: number) => void;
  
  /** Enable automatic retry on component mount */
  autoRetry?: boolean;
  
  /** Delay before auto retry in milliseconds */
  autoRetryDelay?: number;
}

// ===== BASE RETRY HOOK =====

/**
 * Base hook for retry operations with React state management
 */
export function useRetry<T>(
  operation: () => Promise<T>,
  options: UseRetryOptions<T> = {}
): [UseRetryState<T>, () => Promise<void>, UseRetryActions] {
  const [state, setState] = useState<UseRetryState<T>>({
    data: null,
    error: null,
    loading: false,
    retryCount: 0,
    totalDuration: 0,
    success: false
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const operationRef = useRef(operation);
  const optionsRef = useRef(options);

  // Update refs when dependencies change
  useEffect(() => {
    operationRef.current = operation;
    optionsRef.current = options;
  }, [operation, options]);

  const execute = useCallback(async (): Promise<void> => {
    // Cancel any existing operation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();
    
    setState(prev => ({ 
      ...prev, 
      loading: true, 
      error: null, 
      retryCount: 0,
      totalDuration: 0,
      success: false
    }));

    const retryConfig: RetryConfig = {
      ...DEFAULT_RETRY_CONFIG,
      ...optionsRef.current,
      abortSignal: abortControllerRef.current.signal,
      onRetry: (error, attempt, delay) => {
        setState(prev => ({ 
          ...prev, 
          retryCount: attempt,
          error 
        }));
        
        // Show toast notification if enabled
        if (optionsRef.current.showToasts && typeof window !== 'undefined') {
          // You can integrate with your toast library here
          console.log(`🔄 Retrying in ${delay}ms (attempt ${attempt}): ${error.message}`);
        }
        
        optionsRef.current.onRetry?.(error, attempt, delay);
      },
      onMaxRetriesReached: (error, totalAttempts) => {
        if (optionsRef.current.showToasts && typeof window !== 'undefined') {
          console.error(`❌ Operation failed after ${totalAttempts} attempts: ${error.message}`);
        }
      }
    };

    try {
      const result: RetryResult<T> = await withRetry(operationRef.current, retryConfig);
      
      setState(prev => ({
        ...prev,
        loading: false,
        totalDuration: result.totalDuration,
        retryCount: result.totalAttempts - 1
      }));

      if (result.success && result.data !== undefined) {
        setState(prev => ({
          ...prev,
          data: result.data!,
          error: null,
          success: true
        }));
        
        if (optionsRef.current.showToasts && typeof window !== 'undefined') {
          console.log('✅ Operation completed successfully');
        }
        
        optionsRef.current.onSuccess?.(result.data!);
      } else if (result.error) {
        setState(prev => ({
          ...prev,
          data: null,
          error: result.error!,
          success: false
        }));
        
        optionsRef.current.onError?.(result.error);
      }
    } catch (error) {
      const structuredError = toStructuredError(error);
      
      setState(prev => ({
        ...prev,
        loading: false,
        data: null,
        error: structuredError,
        success: false
      }));
      
      optionsRef.current.onError?.(structuredError);
    }
  }, []);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setState(prev => ({ 
        ...prev, 
        loading: false 
      }));
    }
  }, []);

  const reset = useCallback(() => {
    cancel();
    setState({
      data: null,
      error: null,
      loading: false,
      retryCount: 0,
      totalDuration: 0,
      success: false
    });
  }, [cancel]);

  const actions: UseRetryActions = {
    cancel,
    reset,
    canCancel: state.loading
  };

  // Auto-retry on mount if enabled
  useEffect(() => {
    if (options.autoRetry) {
      const timer = setTimeout(() => {
        execute();
      }, options.autoRetryDelay || 0);
      
      return () => clearTimeout(timer);
    }
  }, [execute, options.autoRetry, options.autoRetryDelay]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return [state, execute, actions];
}

// ===== SPECIALIZED HOOKS =====

/**
 * Hook for voice conversation API calls with retry
 */
export function useVoiceConversation() {
  interface ConversationRequest {
    action: 'start' | 'process' | 'summary';
    interviewContext?: any;
    userTranscript?: string;
  }

  interface ConversationResponse {
    message?: string;
    questionNumber?: number;
    isComplete?: boolean;
    hasAudio?: boolean;
    followUpSuggestions?: string[];
    summary?: string;
    conversationHistory?: any[];
  }

  const conversationOperation = useCallback(async (request: ConversationRequest): Promise<ConversationResponse> => {
    const result = await retryFetch('/api/voice/conversation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    }, VOICE_SERVICE_RETRY_CONFIG);

    if (!result.success || !result.data) {
      throw result.error || new Error('Voice conversation request failed');
    }

    const apiResponse: APIResponse<ConversationResponse> = await result.data.json();
    
    if (!apiResponse.success) {
      throw apiResponse.error;
    }

    return apiResponse.data;
  }, []);

  const [state, , actions] = useRetry(
    () => conversationOperation({ action: 'start' }),
    {
      ...VOICE_SERVICE_RETRY_CONFIG,
      showToasts: true,
      onRetry: (error, attempt, delay) => {
        console.log(`🎙️ Retrying voice operation: ${error.message} (attempt ${attempt}, delay ${delay}ms)`);
      }
    }
  );

  const startConversation = useCallback(async (interviewContext: any): Promise<ConversationResponse> => {
    const result = await withRetry(
      () => conversationOperation({ action: 'start', interviewContext }),
      VOICE_SERVICE_RETRY_CONFIG
    );
    
    if (!result.success) {
      throw result.error;
    }
    
    return result.data!;
  }, [conversationOperation]);

  const processResponse = useCallback(async (userTranscript: string): Promise<ConversationResponse> => {
    const result = await withRetry(
      () => conversationOperation({ action: 'process', userTranscript }),
      VOICE_SERVICE_RETRY_CONFIG
    );
    
    if (!result.success) {
      throw result.error;
    }
    
    return result.data!;
  }, [conversationOperation]);

  const getSummary = useCallback(async (): Promise<ConversationResponse> => {
    const result = await withRetry(
      () => conversationOperation({ action: 'summary' }),
      VOICE_SERVICE_RETRY_CONFIG
    );
    
    if (!result.success) {
      throw result.error;
    }
    
    return result.data!;
  }, [conversationOperation]);

  return {
    state,
    actions,
    startConversation,
    processResponse,
    getSummary
  };
}

/**
 * Hook for file upload operations with retry
 */
export function useFileUpload() {
  interface UploadResponse {
    message: string;
    fileName: string;
    extractedText: string;
    questions: string[];
  }

  const uploadOperation = useCallback(async (file: File, authToken?: string): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);

    const headers: Record<string, string> = {};
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const result = await retryFetch('/api/upload-pdf', {
      method: 'POST',
      headers,
      body: formData,
    }, FILE_UPLOAD_RETRY_CONFIG);

    if (!result.success || !result.data) {
      throw result.error || new Error('File upload failed');
    }

    const apiResponse: APIResponse<UploadResponse> = await result.data.json();
    
    if (!apiResponse.success) {
      throw apiResponse.error;
    }

    return apiResponse.data;
  }, []);

  const [state, execute, actions] = useRetry(
    () => uploadOperation(new File([], 'dummy')), // Dummy operation, actual file passed to upload method
    {
      ...FILE_UPLOAD_RETRY_CONFIG,
      showToasts: true,
      onRetry: (error, attempt, delay) => {
        console.log(`📄 Retrying file upload: ${error.message} (attempt ${attempt}, delay ${delay}ms)`);
      }
    }
  );

  const upload = useCallback(async (file: File, authToken?: string): Promise<UploadResponse> => {
    const result = await withRetry(
      () => uploadOperation(file, authToken),
      FILE_UPLOAD_RETRY_CONFIG
    );
    
    if (!result.success) {
      throw result.error;
    }
    
    return result.data!;
  }, [uploadOperation]);

  return {
    state,
    actions,
    upload
  };
}

/**
 * Hook for API calls with automatic retry based on response status
 */
export function useApiCall<T = any>() {
  const apiOperation = useCallback(async (
    url: string,
    options: RequestInit = {},
    customRetryConfig?: Partial<RetryConfig>
  ): Promise<T> => {
    const result = await retryFetch(url, options, {
      ...QUICK_RETRY_CONFIG,
      ...customRetryConfig
    });

    if (!result.success || !result.data) {
      throw result.error || new Error('API request failed');
    }

    // Handle different response types
    const contentType = result.data.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const apiResponse: APIResponse<T> = await result.data.json();
      
      if (!apiResponse.success) {
        throw apiResponse.error;
      }
      
      return apiResponse.data;
    }
    
    // For non-JSON responses, return the Response object
    return result.data as unknown as T;
  }, []);

  const [state, , actions] = useRetry(
    () => apiOperation('/api/health'), // Default health check
    {
      showToasts: true,
      onRetry: (error, attempt, delay) => {
        console.log(`🌐 Retrying API call: ${error.message} (attempt ${attempt}, delay ${delay}ms)`);
      }
    }
  );

  const call = useCallback(async (
    url: string,
    options: RequestInit = {},
    retryConfig?: Partial<RetryConfig>
  ): Promise<T> => {
    const result = await withRetry(
      () => apiOperation(url, options, retryConfig),
      { ...QUICK_RETRY_CONFIG, ...retryConfig }
    );
    
    if (!result.success) {
      throw result.error;
    }
    
    return result.data!;
  }, [apiOperation]);

  return {
    state,
    actions,
    call
  };
}

// ===== UTILITY HOOKS =====

/**
 * Hook for managing retry state without executing operation
 */
export function useRetryState<T>(): [UseRetryState<T>, (state: Partial<UseRetryState<T>>) => void] {
  const [state, setState] = useState<UseRetryState<T>>({
    data: null,
    error: null,
    loading: false,
    retryCount: 0,
    totalDuration: 0,
    success: false
  });

  const updateState = useCallback((updates: Partial<UseRetryState<T>>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  return [state, updateState];
}

/**
 * Hook to check if an error is retryable
 */
export function useRetryCheck() {
  const checkRetryable = useCallback((error: unknown): boolean => {
    const structuredError = toStructuredError(error);
    return isRetryableError(structuredError);
  }, []);

  const getRetryDelay = useCallback((error: unknown, attempt: number): number => {
    const structuredError = toStructuredError(error);
    const baseDelay = (structuredError.retryAfter || 1) * 1000;
    return baseDelay * Math.pow(2, attempt - 1);
  }, []);

  return {
    checkRetryable,
    getRetryDelay
  };
}
