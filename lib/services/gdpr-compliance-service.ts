import { getFirestore } from 'firebase-admin/firestore';
import { azureBlobStorage } from '@/lib/services/azure-blob-storage';
import { getDBService } from '@/lib/firebase/admin';

export interface UserConsent {
  userId: string;
  analytics: boolean;
  marketing: boolean;
  functional: boolean;
  consentDate: Date;
  ipAddress?: string;
  userAgent?: string;
  version: string; // Privacy policy version
}

export interface DataDeletionRequest {
  userId: string;
  requestDate: Date;
  requestedBy: string; // email of person making request
  reason?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  completedDate?: Date;
  deletedData: string[]; // list of data types deleted
}

export interface AnonymizedAnalytics {
  timestamp: Date;
  event: string;
  page: string;
  userId: string; // hashed/pseudonymized
  sessionId: string; // hashed
  userAgent?: string; // anonymized
  location?: {
    country: string;
    region?: string; // only if consent given
  };
  metadata: Record<string, any>;
}

export class GDPRComplianceService {
  private db: Awaited<ReturnType<typeof getDBService>> | null = null;
  private static instance: GDPRComplianceService;
  
  private async getDB() {
    if (!this.db) {
      this.db = await getDBService();
    }
    return this.db;
  }

  public static getInstance(): GDPRComplianceService {
    if (!GDPRComplianceService.instance) {
      GDPRComplianceService.instance = new GDPRComplianceService();
    }
    return GDPRComplianceService.instance;
  }

  // Consent Management
  async recordConsent(consent: UserConsent): Promise<void> {
    try {
      const db = await this.getDB();
      const consentRef = db.collection('userConsents').doc(consent.userId);
      await consentRef.set({
        ...consent,
        consentDate: new Date(),
        version: this.getCurrentPrivacyPolicyVersion()
      });

      // Log consent change for audit trail
      await this.logConsentChange(consent);
    } catch (error) {
      console.error('Error recording consent:', error);
      throw new Error('Failed to record user consent');
    }
  }

  async getConsent(userId: string): Promise<UserConsent | null> {
    try {
      const db = await this.getDB();
      const consentRef = db.collection('userConsents').doc(userId);
      const doc = await consentRef.get();
      
      if (!doc.exists) {
        return null;
      }

      return (doc.data() as any) as UserConsent;
    } catch (error) {
      console.error('Error getting consent:', error);
      throw new Error('Failed to retrieve user consent');
    }
  }

  async updateConsent(userId: string, updates: Partial<UserConsent>): Promise<void> {
    try {
      const db = await this.getDB();
      const consentRef = db.collection('userConsents').doc(userId);
      await consentRef.update({
        ...updates,
        lastUpdated: new Date()
      });

      await this.logConsentChange({ userId, ...updates } as UserConsent);
    } catch (error) {
      console.error('Error updating consent:', error);
      throw new Error('Failed to update user consent');
    }
  }

  // Data Anonymization
  anonymizeAnalyticsData(data: {
    userId: string;
    sessionId: string;
    ipAddress?: string;
    userAgent?: string;
    event: string;
    page: string;
    metadata?: Record<string, any>;
  }): AnonymizedAnalytics {
    return {
      timestamp: new Date(),
      event: data.event,
      page: data.page,
      userId: this.hashUserId(data.userId),
      sessionId: this.hashSessionId(data.sessionId),
      userAgent: data.userAgent ? this.anonymizeUserAgent(data.userAgent) : undefined,
      location: data.ipAddress ? this.getLocationFromIP(data.ipAddress) : undefined,
      metadata: this.sanitizeMetadata(data.metadata || {})
    };
  }

  pseudonymizeUserData(userData: any): any {
    const pseudonymized = { ...userData };
    
    // Remove or hash PII fields
    if (pseudonymized.email) {
      pseudonymized.emailHash = this.hashEmail(pseudonymized.email);
      delete pseudonymized.email;
    }
    
    if (pseudonymized.name) {
      pseudonymized.nameInitials = this.getInitials(pseudonymized.name);
      delete pseudonymized.name;
    }
    
    if (pseudonymized.phone) {
      delete pseudonymized.phone;
    }
    
    if (pseudonymized.address) {
      // Keep only city and country
      pseudonymized.location = {
        city: pseudonymized.address.city,
        country: pseudonymized.address.country
      };
      delete pseudonymized.address;
    }

    // Add anonymization timestamp
    pseudonymized.anonymizedAt = new Date();
    
    return pseudonymized;
  }

  // Data Deletion
  async requestDataDeletion(
    userId: string, 
    requestedBy: string, 
    reason?: string
  ): Promise<string> {
    try {
      const requestId = this.generateRequestId();
      const deletionRequest: DataDeletionRequest = {
        userId,
        requestDate: new Date(),
        requestedBy,
        reason,
        status: 'pending',
        deletedData: []
      };

      const db = await this.getDB();
      await db.collection('dataDeletionRequests').doc(requestId).set(deletionRequest);
      
      // Schedule deletion process (30-day compliance window)
      await this.scheduleDataDeletion(requestId, userId);
      
      return requestId;
    } catch (error) {
      console.error('Error requesting data deletion:', error);
      throw new Error('Failed to request data deletion');
    }
  }

  async processDataDeletion(requestId: string): Promise<void> {
    try {
      const db = await this.getDB();
      const requestRef = db.collection('dataDeletionRequests').doc(requestId);
      const requestDoc = await requestRef.get();
      
      if (!requestDoc.exists) {
        throw new Error('Deletion request not found');
      }

      const request = (requestDoc.data() as any) as DataDeletionRequest;
      
      // Update status to processing
      await requestRef.update({ status: 'processing' });

      const deletedData: string[] = [];

      // Delete from Firestore collections
      const collectionsToDelete = [
        'users',
        'userProfiles',
        'resumes',
        'interviews',
        'analytics',
        'userConsents',
        'usage'
      ];

      for (const collection of collectionsToDelete) {
        const deleted = await this.deleteFromCollection(collection, request.userId);
        if (deleted) deletedData.push(collection);
      }

      // Delete from Firebase Storage
      const storageDeleted = await this.deleteFromStorage(request.userId);
      if (storageDeleted) deletedData.push('storage');

      // Delete from external services (if any)
      await this.deleteFromExternalServices(request.userId);

      // Update request status
      await requestRef.update({
        status: 'completed',
        completedDate: new Date(),
        deletedData
      });

      // Log completion for audit
      await this.logDataDeletion(request.userId, deletedData);

    } catch (error: any) {
      console.error('Error processing data deletion:', error);
      
      // Update request status to failed
      const failDb = await this.getDB();
      await failDb.collection('dataDeletionRequests').doc(requestId).update({
        status: 'failed',
        error: error.message || 'Unknown error'
      });
      
      throw error;
    }
  }

  async getDeletionRequestStatus(requestId: string): Promise<DataDeletionRequest | null> {
    try {
      const db = await this.getDB();
      const requestDoc = await db.collection('dataDeletionRequests').doc(requestId).get();
      return requestDoc.exists ? ((requestDoc.data() as any) as DataDeletionRequest) : null;
    } catch (error) {
      console.error('Error getting deletion request status:', error);
      throw new Error('Failed to get deletion request status');
    }
  }

  // Data Export (Subject Access Request)
  async exportUserData(userId: string): Promise<any> {
    try {
      const userData: any = {
        userId,
        exportDate: new Date(),
        data: {}
      };

      // Export from all relevant collections
      const collections = ['users', 'userProfiles', 'resumes', 'interviews'];
      
      const db = await this.getDB();
      for (const collectionName of collections) {
        const docs = await db.collection(collectionName)
          .where('userId', '==', userId)
          .get();
        
        userData.data[collectionName] = docs.docs.map((doc: any) => ({
          id: doc.id,
          ...(doc.data() as any)
        }));
      }

      // Export consent records
      const consentDoc = await db.collection('userConsents').doc(userId).get();
      if (consentDoc.exists) {
        userData.data.consents = consentDoc.data() as any;
      }

      // Export usage data
      const usageDoc = await db.collection('usage').doc(userId).get();
      if (usageDoc.exists) {
        userData.data.usage = usageDoc.data() as any;
      }

      return userData;
    } catch (error) {
      console.error('Error exporting user data:', error);
      throw new Error('Failed to export user data');
    }
  }

  // Privacy Utilities
  maskEmail(email: string): string {
    const [username, domain] = email.split('@');
    const maskedUsername = username.length > 2 
      ? username.charAt(0) + '*'.repeat(username.length - 2) + username.charAt(username.length - 1)
      : '*'.repeat(username.length);
    return `${maskedUsername}@${domain}`;
  }

  maskPhoneNumber(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length > 4) {
      return cleaned.substring(0, 3) + '*'.repeat(cleaned.length - 6) + cleaned.substring(cleaned.length - 3);
    }
    return '*'.repeat(cleaned.length);
  }

  // Private helper methods
  private getCurrentPrivacyPolicyVersion(): string {
    return 'v1.0'; // Update when privacy policy changes
  }

  private async logConsentChange(consent: UserConsent): Promise<void> {
    const db = await this.getDB();
    await db.collection('consentAuditLog').add({
      userId: consent.userId,
      timestamp: new Date(),
      changes: consent,
      source: 'user-settings'
    });
  }

  private hashUserId(userId: string): string {
    // Use a consistent hashing algorithm
    return Buffer.from(userId).toString('base64').substring(0, 12);
  }

  private hashSessionId(sessionId: string): string {
    return Buffer.from(sessionId).toString('base64').substring(0, 8);
  }

  private hashEmail(email: string): string {
    return Buffer.from(email).toString('base64');
  }

  private getInitials(name: string): string {
    return name.split(' ').map(n => n.charAt(0).toUpperCase()).join('.');
  }

  private anonymizeUserAgent(userAgent: string): string {
    // Remove version numbers and specific identifiers
    return userAgent.replace(/\/[\d\.]+/g, '/x.x')
                   .replace(/\([^)]*\)/g, '(anonymized)');
  }

  private getLocationFromIP(ipAddress: string): { country: string; region?: string } | undefined {
    // In production, use a GeoIP service
    // For now, return minimal location data
    return {
      country: 'Unknown'
    };
  }

  private sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
    const sanitized = { ...metadata };
    
    // Remove potential PII from metadata
    const piiKeys = ['email', 'phone', 'name', 'address', 'ssn', 'creditCard'];
    piiKeys.forEach(key => {
      if (sanitized[key]) {
        delete sanitized[key];
      }
    });
    
    return sanitized;
  }

  private generateRequestId(): string {
    return `del_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  private async scheduleDataDeletion(requestId: string, userId: string): Promise<void> {
    // In production, use Cloud Functions or Cloud Tasks to schedule deletion
    // For now, just log the scheduling
    console.log(`Scheduled data deletion for user ${userId} with request ${requestId}`);
  }

  private async deleteFromCollection(collectionName: string, userId: string): Promise<boolean> {
    try {
      const db = await this.getDB();
      const batch = db.batch();
      const docs = await db.collection(collectionName)
        .where('userId', '==', userId)
        .get();

      docs.docs.forEach((doc: any) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      return docs.docs.length > 0;
    } catch (error) {
      console.error(`Error deleting from ${collectionName}:`, error);
      return false;
    }
  }

  private async deleteFromStorage(userId: string): Promise<boolean> {
    let filesDeleted = false;
    
    try {
      // Try Azure Blob Storage first
      await azureBlobStorage.initialize();
      if (azureBlobStorage.isReady()) {
        console.log(`🗑️ Deleting Azure Blob Storage files for user ${userId}`);
        const deletedContainers = await azureBlobStorage.deleteAllUserFiles(userId);
        if (deletedContainers.length > 0) {
          console.log(`✅ Deleted from Azure containers: ${deletedContainers.join(', ')}`);
          filesDeleted = true;
        }
      }
    } catch (azureError) {
      console.error('Error deleting from Azure Blob Storage:', azureError);
    }

    // Also attempt Firebase Storage cleanup for legacy files
    try {
      // Dynamic import to avoid circular dependency
      const { getStorage } = await import('firebase-admin/storage');
      const storage = getStorage();
      const bucket = storage.bucket();
      
      const [files] = await bucket.getFiles({
        prefix: `users/${userId}/`
      });
      
      if (files.length > 0) {
        const deletePromises = files.map(file => file.delete());
        await Promise.all(deletePromises);
        console.log(`✅ Deleted ${files.length} legacy Firebase Storage files for user ${userId}`);
        filesDeleted = true;
      }
    } catch (firebaseError) {
      console.error('Error deleting from Firebase Storage:', firebaseError);
    }

    return filesDeleted;
  }

  private async deleteFromExternalServices(userId: string): Promise<void> {
    // Delete from external services like analytics, email providers, etc.
    // Implementation depends on which external services are used
    console.log(`Deleting user ${userId} from external services`);
  }

  private async logDataDeletion(userId: string, deletedData: string[]): Promise<void> {
    const db = await this.getDB();
    await db.collection('dataProtectionAuditLog').add({
      userId,
      action: 'data_deletion',
      timestamp: new Date(),
      deletedCollections: deletedData,
      complianceOfficer: 'system'
    });
  }
}

export const gdprComplianceService = GDPRComplianceService.getInstance();
