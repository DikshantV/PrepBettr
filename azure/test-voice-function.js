const { OpenAI } = require('openai');
const sdk = require('microsoft-cognitiveservices-speech-sdk');
const { v4: uuidv4 } = require('uuid');

async function testComponents() {
    console.log('Testing Azure Function components...\n');
    
    // Test OpenAI initialization
    console.log('1. Testing OpenAI connection...');
    try {
        const openaiClient = new OpenAI({
            apiKey: '1cf6caef55794eee9f30306e217d0f1d', // Replace with actual key
            baseURL: 'https://eastus2.api.cognitive.microsoft.com/openai/deployments/gpt4o',
            defaultQuery: { 'api-version': '2024-02-15-preview' },
            defaultHeaders: {
                'api-key': '1cf6caef55794eee9f30306e217d0f1d',
            },
        });
        
        const testCompletion = await openaiClient.chat.completions.create({
            model: 'gpt4o', // This should match the deployment name
            messages: [{ role: 'user', content: 'Say "Hello from Azure OpenAI!"' }],
            max_tokens: 10
        });
        
        console.log('✅ OpenAI Response:', testCompletion.choices[0].message.content);
    } catch (error) {
        console.log('❌ OpenAI Error:', error.message);
    }
    
    // Test Speech Service initialization
    console.log('\n2. Testing Speech Service...');
    try {
        const speechConfig = sdk.SpeechConfig.fromSubscription(
            '14ea2036305b4811bc3b0bcb4df6d2ad', // Replace with actual key
            'eastus2'
        );
        speechConfig.speechSynthesisVoiceName = 'en-US-JennyNeural';
        speechConfig.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3;
        
        const speechSynthesizer = new sdk.SpeechSynthesizer(speechConfig);
        
        const testText = 'Hello from Azure Speech Service!';
        
        const result = await new Promise((resolve, reject) => {
            speechSynthesizer.speakTextAsync(
                testText,
                (result) => {
                    if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
                        resolve(result);
                    } else {
                        reject(new Error(`Speech synthesis failed: ${result.errorDetails}`));
                    }
                },
                (error) => reject(error)
            );
        });
        
        console.log('✅ Speech synthesis completed. Audio size:', result.audioData.byteLength, 'bytes');
        
        speechSynthesizer.close();
        
    } catch (error) {
        console.log('❌ Speech Service Error:', error.message);
    }
    
    // Test UUID generation
    console.log('\n3. Testing UUID generation...');
    const testId = uuidv4();
    console.log('✅ Generated UUID:', testId);
    
    console.log('\n✅ Component testing completed!');
}

// Run the test
testComponents().catch(console.error);
