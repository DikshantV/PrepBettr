const { OpenAI } = require('openai');
const sdk = require('microsoft-cognitiveservices-speech-sdk');
const { v4: uuidv4 } = require('uuid');

// In-memory session storage (in production, use Azure Table Storage or Cosmos DB)
const sessions = new Map();

// Initialize services
let openaiClient = null;
let speechConfig = null;
let speechSynthesizer = null;

function initializeServices() {
    if (!openaiClient) {
        openaiClient = new OpenAI({
            apiKey: process.env.AZURE_OPENAI_KEY,
            baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT}`,
            defaultQuery: { 'api-version': '2024-02-15-preview' },
            defaultHeaders: {
                'api-key': process.env.AZURE_OPENAI_KEY,
            },
        });
    }
    
    if (!speechConfig) {
        speechConfig = sdk.SpeechConfig.fromSubscription(
            process.env.SPEECH_KEY,
            'eastus2'
        );
        speechConfig.speechSynthesisVoiceName = 'en-US-JennyNeural';
        speechConfig.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3;
    }
    
    if (!speechSynthesizer) {
        speechSynthesizer = new sdk.SpeechSynthesizer(speechConfig);
    }
}

function generateInterviewPrompt(interviewContext) {
    const { type, position, company, difficulty = 'medium' } = interviewContext;
    
    return `You are an experienced ${type} interviewer conducting a ${difficulty} level interview for a ${position} position at ${company}. 

Your responsibilities:
1. Ask relevant technical and behavioral questions appropriate for the role
2. Follow up on candidate responses with deeper questions
3. Provide constructive guidance when needed
4. Keep responses concise and conversational (2-3 sentences max)
5. Progress through different topics systematically

Interview flow:
- Start with an introduction and icebreaker
- Cover technical skills relevant to ${position}
- Include behavioral/situational questions
- Ask about experience and problem-solving
- End with candidate questions

Keep the tone professional but friendly. Respond naturally as if speaking aloud.`;
}

function createSession(interviewContext, userId) {
    const sessionId = uuidv4();
    const session = {
        id: sessionId,
        userId,
        interviewContext,
        startTime: new Date().toISOString(),
        messages: [
            {
                role: 'system',
                content: generateInterviewPrompt(interviewContext)
            }
        ],
        currentQuestion: null,
        status: 'active'
    };
    
    sessions.set(sessionId, session);
    return session;
}

async function processUserTranscript(sessionId, transcript, context) {
    const session = sessions.get(sessionId);
    if (!session) {
        throw new Error('Session not found');
    }
    
    context.log(`Processing transcript for session ${sessionId}: ${transcript}`);
    
    // Add user message to conversation
    session.messages.push({
        role: 'user',
        content: transcript,
        timestamp: new Date().toISOString()
    });
    
    try {
        // Get AI response from OpenAI
        const completion = await openaiClient.chat.completions.create({
            model: 'gpt4o', // Use deployment name
            messages: session.messages,
            max_tokens: 200,
            temperature: 0.7
        });
        
        const aiResponse = completion.choices[0].message.content;
        context.log(`AI Response: ${aiResponse}`);
        
        // Add AI response to conversation
        session.messages.push({
            role: 'assistant',
            content: aiResponse,
            timestamp: new Date().toISOString()
        });
        
        // Generate speech audio
        const audioBuffer = await synthesizeSpeech(aiResponse, context);
        
        // Update session
        session.currentQuestion = aiResponse;
        session.lastActivity = new Date().toISOString();
        
        return {
            aiResponse,
            audioBuffer: audioBuffer.toString('base64'),
            sessionId,
            timestamp: new Date().toISOString()
        };
        
    } catch (error) {
        context.log('Error processing with OpenAI:', error);
        throw error;
    }
}

async function synthesizeSpeech(text, context) {
    return new Promise((resolve, reject) => {
        context.log(`Synthesizing speech: ${text.substring(0, 100)}...`);
        
        speechSynthesizer.speakTextAsync(
            text,
            (result) => {
                if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
                    const audioBuffer = Buffer.from(result.audioData);
                    context.log(`Speech synthesis completed. Audio size: ${audioBuffer.length} bytes`);
                    resolve(audioBuffer);
                } else {
                    context.log(`Speech synthesis failed: ${result.errorDetails}`);
                    reject(new Error(`Speech synthesis failed: ${result.errorDetails}`));
                }
            },
            (error) => {
                context.log(`Speech synthesis error: ${error}`);
                reject(error);
            }
        );
    });
}

async function startInterview(interviewContext, userId, context) {
    const session = createSession(interviewContext, userId);
    context.log(`Started new interview session: ${session.id}`);
    
    // Generate opening question
    const openingPrompt = `Start the interview with a warm greeting and an opening question. Introduce yourself as the interviewer and begin with something like asking them to introduce themselves or tell you about their background.`;
    
    session.messages.push({
        role: 'user',
        content: openingPrompt,
        timestamp: new Date().toISOString()
    });
    
    try {
        const completion = await openaiClient.chat.completions.create({
            model: 'gpt4o', // Use deployment name
            messages: session.messages,
            max_tokens: 150,
            temperature: 0.7
        });
        
        const openingQuestion = completion.choices[0].message.content;
        
        session.messages.push({
            role: 'assistant',
            content: openingQuestion,
            timestamp: new Date().toISOString()
        });
        
        session.currentQuestion = openingQuestion;
        
        // Generate speech for opening question
        const audioBuffer = await synthesizeSpeech(openingQuestion, context);
        
        return {
            sessionId: session.id,
            openingQuestion,
            audioBuffer: audioBuffer.toString('base64'),
            interviewContext: session.interviewContext,
            timestamp: new Date().toISOString()
        };
        
    } catch (error) {
        context.log('Error starting interview:', error);
        sessions.delete(session.id);
        throw error;
    }
}

function generateInterviewSummary(session) {
    const userMessages = session.messages.filter(m => m.role === 'user' && !m.content.includes('Start the interview'));
    const aiMessages = session.messages.filter(m => m.role === 'assistant');
    
    return {
        sessionId: session.id,
        duration: new Date() - new Date(session.startTime),
        totalQuestions: aiMessages.length,
        totalResponses: userMessages.length,
        interviewContext: session.interviewContext,
        startTime: session.startTime,
        endTime: new Date().toISOString(),
        conversation: session.messages.filter(m => m.role !== 'system').map(m => ({
            role: m.role,
            content: m.content,
            timestamp: m.timestamp
        }))
    };
}

module.exports = async function (context, req) {
    context.log('Voice Agent Function - Processing request');
    
    try {
        // Initialize services
        initializeServices();
        
        const body = req.body || {};
        const action = body.action || req.query.action || 'status';
        
        context.log(`Processing action: ${action}`);
        
        switch (action) {
            case 'start':
                const { interviewContext, userId } = body;
                if (!interviewContext || !userId) {
                    throw new Error('Missing required fields: interviewContext and userId');
                }
                
                const startResult = await startInterview(interviewContext, userId, context);
                
                context.res = {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                    body: {
                        success: true,
                        action: 'start',
                        data: startResult
                    }
                };
                break;
                
            case 'process':
                const { sessionId, userTranscript } = body;
                if (!sessionId || !userTranscript) {
                    throw new Error('Missing required fields: sessionId and userTranscript');
                }
                
                const processResult = await processUserTranscript(sessionId, userTranscript, context);
                
                context.res = {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                    body: {
                        success: true,
                        action: 'process',
                        data: processResult
                    }
                };
                break;
                
            case 'summary':
                const summarySessionId = body.sessionId;
                if (!summarySessionId) {
                    throw new Error('Missing required field: sessionId');
                }
                
                const session = sessions.get(summarySessionId);
                if (!session) {
                    throw new Error('Session not found');
                }
                
                const summary = generateInterviewSummary(session);
                session.status = 'completed';
                
                context.res = {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                    body: {
                        success: true,
                        action: 'summary',
                        data: summary
                    }
                };
                break;
                
            case 'status':
                const statusSessionId = body.sessionId;
                if (statusSessionId) {
                    const sessionStatus = sessions.get(statusSessionId);
                    if (!sessionStatus) {
                        throw new Error('Session not found');
                    }
                    
                    context.res = {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                        body: {
                            success: true,
                            action: 'status',
                            data: {
                                sessionId: statusSessionId,
                                status: sessionStatus.status,
                                currentQuestion: sessionStatus.currentQuestion,
                                messageCount: statusSessionId.messages?.length || 0,
                                lastActivity: sessionStatus.lastActivity
                            }
                        }
                    };
                } else {
                    // General system status
                    context.res = {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                        body: {
                            success: true,
                            action: 'status',
                            data: {
                                message: 'Voice Agent service is operational',
                                activeSessions: sessions.size,
                                services: {
                                    openai: !!openaiClient,
                                    speech: !!speechSynthesizer
                                },
                                timestamp: new Date().toISOString()
                            }
                        }
                    };
                }
                break;
                
            case 'clear':
                const clearSessionId = body.sessionId;
                if (clearSessionId) {
                    sessions.delete(clearSessionId);
                    context.log(`Cleared session: ${clearSessionId}`);
                } else {
                    sessions.clear();
                    context.log('Cleared all sessions');
                }
                
                context.res = {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                    body: {
                        success: true,
                        action: 'clear',
                        data: {
                            message: clearSessionId ? 'Session cleared' : 'All sessions cleared',
                            remainingSessions: sessions.size
                        }
                    }
                };
                break;
                
            default:
                throw new Error(`Unknown action: ${action}`);
        }
        
    } catch (error) {
        context.log('Voice Agent Error:', error);
        context.log('Error stack:', error.stack);
        
        context.res = {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
            body: {
                success: false,
                error: error.message,
                action: req.body?.action || 'unknown',
                timestamp: new Date().toISOString()
            }
        };
    }
};
