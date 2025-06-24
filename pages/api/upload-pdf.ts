import { GoogleGenerativeAI } from '@google/generative-ai';
import { PDFLoader } from 'langchain/document_loaders/web/pdf';
import { writeFile, unlink, readFile } from 'fs/promises';
import { join } from 'path';
import type { NextApiRequest, NextApiResponse } from 'next';
import { IncomingForm, File } from 'formidable';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// Initialize Firebase Admin
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
}

const db = getFirestore();
const storage = getStorage().bucket();
const auth = getAuth();

interface DocumentData {
  userId: string;
  fileName: string;
  fileUrl: string;
  textContent: string;
  questions: string[];
  createdAt: any; // Firestore timestamp
  updatedAt: any; // Firestore timestamp
}

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
    const loader = new PDFLoader(filePath);
    const docs = await loader.load();
    return docs.map(doc => doc.pageContent).join('\n\n');
  } finally {
    // Clean up the temporary file
    await unlink(filePath).catch(console.error);
  }
}

async function storeDocumentInFirebase(
  file: File,
  textContent: string,
  questions: string[],
  userId: string
): Promise<{ fileUrl: string; docId: string }> {
  try {
    const fileName = `documents/${userId}/${Date.now()}_${file.originalFilename || 'document.pdf'}`;
    const fileBuffer = await readFile(file.filepath);
    
    // Upload file to Firebase Storage
    const fileRef = storage.file(fileName);
    await fileRef.save(fileBuffer, {
      metadata: {
        contentType: file.mimetype || 'application/pdf',
      },
    });
    
    // Make the file publicly readable
    await fileRef.makePublic();
    const fileUrl = `https://storage.googleapis.com/${storage.name}/${fileName}`;

    // Save document metadata to Firestore
    const docRef = await db.collection('documents').add({
      userId,
      fileName: file.originalFilename || 'document.pdf',
      fileUrl,
      textContent,
      questions,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return { fileUrl, docId: docRef.id };
  } catch (error) {
    console.error('Error storing document:', error);
    throw new Error('Failed to store document');
  }
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

  const userId = decodedToken.uid;

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

    // Generate questions using Gemini
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    const prompt = `Given the following resume/CV text, generate 5 relevant interview questions. Format each question on a new line. Only return the questions, no additional text. Here's the text:\n\n${text}`;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const questionsText = response.text();
    
    // Split questions by new lines and filter out empty lines
    const questions = questionsText
      .split('\n')
      .map(q => q.trim())
      .filter(q => q.length > 0 && !q.startsWith('**') && !q.startsWith('1.') && !q.startsWith('2.') && !q.startsWith('3.') && !q.startsWith('4.') && !q.startsWith('5.'))
      .slice(0, 5); // Ensure we only return up to 5 questions
      
    // Store the document and get the file URL
    const { fileUrl, docId } = await storeDocumentInFirebase(
      file,
      text,
      questions,
      userId
    );

    return res.status(200).json({ 
      success: true,
      questions,
      fileUrl,
      docId
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
