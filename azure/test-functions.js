const https = require('https');

// Azure Function URLs
const BASE_URL = 'https://prepbettr-voiceagent-functions.azurewebsites.net/api';
const AZURE_FUNCTION_KEY = process.env.AZURE_FUNCTION_KEY;

if (!AZURE_FUNCTION_KEY) {
    console.error('❌ AZURE_FUNCTION_KEY environment variable is not set');
    process.exit(1);
}

const VOICE_SERVICE_URL = `${BASE_URL}/httptrigger1?code=${AZURE_FUNCTION_KEY}`;

// Test data
const testData = {
    start: {
        action: 'start',
        interviewContext: {
            type: 'technical',
            position: 'Software Engineer',
            company: 'PrepBettr',
            difficulty: 'medium'
        },
        userId: 'test-user-123'
    },
    status: {
        action: 'status'
    }
};

function makeRequest(url, data) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(data);
        
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(url, options, (res) => {
            let responseData = '';
            
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            
            res.on('end', () => {
                try {
                    const parsedData = JSON.parse(responseData);
                    resolve({
                        status: res.statusCode,
                        data: parsedData
                    });
                } catch (error) {
                    resolve({
                        status: res.statusCode,
                        data: responseData
                    });
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.write(postData);
        req.end();
    });
}

async function testFunctions() {
    console.log('🧪 Testing Azure Functions...\n');

    try {
        // Test 1: Status check
        console.log('1. Testing status endpoint...');
        const statusResponse = await makeRequest(VOICE_SERVICE_URL, testData.status);
        console.log(`   Status: ${statusResponse.status}`);
        console.log(`   Response:`, JSON.stringify(statusResponse.data, null, 2));
        console.log('');

        // Test 2: Start conversation
        console.log('2. Testing start conversation...');
        const startResponse = await makeRequest(VOICE_SERVICE_URL, testData.start);
        console.log(`   Status: ${startResponse.status}`);
        console.log(`   Response:`, JSON.stringify(startResponse.data, null, 2));
        console.log('');

        if (startResponse.data && startResponse.data.sessionId) {
            // Test 3: Process user response
            console.log('3. Testing process user response...');
            const processData = {
                action: 'process',
                sessionId: startResponse.data.sessionId,
                userTranscript: 'I have experience with JavaScript, Python, and React. I worked on several web applications.'
            };
            
            const processResponse = await makeRequest(VOICE_SERVICE_URL, processData);
            console.log(`   Status: ${processResponse.status}`);
            console.log(`   Response:`, JSON.stringify(processResponse.data, null, 2));
            console.log('');

            // Test 4: Get summary
            console.log('4. Testing interview summary...');
            const summaryData = {
                action: 'summary',
                sessionId: startResponse.data.sessionId
            };
            
            const summaryResponse = await makeRequest(VOICE_SERVICE_URL, summaryData);
            console.log(`   Status: ${summaryResponse.status}`);
            console.log(`   Response:`, JSON.stringify(summaryResponse.data, null, 2));
            console.log('');
        }

        console.log('✅ Function tests completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Run tests
testFunctions();
