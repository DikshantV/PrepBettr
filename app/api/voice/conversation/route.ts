import { NextRequest, NextResponse } from 'next/server';
import { migrationOpenAIClient } from '@/lib/azure-ai-foundry/clients/migration-wrapper';
import { azureOpenAIServiceServer } from '@/azure/lib/services/azure-openai-service-server';
import { logger } from '@/lib/utils/logger';
import { InterviewContext } from '@/lib/voice/azure-adapters';

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
          return NextResponse.json(
            { error: 'AI service unavailable' },
            { status: 503 }
          );
        }
        console.log('✅ [CONVERSATION API] Azure OpenAI service initialized successfully');
      }

      switch (action) {
        case 'start': {
          const { interviewContext } = body;
          if (!interviewContext) {
            return NextResponse.json(
              { error: 'Interview context required for start action' },
              { status: 400 }
            );
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
            return NextResponse.json(
              { error: 'User transcript required for process action' },
              { status: 400 }
            );
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
          return NextResponse.json(
            { error: `Invalid action: ${action}` },
            { status: 400 }
          );
      }

    } catch (error) {
      logger.error('Conversation processing failed', error instanceof Error ? error : new Error(String(error)));

      // Provide helpful error responses
      if (error instanceof Error) {
        if (error.message.includes('quota') || error.message.includes('rate limit')) {
          return NextResponse.json(
            { error: 'AI service quota exceeded. Please try again later.' },
            { status: 429 }
          );
        }
        if (error.message.includes('authentication') || error.message.includes('unauthorized')) {
          return NextResponse.json(
            { error: 'AI service authentication failed' },
            { status: 401 }
          );
        }
        if (error.message.includes('timeout')) {
          return NextResponse.json(
            { error: 'AI service timeout. Please try again.' },
            { status: 408 }
          );
        }
      }

      return NextResponse.json(
        { error: 'Internal AI processing error' },
        { status: 500 }
      );
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
