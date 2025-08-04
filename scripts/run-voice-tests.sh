#!/bin/bash

# Voice System Testing Script
# Run comprehensive end-to-end tests for the voice interaction system

set -e

echo "🧪 PrepBettr Voice System Testing Suite"
echo "======================================="

# Check if we're in the correct directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Check if required dependencies are installed
echo "📦 Checking dependencies..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed"
    exit 1
fi

# Install tsx if not present
if ! command -v tsx &> /dev/null; then
    echo "📦 Installing tsx for TypeScript execution..."
    npm install -g tsx
fi

# Set environment variables for testing
export NODE_ENV=test
export AZURE_TESTING_MODE=true

echo "🔧 Setting up test environment..."

# Check if Azure credentials are available
echo "🔐 Checking Azure credentials..."
if [ -z "$AZURE_SPEECH_KEY" ] && [ -z "$AZURE_OPENAI_KEY" ]; then
    echo "⚠️  Warning: Azure credentials not found in environment variables"
    echo "   The tests will attempt to use Azure Key Vault credentials"
    echo "   Make sure your Azure configuration is properly set up"
fi

echo ""
echo "🚀 Starting voice system tests..."
echo ""

# Run the comprehensive test suite
echo "1️⃣ Running End-to-End Voice System Tests..."
tsx scripts/voice-system-test.ts

echo ""
echo "2️⃣ Testing API Health Endpoints..."

# Test the voice conversation API health
echo "   - Testing Voice Conversation API Health..."
curl -s -f http://localhost:3000/api/voice/conversation \
    -H "Content-Type: application/json" \
    | jq '.' || echo "❌ Voice Conversation API health check failed"

# Test the voice ping API
echo "   - Testing Voice Ping API..."
curl -s -f http://localhost:3000/api/voice/ping \
    -H "Content-Type: application/json" \
    | jq '.' || echo "❌ Voice Ping API health check failed"

echo ""
echo "3️⃣ Running Frontend Component Tests..."

# Check if the Agent component compiles correctly
echo "   - Checking Agent component compilation..."
npx tsc --noEmit components/Agent.tsx || echo "❌ Agent component has TypeScript errors"

echo ""
echo "4️⃣ Testing Voice Configuration..."

# Validate voice configuration
echo "   - Validating voice configuration..."
tsx -e "
import config from './lib/config/voice-config';
console.log('✅ Voice configuration loaded successfully');
console.log('   - Speech recognition language:', config.speech.recognition.language);
console.log('   - Default voice:', config.speech.synthesis.defaultVoice);
console.log('   - Max questions:', config.openai.interview.defaultMaxQuestions);
"

echo ""
echo "5️⃣ Performance Testing..."

# Simple performance test
echo "   - Running basic performance tests..."
time tsx -e "
import { azureSpeechService } from './lib/services/azure-speech-service';
import { azureOpenAIService } from './lib/services/azure-openai-service';

async function quickPerfTest() {
  console.log('Testing service initialization speed...');
  const startTime = Date.now();
  
  await Promise.all([
    azureSpeechService.initialize(),
    azureOpenAIService.initialize()
  ]);
  
  const endTime = Date.now();
  console.log(\`✅ Services initialized in \${endTime - startTime}ms\`);
}

quickPerfTest().catch(console.error);
"

echo ""
echo "📊 Test Summary"
echo "==============="

# Generate test summary
echo "✅ End-to-end voice system tests completed"
echo "✅ API health checks completed"
echo "✅ Component compilation checks completed"
echo "✅ Configuration validation completed"
echo "✅ Performance tests completed"

echo ""
echo "🎯 Next Steps:"
echo "1. Review the test results above for any failures"
echo "2. Test the voice interaction manually using the frontend"
echo "3. Monitor performance during actual usage"
echo "4. Check Azure service usage and costs"
echo "5. Gather user feedback on voice quality and responsiveness"

echo ""
echo "📝 Manual Testing Checklist:"
echo "□ Open the interview page in your browser"
echo "□ Test microphone permission request"
echo "□ Verify speech recognition accuracy"
echo "□ Check AI response quality and relevance"
echo "□ Test audio playback quality"
echo "□ Verify interview flow and question progression"
echo "□ Test error handling (network issues, microphone problems)"
echo "□ Check interview summary generation"

echo ""
echo "🏁 Voice system testing completed!"
echo "   Check the logs above for any issues that need attention."
