import { NextRequest, NextResponse } from 'next/server';
import { azureOpenAIService } from '@/lib/services/azure-openai-service';
import { azureSpeechService } from '@/lib/services/azure-speech-service';

export async function POST(request: NextRequest) {
  try {
    const { action, userTranscript, interviewContext } = await request.json();

    // Initialize services if not already done
    if (!azureOpenAIService.isReady()) {
      const openaiInitialized = await azureOpenAIService.initialize();
      if (!openaiInitialized) {
        return NextResponse.json(
          { error: 'Failed to initialize Azure OpenAI service' },
          { status: 500 }
        );
      }
    }

    if (!azureSpeechService.isReady()) {
      const speechInitialized = await azureSpeechService.initialize();
      if (!speechInitialized) {
        return NextResponse.json(
          { error: 'Failed to initialize Azure Speech service' },
          { status: 500 }
        );
      }
    }

    switch (action) {
      case 'start':
        // Set interview context and start conversation
        if (interviewContext) {
          azureOpenAIService.setInterviewContext(interviewContext);
        }
        
        const startResponse = await azureOpenAIService.startInterviewConversation();
        
        // Generate speech audio for the opening message
        const openingAudio = await azureSpeechService.synthesizeSpeech(startResponse.content);
        
        return NextResponse.json({
          success: true,
          message: startResponse.content,
          questionNumber: startResponse.questionNumber,
          isComplete: startResponse.isComplete,
          hasAudio: !!openingAudio,
          audioData: openingAudio ? Array.from(new Uint8Array(openingAudio)) : null,
        });

      case 'process':
        if (!userTranscript) {
          return NextResponse.json(
            { error: 'User transcript is required for processing' },
            { status: 400 }
          );
        }

        // Process user response and generate AI response
        const processResponse = await azureOpenAIService.processUserResponse(userTranscript);
        
        // Generate speech audio for the AI response
        const responseAudio = await azureSpeechService.synthesizeSpeech(processResponse.content);
        
        return NextResponse.json({
          success: true,
          message: processResponse.content,
          questionNumber: processResponse.questionNumber,
          isComplete: processResponse.isComplete,
          followUpSuggestions: processResponse.followUpSuggestions,
          hasAudio: !!responseAudio,
          audioData: responseAudio ? Array.from(new Uint8Array(responseAudio)) : null,
        });

      case 'summary':
        // Generate interview summary
        const summary = await azureOpenAIService.generateInterviewSummary();
        
        return NextResponse.json({
          success: true,
          summary,
          conversationHistory: azureOpenAIService.getConversationHistory(),
        });

      case 'clear':
        // Clear conversation history
        azureOpenAIService.clearConversation();
        
        return NextResponse.json({
          success: true,
          message: 'Conversation cleared successfully',
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action specified' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('❌ Error in voice conversation API:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Health check endpoint
    const openaiReady = azureOpenAIService.isReady();
    const speechReady = azureSpeechService.isReady();
    
    return NextResponse.json({
      status: 'healthy',
      services: {
        azureOpenAI: openaiReady,
        azureSpeech: speechReady,
      },
      conversationHistory: azureOpenAIService.getConversationHistory(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Error in voice conversation health check:', error);
    return NextResponse.json(
      { 
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
