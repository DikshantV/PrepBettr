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
  const { role, interview_type, experience_level, question_count, technologies } = params;
  
  const jobRole = role;
  const interviewType = interview_type;
  const experienceLevel = experience_level;
  const questionCount = question_count;
  
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  
  const prompt = `Prepare questions for a job interview.
        The job role is ${jobRole}.
        The job experience level is ${experienceLevel}.
        The tech stack used in the job is: ${technologies ? (Array.isArray(technologies) ? technologies.join(', ') : technologies) : 'General skills for the role'}.
        The focus between behavioural and technical questions should lean towards: ${interviewType}.
        The amount of questions required is: ${questionCount}.
        Please return only the questions, without any additional text.
        The questions are going to be read by a voice assistant so do not use "/" or "*" or any other special characters which might break the voice assistant.
        Return the questions formatted like this:
        ["Question 1", "Question 2", "Question 3"]
        
        Thank you! <3
    `;

  let retries = 3;
  while (retries > 0) {
    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Error generating questions:', error);
      if (error.status === 503 && retries > 0) {
        retries--;
        console.log(`Retrying... attempts left: ${retries}`);
        await new Promise(res => setTimeout(res, 2000)); // wait 2 seconds
      } else {
        throw new Error('Failed to generate interview questions after multiple retries');
      }
    }
  }
  throw new Error('Failed to generate interview questions after multiple retries');
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ status: 'Pages Router webhook is active' });
  }
  
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
          console.log('Function call parameters:', JSON.stringify(functionCall.parameters, null, 2));
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
