import type { NextApiRequest, NextApiResponse } from 'next';
import { IncomingForm, File } from 'formidable';
import { readFile, writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { azureOpenAIService } from '@/lib/services/azure-openai-service';
import { resumeProcessingService } from '@/lib/services/resume-processing-service';
import { verifyIdToken } from '@/lib/firebase/admin';

export const config = {
  api: {
    bodyParser: false,
  },
};

// Azure OpenAI Service will be initialized in the handler


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
    // Initialize Azure OpenAI Service
    const isAzureInitialized = await azureOpenAIService.initialize();
    if (!isAzureInitialized) {
      console.error('Azure OpenAI service initialization failed');
      return res.status(500).json({ 
        error: 'Server configuration error',
        details: process.env.NODE_ENV === 'development' ? 'Azure OpenAI service not configured' : undefined
      });
    }

    // Handle authentication
    const authHeader = req.headers.authorization;
    let decodedToken: any = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const idToken = authHeader.split(' ')[1];
      decodedToken = await verifyIdToken(idToken);
      if (!decodedToken) {
        return res.status(401).json({ error: 'Unauthorized - Invalid token' });
      }
    } else if (process.env.NODE_ENV === 'production') {
      // In production, always require auth
      return res.status(401).json({ error: 'Unauthorized - No token provided' });
    } else {
      console.warn('Development mode: Using mock user ID for PDF upload');
      decodedToken = { uid: 'dev-user-001' }; // Mock token for development
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

    const fileBuffer = await readFile(file.filepath);
    
    // Use the resume processing service to handle the upload
    const result = await resumeProcessingService.processResume(
      decodedToken.uid, 
      fileBuffer, 
      file.originalFilename || 'resume.pdf', 
      file.mimetype || 'application/pdf',
      file.size
    );

    if (result.success) {
      return res.status(200).json(result.data);
    } else {
      return res.status(500).json({ error: result.error });
    }
  } catch (error: unknown) {
    console.error('Error processing PDF:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return res.status(500).json({
      error: 'Failed to process PDF',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    });
  }
}
