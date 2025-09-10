import { NextRequest, NextResponse } from 'next/server';
import { migrationOpenAIClient } from '@/lib/azure-ai-foundry/clients/migration-wrapper';
import { azureOpenAIServiceServer } from '@/azure/lib/services/azure-openai-service-server';
import { logger } from '@/lib/utils/logger';
import { InterviewContext } from '@/lib/voice/azure-adapters';
import { ErrorCode, createErrorResponse, getHTTPStatusFromErrorCode } from '@/lib/utils/structured-errors';

interface ConversationRequest {
  action: 'start' | 'process' | 'summary';
  interviewContext?: InterviewContext;
  userTranscript?: string;
}

/**
 * Azure OpenAI Conversation API Endpoint
 * Handles interview conversation flow using Azure OpenAI
 */
export async function POST(request: NextRequest) {
    try {
      const body: ConversationRequest = await request.json();
      const { action } = body;

      logger.api.request('POST /api/voice/conversation', `Action: ${action}`);
      console.log('🎯 [CONVERSATION API] Processing request', { action, timestamp: new Date().toISOString() });

      // Initialize Azure OpenAI service if needed
      if (!azureOpenAIServiceServer.isReady()) {
        console.log('🔧 [CONVERSATION API] Initializing Azure OpenAI service...');
        const initialized = await azureOpenAIServiceServer.initialize();
        if (!initialized) {
          console.error('❌ [CONVERSATION API] Failed to initialize Azure OpenAI service');
          logger.error('Failed to initialize Azure OpenAI service');
          const err = createErrorResponse(ErrorCode.SERVICE_UNAVAILABLE, { service: 'azure-openai' }, 'AI service unavailable');
          const status = getHTTPStatusFromErrorCode(err.error.code);
          const res = NextResponse.json(err, { status });
          if (err.error.retryable && err.error.retryAfter) {
            res.headers.set('Retry-After', String(err.error.retryAfter));
            res.headers.set('X-Retry-After', String(err.error.retryAfter));
          }
          return res;
        }
        console.log('✅ [CONVERSATION API] Azure OpenAI service initialized successfully');
      }

      switch (action) {
        case 'start': {
          const { interviewContext } = body;
          if (!interviewContext) {
            const err = createErrorResponse(
              ErrorCode.MISSING_REQUIRED_FIELD,
              { field: 'interviewContext' },
              'Interview context required for start action'
            );
            return NextResponse.json(err, { status: getHTTPStatusFromErrorCode(err.error.code) });
          }

          // Set interview context in the service
          azureOpenAIServiceServer.setInterviewContext({
            type: mapInterviewType(interviewContext.type),
            position: extractJobRole(interviewContext),
            company: extractCompanyName(interviewContext),
            difficulty: 'medium', // Default difficulty
            preliminaryCollected: false,
            currentQuestionCount: 0,
            maxQuestions: 10
          });

          // Start the interview conversation
          const response = await azureOpenAIServiceServer.startInterviewConversation();
          
          logger.api.response('POST /api/voice/conversation', 200, {
            action: 'start',
            questionNumber: response.questionNumber,
            isComplete: response.isComplete
          });

          return NextResponse.json({
            message: response.content,
            questionNumber: response.questionNumber,
            isComplete: response.isComplete,
            hasAudio: false, // TTS will be handled separately
            followUpSuggestions: response.followUpSuggestions
          });
        }

        case 'process': {
          const { userTranscript } = body;
          if (!userTranscript || !userTranscript.trim()) {
            console.warn('📝 [CONVERSATION API] Empty transcript received');
            const err = createErrorResponse(
              ErrorCode.MISSING_REQUIRED_FIELD,
              { field: 'userTranscript' },
              'User transcript required for process action'
            );
            return NextResponse.json(err, { status: getHTTPStatusFromErrorCode(err.error.code) });
          }

          console.log('🧪 [CONVERSATION API] Processing user transcript', {
            length: userTranscript.trim().length,
            preview: userTranscript.trim().substring(0, 50) + '...'
          });

          try {
            // Process user response and get AI reply
            const response = await azureOpenAIServiceServer.processUserResponse(userTranscript.trim());

            console.log('✅ [CONVERSATION API] Successfully processed response', {
              contentLength: response.content?.length,
              questionNumber: response.questionNumber,
              isComplete: response.isComplete
            });

            logger.api.response('POST /api/voice/conversation', 200, {
              action: 'process',
              questionNumber: response.questionNumber,
              isComplete: response.isComplete,
              transcriptLength: userTranscript.length
            });

            return NextResponse.json({
              message: response.content,
              questionNumber: response.questionNumber,
              isComplete: response.isComplete,
              hasAudio: false, // TTS will be handled separately
              followUpSuggestions: response.followUpSuggestions
            });
          } catch (processError) {
            console.error('❌ [CONVERSATION API] Process user response failed:', processError);
            throw processError; // Re-throw to be caught by outer error handler
          }
        }

        case 'summary': {
          try {
            // Generate interview summary
            const summary = await azureOpenAIServiceServer.generateInterviewSummary();

            logger.api.response('POST /api/voice/conversation', 200, {
              action: 'summary',
              hasSummary: !!summary
            });

            return NextResponse.json({
              summary,
              conversationHistory: azureOpenAIServiceServer.getConversationHistory()
            });
          } catch (error) {
            logger.warn('Failed to generate summary, returning empty response', { error: error instanceof Error ? error.message : String(error) });
            return NextResponse.json({
              summary: null,
              error: 'Summary generation failed'
            });
          }
        }

        default:
          const err = createErrorResponse(
            ErrorCode.INVALID_PARAMETER,
            { action },
            `Invalid action: ${action}`
          );
          return NextResponse.json(err, { status: getHTTPStatusFromErrorCode(err.error.code) });
      }

    } catch (error) {
      logger.error('Conversation processing failed', error instanceof Error ? error : new Error(String(error)));

      // Provide helpful structured error responses
      let code: ErrorCode = ErrorCode.INTERNAL_SERVER_ERROR;
      const message = error instanceof Error ? error.message.toLowerCase() : '';

      if (message.includes('quota') || message.includes('rate limit')) {
        code = ErrorCode.RATE_LIMIT_EXCEEDED;
      } else if (message.includes('authentication') || message.includes('unauthorized')) {
        code = ErrorCode.AUTH_TOKEN_INVALID;
      } else if (message.includes('timeout')) {
        code = ErrorCode.SERVICE_TIMEOUT;
      } else if (message.includes('azure') || message.includes('openai')) {
        code = ErrorCode.AZURE_OPENAI_ERROR;
      }

      const err = createErrorResponse(code, { context: 'voice.conversation' });
      const status = getHTTPStatusFromErrorCode(code);
      const res = NextResponse.json(err, { status });
      if (err.error.retryable && err.error.retryAfter) {
        res.headers.set('Retry-After', String(err.error.retryAfter));
        res.headers.set('X-Retry-After', String(err.error.retryAfter));
      }
      return res;
    }
}

/**
 * Health check endpoint for conversation service
 */
export async function GET() {
  const isReady = azureOpenAIServiceServer.isReady();
  
  return NextResponse.json({
    service: 'Azure OpenAI Conversation',
    status: isReady ? 'ready' : 'not_initialized',
    timestamp: new Date().toISOString()
  }, { 
    status: isReady ? 200 : 503 
  });
}

// Helper functions
function mapInterviewType(type: string): 'technical' | 'behavioral' | 'general' {
  const normalizedType = type.toLowerCase();
  if (normalizedType.includes('technical')) return 'technical';
  if (normalizedType.includes('behavioral')) return 'behavioral';
  return 'general';
}

function extractJobRole(context: InterviewContext): string | undefined {
  // Try to extract job role from various sources
  if (context.resumeInfo?.candidateName) return context.resumeInfo.candidateName;
  if (context.questions && context.questions.length > 0) {
    // Look for role mentions in questions
    const roleMatch = context.questions[0].match(/(\w+\s+\w+)\s+(developer|engineer|manager|analyst|designer)/i);
    if (roleMatch) return roleMatch[0];
  }
  return undefined;
}

function extractCompanyName(context: InterviewContext): string | undefined {
  // Extract company name from context if available
  // This could be enhanced to parse from resume info or questions
  return undefined;
}
