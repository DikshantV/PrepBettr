#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });

const AZURE_FUNCTION_KEY = process.env.AZURE_FUNCTION_KEY;

if (!AZURE_FUNCTION_KEY || AZURE_FUNCTION_KEY === 'YOUR_NEW_AZURE_FUNCTION_KEY_HERE') {
    console.error('❌ Please set AZURE_FUNCTION_KEY in your .env.local file');
    console.log('📝 Steps to get the new key:');
    console.log('1. Go to Azure Portal');
    console.log('2. Navigate to your Function App: prepbettr-voiceagent-functions');
    console.log('3. Go to Functions > httptrigger1 > Function Keys');
    console.log('4. Copy the default key value');
    console.log('5. Replace YOUR_NEW_AZURE_FUNCTION_KEY_HERE in .env.local with the actual key');
    process.exit(1);
}

console.log('✅ Azure Function Key is set');
console.log('🧪 Running Azure Function tests...');

// Import and run the test file
require('../azure/test-functions.js');
