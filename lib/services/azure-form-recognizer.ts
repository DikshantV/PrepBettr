import { DocumentAnalysisClient, AzureKeyCredential } from '@azure/ai-form-recognizer';
import { fetchAzureSecrets } from '@/azure/lib/azure-config';
import { logServerError } from '@/lib/errors';

// Types for extracted resume data
export interface ExtractedResumeData {
  personalInfo: {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    linkedin?: string;
    github?: string;
    website?: string;
  };
  summary?: string;
  skills: string[];
  experience: WorkExperience[];
  education: Education[];
  projects?: Project[];
  certifications?: Certification[];
  languages?: Language[];
  rawExtraction?: any; // Store raw extraction for GDPR export
}

export interface WorkExperience {
  company: string;
  position: string;
  startDate?: string;
  endDate?: string;
  isCurrent?: boolean;
  description: string;
  achievements?: string[];
  technologies?: string[];
  location?: string;
}

export interface Education {
  institution: string;
  degree: string;
  field: string;
  startDate?: string;
  endDate?: string;
  gpa?: number;
  description?: string;
  location?: string;
}

export interface Project {
  name: string;
  description: string;
  technologies?: string[];
  url?: string;
  github?: string;
  startDate?: string;
  endDate?: string;
}

export interface Certification {
  name: string;
  issuer: string;
  date?: string;
  expiryDate?: string;
  credentialId?: string;
  url?: string;
}

export interface Language {
  name: string;
  proficiency: string;
}

class AzureFormRecognizerService {
  private client: DocumentAnalysisClient | null = null;
  private modelId = 'prebuilt-document'; // Use prebuilt document model

  /**
   * Initialize the Azure Form Recognizer service
   */
  async initialize(): Promise<boolean> {
    try {
      const secrets = await fetchAzureSecrets();
      
      const endpoint = process.env.AZURE_FORM_RECOGNIZER_ENDPOINT || secrets.azureFormRecognizerEndpoint;
      const apiKey = process.env.AZURE_FORM_RECOGNIZER_KEY || secrets.azureFormRecognizerKey;

      if (!endpoint || !apiKey) {
        console.warn('⚠️ Azure Form Recognizer credentials not found, will use OpenAI fallback');
        return false;
      }

      this.client = new DocumentAnalysisClient(
        endpoint,
        new AzureKeyCredential(apiKey)
      );

      console.log('✅ Azure Form Recognizer service initialized');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Azure Form Recognizer:', error);
      logServerError(error as Error, { service: 'azure-form-recognizer', action: 'initialize' });
      return false;
    }
  }

  /**
   * Check if service is ready
   */
  isReady(): boolean {
    return this.client !== null;
  }

  /**
   * Extract resume data from buffer using Azure Form Recognizer
   */
  async extractResumeData(fileBuffer: Buffer, mimeType: string): Promise<ExtractedResumeData> {
    if (!this.isReady()) {
      throw new Error('Azure Form Recognizer service not initialized');
    }

    try {
      console.log('🔍 Extracting resume data with Azure Form Recognizer...');

      // Analyze the document
      const poller = await this.client!.beginAnalyzeDocument(this.modelId, fileBuffer);
      const result = await poller.pollUntilDone();

      // Extract text content from the document
      const fullText = result.content || '';
      
      // Store raw extraction for GDPR export
      const rawExtraction = {
        content: result.content,
        pages: result.pages,
        tables: result.tables,
        keyValuePairs: result.keyValuePairs,
        styles: result.styles
      };

      // Parse the extracted text to structure data
      const extractedData = await this.parseResumeContent(fullText);
      
      // Include raw extraction
      extractedData.rawExtraction = rawExtraction;

      console.log('✅ Resume data extracted successfully with Azure Form Recognizer');
      return extractedData;

    } catch (error) {
      console.error('Failed to extract resume data with Azure Form Recognizer:', error);
      logServerError(error as Error, { 
        service: 'azure-form-recognizer', 
        action: 'extract', 
        mimeType 
      });
      throw error;
    }
  }

  /**
   * Parse resume content using AI to extract structured data
   * This method uses OpenAI as a processing layer on top of Form Recognizer
   */
  private async parseResumeContent(text: string): Promise<ExtractedResumeData> {
    // We'll use tailorResume function as it's the main AI processing function available
    
    // Use OpenAI function calling to structure the extracted text
    const prompt = `
    Extract the following information from this resume text and return as JSON:
    
    {
      "personalInfo": {
        "name": "Full name",
        "email": "Email address",
        "phone": "Phone number",
        "address": "Address",
        "linkedin": "LinkedIn URL",
        "github": "GitHub URL",
        "website": "Personal website URL"
      },
      "summary": "Professional summary or objective",
      "skills": ["skill1", "skill2", ...],
      "experience": [
        {
          "company": "Company name",
          "position": "Job title",
          "startDate": "Start date",
          "endDate": "End date or 'Present'",
          "isCurrent": true/false,
          "description": "Job description",
          "achievements": ["achievement1", ...],
          "technologies": ["tech1", "tech2", ...],
          "location": "Location"
        }
      ],
      "education": [
        {
          "institution": "School name",
          "degree": "Degree type",
          "field": "Field of study",
          "startDate": "Start date",
          "endDate": "End date",
          "gpa": 3.5,
          "description": "Additional details",
          "location": "Location"
        }
      ],
      "projects": [
        {
          "name": "Project name",
          "description": "Project description",
          "technologies": ["tech1", "tech2", ...],
          "url": "Project URL",
          "github": "GitHub URL",
          "startDate": "Start date",
          "endDate": "End date"
        }
      ],
      "certifications": [
        {
          "name": "Certification name",
          "issuer": "Issuing organization",
          "date": "Issue date",
          "expiryDate": "Expiry date",
          "credentialId": "Credential ID",
          "url": "Verification URL"
        }
      ],
      "languages": [
        {
          "name": "Language name",
          "proficiency": "Proficiency level"
        }
      ]
    }
    
    Resume text:
    ${text}
    `;

    try {
      // Use the AI service to process the text
      const { tailorResume } = await import('@/lib/ai');
      
      // Create a structured extraction prompt
      const extractionResult = await tailorResume(text, prompt);
      
      if (extractionResult.success && extractionResult.data) {
        try {
          // Parse the JSON response
          const parsedData = typeof extractionResult.data === 'string' 
            ? JSON.parse(extractionResult.data) 
            : extractionResult.data;
            
          return {
            personalInfo: parsedData.personalInfo || {},
            summary: parsedData.summary,
            skills: parsedData.skills || [],
            experience: parsedData.experience || [],
            education: parsedData.education || [],
            projects: parsedData.projects || [],
            certifications: parsedData.certifications || [],
            languages: parsedData.languages || []
          };
        } catch (parseError) {
          console.warn('Failed to parse AI extraction result, using fallback parsing');
          return this.fallbackTextParsing(text);
        }
      }
      
      // Fallback to simple text parsing if AI fails
      return this.fallbackTextParsing(text);
      
    } catch (error) {
      console.warn('AI parsing failed, using fallback text parsing:', error);
      return this.fallbackTextParsing(text);
    }
  }

  /**
   * Fallback text parsing method
   */
  private fallbackTextParsing(text: string): ExtractedResumeData {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);
    
    // Simple regex patterns for basic extraction
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const phoneRegex = /(\+?1?[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g;
    const linkedinRegex = /linkedin\.com\/in\/[\w-]+/gi;
    const githubRegex = /github\.com\/[\w-]+/gi;

    const emails = text.match(emailRegex) || [];
    const phones = text.match(phoneRegex) || [];
    const linkedinUrls = text.match(linkedinRegex) || [];
    const githubUrls = text.match(githubRegex) || [];

    // Extract skills (simple keyword matching)
    const skillKeywords = [
      'javascript', 'typescript', 'python', 'java', 'react', 'node', 'express',
      'mongodb', 'sql', 'postgresql', 'mysql', 'docker', 'kubernetes', 'aws',
      'azure', 'gcp', 'git', 'html', 'css', 'angular', 'vue', 'spring',
      'django', 'flask', 'ruby', 'php', 'go', 'rust', 'c++', 'c#', 'swift',
      'kotlin', 'flutter', 'dart', 'tensorflow', 'pytorch', 'machine learning',
      'data science', 'artificial intelligence', 'blockchain', 'devops'
    ];

    const detectedSkills = skillKeywords.filter(skill => 
      text.toLowerCase().includes(skill.toLowerCase())
    );

    return {
      personalInfo: {
        email: emails[0],
        phone: phones[0],
        linkedin: linkedinUrls[0] ? `https://${linkedinUrls[0]}` : undefined,
        github: githubUrls[0] ? `https://${githubUrls[0]}` : undefined
      },
      skills: detectedSkills,
      experience: [],
      education: [],
      projects: [],
      certifications: [],
      languages: []
    };
  }
}

// Export singleton instance
export const azureFormRecognizer = new AzureFormRecognizerService();
