/**
 * E2E Tests for Job Posting URL Extraction and Resume Tailoring
 * 
 * Test Coverage:
 * 1. Valid LinkedIn/Indeed URLs with field extraction and resume tailoring
 * 2. Edge cases: invalid URLs, 404s, PDF links, non-job pages
 * 3. Authentication enforcement (401 for unauthenticated requests)
 * 4. End-to-end workflow testing
 */

const { test, expect } = require('@jest/globals');
const fetch = require('node-fetch');

// Mock Firebase Admin for testing
jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(() => ({
    auth: () => ({
      verifyIdToken: jest.fn()
    })
  })),
  auth: () => ({
    verifyIdToken: jest.fn()
  }),
  credential: {
    cert: jest.fn()
  }
}));

// Mock Azure OpenAI Service
jest.mock('@/lib/services/azure-openai-service', () => ({
  azureOpenAIService: {
    isReady: jest.fn(() => true),
    initialize: jest.fn(() => Promise.resolve(true)),
    processUserResponse: jest.fn((prompt) => Promise.resolve({
      content: JSON.stringify({
        jobTitle: "Software Engineer",
        company: "Tech Corp",
        location: "San Francisco, CA",
        description: "Join our engineering team to build amazing products.",
        requirements: ["Bachelor's degree", "3+ years experience", "JavaScript"],
        keySkills: ["React", "Node.js", "TypeScript", "AWS"]
      })
    })),
    tailorResume: jest.fn((resume, jobDesc) => Promise.resolve("Tailored resume content matching the job requirements"))
  }
}));

// Mock article extractor
jest.mock('@extractus/article-extractor', () => ({
  extract: jest.fn((html) => ({
    text: "Software Engineer position at Tech Corp. We are looking for experienced developers with React and Node.js skills."
  }))
}));

// Mock node-fetch
jest.mock('node-fetch');

// Test configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TEST_SESSION_COOKIE = 'test-session-token';

// Test data
const VALID_URLS = {
  linkedin: 'https://www.linkedin.com/jobs/view/1234567890',
  indeed: 'https://www.indeed.com/viewjob?jk=test-job-id'
};

const INVALID_URLS = {
  malformed: 'not-a-url',
  pdf: 'https://example.com/job.pdf',
  nonJob: 'https://google.com',
  notFound: 'https://www.linkedin.com/jobs/view/nonexistent'
};

const SAMPLE_RESUME = `
John Doe
Software Engineer
Email: john@example.com

EXPERIENCE
- Software Developer at ABC Corp (2020-2023)
- Built web applications using React and Node.js
- Collaborated with cross-functional teams

SKILLS
JavaScript, React, Node.js, Python, AWS
`;

describe('Job URL Extraction E2E Tests', () => {
  
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Mock successful authentication by default
    const mockFirebaseAdmin = require('firebase-admin');
    mockFirebaseAdmin.auth().verifyIdToken.mockResolvedValue({
      uid: 'test-user-id',
      email: 'test@example.com'
    });
  });

  describe('1. Valid URL Extraction Tests', () => {
    
    test('should extract job fields from LinkedIn URL and generate tailored resume', async () => {
      // Mock successful HTTP response
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: jest.fn((header) => {
            if (header === 'content-type') return 'text/html; charset=utf-8';
            return null;
          })
        },
        text: () => Promise.resolve('<html><body>Software Engineer at Tech Corp - Join our team!</body></html>')
      });

      // Test URL extraction endpoint
      const extractResponse = await fetch(`${BASE_URL}/api/resume/extract-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session=${TEST_SESSION_COOKIE}`
        },
        body: JSON.stringify({ url: VALID_URLS.linkedin })
      });

      expect(extractResponse.ok).toBe(true);
      const extractData = await extractResponse.json();
      
      expect(extractData.success).toBe(true);
      expect(extractData.data).toHaveProperty('jobTitle');
      expect(extractData.data).toHaveProperty('company');
      expect(extractData.data).toHaveProperty('location');
      expect(extractData.data).toHaveProperty('description');
      expect(extractData.data).toHaveProperty('requirements');
      expect(extractData.data).toHaveProperty('keySkills');
      expect(extractData.data).toHaveProperty('rawText');

      // Test resume tailoring with extracted data
      const tailorResponse = await fetch(`${BASE_URL}/api/resume/tailor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session=${TEST_SESSION_COOKIE}`
        },
        body: JSON.stringify({
          resumeText: SAMPLE_RESUME,
          jobDescription: extractData.data.description
        })
      });

      expect(tailorResponse.ok).toBe(true);
      const tailorData = await tailorResponse.json();
      
      expect(tailorData.success).toBe(true);
      expect(tailorData.tailoredResume).toContain('Tailored resume content');
    });

    test('should extract job fields from Indeed URL', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: jest.fn((header) => {
            if (header === 'content-type') return 'text/html; charset=utf-8';
            return null;
          })
        },
        text: () => Promise.resolve('<html><body>Frontend Developer at StartupXYZ</body></html>')
      });

      const response = await fetch(`${BASE_URL}/api/resume/extract-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session=${TEST_SESSION_COOKIE}`
        },
        body: JSON.stringify({ url: VALID_URLS.indeed })
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('jobTitle');
      expect(data.data).toHaveProperty('company');
    });
  });

  describe('2. Edge Case Tests', () => {
    
    test('should reject malformed URLs', async () => {
      const response = await fetch(`${BASE_URL}/api/resume/extract-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session=${TEST_SESSION_COOKIE}`
        },
        body: JSON.stringify({ url: INVALID_URLS.malformed })
      });

      expect(response.status).toBe(422);
      const data = await response.json();
      expect(data.error).toContain('Invalid URL');
    });

    test('should handle 404 responses', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      const response = await fetch(`${BASE_URL}/api/resume/extract-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session=${TEST_SESSION_COOKIE}`
        },
        body: JSON.stringify({ url: INVALID_URLS.notFound })
      });

      expect(response.status).toBe(502);
      const data = await response.json();
      expect(data.error).toContain('Could not fetch job description');
    });

    test('should reject PDF links', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: jest.fn((header) => {
            if (header === 'content-type') return 'application/pdf';
            return null;
          })
        }
      });

      const response = await fetch(`${BASE_URL}/api/resume/extract-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session=${TEST_SESSION_COOKIE}`
        },
        body: JSON.stringify({ url: INVALID_URLS.pdf })
      });

      expect(response.status).toBe(422);
      const data = await response.json();
      expect(data.error).toContain('does not point to an HTML resource');
    });

    test('should handle non-job pages gracefully', async () => {
      const mockExtract = require('@extractus/article-extractor').extract;
      mockExtract.mockReturnValueOnce({
        text: 'This is just a regular webpage with no job information.'
      });

      fetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: jest.fn((header) => {
            if (header === 'content-type') return 'text/html; charset=utf-8';
            return null;
          })
        },
        text: () => Promise.resolve('<html><body>Regular webpage content</body></html>')
      });

      const response = await fetch(`${BASE_URL}/api/resume/extract-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session=${TEST_SESSION_COOKIE}`
        },
        body: JSON.stringify({ url: INVALID_URLS.nonJob })
      });

      // Should still process but may return minimal data
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    test('should handle oversized content', async () => {
      const largeContent = 'x'.repeat(300000); // 300KB content
      
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: jest.fn((header) => {
            if (header === 'content-type') return 'text/html; charset=utf-8';
            return null;
          })
        },
        text: () => Promise.resolve(largeContent)
      });

      const response = await fetch(`${BASE_URL}/api/resume/extract-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session=${TEST_SESSION_COOKIE}`
        },
        body: JSON.stringify({ url: VALID_URLS.linkedin })
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Content size exceeds 256 kB');
    });
  });

  describe('3. Authentication Tests', () => {
    
    test('should return 401 for requests without session cookie', async () => {
      const response = await fetch(`${BASE_URL}/api/resume/extract-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url: VALID_URLS.linkedin })
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toContain('Authentication required');
    });

    test('should return 401 for invalid session tokens', async () => {
      const mockFirebaseAdmin = require('firebase-admin');
      mockFirebaseAdmin.auth().verifyIdToken.mockRejectedValueOnce(new Error('Invalid token'));

      const response = await fetch(`${BASE_URL}/api/resume/extract-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': 'session=invalid-token'
        },
        body: JSON.stringify({ url: VALID_URLS.linkedin })
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toContain('Invalid session');
    });

    test('should return 401 for unauthenticated resume tailoring requests', async () => {
      const response = await fetch(`${BASE_URL}/api/resume/tailor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          resumeText: SAMPLE_RESUME,
          jobDescription: 'Test job description'
        })
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toContain('Authentication required');
    });
  });

  describe('4. Resume Tailoring Validation Tests', () => {
    
    test('should require both resume text and job description', async () => {
      const response = await fetch(`${BASE_URL}/api/resume/tailor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session=${TEST_SESSION_COOKIE}`
        },
        body: JSON.stringify({
          resumeText: SAMPLE_RESUME
          // Missing jobDescription
        })
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Both resume text and job description are required');
    });

    test('should enforce text length limits', async () => {
      const longText = 'x'.repeat(60000); // Exceeds 50k limit
      
      const response = await fetch(`${BASE_URL}/api/resume/tailor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session=${TEST_SESSION_COOKIE}`
        },
        body: JSON.stringify({
          resumeText: longText,
          jobDescription: 'Test description'
        })
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Text length exceeds maximum limit');
    });
  });

  describe('5. Service Availability Tests', () => {
    
    test('should handle Azure OpenAI service unavailability', async () => {
      const mockAzureService = require('@/lib/services/azure-openai-service').azureOpenAIService;
      mockAzureService.isReady.mockReturnValueOnce(false);

      fetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: jest.fn((header) => {
            if (header === 'content-type') return 'text/html; charset=utf-8';
            return null;
          })
        },
        text: () => Promise.resolve('<html><body>Job content</body></html>')
      });

      const response = await fetch(`${BASE_URL}/api/resume/extract-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session=${TEST_SESSION_COOKIE}`
        },
        body: JSON.stringify({ url: VALID_URLS.linkedin })
      });

      expect(response.status).toBe(503);
      const data = await response.json();
      expect(data.error).toContain('Service temporarily unavailable');
    });
  });
});

// Utility functions for manual testing
const manualTestUtils = {
  /**
   * Test with real LinkedIn URL (for manual verification)
   */
  testRealLinkedInUrl: async (linkedinUrl, sessionCookie) => {
    console.log('Testing real LinkedIn URL:', linkedinUrl);
    
    try {
      const response = await fetch(`${BASE_URL}/api/resume/extract-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session=${sessionCookie}`
        },
        body: JSON.stringify({ url: linkedinUrl })
      });

      const data = await response.json();
      console.log('Response status:', response.status);
      console.log('Extracted data:', JSON.stringify(data, null, 2));
      
      return data;
    } catch (error) {
      console.error('Test failed:', error);
      throw error;
    }
  },

  /**
   * Test with real Indeed URL (for manual verification)
   */
  testRealIndeedUrl: async (indeedUrl, sessionCookie) => {
    console.log('Testing real Indeed URL:', indeedUrl);
    
    try {
      const response = await fetch(`${BASE_URL}/api/resume/extract-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session=${sessionCookie}`
        },
        body: JSON.stringify({ url: indeedUrl })
      });

      const data = await response.json();
      console.log('Response status:', response.status);
      console.log('Extracted data:', JSON.stringify(data, null, 2));
      
      return data;
    } catch (error) {
      console.error('Test failed:', error);
      throw error;
    }
  },

  /**
   * Test complete workflow: extraction + tailoring
   */
  testCompleteWorkflow: async (jobUrl, resumeText, sessionCookie) => {
    console.log('Testing complete workflow...');
    
    try {
      // Step 1: Extract job data
      const extractResponse = await fetch(`${BASE_URL}/api/resume/extract-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session=${sessionCookie}`
        },
        body: JSON.stringify({ url: jobUrl })
      });

      const extractData = await extractResponse.json();
      console.log('Extraction result:', extractData.success ? 'SUCCESS' : 'FAILED');
      
      if (!extractData.success) {
        throw new Error('Failed to extract job data: ' + extractData.error);
      }

      // Step 2: Tailor resume
      const tailorResponse = await fetch(`${BASE_URL}/api/resume/tailor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session=${sessionCookie}`
        },
        body: JSON.stringify({
          resumeText: resumeText,
          jobDescription: extractData.data.description
        })
      });

      const tailorData = await tailorResponse.json();
      console.log('Tailoring result:', tailorData.success ? 'SUCCESS' : 'FAILED');
      
      console.log('Complete workflow result:', {
        extraction: {
          jobTitle: extractData.data.jobTitle,
          company: extractData.data.company,
          location: extractData.data.location,
          keySkills: extractData.data.keySkills
        },
        tailoring: {
          success: tailorData.success,
          previewLength: tailorData.tailoredResume?.length || 0
        }
      });

      return {
        extractData,
        tailorData
      };
    } catch (error) {
      console.error('Workflow test failed:', error);
      throw error;
    }
  }
};

// Export for manual testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { manualTestUtils };
}
