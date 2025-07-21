import fs from 'fs';
import pdfParse from 'pdf-parse';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ParseResumeResponse, UserProfile } from '@/types/auto-apply';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');

export async function parseResume(filePath: string): Promise<ParseResumeResponse> {
  try {
    // Read the PDF file
    const dataBuffer = fs.readFileSync(filePath);
    
    // Parse the PDF to extract text
    const pdfData = await pdfParse(dataBuffer);
    const extractedText = pdfData.text;

    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error('No text could be extracted from the PDF');
    }

    // Use Google Gemini to structure the extracted data
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
    
    const prompt = `
      Extract and structure the following resume information into a JSON format. 
      The resume text is:

      ${extractedText}

      Please extract and return a JSON object with the following structure:
      {
        "name": "Full Name",
        "email": "email@example.com",
        "phone": "phone number",
        "location": "city, state/country",
        "linkedinUrl": "LinkedIn profile URL if available",
        "githubUrl": "GitHub profile URL if available",
        "portfolio": "Portfolio/website URL if available",
        "summary": "Professional summary or objective",
        "skills": ["skill1", "skill2", "skill3"],
        "experience": [
          {
            "company": "Company Name",
            "position": "Job Title",
            "startDate": "YYYY-MM",
            "endDate": "YYYY-MM or null if current",
            "isCurrent": true/false,
            "description": "Job description",
            "achievements": ["achievement1", "achievement2"],
            "technologies": ["tech1", "tech2"]
          }
        ],
        "education": [
          {
            "institution": "University Name",
            "degree": "Degree Type",
            "fieldOfStudy": "Field of Study",
            "startDate": "YYYY-MM",
            "endDate": "YYYY-MM",
            "gpa": 3.5,
            "achievements": ["achievement1", "achievement2"]
          }
        ]
      }

      Return only the JSON object, no additional text or formatting.
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    try {
      // Parse the JSON response
      const userProfile = JSON.parse(responseText) as Partial<UserProfile>;
      
      // Calculate confidence based on extracted data completeness
      const confidence = calculateConfidence(userProfile, extractedText);
      
      // Generate warnings if any
      const warnings = generateWarnings(userProfile);

      return {
        userProfile,
        extractedText,
        confidence,
        warnings
      };

    } catch (jsonError) {
      console.error('Error parsing Gemini response as JSON:', jsonError);
      
      // Fallback: basic extraction using simple parsing
      const fallbackProfile = basicTextExtraction(extractedText);
      
      return {
        userProfile: fallbackProfile,
        extractedText,
        confidence: 30, // Lower confidence for fallback method
        warnings: ['AI parsing failed, using basic text extraction. Please review and edit the extracted information.']
      };
    }

  } catch (error) {
    console.error('Error parsing resume:', error);
    throw new Error(`Failed to parse resume: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function calculateConfidence(profile: Partial<UserProfile>, text: string): number {
  let score = 0;
  
  if (profile.name) score += 20;
  if (profile.email) score += 15;
  if (profile.phone) score += 10;
  if (profile.skills && profile.skills.length > 0) score += 20;
  if (profile.experience && profile.experience.length > 0) score += 25;
  if (profile.education && profile.education.length > 0) score += 10;
  
  return Math.min(score, 100);
}

function generateWarnings(profile: Partial<UserProfile>): string[] {
  const warnings: string[] = [];
  
  if (!profile.name) warnings.push('Name not found');
  if (!profile.email) warnings.push('Email not found');
  if (!profile.phone) warnings.push('Phone number not found');
  if (!profile.skills || profile.skills.length === 0) warnings.push('No skills extracted');
  if (!profile.experience || profile.experience.length === 0) warnings.push('No work experience found');
  
  return warnings;
}

function basicTextExtraction(text: string): Partial<UserProfile> {
  const profile: Partial<UserProfile> = {};
  
  // Extract email using regex
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) profile.email = emailMatch[0];
  
  // Extract phone using regex
  const phoneMatch = text.match(/(\+?1)?[-.\s]?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/);
  if (phoneMatch) profile.phone = phoneMatch[0];
  
  // Extract potential skills (this is very basic)
  const skillKeywords = ['JavaScript', 'Python', 'Java', 'React', 'Node.js', 'SQL', 'HTML', 'CSS', 'Git', 'AWS', 'Docker'];
  const foundSkills = skillKeywords.filter(skill => 
    text.toLowerCase().includes(skill.toLowerCase())
  );
  
  if (foundSkills.length > 0) profile.skills = foundSkills;
  
  return profile;
}
