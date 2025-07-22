import { FieldValue } from 'firebase-admin/firestore';
import { getAdminStorage, getAdminFirestore } from '../firebase/admin';

// Types for resume data
export interface ResumeData {
  userId: string;
  fileName: string;
  fileUrl: string;
  filePath: string;
  extractedData: {
    name?: string;
    email?: string;
    phone?: string;
    skills: string[];
    experience: WorkExperience[];
    education: Education[];
    projects?: Project[];
    summary?: string;
  };
  interviewQuestions: string[];
  metadata: {
    fileSize: number;
    uploadDate: Date;
    lastModified: Date;
    mimeType: string;
  };
}

export interface WorkExperience {
  company: string;
  position: string;
  startDate?: string;
  endDate?: string;
  isCurrent?: boolean;
  description: string;
  achievements?: string[];
  technologies?: string[];
}

export interface Education {
  institution: string;
  degree: string;
  field: string;
  startDate?: string;
  endDate?: string;
  gpa?: number;
  description?: string;
}

export interface Project {
  name: string;
  description: string;
  technologies?: string[];
  url?: string;
  github?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Upload resume file to Firebase Cloud Storage
 */
export async function uploadResumeToStorage(
  userId: string,
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<{ fileUrl: string; filePath: string }> {
  try {
    const storage = getAdminStorage();
    const bucket = storage.bucket();
    const filePath = `resumes/${userId}/${fileName}`;
    const file = bucket.file(filePath);

    // Upload the file
    await file.save(fileBuffer, {
      metadata: {
        contentType: mimeType,
        metadata: {
          userId,
          uploadDate: new Date().toISOString(),
        },
      },
    });

    // Make the file publicly readable
    await file.makePublic();

    // Get the public URL
    const fileUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

    return { fileUrl, filePath };
  } catch (error) {
    console.error('Error uploading resume to storage:', error);
    throw new Error('Failed to upload resume to cloud storage');
  }
}

/**
 * Delete resume file from Firebase Cloud Storage
 */
export async function deleteResumeFromStorage(filePath: string): Promise<void> {
  try {
    const storage = getAdminStorage();
    const bucket = storage.bucket();
    const file = bucket.file(filePath);
    
    const [exists] = await file.exists();
    if (exists) {
      await file.delete();
      console.log(`Deleted file: ${filePath}`);
    }
  } catch (error) {
    console.error('Error deleting resume from storage:', error);
    // Don't throw error if file doesn't exist or deletion fails
    // We still want to proceed with the new upload
  }
}

/**
 * Get user's existing resume from Firestore
 */
export async function getUserResume(userId: string): Promise<ResumeData | null> {
  try {
    const db = getAdminFirestore();
    const doc = await db.collection('resumes').doc(userId).get();
    
    if (!doc.exists) {
      return null;
    }
    
    return doc.data() as ResumeData;
  } catch (error) {
    console.error('Error getting user resume:', error);
    return null;
  }
}

/**
 * Save resume data to Firestore
 */
export async function saveResumeToFirestore(resumeData: ResumeData): Promise<string> {
  try {
    const db = getAdminFirestore();
    const docRef = db.collection('resumes').doc(resumeData.userId);
    
    await docRef.set({
      ...resumeData,
      metadata: {
        ...resumeData.metadata,
        uploadDate: FieldValue.serverTimestamp(),
        lastModified: FieldValue.serverTimestamp(),
      },
    });

    console.log(`Resume saved for user: ${resumeData.userId}`);
    return docRef.id;
  } catch (error) {
    console.error('Error saving resume to Firestore:', error);
    throw new Error('Failed to save resume data');
  }
}

/**
 * Delete user's existing resume (both storage and Firestore)
 */
export async function deleteUserResume(userId: string): Promise<void> {
  try {
    const existingResume = await getUserResume(userId);
    
    if (existingResume) {
      // Delete from storage
      await deleteResumeFromStorage(existingResume.filePath);
      
      // Delete from Firestore
      const db = getAdminFirestore();
      await db.collection('resumes').doc(userId).delete();
      
      console.log(`Deleted resume for user: ${userId}`);
    }
  } catch (error) {
    console.error('Error deleting user resume:', error);
    // Don't throw error - we still want to proceed with new upload
  }
}

/**
 * Update resume workflow - delete old and save new
 */
export async function updateUserResume(
  userId: string,
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  fileSize: number,
  extractedData: ResumeData['extractedData'],
  interviewQuestions: string[]
): Promise<{ docId: string; fileUrl: string }> {
  try {
    // Delete existing resume if it exists
    await deleteUserResume(userId);

    // Upload new resume to storage
    const { fileUrl, filePath } = await uploadResumeToStorage(
      userId,
      fileBuffer,
      fileName,
      mimeType
    );

    // Prepare resume data
    const resumeData: ResumeData = {
      userId,
      fileName,
      fileUrl,
      filePath,
      extractedData,
      interviewQuestions,
      metadata: {
        fileSize,
        uploadDate: new Date(),
        lastModified: new Date(),
        mimeType,
      },
    };

    // Save to Firestore
    const docId = await saveResumeToFirestore(resumeData);

    return { docId, fileUrl };
  } catch (error) {
    console.error('Error updating user resume:', error);
    throw error;
  }
}
