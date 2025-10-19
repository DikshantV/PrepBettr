/**
 * Firestore Resume Repository Implementation
 * Provides CRUD operations for resume documents in Firebase Firestore
 */

import { getFirestore } from 'firebase-admin/firestore';
import { IResumeRepository } from '../interfaces/IRepositories';
import { IResumeDocument } from '../interfaces/IDocuments';
import { RepositoryResult } from '../interfaces/RepositoryResult';
import { IQueryOptions } from '../interfaces/IRepositories';

export class FirestoreResumeRepository implements IResumeRepository<IResumeDocument> {
  private db: FirebaseFirestore.Firestore;
  private collectionName: string = 'resumes';

  constructor() {
    this.db = getFirestore();
  }

  /**
   * Create a new resume document
   */
  async create(data: Omit<IResumeDocument, 'id'>): Promise<RepositoryResult<IResumeDocument>> {
    try {
      // Prepare document data
      const documentToCreate = {
        ...data,
        createdDate: new Date().toISOString(),
        updatedDate: new Date().toISOString()
      };

      // Create document in Firestore
      const docRef = await this.db.collection(this.collectionName).add(documentToCreate);
      
      // Get the created document with its ID
      const createdDoc = await docRef.get();
      const documentData = createdDoc.data();

      const resultDocument: IResumeDocument = {
        ...documentData,
        id: docRef.id
      } as IResumeDocument;

      return {
        success: true,
        data: resultDocument
      };
    } catch (error) {
      console.error('FirestoreResumeRepository create error:', error);
      
      return {
        success: false,
        error: this.handleError(error),
        data: null
      };
    }
  }

  /**
   * Find a resume document by ID
   */
  async findById(id: string): Promise<RepositoryResult<IResumeDocument | null>> {
    try {
      const docRef = doc(this.db, this.collectionName, id);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return {
          success: true,
          data: null
        };
      }

      const documentData = docSnap.data();
      const document: IResumeDocument = {
        ...documentData,
        id: docSnap.id
      } as IResumeDocument;

      return {
        success: true,
        data: document
      };
    } catch (error) {
      console.error('FirestoreResumeRepository findById error:', error);
      
      return {
        success: false,
        error: this.handleError(error),
        data: null
      };
    }
  }

  /**
   * Find multiple resume documents with optional filtering and pagination
   */
  async findMany(
    conditions: Partial<IResumeDocument> = {},
    options: QueryOptions = {}
  ): Promise<RepositoryResult<IResumeDocument[]>> {
    try {
      let queryRef: Query<DocumentData> = collection(this.db, this.collectionName);

      // Apply where conditions
      Object.entries(conditions).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryRef = query(queryRef, where(key, '==', value));
        }
      });

      // Apply ordering
      if (options.orderBy) {
        const direction = options.orderDirection === 'desc' ? 'desc' : 'asc';
        queryRef = query(queryRef, orderBy(options.orderBy, direction));
      }

      // Apply limit
      if (options.limit) {
        queryRef = query(queryRef, firestoreLimit(options.limit));
      }

      // Execute query
      const querySnapshot = await getDocs(queryRef);
      
      let documents: IResumeDocument[] = [];
      querySnapshot.forEach((doc) => {
        const documentData = doc.data();
        documents.push({
          ...documentData,
          id: doc.id
        } as IResumeDocument);
      });

      // Apply offset manually since Firestore doesn't have native offset
      if (options.offset && options.offset > 0) {
        documents = documents.slice(options.offset);
      }

      return {
        success: true,
        data: documents
      };
    } catch (error) {
      console.error('FirestoreResumeRepository findMany error:', error);
      
      return {
        success: false,
        error: this.handleError(error),
        data: []
      };
    }
  }

  /**
   * Update a resume document
   */
  async update(id: string, updates: Partial<IResumeDocument>): Promise<RepositoryResult<IResumeDocument>> {
    try {
      const docRef = doc(this.db, this.collectionName, id);
      
      // Check if document exists
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        return {
          success: false,
          error: 'Document not found',
          data: null
        };
      }

      // Prepare updates
      const updatesWithTimestamp = {
        ...updates,
        updatedAt: new Date().toISOString()
      };

      // Remove undefined values and id from updates
      const cleanUpdates = Object.fromEntries(
        Object.entries(updatesWithTimestamp).filter(([key, value]) => {
          return value !== undefined && key !== 'id';
        })
      );

      // Validate the updated document would be valid
      const existingData = docSnap.data();
      const mergedDocument = {
        ...existingData,
        ...cleanUpdates,
        id
      } as IResumeDocument;

      this.validateResumeDocument(mergedDocument);

      // Update the document
      await updateDoc(docRef, cleanUpdates);

      // Return the updated document
      const updatedDocSnap = await getDoc(docRef);
      const updatedData = updatedDocSnap.data();

      const resultDocument: IResumeDocument = {
        ...updatedData,
        id: updatedDocSnap.id
      } as IResumeDocument;

      return {
        success: true,
        data: resultDocument
      };
    } catch (error) {
      console.error('FirestoreResumeRepository update error:', error);
      
      return {
        success: false,
        error: this.handleError(error),
        data: null
      };
    }
  }

  /**
   * Delete a resume document
   */
  async delete(id: string): Promise<RepositoryResult<boolean>> {
    try {
      const docRef = doc(this.db, this.collectionName, id);
      
      // Check if document exists
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        return {
          success: false,
          error: 'Document not found',
          data: false
        };
      }

      // Delete the document
      await deleteDoc(docRef);

      return {
        success: true,
        data: true
      };
    } catch (error) {
      console.error('FirestoreResumeRepository delete error:', error);
      
      return {
        success: false,
        error: this.handleError(error),
        data: false
      };
    }
  }

  /**
   * Count documents matching the given conditions
   */
  async count(conditions: Partial<IResumeDocument> = {}): Promise<RepositoryResult<number>> {
    try {
      let queryRef: Query<DocumentData> = collection(this.db, this.collectionName);

      // Apply where conditions
      Object.entries(conditions).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryRef = query(queryRef, where(key, '==', value));
        }
      });

      // Get all documents matching the conditions
      const querySnapshot = await getDocs(queryRef);
      const count = querySnapshot.size;

      return {
        success: true,
        data: count
      };
    } catch (error) {
      console.error('FirestoreResumeRepository count error:', error);
      
      return {
        success: false,
        error: this.handleError(error),
        data: 0
      };
    }
  }

  /**
   * Check if a document exists
   */
  async exists(id: string): Promise<RepositoryResult<boolean>> {
    try {
      const docRef = doc(this.db, this.collectionName, id);
      const docSnap = await getDoc(docRef);

      return {
        success: true,
        data: docSnap.exists()
      };
    } catch (error) {
      console.error('FirestoreResumeRepository exists error:', error);
      
      return {
        success: false,
        error: this.handleError(error),
        data: false
      };
    }
  }

  /**
   * Get resumes by user ID with pagination
   */
  async getResumesByUser(
    userId: string, 
    lastDocId?: string, 
    limitCount: number = 10
  ): Promise<RepositoryResult<IResumeDocument[]>> {
    try {
      let queryRef: Query<DocumentData> = query(
        collection(this.db, this.collectionName),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        firestoreLimit(limitCount)
      );

      // Apply cursor-based pagination
      if (lastDocId) {
        const lastDoc = await getDoc(doc(this.db, this.collectionName, lastDocId));
        if (lastDoc.exists()) {
          queryRef = query(queryRef, startAfter(lastDoc));
        }
      }

      const querySnapshot = await getDocs(queryRef);
      
      const documents: IResumeDocument[] = [];
      querySnapshot.forEach((doc) => {
        const documentData = doc.data();
        documents.push({
          ...documentData,
          id: doc.id
        } as IResumeDocument);
      });

      return {
        success: true,
        data: documents
      };
    } catch (error) {
      console.error('FirestoreResumeRepository getResumesByUser error:', error);
      
      return {
        success: false,
        error: this.handleError(error),
        data: []
      };
    }
  }

  /**
   * Get resumes by ATS score range
   */
  async getResumesByAtsScore(
    minScore: number, 
    maxScore: number,
    limitCount: number = 50
  ): Promise<RepositoryResult<IResumeDocument[]>> {
    try {
      const queryRef = query(
        collection(this.db, this.collectionName),
        where('atsScore', '>=', minScore),
        where('atsScore', '<=', maxScore),
        orderBy('atsScore', 'desc'),
        firestoreLimit(limitCount)
      );

      const querySnapshot = await getDocs(queryRef);
      
      const documents: IResumeDocument[] = [];
      querySnapshot.forEach((doc) => {
        const documentData = doc.data();
        documents.push({
          ...documentData,
          id: doc.id
        } as IResumeDocument);
      });

      return {
        success: true,
        data: documents
      };
    } catch (error) {
      console.error('FirestoreResumeRepository getResumesByAtsScore error:', error);
      
      return {
        success: false,
        error: this.handleError(error),
        data: []
      };
    }
  }

  /**
   * Search resumes by content (basic text search)
   */
  async searchResumes(searchTerm: string, limitCount: number = 20): Promise<RepositoryResult<IResumeDocument[]>> {
    try {
      // Firestore doesn't have built-in full-text search, so we'll do a basic search
      // In production, you might want to use Algolia or Elasticsearch for this
      const queryRef = query(
        collection(this.db, this.collectionName),
        orderBy('createdAt', 'desc'),
        firestoreLimit(limitCount * 2) // Get more to filter client-side
      );

      const querySnapshot = await getDocs(queryRef);
      
      const documents: IResumeDocument[] = [];
      const searchTermLower = searchTerm.toLowerCase();

      querySnapshot.forEach((doc) => {
        const documentData = doc.data();
        const document = {
          ...documentData,
          id: doc.id
        } as IResumeDocument;

        // Basic text search in extractedText and fileName
        const searchableText = `${document.fileName || ''} ${document.extractedText || ''}`.toLowerCase();
        
        if (searchableText.includes(searchTermLower)) {
          documents.push(document);
        }
      });

      // Limit results to requested count
      const limitedResults = documents.slice(0, limitCount);

      return {
        success: true,
        data: limitedResults
      };
    } catch (error) {
      console.error('FirestoreResumeRepository searchResumes error:', error);
      
      return {
        success: false,
        error: this.handleError(error),
        data: []
      };
    }
  }

  /**
   * Validate resume document structure
   */
  private validateResumeDocument(document: IResumeDocument): void {
    if (!document.userId) {
      throw new Error('userId is required');
    }
    if (!document.fileName) {
      throw new Error('fileName is required');
    }
    if (!document.uploadDate) {
      throw new Error('uploadDate is required');
    }
  }

  /**
   * Handle and format errors consistently
   */
  private handleError(error: any): string {
    if (error.code === 'permission-denied') {
      return 'Access denied - check Firestore security rules';
    }
    if (error.code === 'unavailable') {
      return 'Firestore service unavailable - please try again';
    }
    if (error.code === 'deadline-exceeded') {
      return 'Request timeout - Firestore operation timed out';
    }
    if (error.code === 'resource-exhausted') {
      return 'Quota exceeded - too many requests';
    }
    
    return error.message || 'Unknown Firestore error';
  }

  /**
   * Batch create multiple documents
   */
  async batchCreate(documents: Omit<IResumeDocument, 'id'>[]): Promise<RepositoryResult<IResumeDocument[]>> {
    try {
      const batch = this.db.batch();
      const createdDocuments: IResumeDocument[] = [];
      
      for (const documentData of documents) {
        const docRef = doc(collection(this.db, this.collectionName));
        const documentToCreate = {
          ...documentData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        // Validate each document
        this.validateResumeDocument(documentToCreate as IResumeDocument);
        
        batch.set(docRef, documentToCreate);
        
        createdDocuments.push({
          ...documentToCreate,
          id: docRef.id
        } as IResumeDocument);
      }

      await batch.commit();

      return {
        success: true,
        data: createdDocuments
      };
    } catch (error) {
      console.error('FirestoreResumeRepository batchCreate error:', error);
      
      return {
        success: false,
        error: this.handleError(error),
        data: []
      };
    }
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<{
    totalDocuments: number;
    averageAtsScore: number;
    documentsByUser: Record<string, number>;
  }> {
    try {
      // Get all documents to calculate stats
      const querySnapshot = await getDocs(collection(this.db, this.collectionName));
      
      const totalDocuments = querySnapshot.size;
      let totalAtsScore = 0;
      let validAtsScoreCount = 0;
      const documentsByUser: Record<string, number> = {};

      querySnapshot.forEach((doc) => {
        const data = doc.data() as IResumeDocument;
        
        // Count documents by user
        if (data.userId) {
          documentsByUser[data.userId] = (documentsByUser[data.userId] || 0) + 1;
        }

        // Calculate average ATS score
        if (typeof data.atsScore === 'number' && !isNaN(data.atsScore)) {
          totalAtsScore += data.atsScore;
          validAtsScoreCount++;
        }
      });

      const averageAtsScore = validAtsScoreCount > 0 ? totalAtsScore / validAtsScoreCount : 0;

      return {
        totalDocuments,
        averageAtsScore,
        documentsByUser
      };
    } catch (error) {
      console.error('FirestoreResumeRepository getStats error:', error);
      return {
        totalDocuments: 0,
        averageAtsScore: 0,
        documentsByUser: {}
      };
    }
  }
}