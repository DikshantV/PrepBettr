/**
 * Example usage of the Azure OpenAI AI Service Layer
 * 
 * This file demonstrates how to use the AI service layer with Azure OpenAI.
 */

import { 
  generateCoverLetter, 
  calculateRelevancy, 
  tailorResume, 
  generateQuestions,
  getProviderInfo,
  switchProvider 
} from './index';

async function exampleUsage() {
  console.log('🚀 AI Service Layer Example');
  
  // Example resume and job description
  const resumeText = `
John Doe
Software Engineer

Experience:
- 5 years of experience in web development
- Proficient in React, Node.js, TypeScript
- Led team of 3 developers
- Built scalable web applications

Education:
- Bachelor of Science in Computer Science
- University of Technology

Skills:
- React, Angular, Vue.js
- Node.js, Express.js
- TypeScript, JavaScript
- AWS, Docker, Kubernetes
  `;

  const jobDescription = `
Senior React Developer

We are seeking a Senior React Developer to join our growing team.

Requirements:
- 4+ years of React experience
- Strong TypeScript skills
- Experience with modern web technologies
- Team leadership experience
- AWS cloud experience preferred

Responsibilities:
- Lead frontend development initiatives
- Mentor junior developers
- Architect scalable React applications
- Collaborate with backend teams
  `;

  const resumeInfo = {
    name: 'John Doe',
    experience: '5 years of experience in web development with React, Node.js, TypeScript',
    education: 'Bachelor of Science in Computer Science',
    skills: 'React, Angular, Vue.js, Node.js, Express.js, TypeScript, JavaScript, AWS, Docker, Kubernetes'
  };

  try {
    // Check current provider
    console.log('\n📊 Current Provider:', getProviderInfo());

    // 1. Generate Cover Letter
    console.log('\n📝 Generating Cover Letter...');
    const coverLetterResponse = await generateCoverLetter(resumeText, jobDescription);
    
    if (coverLetterResponse.success) {
      console.log(`✅ Cover Letter Generated (${coverLetterResponse.provider}):`);
      console.log(coverLetterResponse.data?.substring(0, 200) + '...');
    } else {
      console.log('❌ Cover Letter Error:', coverLetterResponse.error);
    }

    // 2. Calculate Relevancy Score
    console.log('\n🎯 Calculating Relevancy Score...');
    const relevancyResponse = await calculateRelevancy(resumeText, jobDescription);
    
    if (relevancyResponse.success) {
      console.log(`✅ Relevancy Score (${relevancyResponse.provider}): ${relevancyResponse.data}/100`);
    } else {
      console.log('❌ Relevancy Error:', relevancyResponse.error);
    }

    // 3. Tailor Resume
    console.log('\n📋 Tailoring Resume...');
    const tailoredResponse = await tailorResume(resumeText, jobDescription);
    
    if (tailoredResponse.success) {
      console.log(`✅ Resume Tailored (${tailoredResponse.provider}):`);
      console.log(tailoredResponse.data?.substring(0, 200) + '...');
    } else {
      console.log('❌ Resume Tailoring Error:', tailoredResponse.error);
    }

    // 4. Generate Interview Questions
    console.log('\n❓ Generating Interview Questions...');
    const questionsResponse = await generateQuestions(resumeInfo);
    
    if (questionsResponse.success) {
      console.log(`✅ Questions Generated (${questionsResponse.provider}):`);
      questionsResponse.data?.forEach((question, i) => {
        console.log(`  ${i + 1}. ${question}`);
      });
    } else {
      console.log('❌ Questions Error:', questionsResponse.error);
    }

    // 5. Provider Info Example
    console.log('\n📊 Final Provider Info:', getProviderInfo());

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Environment variable examples
function showEnvironmentExamples() {
  console.log('\n🔧 Environment Variable Examples:');
  console.log('# Azure OpenAI Configuration (Required)');
  console.log('AI_PROVIDER=azure-openai');
  console.log('AZURE_TENANT_ID=your_tenant_id');
  console.log('AZURE_CLIENT_ID=your_client_id');
  console.log('AZURE_CLIENT_SECRET=your_client_secret');
  console.log('# (Plus other Azure OpenAI credentials)');
}

// Run example if this file is executed directly
if (require.main === module) {
  showEnvironmentExamples();
  exampleUsage().catch(console.error);
}

export { exampleUsage, showEnvironmentExamples };
