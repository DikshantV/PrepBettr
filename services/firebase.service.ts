/**
 * Firebase Service Compatibility Layer
 * 
 * Provides mock Firebase service for backward compatibility
 * Applications should migrate to Azure services
 */

export class FirebaseService {
  private static instance: FirebaseService;

  public static getInstance(): FirebaseService {
    if (!FirebaseService.instance) {
      FirebaseService.instance = new FirebaseService();
    }
    return FirebaseService.instance;
  }

  /**
   * Mock authentication methods
   */
  async signInWithEmailAndPassword(email: string, password: string) {
    // Mock sign in - in production this would call Azure AD B2C
    return {
      user: {
        uid: 'mock-user-id',
        email,
        displayName: 'Mock User'
      }
    };
  }

  async createUserWithEmailAndPassword(email: string, password: string) {
    // Mock user creation
    return {
      user: {
        uid: 'mock-new-user-id',
        email,
        displayName: 'New Mock User'
      }
    };
  }

  async signOut() {
    // Mock sign out
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
      sessionStorage.removeItem('auth_token');
    }
  }

  /**
   * Mock Firestore operations
   */
  async getDocument(collection: string, id: string) {
    // Mock document fetch
    return {
      id,
      data: {
        createdAt: new Date(),
        updatedAt: new Date()
      }
    };
  }

  async setDocument(collection: string, id: string, data: any) {
    // Mock document set
    return { id };
  }

  async updateDocument(collection: string, id: string, data: any) {
    // Mock document update
    return { id };
  }

  async deleteDocument(collection: string, id: string) {
    // Mock document delete
    return { success: true };
  }

  async queryDocuments(collection: string, conditions: any[] = []) {
    // Mock query
    return {
      docs: []
    };
  }

  /**
   * Mock storage operations
   */
  async uploadFile(path: string, file: File | Buffer) {
    // Mock file upload - would delegate to Azure Blob Storage
    return {
      downloadURL: `https://mockcdn.example.com/${path}`,
      metadata: {
        size: file instanceof File ? file.size : file.length,
        contentType: file instanceof File ? file.type : 'application/octet-stream'
      }
    };
  }

  async deleteFile(path: string) {
    // Mock file deletion
    return { success: true };
  }

  async getDownloadURL(path: string) {
    // Mock URL generation
    return `https://mockcdn.example.com/${path}`;
  }
}

// Export singleton instance
export const firebaseService = FirebaseService.getInstance();
export default firebaseService;
