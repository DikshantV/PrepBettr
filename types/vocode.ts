export enum MessageTypeEnum {
  TRANSCRIPT = "transcript",
  FUNCTION_CALL = "function-call",
  FUNCTION_CALL_RESULT = "function-call-result",
  ADD_MESSAGE = "add-message",
  AUDIO = "audio",
  SPEECH_START = "speech-start",
  SPEECH_END = "speech-end",
  ERROR = "error",
}

export enum MessageRoleEnum {
  USER = "user",
  SYSTEM = "system",
  ASSISTANT = "assistant",
}

export enum TranscriptMessageTypeEnum {
  PARTIAL = "partial",
  FINAL = "final",
}

export interface BaseMessage {
  type: MessageTypeEnum;
  conversation_id?: string;
  timestamp?: string;
}

export interface TranscriptMessage extends BaseMessage {
  type: MessageTypeEnum.TRANSCRIPT;
  role: MessageRoleEnum;
  transcriptType: TranscriptMessageTypeEnum;
  transcript: string;
}

export interface FunctionCallMessage extends BaseMessage {
  type: MessageTypeEnum.FUNCTION_CALL;
  functionCall: {
    name: string;
    parameters: unknown;
  };
}

export interface FunctionCallResultMessage extends BaseMessage {
  type: MessageTypeEnum.FUNCTION_CALL_RESULT;
  functionCallResult: {
    forwardToClientEnabled?: boolean;
    result: unknown;
    [a: string]: unknown;
  };
}

export interface AudioMessage extends BaseMessage {
  type: MessageTypeEnum.AUDIO;
  data: string; // Base64 encoded audio data
  format?: string; // Audio format (e.g., "webm", "mp3")
}

export interface SpeechStartMessage extends BaseMessage {
  type: MessageTypeEnum.SPEECH_START;
}

export interface SpeechEndMessage extends BaseMessage {
  type: MessageTypeEnum.SPEECH_END;
}

export interface ErrorMessage extends BaseMessage {
  type: MessageTypeEnum.ERROR;
  error: string;
  code?: string;
}

export type Message =
  | TranscriptMessage
  | FunctionCallMessage
  | FunctionCallResultMessage
  | AudioMessage
  | SpeechStartMessage
  | SpeechEndMessage
  | ErrorMessage;

// Variable values interfaces for Vocode workflows
// IMPORTANT: These interfaces define the contract between front-end variables and Vocode assistant configurations
// Any changes here must be synchronized with the Vocode assistant configurations

/**
 * Variables for the Generate Assistant (NEXT_PUBLIC_VOCODE_ASSISTANT_ID)
 * Vocode Placeholders: {{username}}
 * Used for personalized greeting in question generation assistant
 */
export interface GenerateAssistantVariables {
  username: string; // Maps to {{username}} placeholder in Vocode assistant greeting
}

/**
 * Variables for the Interview workflow (defined in constants/index.ts as 'interviewer')
 * Vocode Placeholders: {{candidateName}}, {{questions}}
 * Used for conducting personalized interviews with dynamic questions
 */
export interface InterviewWorkflowVariables {
  questions: string;      // Maps to {{questions}} placeholder - formatted as "- Question1\n- Question2"
  candidateName: string;  // Maps to {{candidateName}} placeholder in Vocode workflow greeting
}

// Union type for all possible variable values
export type VariableValues = GenerateAssistantVariables | InterviewWorkflowVariables;

// Vocode start method options
export interface VocodeStartOptions {
  variableValues: VariableValues;
  clientMessages: any[];
  serverMessages: any[];
}

// Vocode webhook event types
export enum VocodeEventType {
  CONVERSATION_STARTED = "conversation_started",
  CONVERSATION_ENDED = "conversation_ended", 
  FUNCTION_CALL = "function_call",
  TOOL_CALLS = "tool_calls",
  TRANSCRIPT = "transcript",
  AUDIO_RECEIVED = "audio_received",
  AUDIO_SENT = "audio_sent",
  ERROR = "error",
}

// Vocode webhook payload structure
export interface VocodeWebhookPayload {
  event_type: VocodeEventType;
  conversation_id: string;
  timestamp: string;
  message?: Message;
  function_call?: {
    name: string;
    parameters: any;
  };
  tool_calls?: Array<{
    id: string;
    tool_call_id?: string;
    function: {
      name: string;
      arguments?: any;
      parameters?: any;
    };
  }>;
  transcript?: {
    text: string;
    is_final: boolean;
    speaker: "human" | "bot";
  };
  audio?: {
    data: string; // Base64 encoded
    format: string;
  };
  error?: {
    message: string;
    code?: string;
  };
}

// Vocode assistant configuration
export interface VocodeAssistantConfig {
  name: string;
  first_message?: string;
  system_prompt?: string;
  model?: {
    provider: string;
    model: string;
    temperature?: number;
    max_tokens?: number;
  };
  voice?: {
    provider: string;
    voice_id: string;
    stability?: number;
    similarity_boost?: number;
    speed?: number;
  };
  transcriber?: {
    provider: string;
    model?: string;
    language?: string;
  };
  functions?: Array<{
    name: string;
    description: string;
    parameters: {
      type: string;
      properties: Record<string, any>;
      required?: string[];
    };
  }>;
  webhook_url?: string;
  webhook_secret?: string;
}

// Vocode conversation session
export interface VocodeConversationSession {
  conversation_id: string;
  assistant_id: string;
  status: "active" | "ended" | "error";
  websocket_url?: string;
  created_at: string;
  ended_at?: string;
  variable_values?: VariableValues;
}
