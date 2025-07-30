// Configure PrepBettr VAPI Assistant with proper system prompt and function calling
const fetch = global.fetch || require('node-fetch');
require('dotenv').config({ path: '.env.local' });

const VAPI_API_URL = 'https://api.vapi.ai';
const VAPI_API_KEY = process.env.VAPI_API_KEY;
const PREPBETTR_ASSISTANT_ID = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;
const SERVER_URL = process.env.VAPI_WEBHOOK_URL || 'https://your-domain.com/webhook'; // Update this
const SERVER_SECRET = process.env.VAPI_WEBHOOK_SECRET || 'your-webhook-secret'; // Update this

const assistantConfig = {
  "name": "PrepBettr Interview Assistant",
  "model": {
    "provider": "openai",
    "model": "gpt-4",
    "messages": [
      {
        "role": "system",
        "content": "You are PrepBettr, an AI interview assistant. Follow this EXACT flow:\n1. Greet: ask for job role\n2. Collect sequentially: interview type, experience level, question count, technologies/skills\n3. Confirm details and await 'yes'\n4. Call generate_interview_questions function with collected data\n5. Ask each generated question, transcribe user answers, give feedback\n6. Summarize performance at end.\nNever skip steps."
      }
    ],
    "temperature": 0.7,
    "maxTokens": 200,
    "tools": [
      {
        "type": "function",
        "function": {
          "name": "generate_interview_questions",
          "description": "Generate interview questions via Gemini API",
          "parameters": {
            "type": "object",
            "properties": {
              "role": { "type": "string" },
              "interview_type": { "type": "string" },
              "experience_level": { "type": "string" },
              "question_count": { "type": "integer" },
              "technologies": { "type": "string" }
            },
            "required": ["role","interview_type","experience_level","question_count","technologies"]
          }
        }
      }
    ]
  },
  "voice": {
    "provider": "vapi",
    "voiceId": "Elliot"
  },
  "firstMessage": "Hi there! I'm PrepBettr—your interview prep assistant. Let's start with your job role.",
  "firstMessageMode": "assistant-speaks-first"
};

async function updateAssistant() {
  console.log('Updating PrepBettr Assistant configuration...');
  console.log('Assistant ID:', PREPBETTR_ASSISTANT_ID);
  
  const response = await fetch(`${VAPI_API_URL}/assistant/${PREPBETTR_ASSISTANT_ID}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${VAPI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(assistantConfig)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Failed to update assistant: ${JSON.stringify(data)}`);
  }

  console.log('Assistant updated successfully!');
  console.log('Response:', JSON.stringify(data, null, 2));
  return data;
}

async function getAssistant() {
  console.log('Getting current assistant configuration...');
  
  const response = await fetch(`${VAPI_API_URL}/assistant/${PREPBETTR_ASSISTANT_ID}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${VAPI_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Failed to get assistant: ${JSON.stringify(data)}`);
  }

  console.log('Current Assistant Configuration:');
  console.log(JSON.stringify(data, null, 2));
  return data;
}

async function main() {
  try {
    if (!VAPI_API_KEY || !PREPBETTR_ASSISTANT_ID) {
      throw new Error('Missing VAPI_API_KEY or PREPBETTR_ASSISTANT_ID in environment variables');
    }

    // First show current config
    console.log('=== BEFORE UPDATE ===');
    await getAssistant();
    
    console.log('\n=== UPDATING ASSISTANT ===');
    await updateAssistant();
    
    console.log('\n=== AFTER UPDATE ===');
    await getAssistant();
    
    console.log('\n✅ Assistant configuration complete!');
    console.log('\nNext steps:');
    console.log('1. Set up webhook server (see webhook-server.js)');
    console.log('2. Update SERVER_URL and SERVER_SECRET in .env.local');
    console.log('3. Test the assistant in your application');
    
  } catch (error) {
    console.error('Error configuring assistant:', error);
  }
}

main();
