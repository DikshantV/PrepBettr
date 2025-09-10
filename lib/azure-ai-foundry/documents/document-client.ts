/**
 * Azure AI Foundry Document Intelligence Client
 * 
 * Enhanced document analysis using Azure AI Foundry's Document Intelligence service.
 * Provides advanced OCR, layout analysis, and structured extraction capabilities.
 * Replaces and enhances the existing Azure Form Recognizer implementation.
 */

import { DefaultAzureCredential } from '@azure/identity';
import { DocumentIntelligenceClient, AzureKeyCredential } from '@azure/ai-document-intelligence';
import { getFoundryConfig } from '../config/foundry-config';
import { logServerError } from '@/lib/errors';
import { retryWithExponentialBackoff } from '@/lib/utils/retry-with-backoff';

// Client-side safety check
const isClient = typeof window !== 'undefined';

if (isClient) {
  console.warn('[Document Intelligence Client] Running on client side - clients will not be initialized');
}

/**
 * Enhanced extraction interfaces extending existing types
 */
export interface DocumentBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DocumentField {
  content: string;
  confidence: number;
  boundingBox?: DocumentBoundingBox;
}

export interface DocumentTable {
  rowCount: number;
  columnCount: number;
  cells: Array<{
    content: string;
    rowIndex: number;
    columnIndex: number;
    confidence: number;
  }>;
}

export interface FoundryResumeExtraction {
  // Core personal information with confidence scores
  personalInfo: {
    name?: DocumentField;
    email?: DocumentField;
    phone?: DocumentField;
    address?: DocumentField;
    linkedin?: DocumentField;
    github?: DocumentField;
    website?: DocumentField;
  };
  
  // Professional summary and objectives
  summary?: DocumentField;
  objective?: DocumentField;
  
  // Enhanced skills extraction with proficiency levels
  skills: Array<{
    skill: string;
    proficiency?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    category: 'technical' | 'soft' | 'language' | 'certification' | 'tool';
    confidence: number;
    yearsOfExperience?: number;
  }>;
  
  // Work experience with enhanced metadata
  experience: Array<{
    company: DocumentField;
    position: DocumentField;
    startDate?: DocumentField;
    endDate?: DocumentField;
    isCurrent?: boolean;
    description: DocumentField;
    achievements: DocumentField[];
    technologies: string[];
    location?: DocumentField;
    managementScope?: {
      teamSize?: number;
      budget?: string;
      responsibilities: string[];
    };
    quantifiableResults: Array<{
      metric: string;
      value: number;
      unit: string;
      impact: string;
    }>;
    confidence: number;
  }>;
  
  // Education with validation
  education: Array<{
    institution: DocumentField;
    degree: DocumentField;
    field: DocumentField;
    startDate?: DocumentField;
    endDate?: DocumentField;
    gpa?: DocumentField;
    description?: DocumentField;
    location?: DocumentField;
    honors?: string[];
    relevantCoursework?: string[];
    confidence: number;
  }>;
  
  // Projects with impact assessment
  projects: Array<{
    name: DocumentField;
    description: DocumentField;
    technologies: string[];
    url?: DocumentField;
    github?: DocumentField;
    startDate?: DocumentField;
    endDate?: DocumentField;
    role?: string;
    teamSize?: number;
    impact?: string;
    confidence: number;
  }>;
  
  // Certifications with verification
  certifications: Array<{
    name: DocumentField;
    issuer: DocumentField;
    date?: DocumentField;
    expiryDate?: DocumentField;
    credentialId?: DocumentField;
    url?: DocumentField;
    status: 'active' | 'expired' | 'unknown';
    confidence: number;
  }>;
  
  // Languages with proficiency
  languages: Array<{
    name: string;
    proficiency: 'basic' | 'conversational' | 'fluent' | 'native';
    confidence: number;
  }>;
  
  // Document analysis metadata
  metadata: {
    processingTime: number;
    pageCount: number;
    modelUsed: string;
    overallConfidence: number;
    languageDetected?: string;
    documentStructure: {
      hasHeaders: boolean;
      hasBulletPoints: boolean;
      hasTables: boolean;
      columnLayout: boolean;
    };
  };
  
  // ATS optimization data
  atsAnalysis?: {
    score: number;
    recommendations: string[];
    keywordDensity: Record<string, number>;
    formatIssues: string[];
    structuralOptimizations: string[];
  };
  
  // Raw extraction data for debugging/export
  rawExtraction?: any;
}

/**
 * Job matching interface
 */
export interface JobMatchAnalysis {
  overallScore: number; // 0-100
  skillsMatch: {
    matchedSkills: string[];
    missingSkills: string[];
    skillGapScore: number;
  };
  experienceMatch: {
    yearsMatch: boolean;
    industryMatch: boolean;
    roleMatch: boolean;
    seniorityMatch: boolean;
  };
  educationMatch: {
    degreeMatch: boolean;
    fieldMatch: boolean;
    institutionPrestige?: number;
  };
  keywordAnalysis: {
    totalKeywords: number;
    matchedKeywords: number;
    missedKeywords: string[];
    keywordDensity: number;
  };
  recommendations: Array<{
    category: 'skills' | 'experience' | 'education' | 'keywords' | 'formatting';
    priority: 'high' | 'medium' | 'low';
    suggestion: string;
    impact: string;
  }>;
}

/**
 * Document model configurations for different analysis types
 */
interface DocumentModelConfig {
  modelId: string;
  features?: string[];
  locale?: string;
  pages?: string;
}

/**
 * Azure AI Foundry Document Intelligence Service
 */
class FoundryDocumentIntelligenceService {
  private client: DocumentIntelligenceClient | null = null;
  private isInitialized = false;
  
  // Model configurations for different document types
  private readonly modelConfigs: Record<string, DocumentModelConfig> = {
    'resume-analysis': {
      modelId: 'prebuilt-layout',
      features: ['barcodes', 'languages', 'ocrHighResolution']
    },
    'resume-structured': {
      modelId: 'prebuilt-document',
      features: ['keyValuePairs', 'entities', 'languages']
    },
    'general-document': {
      modelId: 'prebuilt-read',
      features: ['languages']
    }
  };

  /**
   * Initialize the Azure AI Foundry Document Intelligence service
   */
  async initialize(): Promise<boolean> {
    if (isClient) {
      console.warn('⚠️ Document Intelligence client cannot be initialized on client side');
      return false;
    }

    if (this.isInitialized) {
      return true;
    }

    try {
      const config = await getFoundryConfig();
      
      // Check if Document Intelligence is configured in Foundry config
      const docIntEndpoint = process.env.AZURE_FOUNDRY_DOCINT_ENDPOINT || config.docIntelligence?.endpoint;
      const docIntApiKey = process.env.AZURE_FOUNDRY_DOCINT_API_KEY || config.docIntelligence?.apiKey;

      if (!docIntEndpoint || !docIntApiKey) {
        console.warn('⚠️ Azure AI Foundry Document Intelligence credentials not found');
        console.log('💡 Configure AZURE_FOUNDRY_DOCINT_ENDPOINT and AZURE_FOUNDRY_DOCINT_API_KEY');
        return false;
      }

      console.log('🔧 Initializing Azure AI Foundry Document Intelligence client...');
      
      // Create client with either API key or managed identity
      const credential = docIntApiKey.startsWith('https://') 
        ? new DefaultAzureCredential()
        : new AzureKeyCredential(docIntApiKey);
      
      this.client = new DocumentIntelligenceClient(docIntEndpoint, credential, {
        additionalPolicies: [{
          policy: {
            name: 'PrepBettrDocumentIntelligence',
            sendRequest: async (request: any, next: any) => {
              // Add custom headers for tracking
              request.headers.set('X-Client-Name', 'PrepBettr');
              request.headers.set('X-Client-Version', '2.0');
              return next(request);
            }
          },
          position: 'perCall'
        }],
        retryOptions: {
          maxRetries: config.connection.retryPolicy.maxRetries,
          retryDelayInMs: config.connection.retryPolicy.baseDelay
        }
      });

      this.isInitialized = true;
      console.log('✅ Azure AI Foundry Document Intelligence service initialized');
      return true;

    } catch (error) {
      console.error('❌ Failed to initialize Document Intelligence service:', error);
      logServerError(error as Error, { 
        service: 'foundry-document-intelligence', 
        action: 'initialize' 
      });
      return false;
    }
  }

  /**
   * Check if service is ready
   */
  isReady(): boolean {
    return !isClient && this.isInitialized && this.client !== null;
  }

  /**
   * Analyze resume document with enhanced extraction
   */
  async analyzeResume(
    documentBuffer: Buffer, 
    mimeType: string,
    options?: {
      includeAtsAnalysis?: boolean;
      modelType?: 'resume-analysis' | 'resume-structured' | 'general-document';
    }
  ): Promise<FoundryResumeExtraction> {
    if (!this.isReady()) {
      throw new Error('Document Intelligence service not initialized');
    }

    const startTime = Date.now();
    const modelType = options?.modelType || 'resume-analysis';
    const modelConfig = this.modelConfigs[modelType];

    try {
      console.log(`🔍 Analyzing resume with model: ${modelConfig.modelId}`);

      const result = await retryWithExponentialBackoff(
        async () => {
          const poller = await this.client!.beginAnalyzeDocument(
            modelConfig.modelId,
            documentBuffer,
            {
              contentType: mimeType as any,
              features: modelConfig.features as any,
              locale: modelConfig.locale
            }
          );
          return await poller.pollUntilDone();
        },
        'document-intelligence-analyze',
        undefined,
        {
          maxRetries: 3,
          baseDelay: 2000,
          maxDelay: 30000
        }
      );

      const processingTime = Date.now() - startTime;
      
      // Extract structured data from the analysis result
      const extraction = await this.extractStructuredData(result, processingTime);
      
      // Add ATS analysis if requested
      if (options?.includeAtsAnalysis) {
        extraction.atsAnalysis = await this.performAtsAnalysis(extraction);
      }

      console.log(`✅ Resume analysis completed in ${processingTime}ms`);
      return extraction;

    } catch (error) {
      console.error('❌ Failed to analyze resume with Document Intelligence:', error);
      logServerError(error as Error, {
        service: 'foundry-document-intelligence',
        action: 'analyze-resume'
      }, {
        mimeType,
        modelType,
        processingTime: Date.now() - startTime
      });
      throw error;
    }
  }

  /**
   * Compare resume against job description for matching analysis
   */
  async compareWithJobDescription(
    resumeExtraction: FoundryResumeExtraction,
    jobDescription: string
  ): Promise<JobMatchAnalysis> {
    try {
      console.log('🎯 Performing job match analysis...');
      
      // Extract job requirements from description
      const jobRequirements = await this.extractJobRequirements(jobDescription);
      
      // Perform multi-dimensional matching
      const skillsMatch = this.analyzeSkillsMatch(resumeExtraction.skills, jobRequirements.skills);
      const experienceMatch = this.analyzeExperienceMatch(resumeExtraction.experience, jobRequirements);
      const educationMatch = this.analyzeEducationMatch(resumeExtraction.education, jobRequirements);
      const keywordAnalysis = this.analyzeKeywords(resumeExtraction, jobDescription);
      
      // Calculate overall score
      const overallScore = this.calculateOverallMatchScore({
        skillsMatch,
        experienceMatch,
        educationMatch,
        keywordAnalysis
      });
      
      // Generate recommendations
      const recommendations = this.generateMatchRecommendations({
        skillsMatch,
        experienceMatch,
        educationMatch,
        keywordAnalysis
      });

      return {
        overallScore,
        skillsMatch,
        experienceMatch,
        educationMatch,
        keywordAnalysis,
        recommendations
      };

    } catch (error) {
      console.error('❌ Failed to perform job match analysis:', error);
      throw error;
    }
  }

  /**
   * Extract structured data from Document Intelligence result
   */
  private async extractStructuredData(result: any, processingTime: number): Promise<FoundryResumeExtraction> {
    const pages = result.pages || [];
    const keyValuePairs = result.keyValuePairs || [];
    const entities = result.entities || [];
    const content = result.content || '';

    // Extract personal information using key-value pairs and patterns
    const personalInfo = this.extractPersonalInfo(keyValuePairs, content, entities);
    
    // Extract skills with proficiency assessment
    const skills = this.extractEnhancedSkills(content, entities);
    
    // Extract work experience with quantifiable results
    const experience = this.extractWorkExperience(content, entities);
    
    // Extract education with validation
    const education = this.extractEducation(content, entities);
    
    // Extract projects with impact assessment
    const projects = this.extractProjects(content, entities);
    
    // Extract certifications
    const certifications = this.extractCertifications(content, entities);
    
    // Extract languages
    const languages = this.extractLanguages(content, entities);
    
    // Analyze document structure
    const documentStructure = this.analyzeDocumentStructure(result);
    
    return {
      personalInfo,
      skills,
      experience,
      education,
      projects,
      certifications,
      languages,
      metadata: {
        processingTime,
        pageCount: pages.length,
        modelUsed: 'azure-foundry-document-intelligence',
        overallConfidence: this.calculateOverallConfidence(result),
        languageDetected: result.languages?.[0]?.locale,
        documentStructure
      },
      rawExtraction: result // Store for debugging/export
    };
  }

  /**
   * Extract personal information with confidence scores
   */
  private extractPersonalInfo(keyValuePairs: any[], content: string, entities: any[]): FoundryResumeExtraction['personalInfo'] {
    const personalInfo: FoundryResumeExtraction['personalInfo'] = {};

    // Extract from key-value pairs first (highest confidence)
    keyValuePairs.forEach(pair => {
      const key = pair.key?.content?.toLowerCase() || '';
      const value = pair.value;
      
      if (key.includes('name') && !personalInfo.name) {
        personalInfo.name = {
          content: value.content,
          confidence: value.confidence || 0.9
        };
      } else if (key.includes('email') && !personalInfo.email) {
        personalInfo.email = {
          content: value.content,
          confidence: value.confidence || 0.95
        };
      } else if (key.includes('phone') && !personalInfo.phone) {
        personalInfo.phone = {
          content: value.content,
          confidence: value.confidence || 0.9
        };
      }
    });

    // Extract from entities if not found in key-value pairs
    entities.forEach((entity: any) => {
      if (entity.category === 'Person' && !personalInfo.name) {
        personalInfo.name = {
          content: entity.content,
          confidence: entity.confidence
        };
      } else if (entity.category === 'Email' && !personalInfo.email) {
        personalInfo.email = {
          content: entity.content,
          confidence: entity.confidence
        };
      } else if (entity.category === 'PhoneNumber' && !personalInfo.phone) {
        personalInfo.phone = {
          content: entity.content,
          confidence: entity.confidence
        };
      }
    });

    // Fallback to regex patterns with lower confidence
    if (!personalInfo.email) {
      const emailMatch = content.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
      if (emailMatch) {
        personalInfo.email = {
          content: emailMatch[0],
          confidence: 0.8
        };
      }
    }

    if (!personalInfo.phone) {
      const phoneMatch = content.match(/(\+?1?[-.\\s]?)?\\(?[0-9]{3}\\)?[-.\\s]?[0-9]{3}[-.\\s]?[0-9]{4}/);
      if (phoneMatch) {
        personalInfo.phone = {
          content: phoneMatch[0],
          confidence: 0.75
        };
      }
    }

    // Extract LinkedIn and GitHub URLs
    const linkedinMatch = content.match(/linkedin\.com\/in\/[\w-]+/i);
    if (linkedinMatch) {
      personalInfo.linkedin = {
        content: `https://${linkedinMatch[0]}`,
        confidence: 0.9
      };
    }

    const githubMatch = content.match(/github\.com\/[\w-]+/i);
    if (githubMatch) {
      personalInfo.github = {
        content: `https://${githubMatch[0]}`,
        confidence: 0.9
      };
    }

    return personalInfo;
  }

  /**
   * Extract skills with proficiency levels and categorization
   */
  private extractEnhancedSkills(content: string, entities: any[]): FoundryResumeExtraction['skills'] {
    const skills: FoundryResumeExtraction['skills'] = [];
    
    // Technical skills database for categorization
    const technicalSkills = [
      'javascript', 'typescript', 'python', 'java', 'react', 'node', 'angular', 'vue',
      'sql', 'mongodb', 'postgresql', 'mysql', 'docker', 'kubernetes', 'aws', 'azure',
      'tensorflow', 'pytorch', 'machine learning', 'data science', 'blockchain'
    ];
    
    const softSkills = [
      'leadership', 'teamwork', 'communication', 'problem solving', 'critical thinking',
      'project management', 'agile', 'scrum'
    ];

    // Extract from content with pattern matching
    const skillsSection = content.match(/(?:skills?|technologies|competencies)[:\s]*([^]*?)(?=\n\s*[A-Z][^:]*:|$)/i);
    if (skillsSection) {
      const skillsText = skillsSection[1];
      
      // Split by common delimiters
      const detectedSkills = skillsText
        .replace(/[•\\-\\*]/g, ',')
        .split(/[,\\n]/)
        .map(skill => skill.trim())
        .filter(skill => skill.length > 0 && skill.length < 50);
      
      detectedSkills.forEach(skill => {
        const lowerSkill = skill.toLowerCase();
        let category: 'technical' | 'soft' | 'language' | 'certification' | 'tool' = 'tool';
        let proficiency: 'beginner' | 'intermediate' | 'advanced' | 'expert' | undefined;
        
        // Categorize skill
        if (technicalSkills.some(tech => lowerSkill.includes(tech))) {
          category = 'technical';
        } else if (softSkills.some(soft => lowerSkill.includes(soft))) {
          category = 'soft';
        }
        
        // Detect proficiency indicators
        if (skill.match(/expert|advanced|senior|lead/i)) {
          proficiency = 'expert';
        } else if (skill.match(/intermediate|mid|experienced/i)) {
          proficiency = 'intermediate';
        } else if (skill.match(/beginner|basic|junior/i)) {
          proficiency = 'beginner';
        } else if (skill.match(/proficient|skilled/i)) {
          proficiency = 'advanced';
        }
        
        skills.push({
          skill: skill,
          proficiency,
          category,
          confidence: 0.8,
          yearsOfExperience: this.extractYearsOfExperience(skill, content)
        });
      });
    }

    return skills;
  }

  /**
   * Extract work experience with quantifiable results and management scope
   */
  private extractWorkExperience(content: string, entities: any[]): FoundryResumeExtraction['experience'] {
    const experience: FoundryResumeExtraction['experience'] = [];
    
    // Pattern to match experience sections
    const expSection = content.match(/(?:experience|employment|work history)[:\s]*([^]*?)(?=\n\s*(?:education|skills?|projects?)[:\s]|$)/i);
    if (!expSection) return experience;
    
    const expText = expSection[1];
    
    // Split into individual job entries (basic pattern)
    const jobEntries = expText.split(/\n(?=[A-Z].*(?:Inc\.|Corp\.|LLC|Ltd\.|Company|\d{4}))/);
    
    jobEntries.forEach(entry => {
      if (entry.trim().length < 50) return; // Skip short entries
      
      const job = this.parseJobEntry(entry.trim());
      if (job.company.content && job.position.content) {
        experience.push(job);
      }
    });

    return experience;
  }

  /**
   * Parse individual job entry
   */
  private parseJobEntry(entry: string): FoundryResumeExtraction['experience'][0] {
    const lines = entry.split('\n').map(line => line.trim());
    
    // Extract company and position (usually first few lines)
    const companyMatch = lines[0].match(/^(.+?)(?:\s+[-–—]\s+(.+))?$/);
    const company = companyMatch ? companyMatch[1] : lines[0];
    const position = companyMatch ? companyMatch[2] || lines[1] : lines[1];
    
    // Extract dates
    const datePattern = /(\d{1,2}\/\d{4}|\w+\s+\d{4}|\d{4})\s*[-–—]\s*(\d{1,2}\/\d{4}|\w+\s+\d{4}|\d{4}|present)/i;
    const dateMatch = entry.match(datePattern);
    
    // Extract achievements and quantifiable results
    const achievements = lines
      .filter(line => line.match(/^[•\\-\\*]/) || line.includes('achieved') || line.includes('%') || line.includes('$'))
      .map(line => ({
        content: line.replace(/^[•\\-\\*]\s*/, ''),
        confidence: 0.8
      }));
    
    // Extract quantifiable results
    const quantifiableResults = this.extractQuantifiableResults(entry);
    
    // Extract management scope
    const managementScope = this.extractManagementScope(entry);
    
    return {
      company: {
        content: company,
        confidence: 0.9
      },
      position: {
        content: position,
        confidence: 0.9
      },
      startDate: dateMatch ? {
        content: dateMatch[1],
        confidence: 0.8
      } : undefined,
      endDate: dateMatch ? {
        content: dateMatch[2],
        confidence: 0.8
      } : undefined,
      isCurrent: dateMatch ? dateMatch[2].toLowerCase().includes('present') : false,
      description: {
        content: lines.slice(2).join(' '),
        confidence: 0.7
      },
      achievements,
      technologies: this.extractTechnologies(entry),
      managementScope,
      quantifiableResults,
      confidence: 0.8
    };
  }

  /**
   * Extract quantifiable results from job description
   */
  private extractQuantifiableResults(text: string): Array<{
    metric: string;
    value: number;
    unit: string;
    impact: string;
  }> {
    const results: Array<{
      metric: string;
      value: number;
      unit: string;
      impact: string;
    }> = [];
    
    // Pattern for percentages
    const percentMatches = text.match(/(\w+[^.]*?)(\d+)%/g);
    percentMatches?.forEach(match => {
      const parts = match.match(/(\w+[^.]*?)(\d+)%/);
      if (parts) {
        results.push({
          metric: parts[1].trim(),
          value: parseInt(parts[2]),
          unit: 'percentage',
          impact: match
        });
      }
    });
    
    // Pattern for monetary values
    const moneyMatches = text.match(/\$[\d,]+(?:\.\d{2})?[KMB]?/g);
    moneyMatches?.forEach(match => {
      const value = match.replace(/[\$,]/g, '');
      results.push({
        metric: 'revenue/savings',
        value: parseFloat(value),
        unit: 'currency',
        impact: match
      });
    });
    
    return results;
  }

  /**
   * Extract management scope information
   */
  private extractManagementScope(text: string): FoundryResumeExtraction['experience'][0]['managementScope'] {
    const teamSizeMatch = text.match(/(?:managed|led|supervised).*?(\d+).*?(?:people|team|members|employees)/i);
    const budgetMatch = text.match(/budget.*?\$[\d,]+(?:\.\d{2})?[KMB]?/i);
    
    if (teamSizeMatch || budgetMatch) {
      return {
        teamSize: teamSizeMatch ? parseInt(teamSizeMatch[1]) : undefined,
        budget: budgetMatch ? budgetMatch[0] : undefined,
        responsibilities: text.match(/(?:managed|led|supervised|oversaw)[^.]+/gi) || []
      };
    }
    
    return undefined;
  }

  /**
   * Extract technologies from text
   */
  private extractTechnologies(text: string): string[] {
    const techKeywords = [
      'javascript', 'typescript', 'python', 'java', 'react', 'angular', 'vue', 'node',
      'sql', 'mongodb', 'postgresql', 'docker', 'kubernetes', 'aws', 'azure', 'git'
    ];
    
    return techKeywords.filter(tech => 
      text.toLowerCase().includes(tech.toLowerCase())
    );
  }

  /**
   * Extract years of experience for a skill from context
   */
  private extractYearsOfExperience(skill: string, content: string): number | undefined {
    const skillPattern = new RegExp(`${skill}.*?(\\d+)\\s*years?`, 'i');
    const match = content.match(skillPattern);
    return match ? parseInt(match[1]) : undefined;
  }

  /**
   * Extract education information
   */
  private extractEducation(content: string, entities: any[]): FoundryResumeExtraction['education'] {
    const education: FoundryResumeExtraction['education'] = [];
    
    const eduSection = content.match(/(?:education|academic)[:\s]*([^]*?)(?=\n\s*(?:experience|skills?|projects?)[:\s]|$)/i);
    if (!eduSection) return education;
    
    const eduText = eduSection[1];
    const lines = eduText.split('\n').filter(line => line.trim());
    
    let currentEdu: any = {};
    
    lines.forEach(line => {
      line = line.trim();
      if (!line) return;
      
      // Check if this looks like a new education entry
      if (line.match(/university|college|institute|school/i)) {
        if (currentEdu.institution) {
          education.push(currentEdu);
        }
        currentEdu = {
          institution: {
            content: line,
            confidence: 0.9
          },
          confidence: 0.8
        };
      } else if (line.match(/bachelor|master|phd|doctorate|degree/i)) {
        currentEdu.degree = {
          content: line,
          confidence: 0.9
        };
      } else if (line.match(/\d{4}/)) {
        const dateMatch = line.match(/(\d{4})\s*[-–—]\s*(\d{4})/);
        if (dateMatch) {
          currentEdu.startDate = {
            content: dateMatch[1],
            confidence: 0.8
          };
          currentEdu.endDate = {
            content: dateMatch[2],
            confidence: 0.8
          };
        }
      }
    });
    
    if (currentEdu.institution) {
      education.push(currentEdu);
    }
    
    return education;
  }

  /**
   * Extract projects information
   */
  private extractProjects(content: string, entities: any[]): FoundryResumeExtraction['projects'] {
    const projects: FoundryResumeExtraction['projects'] = [];
    
    const projSection = content.match(/(?:projects?)[:\s]*([^]*?)(?=\n\s*(?:experience|education|skills?)[:\s]|$)/i);
    if (!projSection) return projects;
    
    const projText = projSection[1];
    const projectEntries = projText.split(/\n(?=[A-Z][^:\n]+)/);
    
    projectEntries.forEach(entry => {
      if (entry.trim().length < 20) return;
      
      const lines = entry.split('\n').map(line => line.trim());
      const projectName = lines[0];
      const description = lines.slice(1).join(' ');
      
      projects.push({
        name: {
          content: projectName,
          confidence: 0.8
        },
        description: {
          content: description,
          confidence: 0.7
        },
        technologies: this.extractTechnologies(entry),
        confidence: 0.7
      });
    });
    
    return projects;
  }

  /**
   * Extract certifications
   */
  private extractCertifications(content: string, entities: any[]): FoundryResumeExtraction['certifications'] {
    const certifications: FoundryResumeExtraction['certifications'] = [];
    
    const certSection = content.match(/(?:certifications?|certificates)[:\s]*([^]*?)(?=\n\s*(?:experience|education|skills?|projects?)[:\s]|$)/i);
    if (!certSection) return certifications;
    
    const certText = certSection[1];
    const lines = certText.split('\n').filter(line => line.trim());
    
    lines.forEach(line => {
      line = line.trim();
      if (line.length < 10) return;
      
      const parts = line.split(/[-–—,]/);
      const name = parts[0]?.trim();
      const issuer = parts[1]?.trim();
      
      if (name) {
        certifications.push({
          name: {
            content: name,
            confidence: 0.8
          },
          issuer: {
            content: issuer || 'Unknown',
            confidence: issuer ? 0.7 : 0.3
          },
          status: 'unknown',
          confidence: 0.7
        });
      }
    });
    
    return certifications;
  }

  /**
   * Extract languages
   */
  private extractLanguages(content: string, entities: any[]): FoundryResumeExtraction['languages'] {
    const languages: FoundryResumeExtraction['languages'] = [];
    
    const langSection = content.match(/(?:languages?)[:\s]*([^]*?)(?=\n\s*[A-Z][^:]*:|$)/i);
    if (!langSection) return languages;
    
    const langText = langSection[1];
    const langEntries = langText.split(/[,\n]/).filter(entry => entry.trim());
    
    langEntries.forEach(entry => {
      entry = entry.trim();
      const parts = entry.split(/[-–—:]/);
      const name = parts[0]?.trim();
      const proficiencyText = parts[1]?.trim().toLowerCase();
      
      let proficiency: 'basic' | 'conversational' | 'fluent' | 'native' = 'conversational';
      
      if (proficiencyText) {
        if (proficiencyText.includes('native') || proficiencyText.includes('mother tongue')) {
          proficiency = 'native';
        } else if (proficiencyText.includes('fluent') || proficiencyText.includes('advanced')) {
          proficiency = 'fluent';
        } else if (proficiencyText.includes('basic') || proficiencyText.includes('beginner')) {
          proficiency = 'basic';
        }
      }
      
      if (name && name.length > 2) {
        languages.push({
          name: name,
          proficiency,
          confidence: 0.7
        });
      }
    });
    
    return languages;
  }

  /**
   * Analyze document structure
   */
  private analyzeDocumentStructure(result: any): FoundryResumeExtraction['metadata']['documentStructure'] {
    const content = result.content || '';
    
    return {
      hasHeaders: /^[A-Z][^a-z]*$/m.test(content),
      hasBulletPoints: /[•\\-\\*]/.test(content),
      hasTables: result.tables && result.tables.length > 0,
      columnLayout: content.includes('\t') || content.match(/\s{4,}/) !== null
    };
  }

  /**
   * Calculate overall confidence score
   */
  private calculateOverallConfidence(result: any): number {
    const pages = result.pages || [];
    if (pages.length === 0) return 0;
    
    let totalConfidence = 0;
    let totalElements = 0;
    
    pages.forEach((page: any) => {
      const lines = page.lines || [];
      lines.forEach((line: any) => {
        totalConfidence += line.confidence || 0;
        totalElements++;
      });
    });
    
    return totalElements > 0 ? totalConfidence / totalElements : 0;
  }

  /**
   * Perform ATS optimization analysis
   */
  private async performAtsAnalysis(extraction: FoundryResumeExtraction): Promise<FoundryResumeExtraction['atsAnalysis']> {
    // Simplified ATS analysis - can be enhanced with more sophisticated algorithms
    const recommendations: string[] = [];
    const formatIssues: string[] = [];
    const structuralOptimizations: string[] = [];
    
    // Check for common ATS issues
    if (!extraction.personalInfo.email) {
      formatIssues.push('Missing email address');
    }
    
    if (!extraction.personalInfo.phone) {
      formatIssues.push('Missing phone number');
    }
    
    if (extraction.skills.length < 5) {
      recommendations.push('Add more relevant skills to improve keyword matching');
    }
    
    if (extraction.experience.length === 0) {
      structuralOptimizations.push('Add work experience section');
    }
    
    // Calculate keyword density
    const keywordDensity: Record<string, number> = {};
    const allText = JSON.stringify(extraction).toLowerCase();
    
    // Common job keywords
    const jobKeywords = ['experience', 'skills', 'manage', 'develop', 'lead', 'project', 'team'];
    jobKeywords.forEach(keyword => {
      const matches = (allText.match(new RegExp(keyword, 'g')) || []).length;
      keywordDensity[keyword] = matches;
    });
    
    // Calculate ATS score (simplified)
    let score = 70; // Base score
    
    if (extraction.personalInfo.email) score += 5;
    if (extraction.personalInfo.phone) score += 5;
    if (extraction.skills.length >= 10) score += 10;
    if (extraction.experience.length >= 2) score += 10;
    
    score -= formatIssues.length * 5;
    
    return {
      score: Math.max(0, Math.min(100, score)),
      recommendations,
      keywordDensity,
      formatIssues,
      structuralOptimizations
    };
  }

  // Placeholder methods for job matching (to be implemented)
  private async extractJobRequirements(jobDescription: string): Promise<any> {
    // TODO: Implement job requirements extraction
    return { skills: [], experience: [], education: [] };
  }

  private analyzeSkillsMatch(resumeSkills: any[], jobSkills: any[]): any {
    // TODO: Implement skills matching algorithm
    return {
      matchedSkills: [],
      missingSkills: [],
      skillGapScore: 0
    };
  }

  private analyzeExperienceMatch(experience: any[], jobRequirements: any): any {
    // TODO: Implement experience matching
    return {
      yearsMatch: false,
      industryMatch: false,
      roleMatch: false,
      seniorityMatch: false
    };
  }

  private analyzeEducationMatch(education: any[], jobRequirements: any): any {
    // TODO: Implement education matching
    return {
      degreeMatch: false,
      fieldMatch: false
    };
  }

  private analyzeKeywords(extraction: FoundryResumeExtraction, jobDescription: string): any {
    // TODO: Implement keyword analysis
    return {
      totalKeywords: 0,
      matchedKeywords: 0,
      missedKeywords: [],
      keywordDensity: 0
    };
  }

  private calculateOverallMatchScore(analysis: any): number {
    // TODO: Implement overall score calculation
    return 0;
  }

  private generateMatchRecommendations(analysis: any): any[] {
    // TODO: Implement recommendation generation
    return [];
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.client = null;
    this.isInitialized = false;
    console.log('🧹 Document Intelligence service disposed');
  }
}

// Export singleton instance
export const foundryDocumentIntelligenceService = new FoundryDocumentIntelligenceService();
