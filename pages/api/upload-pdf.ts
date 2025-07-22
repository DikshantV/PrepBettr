import type { NextApiRequest, NextApiResponse } from 'next';
import { IncomingForm, File } from 'formidable';
import { readFile, writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { updateUserResume } from '../../lib/services/firebase-resume-service';
import { parseResumeText, generateInterviewQuestions } from '../../lib/utils/resume-parser';
import { verifyIdToken } from '../../lib/firebase/admin';

export const config = {
  api: {
    bodyParser: false,
  },
};

// Initialize Google's Generative AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '');

async function parsePDF(filePath: string): Promise<string> {
  try {
    const dataBuffer = await readFile(filePath);
    const { default: pdf } = await import('pdf-parse');
    const data = await pdf(dataBuffer);
    return data.text.trim();
  } finally {
    // Clean up the temporary file
    await unlink(filePath).catch(console.error);
  }
}

// Helper: Extract key info from resume text
function extractResumeInfo(text: string) {
  // Simple regex-based extraction (improve as needed)
  const nameMatch = text.match(/Name[:\s]+([A-Z][a-zA-Z]+(\s[A-Z][a-zA-Z]+)*)/i);
  const experienceMatch = text.match(/Experience[:\s]+([\s\S]*?)(Education[:\s]|Skills[:\s]|$)/i);
  const educationMatch = text.match(/Education[:\s]+([\s\S]*?)(Skills[:\s]|Experience[:\s]|$)/i);
  const skillsMatch = text.match(/Skills?[:\s]+([\s\S]*?)(Education[:\s]|Experience[:\s]|$)/i);

  return {
    name: nameMatch ? nameMatch[1].trim() : '',
    experience: experienceMatch ? experienceMatch[1].replace(/(Education[:\s]|Skills?[:\s]).*$/i, '').trim() : '',
    education: educationMatch ? educationMatch[1].replace(/(Skills?[:\s]|Experience[:\s]).*$/i, '').trim() : '',
    skills: skillsMatch ? skillsMatch[1].replace(/(Education[:\s]|Experience[:\s]).*$/i, '').trim() : '',
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check if Google API key is available
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      console.error('Google Generative AI API key is not configured');
      return res.status(500).json({ 
        error: 'Server configuration error',
        details: process.env.NODE_ENV === 'development' ? 'Google AI API key not configured' : undefined
      });
    }

    // For now, skip Firebase auth in development if no token is provided
    // This allows testing without full auth setup
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const idToken = authHeader.split(' ')[1];
      const decodedToken = await verifyIdToken(idToken);
      if (!decodedToken) {
        return res.status(401).json({ error: 'Unauthorized - Invalid token' });
      }
    } else if (process.env.NODE_ENV === 'production') {
      // In production, always require auth
      return res.status(401).json({ error: 'Unauthorized - No token provided' });
    } else {
      console.warn('Development mode: Skipping authentication for PDF upload');
    }

    // Parse the form data
    const form = new IncomingForm();
    const { files } = await new Promise<{ files: { file?: File[] } }>((resolve, reject) => {
      form.parse(req, (err, _, files) => {
        if (err) return reject(err);
        resolve({ files } as { files: { file?: File[] } });
      });
    });

    const file = files?.file?.[0];
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    // Ensure the file is a PDF
    if (!file.mimetype?.includes('pdf')) {
      return res.status(400).json({ error: 'Only PDF files are allowed' });
    }
    // Ensure the file size is reasonable (e.g., 10MB max)
    const fileSizeInMB = file.size / (1024 * 1024);
    if (fileSizeInMB > 10) {
      return res.status(400).json({ error: 'File size too large. Maximum 10MB allowed.' });
    }
    // Save the uploaded file temporarily
    const tempFilePath = join('/tmp', `resume-${Date.now()}.pdf`);
    await writeFile(tempFilePath, await readFile(file.filepath));
    // Parse PDF text
    const text = await parsePDF(tempFilePath);
    if (!text.trim()) {
      return res.status(400).json({ error: 'Could not extract text from PDF' });
    }
    // Extract key info
    const resumeInfo = extractResumeInfo(text);
    // Generate questions using Gemini, sending only key info
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `Given the following resume information, generate 5 relevant interview questions. Format each question on a new line. Only return the questions, no additional text.\n\nName: ${resumeInfo.name}\nExperience: ${resumeInfo.experience}\nEducation: ${resumeInfo.education}\nSkills: ${resumeInfo.skills}`;
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const questionsText = response.text();
    const questions = questionsText
      .split('\n')
      .map(q => q.trim())
      .filter(q => q.length > 0)
      .slice(0, 5);
    // Respond with structured info and questions
    return res.status(200).json({
      success: true,
      resumeInfo,
      questions
    });
  } catch (error: unknown) {
    console.error('Error processing PDF:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return res.status(500).json({
      error: 'Failed to process PDF',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    });
  }
}
