import { NextRequest, NextResponse } from 'next/server';
import { auth as adminAuth, storage } from '@/firebase/admin';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
  try {
    // Get the form data
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const idToken = formData.get('idToken') as string | null;

    if (!file || !idToken) {
      return NextResponse.json(
        { error: 'File and ID token are required' },
        { status: 400 }
      );
    }

    // Verify the ID token
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const userId = decodedToken.uid;

    // Generate a unique filename
    const fileExtension = file.name.split('.').pop();
    const fileName = `profile-pictures/${userId}/${uuidv4()}.${fileExtension}`;

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Get the bucket
    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (!bucketName) {
      throw new Error('Firebase Storage bucket name is not configured');
    }
    const bucket = storage.bucket(bucketName);

    // Upload the file to Firebase Storage
    const fileUpload = bucket.file(fileName);
    
    // Create a promise to upload the file
    const uploadPromise = new Promise<string>((resolve, reject) => {
      const blobStream = fileUpload.createWriteStream({
        metadata: {
          contentType: file.type,
          metadata: {
            firebaseStorageDownloadTokens: uuidv4(),
          },
        },
        resumable: false,
      });

      blobStream.on('error', (error: Error) => {
        console.error('Error uploading file:', error);
        reject(new Error('Error uploading file'));
      });

      blobStream.on('finish', async () => {
        try {
          // Make the file public
          await fileUpload.makePublic();
          
          // Get the public URL
          const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileUpload.name}`;
          
          resolve(publicUrl);
        } catch (error) {
          console.error('Error making file public:', error);
          reject(new Error('Error making file public'));
        }
      });

      blobStream.end(buffer);
    });

    // Wait for the upload to complete
    const publicUrl = await uploadPromise;
    return NextResponse.json({ url: publicUrl });
    
  } catch (error) {
    console.error('Error in upload-profile-pic:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to upload file',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    );
  }
}
