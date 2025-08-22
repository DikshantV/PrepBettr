/**
 * Firebase Storage Adapter
 * 
 * Adapter for Firebase Cloud Storage service
 * This is a stub since Firebase services are being phased out
 */

import { IStorageService } from '../../shared/interfaces';

export class FirebaseStorageAdapter implements IStorageService {
  async upload(container: string, fileName: string, fileBuffer: Buffer, mimeType: string, options?: any): Promise<any> {
    throw new Error('Firebase Storage Adapter deprecated - use Azure Blob Storage');
  }

  async download(container: string, fileName: string): Promise<Buffer> {
    throw new Error('Firebase Storage Adapter deprecated - use Azure Blob Storage');
  }

  async delete(container: string, fileName: string): Promise<void> {
    throw new Error('Firebase Storage Adapter deprecated - use Azure Blob Storage');
  }

  async generateSignedUrl(container: string, fileName: string, expiryHours?: number): Promise<string> {
    throw new Error('Firebase Storage Adapter deprecated - use Azure Blob Storage');
  }

  async listFiles(container: string, prefix?: string): Promise<any[]> {
    console.warn('Firebase Storage Adapter is deprecated - use Azure Blob Storage instead');
    return [];
  }

  async getFileMetadata(container: string, fileName: string): Promise<any> {
    throw new Error('Firebase Storage Adapter deprecated - use Azure Blob Storage');
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    return {
      healthy: false,
      message: 'Firebase Storage Adapter is deprecated'
    };
  }
}
