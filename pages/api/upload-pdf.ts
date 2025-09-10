import type { NextApiRequest, NextApiResponse } from 'next';
import { migrationOpenAIClient } from '@/lib/azure-ai-foundry/clients/migration-wrapper';
import { IncomingForm, File } from 'formidable';
import { readFile, writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { azureOpenAIService } from '@/lib/services/azure-openai-service';
import { resumeProcessingService } from '@/lib/services/resume-processing-service';
import { verifyIdToken } from '@/lib/firebase/admin';
import {
  ErrorCode,
  APIResponse,
  createErrorResponse,
  createSuccessResponse,
  getHTTPStatusFromErrorCode
} from '@/lib/utils/structured-errors';

export const config = {
  api: {
    bodyParser: false,
  },
};

// Azure OpenAI Service will be initialized in the handler


export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<APIResponse>
) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    const err = createErrorResponse(
      ErrorCode.INVALID_REQUEST,
      { method: req.method },
      'Method not allowed'
    );
    return res.status(getHTTPStatusFromErrorCode(err.error.code)).json(err);
  }

  try {
    // Initialize Azure OpenAI Service
    const isAzureInitialized = await azureOpenAIService.initialize();
    if (!isAzureInitialized) {
      console.error('Azure OpenAI service initialization failed');
      const err = createErrorResponse(
        ErrorCode.SERVICE_NOT_CONFIGURED,
        { service: 'azure-openai' },
        'Server configuration error'
      );
      const status = getHTTPStatusFromErrorCode(err.error.code);
      if (err.error.retryable && err.error.retryAfter) {
        res.setHeader('Retry-After', String(err.error.retryAfter));
        res.setHeader('X-Retry-After', String(err.error.retryAfter));
      }
      return res.status(status).json(err);
    }

    // Handle authentication
    const authHeader = req.headers.authorization;
    let decodedToken: any = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const idToken = authHeader.split(' ')[1];
      decodedToken = await verifyIdToken(idToken);
      if (!decodedToken) {
        const err = createErrorResponse(ErrorCode.AUTH_TOKEN_INVALID);
        return res.status(getHTTPStatusFromErrorCode(err.error.code)).json(err);
      }
    } else if (process.env.NODE_ENV === 'production') {
      // In production, always require auth
      const err = createErrorResponse(ErrorCode.AUTH_TOKEN_MISSING);
      return res.status(getHTTPStatusFromErrorCode(err.error.code)).json(err);
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
      const err = createErrorResponse(
        ErrorCode.MISSING_REQUIRED_FIELD,
        { field: 'file' },
        'No file uploaded'
      );
      return res.status(getHTTPStatusFromErrorCode(err.error.code)).json(err);
    }

    // Validate file size and type
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      const err = createErrorResponse(
        ErrorCode.FILE_TOO_LARGE,
        { size: file.size, maxSize: 10485760 },
        'File size exceeds 10MB limit'
      );
      return res.status(getHTTPStatusFromErrorCode(err.error.code)).json(err);
    }

    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (file.mimetype && !allowedTypes.includes(file.mimetype)) {
      const err = createErrorResponse(
        ErrorCode.INVALID_FILE_TYPE,
        { type: file.mimetype, allowedTypes },
        'Invalid file type. Please upload a PDF or Word document'
      );
      return res.status(getHTTPStatusFromErrorCode(err.error.code)).json(err);
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
      const successResponse = createSuccessResponse(result.data);
      return res.status(200).json(successResponse);
    } else {
      // Map service error to structured error
      let code: ErrorCode = ErrorCode.INTERNAL_SERVER_ERROR;
      if (result.error?.includes('quota') || result.error?.includes('rate limit')) {
        code = ErrorCode.RATE_LIMIT_EXCEEDED;
      } else if (result.error?.includes('storage')) {
        code = ErrorCode.STORAGE_ERROR;
      } else if (result.error?.includes('processing') || result.error?.includes('gemini')) {
        code = ErrorCode.INTERNAL_SERVER_ERROR;
      }
      
      const err = createErrorResponse(code, { service: 'resume-processing' }, result.error);
      const status = getHTTPStatusFromErrorCode(err.error.code);
      if (err.error.retryable && err.error.retryAfter) {
        res.setHeader('Retry-After', String(err.error.retryAfter));
        res.setHeader('X-Retry-After', String(err.error.retryAfter));
      }
      return res.status(status).json(err);
    }
  } catch (error: unknown) {
    console.error('Error processing PDF:', error);
    
    // Determine appropriate error code
    let code: ErrorCode = ErrorCode.INTERNAL_SERVER_ERROR;
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    
    if (message.includes('quota') || message.includes('rate limit')) {
      code = ErrorCode.RATE_LIMIT_EXCEEDED;
    } else if (message.includes('timeout')) {
      code = ErrorCode.SERVICE_TIMEOUT;
    } else if (message.includes('storage') || message.includes('firebase')) {
      code = ErrorCode.STORAGE_ERROR;
    } else if (message.includes('authorization') || message.includes('auth')) {
      code = ErrorCode.AUTH_TOKEN_INVALID;
    } else if (message.includes('file')) {
      code = ErrorCode.INVALID_FILE_TYPE;
    }
    
    const err = createErrorResponse(
      code,
      { context: 'pdf-upload' },
      'Failed to process PDF'
    );
    
    const status = getHTTPStatusFromErrorCode(err.error.code);
    if (err.error.retryable && err.error.retryAfter) {
      res.setHeader('Retry-After', String(err.error.retryAfter));
      res.setHeader('X-Retry-After', String(err.error.retryAfter));
    }
    
    return res.status(status).json(err);
  }
}
