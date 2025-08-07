/**
 * Manual test script for AzureOpenAIService preliminary questions flow
 * Run this to test the sequential preliminary questions without OpenAI API
 */

// Mock implementation of AzureOpenAIService for testing
class MockAzureOpenAIService {
  constructor() {
    this.prelimQuestions = [
      'What is your current role?',
      'What primary tech stack do you use?',
      'How many years of experience do you have?',
      'What are your key skills?',
      'How many interview questions would you like?'
    ];
    this.prelimIndex = 0;
    this.candidateProfile = {};
    this.interviewContext = { type: 'technical' };
    this.conversationHistory = [];
  }

  async startInterviewConversation() {
    this.prelimIndex = 0;
    this.candidateProfile = {};
    this.conversationHistory = [];

    const greeting = "Hello! Welcome to your interview practice session. Before we begin, I'd like to learn a bit about you.";
    const firstQuestion = this.prelimQuestions[0];
    const openingMessage = `${greeting}\n\n${firstQuestion}`;

    return {
      content: openingMessage,
      questionNumber: 0,
      isComplete: false
    };
  }

  async processUserResponse(userResponse) {
    // Check if we're still in preliminary questions phase
    if (this.prelimIndex < this.prelimQuestions.length) {
      // Store the user's answer
      const questionKeys = ['currentRole', 'techStack', 'yearsExperience', 'keySkills', 'questionCount'];
      this.candidateProfile[questionKeys[this.prelimIndex]] = userResponse;
      
      // Increment to next preliminary question
      this.prelimIndex++;
      
      // If there are more preliminary questions, return the next one
      if (this.prelimIndex < this.prelimQuestions.length) {
        const nextQuestion = this.prelimQuestions[this.prelimIndex];
        return {
          content: `Thank you! ${nextQuestion}`,
          questionNumber: 0,
          isComplete: false
        };
      } else {
        // Preliminary questions complete
        const systemContext = this.buildSystemContext();
        this.conversationHistory.push({ role: 'system', content: systemContext });
        
        const requestedQuestions = parseInt(this.candidateProfile.questionCount) || 10;
        this.interviewContext.maxQuestions = Math.min(Math.max(requestedQuestions, 5), 20);
        
        const openingMessage = this.getOpeningMessage();
        return {
          content: `Great! I now have a better understanding of your background. Let's begin the interview.\n\n${openingMessage}`,
          questionNumber: 1,
          isComplete: false
        };
      }
    }

    // Normal interview flow (mocked)
    return {
      content: "That's an interesting approach. Can you elaborate on how you would handle edge cases?",
      questionNumber: 2,
      isComplete: false,
      followUpSuggestions: ["Can you explain your thought process?", "What would you do differently?"]
    };
  }

  buildSystemContext() {
    const { currentRole, techStack, yearsExperience, keySkills } = this.candidateProfile;
    return `System Context:
- Role: ${currentRole}
- Tech Stack: ${techStack}
- Experience: ${yearsExperience} years
- Skills: ${keySkills}
- Interview Type: ${this.interviewContext.type}`;
  }

  getOpeningMessage() {
    const { currentRole, techStack, yearsExperience } = this.candidateProfile;
    const years = parseInt(yearsExperience);
    
    if (years < 3) {
      return `As someone with ${yearsExperience} years of experience in ${techStack}, can you explain a recent project where you used ${techStack.split(',')[0]?.trim() || 'your primary technology'} and what you learned from it?`;
    } else if (years < 7) {
      return `With your ${yearsExperience} years of experience as a ${currentRole}, can you describe a challenging technical problem you've solved using ${techStack.split(',')[0]?.trim() || 'your tech stack'} and walk me through your approach?`;
    } else {
      return `As a senior ${currentRole} with ${yearsExperience} years of experience, can you discuss a complex system design decision you've made and how your experience with ${techStack} influenced your approach?`;
    }
  }
}

// Test the flow
async function testPreliminaryFlow() {
  console.log('🚀 Testing Preliminary Questions Flow\n');
  console.log('=====================================\n');
  
  const service = new MockAzureOpenAIService();
  
  // Start interview
  console.log('📝 Starting Interview...\n');
  let response = await service.startInterviewConversation();
  console.log('AI:', response.content);
  console.log(`(Question #${response.questionNumber})\n`);
  
  // Simulate user answers
  const userAnswers = [
    'Senior Software Engineer',
    'React, Node.js, TypeScript, AWS',
    '5',
    'Full-stack development, System design, Team leadership',
    '10'
  ];
  
  for (let i = 0; i < userAnswers.length; i++) {
    console.log('User:', userAnswers[i]);
    response = await service.processUserResponse(userAnswers[i]);
    console.log('\nAI:', response.content);
    console.log(`(Question #${response.questionNumber})`);
    
    if (response.questionNumber > 0) {
      console.log('\n✅ Preliminary questions complete!');
      console.log('📊 Candidate Profile:', service.candidateProfile);
      console.log('🎯 Interview Settings:', {
        type: service.interviewContext.type,
        maxQuestions: service.interviewContext.maxQuestions
      });
    }
    console.log('\n---\n');
  }
  
  // Test one more normal interview response
  console.log('User: I would implement a microservices architecture with proper service boundaries...');
  response = await service.processUserResponse('I would implement a microservices architecture with proper service boundaries...');
  console.log('\nAI:', response.content);
  console.log(`(Question #${response.questionNumber})`);
  if (response.followUpSuggestions) {
    console.log('Suggestions:', response.followUpSuggestions);
  }
  
  console.log('\n=====================================');
  console.log('✅ Test Complete!');
}

// Run the test
testPreliminaryFlow().catch(console.error);
