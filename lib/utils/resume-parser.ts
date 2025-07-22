import { GoogleGenerativeAI } from '@google/generative-ai';
import { WorkExperience, Education, Project } from '../services/firebase-resume-service';

// Initialize Google's Generative AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '');

export interface ParsedResumeData {
  name?: string;
  email?: string;
  phone?: string;
  skills: string[];
  experience: WorkExperience[];
  education: Education[];
  projects?: Project[];
  summary?: string;
}

/**
 * Enhanced resume parsing using both regex and AI
 */
export async function parseResumeText(text: string): Promise<ParsedResumeData> {
  try {
    // First, try basic regex extraction
    const basicData = extractBasicInfo(text);
    
    // Then, enhance with AI-powered extraction
    const aiEnhancedData = await extractWithAI(text);
    
    // Merge the results, preferring AI data when available
    return mergeResumeData(basicData, aiEnhancedData);
  } catch (error) {
    console.error('Error parsing resume:', error);
    // Fallback to basic regex parsing
    return extractBasicInfo(text);
  }
}

/**
 * Basic regex-based extraction (fallback)
 */
function extractBasicInfo(text: string): ParsedResumeData {
  // Extract name (improved patterns)
  const namePatterns = [
    /(?:Name[:\s]+)([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)/i,
    /^([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)+)/m, // First line name pattern
    /([A-Z][a-zA-Z]+\s+[A-Z][a-zA-Z]+)(?:\s*\n|\s*$)/m, // Two-word name pattern
  ];
  
  let name = '';
  for (const pattern of namePatterns) {
    const match = text.match(pattern);
    if (match) {
      name = match[1].trim();
      break;
    }
  }

  // Extract email
  const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  const email = emailMatch ? emailMatch[1] : '';

  // Extract phone
  const phonePatterns = [
    /(?:Phone|Tel|Mobile)[:\s]*([+]?[\d\s\-\(\)]{10,})/i,
    /([+]?[\d\s\-\(\)]{10,})(?=\s|$)/,
  ];
  
  let phone = '';
  for (const pattern of phonePatterns) {
    const match = text.match(pattern);
    if (match) {
      phone = match[1].trim();
      break;
    }
  }

  // Extract skills with improved patterns
  const skillsMatch = text.match(/(?:Skills?|Technical Skills?|Core Competencies)[:\s]*([^]*?)(?=\n\s*[A-Z][^:]*:|$)/i);
  let skills: string[] = [];
  
  if (skillsMatch) {
    skills = skillsMatch[1]
      .replace(/[•\-\*]/g, ',') // Replace bullets with commas
      .split(/[,\n]/)
      .map(skill => skill.trim())
      .filter(skill => skill.length > 0 && skill.length < 50)
      .slice(0, 20); // Limit to 20 skills
  }

  // Extract experience (basic)
  const experienceMatch = text.match(/(?:Experience|Work Experience|Employment)[:\s]*([^]*?)(?=\n\s*(?:Education|Skills?|Projects?)[:\s]|$)/i);
  let experience: WorkExperience[] = [];
  
  if (experienceMatch) {
    const expText = experienceMatch[1];
    // Try to extract company names and positions (basic pattern)
    const jobMatches = expText.match(/([A-Z][^,\n]+(?:Inc\.|Corp\.|LLC|Ltd\.|Company))[,\s]*([^,\n]+)/g);
    
    if (jobMatches) {
      experience = jobMatches.slice(0, 5).map(match => {
        const [company, position = ''] = match.split(/[,\n]/).map(s => s.trim());
        return {
          company: company || 'Unknown Company',
          position: position || 'Unknown Position',
          description: expText.substring(0, 200), // First 200 chars as description
        };
      });
    }
  }

  // Extract education (basic)
  const educationMatch = text.match(/(?:Education|Academic Background)[:\s]*([^]*?)(?=\n\s*(?:Experience|Skills?|Projects?)[:\s]|$)/i);
  let education: Education[] = [];
  
  if (educationMatch) {
    const eduText = educationMatch[1];
    const universityMatch = eduText.match(/([^,\n]*(?:University|College|Institute|School))[,\s]*([^,\n]*)/i);
    
    if (universityMatch) {
      education = [{
        institution: universityMatch[1].trim(),
        degree: universityMatch[2]?.trim() || 'Degree',
        field: 'Field of Study',
      }];
    }
  }

  return {
    name,
    email,
    phone,
    skills,
    experience,
    education,
    projects: [], // Will be enhanced by AI
  };
}

/**
 * AI-powered extraction using Gemini
 */
async function extractWithAI(text: string): Promise<ParsedResumeData> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
    
    const prompt = `
Extract structured information from this resume text and return it in valid JSON format. Follow this exact structure:

{
  "name": "Full Name",
  "email": "email@example.com",
  "phone": "phone number",
  "summary": "Professional summary or objective",
  "skills": ["skill1", "skill2", "skill3"],
  "experience": [
    {
      "company": "Company Name",
      "position": "Job Title",
      "startDate": "MM/YYYY or YYYY",
      "endDate": "MM/YYYY or YYYY or Present",
      "isCurrent": false,
      "description": "Job description",
      "achievements": ["achievement1", "achievement2"],
      "technologies": ["tech1", "tech2"]
    }
  ],
  "education": [
    {
      "institution": "School Name",
      "degree": "Degree Type",
      "field": "Field of Study",
      "startDate": "YYYY",
      "endDate": "YYYY",
      "gpa": 3.5
    }
  ],
  "projects": [
    {
      "name": "Project Name",
      "description": "Project description",
      "technologies": ["tech1", "tech2"],
      "url": "project-url",
      "github": "github-url"
    }
  ]
}

Rules:
- Return ONLY valid JSON, no other text
- If information is not available, use null or empty array
- Extract actual data, don't make up information
- For dates, use the format found in resume or standardize to MM/YYYY
- For current positions, set isCurrent to true and endDate to null
- Extract all skills mentioned (technical, soft skills, tools, technologies)
- Include quantifiable achievements where mentioned

Resume text:
${text}
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const jsonText = response.text().trim();
    
    // Try to parse the JSON response
    const parsedData = JSON.parse(jsonText);
    
    // Validate and clean the data
    return {
      name: parsedData.name || '',
      email: parsedData.email || '',
      phone: parsedData.phone || '',
      summary: parsedData.summary || '',
      skills: Array.isArray(parsedData.skills) ? parsedData.skills.slice(0, 30) : [],
      experience: Array.isArray(parsedData.experience) ? parsedData.experience.slice(0, 10).map((exp: any) => ({
        company: exp.company || 'Unknown Company',
        position: exp.position || 'Unknown Position',
        startDate: exp.startDate || '',
        endDate: exp.endDate || '',
        isCurrent: Boolean(exp.isCurrent),
        description: exp.description || '',
        achievements: Array.isArray(exp.achievements) ? exp.achievements : [],
        technologies: Array.isArray(exp.technologies) ? exp.technologies : [],
      })) : [],
      education: Array.isArray(parsedData.education) ? parsedData.education.slice(0, 5).map((edu: any) => ({
        institution: edu.institution || 'Unknown Institution',
        degree: edu.degree || 'Degree',
        field: edu.field || 'Field of Study',
        startDate: edu.startDate || '',
        endDate: edu.endDate || '',
        gpa: typeof edu.gpa === 'number' ? edu.gpa : undefined,
        description: edu.description || '',
      })) : [],
      projects: Array.isArray(parsedData.projects) ? parsedData.projects.slice(0, 10).map((proj: any) => ({
        name: proj.name || 'Project',
        description: proj.description || '',
        technologies: Array.isArray(proj.technologies) ? proj.technologies : [],
        url: proj.url || '',
        github: proj.github || '',
        startDate: proj.startDate || '',
        endDate: proj.endDate || '',
      })) : [],
    };
    
  } catch (error) {
    console.error('AI extraction failed:', error);
    throw error;
  }
}

/**
 * Merge basic regex data with AI-enhanced data
 */
function mergeResumeData(basicData: ParsedResumeData, aiData: ParsedResumeData): ParsedResumeData {
  return {
    name: aiData.name || basicData.name || '',
    email: aiData.email || basicData.email || '',
    phone: aiData.phone || basicData.phone || '',
    summary: aiData.summary || '',
    skills: [...new Set([...basicData.skills, ...aiData.skills])].slice(0, 30), // Merge and dedupe
    experience: aiData.experience.length > 0 ? aiData.experience : basicData.experience,
    education: aiData.education.length > 0 ? aiData.education : basicData.education,
    projects: aiData.projects || [],
  };
}

/**
 * Generate interview questions based on parsed resume data
 */
export async function generateInterviewQuestions(resumeData: ParsedResumeData): Promise<string[]> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
    
    const prompt = `
Based on the following resume information, generate 8-10 relevant interview questions that would be appropriate for this candidate. 

Focus on:
- Technical skills mentioned
- Work experience and achievements
- Projects and technologies used
- Career progression and goals
- Behavioral questions based on their background

Resume Information:
Name: ${resumeData.name}
Skills: ${resumeData.skills.join(', ')}
Experience: ${resumeData.experience.map(exp => `${exp.position} at ${exp.company}`).join('; ')}
Education: ${resumeData.education.map(edu => `${edu.degree} in ${edu.field} from ${edu.institution}`).join('; ')}
Projects: ${resumeData.projects?.map(proj => proj.name).join(', ') || 'None mentioned'}

Return only the questions, one per line, numbered 1-10. No additional text or explanations.
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const questionsText = response.text();
    
    const questions = questionsText
      .split('\n')
      .map(q => q.trim())
      .filter(q => q.length > 0)
      .map(q => q.replace(/^\d+\.?\s*/, '')) // Remove numbering
      .filter(q => q.length > 10) // Filter out very short responses
      .slice(0, 10); // Limit to 10 questions

    return questions;
  } catch (error) {
    console.error('Error generating interview questions:', error);
    // Return default questions as fallback
    return [
      'Tell me about yourself and your background.',
      'What interests you most about this position?',
      'Describe your experience with the technologies mentioned in your resume.',
      'Tell me about a challenging project you worked on.',
      'How do you stay updated with new technologies in your field?',
      'Describe a time when you had to work under pressure.',
      'What are your career goals for the next few years?',
      'How do you approach problem-solving in your work?'
    ];
  }
}
