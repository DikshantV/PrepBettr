import crypto from 'crypto';
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY);

// Verify VAPI webhook signature
function verifySignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

// Generate interview questions using Gemini AI
async function generateInterviewQuestions(params) {
  const { jobRole, interviewType, experienceLevel, questionCount, technologies } = params;
  
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  
  const prompt = `Generate ${questionCount} ${interviewType} interview questions for a ${experienceLevel} ${jobRole} position.

Focus areas: ${technologies ? technologies.join(', ') : 'General skills for the role'}

Requirements:
- Questions should be appropriate for ${experienceLevel} level
- Include a mix of technical and behavioral questions if applicable
- Make questions specific to ${jobRole} role
- Format as a numbered list
- Each question should be clear and concise

Return only the questions, numbered 1-${questionCount}.`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Error generating questions:', error);
    throw new Error('Failed to generate interview questions');
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get raw body for signature verification
    const body = JSON.stringify(req.body);
    const signature = req.headers['x-vapi-signature'];
    
    if (!signature) {
      console.error('Missing signature header');
      return res.status(401).json({ error: 'Missing signature' });
    }

    // Verify webhook signature
    if (!verifySignature(body, signature, process.env.VAPI_WEBHOOK_SECRET)) {
      console.error('Invalid signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const { message } = req.body;
    
    console.log('Received webhook:', JSON.stringify(message, null, 2));

    // Handle different message types
    if (message.type === 'function-call') {
      const { functionCall } = message;
      
      if (functionCall.name === 'generate_interview_questions') {
        try {
          const questions = await generateInterviewQuestions(functionCall.parameters);
          
          // Return the function result
          return res.status(200).json({
            result: questions
          });
          
        } catch (error) {
          console.error('Error in function call:', error);
          return res.status(200).json({
            error: error.message || 'Failed to generate interview questions'
          });
        }
      }
    }

    // For other message types, just acknowledge
    return res.status(200).json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Disable body parsing to get raw body for signature verification
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
}
