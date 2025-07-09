import { GoogleGenerativeAI } from '@google/generative-ai';
import { writeFile, unlink, readFile } from 'fs/promises';
import { join } from 'path';
import type { NextApiRequest, NextApiResponse } from 'next';
import { IncomingForm, File } from 'formidable';
import { getAuth } from 'firebase-admin/auth';
import * as pdfjs from 'pdfjs-dist';
import { TextItem } from 'pdfjs-dist/types/src/display/api';
import pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.js';
pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const auth = getAuth();

// Helper to verify the Firebase ID token
async function verifyIdToken(token: string) {
  try {
    const decodedToken = await auth.verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    console.error('Error verifying token:', error);
    return null;
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};

// Initialize Google's Generative AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '');

async function parsePDF(filePath: string): Promise<string> {
  try {
    const data = new Uint8Array(await readFile(filePath));
    const loadingTask = pdfjs.getDocument({ data });
    const pdfDocument = await loadingTask.promise;
    
    let fullText = '';
    
    // Extract text from each page
    for (let i = 1; i <= pdfDocument.numPages; i++) {
      const page = await pdfDocument.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map(item => (item as TextItem).str || '')
        .join(' ');
      
      fullText += pageText + '\n\n';
    }
    
    return fullText.trim();
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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify Firebase ID token from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized - No token provided' });
  }

  const idToken = authHeader.split(' ')[1];
  const decodedToken = await verifyIdToken(idToken);
  if (!decodedToken) {
    return res.status(401).json({ error: 'Unauthorized - Invalid token' });
  }
  
  try {
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
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
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
