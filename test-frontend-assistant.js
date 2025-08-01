const { config } = require('dotenv');

config({ path: '.env.local' });

// Test frontend assistant behavior
async function testFrontendAssistant() {
    console.log('🚀 Testing Frontend Assistant Interaction');
    console.log('========================================');
    
    // Check environment variables
    console.log('🔧 Environment Check:');
    console.log('- NEXT_PUBLIC_VAPI_WEB_TOKEN:', process.env.NEXT_PUBLIC_VAPI_WEB_TOKEN ? 'SET' : 'MISSING');
    console.log('- NEXT_PUBLIC_VAPI_ASSISTANT_ID:', process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID ? 'SET' : 'MISSING');
    console.log('- VAPI_WEBHOOK_SECRET:', process.env.VAPI_WEBHOOK_SECRET ? 'SET' : 'MISSING');
    
    // Test assistant greeting behavior
    console.log('\n📋 Expected Frontend Behavior:');
    console.log('1. User clicks "Call" button');
    console.log('2. VAPI starts with assistant ID:', process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID);
    console.log('3. Assistant should greet with correct name (using firstName from userName)');
    console.log('4. Assistant should call generate_interview_questions function');
    console.log('5. VAPI sends function call to webhook');
    console.log('6. Webhook calls Gemini API and returns questions');
    console.log('7. Assistant receives questions and reads them to user');
    
    // Test variable mapping
    const testUserName = "John Doe";
    const firstName = testUserName.split(' ')[0];
    
    console.log('\n👤 Variable Mapping Test:');
    console.log('- Full userName:', testUserName);
    console.log('- Extracted firstName:', firstName);
    console.log('- Maps to {{username}} in VAPI assistant');
    
    // Test webhook connection
    console.log('\n🔗 Testing Webhook Connection:');
    try {
        const response = await fetch('http://localhost:3000/api/vapi/webhook', {
            method: 'GET'
        });
        const data = await response.text();
        console.log('✅ Webhook endpoint is accessible:', response.status, data);
    } catch (error) {
        console.log('❌ Webhook endpoint error:', error.message);
    }
    
    // Test function call workflow (simulate what VAPI would send)
    console.log('\n🔧 Testing Function Call Workflow:');
    const crypto = require('crypto');
    
    const testFunctionCall = {
        message: {
            type: 'function-call',
            functionCall: {
                name: 'generate_interview_questions',
                parameters: {
                    role: 'Frontend Developer',
                    interview_type: 'technical',
                    experience_level: 'mid-level',
                    question_count: 3,
                    technologies: 'React,JavaScript,HTML,CSS'
                }
            }
        }
    };
    
    const body = JSON.stringify(testFunctionCall);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const messageToSign = timestamp + body;
    const signature = crypto.createHmac('sha256', process.env.VAPI_WEBHOOK_SECRET).update(messageToSign, 'utf8').digest('hex');
    
    try {
        const response = await fetch('http://localhost:3000/api/vapi/webhook', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-vapi-signature': signature,
                'x-vapi-timestamp': timestamp
            },
            body: body
        });
        
        const result = await response.text();
        console.log('✅ Function call test result:', response.status);
        
        if (response.status === 200) {
            try {
                const parsedResult = JSON.parse(result);
                if (parsedResult.result) {
                    const questions = JSON.parse(parsedResult.result);
                    console.log('✅ Questions generated successfully:');
                    questions.forEach((q, i) => console.log(`   ${i + 1}. ${q}`));
                }
            } catch (e) {
                console.log('⚠️  Response parsing error:', e.message);
                console.log('Raw response:', result);
            }
        } else {
            console.log('❌ Function call failed:', result);
        }
    } catch (error) {
        console.log('❌ Function call test error:', error.message);
    }
    
    console.log('\n✅ Frontend Assistant Test Complete!');
    console.log('\nExpected User Experience:');
    console.log('1. User sees greeting: "Hello [firstName]! I\'m your AI interviewer..."');
    console.log('2. Assistant generates personalized questions via Gemini');
    console.log('3. Questions are read aloud by the assistant');
    console.log('4. User can have interactive conversation');
}

testFrontendAssistant().catch(console.error);
