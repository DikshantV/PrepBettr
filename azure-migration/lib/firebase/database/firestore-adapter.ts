/**
 * Firebase Firestore Adapter
 * 
 * Adapter for Firebase Firestore service
 * This is a stub since Firebase services are being phased out
 */

import { IDocumentService } from '../../shared/interfaces';

export class FirebaseFirestoreAdapter implements IDocumentService {
  async get(collection: string, documentId: string): Promise<any> {
    console.warn('Firebase Firestore Adapter is deprecated - use Azure Cosmos DB instead');
    return null;
  }

  async create(collection: string, data: Record<string, any>, documentId?: string): Promise<string> {
    throw new Error('Firebase Firestore Adapter deprecated - use Azure Cosmos DB');
  }

  async update(collection: string, documentId: string, data: Record<string, any>): Promise<void> {
    throw new Error('Firebase Firestore Adapter deprecated - use Azure Cosmos DB');
  }

  async delete(collection: string, documentId: string): Promise<void> {
    throw new Error('Firebase Firestore Adapter deprecated - use Azure Cosmos DB');
  }

  async query(collection: string, options?: any): Promise<any[]> {
    console.warn('Firebase Firestore Adapter is deprecated - use Azure Cosmos DB instead');
    return [];
  }

  subscribe(collection: string, documentId: string, callback: (doc: any) => void): () => void {
    console.warn('Firebase Firestore Adapter is deprecated - use Azure Cosmos DB with SignalR');
    return () => {};
  }

  subscribeToQuery(collection: string, options: any, callback: (docs: any[]) => void): () => void {
    console.warn('Firebase Firestore Adapter is deprecated - use Azure Cosmos DB with SignalR');
    return () => {};
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    return {
      healthy: false,
      message: 'Firebase Firestore Adapter is deprecated'
    };
  }
}
