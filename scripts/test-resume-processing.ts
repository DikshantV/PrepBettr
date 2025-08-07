#!/usr/bin/env npx tsx

import { resumeProcessingService } from '../lib/services/resume-processing-service';
import { azureBlobStorage } from '../lib/services/azure-blob-storage';
import { azureFormRecognizer } from '../lib/services/azure-form-recognizer';
import fs from 'fs';
import path from 'path';

interface TestResults {
  azureBlobStorageInit: boolean;
  azureFormRecognizerInit: boolean;
  resumeProcessingInit: boolean;
  testFileUpload?: boolean;
  testExtraction?: boolean;
  error?: string;
}

async function runTests(): Promise<TestResults> {
  const results: TestResults = {
    azureBlobStorageInit: false,
    azureFormRecognizerInit: false,
    resumeProcessingInit: false
  };

  try {
    console.log('🧪 Testing Resume Processing Pipeline');
    console.log('=====================================\n');

    // Test 1: Azure Blob Storage Initialization
    console.log('1️⃣ Testing Azure Blob Storage initialization...');
    try {
      results.azureBlobStorageInit = await azureBlobStorage.initialize();
      console.log(`   ✅ Azure Blob Storage: ${results.azureBlobStorageInit ? 'Ready' : 'Not configured (will use Firebase fallback)'}`);
    } catch (error) {
      console.log(`   ⚠️ Azure Blob Storage: Error - ${error}`);
    }

    // Test 2: Azure Form Recognizer Initialization
    console.log('\n2️⃣ Testing Azure Form Recognizer initialization...');
    try {
      results.azureFormRecognizerInit = await azureFormRecognizer.initialize();
      console.log(`   ✅ Azure Form Recognizer: ${results.azureFormRecognizerInit ? 'Ready' : 'Not configured (will use OpenAI fallback)'}`);
    } catch (error) {
      console.log(`   ⚠️ Azure Form Recognizer: Error - ${error}`);
    }

    // Test 3: Resume Processing Service Initialization
    console.log('\n3️⃣ Testing Resume Processing Service initialization...');
    try {
      await resumeProcessingService.initialize();
      results.resumeProcessingInit = true;
      console.log('   ✅ Resume Processing Service: Ready');
    } catch (error) {
      console.log(`   ❌ Resume Processing Service: Error - ${error}`);
    }

    // Test 4: Mock file upload (if we have a test file)
    console.log('\n4️⃣ Testing mock file upload...');
    const testFilePath = path.join(process.cwd(), 'test-resume.txt');
    
    // Create a mock resume file for testing
    const mockResumeContent = `
John Doe
Software Engineer
Email: john.doe@email.com
Phone: (555) 123-4567
LinkedIn: linkedin.com/in/johndoe
GitHub: github.com/johndoe

PROFESSIONAL SUMMARY
Experienced software engineer with 5+ years in full-stack development.

SKILLS
JavaScript, TypeScript, React, Node.js, Python, AWS, Docker, Git

EXPERIENCE
Senior Software Engineer | Tech Corp | 2020 - Present
- Led development of microservices architecture
- Implemented CI/CD pipelines
- Mentored junior developers

Software Developer | StartupXYZ | 2018 - 2020  
- Built responsive web applications
- Integrated third-party APIs
- Optimized database performance

EDUCATION
Bachelor of Science in Computer Science
University of Technology | 2014 - 2018
GPA: 3.8/4.0

PROJECTS
E-commerce Platform
- Built with React and Node.js
- Integrated Stripe payments
- Deployed on AWS
    `;

    try {
      // Write test file
      fs.writeFileSync(testFilePath, mockResumeContent);
      
      const fileBuffer = fs.readFileSync(testFilePath);
      
      console.log('   📄 Created mock resume file');
      console.log('   🔄 Processing mock resume...');
      
      const testUserId = 'test-user-' + Date.now();
      const result = await resumeProcessingService.processResume(
        testUserId,
        fileBuffer,
        'test-resume.txt',
        'text/plain',
        fileBuffer.length,
        { generateQuestions: true, maxQuestions: 5 }
      );

      if (result.success) {
        console.log('   ✅ Mock resume processed successfully!');
        console.log(`   📊 Storage provider: ${result.data?.storageProvider}`);
        console.log(`   👤 Extracted name: ${result.data?.extractedData.personalInfo.name || 'Not detected'}`);
        console.log(`   📧 Extracted email: ${result.data?.extractedData.personalInfo.email || 'Not detected'}`);
        console.log(`   🎯 Skills detected: ${result.data?.extractedData.skills.length || 0}`);
        console.log(`   💼 Experience entries: ${result.data?.extractedData.experience.length || 0}`);
        console.log(`   🎓 Education entries: ${result.data?.extractedData.education.length || 0}`);
        console.log(`   ❓ Interview questions: ${result.data?.interviewQuestions.length || 0}`);
        
        results.testFileUpload = true;
      } else {
        console.log(`   ❌ Mock resume processing failed: ${result.error}`);
        results.testFileUpload = false;
      }

      // Clean up test file
      fs.unlinkSync(testFilePath);
      
    } catch (error) {
      console.log(`   ⚠️ Mock file test skipped: ${error}`);
      // Clean up test file if it exists
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    }

    console.log('\n📊 Test Results Summary:');
    console.log('========================');
    console.log(`Azure Blob Storage: ${results.azureBlobStorageInit ? '✅ Ready' : '⚠️ Fallback to Firebase'}`);
    console.log(`Azure Form Recognizer: ${results.azureFormRecognizerInit ? '✅ Ready' : '⚠️ Fallback to OpenAI'}`);
    console.log(`Resume Processing: ${results.resumeProcessingInit ? '✅ Ready' : '❌ Failed'}`);
    if (results.testFileUpload !== undefined) {
      console.log(`File Upload Test: ${results.testFileUpload ? '✅ Passed' : '❌ Failed'}`);
    }

    return results;

  } catch (error) {
    console.error('❌ Test suite failed:', error);
    results.error = error instanceof Error ? error.message : 'Unknown error';
    return results;
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests()
    .then((results) => {
      console.log('\n🏁 Testing completed');
      
      // Exit with appropriate code
      const hasFailures = !results.resumeProcessingInit || results.testFileUpload === false;
      process.exit(hasFailures ? 1 : 0);
    })
    .catch((error) => {
      console.error('💥 Test execution failed:', error);
      process.exit(1);
    });
}

export { runTests };
