import { NextRequest, NextResponse } from 'next/server';
import { firebaseVerification } from '@/lib/services/firebase-verification';
import { azureBlobStorage } from '@/lib/services/azure-blob-storage';
import { azureCosmosService } from '@/lib/services/azure-cosmos-service';
import { 
  createErrorResponse, 
  logServerError, 
  mapErrorToResponse,
  ServerErrorContext 
} from '@/lib/errors';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp'
];

export async function POST(req: NextRequest) {
  const requestUrl = req.url;
  const userAgent = req.headers.get('user-agent') || undefined;
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined;
  let userId: string | undefined;

  try {
    // Verify authentication via session cookie
    const sessionCookie = req.cookies.get('session')?.value;
    
    if (!sessionCookie) {
      const errorResponse = createErrorResponse('Authentication required', 401);
      return NextResponse.json(errorResponse, { status: errorResponse.status });
    }

    const verificationResult = await firebaseVerification.verifyIdToken(sessionCookie);
    
    if (!verificationResult.success || !verificationResult.decodedToken) {
      const errorResponse = createErrorResponse('Invalid session', 401);
      return NextResponse.json(errorResponse, { status: errorResponse.status });
    }

    userId = verificationResult.decodedToken.uid;
    
    if (!userId) {
      const errorResponse = createErrorResponse('User ID not found in token', 401);
      return NextResponse.json(errorResponse, { status: errorResponse.status });
    }

    // Parse form data
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      const errorResponse = createErrorResponse('No file uploaded', 400);
      return NextResponse.json(errorResponse, { status: errorResponse.status });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      const errorResponse = createErrorResponse('File size exceeds 5MB limit', 413);
      return NextResponse.json(errorResponse, { status: errorResponse.status });
    }

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      const errorResponse = createErrorResponse(
        'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.', 
        422
      );
      return NextResponse.json(errorResponse, { status: errorResponse.status });
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    console.log(`🖼️ Uploading profile picture for user ${userId}: ${file.name}`);
    
    // Initialize Azure Blob Storage
    const azureInitialized = await azureBlobStorage.initialize();
    
    let uploadResult;
    let storageProvider: 'azure' | 'firebase';
    
    if (azureInitialized) {
      try {
        // Upload to Azure Blob Storage (userId is guaranteed to be defined here)
        uploadResult = await azureBlobStorage.uploadProfilePicture(
          userId!,
          fileBuffer,
          file.name,
          file.type
        );
        storageProvider = 'azure';
        
        console.log(`✅ Profile picture uploaded to Azure: ${uploadResult.blobName}`);
      } catch (azureError) {
        console.warn('⚠️ Azure upload failed, falling back to Firebase:', azureError);
        
        // Fallback to Firebase would go here if needed
        throw new Error('Profile picture upload failed');
      }
    } else {
      // Fallback to Firebase would go here if needed
      throw new Error('No storage provider available');
    }

    // Update user profile with new profile picture URL
    try {
      const user = await azureCosmosService.getUser(userId!);
      if (user) {
        await azureCosmosService.updateUser(userId!, {
          ...user,
          profilePictureUrl: uploadResult!.blobUrl,
          profilePictureBlobName: uploadResult!.blobName,
          updatedAt: new Date()
        });
      }
    } catch (dbError) {
      console.warn('Failed to update user profile with new picture URL:', dbError);
      // Don't fail the upload if we can't update the profile
    }

    // Return success response
    return NextResponse.json({
      success: true,
      data: {
        url: uploadResult!.blobUrl,
        blobName: uploadResult!.blobName,
        storageProvider,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type
      }
    });

  } catch (error: any) {
    // Create server error context for logging
    const context: ServerErrorContext = {
      userId,
      url: requestUrl,
      method: 'POST',
      timestamp: new Date().toISOString(),
      userAgent,
      ip
    };

    // Log the server error with context
    logServerError(error, context, { 
      endpoint: 'upload-profile-pic',
      fileSize: error.fileInfo?.size,
      mimeType: error.fileInfo?.type
    });

    // Map error to standardized response
    const errorResponse = mapErrorToResponse(error);
    return NextResponse.json(errorResponse, { status: errorResponse.status });
  }
}
