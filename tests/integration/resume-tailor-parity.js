#!/usr/bin/env node

/**
 * Simple integration test to verify Azure OpenAI resume tailoring functionality
 * Run with: node tests/integration/resume-tailor-parity.js
 */

// Check if we're in a Node.js environment that supports fetch
let fetch;
try {
  fetch = require('node-fetch');
} catch (err) {
  console.log('⚠️  node-fetch not available. Integration test requires server running.');
  console.log('   To run integration tests, start the server with: npm run dev');
  console.log('   Then test manually via the web interface.');
  process.exit(0);
}

const SAMPLE_RESUME = `
John Doe
Software Engineer
Email: john.doe@example.com
Phone: (555) 123-4567

SUMMARY
Experienced full-stack developer with 5 years of experience in web development, 
specializing in JavaScript, React, and Node.js. Passionate about creating scalable 
solutions and working in agile environments.

EXPERIENCE
Software Developer - Tech Corp (2019-2024)
• Developed and maintained web applications using React and Node.js
• Collaborated with cross-functional teams to deliver high-quality software
• Implemented RESTful APIs and database solutions
• Participated in code reviews and mentored junior developers

Junior Developer - StartupXYZ (2018-2019)
• Built responsive web interfaces using HTML, CSS, and JavaScript
• Worked with MySQL databases and PHP backend systems
• Contributed to improving application performance by 30%

EDUCATION
Bachelor of Science in Computer Science
University of Technology (2014-2018)

SKILLS
• Programming Languages: JavaScript, Python, Java, PHP
• Frontend: React, Vue.js, HTML5, CSS3, Bootstrap
• Backend: Node.js, Express.js, Laravel
• Databases: MySQL, PostgreSQL, MongoDB
• Tools: Git, Docker, AWS, Jenkins
`;

const SAMPLE_JOB_DESCRIPTION = `
Senior Full Stack Developer - CloudTech Solutions

We are seeking a Senior Full Stack Developer to join our growing team. The ideal 
candidate will have strong experience with modern web technologies and cloud platforms.

RESPONSIBILITIES:
• Design and develop scalable web applications using React and Node.js
• Work with Azure cloud services and implement CI/CD pipelines
• Collaborate with product managers and designers to deliver user-focused solutions
• Lead technical discussions and mentor junior team members
• Optimize application performance and ensure high availability

REQUIREMENTS:
• 5+ years of experience in full-stack web development
• Proficiency in React, Node.js, and TypeScript
• Experience with Azure cloud platform and DevOps practices
• Strong understanding of RESTful APIs and microservices architecture
• Knowledge of SQL and NoSQL databases
• Experience with Git, Docker, and CI/CD tools
• Excellent communication and leadership skills

PREFERRED QUALIFICATIONS:
• Experience with Azure Functions, App Service, and Azure DevOps
• Knowledge of Kubernetes and container orchestration
• Familiarity with agile development methodologies
• Bachelor's degree in Computer Science or related field
`;

async function testResumeTailoring() {
  console.log('🧪 Testing Azure OpenAI Resume Tailoring...\n');
  
  try {
    // Test the API endpoint
    const response = await fetch('http://localhost:3000/api/resume/tailor', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Note: This would normally require a valid session cookie
        'Cookie': 'session=test-session-for-integration-testing'
      },
      body: JSON.stringify({
        resumeText: SAMPLE_RESUME.trim(),
        jobDescription: SAMPLE_JOB_DESCRIPTION.trim()
      })
    });

    console.log(`📡 Response Status: ${response.status}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Request failed:', errorData);
      
      if (response.status === 401) {
        console.log('\n💡 Note: Authentication required. This test requires a valid session.');
        console.log('   To test manually, use the web interface or provide valid authentication.');
      }
      
      return;
    }

    const data = await response.json();
    
    if (data.success && data.tailoredResume) {
      console.log('✅ Resume tailoring successful!\n');
      console.log('📄 Original Resume Length:', SAMPLE_RESUME.length, 'characters');
      console.log('📄 Tailored Resume Length:', data.tailoredResume.length, 'characters');
      console.log('\n🎯 Tailored Resume Preview:');
      console.log('=' .repeat(60));
      console.log(data.tailoredResume.substring(0, 500) + '...');
      console.log('=' .repeat(60));
      
      // Basic validation checks
      const tailoredText = data.tailoredResume.toLowerCase();
      const jobDescText = SAMPLE_JOB_DESCRIPTION.toLowerCase();
      
      // Check if key terms from job description appear in tailored resume
      const keyTerms = [
        'azure', 'cloud', 'typescript', 'microservices', 
        'devops', 'ci/cd', 'docker', 'senior'
      ];
      
      console.log('\n🔍 Keyword Analysis:');
      keyTerms.forEach(term => {
        const inJob = jobDescText.includes(term);
        const inTailored = tailoredText.includes(term);
        const status = inJob && inTailored ? '✅' : inJob ? '⚠️ ' : '⭕';
        console.log(`  ${status} ${term}: Job=${inJob}, Tailored=${inTailored}`);
      });
      
      console.log('\n✅ Integration test completed successfully!');
    } else {
      console.error('❌ Unexpected response format:', data);
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Make sure the development server is running:');
      console.log('   npm run dev');
    }
  }
}

// Helper function to compare response structure
function validateResponseStructure(data, expectedKeys) {
  const missingKeys = expectedKeys.filter(key => !(key in data));
  if (missingKeys.length > 0) {
    console.warn('⚠️  Missing expected keys:', missingKeys);
  } else {
    console.log('✅ Response structure is valid');
  }
}

// Run the test
if (require.main === module) {
  testResumeTailoring();
}

module.exports = { testResumeTailoring, SAMPLE_RESUME, SAMPLE_JOB_DESCRIPTION };
