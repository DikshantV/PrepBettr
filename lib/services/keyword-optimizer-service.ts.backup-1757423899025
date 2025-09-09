import { ResumeData } from './resume-export-service';
import { azureOpenAIService } from './azure-openai-service';

export interface KeywordAnalysis {
  currentKeywords: string[];
  missingKeywords: string[];
  suggestedImprovements: Array<{
    section: string;
    original: string;
    suggested: string;
    keywords: string[];
    impact: 'high' | 'medium' | 'low';
  }>;
  score: number;
  industryAlignment: {
    score: number;
    recommendations: string[];
  };
}

export interface JobDescription {
  title: string;
  company?: string;
  requirements: string[];
  preferredSkills: string[];
  responsibilities: string[];
  industry?: string;
  experienceLevel?: string;
}

export class KeywordOptimizerService {
  private static instance: KeywordOptimizerService;

  private constructor() {
    // No initialization needed for Azure OpenAI service
  }

  public static getInstance(): KeywordOptimizerService {
    if (!KeywordOptimizerService.instance) {
      KeywordOptimizerService.instance = new KeywordOptimizerService();
    }
    return KeywordOptimizerService.instance;
  }

  async analyzeKeywords(
    resumeData: ResumeData, 
    jobDescription?: JobDescription,
    targetRole?: string,
    targetIndustry?: string
  ): Promise<KeywordAnalysis> {
    try {
      const resumeText = this.extractResumeText(resumeData);
      const jobText = jobDescription ? this.extractJobText(jobDescription) : '';

      // Ensure Azure OpenAI service is initialized
      await azureOpenAIService.initialize();
      
      const fullPrompt = `You are an expert ATS (Applicant Tracking System) and recruitment specialist. Analyze resumes for keyword optimization and provide actionable recommendations.

${this.buildAnalysisPrompt(resumeText, jobText, targetRole, targetIndustry)}`;
      
      const analysisResult = await azureOpenAIService.generateCompletion(fullPrompt);
      if (!analysisResult) {
        throw new Error('No analysis result from Azure OpenAI');
      }

      return this.parseAnalysisResult(analysisResult, resumeData);
    } catch (error) {
      console.error('Error analyzing keywords:', error);
      throw new Error('Failed to analyze keywords');
    }
  }

  async optimizeResumeContent(
    resumeData: ResumeData,
    jobDescription: JobDescription,
    sections: string[] = ['summary', 'experience', 'skills']
  ): Promise<Partial<ResumeData>> {
    try {
      const optimizationPrompts = sections.map(section => 
        this.buildOptimizationPrompt(resumeData, jobDescription, section)
      );

      const optimizedSections: Partial<ResumeData> = {};

      // Ensure Azure OpenAI service is initialized
      await azureOpenAIService.initialize();
      
      for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        const prompt = optimizationPrompts[i];

        const fullPrompt = `You are an expert resume writer specializing in ATS optimization. Rewrite resume sections to include relevant keywords while maintaining authenticity and readability.

${prompt}`;

        const optimizedContent = await azureOpenAIService.generateCompletion(fullPrompt);
        if (optimizedContent) {
          this.applyOptimizedContent(optimizedSections, section, optimizedContent, resumeData);
        }
      }

      return optimizedSections;
    } catch (error) {
      console.error('Error optimizing resume content:', error);
      throw new Error('Failed to optimize resume content');
    }
  }

  async generateKeywordSuggestions(
    role: string,
    industry: string,
    experienceLevel: string = 'mid'
  ): Promise<{
    technical: string[];
    soft: string[];
    industrySpecific: string[];
    trending: string[];
  }> {
    try {
      const prompt = `
        Generate relevant keywords for a ${experienceLevel}-level ${role} position in the ${industry} industry.
        
        Provide keywords in these categories:
        1. Technical skills and tools
        2. Soft skills and competencies
        3. Industry-specific terms and knowledge
        4. Trending skills and technologies
        
        Format as JSON with arrays for each category.
        Focus on keywords that are commonly searched by ATS systems and recruiters.
      `;

      // Ensure Azure OpenAI service is initialized
      await azureOpenAIService.initialize();
      
      const fullPrompt = `You are a recruitment expert who understands ATS systems and keyword optimization.

${prompt}`;

      const result = await azureOpenAIService.generateCompletion(fullPrompt);
      if (!result) {
        throw new Error('No keyword suggestions generated');
      }

      try {
        return JSON.parse(result);
      } catch {
        // Fallback parsing if JSON format is not perfect
        return this.parseKeywordSuggestions(result);
      }
    } catch (error) {
      console.error('Error generating keyword suggestions:', error);
      throw new Error('Failed to generate keyword suggestions');
    }
  }

  async scoreAtsCompatibility(resumeData: ResumeData): Promise<{
    overallScore: number;
    sectionScores: {
      formatting: number;
      keywords: number;
      structure: number;
      content: number;
    };
    recommendations: string[];
  }> {
    const resumeText = this.extractResumeText(resumeData);
    
    try {
      const prompt = `
        Analyze this resume for ATS (Applicant Tracking System) compatibility and provide a detailed score.
        
        Resume Content:
        ${resumeText}
        
        Evaluate:
        1. Formatting (use of standard sections, clear headings, proper structure)
        2. Keywords (relevant industry terms, skills, technologies)
        3. Structure (logical flow, proper organization)
        4. Content (quantifiable achievements, action verbs, relevance)
        
        Provide scores out of 100 for each category and an overall score.
        Include specific recommendations for improvement.
        
        Format as JSON with scores and recommendations array.
      `;

      // Ensure Azure OpenAI service is initialized
      await azureOpenAIService.initialize();
      
      const fullPrompt = `You are an ATS expert who evaluates resume compatibility with automated screening systems.

${prompt}`;

      const result = await azureOpenAIService.generateCompletion(fullPrompt);
      if (!result) {
        throw new Error('No ATS score generated');
      }

      try {
        return JSON.parse(result);
      } catch {
        // Fallback scoring
        return this.generateFallbackATSScore(resumeData);
      }
    } catch (error) {
      console.error('Error scoring ATS compatibility:', error);
      return this.generateFallbackATSScore(resumeData);
    }
  }

  private extractResumeText(resumeData: ResumeData): string {
    const sections = [
      `Name: ${resumeData.personalInfo.name}`,
      `Email: ${resumeData.personalInfo.email}`,
      `Location: ${resumeData.personalInfo.location}`,
      resumeData.summary ? `Summary: ${resumeData.summary}` : '',
      'Experience:',
      ...resumeData.experience.map(exp => 
        `${exp.title} at ${exp.company} (${exp.startDate} - ${exp.endDate}): ${exp.description.join(' ')}`
      ),
      'Education:',
      ...resumeData.education.map(edu => 
        `${edu.degree} from ${edu.institution} (${edu.graduationDate})`
      ),
      `Technical Skills: ${resumeData.skills.technical.join(', ')}`,
      `Soft Skills: ${resumeData.skills.soft.join(', ')}`,
      'Projects:',
      ...resumeData.projects.map(project => 
        `${project.name}: ${project.description} (${project.technologies.join(', ')})`
      ),
      'Certifications:',
      ...resumeData.certifications.map(cert => 
        `${cert.name} from ${cert.issuer} (${cert.date})`
      )
    ].filter(Boolean);

    return sections.join('\n');
  }

  private extractJobText(jobDescription: JobDescription): string {
    return [
      `Position: ${jobDescription.title}`,
      jobDescription.company ? `Company: ${jobDescription.company}` : '',
      `Requirements: ${jobDescription.requirements.join(', ')}`,
      `Preferred Skills: ${jobDescription.preferredSkills.join(', ')}`,
      `Responsibilities: ${jobDescription.responsibilities.join(', ')}`,
      jobDescription.industry ? `Industry: ${jobDescription.industry}` : '',
      jobDescription.experienceLevel ? `Experience Level: ${jobDescription.experienceLevel}` : ''
    ].filter(Boolean).join('\n');
  }

  private buildAnalysisPrompt(
    resumeText: string, 
    jobText: string, 
    targetRole?: string, 
    targetIndustry?: string
  ): string {
    return `
      Analyze this resume for keyword optimization${jobText ? ' against the provided job description' : ''}.

      Resume:
      ${resumeText}

      ${jobText ? `Job Description:\n${jobText}` : ''}

      ${targetRole ? `Target Role: ${targetRole}` : ''}
      ${targetIndustry ? `Target Industry: ${targetIndustry}` : ''}

      Provide analysis in this JSON format:
      {
        "currentKeywords": ["keyword1", "keyword2"],
        "missingKeywords": ["missing1", "missing2"],
        "suggestedImprovements": [
          {
            "section": "experience",
            "original": "original text",
            "suggested": "improved text",
            "keywords": ["added keywords"],
            "impact": "high"
          }
        ],
        "score": 75,
        "industryAlignment": {
          "score": 80,
          "recommendations": ["recommendation1", "recommendation2"]
        }
      }

      Focus on:
      1. Identifying missing critical keywords
      2. Suggesting natural keyword integration
      3. Maintaining authenticity while optimizing
      4. Prioritizing high-impact improvements
    `;
  }

  private buildOptimizationPrompt(
    resumeData: ResumeData, 
    jobDescription: JobDescription, 
    section: string
  ): string {
    const sectionContent = this.getSectionContent(resumeData, section);
    const jobText = this.extractJobText(jobDescription);

    return `
      Optimize this ${section} section for ATS compatibility while maintaining authenticity.

      Current ${section}:
      ${sectionContent}

      Job Description:
      ${jobText}

      Requirements:
      1. Include relevant keywords naturally
      2. Maintain the original meaning and truthfulness
      3. Use action verbs and quantifiable achievements
      4. Ensure ATS-friendly formatting
      5. Keep the tone professional

      Provide only the optimized text without additional formatting or explanations.
    `;
  }

  private getSectionContent(resumeData: ResumeData, section: string): string {
    switch (section) {
      case 'summary':
        return resumeData.summary || '';
      case 'experience':
        return resumeData.experience.map(exp => 
          `${exp.title} at ${exp.company}: ${exp.description.join(' ')}`
        ).join('\n');
      case 'skills':
        return `Technical: ${resumeData.skills.technical.join(', ')}; Soft: ${resumeData.skills.soft.join(', ')}`;
      default:
        return '';
    }
  }

  private applyOptimizedContent(
    optimizedSections: Partial<ResumeData>, 
    section: string, 
    content: string, 
    originalData: ResumeData
  ): void {
    switch (section) {
      case 'summary':
        optimizedSections.summary = content;
        break;
      case 'skills':
        // Parse optimized skills content
        const skillsMatch = content.match(/Technical:\s*([^;]+);?\s*Soft:\s*([^;]+)/i);
        if (skillsMatch) {
          optimizedSections.skills = {
            technical: skillsMatch[1].split(',').map(s => s.trim()),
            soft: skillsMatch[2].split(',').map(s => s.trim())
          };
        }
        break;
      case 'experience':
        // For experience, we'd need more sophisticated parsing
        // For now, keep original structure but note optimization was attempted
        optimizedSections.experience = originalData.experience;
        break;
    }
  }

  private parseAnalysisResult(result: string, resumeData: ResumeData): KeywordAnalysis {
    try {
      return JSON.parse(result);
    } catch {
      // Fallback analysis if JSON parsing fails
      return {
        currentKeywords: this.extractCurrentKeywords(resumeData),
        missingKeywords: [],
        suggestedImprovements: [],
        score: 50,
        industryAlignment: {
          score: 50,
          recommendations: ['Unable to perform detailed analysis. Please try again.']
        }
      };
    }
  }

  private extractCurrentKeywords(resumeData: ResumeData): string[] {
    const allText = this.extractResumeText(resumeData).toLowerCase();
    const commonKeywords = [
      'javascript', 'python', 'react', 'node.js', 'sql', 'git', 'aws', 'docker',
      'leadership', 'teamwork', 'communication', 'problem-solving', 'project management',
      'agile', 'scrum', 'ci/cd', 'api', 'database', 'frontend', 'backend', 'full-stack'
    ];

    return commonKeywords.filter(keyword => allText.includes(keyword));
  }

  private parseKeywordSuggestions(content: string) {
    // Simple parsing fallback
    return {
      technical: ['React', 'Node.js', 'TypeScript', 'API Development', 'Database Design'],
      soft: ['Leadership', 'Communication', 'Problem Solving', 'Team Collaboration', 'Adaptability'],
      industrySpecific: ['Software Development', 'Web Technologies', 'Cloud Computing', 'DevOps', 'Agile Methodology'],
      trending: ['AI/ML', 'Microservices', 'Kubernetes', 'GraphQL', 'Serverless Architecture']
    };
  }

  private generateFallbackATSScore(resumeData: ResumeData) {
    let score = 50;
    
    // Basic scoring based on presence of sections
    if (resumeData.summary) score += 10;
    if (resumeData.experience.length > 0) score += 20;
    if (resumeData.skills.technical.length > 0) score += 15;
    if (resumeData.education.length > 0) score += 5;

    return {
      overallScore: Math.min(score, 100),
      sectionScores: {
        formatting: 70,
        keywords: score > 70 ? 75 : 50,
        structure: 65,
        content: score > 80 ? 80 : 60
      },
      recommendations: [
        'Add more specific technical keywords',
        'Include quantifiable achievements',
        'Use industry-standard terminology',
        'Ensure consistent formatting'
      ]
    };
  }
}

export const keywordOptimizerService = KeywordOptimizerService.getInstance();
