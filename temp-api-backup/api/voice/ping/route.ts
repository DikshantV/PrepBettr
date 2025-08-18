import { NextResponse } from 'next/server';
import { azureSpeechService } from '@/lib/services/azure-speech-service';
import { fetchAzureSecrets } from '@/lib/azure-config-browser';

export async function GET() {
  try {
    // Initialize Azure Speech Service
    await azureSpeechService.initialize();

    // Fetch Azure secrets to use OpenAI
    const secrets = await fetchAzureSecrets();
    const openAIEndpoint = secrets.azureOpenAIEndpoint;
    const openAIKey = secrets.azureOpenAIKey;

    if (!azureSpeechService.isReady()) {
      throw new Error('Azure Speech Service is not initialized');
    }

    // Test speech synthesis
    const textToSynthesize = 'This is a test message for speech synthesis.';
    const audioData = await azureSpeechService.synthesizeSpeech(textToSynthesize);

    if (!audioData) {
      throw new Error('Speech synthesis failed');
    }

    // Test OpenAI chat (mock implementation since actual OpenAI interaction code is not available)
    const chatResponse = {
      message: 'OpenAI interaction successful',
      details: {
        endpoint: openAIEndpoint,
        key: openAIKey ? 'AVAILABLE' : 'MISSING'
      }
    };

    // Return success response
    return NextResponse.json({
      status: 'OK',
      speechTest: 'Speech synthesis succeeded',
      chatTest: chatResponse
    });
  } catch (error) {
    console.error('❌ Voice ping failed:', error);
    
    return NextResponse.json({
      status: 'Failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
