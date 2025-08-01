import crypto from 'crypto';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync, appendFileSync } from 'fs';
import { join } from 'path';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!);

// Helper function to save webhook data to file
function saveWebhookData(headers: { [key: string]: string }, body: string, timestamp: string) {
  const logData = {
    capturedAt: new Date().toISOString(),
    timestamp,
    headers,
    rawBody: body,
    bodyLength: body.length,
    parsedBody: null as any
  };
  
  try {
    logData.parsedBody = JSON.parse(body);
  } catch (e) {
    logData.parsedBody = { error: 'Failed to parse JSON', body };
  }
  
  const logFile = join(process.cwd(), 'vapi-webhook-capture.json');
  const logEntry = JSON.stringify(logData, null, 2) + '\n\n---\n\n';
  
  try {
    appendFileSync(logFile, logEntry);
    console.log('Webhook data saved to:', logFile);
  } catch (error) {
    console.error('Failed to save webhook data:', error);
  }
}

// Verify VAPI webhook signature
function verifySignature(
  payload: string, 
  signature: string, 
  timestamp: string, 
  secret: string,
  messageId?: string
): boolean {
  try {
    // Remove signature prefix if present (e.g., "sha256=")
    const cleanSignature = signature.replace(/^sha256=/, '');
    
    // Create the message to sign: timestamp + payload (+ messageId if provided)
    let messageToSign = timestamp + payload;
    if (messageId) {
      messageToSign += messageId;
    }
    
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(messageToSign, 'utf8')
      .digest('hex');
    
    // Check if signatures have the same length before comparing
    if (cleanSignature.length !== expectedSignature.length) {
      return false;
    }
    
    return crypto.timingSafeEqual(
      Buffer.from(cleanSignature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

// Verify timestamp to prevent replay attacks (optional but recommended)
function verifyTimestamp(timestamp: string, toleranceInSeconds: number = 300): boolean {
  const now = Math.floor(Date.now() / 1000);
  const webhookTime = parseInt(timestamp, 10);
  
  if (isNaN(webhookTime)) {
    return false;
  }
  
  return Math.abs(now - webhookTime) <= toleranceInSeconds;
}

// Generate interview questions using Gemini AI
async function generateInterviewQuestions(params: any): Promise<string> {
  const { role, interview_type, experience_level, question_count, technologies } = params;
  
  const jobRole = role;
  const interviewType = interview_type;
  const experienceLevel = experience_level;
  const questionCount = question_count;
  
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  
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
    } catch (error: any) {
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

export async function POST(request: NextRequest) {
  try {
    // COMPREHENSIVE LOGGING FOR WEBHOOK ANALYSIS
    console.log('\n=== VAPI WEBHOOK REQUEST CAPTURED ===');
    console.log('Timestamp:', new Date().toISOString());
    
    // Log ALL headers
    console.log('\n--- ALL HEADERS ---');
    const allHeaders: { [key: string]: string } = {};
    request.headers.forEach((value, key) => {
      allHeaders[key] = value;
      console.log(`${key}: ${value}`);
    });
    
    // Get raw body for signature verification
    const body = await request.text();
    
    // Log the raw body
    console.log('\n--- RAW BODY ---');
    console.log('Body length:', body.length);
    console.log('Raw body:', body);
    
    // Parse and log the JSON payload
    let parsedPayload;
    try {
      parsedPayload = JSON.parse(body);
      console.log('\n--- PARSED JSON PAYLOAD ---');
      console.log(JSON.stringify(parsedPayload, null, 2));
    } catch (parseError) {
      console.log('\n--- BODY PARSE ERROR ---');
      console.log('Error parsing JSON:', parseError);
    }
    
    // Extract specific auth-related headers
    const signature = request.headers.get('x-vapi-signature');
    const timestamp = request.headers.get('x-vapi-timestamp');
    const messageId = request.headers.get('x-vapi-message-id'); // optional
    const authorization = request.headers.get('authorization');
    const userAgent = request.headers.get('user-agent');
    const contentType = request.headers.get('content-type');
    
    console.log('\n--- KEY AUTH HEADERS ---');
    console.log('x-vapi-signature:', signature);
    console.log('x-vapi-timestamp:', timestamp);
    console.log('x-vapi-message-id:', messageId);
    console.log('authorization:', authorization);
    console.log('user-agent:', userAgent);
    console.log('content-type:', contentType);
    
    // Save webhook data to file for analysis
    saveWebhookData(allHeaders, body, timestamp || 'no-timestamp');
    console.log('\n--- WEBHOOK DATA SAVED TO FILE ---');
    
    if (!signature) {
      console.error('Missing signature header');
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }
    
    if (!timestamp) {
      console.error('Missing timestamp header');
      return NextResponse.json({ error: 'Missing timestamp' }, { status: 401 });
    }

    // Verify timestamp to prevent replay attacks
    if (!verifyTimestamp(timestamp)) {
      console.error('Invalid or expired timestamp');
      return NextResponse.json({ error: 'Invalid timestamp' }, { status: 401 });
    }

    // Log signature verification details
    console.log('\n--- SIGNATURE VERIFICATION ---');
    console.log('Expected signature calculation:');
    console.log('- Payload length:', body.length);
    console.log('- Timestamp:', timestamp);
    console.log('- Message ID:', messageId || 'not provided');
    console.log('- Webhook secret available:', !!process.env.VAPI_WEBHOOK_SECRET);
    
    // Create verification message for logging
    let messageToSign = timestamp + body;
    if (messageId) {
      messageToSign += messageId;
    }
    console.log('- Message to sign length:', messageToSign.length);
    
    // Calculate expected signature for logging
    const expectedSignature = crypto
      .createHmac('sha256', process.env.VAPI_WEBHOOK_SECRET!)
      .update(messageToSign, 'utf8')
      .digest('hex');
    console.log('- Expected signature:', expectedSignature);
    console.log('- Received signature:', signature);
    console.log('- Signatures match:', signature?.replace(/^sha256=/, '') === expectedSignature);
    
    // Verify webhook signature
    const signatureValid = verifySignature(body, signature, timestamp, process.env.VAPI_WEBHOOK_SECRET!, messageId || undefined);
    console.log('- Signature verification result:', signatureValid);
    
    if (!signatureValid) {
      console.error('\n--- SIGNATURE VERIFICATION FAILED ---');
      console.error('This indicates either:');
      console.error('1. Wrong webhook secret');
      console.error('2. Payload modification');
      console.error('3. Incorrect signature format');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
    
    console.log('\n--- SIGNATURE VERIFICATION PASSED ---');

    const data = JSON.parse(body);
    const { message } = data;
    
    console.log('Received webhook:', JSON.stringify(message, null, 2));

    // Handle different message types
    if (message.type === 'function-call') {
      const { functionCall } = message;
      
      if (functionCall.name === 'generate_interview_questions') {
        try {
          console.log('Function call parameters:', JSON.stringify(functionCall.parameters, null, 2));
          const questionsText = await generateInterviewQuestions(functionCall.parameters);
          
          // Parse the JSON string returned by Gemini into an array
          let questionsArray: string[];
          try {
            questionsArray = JSON.parse(questionsText);
            console.log('Successfully parsed questions array:', questionsArray);
          } catch (parseError) {
            console.error('Failed to parse questions JSON:', parseError);
            console.error('Raw questions text:', questionsText);
            // Return a fallback error message as an array
            questionsArray = [
              "I apologize, but I'm experiencing technical difficulties generating interview questions at the moment.",
              "Please try again in a few moments.",
              "In the meantime, I can still conduct a general interview discussion with you."
            ];
          }
          
          // Return the function result as an array
          return NextResponse.json({
            result: questionsArray
          });
          
        } catch (error) {
          console.error('Error in function call:', error);
          return NextResponse.json({
            error: (error as Error).message || 'Failed to generate interview questions'
          });
        }
      }
    } else if (message.type === 'tool-calls') {
      // Handle the new VAPI tool-calls format
      console.log('Handling tool-calls format');
      const toolCalls = message.toolCalls || message.toolCallList;
      
      if (toolCalls && toolCalls.length > 0) {
        const toolCall = toolCalls[0];
        
        if (toolCall.function && toolCall.function.name === 'generate_interview_questions') {
          try {
            const parameters = toolCall.function.arguments;
            console.log('Tool call parameters:', JSON.stringify(parameters, null, 2));
            const questionsText = await generateInterviewQuestions(parameters);
            
            // Parse the JSON string returned by Gemini into an array
            let questionsArray: string[];
            try {
              questionsArray = JSON.parse(questionsText);
              console.log('Successfully parsed questions array:', questionsArray);
            } catch (parseError) {
              console.error('Failed to parse questions JSON:', parseError);
              console.error('Raw questions text:', questionsText);
              // Return a fallback error message as an array
              questionsArray = [
                "I apologize, but I'm experiencing technical difficulties generating interview questions at the moment.",
                "Please try again in a few moments.",
                "In the meantime, I can still conduct a general interview discussion with you."
              ];
            }
            
            // Return the tool result in the format VAPI expects
            return NextResponse.json({
              results: [{
                toolCallId: toolCall.id,
                result: questionsArray
              }]
            });
            
          } catch (error) {
            console.error('Error in tool call:', error);
            return NextResponse.json({
              results: [{
                toolCallId: toolCall.id,
                error: (error as Error).message || 'Failed to generate interview questions'
              }]
            });
          }
        }
      }
    }

    // For other message types, just acknowledge
    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'Webhook endpoint is active' });
}
