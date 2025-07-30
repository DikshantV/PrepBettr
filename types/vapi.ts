export enum MessageTypeEnum {
  TRANSCRIPT = "transcript",
  FUNCTION_CALL = "function-call",
  FUNCTION_CALL_RESULT = "function-call-result",
  ADD_MESSAGE = "add-message",
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

export type Message =
  | TranscriptMessage
  | FunctionCallMessage
  | FunctionCallResultMessage;

// Variable values interfaces for VAPI workflows
// IMPORTANT: These interfaces define the contract between front-end variables and VAPI workflow placeholders
// Any changes here must be synchronized with the VAPI workflow configurations

/**
 * Variables for the Generate Assistant (NEXT_PUBLIC_VAPI_ASSISTANT_ID)
 * VAPI Placeholders: {{username}}
 * Used for personalized greeting in question generation assistant
 */
export interface GenerateAssistantVariables {
  username: string; // Maps to {{username}} placeholder in VAPI assistant greeting
}

/**
 * Variables for the Interview workflow (defined in constants/index.ts as 'interviewer')
 * VAPI Placeholders: {{candidateName}}, {{questions}}
 * Used for conducting personalized interviews with dynamic questions
 */
export interface InterviewWorkflowVariables {
  questions: string;      // Maps to {{questions}} placeholder - formatted as "- Question1\n- Question2"
  candidateName: string;  // Maps to {{candidateName}} placeholder in VAPI workflow greeting
}

// Union type for all possible variable values
export type VariableValues = GenerateAssistantVariables | InterviewWorkflowVariables;

// VAPI start method options
export interface VapiStartOptions {
  variableValues: VariableValues;
  clientMessages: any[];
  serverMessages: any[];
}
