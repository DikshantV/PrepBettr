// Use built-in fetch if available (Node 18+), otherwise use https
const fetch = global.fetch || require('node-fetch');
require('dotenv').config({ path: '.env.local' });

const VAPI_API_URL = 'https://api.vapi.ai';
const VAPI_API_KEY = process.env.VAPI_API_KEY;
const PREPBETTR_ASSISTANT_ID = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;

const workflow = {
  name: 'PrepBettr Interview Workflow',
  nodes: [
    {
      "type": "Say",
      "message": "Welcome to the PrepBettr Interview Generator. Let's get started!"
    },
    {
      "type": "Gather",
      "variable": "role",
      "message": "What job role are you preparing for?"
    },
    {
      "type": "Gather",
      "variable": "interview_type",
      "message": "What type of interview is this? (technical, behavioral, etc.)"
    },
    {
      "type": "Gather",
      "variable": "experience",
      "message": "What is your experience level?"
    },
    {
      "type": "Gather",
      "variable": "question_count",
      "message": "How many questions would you like?"
    },
    {
      "type": "Gather",
      "variable": "technologies",
      "message": "List the technologies or skills you'd like covered."
    }
  ]
};

async function createWorkflow() {
  if (!VAPI_API_KEY) {
    throw new Error('VAPI_API_KEY not found in environment variables');
  }

  const response = await fetch(`${VAPI_API_URL}/v1/workflows`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VAPI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(workflow)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Failed to create workflow: ${JSON.stringify(data)}`);
  }

  return data.id;
}

async function attachWorkflowToAssistant(workflowId) {
  if (!VAPI_API_KEY || !PREPBETTR_ASSISTANT_ID) {
    throw new Error('VAPI_API_KEY or PREPBETTR_ASSISTANT_ID not found in environment variables');
  }

  const response = await fetch(`${VAPI_API_URL}/v1/assistants/${PREPBETTR_ASSISTANT_ID}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${VAPI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ workflow_id: workflowId })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Failed to attach workflow to assistant: ${JSON.stringify(data)}`);
  }

  console.log('Successfully attached workflow to assistant!');
}

async function testAPIConnection() {
  console.log('Testing API connection...');
  console.log('VAPI_API_KEY:', VAPI_API_KEY ? 'Present' : 'Missing');
  console.log('ASSISTANT_ID:', PREPBETTR_ASSISTANT_ID);
  
  // Try to get assistant info
  const response = await fetch(`${VAPI_API_URL}/assistant/${PREPBETTR_ASSISTANT_ID}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${VAPI_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  
  const data = await response.json();
  console.log('Assistant API Response:', response.status, data);
}

async function main() {
  try {
    await testAPIConnection();
    
    // Commenting out workflow creation for now
    // console.log('Creating workflow...');
    // const workflowId = await createWorkflow();
    // console.log(`Workflow created with ID: ${workflowId}`);

    // console.log('Attaching workflow to assistant...');
    // await attachWorkflowToAssistant(workflowId);
    // console.log('Workflow automation complete!');
  } catch (error) {
    console.error('Error in workflow automation:', error);
  }
}

main();
