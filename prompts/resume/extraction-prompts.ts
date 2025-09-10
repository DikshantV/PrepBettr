/**
 * Resume Processing Prompt Templates
 * 
 * Reusable prompt templates for AI-powered resume processing, extraction,
 * and optimization. These templates provide consistent structure across
 * different processing methods.
 */

export interface PromptContext {
  candidateName?: string;
  targetRole?: string;
  companyName?: string;
  experienceLevel?: 'entry' | 'mid' | 'senior' | 'executive';
  targetIndustry?: string;
}

/**
 * Main resume data extraction prompt for structured information extraction
 */
export const RESUME_EXTRACTION_PROMPT = `
Extract the following information from this resume text and return as valid JSON.

Required JSON Structure:
{
  "personalInfo": {
    "name": "Full name",
    "email": "Email address", 
    "phone": "Phone number",
    "address": "Physical address",
    "linkedin": "LinkedIn URL",
    "github": "GitHub URL",
    "website": "Personal website URL",
    "location": "City, State/Country"
  },
  "summary": "Professional summary or objective statement",
  "skills": [
    {
      "skill": "Technical skill or competency",
      "category": "technical|soft|language|certification|tool",
      "proficiency": "beginner|intermediate|advanced|expert",
      "yearsOfExperience": 3
    }
  ],
  "experience": [
    {
      "company": "Company name",
      "position": "Job title", 
      "startDate": "MM/YYYY",
      "endDate": "MM/YYYY or Present",
      "isCurrent": true,
      "location": "City, State",
      "description": "Role description",
      "achievements": ["Quantifiable achievement 1", "Achievement 2"],
      "technologies": ["Technology 1", "Technology 2"],
      "managementScope": {
        "teamSize": 5,
        "budget": "$500K",
        "responsibilities": ["Responsibility 1", "Responsibility 2"]
      },
      "quantifiableResults": [
        {
          "metric": "Revenue increase",
          "value": 25,
          "unit": "percentage", 
          "impact": "Generated $2M additional revenue"
        }
      ]
    }
  ],
  "education": [
    {
      "institution": "School name",
      "degree": "Degree type and level",
      "field": "Field of study", 
      "startDate": "YYYY",
      "endDate": "YYYY",
      "gpa": 3.8,
      "location": "City, State",
      "honors": ["Dean's List", "Magna Cum Laude"],
      "relevantCoursework": ["Course 1", "Course 2"]
    }
  ],
  "projects": [
    {
      "name": "Project name",
      "description": "Project description and impact",
      "technologies": ["Tech stack used"],
      "url": "Project URL",
      "github": "GitHub repository URL",
      "startDate": "MM/YYYY",
      "endDate": "MM/YYYY",
      "role": "Your role in project",
      "teamSize": 3,
      "impact": "Quantifiable impact or outcome"
    }
  ],
  "certifications": [
    {
      "name": "Certification name",
      "issuer": "Issuing organization",
      "date": "Issue date",
      "expiryDate": "Expiry date if applicable",
      "credentialId": "Credential ID",
      "url": "Verification URL",
      "status": "active|expired|pending"
    }
  ],
  "languages": [
    {
      "name": "Language name",
      "proficiency": "native|fluent|conversational|basic",
      "certifications": ["Language certification if any"]
    }
  ],
  "publications": [
    {
      "title": "Publication title",
      "venue": "Journal or conference",
      "date": "Publication date",
      "url": "Publication URL",
      "coAuthors": ["Co-author names"]
    }
  ],
  "awards": [
    {
      "name": "Award name",
      "issuer": "Issuing organization",
      "date": "Award date",
      "description": "Award description"
    }
  ]
}

Extraction Rules:
1. Return ONLY valid JSON, no additional text or formatting
2. If information is not available, use null or empty array
3. Extract actual data from the resume - do not infer or make up information
4. For dates, preserve the original format when clear, otherwise standardize to MM/YYYY
5. For current positions, set isCurrent to true and endDate to null
6. Categorize skills appropriately (technical, soft, language, certification, tool)
7. Extract quantifiable achievements with specific metrics when mentioned
8. Identify management scope including team size, budget, and responsibilities
9. Parse education with GPA only if explicitly mentioned
10. Include all relevant projects with technology stack and impact

Resume Text:
{{RESUME_TEXT}}
`;

/**
 * ATS optimization analysis prompt
 */
export const ATS_OPTIMIZATION_PROMPT = `
Analyze this resume for ATS (Applicant Tracking System) compatibility and provide optimization recommendations.

Resume Data: {{RESUME_DATA}}
{{#if jobDescription}}Job Description: {{jobDescription}}{{/if}}

Provide analysis in this JSON structure:
{
  "atsScore": 85,
  "overallGrade": "B",
  "analysis": {
    "keywordAnalysis": {
      "score": 75,
      "totalKeywords": 25,
      "matchedKeywords": ["keyword1", "keyword2"],
      "missingKeywords": ["missing1", "missing2"],
      "keywordDensity": 0.6,
      "recommendations": ["Add more technical keywords", "Include industry-specific terms"]
    },
    "formatAnalysis": {
      "score": 90,
      "issues": [
        {
          "type": "critical|warning|suggestion",
          "issue": "Issue description",
          "solution": "How to fix it",
          "impact": "Why it matters for ATS"
        }
      ],
      "strengths": ["Clear section headers", "Consistent formatting"]
    },
    "structureAnalysis": {
      "score": 85,
      "missingElements": ["Professional summary", "Skills section"],
      "presentElements": ["Contact info", "Work experience", "Education"],
      "recommendations": ["Add a professional summary", "Create dedicated skills section"]
    },
    "contentAnalysis": {
      "score": 80,
      "strengthAreas": ["Strong quantifiable achievements", "Relevant experience"],
      "improvementAreas": ["Limited technical skills", "No certifications mentioned"],
      "recommendations": ["Highlight more technical competencies", "Include relevant certifications"]
    }
  },
  "prioritizedRecommendations": [
    {
      "priority": "high|medium|low",
      "category": "keywords|formatting|structure|content",
      "recommendation": "Specific recommendation",
      "implementation": "How to implement",
      "expectedImpact": "Expected improvement",
      "timeToImplement": "5 minutes|30 minutes|1 hour"
    }
  ]
}

Analysis Guidelines:
1. Score each category from 0-100
2. Overall ATS score is weighted average: keywords (40%), format (25%), structure (20%), content (15%)
3. Identify specific missing keywords if job description provided
4. Flag common ATS parsing issues (complex formatting, images, tables)
5. Recommend industry-standard section headers
6. Prioritize recommendations by impact and ease of implementation
7. Focus on actionable, specific improvements
`;

/**
 * Job matching analysis prompt
 */
export const JOB_MATCHING_PROMPT = `
Analyze how well this resume matches the provided job description and provide detailed scoring.

Resume Data: {{RESUME_DATA}}
Job Description: {{JOB_DESCRIPTION}}
{{#if targetRole}}Target Role: {{targetRole}}{{/if}}
{{#if experienceLevel}}Experience Level: {{experienceLevel}}{{/if}}

Provide matching analysis in this JSON structure:
{
  "overallMatchScore": 78,
  "matchGrade": "B+",
  "analysis": {
    "skillsMatch": {
      "score": 85,
      "matchedSkills": [
        {
          "skill": "JavaScript",
          "resumeLevel": "advanced",
          "requiredLevel": "intermediate",
          "match": "exceeds"
        }
      ],
      "missingSkills": [
        {
          "skill": "Docker",
          "importance": "high|medium|low",
          "canLearn": true,
          "timeToLearn": "2-4 weeks"
        }
      ],
      "skillGapAnalysis": {
        "criticalGaps": ["Docker", "Kubernetes"],
        "niceToHaveGaps": ["GraphQL", "Redis"],
        "strengthAreas": ["Frontend development", "Team leadership"]
      }
    },
    "experienceMatch": {
      "score": 75,
      "yearsRequired": 5,
      "yearsCandidate": 6,
      "yearsMatch": "exceeds",
      "industryMatch": {
        "score": 80,
        "relevantIndustries": ["Technology", "E-commerce"],
        "transferableExperience": ["Project management", "Team leadership"]
      },
      "roleSimilarity": {
        "score": 85,
        "similarRoles": ["Senior Developer", "Technical Lead"],
        "levelMatch": "appropriate"
      }
    },
    "educationMatch": {
      "score": 90,
      "degreeMatch": true,
      "fieldRelevance": "high",
      "institutionPrestige": "good",
      "additionalQualifications": ["AWS Certification", "Scrum Master"]
    },
    "culturalFit": {
      "score": 70,
      "indicators": [
        "Team collaboration experience",
        "Startup environment familiarity",
        "Remote work experience"
      ],
      "concerns": ["Limited client-facing experience"],
      "strengths": ["Strong mentoring background"]
    }
  },
  "recommendations": [
    {
      "category": "skills|experience|education|presentation",
      "priority": "high|medium|low",
      "recommendation": "Learn Docker and containerization",
      "reasoning": "Critical skill gap for DevOps responsibilities",
      "resources": ["Docker documentation", "Online courses"],
      "timeframe": "2-4 weeks"
    }
  ],
  "interviewPreparation": [
    "Be ready to discuss Docker and containerization gaps",
    "Highlight your team leadership experience",
    "Prepare examples of scalable systems you've built"
  ]
}

Matching Guidelines:
1. Score each category from 0-100 based on alignment with job requirements
2. Overall match score: skills (35%), experience (30%), education (15%), cultural fit (20%)
3. Identify both hard and soft skill gaps
4. Consider transferable skills and learning potential
5. Provide specific, actionable recommendations
6. Include interview preparation suggestions
7. Account for career growth trajectory and potential
`;

/**
 * Industry-specific skills taxonomy and normalization
 */
export const SKILLS_NORMALIZATION_PROMPT = `
Normalize and categorize these extracted skills using industry-standard terminology and frameworks.

Skills to normalize: {{SKILLS_LIST}}
Target Industry: {{TARGET_INDUSTRY}}
Experience Level: {{EXPERIENCE_LEVEL}}

Use these industry frameworks for normalization:
- Technology: SFIA (Skills Framework for the Information Age)
- General: O*NET occupational skills database
- European: ESCO (European Skills, Competences, and Occupations)

Return normalized skills in this JSON structure:
{
  "normalizedSkills": [
    {
      "originalSkill": "React.js",
      "normalizedSkill": "React (JavaScript Framework)",
      "category": "Frontend Development",
      "subcategory": "JavaScript Frameworks",
      "proficiencyLevel": "intermediate",
      "industryStandard": true,
      "frameworks": {
        "sfia": "PROG - Programming/Software Development - Level 4",
        "onet": "15-1252.00 - Software Developers, Applications",
        "esco": "2512.1 - Software developers"
      },
      "relatedSkills": ["JavaScript", "TypeScript", "Redux", "Next.js"],
      "marketDemand": "high",
      "salaryImpact": "positive",
      "learningPath": ["JavaScript basics", "React fundamentals", "Advanced patterns"]
    }
  ],
  "skillCategories": {
    "technical": ["React", "Node.js", "Python"],
    "soft": ["Leadership", "Communication", "Problem Solving"],
    "language": ["English", "Spanish"],
    "certification": ["AWS Certified", "PMP"],
    "tool": ["Git", "Docker", "Kubernetes"]
  },
  "industryAlignment": {
    "score": 85,
    "wellAlignedSkills": ["React", "Node.js", "AWS"],
    "missingIndustrySkills": ["Docker", "Kubernetes", "GraphQL"],
    "emergingSkills": ["Next.js", "Serverless", "Microservices"],
    "recommendations": [
      "Focus on containerization skills (Docker/Kubernetes)",
      "Add cloud-native development experience",
      "Consider learning GraphQL for modern APIs"
    ]
  }
}

Normalization Guidelines:
1. Use industry-standard terminology and spellings
2. Map skills to established frameworks (SFIA, O*NET, ESCO)
3. Categorize skills appropriately for the target industry
4. Identify skill relationships and prerequisites
5. Assess market demand and salary impact
6. Suggest learning paths for skill development
7. Highlight emerging and in-demand skills
`;

/**
 * Interview question generation prompt
 */
export const INTERVIEW_QUESTIONS_PROMPT = `
Generate targeted interview questions based on this resume analysis and job context.

Resume Data: {{RESUME_DATA}}
{{#if jobDescription}}Job Description: {{jobDescription}}{{/if}}
{{#if targetRole}}Target Role: {{targetRole}}{{/if}}
{{#if experienceLevel}}Experience Level: {{experienceLevel}}{{/if}}

Generate questions in this JSON structure:
{
  "questionCategories": {
    "technical": [
      {
        "question": "Describe your experience with React and how you've used it in production applications.",
        "focus": "React expertise validation",
        "difficulty": "intermediate",
        "followUp": ["What challenges did you face?", "How did you optimize performance?"],
        "evaluationCriteria": ["Technical depth", "Real-world application", "Problem-solving approach"]
      }
    ],
    "behavioral": [
      {
        "question": "Tell me about a time when you had to lead a team through a challenging project.",
        "focus": "Leadership and project management",
        "difficulty": "intermediate",
        "framework": "STAR (Situation, Task, Action, Result)",
        "evaluationCriteria": ["Leadership style", "Communication", "Results orientation"]
      }
    ],
    "situational": [
      {
        "question": "How would you approach debugging a performance issue in a React application?",
        "focus": "Problem-solving methodology",
        "difficulty": "intermediate",
        "expectedApproach": "Systematic debugging process",
        "evaluationCriteria": ["Analytical thinking", "Technical knowledge", "Process orientation"]
      }
    ],
    "cultural": [
      {
        "question": "What motivates you in your work, and how do you handle remote collaboration?",
        "focus": "Cultural fit and work style",
        "difficulty": "basic",
        "evaluationCriteria": ["Self-motivation", "Communication style", "Collaboration skills"]
      }
    ]
  },
  "prioritizedQuestions": [
    {
      "priority": 1,
      "question": "Walk me through your most challenging technical project.",
      "category": "technical",
      "rationale": "Validates technical depth and problem-solving skills",
      "timeAllocation": "10-15 minutes"
    }
  ],
  "interviewFlow": {
    "warmup": ["Tell me about yourself", "What interests you about this role?"],
    "technical": ["Core technical competencies", "Problem-solving scenarios"],
    "behavioral": ["Past experiences", "Leadership situations"],
    "closing": ["Questions for us", "Next steps discussion"]
  },
  "redFlags": [
    "Inability to explain technical concepts clearly",
    "No specific examples of problem-solving",
    "Poor communication skills",
    "Lack of growth mindset"
  ],
  "strongIndicators": [
    "Clear technical explanations with examples",
    "Proactive problem-solving approach", 
    "Evidence of continuous learning",
    "Strong collaboration and communication skills"
  ]
}

Question Generation Guidelines:
1. Tailor questions to candidate's experience level and role requirements
2. Balance technical, behavioral, and cultural fit questions
3. Include follow-up questions for deeper exploration
4. Provide evaluation criteria for each question
5. Suggest interview flow and time allocation
6. Identify red flags and positive indicators
7. Generate 15-20 total questions across all categories
8. Focus on validating key skills and experiences from the resume
`;

/**
 * Resume improvement recommendations prompt
 */
export const RESUME_IMPROVEMENT_PROMPT = `
Analyze this resume and provide specific, actionable improvement recommendations.

Resume Data: {{RESUME_DATA}}
{{#if jobDescription}}Target Job Description: {{jobDescription}}{{/if}}
{{#if targetIndustry}}Target Industry: {{targetIndustry}}{{/if}}

Provide improvement recommendations in this JSON structure:
{
  "overallAssessment": {
    "currentStrength": 75,
    "improvementPotential": 15,
    "targetStrength": 90,
    "keyStrengths": ["Strong technical background", "Clear career progression"],
    "majorWeaknesses": ["Limited quantifiable achievements", "Missing industry keywords"]
  },
  "sectionRecommendations": {
    "professionalSummary": {
      "currentStatus": "missing",
      "priority": "high",
      "recommendation": "Add a 2-3 sentence professional summary highlighting key value propositions",
      "example": "Senior Software Engineer with 6+ years building scalable web applications...",
      "impact": "Immediately communicates value to recruiters and ATS systems"
    },
    "experience": {
      "currentStatus": "good",
      "priority": "medium",
      "recommendations": [
        "Add more quantifiable achievements (percentages, dollar amounts, time saved)",
        "Use stronger action verbs (architected, optimized, delivered)",
        "Include team size and scope of responsibility"
      ],
      "examples": [
        "Before: Worked on improving application performance",
        "After: Optimized application performance by 40%, reducing load times from 3s to 1.8s"
      ]
    }
  },
  "contentImprovements": [
    {
      "category": "quantification",
      "priority": "high",
      "current": "Developed web applications",
      "improved": "Developed 5+ web applications serving 10,000+ users daily",
      "reasoning": "Specific metrics demonstrate scale and impact"
    }
  ],
  "formattingImprovements": [
    {
      "issue": "Inconsistent bullet point formatting",
      "priority": "medium",
      "solution": "Use consistent bullet points throughout",
      "impact": "Improves ATS parsing and visual consistency"
    }
  ],
  "keywordOptimization": [
    {
      "skill": "JavaScript",
      "currentUsage": 2,
      "recommendedUsage": 4,
      "contexts": ["Skills section", "Job descriptions", "Project details"],
      "naturalIntegration": "Mention JavaScript frameworks used in each role"
    }
  ],
  "implementationPlan": [
    {
      "phase": 1,
      "timeframe": "30 minutes",
      "tasks": [
        "Add professional summary",
        "Fix formatting inconsistencies",
        "Add missing contact information"
      ],
      "expectedImprovement": "10-15 point increase in ATS score"
    }
  ]
}

Improvement Guidelines:
1. Provide specific, actionable recommendations
2. Include before/after examples for clarity
3. Prioritize improvements by impact and effort
4. Focus on both ATS optimization and human readability
5. Suggest natural keyword integration
6. Provide implementation timeline and expected impact
7. Address both content and formatting issues
`;

/**
 * Helper function to format prompts with context variables
 */
export function formatPrompt(template: string, context: Record<string, any>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return context[key] || match;
  });
}

/**
 * Helper function to format conditional sections in prompts
 */
export function formatConditionalPrompt(template: string, context: Record<string, any>): string {
  // Handle {{#if condition}} blocks
  let formatted = template.replace(/\{\{#if (\w+)\}\}(.*?)\{\{\/if\}\}/gs, (match, condition, content) => {
    return context[condition] ? content : '';
  });
  
  // Handle regular variable substitution
  formatted = formatPrompt(formatted, context);
  
  return formatted.trim();
}

/**
 * Prompt template configurations for different use cases
 */
export const PROMPT_CONFIGS = {
  basic_extraction: {
    template: RESUME_EXTRACTION_PROMPT,
    requiredContext: ['resumeText'],
    optionalContext: ['targetRole', 'companyName']
  },
  ats_optimization: {
    template: ATS_OPTIMIZATION_PROMPT,
    requiredContext: ['resumeData'],
    optionalContext: ['jobDescription', 'targetIndustry']
  },
  job_matching: {
    template: JOB_MATCHING_PROMPT,
    requiredContext: ['resumeData', 'jobDescription'],
    optionalContext: ['targetRole', 'experienceLevel']
  },
  skills_normalization: {
    template: SKILLS_NORMALIZATION_PROMPT,
    requiredContext: ['skillsList'],
    optionalContext: ['targetIndustry', 'experienceLevel']
  },
  interview_questions: {
    template: INTERVIEW_QUESTIONS_PROMPT,
    requiredContext: ['resumeData'],
    optionalContext: ['jobDescription', 'targetRole', 'experienceLevel']
  },
  resume_improvement: {
    template: RESUME_IMPROVEMENT_PROMPT,
    requiredContext: ['resumeData'],
    optionalContext: ['jobDescription', 'targetIndustry']
  }
} as const;

export type PromptConfigKey = keyof typeof PROMPT_CONFIGS;
