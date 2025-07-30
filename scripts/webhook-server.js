// A simple webhook server for VAPI function calling
const http = require('http');
const { config } = require('dotenv');
const crypto = require('crypto');
const { GenerativeModel } = require('@google/generative-ai');

config({ path: '.env.local' });

const PORT = process.env.PORT || 5000;
const VAPI_WEBHOOK_SECRET = process.env.VAPI_WEBHOOK_SECRET;
const GEMINI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

if (!VAPI_WEBHOOK_SECRET) {
  throw new Error('VAPI_WEBHOOK_SECRET not found in environment variables');
}
if (!GEMINI_API_KEY) {
  throw new Error('GOOGLE_GENERATIVE_AI_API_KEY not found in environment variables');
}

const genAI = new GenerativeModel(GEMINI_API_KEY, { model: 'gemini-pro' });

const server = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/webhook') {
    // Verify signature
    const signature = req.headers['x-vapi-signature'];
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });
    req.on('end', async () => {
        const hmac = crypto.createHmac('sha256', VAPI_WEBHOOK_SECRET);
        hmac.update(body);
        const hash = hmac.digest('hex');

        if (signature !== hash) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Unauthorized' }));
            return;
        }

        try {
          const data = JSON.parse(body);
          const fc = data.message?.functionCall;

          if (fc && fc.name === "generate_interview_questions") {
              const p = fc.parameters;
              const prompt = `Generate ${p.question_count} ${p.interview_type} questions for a ${p.experience_level} ${p.role} role focusing on ${p.technologies}.`;
              const result = await genAI.generateContent(prompt);
              const response = {
                results: [{
                  toolCallId: fc.id,
                  result: result.response.text(),
                }]
              };
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(response));
          } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({}));
          }
        } catch (err) {
          console.error('Error processing webhook:', err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal Server Error' }));
        }
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`Webhook server listening on port ${PORT}`);
});

