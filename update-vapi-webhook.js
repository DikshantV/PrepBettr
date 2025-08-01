const fetch = global.fetch || require('node-fetch');
require('dotenv').config({ path: '.env.local' });

async function updateVAPIWebhook() {
  const VAPI_API_KEY = process.env.VAPI_API_KEY;
  const ASSISTANT_ID = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;
  const WEBHOOK_URL = 'https://www.prepbettr.com/api/vapi/webhook';
  const WEBHOOK_SECRET = process.env.VAPI_WEBHOOK_SECRET;

  console.log('🔧 Updating VAPI webhook configuration...');
  console.log('Assistant ID:', ASSISTANT_ID);
  console.log('Webhook URL:', WEBHOOK_URL);
  console.log('Secret:', WEBHOOK_SECRET);

  try {
    const response = await fetch(`https://api.vapi.ai/assistant/${ASSISTANT_ID}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        serverUrl: WEBHOOK_URL,
        serverUrlSecret: WEBHOOK_SECRET
      })
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ VAPI webhook configuration updated successfully!');
      console.log('Server URL:', result.serverUrl);
      console.log('Secret synchronized:', !!result.serverUrlSecret);
      console.log('Configuration is now synchronized between VAPI dashboard and local environment.');
    } else {
      console.error('❌ Failed to update VAPI configuration:', result);
    }
  } catch (error) {
    console.error('❌ Error updating VAPI configuration:', error.message);
  }
}

updateVAPIWebhook();
