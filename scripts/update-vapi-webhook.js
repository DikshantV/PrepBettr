// Update PrepBettr VAPI Assistant with correct webhook URL
const fetch = global.fetch || require('node-fetch');
require('dotenv').config({ path: '.env.local' });

const VAPI_API_URL = 'https://api.vapi.ai';
const VAPI_API_KEY = process.env.VAPI_API_KEY;
const PREPBETTR_ASSISTANT_ID = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;

// Use the correct webhook URL (App Router endpoint)
const WEBHOOK_URL = 'https://www.prepbettr.com/api/vapi/webhook';

async function updateAssistantWebhook() {
  console.log('Updating PrepBettr Assistant webhook URL...');
  console.log('Assistant ID:', PREPBETTR_ASSISTANT_ID);
  console.log('Webhook URL:', WEBHOOK_URL);
  
  const assistantConfig = {
    "serverUrl": WEBHOOK_URL,
    "serverUrlSecret": process.env.VAPI_WEBHOOK_SECRET,
  };

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

  console.log('Assistant webhook updated successfully!');
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
    
    console.log('\n=== UPDATING ASSISTANT WEBHOOK ===');
    await updateAssistantWebhook();
    
    console.log('\n=== AFTER UPDATE ===');
    await getAssistant();
    
    console.log('\n✅ Assistant webhook configuration complete!');
    console.log('\nThe assistant should now use:', WEBHOOK_URL);
    
  } catch (error) {
    console.error('Error updating assistant webhook:', error);
  }
}

main();
