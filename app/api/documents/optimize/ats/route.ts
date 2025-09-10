/**
 * ATS Optimization API - App Router Endpoint
 * 
 * POST /api/documents/optimize/ats
 * 
 * Provides ATS (Applicant Tracking System) optimization analysis and recommendations
 * for resumes. Can analyze existing resume data or process new documents.
 */

import { NextRequest, NextResponse } from 'next/server';
import { enhancedResumeProcessingService } from '@/lib/services/enhanced-resume-processing-service';
import { foundryDocumentIntelligenceService } from '@/lib/azure-ai-foundry/documents/document-client';
import { verifyIdToken } from '@/lib/firebase/admin';
import { logServerError } from '@/lib/errors';

export const runtime = 'nodejs';

interface ATSOptimizationRequest {
  // Option 1: Analyze existing resume by user ID
  userId?: string;
  
  // Option 2: Upload new document for analysis
  file?: File;
  
  // Job description for targeted optimization
  jobDescription?: string;
  
  // Analysis options
  options?: {
    includeKeywordDensity?: boolean;
    includeFormatting?: boolean;
    includeStructuralAnalysis?: boolean;
    targetIndustry?: string;
    experienceLevel?: 'entry' | 'mid' | 'senior' | 'executive';
  };
}

interface ATSOptimizationResponse {
  success: boolean;
  data?: {
    atsScore: number; // 0-100
    overallGrade: 'A' | 'B' | 'C' | 'D' | 'F';
    
    // Detailed analysis
    keywordAnalysis: {
      totalKeywords: number;
      matchedKeywords: string[];
      missingKeywords: string[];
      keywordDensity: number;
      recommendations: string[];
    };
    
    formatAnalysis: {
      score: number;
      issues: Array<{
        type: 'critical' | 'warning' | 'suggestion';
        issue: string;
        solution: string;
        impact: string;
      }>;
    };
    
    structuralAnalysis: {
      score: number;
      hasContactInfo: boolean;
      hasProfessionalSummary: boolean;
      hasWorkExperience: boolean;
      hasEducation: boolean;
      hasSkillsSection: boolean;
      recommendations: string[];
    };
    
    industryAlignment?: {
      score: number;
      relevantSkills: string[];
      suggestedSkills: string[];
      industryKeywords: string[];
    };
    
    improvements: Array<{
      priority: 'high' | 'medium' | 'low';
      category: 'keywords' | 'formatting' | 'structure' | 'content';
      description: string;
      implementation: string;
      expectedImpact: string;
    }>;
    
    processingTime: number;
    lastAnalyzed: string;
  };
  error?: string;
  message?: string;
}

/**
 * POST /api/documents/optimize/ats
 * ATS optimization analysis and recommendations
 */
export async function POST(request: NextRequest): Promise<NextResponse<ATSOptimizationResponse>> {
  const startTime = Date.now();
  
  try {
    console.log('🎯 ATS optimization API called');

    // Handle authentication
    const authHeader = request.headers.get('authorization');
    let currentUserId: string;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const idToken = authHeader.split(' ')[1];
      const decodedToken = await verifyIdToken(idToken);
      
      if (!decodedToken) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized - Invalid token' },
          { status: 401 }
        );
      }
      currentUserId = decodedToken.uid;
    } else if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - No token provided' },
        { status: 401 }
      );
    } else {
      console.warn('⚠️ Development mode: Using mock user ID');
      currentUserId = 'dev-user-ats-001';
    }

    // Parse request data
    const isFormData = request.headers.get('content-type')?.includes('multipart/form-data');
    let userId: string | undefined;
    let file: File | undefined;
    let jobDescription: string | undefined;
    let options: any = {};

    if (isFormData) {
      // Handle file upload
      const formData = await request.formData();
      file = formData.get('file') as File;
      jobDescription = formData.get('jobDescription') as string;
      const optionsJson = formData.get('options') as string;
      
      if (optionsJson) {
        try {
          options = JSON.parse(optionsJson);
        } catch (parseError) {
          console.warn('⚠️ Failed to parse options JSON:', parseError);
        }
      }
    } else {
      // Handle JSON request
      const body = await request.json();
      userId = body.userId;
      jobDescription = body.jobDescription;
      options = body.options || {};
    }

    // Set default options
    options = {
      includeKeywordDensity: true,
      includeFormatting: true,
      includeStructuralAnalysis: true,
      experienceLevel: 'mid',
      ...options
    };

    console.log(`📋 ATS optimization options:`, {
      hasFile: !!file,
      targetUserId: userId,
      hasJobDescription: !!jobDescription,
      ...options
    });

    let resumeData: any;

    // Get or process resume data
    if (file) {
      // Process new file upload
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
      ];

      if (!allowedTypes.includes(file.type)) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Unsupported file type. Please upload PDF, DOCX, DOC, or TXT files.' 
          },
          { status: 400 }
        );
      }

      const maxFileSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxFileSize) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'File size exceeds 10MB limit. Please use a smaller file.' 
          },
          { status: 400 }
        );
      }

      // Process file for ATS analysis only
      const fileBuffer = Buffer.from(await file.arrayBuffer());
      
      const result = await enhancedResumeProcessingService.processResume(
        currentUserId,
        fileBuffer,
        file.name,
        file.type,
        file.size,
        {
          generateQuestions: false,
          includeAtsAnalysis: true,
          includeJobMatching: !!jobDescription,
          jobDescription
        }
      );

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to process resume for ATS analysis');
      }

      resumeData = result.data.extractedData;

    } else if (userId) {
      // Use existing resume data
      const targetUserId = userId || currentUserId;
      const existingData = await enhancedResumeProcessingService.getUserResumeData(targetUserId);
      
      if (!existingData) {
        return NextResponse.json(
          { success: false, error: 'No resume found for the specified user' },
          { status: 404 }
        );
      }
      
      resumeData = existingData.extractedData;
    } else {
      return NextResponse.json(
        { success: false, error: 'Either provide a file to analyze or specify a userId for existing resume' },
        { status: 400 }
      );
    }

    // Perform comprehensive ATS analysis
    const atsAnalysis = await performComprehensiveATSAnalysis(
      resumeData, 
      jobDescription, 
      options
    );

    const totalTime = Date.now() - startTime;

    console.log(`✅ ATS optimization analysis completed in ${totalTime}ms`);

    return NextResponse.json({
      success: true,
      data: {
        ...atsAnalysis,
        processingTime: totalTime,
        lastAnalyzed: new Date().toISOString()
      },
      message: 'ATS optimization analysis completed successfully'
    });

  } catch (error: unknown) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ ATS optimization API error (${totalTime}ms):`, error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    logServerError(error as Error, {
      service: 'ats-optimization-api',
      action: 'analyze',
      processingTime: totalTime
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to perform ATS optimization analysis',
        message: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * Perform comprehensive ATS analysis
 */
async function performComprehensiveATSAnalysis(
  resumeData: any,
  jobDescription?: string,
  options: any = {}
): Promise<any> {
  
  // Extract text content for analysis
  const resumeText = extractResumeText(resumeData);
  
  // 1. Keyword Analysis
  const keywordAnalysis = analyzeKeywords(resumeText, jobDescription, options);
  
  // 2. Format Analysis  
  const formatAnalysis = analyzeFormat(resumeData, options);
  
  // 3. Structural Analysis
  const structuralAnalysis = analyzeStructure(resumeData, options);
  
  // 4. Industry Alignment (if specified)
  const industryAlignment = options.targetIndustry 
    ? analyzeIndustryAlignment(resumeData, options.targetIndustry, options.experienceLevel)
    : undefined;
    
  // Calculate overall ATS score
  const atsScore = calculateOverallATSScore({
    keywordAnalysis,
    formatAnalysis,
    structuralAnalysis,
    industryAlignment
  });
  
  // Determine grade
  const overallGrade = getGradeFromScore(atsScore);
  
  // Generate improvement recommendations
  const improvements = generateImprovementRecommendations({
    keywordAnalysis,
    formatAnalysis,  
    structuralAnalysis,
    industryAlignment,
    atsScore
  });

  return {
    atsScore,
    overallGrade,
    keywordAnalysis,
    formatAnalysis,
    structuralAnalysis,
    industryAlignment,
    improvements
  };
}

/**
 * Extract text content from resume data
 */
function extractResumeText(resumeData: any): string {
  if (!resumeData) return '';
  
  let text = '';
  
  // Handle Foundry extraction format
  if (resumeData.personalInfo && typeof resumeData.personalInfo === 'object') {
    // Extract from Foundry format
    if (resumeData.personalInfo.name?.content) text += resumeData.personalInfo.name.content + ' ';
    if (resumeData.personalInfo.email?.content) text += resumeData.personalInfo.email.content + ' ';
    
    if (resumeData.skills) {
      text += resumeData.skills.map((s: any) => s.skill || s).join(' ') + ' ';
    }
    
    if (resumeData.experience) {
      resumeData.experience.forEach((exp: any) => {
        text += (exp.company?.content || exp.company || '') + ' ';
        text += (exp.position?.content || exp.position || '') + ' ';
        text += (exp.description?.content || exp.description || '') + ' ';
      });
    }
  } else {
    // Handle legacy format
    if (resumeData.personalInfo?.name) text += resumeData.personalInfo.name + ' ';
    if (resumeData.personalInfo?.email) text += resumeData.personalInfo.email + ' ';
    
    if (resumeData.skills) {
      text += resumeData.skills.join(' ') + ' ';
    }
    
    if (resumeData.experience) {
      resumeData.experience.forEach((exp: any) => {
        text += (exp.company || '') + ' ';
        text += (exp.position || '') + ' ';
        text += (exp.description || '') + ' ';
      });
    }
  }
  
  return text;
}

/**
 * Analyze keywords and density
 */
function analyzeKeywords(resumeText: string, jobDescription?: string, options: any = {}): any {
  const resumeWords = extractWords(resumeText);
  
  if (jobDescription) {
    const jobWords = extractWords(jobDescription);
    const jobKeywords = extractKeywords(jobWords);
    
    const matchedKeywords = jobKeywords.filter(keyword => 
      resumeWords.some(word => word.toLowerCase().includes(keyword.toLowerCase()))
    );
    
    const missingKeywords = jobKeywords.filter(keyword => 
      !matchedKeywords.includes(keyword)
    );
    
    const keywordDensity = matchedKeywords.length / jobKeywords.length;
    
    return {
      totalKeywords: jobKeywords.length,
      matchedKeywords,
      missingKeywords: missingKeywords.slice(0, 10), // Top 10 missing
      keywordDensity,
      recommendations: generateKeywordRecommendations(missingKeywords, keywordDensity)
    };
  } else {
    // Generic keyword analysis
    const keywords = extractKeywords(resumeWords);
    return {
      totalKeywords: keywords.length,
      matchedKeywords: keywords,
      missingKeywords: [],
      keywordDensity: 1.0,
      recommendations: ['Provide a job description for targeted keyword analysis']
    };
  }
}

/**
 * Analyze resume format for ATS compatibility
 */
function analyzeFormat(resumeData: any, options: any = {}): any {
  const issues: any[] = [];
  let score = 100;
  
  // Check for common ATS issues
  if (!resumeData.personalInfo?.email) {
    issues.push({
      type: 'critical',
      issue: 'Missing email address',
      solution: 'Add a professional email address in the contact section',
      impact: 'ATS systems require contact information to process applications'
    });
    score -= 20;
  }
  
  if (!resumeData.personalInfo?.phone) {
    issues.push({
      type: 'warning',
      issue: 'Missing phone number',
      solution: 'Add your phone number for recruiter contact',
      impact: 'Recruiters may not be able to reach you quickly'
    });
    score -= 10;
  }
  
  if (!resumeData.skills || resumeData.skills.length < 5) {
    issues.push({
      type: 'warning',
      issue: 'Limited skills section',
      solution: 'Add more relevant technical and soft skills',
      impact: 'ATS systems heavily weight skill keywords for matching'
    });
    score -= 15;
  }
  
  // Check document structure
  const hasHeaders = resumeData.metadata?.documentStructure?.hasHeaders;
  if (!hasHeaders) {
    issues.push({
      type: 'suggestion',
      issue: 'Unclear section headers',
      solution: 'Use clear, standard section headers like "Experience", "Education", "Skills"',
      impact: 'ATS systems rely on section headers to categorize information'
    });
    score -= 5;
  }
  
  return {
    score: Math.max(0, score),
    issues
  };
}

/**
 * Analyze resume structure
 */
function analyzeStructure(resumeData: any, options: any = {}): any {
  const recommendations: string[] = [];
  let score = 100;
  
  const hasContactInfo = !!(resumeData.personalInfo?.email || resumeData.personalInfo?.phone);
  const hasProfessionalSummary = !!resumeData.summary;
  const hasWorkExperience = resumeData.experience && resumeData.experience.length > 0;
  const hasEducation = resumeData.education && resumeData.education.length > 0;
  const hasSkillsSection = resumeData.skills && resumeData.skills.length > 0;
  
  if (!hasContactInfo) {
    recommendations.push('Add complete contact information including email and phone');
    score -= 20;
  }
  
  if (!hasProfessionalSummary) {
    recommendations.push('Include a professional summary to highlight your value proposition');
    score -= 15;
  }
  
  if (!hasWorkExperience) {
    recommendations.push('Add relevant work experience with specific achievements');
    score -= 25;
  }
  
  if (!hasEducation) {
    recommendations.push('Include your educational background');
    score -= 10;
  }
  
  if (!hasSkillsSection) {
    recommendations.push('Create a dedicated skills section with relevant keywords');
    score -= 20;
  }
  
  return {
    score: Math.max(0, score),
    hasContactInfo,
    hasProfessionalSummary,
    hasWorkExperience,
    hasEducation,
    hasSkillsSection,
    recommendations
  };
}

/**
 * Analyze industry alignment
 */
function analyzeIndustryAlignment(resumeData: any, targetIndustry: string, experienceLevel: string): any {
  // Industry-specific keywords database (simplified)
  const industryKeywords: Record<string, string[]> = {
    'technology': ['javascript', 'python', 'cloud', 'api', 'database', 'agile', 'devops'],
    'healthcare': ['patient care', 'medical', 'clinical', 'hipaa', 'healthcare', 'treatment'],
    'finance': ['financial analysis', 'risk management', 'compliance', 'accounting', 'investment'],
    'marketing': ['digital marketing', 'seo', 'social media', 'analytics', 'campaign', 'brand']
  };
  
  const keywords = industryKeywords[targetIndustry.toLowerCase()] || [];
  const resumeText = extractResumeText(resumeData).toLowerCase();
  
  const relevantSkills = keywords.filter(keyword => resumeText.includes(keyword));
  const suggestedSkills = keywords.filter(keyword => !resumeText.includes(keyword)).slice(0, 5);
  
  const score = keywords.length > 0 ? (relevantSkills.length / keywords.length) * 100 : 50;
  
  return {
    score,
    relevantSkills,
    suggestedSkills,
    industryKeywords: keywords
  };
}

/**
 * Calculate overall ATS score
 */
function calculateOverallATSScore(analysis: any): number {
  const weights = {
    keyword: 0.4,
    format: 0.3,
    structure: 0.2,
    industry: 0.1
  };
  
  let score = 0;
  score += (analysis.keywordAnalysis.keywordDensity * 100) * weights.keyword;
  score += analysis.formatAnalysis.score * weights.format;
  score += analysis.structuralAnalysis.score * weights.structure;
  
  if (analysis.industryAlignment) {
    score += analysis.industryAlignment.score * weights.industry;
  } else {
    // Redistribute industry weight to other factors
    score += analysis.formatAnalysis.score * weights.industry;
  }
  
  return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * Convert score to letter grade
 */
function getGradeFromScore(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/**
 * Generate improvement recommendations
 */
function generateImprovementRecommendations(analysis: any): any[] {
  const improvements: any[] = [];
  
  // Keyword improvements
  if (analysis.keywordAnalysis.keywordDensity < 0.5) {
    improvements.push({
      priority: 'high',
      category: 'keywords',
      description: 'Increase keyword density by including more relevant terms from the job description',
      implementation: `Add these missing keywords: ${analysis.keywordAnalysis.missingKeywords.slice(0, 5).join(', ')}`,
      expectedImpact: 'Significantly improve ATS matching and visibility to recruiters'
    });
  }
  
  // Format improvements
  if (analysis.formatAnalysis.score < 80) {
    improvements.push({
      priority: 'high',
      category: 'formatting',
      description: 'Address critical formatting issues for better ATS parsing',
      implementation: 'Fix the formatting issues identified in the analysis',
      expectedImpact: 'Ensure ATS systems can properly read and categorize your information'
    });
  }
  
  // Structure improvements
  if (analysis.structuralAnalysis.score < 70) {
    improvements.push({
      priority: 'medium',
      category: 'structure',
      description: 'Improve resume structure with missing essential sections',
      implementation: analysis.structuralAnalysis.recommendations.join('; '),
      expectedImpact: 'Create a more complete professional profile for ATS systems'
    });
  }
  
  // Industry alignment improvements
  if (analysis.industryAlignment && analysis.industryAlignment.score < 60) {
    improvements.push({
      priority: 'medium',
      category: 'content',
      description: 'Enhance industry-specific content and keywords',
      implementation: `Consider adding these industry keywords: ${analysis.industryAlignment.suggestedSkills.join(', ')}`,
      expectedImpact: 'Better alignment with industry expectations and job requirements'
    });
  }
  
  return improvements;
}

// Helper functions
function extractWords(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2);
}

function extractKeywords(words: string[]): string[] {
  const stopWords = new Set(['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
  const wordCount: Record<string, number> = {};
  
  words.forEach(word => {
    if (!stopWords.has(word)) {
      wordCount[word] = (wordCount[word] || 0) + 1;
    }
  });
  
  return Object.entries(wordCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word]) => word);
}

function generateKeywordRecommendations(missingKeywords: string[], density: number): string[] {
  const recommendations: string[] = [];
  
  if (density < 0.3) {
    recommendations.push('Keyword density is low. Consider incorporating more job-relevant terms throughout your resume.');
  }
  
  if (missingKeywords.length > 5) {
    recommendations.push(`High number of missing keywords (${missingKeywords.length}). Focus on adding the most relevant ones to your experience descriptions.`);
  }
  
  if (missingKeywords.length > 0) {
    recommendations.push(`Consider adding these keywords naturally: ${missingKeywords.slice(0, 3).join(', ')}`);
  }
  
  return recommendations;
}

/**
 * OPTIONS handler for CORS
 */
export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
