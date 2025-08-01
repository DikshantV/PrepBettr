const { GoogleGenerativeAI } = require("@google/generative-ai");
const { config } = require('dotenv');

config({ path: '.env.local' });

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY);

async function testGeminiAPI() {
    console.log('🔍 Testing Gemini API directly...');
    console.log('API Key configured:', !!process.env.GOOGLE_GENERATIVE_AI_API_KEY);
    console.log('API Key length:', process.env.GOOGLE_GENERATIVE_AI_API_KEY?.length || 0);
    
    const params = {
        role: 'Software Engineer',
        interview_type: 'technical',
        experience_level: 'mid-level',
        question_count: 3,
        technologies: 'JavaScript,React,Node.js'
    };
    
    console.log('\n📋 Test Parameters:', JSON.stringify(params, null, 2));
    
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        
        const prompt = `Prepare questions for a job interview.
        The job role is ${params.role}.
        The job experience level is ${params.experience_level}.
        The tech stack used in the job is: ${params.technologies}.
        The focus between behavioural and technical questions should lean towards: ${params.interview_type}.
        The amount of questions required is: ${params.question_count}.
        Please return only the questions, without any additional text.
        The questions are going to be read by a voice assistant so do not use "/" or "*" or any other special characters which might break the voice assistant.
        Return the questions formatted like this:
        ["Question 1", "Question 2", "Question 3"]
        
        Thank you! <3
    `;
    
        console.log('\n🚀 Calling Gemini API...');
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        console.log('✅ Gemini API Response:');
        console.log('Raw text:', text);
        
        // Test JSON parsing
        try {
            const questions = JSON.parse(text);
            console.log('✅ JSON parsing successful:');
            questions.forEach((q, i) => console.log(`   ${i + 1}. ${q}`));
        } catch (parseError) {
            console.log('❌ JSON parsing failed:', parseError.message);
            console.log('Raw response that failed to parse:', text);
        }
        
    } catch (error) {
        console.error('❌ Gemini API Error:');
        console.error('Error message:', error.message);
        console.error('Error status:', error.status);
        console.error('Error code:', error.code);
        console.error('Full error:', JSON.stringify(error, null, 2));
        
        // Check for specific error types
        if (error.message.includes('API key')) {
            console.error('🔑 API Key issue detected');
        }
        if (error.message.includes('quota') || error.message.includes('limit')) {
            console.error('📊 Quota/rate limit issue detected');
        }
        if (error.status === 503) {
            console.error('🚫 Service unavailable - this triggers retries');
        }
    }
}

testGeminiAPI().catch(console.error);
