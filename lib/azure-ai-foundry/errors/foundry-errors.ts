/**
 * Azure AI Foundry Error Classes
 * 
 * Provides typed error classes for consistent error handling across the foundry system.
 */

export class FoundryError extends Error {
  public readonly code: string;
  public readonly context?: Record<string, any>;
  public readonly retryable: boolean;

  constructor(
    message: string,
    code: string = 'FOUNDRY_ERROR',
    context?: Record<string, any>,
    retryable: boolean = false
  ) {
    super(message);
    this.name = 'FoundryError';
    this.code = code;
    this.context = context;
    this.retryable = retryable;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      retryable: this.retryable,
      stack: this.stack
    };
  }
}

export class FoundryClientError extends FoundryError {
  public readonly status?: number;
  public readonly response?: any;

  constructor(
    message: string,
    status?: number,
    response?: any,
    context?: Record<string, any>
  ) {
    const code = status ? `CLIENT_ERROR_${status}` : 'CLIENT_ERROR';
    const retryable = status ? [408, 429, 500, 502, 503, 504].includes(status) : false;
    
    super(message, code, { ...context, status, response }, retryable);
    this.name = 'FoundryClientError';
    this.status = status;
    this.response = response;
  }
}

export class FoundryConfigError extends FoundryError {
  public readonly configKey?: string;

  constructor(message: string, configKey?: string, context?: Record<string, any>) {
    super(message, 'CONFIG_ERROR', { ...context, configKey }, false);
    this.name = 'FoundryConfigError';
    this.configKey = configKey;
  }
}

export class VoiceError extends Error {
  public readonly code: string;
  public readonly category: 'audio' | 'network' | 'session' | 'processing';
  public readonly context?: Record<string, any>;
  public readonly retryable: boolean;

  constructor(
    message: string,
    category: 'audio' | 'network' | 'session' | 'processing',
    code: string = 'VOICE_ERROR',
    context?: Record<string, any>,
    retryable: boolean = false
  ) {
    super(message);
    this.name = 'VoiceError';
    this.code = code;
    this.category = category;
    this.context = context;
    this.retryable = retryable;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      category: this.category,
      context: this.context,
      retryable: this.retryable,
      stack: this.stack
    };
  }
}

export class VoiceSessionError extends VoiceError {
  public readonly sessionId?: string;

  constructor(
    message: string,
    sessionId?: string,
    code: string = 'SESSION_ERROR',
    context?: Record<string, any>,
    retryable: boolean = false
  ) {
    super(message, 'session', code, { ...context, sessionId }, retryable);
    this.name = 'VoiceSessionError';
    this.sessionId = sessionId;
  }
}

export class VoiceAudioError extends VoiceError {
  public readonly audioType: 'input' | 'output' | 'processing';

  constructor(
    message: string,
    audioType: 'input' | 'output' | 'processing',
    code: string = 'AUDIO_ERROR',
    context?: Record<string, any>
  ) {
    super(message, 'audio', code, { ...context, audioType }, false);
    this.name = 'VoiceAudioError';
    this.audioType = audioType;
  }
}

export class AgentError extends FoundryError {
  public readonly agentName?: string;
  public readonly operation?: string;

  constructor(
    message: string,
    agentName?: string,
    operation?: string,
    code: string = 'AGENT_ERROR',
    context?: Record<string, any>,
    retryable: boolean = true
  ) {
    super(message, code, { ...context, agentName, operation }, retryable);
    this.name = 'AgentError';
    this.agentName = agentName;
    this.operation = operation;
  }
}

/**
 * Error factory functions
 */

export const createFoundryClientError = (
  message: string,
  status?: number,
  response?: any,
  context?: Record<string, any>
) => new FoundryClientError(message, status, response, context);

export const createFoundryConfigError = (
  message: string,
  configKey?: string,
  context?: Record<string, any>
) => new FoundryConfigError(message, configKey, context);

export const createVoiceSessionError = (
  message: string,
  sessionId?: string,
  code?: string,
  context?: Record<string, any>
) => new VoiceSessionError(message, sessionId, code, context);

export const createVoiceAudioError = (
  message: string,
  audioType: 'input' | 'output' | 'processing',
  code?: string,
  context?: Record<string, any>
) => new VoiceAudioError(message, audioType, code, context);

export const createAgentError = (
  message: string,
  agentName?: string,
  operation?: string,
  context?: Record<string, any>
) => new AgentError(message, agentName, operation, 'AGENT_ERROR', context);

/**
 * Error type guards
 */

export const isFoundryError = (error: any): error is FoundryError => {
  return error instanceof FoundryError;
};

export const isFoundryClientError = (error: any): error is FoundryClientError => {
  return error instanceof FoundryClientError;
};

export const isVoiceError = (error: any): error is VoiceError => {
  return error instanceof VoiceError;
};

export const isVoiceSessionError = (error: any): error is VoiceSessionError => {
  return error instanceof VoiceSessionError;
};

export const isVoiceAudioError = (error: any): error is VoiceAudioError => {
  return error instanceof VoiceAudioError;
};

export const isAgentError = (error: any): error is AgentError => {
  return error instanceof AgentError;
};

/**
 * Check if error is retryable
 */
export const isRetryableError = (error: any): boolean => {
  if (isFoundryError(error) || isVoiceError(error)) {
    return error.retryable;
  }
  return false;
};
