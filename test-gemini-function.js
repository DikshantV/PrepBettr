// Test the exact same Gemini API function logic as in the webhook
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config({ path: '.env.local' });

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY);

// Exact same function as in the webhook
async function generateInterviewQuestions(params) {
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
      console.log('Attempting to generate content with model: gemini-2.0-flash');
      console.log('Prompt:', prompt);
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      console.log('Success! Generated text:', text);
      return text;
    } catch (error) {
      console.error('Error generating questions:', error);
      console.error('Error status:', error.status);
      console.error('Error message:', error.message);
      
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

// Test with the same parameters as our webhook test
const testParams = {
  role: 'Software Engineer',
  interview_type: 'Technical',
  experience_level: 'Mid-level',
  question_count: 3,
  technologies: 'JavaScript, React, Node.js'
};

console.log('Testing Gemini API function locally...');
console.log('Test parameters:', JSON.stringify(testParams, null, 2));
console.log('API Key (first 10 chars):', process.env.GOOGLE_GENERATIVE_AI_API_KEY?.substring(0, 10) + '...');

generateInterviewQuestions(testParams)
  .then(result => {
    console.log('\n✅ SUCCESS! Function worked locally');
    console.log('Result:', result);
  })
  .catch(error => {
    console.error('\n❌ FAILED! Error in local test:', error.message);
    console.error('Full error:', error);
  });
