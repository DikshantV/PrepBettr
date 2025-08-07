import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getStorage, Storage } from 'firebase-admin/storage';
import { getAuth } from 'firebase-admin/auth';

export interface InterviewData {
  id?: string;
  userId: string;
  jobTitle: string;
  company: string;
  jobDescription?: string;
  questions: Array<{
    question: string;
    answer?: string;
    category: string;
    difficulty: 'easy' | 'medium' | 'hard';
  }>;
  createdAt: Date;
  updatedAt: Date;
  finalized: boolean;
  feedbackGenerated?: boolean;
}

export interface ResumeData {
  id?: string;
  userId: string;
  fileName: string;
  fileUrl: string;
  extractedText: string;
  parsedSections: {
    summary?: string;
    experience?: Array<{
      title: string;
      company: string;
      duration: string;
      description: string[];
    }>;
    education?: Array<{
      degree: string;
      school: string;
      year?: string;
    }>;
    skills?: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface UsageData {
  userId: string;
  interviews: {
    count: number;
    limit: number;
    lastReset?: Date;
  };
  resumes: {
    count: number;
    limit: number;
    lastReset?: Date;
  };
  updatedAt: Date;
}

export class FirebaseService {
  private db: Firestore;
  private storage: Storage;

  constructor() {
    // Initialize Firebase Admin SDK if not already initialized
    if (!getApps().length) {
      const app = process.env.NODE_ENV === 'test' 
        ? initializeApp({ projectId: 'test-project' })
        : initializeApp({
            credential: process.env.GOOGLE_APPLICATION_CREDENTIALS 
              ? cert(JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS))
              : undefined,
            projectId: process.env.FIREBASE_PROJECT_ID,
            storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
          });
    }

    this.db = getFirestore();
    this.storage = getStorage();
  }

  // Interview Operations
  async createInterview(data: Omit<InterviewData, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const docRef = this.db.collection('interviews').doc();
    const now = new Date();
    
    const interviewData: InterviewData = {
      ...data,
      id: docRef.id,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(interviewData);
    return docRef.id;
  }

  async getInterview(id: string, userId: string): Promise<InterviewData | null> {
    const doc = await this.db.collection('interviews').doc(id).get();
    
    if (!doc.exists) {
      return null;
    }

    const data = doc.data() as InterviewData;
    
    // Check if user owns this interview or if it's finalized
    if (data.userId !== userId && !data.finalized) {
      throw new Error('Access denied: Interview is private');
    }

    return data;
  }

  async updateInterview(id: string, userId: string, updates: Partial<InterviewData>): Promise<void> {
    const docRef = this.db.collection('interviews').doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      throw new Error('Interview not found');
    }

    const data = doc.data() as InterviewData;
    if (data.userId !== userId) {
      throw new Error('Access denied: Not interview owner');
    }

    await docRef.update({
      ...updates,
      updatedAt: new Date(),
    });
  }

  async getUserInterviews(userId: string): Promise<InterviewData[]> {
    const snapshot = await this.db
      .collection('interviews')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map(doc => doc.data() as InterviewData);
  }

  async deleteInterview(id: string, userId: string): Promise<void> {
    const docRef = this.db.collection('interviews').doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      throw new Error('Interview not found');
    }

    const data = doc.data() as InterviewData;
    if (data.userId !== userId) {
      throw new Error('Access denied: Not interview owner');
    }

    await docRef.delete();
  }

  // Resume Operations
  async createResume(data: Omit<ResumeData, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const docRef = this.db.collection('resumes').doc();
    const now = new Date();
    
    const resumeData: ResumeData = {
      ...data,
      id: docRef.id,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(resumeData);
    return docRef.id;
  }

  async getResume(id: string, userId: string): Promise<ResumeData | null> {
    const doc = await this.db.collection('resumes').doc(id).get();
    
    if (!doc.exists) {
      return null;
    }

    const data = doc.data() as ResumeData;
    
    // Users can only access their own resumes
    if (data.userId !== userId) {
      throw new Error('Access denied: Not resume owner');
    }

    return data;
  }

  async getUserResumes(userId: string): Promise<ResumeData[]> {
    const snapshot = await this.db
      .collection('resumes')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map(doc => doc.data() as ResumeData);
  }

  // Usage tracking
  async getUserUsage(userId: string): Promise<UsageData | null> {
    const doc = await this.db.collection('usage').doc(userId).get();
    
    if (!doc.exists) {
      return null;
    }

    return doc.data() as UsageData;
  }

  async initializeUserUsage(userId: string): Promise<void> {
    const usageData: UsageData = {
      userId,
      interviews: { count: 0, limit: 5 },
      resumes: { count: 0, limit: 3 },
      updatedAt: new Date(),
    };

    await this.db.collection('usage').doc(userId).set(usageData);
  }

  async incrementUsage(userId: string, type: 'interviews' | 'resumes'): Promise<void> {
    const docRef = this.db.collection('usage').doc(userId);
    
    await this.db.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);
      
      if (!doc.exists) {
        throw new Error('Usage document not found');
      }

      const data = doc.data() as UsageData;
      const updatedData = {
        ...data,
        [type]: {
          ...data[type],
          count: data[type].count + 1,
        },
        updatedAt: new Date(),
      };

      transaction.update(docRef, updatedData);
    });
  }

  async checkUsageLimit(userId: string, type: 'interviews' | 'resumes'): Promise<boolean> {
    const usage = await this.getUserUsage(userId);
    
    if (!usage) {
      await this.initializeUserUsage(userId);
      return true;
    }

    return usage[type].count < usage[type].limit;
  }

  // User operations
  async createUser(uid: string, userData: { email: string; displayName?: string }): Promise<void> {
    await this.db.collection('users').doc(uid).set({
      ...userData,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Initialize usage counters
    await this.initializeUserUsage(uid);
  }

  async getUser(uid: string): Promise<any> {
    const doc = await this.db.collection('users').doc(uid).get();
    return doc.exists ? doc.data() : null;
  }

  async updateUser(uid: string, updates: any): Promise<void> {
    await this.db.collection('users').doc(uid).update({
      ...updates,
      updatedAt: new Date(),
    });
  }

  // Batch operations
  async batchDelete(collection: string, docs: string[]): Promise<void> {
    const batch = this.db.batch();
    
    docs.forEach(docId => {
      batch.delete(this.db.collection(collection).doc(docId));
    });

    await batch.commit();
  }

  // Health check
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; timestamp: Date }> {
    try {
      // Test Firestore connection
      await this.db.collection('_health').doc('test').set({
        timestamp: new Date(),
      });

      // Test read
      await this.db.collection('_health').doc('test').get();

      // Cleanup
      await this.db.collection('_health').doc('test').delete();

      return { status: 'healthy', timestamp: new Date() };
    } catch (error) {
      console.error('Firebase health check failed:', error);
      return { status: 'unhealthy', timestamp: new Date() };
    }
  }
}
