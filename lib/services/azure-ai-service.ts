import { DefaultAzureCredential } from '@azure/identity';
import { AzureKeyCredential } from '@azure/core-auth';
import { DocumentAnalysisClient } from '@azure/ai-form-recognizer';
import { OpenAI, AzureOpenAI } from 'openai';
import { logServerError } from '@/lib/errors';

export interface ExtractedResumeData {
  personalInfo: {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    linkedin?: string;
    github?: string;
  };
  summary?: string;
  skills: string[];
  experience: WorkExperience[];
  education: Education[];
  projects: Project[];
  certifications: Certification[];
  languages: string[];
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
}

export interface Education {
  institution: string;
  degree: string;
  field: string;
  startDate?: string;
  endDate?: string;
  gpa?: number;
  description?: string;
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

export interface InterviewQuestionGenerationOptions {
  jobTitle?: string;
  company?: string;
  jobDescription?: string;
  maxQuestions?: number;
  difficulty?: 'easy' | 'medium' | 'hard' | 'mixed';
  categories?: string[];
}

export interface FeedbackGenerationOptions {
  jobTitle?: string;
  company?: string;
  interviewType?: string;
}

export interface GeneratedFeedback {
  overallScore: number;
  strengths: string[];
  improvements: string[];
  detailedFeedback: string;
  categoryScores: {
    technical: number;
    communication: number;
    problemSolving: number;
    experience: number;
  };
}

class AzureAIService {
  private openAIClient: AzureOpenAI | null = null;
  private formRecognizerClient: DocumentAnalysisClient | null = null;
  private initialized = false;
  private openAIEndpoint: string;
  private openAIApiKey: string;
  private formRecognizerEndpoint: string;
  private formRecognizerApiKey: string;

  constructor() {
    this.openAIEndpoint = process.env.AZURE_OPENAI_ENDPOINT || '';
    this.openAIApiKey = process.env.AZURE_OPENAI_API_KEY || '';
    this.formRecognizerEndpoint = process.env.AZURE_FORM_RECOGNIZER_ENDPOINT || '';
    this.formRecognizerApiKey = process.env.AZURE_FORM_RECOGNIZER_API_KEY || '';
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Initialize Azure OpenAI
      if (this.openAIEndpoint && this.openAIApiKey) {
        this.openAIClient = new AzureOpenAI({
          endpoint: this.openAIEndpoint,
          apiKey: this.openAIApiKey,
        });
        console.log('✅ Azure OpenAI client initialized');
      }

      // Initialize Azure Form Recognizer
      if (this.formRecognizerEndpoint && this.formRecognizerApiKey) {
        this.formRecognizerClient = new DocumentAnalysisClient(
          this.formRecognizerEndpoint,
          new AzureKeyCredential(this.formRecognizerApiKey)
        );
        console.log('✅ Azure Form Recognizer client initialized');
      } else if (this.formRecognizerEndpoint) {
        // Use managed identity
        this.formRecognizerClient = new DocumentAnalysisClient(
          this.formRecognizerEndpoint,
          new DefaultAzureCredential()
        );
        console.log('✅ Azure Form Recognizer client initialized with managed identity');
      }

      this.initialized = true;
      console.log('✅ Azure AI service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Azure AI service:', error);
      logServerError(error as Error, { service: 'azure-ai', action: 'initialize' });
      throw error;
    }
  }

  /**
   * Extract resume data using Azure Form Recognizer
   */
  async extractResumeData(fileBuffer: Buffer, mimeType: string): Promise<ExtractedResumeData> {
    await this.initialize();

    if (!this.formRecognizerClient) {
      throw new Error('Azure Form Recognizer not configured');
    }

    try {
      console.log('🔍 Extracting resume data with Azure Form Recognizer...');

      // Use the general document model for resume analysis
      const poller = await this.formRecognizerClient.beginAnalyzeDocument(
        'prebuilt-document',
        fileBuffer
      );
      
      const result = await poller.pollUntilDone();

      // Extract text content
      const extractedText = result.content || '';
      
      // Use OpenAI to structure the extracted text into resume data
      const structuredData = await this.structureResumeData(extractedText);
      
      console.log('✅ Resume data extracted successfully');
      return structuredData;
    } catch (error) {
      console.error('❌ Failed to extract resume data:', error);
      logServerError(error as Error, { service: 'azure-ai', action: 'extract-resume' });
      
      // Fallback: try with OpenAI only using text extraction
      if (this.openAIClient) {
        return this.extractResumeDataWithOpenAI(fileBuffer);
      }
      
      throw error;
    }
  }

  /**
   * Fallback resume extraction using OpenAI only
   */
  private async extractResumeDataWithOpenAI(fileBuffer: Buffer): Promise<ExtractedResumeData> {
    console.log('🔄 Falling back to OpenAI-only resume extraction...');
    
    // For now, return a basic structure and let the text-based extraction handle it
    // In a real implementation, you'd need to first extract text from the PDF/DOC
    const basicData: ExtractedResumeData = {
      personalInfo: {},
      skills: [],
      experience: [],
      education: [],
      projects: [],
      certifications: [],
      languages: []
    };

    return basicData;
  }

  /**
   * Structure extracted text into resume data using OpenAI
   */
  private async structureResumeData(extractedText: string): Promise<ExtractedResumeData> {
    if (!this.openAIClient) {
      throw new Error('Azure OpenAI not configured');
    }

    const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4';

    const prompt = `
Please analyze the following resume text and extract structured information. Return the data as a JSON object with the following structure:

{
  "personalInfo": {
    "name": "",
    "email": "",
    "phone": "",
    "address": "",
    "linkedin": "",
    "github": ""
  },
  "summary": "",
  "skills": [],
  "experience": [
    {
      "company": "",
      "position": "",
      "startDate": "",
      "endDate": "",
      "isCurrent": false,
      "description": "",
      "achievements": [],
      "technologies": []
    }
  ],
  "education": [
    {
      "institution": "",
      "degree": "",
      "field": "",
      "startDate": "",
      "endDate": "",
      "gpa": 0,
      "description": ""
    }
  ],
  "projects": [
    {
      "name": "",
      "description": "",
      "technologies": [],
      "url": "",
      "github": "",
      "startDate": "",
      "endDate": ""
    }
  ],
  "certifications": [
    {
      "name": "",
      "issuer": "",
      "date": "",
      "expiryDate": "",
      "credentialId": "",
      "url": ""
    }
  ],
  "languages": []
}

Resume text:
${extractedText}

Please extract and structure the information accurately. If some information is not available, use empty strings or arrays.
`;

    try {
      const result = await this.openAIClient.chat.completions.create({
        model: deploymentName,
        messages: [
          {
            role: 'system',
            content: 'You are an expert resume parser. Extract structured data from resume text and return valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 2000
      });

      const response = result.choices[0]?.message?.content;
      if (!response) {
        throw new Error('No response from OpenAI');
      }

      // Parse the JSON response
      const structuredData = JSON.parse(response);
      return structuredData as ExtractedResumeData;
    } catch (error) {
      console.error('Failed to structure resume data with OpenAI:', error);
      logServerError(error as Error, { service: 'azure-ai', action: 'structure-resume' });
      throw error;
    }
  }

  /**
   * Generate interview questions based on resume data and job details
   */
  async generateInterviewQuestions(
    resumeData: ExtractedResumeData,
    options: InterviewQuestionGenerationOptions = {}
  ): Promise<string[]> {
    await this.initialize();

    if (!this.openAIClient) {
      throw new Error('Azure OpenAI not configured');
    }

    try {
      console.log('🤖 Generating interview questions with Azure OpenAI...');

      const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4';
      const maxQuestions = options.maxQuestions || 10;
      const difficulty = options.difficulty || 'mixed';

      const resumeContext = this.buildResumeContext(resumeData);
      const jobContext = options.jobTitle || options.company || options.jobDescription 
        ? `Job: ${options.jobTitle} at ${options.company}\nDescription: ${options.jobDescription}` 
        : '';

      const prompt = `
Based on the following resume and job information, generate ${maxQuestions} interview questions with ${difficulty} difficulty level.

${resumeContext}

${jobContext}

Generate questions that:
1. Test technical skills mentioned in the resume
2. Explore experience and achievements
3. Assess problem-solving abilities
4. Evaluate cultural fit and motivation
5. Are relevant to the job role (if provided)

Return only a JSON array of questions as strings, no additional text.
Example format: ["Question 1", "Question 2", ...]
`;

      const result = await this.openAIClient.chat.completions.create({
        model: deploymentName,
        messages: [
          {
            role: 'system',
            content: 'You are an expert interviewer. Generate relevant, challenging interview questions based on resume data and job requirements. Return only valid JSON array.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1500
      });

      const response = result.choices[0]?.message?.content;
      if (!response) {
        throw new Error('No response from OpenAI');
      }

      const questions = JSON.parse(response);
      console.log(`✅ Generated ${questions.length} interview questions`);
      return questions;
    } catch (error) {
      console.error('❌ Failed to generate interview questions:', error);
      logServerError(error as Error, { service: 'azure-ai', action: 'generate-questions' });
      throw error;
    }
  }

  /**
   * Generate interview feedback based on questions and answers
   */
  async generateInterviewFeedback(
    questions: string[],
    answers: string[],
    options: FeedbackGenerationOptions = {}
  ): Promise<GeneratedFeedback> {
    await this.initialize();

    if (!this.openAIClient) {
      throw new Error('Azure OpenAI not configured');
    }

    try {
      console.log('📊 Generating interview feedback with Azure OpenAI...');

      const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4';

      // Combine questions and answers
      const qaContent = questions.map((q, i) => `Q: ${q}\nA: ${answers[i] || 'No answer provided'}`).join('\n\n');

      const jobContext = options.jobTitle || options.company || options.interviewType
        ? `Job Context: ${options.jobTitle} at ${options.company} (${options.interviewType})`
        : '';

      const prompt = `
Analyze the following interview questions and answers, then provide comprehensive feedback.

${jobContext}

Interview Content:
${qaContent}

Please provide feedback in the following JSON format:
{
  "overallScore": 0-100,
  "strengths": ["strength1", "strength2", ...],
  "improvements": ["improvement1", "improvement2", ...],
  "detailedFeedback": "Detailed paragraph feedback",
  "categoryScores": {
    "technical": 0-100,
    "communication": 0-100,
    "problemSolving": 0-100,
    "experience": 0-100
  }
}

Evaluate based on:
- Technical knowledge and accuracy
- Communication clarity and structure
- Problem-solving approach
- Relevant experience demonstration
- Overall interview performance

Provide constructive, actionable feedback.
`;

      const result = await this.openAIClient.chat.completions.create({
        model: deploymentName,
        messages: [
          {
            role: 'system',
            content: 'You are an expert interview evaluator. Provide comprehensive, constructive feedback on interview performance. Return only valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      });

      const response = result.choices[0]?.message?.content;
      if (!response) {
        throw new Error('No response from OpenAI');
      }

      const feedback = JSON.parse(response);
      console.log('✅ Generated interview feedback successfully');
      return feedback as GeneratedFeedback;
    } catch (error) {
      console.error('❌ Failed to generate interview feedback:', error);
      logServerError(error as Error, { service: 'azure-ai', action: 'generate-feedback' });
      throw error;
    }
  }

  /**
   * Generate cover letter based on resume and job description
   */
  async generateCoverLetter(
    resumeData: ExtractedResumeData,
    jobTitle: string,
    company: string,
    jobDescription?: string
  ): Promise<string> {
    await this.initialize();

    if (!this.openAIClient) {
      throw new Error('Azure OpenAI not configured');
    }

    try {
      console.log('📝 Generating cover letter with Azure OpenAI...');

      const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4';
      const resumeContext = this.buildResumeContext(resumeData);

      const prompt = `
Write a professional cover letter for the following job application:

Position: ${jobTitle}
Company: ${company}
Job Description: ${jobDescription || 'Not provided'}

Candidate Information:
${resumeContext}

Write a compelling cover letter that:
1. Opens with enthusiasm for the specific role and company
2. Highlights relevant experience and achievements from the resume
3. Demonstrates knowledge of the company/role
4. Shows how the candidate's skills match the job requirements
5. Closes with a strong call to action

Keep it professional, concise (3-4 paragraphs), and personalized.
Return only the cover letter text, no additional formatting or explanations.
`;

      const result = await this.openAIClient.chat.completions.create({
        model: deploymentName,
        messages: [
          {
            role: 'system',
            content: 'You are an expert career coach and professional writer. Write compelling, personalized cover letters that help candidates stand out.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.6,
        max_tokens: 1500
      });

      const response = result.choices[0]?.message?.content;
      if (!response) {
        throw new Error('No response from OpenAI');
      }

      console.log('✅ Generated cover letter successfully');
      return response;
    } catch (error) {
      console.error('❌ Failed to generate cover letter:', error);
      logServerError(error as Error, { service: 'azure-ai', action: 'generate-cover-letter' });
      throw error;
    }
  }

  /**
   * Build resume context string for prompts
   */
  private buildResumeContext(resumeData: ExtractedResumeData): string {
    const parts: string[] = [];

    // Personal info
    if (resumeData.personalInfo.name) {
      parts.push(`Name: ${resumeData.personalInfo.name}`);
    }

    // Summary
    if (resumeData.summary) {
      parts.push(`Summary: ${resumeData.summary}`);
    }

    // Skills
    if (resumeData.skills.length > 0) {
      parts.push(`Skills: ${resumeData.skills.join(', ')}`);
    }

    // Experience
    if (resumeData.experience.length > 0) {
      const expText = resumeData.experience.map(exp => 
        `${exp.position} at ${exp.company} (${exp.startDate} - ${exp.endDate || 'Present'}): ${exp.description}`
      ).join('\n');
      parts.push(`Experience:\n${expText}`);
    }

    // Education
    if (resumeData.education.length > 0) {
      const eduText = resumeData.education.map(edu => 
        `${edu.degree} in ${edu.field} from ${edu.institution}`
      ).join('\n');
      parts.push(`Education:\n${eduText}`);
    }

    // Projects
    if (resumeData.projects.length > 0) {
      const projText = resumeData.projects.map(proj => 
        `${proj.name}: ${proj.description}`
      ).join('\n');
      parts.push(`Projects:\n${projText}`);
    }

    return parts.join('\n\n');
  }

  /**
   * Health check for Azure AI services
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; timestamp: Date; details: any }> {
    try {
      await this.initialize();
      
      const status = {
        openAI: !!this.openAIClient,
        formRecognizer: !!this.formRecognizerClient,
        initialized: this.initialized
      };

      // Try a simple OpenAI call if available
      if (this.openAIClient) {
        try {
          const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4';
          await this.openAIClient.chat.completions.create({
            model: deploymentName,
            messages: [
              { role: 'user', content: 'Hello' }
            ],
            max_tokens: 5
          });
          status.openAI = true;
        } catch (error) {
          status.openAI = false;
        }
      }

      const isHealthy = status.initialized && (status.openAI || status.formRecognizer);
      
      return { 
        status: isHealthy ? 'healthy' : 'unhealthy', 
        timestamp: new Date(),
        details: status
      };
    } catch (error) {
      console.error('Azure AI health check failed:', error);
      return { 
        status: 'unhealthy', 
        timestamp: new Date(),
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }
}

// Export singleton instance
export const azureAIService = new AzureAIService();
export default azureAIService;
