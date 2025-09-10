/**
 * ATS Optimization Service
 * 
 * Provides comprehensive ATS (Applicant Tracking System) analysis including:
 * - Keyword density analysis and optimization
 * - Skills normalization using industry taxonomies (O*NET, ESCO, SFIA)
 * - Job matching using semantic similarity with embeddings
 * - ATS scoring and recommendations
 */

import { OpenAI } from 'openai';
import { azureOpenAIService } from '@/azure/lib/services/azure-openai-service';
import { 
  ATS_OPTIMIZATION_PROMPT,
  SKILLS_NORMALIZATION_PROMPT,
  JOB_MATCHING_PROMPT,
  formatConditionalPrompt
} from '@/prompts/resume/extraction-prompts';

// Types for ATS analysis
export interface ATSAnalysisResult {
  atsScore: number;
  overallGrade: string;
  analysis: {
    keywordAnalysis: KeywordAnalysis;
    formatAnalysis: FormatAnalysis;
    structureAnalysis: StructureAnalysis;
    contentAnalysis: ContentAnalysis;
  };
  prioritizedRecommendations: ATSRecommendation[];
}

export interface KeywordAnalysis {
  score: number;
  totalKeywords: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  keywordDensity: number;
  industryKeywords: IndustryKeyword[];
  recommendations: string[];
}

export interface IndustryKeyword {
  keyword: string;
  importance: 'critical' | 'high' | 'medium' | 'low';
  category: 'technical' | 'soft' | 'industry' | 'role';
  frequency: number;
  variations: string[];
}

export interface FormatAnalysis {
  score: number;
  issues: FormatIssue[];
  strengths: string[];
}

export interface FormatIssue {
  type: 'critical' | 'warning' | 'suggestion';
  issue: string;
  solution: string;
  impact: string;
}

export interface StructureAnalysis {
  score: number;
  missingElements: string[];
  presentElements: string[];
  recommendations: string[];
}

export interface ContentAnalysis {
  score: number;
  strengthAreas: string[];
  improvementAreas: string[];
  recommendations: string[];
}

export interface ATSRecommendation {
  priority: 'high' | 'medium' | 'low';
  category: 'keywords' | 'formatting' | 'structure' | 'content';
  recommendation: string;
  implementation: string;
  expectedImpact: string;
  timeToImplement: string;
}

// Types for skills normalization
export interface SkillsNormalizationResult {
  normalizedSkills: NormalizedSkill[];
  skillCategories: SkillCategories;
  industryAlignment: IndustryAlignment;
}

export interface NormalizedSkill {
  originalSkill: string;
  normalizedSkill: string;
  category: string;
  subcategory: string;
  proficiencyLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  industryStandard: boolean;
  frameworks: {
    sfia?: string;
    onet?: string;
    esco?: string;
  };
  relatedSkills: string[];
  marketDemand: 'high' | 'medium' | 'low';
  salaryImpact: 'positive' | 'neutral' | 'negative';
  learningPath: string[];
}

export interface SkillCategories {
  technical: string[];
  soft: string[];
  language: string[];
  certification: string[];
  tool: string[];
}

export interface IndustryAlignment {
  score: number;
  wellAlignedSkills: string[];
  missingIndustrySkills: string[];
  emergingSkills: string[];
  recommendations: string[];
}

// Types for job matching
export interface JobMatchResult {
  overallMatchScore: number;
  matchGrade: string;
  analysis: {
    skillsMatch: SkillsMatchAnalysis;
    experienceMatch: ExperienceMatchAnalysis;
    educationMatch: EducationMatchAnalysis;
    culturalFit: CulturalFitAnalysis;
  };
  recommendations: JobMatchRecommendation[];
  interviewPreparation: string[];
  missingKeywords: string[];
}

export interface SkillsMatchAnalysis {
  score: number;
  matchedSkills: MatchedSkill[];
  missingSkills: MissingSkill[];
  skillGapAnalysis: {
    criticalGaps: string[];
    niceToHaveGaps: string[];
    strengthAreas: string[];
  };
}

export interface MatchedSkill {
  skill: string;
  resumeLevel: string;
  requiredLevel: string;
  match: 'exceeds' | 'meets' | 'below';
}

export interface MissingSkill {
  skill: string;
  importance: 'high' | 'medium' | 'low';
  canLearn: boolean;
  timeToLearn: string;
}

export interface ExperienceMatchAnalysis {
  score: number;
  yearsRequired: number;
  yearsCandidate: number;
  yearsMatch: 'exceeds' | 'meets' | 'below';
  industryMatch: {
    score: number;
    relevantIndustries: string[];
    transferableExperience: string[];
  };
  roleSimilarity: {
    score: number;
    similarRoles: string[];
    levelMatch: string;
  };
}

export interface EducationMatchAnalysis {
  score: number;
  degreeMatch: boolean;
  fieldRelevance: 'high' | 'medium' | 'low';
  institutionPrestige: string;
  additionalQualifications: string[];
}

export interface CulturalFitAnalysis {
  score: number;
  indicators: string[];
  concerns: string[];
  strengths: string[];
}

export interface JobMatchRecommendation {
  category: 'skills' | 'experience' | 'education' | 'presentation';
  priority: 'high' | 'medium' | 'low';
  recommendation: string;
  reasoning: string;
  resources: string[];
  timeframe: string;
}

// Industry taxonomy mappings
const INDUSTRY_TAXONOMIES = {
  technology: {
    frameworks: ['React', 'Angular', 'Vue.js', 'Node.js', 'Django', 'Spring'],
    languages: ['JavaScript', 'Python', 'Java', 'TypeScript', 'Go', 'Rust'],
    tools: ['Git', 'Docker', 'Kubernetes', 'AWS', 'Azure', 'Jenkins'],
    concepts: ['Agile', 'DevOps', 'Microservices', 'API Design', 'Cloud Computing']
  },
  finance: {
    regulations: ['SOX', 'GDPR', 'Basel III', 'IFRS', 'GAAP'],
    tools: ['Excel', 'Bloomberg', 'SAP', 'Oracle', 'Tableau'],
    concepts: ['Risk Management', 'Portfolio Management', 'Financial Modeling', 'Compliance']
  },
  healthcare: {
    regulations: ['HIPAA', 'FDA', 'CLIA', 'Joint Commission'],
    systems: ['Epic', 'Cerner', 'MEDITECH', 'Allscripts'],
    concepts: ['Patient Care', 'Quality Assurance', 'Clinical Research', 'Healthcare Analytics']
  },
  marketing: {
    platforms: ['Google Ads', 'Facebook Ads', 'LinkedIn', 'HubSpot', 'Salesforce'],
    concepts: ['SEO', 'SEM', 'Content Marketing', 'Brand Management', 'Customer Acquisition'],
    metrics: ['CTR', 'CAC', 'ROAS', 'LTV', 'Conversion Rate']
  }
};

class ATSOptimizationService {
  private openai: OpenAI | null = null;

  constructor() {
    this.initializeOpenAI();
  }

  private async initializeOpenAI() {
    try {
      // Try Azure OpenAI first
      this.openai = await azureOpenAIService.getClient();
    } catch (error) {
      console.warn('Azure OpenAI not available, falling back to OpenAI:', error);
      // Fallback to standard OpenAI
      if (process.env.OPENAI_API_KEY) {
        this.openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });
      } else {
        throw new Error('No AI service available for ATS optimization');
      }
    }
  }

  /**
   * Perform comprehensive ATS analysis of a resume
   */
  async analyzeATS(
    resumeData: any,
    jobDescription?: string,
    targetIndustry?: string
  ): Promise<ATSAnalysisResult> {
    if (!this.openai) {
      await this.initializeOpenAI();
    }

    try {
      const prompt = formatConditionalPrompt(ATS_OPTIMIZATION_PROMPT, {
        RESUME_DATA: JSON.stringify(resumeData, null, 2),
        jobDescription,
        targetIndustry
      });

      const completion = await this.openai!.chat.completions.create({
        model: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert ATS (Applicant Tracking System) analyst. Provide detailed, actionable analysis to improve resume compatibility with ATS systems.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3, // Lower temperature for more consistent analysis
        max_tokens: 4000,
      });

      const response = completion.choices[0].message.content;
      if (!response) {
        throw new Error('No response from AI service');
      }

      // Parse JSON response
      const analysisResult = JSON.parse(response) as ATSAnalysisResult;

      // Enhance with industry-specific analysis
      if (targetIndustry) {
        analysisResult.analysis.keywordAnalysis = await this.enhanceKeywordAnalysis(
          analysisResult.analysis.keywordAnalysis,
          resumeData,
          targetIndustry
        );
      }

      return analysisResult;
    } catch (error) {
      console.error('ATS analysis failed:', error);
      throw new Error(`ATS analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Normalize and categorize skills using industry taxonomies
   */
  async normalizeSkills(
    skills: string[],
    targetIndustry?: string,
    experienceLevel?: string
  ): Promise<SkillsNormalizationResult> {
    if (!this.openai) {
      await this.initializeOpenAI();
    }

    try {
      const prompt = formatConditionalPrompt(SKILLS_NORMALIZATION_PROMPT, {
        SKILLS_LIST: skills.join(', '),
        TARGET_INDUSTRY: targetIndustry,
        EXPERIENCE_LEVEL: experienceLevel
      });

      const completion = await this.openai!.chat.completions.create({
        model: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert in skills taxonomy and industry standards. Use established frameworks like O*NET, ESCO, and SFIA to normalize and categorize skills.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 3000,
      });

      const response = completion.choices[0].message.content;
      if (!response) {
        throw new Error('No response from AI service');
      }

      const normalizationResult = JSON.parse(response) as SkillsNormalizationResult;

      // Enhance with industry-specific mappings
      if (targetIndustry && INDUSTRY_TAXONOMIES[targetIndustry as keyof typeof INDUSTRY_TAXONOMIES]) {
        normalizationResult.industryAlignment = await this.enhanceIndustryAlignment(
          normalizationResult.industryAlignment,
          skills,
          targetIndustry
        );
      }

      return normalizationResult;
    } catch (error) {
      console.error('Skills normalization failed:', error);
      throw new Error(`Skills normalization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Perform job matching analysis using semantic similarity
   */
  async analyzeJobMatch(
    resumeData: any,
    jobDescription: string,
    targetRole?: string,
    experienceLevel?: string
  ): Promise<JobMatchResult> {
    if (!this.openai) {
      await this.initializeOpenAI();
    }

    try {
      // First, get semantic embeddings for similarity analysis
      const resumeEmbedding = await this.getResumeEmbedding(resumeData);
      const jobEmbedding = await this.getJobDescriptionEmbedding(jobDescription);
      const semanticSimilarity = this.calculateCosineSimilarity(resumeEmbedding, jobEmbedding);

      const prompt = formatConditionalPrompt(JOB_MATCHING_PROMPT, {
        RESUME_DATA: JSON.stringify(resumeData, null, 2),
        JOB_DESCRIPTION: jobDescription,
        targetRole,
        experienceLevel
      });

      const completion = await this.openai!.chat.completions.create({
        model: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert job matching analyst. Provide detailed analysis of how well a candidate matches a job description, including specific skill gaps and recommendations.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 4000,
      });

      const response = completion.choices[0].message.content;
      if (!response) {
        throw new Error('No response from AI service');
      }

      const matchResult = JSON.parse(response) as JobMatchResult;

      // Enhance overall score with semantic similarity
      matchResult.overallMatchScore = Math.round(
        (matchResult.overallMatchScore * 0.7) + (semanticSimilarity * 100 * 0.3)
      );

      // Extract missing keywords from job description
      matchResult.missingKeywords = await this.extractMissingKeywords(resumeData, jobDescription);

      return matchResult;
    } catch (error) {
      console.error('Job matching analysis failed:', error);
      throw new Error(`Job matching analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate keyword density and relevance
   */
  async calculateKeywordDensity(
    resumeText: string,
    targetKeywords: string[]
  ): Promise<{ density: number; matches: string[]; missing: string[] }> {
    const resumeWords = resumeText.toLowerCase().split(/\s+/);
    const totalWords = resumeWords.length;
    
    const matches: string[] = [];
    const missing: string[] = [];

    for (const keyword of targetKeywords) {
      const keywordLower = keyword.toLowerCase();
      const keywordWords = keywordLower.split(/\s+/);
      
      if (keywordWords.length === 1) {
        // Single word keyword
        if (resumeWords.includes(keywordLower)) {
          matches.push(keyword);
        } else {
          missing.push(keyword);
        }
      } else {
        // Multi-word keyword - check for phrase
        const keywordRegex = new RegExp(keywordWords.join('\\s+'), 'i');
        if (keywordRegex.test(resumeText)) {
          matches.push(keyword);
        } else {
          missing.push(keyword);
        }
      }
    }

    const density = matches.length / totalWords;
    return { density, matches, missing };
  }

  /**
   * Get embedding representation of resume for semantic analysis
   */
  private async getResumeEmbedding(resumeData: any): Promise<number[]> {
    // Create a text representation of key resume elements
    const resumeText = [
      resumeData.summary || '',
      resumeData.skills?.map((s: any) => s.skill || s).join(' ') || '',
      resumeData.experience?.map((exp: any) => 
        `${exp.position} ${exp.company} ${exp.description} ${exp.achievements?.join(' ') || ''} ${exp.technologies?.join(' ') || ''}`
      ).join(' ') || '',
      resumeData.education?.map((edu: any) => 
        `${edu.degree} ${edu.field} ${edu.institution}`
      ).join(' ') || ''
    ].join(' ');

    return await this.getTextEmbedding(resumeText);
  }

  /**
   * Get embedding representation of job description
   */
  private async getJobDescriptionEmbedding(jobDescription: string): Promise<number[]> {
    return await this.getTextEmbedding(jobDescription);
  }

  /**
   * Get text embedding using OpenAI's embedding API
   */
  private async getTextEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai!.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text.slice(0, 8192), // Limit to avoid token limits
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('Failed to get embedding:', error);
      // Return zero vector as fallback
      return new Array(1536).fill(0);
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private calculateCosineSimilarity(vector1: number[], vector2: number[]): number {
    if (vector1.length !== vector2.length) {
      console.warn('Vector lengths do not match');
      return 0;
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vector1.length; i++) {
      dotProduct += vector1[i] * vector2[i];
      norm1 += vector1[i] * vector1[i];
      norm2 += vector2[i] * vector2[i];
    }

    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
    if (magnitude === 0) {
      return 0;
    }

    return dotProduct / magnitude;
  }

  /**
   * Extract missing keywords from job description that aren't in resume
   */
  private async extractMissingKeywords(resumeData: any, jobDescription: string): Promise<string[]> {
    // Extract keywords from job description
    const jobKeywords = this.extractKeywordsFromText(jobDescription);
    
    // Extract keywords from resume
    const resumeText = JSON.stringify(resumeData);
    const resumeKeywords = this.extractKeywordsFromText(resumeText);
    
    // Find missing keywords
    const missingKeywords = jobKeywords.filter(keyword => 
      !resumeKeywords.some(resumeKeyword => 
        resumeKeyword.toLowerCase().includes(keyword.toLowerCase()) ||
        keyword.toLowerCase().includes(resumeKeyword.toLowerCase())
      )
    );

    // Filter to keep only important keywords (remove common words)
    const importantKeywords = missingKeywords.filter(keyword => 
      keyword.length > 2 && 
      !['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'had', 'has', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use'].includes(keyword.toLowerCase())
    );

    return importantKeywords.slice(0, 20); // Limit to top 20 missing keywords
  }

  /**
   * Extract keywords from text using simple NLP techniques
   */
  private extractKeywordsFromText(text: string): string[] {
    // Remove common punctuation and split into words
    const words = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);

    // Count word frequency
    const wordCount: { [key: string]: number } = {};
    words.forEach(word => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });

    // Extract phrases (2-3 word combinations)
    const phrases: string[] = [];
    for (let i = 0; i < words.length - 1; i++) {
      const twoWordPhrase = `${words[i]} ${words[i + 1]}`;
      phrases.push(twoWordPhrase);
      
      if (i < words.length - 2) {
        const threeWordPhrase = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
        phrases.push(threeWordPhrase);
      }
    }

    // Combine single words and phrases, sort by frequency/importance
    const allKeywords = [...Object.keys(wordCount), ...phrases];
    
    // Remove duplicates and sort by length (longer phrases first)
    const uniqueKeywords = Array.from(new Set(allKeywords))
      .sort((a, b) => b.length - a.length)
      .slice(0, 100); // Limit to top 100 keywords

    return uniqueKeywords;
  }

  /**
   * Enhance keyword analysis with industry-specific terms
   */
  private async enhanceKeywordAnalysis(
    keywordAnalysis: KeywordAnalysis,
    resumeData: any,
    targetIndustry: string
  ): Promise<KeywordAnalysis> {
    const industryData = INDUSTRY_TAXONOMIES[targetIndustry as keyof typeof INDUSTRY_TAXONOMIES];
    
    if (!industryData) {
      return keywordAnalysis;
    }

    // Check for industry-specific keywords
    const industryKeywords: IndustryKeyword[] = [];
    const resumeText = JSON.stringify(resumeData).toLowerCase();

    // Check technical frameworks/tools
    Object.entries(industryData).forEach(([category, keywords]) => {
      keywords.forEach(keyword => {
        const isPresent = resumeText.includes(keyword.toLowerCase());
        industryKeywords.push({
          keyword,
          importance: this.getKeywordImportance(keyword, category),
          category: this.mapCategoryType(category),
          frequency: isPresent ? 1 : 0,
          variations: this.getKeywordVariations(keyword)
        });
      });
    });

    return {
      ...keywordAnalysis,
      industryKeywords,
      totalKeywords: keywordAnalysis.totalKeywords + industryKeywords.length
    };
  }

  /**
   * Enhance industry alignment analysis
   */
  private async enhanceIndustryAlignment(
    industryAlignment: IndustryAlignment,
    skills: string[],
    targetIndustry: string
  ): Promise<IndustryAlignment> {
    const industryData = INDUSTRY_TAXONOMIES[targetIndustry as keyof typeof INDUSTRY_TAXONOMIES];
    
    if (!industryData) {
      return industryAlignment;
    }

    const allIndustrySkills = Object.values(industryData).flat();
    const skillsLower = skills.map(s => s.toLowerCase());

    const wellAligned = allIndustrySkills.filter(industrySkill =>
      skillsLower.some(skill => 
        skill.includes(industrySkill.toLowerCase()) || 
        industrySkill.toLowerCase().includes(skill)
      )
    );

    const missing = allIndustrySkills.filter(industrySkill =>
      !skillsLower.some(skill => 
        skill.includes(industrySkill.toLowerCase()) || 
        industrySkill.toLowerCase().includes(skill)
      )
    );

    return {
      ...industryAlignment,
      wellAlignedSkills: [...new Set([...industryAlignment.wellAlignedSkills, ...wellAligned])],
      missingIndustrySkills: [...new Set([...industryAlignment.missingIndustrySkills, ...missing.slice(0, 10)])],
      score: Math.round((wellAligned.length / allIndustrySkills.length) * 100)
    };
  }

  /**
   * Get keyword importance based on category and context
   */
  private getKeywordImportance(keyword: string, category: string): 'critical' | 'high' | 'medium' | 'low' {
    // High-importance categories
    if (['frameworks', 'languages', 'regulations'].includes(category)) {
      return 'high';
    }
    
    // Medium-importance categories
    if (['tools', 'platforms'].includes(category)) {
      return 'medium';
    }
    
    // Default to low importance
    return 'low';
  }

  /**
   * Map category names to standard types
   */
  private mapCategoryType(category: string): 'technical' | 'soft' | 'industry' | 'role' {
    const technicalCategories = ['frameworks', 'languages', 'tools', 'platforms', 'systems'];
    const industryCategories = ['regulations', 'concepts', 'metrics'];
    
    if (technicalCategories.includes(category)) {
      return 'technical';
    }
    
    if (industryCategories.includes(category)) {
      return 'industry';
    }
    
    return 'role';
  }

  /**
   * Get common variations of a keyword
   */
  private getKeywordVariations(keyword: string): string[] {
    // Common variations and synonyms
    const variations: { [key: string]: string[] } = {
      'React': ['React.js', 'ReactJS', 'React JS'],
      'Node.js': ['NodeJS', 'Node', 'Node JS'],
      'JavaScript': ['JS', 'Javascript', 'ECMAScript'],
      'TypeScript': ['TS', 'Typescript'],
      'Python': ['py'],
      'Docker': ['Containerization'],
      'Kubernetes': ['K8s', 'K8S'],
      'AWS': ['Amazon Web Services'],
      'Azure': ['Microsoft Azure'],
    };

    return variations[keyword] || [keyword];
  }
}

// Export singleton instance
export const atsOptimizationService = new ATSOptimizationService();

// Export types for use in other modules
export type {
  ATSAnalysisResult,
  SkillsNormalizationResult,
  JobMatchResult,
  KeywordAnalysis,
  NormalizedSkill,
  JobMatchRecommendation
};
